// A rival's return and its one fair, telegraphed adaptation (Living Rivalry Engine, slice 2).
// The rival takes the place of the first ordinary trainer of a later stage, once per region.
// It remembers its team, comes back stronger, and swaps ONE member for a Pokémon from the
// planned team that resists the type of attack you use most; the player is told which.

import { typeEffectiveness } from '../battle/damage';
import type { Content, TypeName } from '../contentSchema';
import type { TrainerPlan } from '../encounters';
import { getSpecies } from '../pokemon';
import type { RunState } from '../state';
import { revisedTeam, type RematchEffect } from '../story/returns';
import type { EnemyProfile, Rival } from '../story/schema';
import { rivalMods } from './profile';

/** The story flag holding the region a rival last came back in. */
export const rivalReturnFlag = (id: string) => `rival-return:${id}`;

/** The first rival due to come back: it sparked in an earlier stage and hasn't returned in this region. */
export function waitingRival(run: RunState): Rival | null {
  return (
    run.story.rivals.find((r) => {
      const last = run.story.flags[rivalReturnFlag(r.id)];
      if (typeof last === 'number' && last >= run.regionIndex) return false;
      const met = r.memory.lastBattle.eventId === r.origin.eventId ? r.origin.where : null;
      return !met || met.region !== run.regionIndex || met.stage !== (run.stage?.index ?? null);
    }) ?? null
  );
}

/** The attack type the party's damaging moves use most (ties: the type listed first in the type chart). */
export function mostUsedType(content: Content, run: RunState): TypeName | null {
  const counts = new Map<TypeName, number>();
  for (const mon of run.party) {
    for (const slot of mon.moves) {
      const move = content.moves.get(slot.id);
      if (move && move.category !== 'status') counts.set(move.type, (counts.get(move.type) ?? 0) + 1);
    }
  }
  let best: TypeName | null = null;
  for (const [type, n] of counts) if (best === null || n > counts.get(best)!) best = type;
  return best;
}

export interface RivalReturn {
  plan: TrainerPlan;
  /** What the rival learned, shown before the battle (null if nothing in its team helps). */
  note: string | null;
}

/** The rival's team for its return: its old Pokémon at the new levels, with one counter-pick. */
export function rivalReturn(content: Content, run: RunState, rival: Rival, plan: TrainerPlan, effect: RematchEffect): RivalReturn {
  const profile: EnemyProfile = {
    id: rival.id,
    name: rival.name,
    trainerId: rival.classId,
    region: rival.origin.where.region,
    team: rival.memory.lastBattle.team.map((speciesId) => ({ speciesId, level: 1 })),
    battles: [],
    adaptations: rival.adaptations,
  };
  const mods = rivalMods(rival);
  // Personality: vindictive rivals return stronger. Style: how sharp its move choice is.
  const revised = { ...revisedTeam(content, run, profile, plan, { ...effect, levelBonus: effect.levelBonus + mods.levelBonus }), ai: Math.max(plan.ai, mods.ai) };
  const type = mostUsedType(content, run);
  if (!type || !mods.canAdapt || rival.adaptations.length >= mods.adaptCap) return { plan: revised, note: null };
  const resist = (speciesId: string) => typeEffectiveness(content.typeChart, type, getSpecies(content, speciesId).types);
  const bias = (speciesId: string) => mods.statBias.reduce((sum, stat) => sum + (getSpecies(content, speciesId).baseStats[stat as 'hp'] ?? 0), 0);
  const last = revised.members.length - 1;
  const current = resist(revised.members[last]!.speciesId);
  const counter = plan.members.map((m) => m.speciesId).filter((id) => !revised.members.some((m) => m.speciesId === id))
    .sort((a, b) => resist(a) - resist(b) || bias(b) - bias(a) || a.localeCompare(b))[0];
  if (!counter || resist(counter) >= current) return { plan: revised, note: null };
  const members = revised.members.map((m, i) => (i === last ? { ...m, speciesId: counter } : m));
  return { plan: { ...revised, members }, note: `${rival.name} studied your ${type} moves and brought ${getSpecies(content, counter).name}.` };
}
