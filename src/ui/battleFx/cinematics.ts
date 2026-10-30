// Transformation cinematics (Visual Bible: "spectacle via presentation cues"):
// Mega Evolution and Primal Reversion shatter a crystal over the Pokémon
// (EBDX "Primega Shatter", its crystal art cut by tools/essentials/cut-primega.py),
// Dynamax and Gigantamax open a red Max storm (Raid Battles' Max transition
// art), a Z-Move calls down Z-Power (Raid Battles' Ultra art) and Terastal
// crystallises (its Tera art), with Deluxe Battle Kit orbs and glows.
//
// The battle has already decided everything: `onSwap` is where the scene
// shows the new form, and it runs exactly once (at the climax, at once when
// animations are off, or when the player skips). Nothing here draws random
// numbers; every spread is a fixed pattern.

import Phaser from 'phaser';
import { animAssetIds } from '../../assets/catalog';
import { services } from '../../game/services';
import type { MotionLevel } from '../aero';
import { loadAssets } from '../lazyAssets';
import type { Visual } from '../sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import type { Beat } from './spectacle';
import { CINE_ASSETS, CINE_MS, CINE_SOUNDS, SWAP_AT, type CineKind } from './cineLook';
import shards from './primegaShards.json';

export type { CineKind } from './cineLook';


export interface CineOptions {
  kind: CineKind;
  /** The Pokémon's centre on screen. */
  x: number;
  y: number;
  sprite: Visual | null;
  /** Type or crystal colour. */
  tint: number;
  /** Which crystal a Primal Reversion uses: Groudon's Omega or Kyogre's Alpha. */
  crystal?: 'mega' | 'alpha' | 'omega';
  /** Big words for the moment (the Z-Move's name). */
  title?: string;
  motion: MotionLevel;
  /** 1 normal, 2 fast, 3 quick. */
  speed: number;
  intensity: number;
  onSwap: () => void;
  depth?: number;
}

/** Starts loading the cinematic art and sounds (call when a battle starts). */
export function prefetchCinematics(scene: Phaser.Scene): void {
  const { assets, session } = services();
  if (session.settings.battleAnimations === 'off') return;
  void loadAssets(scene, [...CINE_ASSETS, ...CINE_SOUNDS.map(animAssetIds.sound)].filter((id) => assets.has(id))).catch(() => undefined);
}

