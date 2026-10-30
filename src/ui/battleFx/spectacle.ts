// Big presentation beats for the battle screen, built from the EBDX
// transition art and the Deluxe Battle Kit effect art:
// - the battle intro (a streak-and-Poké-Ball wipe for wild Pokémon, a VS
//   screen for trainers, a darker one for rivals and bosses);
// - a radiant burst reveal (transformations, evolution, a successful catch);
// - a victory hop.
//
// Presentation only. Every beat has a fixed length, ends early on any input
// (skip), shortens to a quick fade with reduced motion and is skipped
// entirely when battle animations are off. It never touches battle state.

import type Phaser from 'phaser';
import { paintGlass, type MotionLevel } from '../aero';
import { textStyle } from '../theme';

export type IntroKind = 'wild' | 'wild-dark' | 'trainer' | 'rival' | 'boss';

/** A running beat: resolves when it ends; `skip()` ends it now. */
export interface Beat {
  done: Promise<void>;
  skip: () => void;
}

const noBeat = (): Beat => ({ done: Promise.resolve(), skip: () => undefined });

/** Runs a timed beat over the given objects and cleans them up at the end or on skip. */
function beat(scene: Phaser.Scene, objects: Phaser.GameObjects.GameObject[], lengthMs: number): Beat {
  let finish: () => void = () => undefined;
  let over = false;
  const done = new Promise<void>((resolve) => {
    finish = () => {
      if (over) return;
      over = true;
      for (const o of objects) {
        scene.tweens.killTweensOf(o);
        o.destroy();
      }
      resolve();
    };
  });
  scene.time.delayedCall(lengthMs, finish);
  return { done, skip: finish };
}

/**
 * The battle intro. `makeTrainer` draws the trainer's picture (shown on the
 * VS bar) when there is one.
 */
