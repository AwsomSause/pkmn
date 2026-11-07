// Loads and checks the Overhaul content pack (src/data/overhaul/). Slice 1: nothing in the game
// calls this yet; the unit tests do, so a broken import fails `npm run check`.
//
// The 16 catalogs (about 0.8 MB) load with this module. The 4 line files (about 6 MB) are only
// loaded on request through loadOverhaulLines(), so Vite puts each in its own chunk and they
// never weigh on the first page load.

import {
  OVERHAUL_CATALOG_SCHEMAS,
  OVERHAUL_LINE_SCHEMAS,
  type OverhaulCatalogName,
  type OverhaulCatalogs,
  type OverhaulLineName,
  type OverhaulLines,
} from './schema';
import milestones from '../../data/overhaul/milestones.json';
import titles from '../../data/overhaul/titles.json';
import personalities from '../../data/overhaul/personalities.json';
import quirks from '../../data/overhaul/quirks.json';
import relationshipTypes from '../../data/overhaul/relationship_types.json';
import teamChemistry from '../../data/overhaul/team_chemistry.json';
import battleEnvironments from '../../data/overhaul/battle_environments.json';
import battlefieldConditions from '../../data/overhaul/battlefield_conditions.json';
import growthPaths from '../../data/overhaul/growth_paths.json';
import moveMastery from '../../data/overhaul/move_mastery_ideas.json';
import runTitles from '../../data/overhaul/run_titles.json';
import trainerArchetypes from '../../data/overhaul/trainer_archetypes.json';
import majorTrainers from '../../data/overhaul/major_trainers.json';
import itemSynergies from '../../data/overhaul/item_synergies.json';
import signatureMoments from '../../data/overhaul/signature_moments_library.json';
import eventChains from '../../data/overhaul/event_chains.json';

export const RAW_OVERHAUL_CATALOGS: Record<OverhaulCatalogName, unknown> = {
  milestones,
  titles,
  personalities,
  quirks,
  relationship_types: relationshipTypes,
  team_chemistry: teamChemistry,
  battle_environments: battleEnvironments,
  battlefield_conditions: battlefieldConditions,
  growth_paths: growthPaths,
  move_mastery_ideas: moveMastery,
  run_titles: runTitles,
  trainer_archetypes: trainerArchetypes,
  major_trainers: majorTrainers,
  item_synergies: itemSynergies,
  signature_moments_library: signatureMoments,
  event_chains: eventChains,
};

export class OverhaulDataError extends Error {
  constructor(readonly problems: string[]) {
    super(`Overhaul pack data has ${problems.length} problem(s):\n- ${problems.slice(0, 40).join('\n- ')}`);
    this.name = 'OverhaulDataError';
  }
}