export function cinematic(scene: Phaser.Scene, o: CineOptions): Beat {
  let swapped = false;
  const swap = () => {
    if (swapped) return;
    swapped = true;
    o.onSwap();
  };
  if (o.motion === 'off') {
    swap();
    return { done: Promise.resolve(), skip: () => undefined };
  }
  const depth = o.depth ?? 900;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];
  const reduced = o.motion === 'reduced';
  const total = (reduced ? 700 : CINE_MS[o.kind]) / o.speed;
  const at = (ms: number, fn: () => void) => timers.push(scene.time.delayedCall(ms / o.speed, fn));
  const has = (k: string) => scene.textures.exists(k);
  const add = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    obj.setName(`cine-${o.kind}`);
    objs.push(obj);
    return obj;
  };
  const tw = (config: Phaser.Types.Tweens.TweenBuilderConfig) =>
    scene.tweens.add({ ...config, duration: (config.duration as number) / o.speed, delay: ((config.delay as number) ?? 0) / o.speed, hold: ((config.hold as number) ?? 0) / o.speed });
  const sound = (slug: string, volume = 0.8) => {
    const { session } = services();
    const key = animAssetIds.sound(slug);
    if (session.settings.muted || !scene.cache.audio.exists(key)) return;
    try {
      scene.sound.play(key, { volume: session.settings.sfxVolume * volume });
    } catch {
      // Sound is never critical.
    }
  };
  /** A full-screen layer from a 512×384 picture, scaled to cover. */
  const cover = (key: string, alpha: number, d = depth) => {
    const img = add(scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setDepth(d).setAlpha(0));
    img.setScale(Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height));
    tw({ targets: img, alpha, duration: 260 });
    return img;
  };
  const whiteFlash = (alpha: number) => {
    const r = add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, alpha * o.intensity).setDepth(depth + 20));
    tw({ targets: r, alpha: 0, duration: 380 });
  };
  const bars = () => {
    if (!has('cine.raid.transitions.black_bars')) return;
    const b = cover('cine.raid.transitions.black_bars', 1, depth + 30);
    b.setScale(GAME_WIDTH / b.width, GAME_HEIGHT / b.height);
  };
  /** Fades every layer out over the last 300 ms. */
  const fadeAll = () => at(Math.max(0, total * o.speed - 300), () => tw({ targets: objs.filter((x) => (x as Phaser.GameObjects.Image).active), alpha: 0, duration: 300 }));

  if (reduced) {
    // Reduced motion: a soft glow and the symbol, no flying pieces or shaking.
    if (has('cine.dbk.mega.shine')) {
      const glow = add(scene.add.image(o.x, o.y, 'cine.dbk.mega.shine').setTint(o.tint).setBlendMode('ADD').setDepth(depth).setAlpha(0).setScale(0.6));
      tw({ targets: glow, alpha: 0.8, duration: 200, yoyo: true, hold: 200 });
    }
    at(SWAP_AT[o.kind] === CINE_MS[o.kind] ? 600 : 250, swap);
  } else if (o.kind === 'mega' || o.kind === 'primal') {
    mega();
  } else if (o.kind === 'dynamax' || o.kind === 'gigantamax' || o.kind === 'tera') {
    storm();
  } else if (o.kind === 'dynamaxEnd') {
    if (has('pack.dbk.burst')) {
      const puff = add(scene.add.image(o.x, o.y, 'pack.dbk.burst').setTint(0xff3060).setBlendMode('ADD').setDepth(depth).setScale(1.2));
      tw({ targets: puff, scale: 0.2, alpha: 0, duration: 500, ease: 'Cubic.easeIn' });
    }
    sound('ess-refresh', 0.6);
    at(SWAP_AT.dynamaxEnd, swap);
  } else {
    zPower();
  }

  function mega(): void {
    const crystal = `cine.primega.${o.crystal ?? 'mega'}`;
    bars();
    const dim = add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0618, 0).setDepth(depth));
    tw({ targets: dim, fillAlpha: 0.55, duration: 300 });
    sound('ess-harden', 1);
    // The Pokémon glows white while the crystal builds around it.
    at(250, () => o.sprite instanceof Phaser.GameObjects.Sprite && o.sprite.active && o.sprite.setTintFill(0xffffff));
    if (has('cine.dbk.mega.orb_1')) {
      const orb = add(scene.add.image(o.x, o.y, 'cine.dbk.mega.orb_1').setTint(o.tint).setBlendMode('ADD').setDepth(depth + 1).setAlpha(0.5).setScale(0));
      tw({ targets: orb, scale: 0.8, duration: 900, ease: 'Sine.easeOut' });
    }
    // Charge: motes drawn in from a fixed ring.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const mote = add(scene.add.image(o.x + Math.cos(a) * 220, o.y + Math.sin(a) * 160, has('pack.dbk.particle') ? 'pack.dbk.particle' : '__WHITE').setTint(o.tint).setBlendMode('ADD').setDepth(depth + 2).setScale(0.6));
      tw({ targets: mote, x: o.x, y: o.y, scale: 0.1, duration: 500, delay: 100 + i * 60, ease: 'Quad.easeIn' });
    }
    if (has('cine.raid.transitions.shine')) {
      const ring = add(scene.add.image(o.x, o.y, 'cine.raid.transitions.shine').setTint(o.tint).setBlendMode('ADD').setDepth(depth + 2).setScale(1.4).setAlpha(0));
      tw({ targets: ring, scale: 0.3, alpha: 0.9, duration: 800, delay: 150, ease: 'Quad.easeIn' });
    }
    if (!has(crystal)) {
      at(SWAP_AT.mega, () => {
        swap();
        whiteFlash(0.8);
      });
      return;
    }
    // The crystal builds piece by piece, then cracks.
    const S = 0.7;
    const pieces = shards.centres.map(([dx, dy], i) => {
      const n = String(i + 1).padStart(2, '0');
      const p = add(scene.add.image(o.x + dx! * S, o.y + dy! * S, crystal, `p${n}`).setScale(S * 1.3).setAlpha(0).setDepth(depth + 3));
      const c = add(scene.add.image(p.x, p.y, crystal, `c${n}`).setScale(S).setAlpha(0).setDepth(depth + 4).setBlendMode('ADD'));
      tw({ targets: p, alpha: 1, scale: S, duration: 140, delay: 300 + i * 28, ease: 'Back.easeOut' });
      return { p, c, dx: dx!, dy: dy!, i };
    });
    at(400, () => sound('ess-twine', 0.7));
    at(700, () => sound('ess-refresh', 0.8));
    for (const s of pieces) {
      tw({ targets: s.c, alpha: 1, duration: 300, delay: 950 });
      // Each shard flickers once, at its own fixed moment.
      at(980 + ((s.i * 37) % 300), () => s.p.active && s.p.setTintFill(0xffffff));
      at(1040 + ((s.i * 37) % 300), () => s.p.active && s.p.clearTint());
    }
    at(SWAP_AT.mega, () => {
      swap();
      sound('ess-shell-smash', 1);
      whiteFlash(0.85);
      if (o.intensity > 0) scene.cameras.main.shake(260 / o.speed, 0.01 * o.intensity);
      for (const s of pieces) {
        const len = Math.hypot(s.dx, s.dy) || 1;
        const v = 200 + ((s.i * 53) % 140);
        tw({ targets: [s.p, s.c], x: o.x + (s.dx / len) * v, duration: 750, ease: 'Quad.easeOut' });
        tw({ targets: [s.p, s.c], y: o.y + (s.dy / len) * v * 0.7 + 120, duration: 750, ease: 'Quad.easeIn' });
        tw({ targets: [s.p, s.c], angle: (s.i % 2 ? 1 : -1) * (120 + s.i * 9), alpha: 0, duration: 750 });
      }
      // The symbol: Mega, or Groudon's / Kyogre's Primal mark.
      const sym = o.crystal === 'omega' ? 'cine.dbk.primal.icon_groudon' : o.crystal === 'alpha' ? 'cine.dbk.primal.icon_kyogre' : 'pack.ebdx.symMega';
      if (has(sym)) {
        const mark = add(scene.add.image(o.x, o.y - 30, sym).setDepth(depth + 6).setScale(0));
        const size = sym.startsWith('cine') ? 0.6 : 3;
        tw({ targets: mark, scale: size, duration: 380, ease: 'Back.easeOut', yoyo: true, hold: 520 });
      }
    });
    fadeAll();
  }

  function storm(): void {
    const tera = o.kind === 'tera';
    const base = tera ? 'cine.raid.tera' : 'cine.raid.max';
    if (has(`${base}.bg`)) cover(`${base}.bg`, tera ? 0.7 : 0.8);
    for (const [k, dir, size] of [['spiral', 1, 1.1], ['spiral2', -1, 1.4]] as const) {
      const key = `${base}.${k}`;
      if (!has(key)) continue;
      const sp = add(scene.add.image(o.x, o.y, key).setBlendMode('ADD').setDepth(depth + 1).setScale(0.2).setAlpha(0.9));
      tw({ targets: sp, scale: size * 0.6, angle: dir * 300, duration: CINE_MS[o.kind] - 300, ease: 'Sine.easeInOut' });
    }
    if (has(`${base}.icon`)) {
      const icon = add(scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, `${base}.icon`).setDepth(depth + 5).setScale(1.6).setAlpha(0));
      tw({ targets: icon, scale: 0.7, alpha: 1, duration: 360, delay: 200, ease: 'Back.easeOut' });
      tw({ targets: icon, alpha: 0, scale: 1.1, duration: 260, delay: SWAP_AT[o.kind] });
    }
    // Energy rising around the Pokémon.
    for (let i = 0; i < 8; i++) {
      const dx = ((i % 4) - 1.5) * 50;
      const mote = add(scene.add.image(o.x + dx, o.y + 70, has('pack.dbk.particle') ? 'pack.dbk.particle' : '__WHITE').setTint(o.tint).setBlendMode('ADD').setDepth(depth + 2).setScale(0.7).setAlpha(0));
      tw({ targets: mote, y: o.y - 110, alpha: { from: 1, to: 0 }, duration: 600, delay: 150 + i * 80, ease: 'Sine.easeOut' });
    }
    sound(tera ? 'ess-refresh' : 'ess-flash2', 0.8);
    at(SWAP_AT[o.kind], () => {
      swap();
      sound(tera ? 'ess-shell-smash' : 'ess-explosion', 0.9);
      whiteFlash(0.7);
      if (o.intensity > 0) scene.cameras.main.shake(320 / o.speed, 0.012 * o.intensity);
      if (has('pack.dbk.burst')) {
        const b = add(scene.add.image(o.x, o.y, 'pack.dbk.burst').setTint(o.tint).setBlendMode('ADD').setDepth(depth + 3).setScale(0.3));
        tw({ targets: b, scale: 1.8, alpha: 0, duration: 600, ease: 'Cubic.easeOut' });
      }
    });
    fadeAll();
  }

  function zPower(): void {
    bars();
    if (has('cine.raid.ultra.bg')) cover('cine.raid.ultra.bg', 0.85);
    if (has('cine.raid.transitions.impact')) {
      const lines = cover('cine.raid.transitions.impact', 0.8, depth + 1);
      tw({ targets: lines, angle: 8, duration: 1800 });
    }
    // Z-Power rings in the move's type colour.
    for (let i = 0; i < 3; i++) {
      if (!has('cine.raid.transitions.shine')) break;
      const ring = add(scene.add.image(o.x, o.y, 'cine.raid.transitions.shine').setTint(o.tint).setBlendMode('ADD').setDepth(depth + 2).setScale(0.2).setAlpha(0));
      tw({ targets: ring, scale: 0.9, alpha: { from: 1, to: 0 }, duration: 600, delay: 200 + i * 300, ease: 'Quad.easeOut' });
    }
    if (has('cine.raid.ultra.icon')) {
      const z = add(scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'cine.raid.ultra.icon').setDepth(depth + 5).setScale(2).setAlpha(0));
      tw({ targets: z, scale: 0.6, alpha: 1, duration: 420, delay: 250, ease: 'Back.easeOut' });
      tw({ targets: z, y: z.y - 8, duration: 500, delay: 700, yoyo: true, ease: 'Sine.easeInOut' });
    }
    if (o.title) {
      const color = `#${o.tint.toString(16).padStart(6, '0')}`;
      const t = add(scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, o.title.toUpperCase(), textStyle(40, '#ffffff', { stroke: color, strokeThickness: 8 })).setOrigin(0.5).setDepth(depth + 6).setScale(0.4).setAlpha(0));
      tw({ targets: t, scale: 1, alpha: 1, duration: 360, delay: 550, ease: 'Back.easeOut' });
    }
    sound('ess-refresh', 0.9);
    at(600, () => sound('ess-flash2', 0.8));
    at(SWAP_AT.zmove - 1, swap);
    fadeAll();
  }

  let finish: () => void = () => undefined;
  let over = false;
  const done = new Promise<void>((resolve) => {
    finish = () => {
      if (over) return;
      over = true;
      timers.forEach((t) => t.remove(false));
      swap();
      for (const x of objs) {
        scene.tweens.killTweensOf(x);
        x.destroy();
      }
      resolve();
    };
  });
  timers.push(scene.time.delayedCall(total, () => finish()));
  return { done, skip: () => finish() };
}