export function introTransition(
  scene: Phaser.Scene,
  kind: IntroKind,
  motion: MotionLevel,
  makeTrainer?: (x: number, y: number) => Phaser.GameObjects.GameObject,
): Beat {
  if (motion === 'off') return noBeat();
  const W = scene.scale.width;
  const H = scene.scale.height;
  const has = (k: string) => scene.textures.exists(k);
  const depth = 1000;
  if (motion === 'reduced') {
    const veil = scene.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setDepth(depth);
    scene.tweens.add({ targets: veil, alpha: 0, duration: 250 });
    return beat(scene, [veil], 260);
  }
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth + objs.length);
    objs.push(o);
    return o;
  };

  if (kind === 'wild' || kind === 'wild-dark') {
    // Two light streaks sweep in from both sides, a Poké Ball spins up in the
    // middle, then everything blooms white and fades into the arena.
    const veil = add(scene.add.rectangle(0, 0, W, H, 0x02060f, 1).setOrigin(0));
    const streak = kind === 'wild-dark' ? 'pack.ebdx.tr.indoor' : 'pack.ebdx.tr.outdoor';
    if (has(streak)) {
      const top = add(scene.add.image(-W, H * 0.28, streak).setOrigin(0, 0.5).setDisplaySize(W * 1.2, H * 0.5));
      const bottom = add(scene.add.image(W * 2, H * 0.72, streak).setOrigin(1, 0.5).setDisplaySize(W * 1.2, H * 0.5).setFlipX(true));
      scene.tweens.add({ targets: top, x: -W * 0.1, duration: 360, ease: 'Cubic.easeOut' });
      scene.tweens.add({ targets: bottom, x: W * 1.1, duration: 360, ease: 'Cubic.easeOut' });
    }
    if (has('pack.ebdx.tr.ball')) {
      const ball = add(scene.add.image(W / 2, H / 2, 'pack.ebdx.tr.ball').setScale(0).setAngle(-180));
      scene.tweens.add({ targets: ball, scale: 0.9, angle: 0, duration: 420, delay: 200, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: ball, scale: 3, alpha: 0, duration: 260, delay: 720, ease: 'Quad.easeIn' });
    }
    const bloom = add(scene.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0));
    scene.tweens.add({ targets: bloom, alpha: 0.85, duration: 140, delay: 700, yoyo: true });
    scene.tweens.add({ targets: objs.filter((o) => o !== bloom), alpha: 0, duration: 220, delay: 820 });
    return beat(scene, objs, 1050);
  }

  // VS screen: a moving background with streaks, a bar across the middle,
  // the trainer sliding in and a bouncing "VS"; then it collapses away.
  const variant = kind === 'boss' ? 'Skull' : kind === 'rival' ? 'Evil' : '';
  const bgKey = `pack.ebdx.tr.vs_background${variant}`;
  const layerKey = `pack.ebdx.tr.vs_layer${variant}`;
  const root = scene.add.container(0, 0);
  add(root);
  if (has(bgKey)) root.add(scene.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H));
  else root.add(scene.add.rectangle(0, 0, W, H, 0x1a0830, 1).setOrigin(0));
  if (has(layerKey)) {
    const streaks = scene.add.tileSprite(0, 0, 640, 480, layerKey).setOrigin(0).setScale(W / 640, H / 480);
    root.add(streaks);
    scene.tweens.add({ targets: streaks, tilePositionX: -1280, duration: 1600, ease: 'Linear' });
  }
  if (has('pack.ebdx.tr.vsBar')) {
    const bar = scene.add.image(W / 2, H / 2, 'pack.ebdx.tr.vsBar').setScale(W / 768, 0);
    root.add(bar);
    scene.tweens.add({ targets: bar, scaleY: 220 / 384, duration: 260, ease: 'Back.easeOut' });
  }
  if (has('pack.ebdx.tr.glow')) {
    const ring = scene.add.image(W * 0.27, H / 2, 'pack.ebdx.tr.glow').setScale(0.7).setAlpha(0.8).setBlendMode('ADD');
    root.add(ring);
    scene.tweens.add({ targets: ring, angle: 360, duration: 2400 });
  }
  if (makeTrainer) {
    const trainer = makeTrainer(W + 200, H / 2 + 110);
    root.add(trainer);
    scene.tweens.add({ targets: trainer, x: W * 0.68, duration: 480, delay: 180, ease: 'Back.easeOut' });
  }
  if (has('pack.ebdx.tr.vs')) {
    const vs = scene.add.image(W * 0.27, H / 2, 'pack.ebdx.tr.vs').setScale(0);
    root.add(vs);
    scene.tweens.add({ targets: vs, scale: 1.6, duration: 420, delay: 360, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: vs, scale: 1.75, duration: 220, delay: 800, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  }
  scene.tweens.add({ targets: root, scaleY: 0, y: H / 2, alpha: 0.6, duration: 240, delay: 1350, ease: 'Cubic.easeIn' });
  return beat(scene, objs, 1600);
}

/**
 * A radiant reveal at (x, y): a blue light burst, a white shine and an
 * expanding ring, tinted by `tint`. Used for transformations, evolution and
 * a successful catch. Reduced motion gives a small soft glow.
 */
export function burstReveal(scene: Phaser.Scene, x: number, y: number, tint: number, motion: MotionLevel, depth = 900): Beat {
  if (motion === 'off') return noBeat();
  const has = (k: string) => scene.textures.exists(k);
  const objs: Phaser.GameObjects.GameObject[] = [];
  if (motion === 'reduced') {
    if (has('pack.dbk.shine')) {
      const glow = scene.add.image(x, y, 'pack.dbk.shine').setScale(0.5).setAlpha(0).setTint(tint).setBlendMode('ADD').setDepth(depth);
      objs.push(glow);
      scene.tweens.add({ targets: glow, alpha: 0.6, duration: 200, yoyo: true });
    }
    return beat(scene, objs, 420);
  }
  if (has('pack.dbk.burst')) {
    const burst = scene.add.image(x, y, 'pack.dbk.burst').setScale(0.2).setAlpha(0.9).setTint(tint).setBlendMode('ADD').setDepth(depth);
    objs.push(burst);
    scene.tweens.add({ targets: burst, scale: 1.4, alpha: 0, angle: 25, duration: 700, ease: 'Cubic.easeOut' });
  }
  if (has('pack.dbk.shine')) {
    const shine = scene.add.image(x, y, 'pack.dbk.shine').setScale(0.1).setBlendMode('ADD').setDepth(depth + 1);
    objs.push(shine);
    scene.tweens.add({ targets: shine, scale: 0.8, duration: 260, ease: 'Back.easeOut', yoyo: true, hold: 120 });
  }
  if (has('pack.dbk.pulse')) {
    const ring = scene.add.image(x, y, 'pack.dbk.pulse').setScale(0.3).setTint(tint).setBlendMode('ADD').setDepth(depth + 2);
    objs.push(ring);
    scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 650, ease: 'Quad.easeOut' });
  }
  if (has('pack.ebdx.tr.shine2')) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const star = scene.add.image(x, y, 'pack.ebdx.tr.shine2').setScale(0.3).setDepth(depth + 3).setBlendMode('ADD');
      objs.push(star);
      scene.tweens.add({ targets: star, x: x + Math.cos(a) * 120, y: y + Math.sin(a) * 90, scale: 0, duration: 600, delay: 80, ease: 'Cubic.easeOut' });
    }
  }
  return beat(scene, objs, 760);
}

