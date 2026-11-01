// Legacy Pokémon, Legacy Descendants and Legacy Inheritance Choices (APPROVED.md §3): a run's Ace leaves a small legacy
// the player picks from a short list, and the next run starts with it. Nothing passes whole stats or a whole team:
// an egg, one keepsake, one signature move on the descendant, or the ancestor's nature on the descendant (±10%).

import type { Content } from '../contentSchema';
import { layEgg } from '../eggs';
import { grantKeepsake, keepsakeName, keepsakeValid } from './keepsakes';
import { legacyAce } from '../legacyRuns';
import { hashSeed, Rng } from '../rng';
import type { LegacyRun, Profile, RunState } from '../state';
import { emit } from '../story/record';
import { MEMORIES, type Heirloom, type HeirloomOption } from './schema';

const species = (content: Content, id: string) => content.species.get(id)?.name ?? id;
const moveName = (content: Content, id: string) => content.moves.get(id)?.name ?? id;

/** The options a record's Ace can pass on (an egg is always one of them). */
export function heirloomOptions(content: Content, record: LegacyRun): HeirloomOption[] {
  const ace = legacyAce(record);
  if (!ace) return [];
  const name = species(content, ace.speciesId);
  const out: HeirloomOption[] = [{ id: 'egg', label: `A ${name} Egg`, text: `A Legacy Egg of ${name}'s line hatches in a couple of stages.` }];
  const power = (id: string) => content.moves.get(id)?.power ?? 0;
  const signature = [...ace.moves].filter((id) => content.moves.get(id)?.supported === true).sort((a, b) => power(b) - power(a) || a.localeCompare(b))[0];
  if (signature) out.push({ id: 'move', label: `${moveName(content, signature)} lineage`, text: `The Legacy Egg hatches already knowing ${moveName(content, signature)}.`, moveId: signature });
  if (ace.nature) out.push({ id: 'trait', label: `${ace.nature[0]!.toUpperCase()}${ace.nature.slice(1)} nature`, text: `The Legacy Egg hatches with ${name}'s ${ace.nature} nature.`, nature: ace.nature });
  const item = ace.held.find((id) => keepsakeValid(content, id)) ?? MEMORIES.heirloom.itemFallback;
  if (keepsakeValid(content, item)) out.push({ id: 'item', label: keepsakeName(content, item), text: `${name}'s keepsake joins your bag at the start.`, itemId: item });
  return out;
}

/** Adds an heirloom for a finished run's Ace (mutates `profile`). Only real runs whose Ace reached the minimum level; the oldest unchosen ones drop. */
export function recordHeirloom(content: Content, profile: Profile, record: LegacyRun | null): Heirloom | null {
  if (!record || record.source !== 'run') return null;
  const ace = legacyAce(record);
  if (!ace || ace.level < MEMORIES.heirloom.minLevel) return null;
  profile.memories ??= { heirlooms: [], claimed: [], cameos: [] };
  if (profile.memories.heirlooms.some((h) => h.runId === record.runId)) return null;
  const options = heirloomOptions(content, record);
  if (options.length === 0) return null;
  const heirloom: Heirloom = { runId: record.runId, speciesId: ace.speciesId, name: species(content, ace.speciesId), level: ace.level, shiny: ace.shiny, trainer: content.archetypes.get(record.archetypeId)?.name ?? record.archetypeId, options, chosen: null, spent: false };
  const waiting = profile.memories.heirlooms.filter((h) => !h.spent);
  const keep = waiting.slice(0, MEMORIES.heirloom.keep - 1);
  profile.memories.heirlooms = [heirloom, ...keep, ...profile.memories.heirlooms.filter((h) => h.spent)];
  return heirloom;
}

/** The player's pick for one heirloom (a copy of the profile; picking again changes it until a run starts with it). */
export function chooseHeirloom(profile: Profile, runId: string, kind: Heirloom['options'][number]['id']): Profile {
  const next = structuredClone(profile);
  const h = next.memories.heirlooms.find((x) => x.runId === runId);
  if (!h || h.spent || !h.options.some((o) => o.id === kind)) return profile;
  h.chosen = kind;
  return next;
}

