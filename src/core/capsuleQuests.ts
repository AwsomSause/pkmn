// Ability Capsule Quests (ideas S55): themed challenges ("win 4 battles with a Fire Pokémon fighting") that each
// pay one Ability Capsule once per run. A capsule moves a Pokémon to another of its species' abilities.
// State lives in run `itemCounters` (`capq:<type>` progress, `capq-done:<type>`, `capsules`), no save change.

import type { Content, TypeName } from './contentSchema';
import { abilityOf, getSpecies } from './pokemon';
import { freeAbilities } from './rules';
import type { PokemonInstance, RunState } from './state';

export const CAPSULE_QUESTS: { type: TypeName; name: string; need: number }[] = [
  { type: 'fire', name: 'Trial by Fire', need: 4 },
  { type: 'water', name: 'Trial by Tide', need: 4 },
  { type: 'grass', name: 'Trial of the Grove', need: 4 },
  { type: 'electric', name: 'Trial by Lightning', need: 4 },
  { type: 'psychic', name: 'Trial of the Mind', need: 4 },
  { type: 'dark', name: 'Trial by Night', need: 4 },
];

const progressKey = (t: string) => `capq:${t}`;
const doneKey = (t: string) => `capq-done:${t}`;
export const capsuleCount = (run: Pick<RunState, 'itemCounters'>) => run.itemCounters?.capsules ?? 0;

export interface QuestView { type: TypeName; name: string; progress: number; need: number; done: boolean }
export function questViews(run: Pick<RunState, 'itemCounters'>): QuestView[] {
  return CAPSULE_QUESTS.map((q) => ({ ...q, progress: Math.min(q.need, run.itemCounters?.[progressKey(q.type)] ?? 0), done: (run.itemCounters?.[doneKey(q.type)] ?? 0) > 0 }));
}

/** After a won battle: each quest type present among the Pokémon that fought counts once. Returns the quests just completed. */
export function recordCapsuleProgress(content: Content, run: RunState, fought: readonly string[]): string[] {
  const types = new Set<string>();
  for (const uid of new Set(fought)) {
    const mon = run.party.find((m) => m.uid === uid);
    if (mon) for (const t of getSpecies(content, mon.speciesId).types) types.add(t);
  }
  const finished: string[] = [];
  for (const q of CAPSULE_QUESTS) {
    if (!types.has(q.type) || (run.itemCounters?.[doneKey(q.type)] ?? 0) > 0) continue;
    const next = (run.itemCounters?.[progressKey(q.type)] ?? 0) + 1;
    run.itemCounters = { ...run.itemCounters, [progressKey(q.type)]: next };
    if (next >= q.need) {
      run.itemCounters = { ...run.itemCounters, [doneKey(q.type)]: 1, capsules: capsuleCount(run) + 1 };
      finished.push(q.name);
    }
  }
  return finished;
}

/** The other ability slots this Pokémon could take (-1 = hidden). */
export function capsuleSlots(content: Content, mon: PokemonInstance): { slot: number; name: string }[] {
  const { normal, hidden } = getSpecies(content, mon.speciesId).abilities;
  const all = [...normal.map((name, slot) => ({ slot, name })), ...(hidden ? [{ slot: -1, name: hidden }] : [])];
  const current = abilityOf(content, mon);
  return all.filter((a, i) => a.name !== current && all.findIndex((b) => b.name === a.name) === i);
}

/** Spends one capsule to move the Pokémon to that ability slot. Returns the message. */
export function useCapsule(content: Content, run: RunState, uid: string, slot: number): string {
  const mon = run.party.find((m) => m.uid === uid);
  if (!mon) throw new Error('Choose a Pokémon');
  const free = freeAbilities(run.rules);
  if (!free && capsuleCount(run) <= 0) throw new Error('You have no Ability Capsule.');
  const choice = capsuleSlots(content, mon).find((a) => a.slot === slot);
  if (!choice) throw new Error('It cannot take that ability.');
  mon.abilitySlot = slot;
  if (!free) run.itemCounters = { ...run.itemCounters, capsules: capsuleCount(run) - 1 };
  return `${getSpecies(content, mon.speciesId).name} now has ${content.abilities.get(choice.name)?.name ?? choice.name}!`;
}