/** A happy double hop (victory, a level up). */
export function hop(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, motion: MotionLevel): Promise<void> {
  if (motion !== 'full' || !target.active) return Promise.resolve();
  const t = target as unknown as { y: number };
  const y = t.y;
  return new Promise((resolve) =>
    scene.tweens.add({
      targets: target,
      y: y - 18,
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeOut',
      onComplete: () => {
        t.y = y;
        resolve();
      },
    }),
  );
}

/** A glass plate with a title and a line under it, shared by the title card and the stamps. */
function plate(scene: Phaser.Scene, x: number, y: number, w: number, h: number, title: string, sub: string, rim: number, titleSize: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(paintGlass(scene.add.graphics(), -w / 2, -h / 2, w, h, { rim, tint: 0x0b1f3a, radius: 24 }));
  c.add(scene.add.text(0, sub ? -14 : 0, title, textStyle(titleSize, '#ffffff', { stroke: '#10203a', strokeThickness: 6 })).setOrigin(0.5));
  if (sub) c.add(scene.add.text(0, 26, sub, textStyle(20, '#cfefff')).setOrigin(0.5));
  return c;
}

/**
 * A boss or rival title card: a glass banner that swoops in from the left,
 * bounces, holds, then leaves to the right (any key skips).
 */
export function titleCard(scene: Phaser.Scene, title: string, sub: string, rim: number, motion: MotionLevel): Beat {
  if (motion === 'off') return noBeat();
  const W = scene.scale.width;
  const card = plate(scene, W / 2, 150, 600, 96, title, sub, rim, 40).setDepth(950);
  if (motion === 'reduced') {
    card.setAlpha(0);
    scene.tweens.add({ targets: card, alpha: 1, duration: 150, yoyo: true, hold: 900 });
    return beat(scene, [card], 1250);
  }
  card.x = -W / 2;
  scene.tweens.add({ targets: card, x: W / 2, duration: 420, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: card, x: W * 1.6, duration: 260, delay: 1500, ease: 'Cubic.easeIn' });
  return beat(scene, [card], 1800);
}

/**
 * A celebratory stamp ("VICTORY!", "BADGE GET!"): it slams down from large
 * with a bounce, sparkles burst out, it holds and fades (any key skips).
 */
export function stamp(scene: Phaser.Scene, title: string, sub: string, rim: number, motion: MotionLevel): Beat {
  if (motion === 'off') return noBeat();
  const W = scene.scale.width;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const card = plate(scene, W / 2, 190, 460, 110, title, sub, rim, 48).setDepth(960);
  objs.push(card);
  if (motion === 'reduced') {
    card.setAlpha(0);
    scene.tweens.add({ targets: card, alpha: 1, duration: 150, yoyo: true, hold: 900 });
    return beat(scene, objs, 1250);
  }
  card.setScale(2.2).setAlpha(0);
  scene.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 380, ease: 'Bounce.easeOut' });
  if (scene.textures.exists('pack.ebdx.tr.shine2')) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const star = scene.add.image(W / 2, 190, 'pack.ebdx.tr.shine2').setScale(0.35).setDepth(961).setBlendMode('ADD').setTint(rim);
      objs.push(star);
      scene.tweens.add({ targets: star, x: W / 2 + Math.cos(a) * 300, y: 190 + Math.sin(a) * 130, scale: 0, duration: 700, delay: 260, ease: 'Cubic.easeOut' });
    }
  }
  scene.tweens.add({ targets: card, alpha: 0, y: 160, duration: 220, delay: 1350 });
  return beat(scene, objs, 1600);
}

