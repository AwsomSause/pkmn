// Elite Four identity (catalog 92): each member fights by a philosophy picked from the type of its lead Pokémon.
// The philosophy is its tactical puzzle (told on the first turn, with the stat it leans on) and its after-battle reward
// (a vitamin for your lead in the stat it was built around). Chosen by type only, never by a roll.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { maxHp } from '../pokemon';
import { emit } from './record';
import type { ElitePhilosophy } from './schema';

/** The philosophy for a lead Pokémon's species (null: its type is not covered). */
export function elitePhilosophy(content: Content, leadSpeciesId: string): ElitePhilosophy | null {
  const types = content.species.get(leadSpeciesId)?.types ?? [];
  return content.story.elitePhilosophies.find((p) => types.some((t) => p.types.includes(t))) ?? null;
}

/** After beating an Elite Four member: the philosophy's vitamin goes to your lead. Returns a line, or null. */
export function eliteReward(content: Content, run: RunState, leadSpeciesId: string, name: string): string | null {
  const p = elitePhilosophy(content, leadSpeciesId);
  const mon = run.party.find((m) => m.hp > 0) ?? run.party[0];
  if (!p || !mon) return null;
  const before = maxHp(content, mon);
  mon.vitamins[p.stat] = Math.min(content.balance.vitaminMaxStacks, (mon.vitamins[p.stat] ?? 0) + 1);
  if (p.stat === 'hp' && mon.hp > 0) mon.hp += maxHp(content, mon) - before;
  const line = `${name} taught you their way, ${p.name}: ${content.species.get(mon.speciesId)?.name ?? 'your lead'}'s ${p.statName} rose`;
  emit(content, run, 'storyMoment', { actors: [mon.uid], data: { def: 'elite-philosophy', suppressed: false }, importance: 70, text: line });
  return line;
}
