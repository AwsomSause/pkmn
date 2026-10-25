// Loads every content JSON file, checks it against its schema, and checks
// cross-references (e.g. every learnset move exists). Throws a readable
// ContentError listing every problem found.

import { z } from 'zod';
import {
  ArchetypeSchema,
  BalanceSchema,
  GymLeaderSchema,
  ItemSchema,
  MoveSchema,
  RewardSchema,
  RulesetSchema,
  ShopEntrySchema,
  SpeciesSchema,
  ThemesFileSchema,
  TrainerClassSchema,
  TypeChartSchema,
  type Content,
} from '../core/contentSchema';
import archetypesJson from './archetypes.json';
import balanceJson from './balance.json';
import gymLeadersJson from './gymLeaders.json';
import itemsJson from './items.json';
import movesJson from './moves.json';
import rewardsJson from './rewards.json';
import rulesetJson from './ruleset.json';
import shopJson from './shop.json';
import speciesJson from './species.json';
import themesJson from './themes.json';
import trainersJson from './trainers.json';
import typeChartJson from './typeChart.json';

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Game data has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

export interface RawContent {
  species: unknown;
  moves: unknown;
  typeChart: unknown;
  archetypes: unknown;
  rewards: unknown;
  items: unknown;
  trainers: unknown;
  gymLeaders: unknown;
  themes: unknown;
  shop: unknown;
  ruleset: unknown;
  balance: unknown;
}

export const RAW_CONTENT: RawContent = {
  species: speciesJson,
  moves: movesJson,
  typeChart: typeChartJson,
  archetypes: archetypesJson,
  rewards: rewardsJson,
  items: itemsJson,
  trainers: trainersJson,
  gymLeaders: gymLeadersJson,
  themes: themesJson,
  shop: shopJson,
  ruleset: rulesetJson,
  balance: balanceJson,
};

function parse<T>(schema: z.ZodType<T>, value: unknown, label: string, problems: string[]): T | null {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    problems.push(`${label} ${issue.path.join('.')}: ${issue.message}`);
  }
  return null;
}

function toMap<T extends { id: string }>(items: T[], label: string, problems: string[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) problems.push(`${label}: duplicate id "${item.id}"`);
    map.set(item.id, item);
  }
  return map;
}

export function buildContent(raw: RawContent = RAW_CONTENT): Content {
  const problems: string[] = [];
  const species = parse(z.array(SpeciesSchema), raw.species, 'species.json', problems);
  const moves = parse(z.array(MoveSchema), raw.moves, 'moves.json', problems);
  const typeChart = parse(TypeChartSchema, raw.typeChart, 'typeChart.json', problems);
  const archetypes = parse(z.array(ArchetypeSchema), raw.archetypes, 'archetypes.json', problems);
  const rewards = parse(z.array(RewardSchema), raw.rewards, 'rewards.json', problems);
  const items = parse(z.array(ItemSchema), raw.items, 'items.json', problems);
  const trainers = parse(z.array(TrainerClassSchema), raw.trainers, 'trainers.json', problems);
  const gymLeaders = parse(z.array(GymLeaderSchema), raw.gymLeaders, 'gymLeaders.json', problems);
  const themes = parse(ThemesFileSchema, raw.themes, 'themes.json', problems);
  const shop = parse(z.array(ShopEntrySchema), raw.shop, 'shop.json', problems);
  const ruleset = parse(RulesetSchema, raw.ruleset, 'ruleset.json', problems);
  const balance = parse(BalanceSchema, raw.balance, 'balance.json', problems);
  if (!species || !moves || !typeChart || !archetypes || !rewards || !items || !trainers || !gymLeaders || !themes || !shop || !ruleset || !balance) {
    throw new ContentError(problems);
  }

  const content: Content = {
    species: toMap(species, 'species.json', problems),
    moves: toMap(moves, 'moves.json', problems),
    typeChart,
    archetypes: toMap(archetypes, 'archetypes.json', problems),
    rewards: toMap(rewards, 'rewards.json', problems),
    items: toMap(items, 'items.json', problems),
    trainers: toMap(trainers, 'trainers.json', problems),
    gymLeaders: toMap(gymLeaders, 'gymLeaders.json', problems),
    themes: toMap(themes.themes, 'themes.json', problems),
    arenas: themes.arenas,
    shop,
    ruleset,
    balance,
  };

  // Cross-reference checks.
  for (const s of content.species.values()) {
    for (const entry of s.learnset) {
      if (!content.moves.has(entry.move)) problems.push(`species "${s.id}" learns unknown move "${entry.move}"`);
    }
    if (!s.learnset.some((e) => e.level <= 1)) problems.push(`species "${s.id}" has no level-1 move`);
    for (const evo of s.evolutions) {
      if (!content.species.has(evo.to)) problems.push(`species "${s.id}" evolves into unknown species "${evo.to}"`);
    }
  }
  for (const r of content.rewards.values()) {
    if (r.effect.kind === 'addItem' && !content.items.has(r.effect.item)) problems.push(`reward "${r.id}" gives unknown item "${r.effect.item}"`);
  }
  for (const id of Object.keys(balance.startingItems)) {
    if (!content.items.has(id)) problems.push(`balance.startingItems has unknown item "${id}"`);
  }
  const pairs = new Set<string>();
  const themeNames = new Set<string>();
  for (const t of content.themes.values()) {
    const [a, b] = t.types;
    if (a === b) problems.push(`theme "${t.id}" uses the same type twice`);
    const key = [a, b].sort().join('/');
    if (pairs.has(key)) problems.push(`theme "${t.id}" repeats the type pair ${key}`);
    pairs.add(key);
    if (themeNames.has(t.name)) problems.push(`theme name "${t.name}" is used twice`);
    themeNames.add(t.name);
  }
  if (content.gymLeaders.size === 0) problems.push('gymLeaders.json has no gym leaders');
  for (const entry of shop) {
    if (!content.items.has(entry.item)) problems.push(`shop.json sells unknown item "${entry.item}"`);
  }
  const { stage } = balance;
  if (stage.minWidth > stage.maxWidth) problems.push('balance.stage.minWidth is larger than maxWidth');
  for (const [first, last] of stage.trainerColumns) {
    if (first > last || last >= stage.columns - 1) problems.push(`balance.stage.trainerColumns range [${first}, ${last}] must end before column ${stage.columns - 1}`);
  }
  if (!content.moves.has(ruleset.struggleMoveId)) problems.push(`ruleset struggleMoveId "${ruleset.struggleMoveId}" is not a move`);
  for (const id of [...balance.starterPool, ...balance.wildPool]) {
    if (!content.species.has(id)) problems.push(`balance.json references unknown species "${id}"`);
  }
  for (const id of balance.starterPool) {
    const s = content.species.get(id);
    if (s && s.evolutionStage !== 1) problems.push(`starter "${id}" is not a first-stage species`);
  }
  for (const m of content.moves.values()) {
    if (m.category !== 'status' && m.power === null && !m.effects.fixedDamage) {
      problems.push(`damaging move "${m.id}" has no power`);
    }
  }
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}

let cached: Content | null = null;
/** The game's content, validated once and then reused. */
export function getContent(): Content {
  cached ??= buildContent();
  return cached;
}
