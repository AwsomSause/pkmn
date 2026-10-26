// Shared look-and-feel: colors, fonts and text styles.
//
// The look follows PokeRogue: dark plum windows with a coloured pixel trim,
// white pixel text with a soft drop shadow, and bright two-tone HP bars.

import type Phaser from 'phaser';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
/** The supplied art is drawn for a 320×180 screen; we draw it 3× larger. */
export const PIXEL_SCALE = 3;

export const COLORS = {
  /** Behind every menu screen. */
  background: 0x1d1a24,
  /** Window fill (PokeRogue's window colour). */
  panel: 0x362d3e,
  /** Information panes and rows that sit inside a window. */
  panelDark: 0x2a2431,
  /** Window trim: PokeRogue's red window style. */
  border: 0xc73625,
  /** Trim for information panes that are not menus. */
  borderMuted: 0x6b5a73,
  /** Focus frames and highlights. */
  accent: 0xffb745,
  /** The menu cursor when its picture is missing. */
  cursor: '#f8f8f8',
  text: '#f8f8f8',
  textLight: '#f8f8f8',
  textMuted: '#a69cb4',
  gold: '#f8d030',
  good: '#78e080',
  bad: '#f87870',
  hpGreen: 0x2ed35a,
  hpYellow: 0xf3b200,
  hpRed: 0xfb3041,
  xp: 0x00baf3,
  // PokeRogue reward tiers: common, great, ultra, and the item catalog's epic tier.
  rarity: { common: 0xd8d8d8, uncommon: 0x4c9cf8, rare: 0xf8c030, epic: 0xc060f0 } as Record<string, number>,
};

/** Two-tone bar colours (top highlight, bottom shade), from PokeRogue's HP and EXP bars. */
export const BAR_SHADES = {
  high: [0x39ff7b, 0x0eb22f],
  medium: [0xf3d200, 0xc08a00],
  low: [0xfb3041, 0x922030],
  xp: [0x00baf3, 0x00799a],
} as const;

export const TYPE_COLORS: Record<string, number> = {
  normal: 0xa8a878, fire: 0xf08030, water: 0x6890f0, electric: 0xf8d030, grass: 0x78c850,
  ice: 0x98d8d8, fighting: 0xc03028, poison: 0xa040a0, ground: 0xe0c068, flying: 0xa890f0,
  psychic: 0xf85888, bug: 0xa8b820, rock: 0xb8a038, ghost: 0x705898, dragon: 0x7038f8,
  dark: 0x705848, steel: 0xb8b8d0, fairy: 0xee99ac,
};

export const FONT_FAMILY = '"PokemonMain", "Courier New", monospace';

/** Mixes two 0xRRGGBB colours; t = 0 gives a, t = 1 gives b. */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** The drop-shadow colour PokeRogue pairs with a text colour (white → plum grey). */
export function shadowFor(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return '#3a3242';
  return hex(mixColor(COLORS.panel, parseInt(m[1]!, 16), 0.3));
}

/**
 * Pixel text. Every style gets PokeRogue's drop shadow unless it asks for an
 * outline (stroke) or its own shadow.
 */
export function textStyle(size: number, color: string = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const offset = Math.max(1, Math.round(size / 12));
  const shadow = extra.stroke ? undefined : { offsetX: offset, offsetY: offset, color: shadowFor(color), fill: true, blur: 0 };
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, ...(shadow ? { shadow } : {}), ...extra };
}

export const STATUS_LABELS: Record<string, { label: string; color: number }> = {
  brn: { label: 'BRN', color: 0xe07030 },
  psn: { label: 'PSN', color: 0xa040a0 },
  par: { label: 'PAR', color: 0xd0b020 },
  slp: { label: 'SLP', color: 0x8890a0 },
  frz: { label: 'FRZ', color: 0x60b8d8 },
};
