// Interface skins (W11 follow-up): how DS Touch, Wii Channel and Cyber-Maximalism differ from Classic Plum and Aero in
// shape, panel build, cursor and motion, not only colour. Pure data and geometry; `ui/skinPaint.ts` draws it.

import type { Settings } from '../state';

export type UiThemeId = Settings['uiTheme'];
export type PanelShape = 'pixel' | 'glass' | 'flat' | 'pill' | 'chamfer';
/** How motion feels: `default` is the Wii-style spring from spec section 24. */
export type MotionFeel = 'default' | 'bouncy' | 'snappy' | 'glitch';

export interface SkinSpec {
  shape: PanelShape;
  /** Corner radius for rounded shapes, or the cut size for chamfered ones (px). */
  radius: number;
  borderPx: number;
  /** Hard drop shadow offset (DS) in px; 0 = none. */
  shadow: number;
  /** Soft glow or shadow layers around the panel (Wii, Cyber). */
  glow: number;
  /** Faint horizontal scanlines inside panels (Cyber). */
  scanlines: boolean;
  /** The selection cursor: a rounded glowing frame, a plain square frame, or a chamfered neon frame. */
  cursor: 'glow' | 'square' | 'neon';
  feel: MotionFeel;
  /** The scene backdrop overlay drawn over the Aero sky. */
  backdrop: 'sky' | 'bands' | 'soft' | 'grid';
}

export const SKINS: Record<UiThemeId, SkinSpec> = {
  classic: { shape: 'pixel', radius: 0, borderPx: 3, shadow: 0, glow: 0, scanlines: false, cursor: 'glow', feel: 'default', backdrop: 'sky' },
  aero: { shape: 'glass', radius: 18, borderPx: 2, shadow: 0, glow: 1, scanlines: false, cursor: 'glow', feel: 'default', backdrop: 'sky' },
  ds: { shape: 'flat', radius: 5, borderPx: 3, shadow: 3, glow: 0, scanlines: false, cursor: 'square', feel: 'snappy', backdrop: 'bands' },
  wii: { shape: 'pill', radius: 26, borderPx: 3, shadow: 0, glow: 3, scanlines: false, cursor: 'glow', feel: 'bouncy', backdrop: 'soft' },
  cyber: { shape: 'chamfer', radius: 12, borderPx: 2, shadow: 0, glow: 2, scanlines: true, cursor: 'neon', feel: 'glitch', backdrop: 'grid' },
};

export const skinOf = (id: UiThemeId): SkinSpec => SKINS[id];

/** Corner radius that never exceeds half the panel's shorter side. */
export const cornerRadius = (skin: SkinSpec, w: number, h: number): number => Math.max(0, Math.min(skin.radius, h / 2, w / 2));

/** Outline of a rectangle with its four corners cut by `c` px (clockwise from the top-left cut). */
export function chamferPoints(x: number, y: number, w: number, h: number, c: number): { x: number; y: number }[] {
  const k = Math.max(0, Math.min(c, w / 2, h / 2));
  return [
    { x: x + k, y }, { x: x + w - k, y }, { x: x + w, y: y + k }, { x: x + w, y: y + h - k },
    { x: x + w - k, y: y + h }, { x: x + k, y: y + h }, { x, y: y + h - k }, { x, y: y + k },
  ];
}

/** Y positions of the scanlines inside a panel, every `gap` px, kept off the border. */
export function scanlineYs(y: number, h: number, gap = 4, margin = 4): number[] {
  const out: number[] = [];
  for (let v = y + margin; v < y + h - margin; v += gap) out.push(v);
  return out;
}

/** Tween feel adjustments: duration multiplier, whether scale pops play, and the ease for movement. */
export function feelTween(feel: MotionFeel): { msScale: number; pops: boolean; ease: string | null; stiffness: number; dampingScale: number } {
  switch (feel) {
    case 'bouncy': return { msScale: 1.15, pops: true, ease: 'Elastic.easeOut', stiffness: 1, dampingScale: 0.42 };
    case 'snappy': return { msScale: 0.75, pops: false, ease: 'Cubic.easeOut', stiffness: 1.5, dampingScale: 1 };
    case 'glitch': return { msScale: 0.7, pops: true, ease: 'Expo.easeOut', stiffness: 1.8, dampingScale: 0.8 };
    default: return { msScale: 1, pops: true, ease: null, stiffness: 1, dampingScale: 0.62 };
  }
}
