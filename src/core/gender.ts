// Pokémon genders. A Pokémon's gender comes from its uid and its species' female share, so it never
// needs saving, stays the same through evolution, and old saves get one automatically.

import type { Content } from './contentSchema';
import { getSpecies } from './pokemon';
import type { PokemonInstance } from './state';

export type Gender = 'male' | 'female';

/** The share of a Pokémon's uid, from 0 up to (not including) 1, used to decide its gender. */
function genderRoll(uid: string): number {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h % 10000) / 10000;
}

/** Male, female, or null for a genderless species. A species with no ratio listed is an even mix. */
export function genderOf(content: Content, mon: Pick<PokemonInstance, 'uid' | 'speciesId'>): Gender | null {
  const ratio = getSpecies(content, mon.speciesId).femaleRatio;
  if (ratio === null) return null;
  if (ratio === 1) return 'female';
  if (ratio === 0) return 'male';
  return genderRoll(mon.uid) < (ratio ?? 0.5) ? 'female' : 'male';
}

/** True when both have a gender and the genders differ (Attract, Cute Charm, Captivate, Love Ball). */
export function oppositeGender(content: Content, a: Pick<PokemonInstance, 'uid' | 'speciesId'>, b: Pick<PokemonInstance, 'uid' | 'speciesId'>): boolean {
  const ga = genderOf(content, a);
  const gb = genderOf(content, b);
  return ga !== null && gb !== null && ga !== gb;
}

/** True when both have a gender and it is the same (Rivalry). */
export function sameGender(content: Content, a: Pick<PokemonInstance, 'uid' | 'speciesId'>, b: Pick<PokemonInstance, 'uid' | 'speciesId'>): boolean {
  const ga = genderOf(content, a);
  return ga !== null && ga === genderOf(content, b);
}

/** The ♂ / ♀ sign shown after a name ('' for genderless). */
export function genderSign(content: Content, mon: Pick<PokemonInstance, 'uid' | 'speciesId'>): string {
  const g = genderOf(content, mon);
  return g === 'male' ? '♂' : g === 'female' ? '♀' : '';
}
