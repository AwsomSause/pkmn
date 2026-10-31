// Which battle arena a fight uses (presentation only; a stable hash of the run seed, never gameplay RNG).
// Day battles keep the stage type's arena; evening and night swap in the UIE battleback of the same
// family. Elite Four members and champions fight in the UIE league halls; Shadow foes in the distortion.

import { UIE_ARENAS } from '../assets/catalog';
import type { TypeName } from './contentSchema';

/** Type → UIE family that has evening and night versions. */
const FAMILY: Partial<Record<TypeName, string>> = {
  normal: 'field', grass: 'field', bug: 'forest', water: 'water', rock: 'rocky', ground: 'rocky', ice: 'snow', flying: 'field',
};

export type TimeOfDay = 'day' | 'eve' | 'night';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Day half the time, evening and night a quarter each. */
export function timeOfDay(seed: string, stageIndex: number): TimeOfDay {
  const h = hash(`${seed}:tod:${stageIndex}`) % 4;
  return h < 2 ? 'day' : h === 2 ? 'eve' : 'night';
}

export interface ArenaQuery {
  seed: string;
  stageIndex: number;
  type: TypeName;
  /** Boss fights: elite = position in the league (0-3), champion = the final boss uses the second hall. */
  boss?: { role: 'gym' | 'elite' | 'champion'; eliteIndex: number; final: boolean } | null;
  shadowFoe?: boolean;
}

/** The UIE arena name for a fight, or null to keep the stage type's own arena. */
export function pickUieArena(q: ArenaQuery): string | null {
  if (q.boss?.role === 'champion') return q.boss.final ? 'champion2' : 'champion1';
  if (q.boss?.role === 'elite') return `elite${1 + ((q.boss.eliteIndex + 4 * (hash(q.seed) % 2)) % 8)}`;
  if (q.boss?.role === 'gym') return null;
  if (q.shadowFoe) return 'distortion';
  const family = FAMILY[q.type];
  const tod = timeOfDay(q.seed, q.stageIndex);
  if (!family || tod === 'day') return null;
  const name = `${family}_${tod}`;
  return UIE_ARENAS.includes(name) ? name : null;
}

/** How far a floating Pokémon's shadow sits below its feet. */
export const FLYER_LIFT = 12;

/** Shadow shape for a sprite lifted `lift` px above its home: smaller and fainter the higher it is. */
export function shadowLook(width: number, lift: number, flyer: boolean): { width: number; alpha: number; dy: number } {
  const air = Math.max(0, lift) + (flyer ? FLYER_LIFT : 0);
  return { width: Math.max(16, (width * 0.6) / (1 + air / 140)), alpha: Math.max(0.1, 0.3 - air / 420), dy: flyer ? FLYER_LIFT : 0 };
}
