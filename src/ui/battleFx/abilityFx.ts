// Ability banners and animated battle text. Both are decoration only: they read
// a resolved AnimPlan (core/presentation/animRegistry.ts), which already folds in
// the player's motion, intensity, shake and Reduced Particles settings, and
// they never touch battle state. Flowy and bouncy: everything eases in with a
// little overshoot and drifts out.

import Phaser from 'phaser';
import type { Side } from '../../core/battle/engine';
import type { AnimPlan } from '../../core/presentation/animRegistry';
import { textStyle } from '../theme';

export interface FxTools {
  scene: Phaser.Scene;
  field: Phaser.GameObjects.Container;
  side: Side;
  /** Centre of the Pokémon for banners; top of it for text. */
  at: { x: number; y: number };
  label: string;
  plan: AnimPlan;
  /** Stacking position for text so two words don't overlap. */
  slot: number;
  shake: (px: number) => void;
}

const col = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** A ring that grows (or shrinks inward) and fades. */
export function ring(t: FxTools, x: number, y: number, from: number, to: number, ms: number, delay = 0): void {
  const g = t.scene.add.circle(x, y, from).setStrokeStyle(5, col(t.plan.color), 0.95).setFillStyle(col(t.plan.color), 0.22).setAlpha(0);
  t.field.add(g);
  t.scene.tweens.add({ targets: g, alpha: { from: 0.9, to: 0 }, radius: to, delay, duration: ms, ease: 'Sine.easeOut', onStart: () => g.setAlpha(0.9), onComplete: () => g.destroy() });
}

/** Little glyph sparks. `mode` sets where they travel: out from the middle, up, or in from the edge. */
export function sparks(t: FxTools, mode: 'out' | 'up' | 'in', count = 8): void {
  if (!t.plan.particles) return;
  const { x, y } = t.at;
  for (let i = 0; i < count; i++) {
    // Fixed angles, not random: the same cue always looks the same.
    const a = (i / count) * Math.PI * 2;
    const r = 70;
    const s = t.scene.add.star(mode === 'in' ? x + Math.cos(a) * r : x, mode === 'in' ? y + Math.sin(a) * r : y, 5, 8, 18, col(t.plan.color), 1).setStrokeStyle(2, 0xffffff, 0.9).setAlpha(0);
    t.field.add(s);
    const to = mode === 'out' ? { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r } : mode === 'up' ? { x: x + (i - count / 2) * 12, y: y - 70 - (i % 3) * 14 } : { x, y };
    t.scene.tweens.add({ targets: s, x: to.x, y: to.y, alpha: { from: 1, to: 0, ease: 'Quad.easeIn' }, scale: { from: 0.6, to: 1.3 }, delay: i * 40, duration: 700, ease: 'Sine.easeOut', onStart: () => s.setAlpha(1), onComplete: () => s.destroy() });
  }
}

export function flash(t: FxTools, alpha: number): void {
  if (t.plan.flash <= 0) return;
  const w = t.scene.scale.width;
  const h = t.scene.scale.height;
  const r = t.scene.add.rectangle(w / 2, h / 2, w, h, col(t.plan.color), alpha * t.plan.flash).setDepth(900);
  t.scene.tweens.add({ targets: r, alpha: 0, duration: 260, onComplete: () => r.destroy() });
}