/** The chosen heirloom a new run will start with (the newest pick), or null. */
export function pendingHeirloom(profile: Pick<Profile, 'memories'>): Heirloom | null {
  return profile.memories?.heirlooms.find((h) => h.chosen && !h.spent) ?? null;
}

/**
 * Hands the pending heirloom to a new run (mutates `run`). Returns the heirloom's runId and the words for the briefing,
 * or null. The caller marks it spent in the profile (spendHeirloom) so a reload never hands it over twice.
 */
export function applyHeirloom(content: Content, run: RunState, profile: Pick<Profile, 'memories'>): { runId: string; text: string } | null {
  const h = pendingHeirloom(profile);
  const option = h?.options.find((o) => o.id === h.chosen);
  if (!h || !option) return null;
  if (option.id === 'item' && option.itemId && grantKeepsake(content, run, option.itemId)) {
    const text = `${h.name}'s keepsake, ${keepsakeName(content, option.itemId)}, was left for you.`;
    emit(content, run, 'storyMoment', { actors: [], data: { def: 'heirloom', suppressed: false }, importance: 60, text });
    return { runId: h.runId, text };
  }
  // F118: the Legacy Egg is only handed over at a Daycare or Ranch stop (the `legacyEgg` effect), so it waits in the run's digest.
  const trait = option.id === 'move' ? `knows ${moveName(content, option.moveId ?? '')}` : option.id === 'trait' ? `has a ${option.nature} nature` : 'carries the family look';
  run.past ??= { ghosts: [], gauntlet: [], keepsakes: [], friends: [], used: [] };
  run.past.legacyEgg = { runId: h.runId, speciesId: h.speciesId, name: h.name, kind: option.id === 'move' ? 'move' : option.id === 'trait' ? 'trait' : 'egg', trait, ...(option.moveId ? { moveId: option.moveId } : {}), ...(option.nature ? { nature: option.nature } : {}) };
  const text = `${h.name}'s Legacy Egg waits for you at a Daycare or Ranch: its descendant ${trait}.`;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'heirloom', suppressed: false }, importance: 60, text });
  return { runId: h.runId, text };
}

/** True while a Legacy Egg is waiting for a Daycare or Ranch. */
export function legacyEggWaiting(run: Pick<RunState, 'past'>): boolean {
  return !!run.past?.legacyEgg;
}

/** Hands over the waiting Legacy Egg (mutates `run`); returns the words, or null when none waits or the party and egg slots are full. */
export function deliverLegacyEgg(content: Content, run: RunState): string | null {
  const w = run.past?.legacyEgg;
  if (!w || !run.past) return null;
  const rng = new Rng(hashSeed(`${run.seed}::heirloom::${w.runId}`));
  const egg = layEgg(content, run, w.speciesId, { level: MEMORIES.heirloom.eggLevel, left: MEMORIES.heirloom.eggStages, unit: 'stage', source: 'Legacy Egg' }, rng);
  egg.lineage = { ancestor: w.name, runId: w.runId, trait: w.trait, ...(w.kind === 'move' && w.moveId ? { moveId: w.moveId } : {}), ...(w.kind === 'trait' && w.nature ? { nature: w.nature } : {}) };
  run.past.legacyEgg = null;
  const text = `${w.name}'s Legacy Egg joined the party: its descendant ${w.trait}.`;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'heirloom-egg', suppressed: false }, importance: 70, text });
  return text;
}

/** Marks a heirloom as handed over (a copy of the profile). */
export function spendHeirloom(profile: Profile, runId: string): Profile {
  const next = structuredClone(profile);
  const h = next.memories.heirlooms.find((x) => x.runId === runId);
  if (h) h.spent = true;
  return next;
}