/**
 * A boss victory card (catalog 91): the boss slides back in a defeated pose,
 * a glass card in the boss's accent colour names the win and its Chronicle
 * stamp, and the team lineup hops in along the bottom (fainted members dimmed).
 * `portrait` and `icon` draw the art, so this file needs no sprite code.
 */
export function bossVictoryCard(
  scene: Phaser.Scene,
  v: { title: string; stamp: string; lineup: { fainted: boolean }[] },
  accent: number,
  motion: MotionLevel,
  portrait: ((x: number, y: number) => Phaser.GameObjects.GameObject) | null,
  icon: (i: number, x: number, y: number) => Phaser.GameObjects.GameObject,
): Beat {
  if (motion === 'off') return noBeat();
  const W = scene.scale.width;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const root = scene.add.container(0, 0).setDepth(965).setName('boss-victory');
  objs.push(root);
  const veil = scene.add.rectangle(0, 0, W, scene.scale.height, 0x061428, 0.55).setOrigin(0);
  root.add(veil);
  const rays = scene.add.star(250, 220, 14, 30, 260, accent, 0.18).setBlendMode('ADD');
  root.add(rays);
  if (portrait) {
    const p = portrait(250, 300) as Phaser.GameObjects.Image;
    root.add(p);
    // The defeated pose: it leans back and steps away a little.
    if (motion === 'full') scene.tweens.add({ targets: p, angle: -8, x: 220, alpha: 0.85, duration: 600, ease: 'Back.easeOut' });
    else p.setAngle(-8).setAlpha(0.85);
  }
  const card = scene.add.container(W - 300, 190);
  card.add(paintGlass(scene.add.graphics(), -260, -105, 520, 210, { rim: accent, tint: 0x0b1f3a, radius: 24 }));
  card.add(scene.add.text(0, -66, v.title, textStyle(30, '#ffffff', { stroke: '#10203a', strokeThickness: 6, align: 'center', wordWrap: { width: 490 } })).setOrigin(0.5));
  card.add(scene.add.text(0, -10, v.stamp, textStyle(16, '#ffe8a0', { backgroundColor: '#0c2a44', padding: { x: 10, y: 4 }, align: 'center', wordWrap: { width: 480 } })).setOrigin(0.5).setAngle(-2).setName('boss-victory-stamp'));
  root.add(card);
  const n = v.lineup.length;
  v.lineup.forEach((m, i) => {
    const x = W - 300 + (i - (n - 1) / 2) * 76;
    const o = icon(i, x, 245) as Phaser.GameObjects.Image;
    if (m.fainted) o.setAlpha(0.45);
    root.add(o);
    if (motion === 'full' && !m.fainted) scene.tweens.add({ targets: o, y: 233, duration: 260, yoyo: true, repeat: 2, delay: 500 + i * 120, ease: 'Quad.easeOut' });
  });
  if (motion === 'reduced') {
    root.setAlpha(0);
    scene.tweens.add({ targets: root, alpha: 1, duration: 160, yoyo: true, hold: 1700 });
    return beat(scene, objs, 2100);
  }
  card.setScale(0.4).setAlpha(0);
  scene.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: rays, angle: 90, duration: 2800 });
  scene.tweens.add({ targets: root, alpha: 0, duration: 300, delay: 2500 });
  return beat(scene, objs, 2800);
}

/** Two glass shutters close over the screen when the battle ends. */
export function exitWipe(scene: Phaser.Scene, motion: MotionLevel): Promise<void> {
  if (motion === 'off') return Promise.resolve();
  const W = scene.scale.width;
  const H = scene.scale.height;
  if (motion === 'reduced') {
    const veil = scene.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setDepth(2000);
    return new Promise((resolve) => scene.tweens.add({ targets: veil, alpha: 1, duration: 200, onComplete: () => resolve() }));
  }
  const top = paintGlass(scene.add.graphics(), 0, 0, W, H / 2 + 4, { radius: 0, glow: false, alpha: 1 }).setDepth(2000).setY(-H / 2);
  const bottom = paintGlass(scene.add.graphics(), 0, H / 2 - 4, W, H / 2 + 4, { radius: 0, glow: false, alpha: 1 }).setDepth(2000).setY(H / 2);
  return new Promise((resolve) => {
    scene.tweens.add({ targets: top, y: 0, duration: 260, ease: 'Bounce.easeOut' });
    scene.tweens.add({ targets: bottom, y: 0, duration: 260, ease: 'Bounce.easeOut', onComplete: () => scene.time.delayedCall(120, () => resolve()) });
  });
}

