// Battle skill moments (ideas W1): the foe scan mini-game, the crit freeze-frame camera pick, the item-toss arc and the
// hazard floor layer. Presentation only: nothing here reads or draws a gameplay random number; the result of a prompt
// goes to the engine as an input (battle/w1Play.ts), everything else only changes what is drawn.

import Phaser from 'phaser';
import { TYPE_NAMES, type Content } from '../../core/contentSchema';
import { typeEffectiveness } from '../../core/battle/damage';
import type { SideEffects } from '../../core/state';
import type { MotionLevel } from '../aero';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';

const TYPES = TYPE_NAMES;
const roll = (key: string, n: number): number => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
};

/** The types that hit these defending types super effectively. */
export function weaknessesOf(content: Content, defending: readonly string[]): string[] {
  return TYPES.filter((t) => typeEffectiveness(content.typeChart, t, defending as never) > 1);
}

/** Four answer choices for the scan: one real weakness and three that are not (stable for the same foe and turn). */
export function scanChoices(content: Content, defending: readonly string[], seedKey: string): { options: string[]; correct: string } {
  const weak = weaknessesOf(content, defending);
  const notWeak = TYPES.filter((t) => !weak.includes(t));
  const pick = <T,>(list: readonly T[], salt: string, skip: T[] = []): T => {
    const pool = list.filter((x) => !skip.includes(x));
    return pool[roll(`${seedKey}:${salt}`, pool.length)]!;
  };
  const correct = weak.length > 0 ? pick(weak, 'right') : pick(TYPES, 'right');
  const wrong: string[] = [];
  for (let i = 0; i < 3; i++) wrong.push(pick(notWeak.length > 3 ? notWeak : TYPES.filter((t) => t !== correct), `w${i}`, [correct, ...wrong]));
  const options = [...wrong];
  options.splice(roll(`${seedKey}:slot`, 4), 0, correct);
  return { options, correct };
}

/** The Pokédex scan: pick which type the foe is weak to. Resolves true on a correct guess. */
export function runScan(scene: Phaser.Scene, content: Content, foeName: string, defending: readonly string[], seedKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    const { options, correct } = scanChoices(content, defending, seedKey);
    const root = scene.add.container(0, 0).setDepth(1000);
    const panel = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 520, 250, 0x0b1a2e, 0.94).setStrokeStyle(2, 0x9fe8ff);
    const title = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, `Pokédex scan: ${foeName}`, textStyle(24, '#9fe8ff')).setOrigin(0.5);
    const hint = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 104, `Which type is ${foeName} weak to?`, textStyle(18, COLORS.textLight)).setOrigin(0.5);
    root.add([panel, title, hint]);
    const done = (ok: boolean) => {
      root.destroy();
      resolve(ok);
    };
    options.forEach((t, i) => {
      const b = scene.add.text(GAME_WIDTH / 2 - 190 + (i % 2) * 220, GAME_HEIGHT / 2 - 60 + Math.floor(i / 2) * 56, t.toUpperCase(), textStyle(22, COLORS.textLight, { backgroundColor: '#14304f', padding: { x: 16, y: 8 } })).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => done(t === correct));
      root.add(b);
      scene.input.keyboard?.once(`keydown-${i + 1}`, () => root.active && done(t === correct));
    });
    const skip = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 66, 'Esc: skip the scan', textStyle(16, COLORS.textMuted)).setOrigin(0.5);
    root.add(skip);
    scene.input.keyboard?.once('keydown-ESC', () => root.active && done(false));
  });
}

/** Crit freeze-frame: the action holds for a moment and the player picks the camera angle (auto-picks Wide). */
export function critFreeze(scene: Phaser.Scene, at: { x: number; y: number }, motion: MotionLevel): Promise<void> {
  if (motion === 'off') return Promise.resolve();
  return new Promise((resolve) => {
    const cam = scene.cameras.main;
    const root = scene.add.container(0, 0).setDepth(1500);
    const label = scene.add.text(GAME_WIDTH / 2, 40, 'CRITICAL! Pick the camera angle', textStyle(22, '#ffe060', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5);
    root.add(label);
    let chosen = false;
    const finish = (angle: 'close' | 'wide' | 'low') => {
      if (chosen) return;
      chosen = true;
      root.destroy();
      const zoom = angle === 'close' ? 1.25 : angle === 'low' ? 1.1 : 0.96;
      cam.pan(at.x, angle === 'low' ? at.y + 40 : at.y, 260, 'Sine.easeOut');
      cam.zoomTo(zoom, 260);
      scene.time.delayedCall(560, () => {
        cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 260, 'Sine.easeInOut');
        cam.zoomTo(1, 260);
        scene.time.delayedCall(280, resolve);
      });
    };
    (['close', 'wide', 'low'] as const).forEach((a, i) => {
      const b = scene.add.text(GAME_WIDTH / 2 - 160 + i * 160, 84, `${i + 1} ${a[0]!.toUpperCase()}${a.slice(1)}`, textStyle(20, COLORS.textLight, { backgroundColor: '#14304f', padding: { x: 12, y: 6 } })).setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => finish(a));
      root.add(b);
      scene.input.keyboard?.once(`keydown-${i + 1}`, () => finish(a));
    });
    scene.time.delayedCall(1500, () => finish('wide'));
  });
}

