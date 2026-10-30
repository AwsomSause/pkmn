// Party role summaries (catalog #119): hint labels worked out from a Pokémon's base stats and moves.
// Hints, not hard truths. Pure; changes nothing.

import type { Content } from './contentSchema';
import type { PokemonInstance } from './state';

export type PartyRole = 'Fast attacker' | 'Heavy hitter' | 'Wall' | 'Setup' | 'Status support' | 'Utility';

/** Up to two roles, most fitting first. */
export function partyRoles(content: Content, mon: PokemonInstance): PartyRole[] {
  const species = content.species.get(mon.speciesId);
  if (!species) return [];
  const b = species.baseStats;
  const moves = mon.moves.map((m) => content.moves.get(m.id)).filter((m) => !!m);
  const damaging = moves.filter((m) => m.category !== 'status');
  const status = moves.filter((m) => m.category === 'status');
  const setup = moves.some((m) => m.effects?.statChanges?.some((s) => s.target === 'self' && s.stages > 0 && s.chance >= 100) && m.category === 'status');
  const bulk = b.hp + b.def + b.spd;
  const offense = Math.max(b.atk, b.spa);
  const roles: PartyRole[] = [];
  if (b.spe >= 100 && offense >= 85 && damaging.length >= 2) roles.push('Fast attacker');
  else if (offense >= 110 && damaging.length >= 2) roles.push('Heavy hitter');
  if (setup) roles.push('Setup');
  if (bulk >= 270 && offense < 110) roles.push('Wall');
  if (status.length >= 2 && !setup) roles.push('Status support');
  if (roles.length === 0) roles.push(damaging.length >= 3 ? 'Heavy hitter' : 'Utility');
  return roles.slice(0, 2);
}
