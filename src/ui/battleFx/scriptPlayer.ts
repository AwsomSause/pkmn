// Plays one scripted EBDX move animation (core/presentation/scriptAnim.ts).
// One clock drives every particle, so stopping it is a single call: it removes
// the pictures and puts both Pokémon back as they were. It only draws; it never
// reads or changes battle state, and the spread of the particles is a fixed
// hash, not the gameplay random streams.

import Phaser from 'phaser';
import { ebdxAssetIds } from '../../assets/catalog';
import { EBDX_SCALE, ease, lifeAlpha, scatter, type ScriptAnim, type ScriptLayer, type ScriptPoint } from '../../core/presentation/scriptAnim';
import { services } from '../../game/services';
import type { PlayHandle, Stage } from './animPlayer';

interface Particle {
  img: Phaser.GameObjects.Image;
  layer: ScriptLayer;
  index: number;
  row: number;
  flip: boolean;
  scaleMul: number;
  from: Phaser.Math.Vector2;
  to: Phaser.Math.Vector2;
  bend: number;
}

const colour = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

export function playScript(stage: Stage, name: string, script: ScriptAnim): PlayHandle {
  const { scene, field } = stage;
  const settings = services().session.settings;
  const strength = Math.max(0.25, settings.effectIntensity);
  const user = stage.user;
  const target = stage.target;
  const sameMon = user === target;
  const startUser = { x: user.x, y: user.y, sx: user.scaleX, sy: user.scaleY, alpha: user.alpha };
  const startTarget = { x: target.x, y: target.y, sx: target.scaleX, sy: target.scaleY, alpha: target.alpha };

  const heightOf = (v: typeof user) => (v instanceof Phaser.GameObjects.Sprite ? v.displayHeight : v.getBounds().height || 120);
  const centreOf = (v: typeof user, start: { x: number; y: number }) => new Phaser.Math.Vector2(start.x, start.y - heightOf(v) / 2);
  const userC = centreOf(user, startUser);
  const targetC = centreOf(target, startTarget);
  // The script is written for the player's side attacking; the other way round it is mirrored left-right.
  const mirror = stage.userIsPlayer ? 1 : -1;

  const resolve = (p: ScriptPoint, layer: number, index: number, slot: number): Phaser.Math.Vector2 => {
    const base = p.at === 'user' ? userC : p.at === 'target' ? targetC : userC.clone().add(targetC).scale(0.5);
    const jx = p.jx ? (scatter(name, layer, index, slot) - 0.5) * p.jx : 0;
    const jy = p.jy ? (scatter(name, layer, index, slot + 1) - 0.5) * p.jy : 0;
    return new Phaser.Math.Vector2(base.x + (p.dx + jx) * EBDX_SCALE * mirror, base.y + (p.dy + jy) * EBDX_SCALE);
  };

  const particles: Particle[] = [];
  script.layers.forEach((layer, li) => {
    const key = ebdxAssetIds.image(layer.img);
    if (!scene.textures.exists(key)) return;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage();
    const cw = layer.cell?.[0] ?? src.width;
    const ch = layer.cell?.[1] ?? src.height;
    const cols = Math.max(1, Math.floor(src.width / cw));
    const rows = Math.max(1, Math.floor(src.height / ch));
    for (let c = 0; c < cols * rows; c++) {
      const fname = `s${cw}x${ch}:${c}`;
      if (!tex.has(fname)) tex.add(fname, 0, (c % cols) * cw, Math.floor(c / cols) * ch, cw, ch);
    }
    for (let i = 0; i < layer.count; i++) {
      const img = scene.add.image(0, 0, key, `s${cw}x${ch}:0`).setOrigin(layer.origin[0], layer.origin[1]).setAlpha(0).setVisible(false);
      if (layer.blend === 'add') img.setBlendMode(Phaser.BlendModes.ADD);
      if (layer.tint) img.setTint(colour(layer.tint));
      field.add(img);
      field.bringToTop(img);
      const from = resolve(layer.from, li, i, 0);
      const to = layer.to ? resolve(layer.to, li, i, 2) : from.clone();
      const set = layer.scaleSet;
      particles.push({
        img,
        layer,
        index: i,
        row: layer.randomRow ? Math.floor(scatter(name, li, i, 4) * rows) : 0,
        flip: layer.flip && scatter(name, li, i, 5) < 0.5,
        scaleMul: set ? set[Math.floor(scatter(name, li, i, 6) * set.length)]! : 1,
        from,
        to,
        bend: scatter(name, li, i, 7) < 0.5 ? -1 : 1,
      });
    }
  });

  let veil: Phaser.GameObjects.Rectangle | null = null;
  if (script.veil) {
    veil = scene.add.rectangle(480, 270, 960, 540, colour(script.veil.color), 0).setDepth(0);
    field.add(veil);
    field.sendToBack(veil);
    field.moveTo(veil, Math.min(stage.backgroundIndex + 1, field.length - 1));
  }

  let finished = false;
  let counter: Phaser.Tweens.Tween | null = null;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((r) => (resolveDone = r));
  const played = new Set<number>();

  const restore = () => {
    for (const [v, s] of [[user, startUser], [target, startTarget]] as const) {
      if (!v.active) continue;
      v.setPosition(s.x, s.y).setScale(s.sx, s.sy).setAlpha(s.alpha);
      if (v instanceof Phaser.GameObjects.Sprite) v.clearTint();
    }
  };
  const cleanUp = () => {
    if (finished) return;
    finished = true;
    counter?.stop();
    particles.forEach((p) => p.img.destroy());
    particles.length = 0;
    veil?.destroy();
    veil = null;
    restore();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanUp);
    resolveDone();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanUp);

  const frame = (t: number) => {
    for (const p of particles) {
      const { layer, img } = p;
      const life = (t - layer.start - layer.stagger * p.index) / layer.dur;
      const a = lifeAlpha(life, layer.fade) * layer.alpha;
      img.setVisible(a > 0.01);
      if (a <= 0.01) continue;
      const e = ease(layer.ease, life);
      const x = Phaser.Math.Linear(p.from.x, p.to.x, e);
      const y = Phaser.Math.Linear(p.from.y, p.to.y, e);
      const dx = p.to.x - p.from.x;
      const dy = p.to.y - p.from.y;
      const len = Math.hypot(dx, dy) || 1;
      const bulge = layer.arc * EBDX_SCALE * p.bend * Math.sin(Math.PI * Math.min(1, Math.max(0, life)));
      img.setPosition(x + (-dy / len) * bulge, y + (dx / len) * bulge);
      const s = (layer.scale[0] + (layer.scale[1] - layer.scale[0]) * Math.min(1, Math.max(0, life))) * p.scaleMul * EBDX_SCALE;
      img.setScale(p.flip ? -s : s, s);
      img.setAlpha(Math.min(1, a));
      if (layer.angle === 'aim') img.setAngle((Math.atan2(dy, dx) * 180) / Math.PI);
      else img.setAngle(layer.angle[0] + (layer.angle[1] - layer.angle[0]) * Math.min(1, Math.max(0, life)));
      const cw = layer.cell?.[0] ?? img.texture.getSourceImage().width;
      const ch = layer.cell?.[1] ?? img.texture.getSourceImage().height;
      const cols = Math.max(1, Math.floor(img.texture.getSourceImage().width / cw));
      const list = layer.frames ?? Array.from({ length: cols }, (_, c) => c);
      const step = Math.floor(Math.max(0, t - layer.start - layer.stagger * p.index) / layer.frameMs) % list.length;
      img.setFrame(`s${cw}x${ch}:${list[step]! + p.row * cols}`);
    }
    if (veil && script.veil) {
      const { alpha, inMs, outMs } = script.veil;
      const fadeIn = inMs > 0 ? Math.min(1, t / inMs) : 1;
      const fadeOut = outMs > 0 ? Math.min(1, (script.length - t) / outMs) : 1;
      veil.setAlpha(alpha * Math.max(0, Math.min(fadeIn, fadeOut)) * Math.min(1, strength));
    }
    // The target's reaction.
    const hit = script.hit;
    if (hit && target.active && !sameMon) {
      const since = t - hit.at;
      if (since >= 0) {
        if (hit.squash > 0 && since < 300) {
          const k = Math.sin((Math.PI * since) / 300) * hit.squash * strength;
          target.setScale(startTarget.sx * (1 + k * 0.5), startTarget.sy * (1 - k));
        } else if (hit.squash > 0) target.setScale(startTarget.sx, startTarget.sy);
        if (hit.shake && settings.shakeIntensity > 0 && since < hit.shake.ms) {
          const decay = 1 - since / hit.shake.ms;
          target.x = startTarget.x + Math.sin(since / 22) * hit.shake.amp * EBDX_SCALE * decay * settings.shakeIntensity;
        } else if (hit.shake) target.x = startTarget.x;
        if (hit.flash && target instanceof Phaser.GameObjects.Sprite) {
          if (since < hit.flash.ms) {
            const k = 1 - since / hit.flash.ms;
            const base = Phaser.Display.Color.ValueToColor(0xffffff);
            const flash = Phaser.Display.Color.HexStringToColor(hit.flash.color);
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(base, flash, 100, Math.round(k * 100));
            target.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
          } else target.clearTint();
        }
      }
    }
    const us = script.userShake;
    if (us && user.active) {
      const since = t - us.at;
      if (since >= 0 && since < us.ms && settings.shakeIntensity > 0) user.x = startUser.x + (Math.floor(since / 25) % 2 ? -1 : 1) * us.amp * EBDX_SCALE * settings.shakeIntensity;
      else if (since >= us.ms) user.x = startUser.x;
    }
    if (!settings.muted) {
      script.sfx.forEach((f, i) => {
        if (played.has(i) || t < f.at) return;
        played.add(i);
        const key = ebdxAssetIds.sound(f.id);
        if (scene.cache.audio.exists(key)) {
          try {
            scene.sound.play(key, { volume: f.vol * settings.sfxVolume });
          } catch {
            /* audio is optional */
          }
        }
      });
    }
  };

  const clock = { t: 0 };
  frame(0);
  counter = scene.tweens.add({
    targets: clock,
    t: script.length,
    duration: script.length,
    ease: 'Linear',
    onUpdate: () => frame(clock.t),
    onComplete: cleanUp,
  });

  return { done, stop: cleanUp };
}