/** An animated arc for a tossed item (a berry thrown to an ally). */
export function tossArc(scene: Phaser.Scene, from: { x: number; y: number }, to: { x: number; y: number }, motion: MotionLevel): Promise<void> {
  if (motion === 'off') return Promise.resolve();
  return new Promise((resolve) => {
    const ball = scene.add.circle(from.x, from.y, 9, 0xff7aa8).setStrokeStyle(2, 0xffffff).setDepth(1200);
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 };
    const t = { v: 0 };
    scene.tweens.add({
      targets: t,
      v: 1,
      duration: motion === 'reduced' ? 200 : 520,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const k = t.v;
        ball.setPosition((1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * mid.x + k * k * to.x, (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * mid.y + k * k * to.y);
      },
      onComplete: () => {
        scene.tweens.add({ targets: ball, scale: 2.2, alpha: 0, duration: 220, onComplete: () => ball.destroy() });
        resolve();
      },
    });
  });
}

/** Rocks, spikes and webs drawn on the arena floor from the side effects (F11). Call `draw` after any turn. */
export class HazardFloor {
  private readonly gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, depth = 5) {
    this.gfx = scene.add.graphics().setDepth(depth);
  }

  draw(effects: { player: SideEffects; enemy: SideEffects }, spots: { player: { x: number; y: number }; enemy: { x: number; y: number } }): void {
    this.gfx.clear();
    for (const side of ['player', 'enemy'] as const) {
      const fx = effects[side];
      const { x, y } = spots[side];
      if (fx.stealthRock) for (let i = 0; i < 4; i++) this.gfx.fillStyle(0x8a7a5a, 1).fillTriangle(x - 70 + i * 40, y + 62, x - 52 + i * 40, y + 62, x - 61 + i * 40, y + 44);
      for (let i = 0; i < fx.spikes; i++) this.gfx.fillStyle(0xc8ccd8, 1).fillTriangle(x - 40 + i * 40, y + 78, x - 24 + i * 40, y + 78, x - 32 + i * 40, y + 58);
      for (let i = 0; i < fx.toxicSpikes; i++) this.gfx.fillStyle(0xa04ad8, 1).fillTriangle(x - 20 + i * 40, y + 92, x - 4 + i * 40, y + 92, x - 12 + i * 40, y + 72);
      if (fx.stickyWeb) {
        this.gfx.lineStyle(2, 0xffffff, 0.8);
        for (let k = 0; k < 4; k++) this.gfx.lineBetween(x - 70 + k * 12, y + 100, x + 70 - k * 12, y + 56);
        this.gfx.strokeEllipse(x, y + 78, 110, 34);
      }
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

export interface BossCinematic {
  name: string;
  subtitle: string;
  /** The ace (last Pokémon) of the boss, named on the card. */
  ace: string;
  /** The boss sprite to push the camera in on. */
  at: { x: number; y: number };
  motion: MotionLevel;
}

/**
 * A genuine boss entrance (ideas W1 F22): letterbox bars close in, the camera pushes toward the boss, the name slams in and
 * the ace is teased. Any key or tap skips it, and `onSkip` lets the caller remember that for this boss.
 */
export function bossCinematic(scene: Phaser.Scene, c: BossCinematic, onSkip: () => void): Promise<void> {
  if (c.motion === 'off') return Promise.resolve();
  return new Promise((resolve) => {
    const fast = c.motion === 'reduced';
    const bars = [scene.add.rectangle(GAME_WIDTH / 2, -40, GAME_WIDTH, 80, 0x000000).setDepth(1800), scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + 40, GAME_WIDTH, 80, 0x000000).setDepth(1800)];
    const name = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, c.name.toUpperCase(), textStyle(54, '#ffe060', { stroke: '#181818', strokeThickness: 8 })).setOrigin(0.5).setDepth(1810).setAlpha(0).setScale(2.4);
    const sub = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, c.subtitle, textStyle(22, '#bfe9ff', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5).setDepth(1810).setAlpha(0);
    const ace = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 70, c.ace ? `Their ace: ${c.ace}` : '', textStyle(20, '#ff9ac8', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5).setDepth(1810).setAlpha(0);
    const hint = scene.add.text(GAME_WIDTH - 14, 14, 'any key: skip (remembered)', textStyle(14, COLORS.textMuted)).setOrigin(1, 0).setDepth(1810);
    const all = [...bars, name, sub, ace, hint];
    let over = false;
    const cam = scene.cameras.main;
    const finish = () => {
      if (over) return;
      over = true;
      scene.input.keyboard?.off('keydown', skip);
      scene.input.off('pointerdown', skip);
      cam.zoomTo(1, 200);
      cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 200);
      scene.tweens.add({ targets: all, alpha: 0, duration: 220, onComplete: () => { all.forEach((o) => o.destroy()); resolve(); } });
    };
    const skip = () => {
      onSkip();
      finish();
    };
    scene.input.keyboard?.on('keydown', skip);
    scene.input.once('pointerdown', skip);
    const d = fast ? 0.5 : 1;
    scene.tweens.add({ targets: bars[0], y: 40, duration: 380 * d });
    scene.tweens.add({ targets: bars[1], y: GAME_HEIGHT - 40, duration: 380 * d });
    cam.pan(c.at.x, c.at.y, 900 * d, 'Sine.easeInOut');
    cam.zoomTo(fast ? 1 : 1.18, 900 * d);
    scene.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 320 * d, delay: 500 * d, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: sub, alpha: 1, duration: 300 * d, delay: 900 * d });
    scene.tweens.add({ targets: ace, alpha: 1, duration: 300 * d, delay: 1250 * d });
    scene.time.delayedCall(2300 * d, finish);
  });
}
