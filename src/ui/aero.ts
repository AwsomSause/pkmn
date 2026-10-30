// The "Aero" look for gameplay screens: glossy glass panels, pill buttons and
// bouncy motion (Frutiger Aero, DS/Wii-era menus, a touch of cyber neon).
// Presentation only: nothing here reads or changes game state.
//
// Hub and Trainer screens keep the classic look (theme.ts); only screens that
// call these helpers change.

import type Phaser from 'phaser';
import { mixColor } from './theme';

export const AERO = {
  /** Deep glass behind text. */
  glass: 0x0b2a4a,
  glassLow: 0x061528,
  /** Bright rim and focus glow. */
  rim: 0x7ff3ff,
  sky: 0x38c8ff,
  aqua: 0x2ee6c8,
  /** Cyber accent for highlights and warnings. */
  neon: 0xff4fd8,
  white: 0xffffff,
};

export interface GlassOpts {
  /** Main colour of the glass (default deep blue). */
  tint?: number;
  /** Rim colour (default bright aqua). */
  rim?: number;
  radius?: number;
  alpha?: number;
  /** Draw the soft outer glow (default true). */
  glow?: boolean;
}

/**
 * Paints a glossy glass panel onto g: soft outer glow, a vertical gradient,
 * a white gloss band across the top half and a bright rim.
 */
export function paintGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: GlassOpts = {}): Phaser.GameObjects.Graphics {
  const tint = opts.tint ?? AERO.glass;
  const rim = opts.rim ?? AERO.rim;
  const r = Math.min(opts.radius ?? 18, h / 2, w / 2);
  const a = opts.alpha ?? 0.92;
  if (opts.glow !== false) {
    g.fillStyle(rim, 0.12 * a);
    g.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, r + 5);
    g.fillStyle(rim, 0.18 * a);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
  }
  const top = mixColor(tint, 0xffffff, 0.22);
  const bottom = mixColor(tint, 0x000000, 0.35);
  g.fillGradientStyle(top, top, bottom, bottom, a, a, a, a);
  g.fillRoundedRect(x, y, w, h, r);
  // Gloss: a pale band over the top half, as on Aero glass and Wii buttons.
  const gloss = Math.max(4, Math.round(h * 0.46));
  g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.34 * a, 0.34 * a, 0.04 * a, 0.04 * a);
  g.fillRoundedRect(x + 4, y + 3, w - 8, gloss, { tl: Math.max(0, r - 3), tr: Math.max(0, r - 3), bl: 4, br: 4 });
  g.lineStyle(2, rim, 0.9 * a);
  g.strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(1, 0xffffff, 0.35 * a);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(0, r - 3));
  return g;
}

export function drawGlass(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: GlassOpts = {}): Phaser.GameObjects.Graphics {
  return paintGlass(scene.add.graphics(), x, y, w, h, opts);
}

/** How much motion the player allows: full, small (reduced) or none. */
export type MotionLevel = 'full' | 'reduced' | 'off';

/** Pops an object in with an overshoot (a squash-and-stretch bounce). */
export function bounceIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, motion: MotionLevel, delay = 0): void {
  if (motion !== 'full') return;
  const t = target as unknown as { scaleX: number; scaleY: number; setScale: (x: number, y?: number) => void };
  const sx = t.scaleX;
  const sy = t.scaleY;
  t.setScale(sx * 0.6, sy * 0.6);
  scene.tweens.add({ targets: target, scaleX: sx, scaleY: sy, duration: 420, delay, ease: 'Back.easeOut' });
}

/** Slides an object in from an offset with a bouncy settle. */
export function slideIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, dx: number, dy: number, motion: MotionLevel): void {
  if (motion === 'off') return;
  const t = target as unknown as { x: number; y: number };
  const x = t.x;
  const y = t.y;
  t.x = x + (motion === 'full' ? dx : dx / 4);
  t.y = y + (motion === 'full' ? dy : dy / 4);
  scene.tweens.add({ targets: target, x, y, duration: motion === 'full' ? 520 : 200, ease: motion === 'full' ? 'Back.easeOut' : 'Sine.easeOut' });
}

/** A slow, endless float up and down (idle "breathing"). Returns the tween so callers can stop it. */
export function floatIdle(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, motion: MotionLevel, amplitude = 4, period = 1600): Phaser.Tweens.Tween | null {
  if (motion !== 'full') return null;
  const t = target as unknown as { y: number };
  return scene.tweens.add({ targets: target, y: t.y - amplitude, duration: period / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/**
 * Idle "breathing" for a battler: a slow stretch of its height, so it never
 * fights move animations that slide it around. Starts after `delay` ms.
 */
export function breathe(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, motion: MotionLevel, delay = 0, period = 1800): void {
  if (motion !== 'full') return;
  const t = target as unknown as { scaleY: number };
  scene.time.delayedCall(delay, () => {
    if (!target.active) return;
    scene.tweens.add({ targets: target, scaleY: t.scaleY * 1.035, duration: period / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
}

/**
 * Splits a picture made of equal rows into named frames ("0", "1", …), once.
 * Used for the Essentials strips (type labels, move categories, statuses).
 */
export function ensureRowFrames(scene: Phaser.Scene, key: string, rowHeight: number): boolean {
  if (!scene.textures.exists(key)) return false;
  const texture = scene.textures.get(key);
  if (texture.has('0')) return true;
  const src = texture.getSourceImage();
  const rows = Math.floor(src.height / rowHeight);
  for (let i = 0; i < rows; i++) texture.add(String(i), 0, 0, i * rowHeight, src.width, rowHeight);
  return true;
}

/** Row of each type in Essentials' type strip (EBDX types2.png). */
export const TYPE_ROWS: Record<string, number> = {
  normal: 0, fighting: 1, flying: 2, poison: 3, ground: 4, rock: 5, bug: 6, ghost: 7, steel: 8, fire: 10,
  water: 11, grass: 12, electric: 13, psychic: 14, ice: 15, dragon: 16, dark: 17, fairy: 18, stellar: 9,
};
export const CATEGORY_ROWS: Record<string, number> = { physical: 0, special: 1, status: 2 };
export const STATUS_ROWS: Record<string, number> = { slp: 0, psn: 1, brn: 2, par: 3, frz: 4 };

/** A type label from the Essentials strip (70×26 art pixels), or null if the art is missing. */
export function typeLabel(scene: Phaser.Scene, x: number, y: number, type: string, scale = 1.5): Phaser.GameObjects.Image | null {
  const row = TYPE_ROWS[type];
  if (row === undefined || !ensureRowFrames(scene, 'pack.ebdx.types', 26)) return null;
  return scene.add.image(x, y, 'pack.ebdx.types', String(row)).setOrigin(0, 0.5).setScale(scale);
}

export function categoryIcon(scene: Phaser.Scene, x: number, y: number, category: string, scale = 1.5): Phaser.GameObjects.Image | null {
  const row = CATEGORY_ROWS[category];
  if (row === undefined || !ensureRowFrames(scene, 'pack.ebdx.category', 22)) return null;
  return scene.add.image(x, y, 'pack.ebdx.category', String(row)).setOrigin(0, 0.5).setScale(scale);
}

export function statusIcon(scene: Phaser.Scene, x: number, y: number, status: string, scale = 2): Phaser.GameObjects.Image | null {
  const row = STATUS_ROWS[status];
  if (row === undefined || !ensureRowFrames(scene, 'pack.ebdx.status', 16)) return null;
  return scene.add.image(x, y, 'pack.ebdx.status', String(row)).setOrigin(0, 0).setScale(scale);
}