/** Parses every catalog against its schema, then checks the links between them. Throws on any problem. */
export function parseOverhaulCatalogs(raw: Record<OverhaulCatalogName, unknown> = RAW_OVERHAUL_CATALOGS): OverhaulCatalogs {
  const problems: string[] = [];
  const out: Partial<Record<OverhaulCatalogName, unknown>> = {};
  for (const name of Object.keys(OVERHAUL_CATALOG_SCHEMAS) as OverhaulCatalogName[]) {
    const result = OVERHAUL_CATALOG_SCHEMAS[name].safeParse(raw[name]);
    if (result.success) out[name] = result.data;
    else for (const issue of result.error.issues.slice(0, 10)) problems.push(`${name}: ${issue.path.join('.')} ${issue.message}`);
  }
  if (problems.length) throw new OverhaulDataError(problems);
  const catalogs = out as OverhaulCatalogs;
  problems.push(...crossCheckCatalogs(catalogs));
  if (problems.length) throw new OverhaulDataError(problems);
  return catalogs;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/** Links between catalogs: unique ids, title requirements, unique event flags, tier ranges. */
export function crossCheckCatalogs(c: OverhaulCatalogs): string[] {
  const problems: string[] = [];
  const withIds: OverhaulCatalogName[] = ['milestones', 'titles', 'personalities', 'quirks', 'relationship_types', 'team_chemistry', 'battle_environments', 'battlefield_conditions', 'growth_paths', 'run_titles', 'trainer_archetypes', 'major_trainers', 'item_synergies', 'signature_moments_library', 'event_chains'];
  for (const name of withIds) {
    const ids = (c[name].entries as { id: string }[]).map((e) => e.id);
    for (const d of duplicates(ids)) problems.push(`${name}: duplicate id "${d}"`);
  }
  for (const d of duplicates(c.move_mastery_ideas.entries.map((m) => m.move))) problems.push(`move_mastery_ideas: duplicate move "${d}"`);

  const milestoneIds = new Set(c.milestones.entries.map((m) => m.id));
  for (const t of c.titles.entries) {
    for (const part of t.requires.split('+')) {
      const m = /^(?:\d+x)?(.+)$/.exec(part.trim());
      if (!m || !milestoneIds.has(m[1]!)) problems.push(`titles: "${t.id}" needs unknown milestone "${part.trim()}"`);
    }
  }

  const flags = c.event_chains.entries.flatMap((ch) => ch.stages.flatMap((s) => s.options.flatMap((o) => o.sets)));
  for (const d of duplicates(flags)) problems.push(`event_chains: flag "${d}" is set by two options`);
  for (const ch of c.event_chains.entries) {
    if ((ch.rarity === 'legendary') !== (ch.archetype !== undefined)) problems.push(`event_chains: "${ch.id}" archetype must be set exactly for legendary chains`);
    if ((ch.rarity === 'legendary') !== (ch.weight === null)) problems.push(`event_chains: "${ch.id}" weight must be null exactly for legendary chains`);
    for (const s of ch.stages) if (s.minNodesAfterPrevious > s.maxNodesAfterPrevious) problems.push(`event_chains: "${s.id}" min nodes after max`);
    ch.stages.forEach((s, si) => {
      const earlier = new Set(ch.stages.slice(0, si).flatMap((x) => x.options.flatMap((o) => o.sets)));
      for (const o of s.options) if (o.needs !== undefined && !earlier.has(o.needs)) problems.push(`event_chains: "${o.id}" needs "${o.needs}", which no earlier stage sets`);
      if (s.options.every((o) => o.needs !== undefined)) problems.push(`event_chains: "${s.id}" has no option open to everyone`);
    });
  }

  for (const a of c.trainer_archetypes.entries) if (a.tierMin > a.tierMax) problems.push(`trainer_archetypes: "${a.id}" tierMin > tierMax`);
  for (const t of c.run_titles.entries) for (const r of t.requires) if (['noun', 'adj', 'place', 'weather'].includes(r) && !c.run_titles.pools[r]) problems.push(`run_titles: "${t.id}" needs missing pool "${r}"`);
  for (const s of c.item_synergies.entries) if (s.usable !== (s.itemId !== null && (s.partnerId !== null || ['type', 'role'].includes(s.partner.kind)))) problems.push(`item_synergies: "${s.id}" usable flag does not match its ids`);
  return problems;
}

let cached: OverhaulCatalogs | null = null;
/** The checked catalogs, parsed once. */
export function overhaulCatalogs(): OverhaulCatalogs {
  return (cached ??= parseOverhaulCatalogs());
}

const LINE_LOADERS: { [K in OverhaulLineName]: () => Promise<{ default: unknown }> } = {
  archetype_lines: () => import('../../data/overhaul/lines/archetype_lines.json'),
  major_trainer_lines: () => import('../../data/overhaul/lines/major_trainer_lines.json'),
  contextual_reactions: () => import('../../data/overhaul/lines/contextual_reactions.json'),
  species_signature_moments: () => import('../../data/overhaul/lines/species_signature_moments.json'),
};

/** Loads and checks one generated line file on demand (each is its own chunk in the build). */
export async function loadOverhaulLines<K extends OverhaulLineName>(name: K): Promise<OverhaulLines<K>> {
  const raw = (await LINE_LOADERS[name]()).default;
  const result = OVERHAUL_LINE_SCHEMAS[name].safeParse(raw);
  if (!result.success) throw new OverhaulDataError(result.error.issues.slice(0, 20).map((i) => `${name}: ${i.path.join('.')} ${i.message}`));
  return result.data as OverhaulLines<K>;
}