/** The name pill: slides in with a bounce from the Pokémon's own side, then drifts up and fades. */
function banner(t: FxTools): void {
  const dir = t.side === 'enemy' ? 1 : -1;
  const { x, y } = t.at;
  const bx = x + dir * 10;
  const by = y - 78;
  const box = t.scene.add.container(bx + dir * 60, by).setAlpha(0);
  const text = t.scene.add.text(0, 0, `${t.plan.glyph} ${t.label}`.trim(), textStyle(22, '#ffffff', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5);
  const bg = t.scene.add.rectangle(0, 0, text.width + 28, 34, col(t.plan.color), 0.92).setStrokeStyle(3, 0xffffff, 0.85);
  box.add([bg, text]);
  t.field.add(box);
  const hold = Math.max(200, t.plan.ms - 450);
  if (t.plan.reduced) {
    t.scene.tweens.add({ targets: box, x: bx, alpha: 1, duration: 150 });
  } else {
    box.setScale(0.6);
    t.scene.tweens.add({ targets: box, x: bx, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    t.scene.tweens.add({ targets: box, y: by - 14, delay: 300 + hold, duration: 300, ease: 'Sine.easeIn' });
  }
  t.scene.tweens.add({ targets: box, alpha: 0, delay: (t.plan.reduced ? 150 : 300) + hold, duration: 250, onComplete: () => box.destroy() });
}

/** Plays one ability banner with its category flourish. Resolves when it has mostly played. */
export function playAbilityAnim(t: FxTools): Promise<void> {
  banner(t);
  const { x, y } = t.at;
  if (!t.plan.reduced) {
    switch (t.plan.id) {
      case 'ability.weather':
        sparks(t, 'up', 10);
        ring(t, x, y + 40, 20, 150, 900);
        break;
      case 'ability.terrain':
        ring(t, x, y + 50, 20, 170, 800);
        ring(t, x, y + 50, 20, 110, 800, 150);
        break;
      case 'ability.menace':
        ring(t, x, y, 140, 20, 500);
        flash(t, 0.25);
        t.shake(Math.round(6 * t.plan.shake));
        break;
      case 'ability.boost':
        sparks(t, 'up', 6);
        ring(t, x, y, 20, 90, 600);
        break;
      case 'ability.absorb':
        sparks(t, 'in', 8);
        ring(t, x, y, 100, 20, 550);
        break;
      case 'ability.contact':
        sparks(t, 'out', 8);
        flash(t, 0.2);
        t.shake(Math.round(4 * t.plan.shake));
        break;
      case 'ability.guard':
        ring(t, x, y, 30, 100, 600);
        ring(t, x, y, 30, 130, 600, 120);
        break;
      case 'ability.heal':
        sparks(t, 'up', 8);
        break;
      case 'ability.form':
        ring(t, x, y, 20, 120, 700);
        sparks(t, 'out', 10);
        flash(t, 0.3);
        break;
      case 'ability.reveal':
        ring(t, x, y, 20, 110, 700);
        break;
      case 'ability.aura':
        ring(t, x, y, 30, 130, 800);
        ring(t, x, y, 30, 130, 800, 200);
        sparks(t, 'out', 6);
        break;
      default:
        ring(t, x, y, 20, 80, 500);
    }
  }
  return new Promise((resolve) => t.scene.time.delayedCall(Math.min(t.plan.ms, 700), resolve));
}

/** Animated battle text. `done` runs when the words are gone (for the stacking counter). */
export function playTextAnim(t: FxTools, done: () => void): void {
  const side = t.side === 'enemy' ? -70 : 70;
  const x = t.at.x + side;
  const y = t.at.y + 34 + t.slot * 30;
  const id = t.plan.id;
  const label = id === 'text.immune' && t.plan.glyph && !t.plan.reduced ? `${t.plan.glyph} ${t.label}` : t.label;
  const txt = t.scene.add.text(x, y, label, textStyle(22, t.plan.color, { stroke: '#181818', strokeThickness: 5 })).setOrigin(0.5);
  t.field.add(txt);
  const out = (delay: number, extra: Partial<Phaser.Types.Tweens.TweenBuilderConfig> = {}) =>
    t.scene.tweens.add({ targets: txt, alpha: 0, delay, duration: 300, ...extra, onComplete: () => { txt.destroy(); done(); } });
  if (t.plan.reduced) {
    txt.setAlpha(0);
    t.scene.tweens.add({ targets: txt, alpha: 1, duration: 150 });
    out(Math.min(t.plan.ms, 900));
    return;
  }
  const glow = { ...t.at, x, y };
  switch (id) {
    case 'text.super':
      txt.setScale(0.3);
      t.scene.tweens.add({ targets: txt, scale: 1.25, duration: 160, ease: 'Back.easeOut', yoyo: true, hold: 60, onComplete: () => txt.setScale(1) });
      sparks({ ...t, at: glow }, 'out', 6);
      out(t.plan.ms);
      break;
    case 'text.crit':
      txt.setScale(0.4);
      t.scene.tweens.add({ targets: txt, scale: 1.3, duration: 140, ease: 'Back.easeOut' });
      t.scene.tweens.add({ targets: txt, angle: { from: -6, to: 6 }, yoyo: true, repeat: 3, duration: 60, onComplete: () => txt.setAngle(0) });
      sparks({ ...t, at: glow }, 'out', 8);
      out(t.plan.ms);
      break;
    case 'text.weak':
      txt.setY(y - 24).setAlpha(0.9);
      t.scene.tweens.add({ targets: txt, y: y + 8, scale: 0.9, duration: 500, ease: 'Sine.easeOut' });
      out(t.plan.ms);
      break;
    case 'text.immune':
      txt.setScale(0.5);
      t.scene.tweens.add({ targets: txt, scale: 1, duration: 200, ease: 'Back.easeOut' });
      ring({ ...t, at: glow }, x, y, 10, 60, 500);
      out(t.plan.ms);
      break;
    case 'text.miss':
      txt.setX(x + (t.side === 'enemy' ? 60 : -60)).setAlpha(0);
      t.scene.tweens.add({ targets: txt, x: x - (t.side === 'enemy' ? 60 : -60), alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
      out(t.plan.ms - 300);
      break;
    default:
      out(t.plan.ms);
  }
}
