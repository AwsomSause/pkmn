// Natures: every Pokémon has one. It raises one stat by 10% and lowers another by 10%
// (HP is never touched); five natures change nothing. Mints (item catalog) change it.
// A Pokémon from before natures existed has none and counts as neutral.

import { hashSeed, Rng } from './rng';

type BattleStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';

/** id → [raised stat, lowered stat]; equal stats mean neutral. */
export const NATURES = {
  hardy: ['atk', 'atk'], lonely: ['atk', 'def'], adamant: ['atk', 'spa'], naughty: ['atk', 'spd'], brave: ['atk', 'spe'],
  bold: ['def', 'atk'], docile: ['def', 'def'], impish: ['def', 'spa'], lax: ['def', 'spd'], relaxed: ['def', 'spe'],
  modest: ['spa', 'atk'], mild: ['spa', 'def'], bashful: ['spa', 'spa'], rash: ['spa', 'spd'], quiet: ['spa', 'spe'],
  calm: ['spd', 'atk'], gentle: ['spd', 'def'], careful: ['spd', 'spa'], quirky: ['spd', 'spd'], sassy: ['spd', 'spe'],
  timid: ['spe', 'atk'], hasty: ['spe', 'def'], jolly: ['spe', 'spa'], naive: ['spe', 'spd'], serious: ['spe', 'spe'],
} as const satisfies Record<string, readonly [BattleStat, BattleStat]>;

export type NatureId = keyof typeof NATURES;
export const NATURE_IDS = Object.keys(NATURES) as [NatureId, ...NatureId[]];
export const NATURE_SHIFT = 0.1;

export const natureName = (id: NatureId) => id[0]!.toUpperCase() + id.slice(1);

/** The nature a new Pokémon gets: fixed by its key, drawn from a generator of its own (no gameplay roll is used). */
export function rollNature(key: string): NatureId {
  return NATURE_IDS[new Rng(hashSeed(`nature:${key}`)).int(0, NATURE_IDS.length - 1)]!;
}

/** 1.1, 0.9 or 1 for this stat. */
export function natureMultiplier(nature: NatureId | undefined, stat: string): number {
  if (!nature) return 1;
  const [up, down] = NATURES[nature];
  if (up === down) return 1;
  return stat === up ? 1 + NATURE_SHIFT : stat === down ? 1 - NATURE_SHIFT : 1;
}

/** "+Atk −Def" style summary, or "neutral". */
export function natureEffectText(nature: NatureId): string {
  const [up, down] = NATURES[nature];
  const label = (s: BattleStat) => ({ atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' })[s];
  return up === down ? 'no change' : `+${label(up)}, −${label(down)}`;
}
