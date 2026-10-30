// Adaptive music (catalog #126, #128, #129, #130): which procedural layers play for a battle state, the boss music
// states, a short motif per character, and an ambience bed per arena type. Pure and deterministic: no gameplay RNG,
// and the music never changes a battle (boss phases follow battle state, never the other way round).

import { hashSeed, Rng } from '../rng';

export type LayerId = 'pad' | 'pulse' | 'lead' | 'choir';
export type MusicState = 'calm' | 'tense' | 'boss' | 'bossAce' | 'danger';

export interface MusicInput {
  boss: boolean;
  /** The last Pokémon of a team (the "ace" phase of a boss). */
  lastFoe: boolean;
  playerHpShare: number;
  enemyHpShare: number;
}

/** Boss music states (#128): intro and normal fights stay light; a boss's ace goes big; low HP raises the danger layer. */
export function musicState(i: MusicInput): MusicState {
  if (i.playerHpShare <= 0.25) return 'danger';
  if (i.boss) return i.lastFoe ? 'bossAce' : 'boss';
  return i.enemyHpShare <= 0.3 || i.playerHpShare <= 0.5 ? 'tense' : 'calm';
}

/** Layers that are audible in each state (#126); the base track from the music pack always plays underneath. */
export const LAYERS: Record<MusicState, LayerId[]> = {
  calm: ['pad'],
  tense: ['pad', 'pulse'],
  boss: ['pad', 'pulse', 'lead'],
  bossAce: ['pad', 'pulse', 'lead', 'choir'],
  danger: ['pulse', 'choir'],
};

/** A motif (#129): semitone steps above the root, 4 to 6 notes, the same for the same id on every run. */
export function motifFor(id: string): number[] {
  const rng = new Rng(hashSeed(`motif::${id}`));
  const scale = [0, 3, 5, 7, 10, 12]; // minor pentatonic
  const length = rng.int(4, 6);
  const notes: number[] = [];
  for (let i = 0; i < length; i++) notes.push(rng.pick(scale));
  notes[length - 1] = 0; // resolves on the root
  return notes;
}

export type AmbienceId = 'wind' | 'water' | 'cave' | 'storm' | 'fire' | 'forest';

const AMBIENCE_BY_TYPE: Record<string, AmbienceId> = {
  water: 'water', ice: 'wind', flying: 'wind', fire: 'fire', electric: 'storm', grass: 'forest', bug: 'forest',
  rock: 'cave', ground: 'cave', ghost: 'cave', dark: 'cave', steel: 'cave', poison: 'cave', psychic: 'wind',
  fairy: 'forest', fighting: 'wind', dragon: 'storm', normal: 'wind',
};

/** Arena soundscape (#130): the bed for the arena's type (unknown types get wind). */
export function ambienceFor(type: string | undefined): AmbienceId {
  return (type && AMBIENCE_BY_TYPE[type]) || 'wind';
}

export interface AmbienceVoice {
  /** Low-pass cutoff of the noise bed in Hz. */
  cutoff: number;
  /** Slow swell rate in Hz. */
  swell: number;
  /** Relative loudness, 0 to 1. */
  level: number;
}

export const AMBIENCE_VOICE: Record<AmbienceId, AmbienceVoice> = {
  wind: { cutoff: 700, swell: 0.12, level: 0.5 },
  water: { cutoff: 1400, swell: 0.3, level: 0.6 },
  cave: { cutoff: 220, swell: 0.05, level: 0.7 },
  storm: { cutoff: 900, swell: 0.2, level: 0.6 },
  fire: { cutoff: 2400, swell: 0.9, level: 0.4 },
  forest: { cutoff: 3000, swell: 0.15, level: 0.3 },
};
