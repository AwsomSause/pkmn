// The "Aero" look for gameplay screens: glossy glass panels, pill buttons and
// bouncy motion (Frutiger Aero, DS/Wii-era menus, a touch of cyber neon).
// Presentation only: nothing here reads or changes game state.
//
// Hub and Trainer screens keep the classic look (theme.ts); only screens that
// call these helpers change.

import moveFlagsJson from '../data/moveFlags.json';
import type Phaser from 'phaser';
import { COLORS, mixColor } from './theme';
import { hasOwnShapes, paintSkinPanel, skinBackdrop } from './skinPaint';

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
  if (hasOwnShapes()) return paintSkinPanel(g, x, y, w, h, { fill: mixColor(tint, 0xffffff, 0.08), border: rim, alpha: opts.alpha ?? 0.92 });
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
import { spritesAnimate } from './display';
export function breathe(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, motion: MotionLevel, delay = 0, period = 1800): void {
  if (motion !== 'full' || !spritesAnimate()) return;
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

/** Enhanced Battle UI flag icon for each move flag (and a high critical-hit ratio). */
export const FLAG_ICONS: Record<string, string> = {
  contact: 'Contact', sound: 'Sound', bite: 'Biting', powder: 'Powder', pulse: 'Pulse', punch: 'Punching',
  highCrit: 'HighCriticalHitRate', zmove: 'ZMove', max: 'DynamaxMove', bullet: 'Bomb', slicing: 'Slicing', wind: 'Wind',
  // From src/data/moveFlags.json (Essentials PBS flags moves.json doesn't carry).
  dance: 'Dance', noProtect: 'NoProtect', thaw: 'ThawsUser', minimize: 'TramplesMinimize', electrocute: 'ElectrocuteUser', noMirror: 'NoMirrorMove',
};

const EXTRA_FLAGS = Object.entries(moveFlagsJson as Record<string, string[]>).map(([flag, ids]) => [flag, new Set(ids)] as const);

/** Every flag a move shows an icon for: its own data flags, high crit, then the Essentials extras. */
export function moveFlagNames(move: { id: string; flags: readonly string[]; critStage: number }): string[] {
  const flags = [...move.flags, ...(move.critStage > 0 ? ['highCrit'] : []), ...EXTRA_FLAGS.filter(([, ids]) => ids.has(move.id)).map(([flag]) => flag)];
  return flags.map((f) => FLAG_ICONS[f]).filter((f): f is string => Boolean(f));
}

/** Words for a type-chart multiplier, so the hint never relies on colour alone. */
export function effectivenessWord(multiplier: number): { frame: number; text: string } {
  if (multiplier === 0) return { frame: 1, text: 'No effect' };
  if (multiplier < 1) return { frame: 2, text: 'Not very effective' };
  if (multiplier > 1) return { frame: 3, text: 'Super effective' };
  return { frame: 4, text: 'Normal damage' };
}

/** One of the five effectiveness tags (64×76 art pixels each), or null if the art is missing. */
export function effectivenessIcon(scene: Phaser.Scene, x: number, y: number, frame: number, scale = 0.45): Phaser.GameObjects.Image | null {
  const key = 'pack.ebui.effectiveness';
  if (!scene.textures.exists(key)) return null;
  const texture = scene.textures.get(key);
  if (!texture.has('e0')) for (let i = 0; i < 5; i++) texture.add(`e${i}`, 0, i * 64, 0, 64, 76);
  return scene.add.image(x, y, key, `e${frame}`).setOrigin(0, 0.5).setScale(scale);
}

/**
 * The Aero backdrop for gameplay menus: a deep sky-to-sea gradient, soft light
 * rays, a glossy horizon band and slowly rising bubbles (fixed layout, no
 * random numbers). Still with reduced motion; plain with animations off.
 */
export function aeroBackdrop(scene: Phaser.Scene, motion: MotionLevel, tint: number = AERO.sky): Phaser.GameObjects.Container {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(-100);
  const g = scene.add.graphics();
  const top = mixColor(tint, 0x000000, 0.55);
  const bottom = mixColor(AERO.glassLow, 0x000000, 0.2);
  g.fillGradientStyle(top, top, bottom, bottom, 1, 1, 1, 1);
  g.fillRect(0, 0, W, H);
  // A glossy curved horizon (Wii menu / Aero wallpaper).
  g.fillStyle(0xffffff, 0.06);
  g.fillEllipse(W / 2, H * 0.78, W * 1.6, H * 0.5);
  g.fillStyle(tint, 0.08);
  g.fillEllipse(W / 2, H * 0.82, W * 1.4, H * 0.38);
  root.add(g);
  skinBackdrop(scene, root, W, H, motion);
  if (motion === 'off') return root;
  const has = (k: string) => scene.textures.exists(k);
  if (has('pack.ebdx.lightA')) {
    [0.15, 0.5, 0.85].forEach((fx, i) => {
      const ray = scene.add.image(W * fx, -10, i % 2 ? 'pack.ebdx.lightB' : 'pack.ebdx.lightA').setOrigin(0.5, 0).setScale(2.4, 2.6).setAlpha(0.14).setBlendMode('ADD');
      root.add(ray);
      if (motion === 'full') scene.tweens.add({ targets: ray, alpha: 0.3, duration: 3000 + i * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }
  if (has('pack.ebdx.bubble')) {
    for (let i = 0; i < 12; i++) {
      const f = (i * 0.6180339887) % 1;
      const x = 30 + f * (W - 60);
      const b = scene.add.image(x, H + 20 - ((i * 0.381966) % 1) * H, 'pack.ebdx.bubble').setScale(1.2 + f * 1.4).setAlpha(0.35);
      root.add(b);
      if (motion !== 'full') continue;
      const dur = 9000 + f * 7000;
      scene.tweens.add({
        targets: b,
        y: -20,
        x: x + (i % 2 ? 24 : -24),
        duration: (dur * (b.y + 20)) / (H + 40),
        onComplete: () => {
          b.setPosition(x, H + 20);
          scene.tweens.add({ targets: b, y: -20, x: x + (i % 2 ? 24 : -24), duration: dur, repeat: -1 });
        },
      });
    }
  }
  return root;
}

/**
 * Drop-in glass version of widgets' drawPanel (same arguments): darker glass
 * for information panes, the trim colour carried into the rim.
 */
export function glassPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; border?: number; alpha?: number; thin?: boolean } = {},
): Phaser.GameObjects.Graphics {
  const info = opts.fill !== undefined && opts.fill !== COLORS.panel;
  const rim = opts.border !== undefined && opts.border !== COLORS.border && opts.border !== COLORS.borderMuted ? mixColor(opts.border, 0xffffff, 0.25) : info ? AERO.sky : AERO.rim;
  return drawGlass(scene, x, y, w, h, { tint: info ? AERO.glassLow : AERO.glass, rim, alpha: opts.alpha ?? 0.92, glow: !info && !opts.thin, radius: 18 });
}
