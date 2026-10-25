// Shared look-and-feel: colors, fonts and text styles.

import type Phaser from 'phaser';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
/** The supplied art is drawn for a 320×180 screen; we draw it 3× larger. */
export const PIXEL_SCALE = 3;

export const COLORS = {
  background: 0x101828,
  panel: 0xf8f8f0,
  panelDark: 0x283048,
  border: 0x404858,
  accent: 0xe05038,
  text: '#283040',
  textLight: '#f8f8f8',
  textMuted: '#707888',
  good: '#2c8c4c',
  bad: '#c03028',
  hpGreen: 0x48c860,
  hpYellow: 0xf0c028,
  hpRed: 0xe04030,
  xp: 0x40a0f0,
  rarity: { common: 0x8090a0, uncommon: 0x40a060, rare: 0xc08020 } as Record<string, number>,
};

export const TYPE_COLORS: Record<string, number> = {
  normal: 0xa8a878, fire: 0xf08030, water: 0x6890f0, electric: 0xf8d030, grass: 0x78c850,
  ice: 0x98d8d8, fighting: 0xc03028, poison: 0xa040a0, ground: 0xe0c068, flying: 0xa890f0,
  psychic: 0xf85888, bug: 0xa8b820, rock: 0xb8a038, ghost: 0x705898, dragon: 0x7038f8,
  dark: 0x705848, steel: 0xb8b8d0, fairy: 0xee99ac,
};

export const FONT_FAMILY = '"PokemonMain", "Courier New", monospace';

export function textStyle(size: number, color: string = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, ...extra };
}

export const STATUS_LABELS: Record<string, { label: string; color: number }> = {
  brn: { label: 'BRN', color: 0xe07030 },
  psn: { label: 'PSN', color: 0xa040a0 },
  par: { label: 'PAR', color: 0xd0b020 },
  slp: { label: 'SLP', color: 0x8890a0 },
  frz: { label: 'FRZ', color: 0x60b8d8 },
};