/**
 * A trainer's speech bubble: glass, with a tail pointing at the speaker, that
 * pops in with a bounce. The line is also in the message box, so this is extra;
 * the caller removes it when the line is done.
 */
export function speechBubble(scene: Phaser.Scene, toX: number, toY: number, speaker: string, text: string, rim: number, motion: MotionLevel): Phaser.GameObjects.Container {
  const W = scene.scale.width;
  const w = 360;
  const body = scene.add.text(0, 0, `“${text}”`, textStyle(17, '#ffffff', { wordWrap: { width: w - 32 }, lineSpacing: 2 }));
  const h = Math.max(64, body.height + 44);
  // Right of the foe's databox (which ends near x 490), above the foe.
  const x = Math.min(W - w / 2 - 8, Math.max(toX + 30, 500 + w / 2));
  const y = Math.max(h / 2 + 60, toY - 120 - h / 2);
  const c = scene.add.container(x, y).setDepth(940).setName('speech-bubble');
  const g = scene.add.graphics();
  // The tail: a little glass triangle toward the speaker.
  const tx = Math.max(-w / 2 + 30, Math.min(w / 2 - 30, toX - x));
  g.fillStyle(0x0b1f3a, 0.92).fillTriangle(tx - 14, h / 2 - 2, tx + 14, h / 2 - 2, tx + 24, h / 2 + 22);
  g.lineStyle(2, rim, 0.9).lineBetween(tx - 14, h / 2, tx + 24, h / 2 + 22).lineBetween(tx + 24, h / 2 + 22, tx + 14, h / 2);
  paintGlass(g, -w / 2, -h / 2, w, h, { rim, tint: 0x0b1f3a, radius: 20 });
  body.setPosition(-w / 2 + 16, -h / 2 + 30);
  c.add([g, scene.add.text(-w / 2 + 16, -h / 2 + 8, speaker, textStyle(15, '#7ff3ff')), body]);
  if (motion === 'full') {
    c.setScale(0.2).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: c, y: y - 4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 320 });
  } else if (motion === 'reduced') {
    c.setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
  }
  return c;
}

/**
 * A boss phase change: a glass ribbon sweeps across with "NEW PHASE" and the
 * phase's written rule, holds, then sweeps out (any key skips).
 */
export function phaseBanner(scene: Phaser.Scene, rule: string, rim: number, motion: MotionLevel): Beat {
  if (motion === 'off') return noBeat();
  const W = scene.scale.width;
  const c = scene.add.container(W / 2, 150).setDepth(955).setName('phase-banner');
  const sub = scene.add.text(0, 18, rule, textStyle(18, '#ffe9f0', { wordWrap: { width: W - 140 }, align: 'center' })).setOrigin(0.5, 0);
  const h = 70 + sub.height;
  c.add(paintGlass(scene.add.graphics(), -W / 2 + 30, -h / 2 + 10, W - 60, h, { rim, tint: 0x2a0b2a, radius: 22, glow: true }));
  c.add(scene.add.text(0, -h / 2 + 34, 'NEW PHASE', textStyle(34, '#ffffff', { stroke: '#3a0b2a', strokeThickness: 6 })).setOrigin(0.5));
  sub.setY(-h / 2 + 58);
  c.add(sub);
  if (motion === 'reduced') {
    c.setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, duration: 150, yoyo: true, hold: 1300 });
    return beat(scene, [c], 1650);
  }
  c.x = W * 1.6;
  scene.tweens.add({ targets: c, x: W / 2, duration: 380, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, scaleY: 1.06, duration: 160, yoyo: true, delay: 380 });
  scene.tweens.add({ targets: c, x: -W * 0.6, duration: 260, delay: 1900, ease: 'Cubic.easeIn' });
  return beat(scene, [c], 2200);
}
