// A rival's return and its one fair, telegraphed adaptation (Living Rivalry Engine, slice 2).
// The rival takes the place of the first ordinary trainer of a later stage, once per region.
// It remembers its team, comes back stronger, and swaps ONE member for a Pokémon from the
// planned team that resists the type of attack you use most; the player is told which.

import { runPerks } from '../archetypes';
import { rivalCounterBonus, rivalLevelOffset, rivalTeamTypes } from '../trainerPerks';
import { typeEffectiveness } from '../battle/damage';
import type { Content, TypeName } from '../contentSchema';
import type { TrainerPlan } from '../encounters';
import { getSpecies } from '../pokemon';
import { wildEligibleSpecies } from '../themes';
import type { RunState } from '../state';
import { revisedTeam, type RematchEffect } from '../story/returns';
import type { EnemyProfile, Rival } from '../story/schema';
import { bondNote, bondShift } from './bonds';
import { isHostile } from './outcome';
import { legacyNote, substitute } from './relations';
import { rivalMods } from './profile';

/** The story flag holding the region a rival last came back in. */
export const rivalReturnFlag = (id: string) => `rival-return:${id}`;

/** The first rival due to come back: it sparked in an earlier stage and hasn't returned in this region. */
export function waitingRival(run: RunState): Rival | null {
  return (
    run.story.rivals.find((r) => {
      if (!isHostile(r) || r.cooldown > 0) return false;
      const last = run.story.flags[rivalReturnFlag(r.id)];
      if (typeof last === 'number' && last >= run.regionIndex) return false;
      const met = r.memory.lastBattle.eventId === r.origin.eventId ? r.origin.where : null;
      return !met || met.region !== run.regionIndex || met.stage !== (run.stage?.index ?? null);
    }) ?? null
  );
}

/** The attack type the party's damaging moves use most (ties: the type listed first in the type chart). */
export function mostUsedType(content: Content, run: RunState): TypeName | null {
  return usedTypes(content, run)[0] ?? null;
}

/** Attack types your party's damaging moves use, most used first. */
export function usedTypes(content: Content, run: RunState): TypeName[] {
  const counts = new Map<TypeName, number>();
  for (const mon of run.party) {
    for (const slot of mon.moves) {
      const move = content.moves.get(slot.id);
      if (move && move.category !== 'status') counts.set(move.type, (counts.get(move.type) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type]) => type);
}

export interface RivalReturn {
  plan: TrainerPlan;
  /** What the rival learned, shown before the battle (null if nothing in its team helps). */
  note: string | null;
}

/** The rival's team for its return: its old Pokémon at the new levels, with one counter-pick. */
export function rivalReturn(content: Content, run: RunState, rival: Rival, plan: TrainerPlan, effect: RematchEffect): RivalReturn {
  const base = baseReturn(content, run, rival, plan, effect);
  // A worn-out ace sits out; a rival that remembers a close battle says so.
  const sub = substitute(content, run, rival, base.plan.members);
  const members = sub ? sub.order.map((i) => base.plan.members[i]!) : base.plan.members;
  const note = [base.note, sub?.note, legacyNote(rival)].filter(Boolean).join(' ') || null;
  return { plan: { ...base.plan, members }, note };
}

function baseReturn(content: Content, run: RunState, rival: Rival, plan: TrainerPlan, effect: RematchEffect): RivalReturn {
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
  const revised = { ...revisedTeam(content, run, profile, plan, { ...effect, levelBonus: effect.levelBonus + mods.levelBonus + bondShift(rival) + rivalLevelOffset(runPerks(content, run)) }), ai: Math.max(plan.ai, mods.ai) };
  const perks = runPerks(content, run);
  const type = mostUsedType(content, run);
  const seen = bondNote(rival);
  // A trainer perk (Blue, Gen 3): the rival always carries a Pokémon of some type (Blaine: Water).
  const planned = withTeamTypes(content, revised, rivalTeamTypes(perks));
  if (!type || !mods.canAdapt || rival.adaptations.length >= mods.adaptCap) return { plan: planned, note: seen };
  const bias = (speciesId: string) => mods.statBias.reduce((sum, stat) => sum + (getSpecies(content, speciesId).baseStats[stat as 'hp'] ?? 0), 0);
  // One counter-pick for the type you use most; a trainer perk adds a counter for the next most used types.
  const types = usedTypes(content, run).slice(0, 1 + rivalCounterBonus(perks));
  let members = planned.members;
  const notes: string[] = [];
  types.forEach((t, k) => {
    const slot = members.length - 1 - k;
    if (slot < 0) return;
    const resist = (speciesId: string) => typeEffectiveness(content.typeChart, t, getSpecies(content, speciesId).types);
    const counter = plan.members.map((m) => m.speciesId).filter((id) => !members.some((m) => m.speciesId === id))
      .sort((a, b) => resist(a) - resist(b) || bias(b) - bias(a) || a.localeCompare(b))[0];
    if (!counter || resist(counter) >= resist(members[slot]!.speciesId)) return;
    members = members.map((m, i) => (i === slot ? { ...m, speciesId: counter } : m));
    notes.push(`${rival.name} studied your ${t} moves and brought ${getSpecies(content, counter).name}.`);
  });
  if (notes.length === 0) return { plan: planned, note: seen };
  return { plan: { ...planned, members }, note: `${notes.join(' ')}${seen ? ` ${seen}` : ''}` };
}

/** Makes sure the team has a Pokémon of each type, swapping in a species of similar strength for the last members. */
function withTeamTypes(content: Content, plan: TrainerPlan, types: readonly TypeName[]): TrainerPlan {
  if (types.length === 0) return plan;
  let members = plan.members;
  types.forEach((type, k) => {
    if (members.some((m) => getSpecies(content, m.speciesId).types.includes(type))) return;
    const slot = members.length - 1 - k;
    if (slot < 0) return;
    const bst = (id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);
    const target = bst(members[slot]!.speciesId);
    const pick = wildEligibleSpecies(content)
      .filter((s) => s.types.includes(type) && !members.some((m) => m.speciesId === s.id))
      .sort((a, b) => Math.abs(bst(a.id) - target) - Math.abs(bst(b.id) - target) || a.id.localeCompare(b.id))[0];
    if (pick) members = members.map((m, i) => (i === slot ? { ...m, speciesId: pick.id } : m));
  });
  return { ...plan, members };
}
