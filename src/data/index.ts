// Loads every content JSON file, checks it against its schema, and checks
// cross-references (e.g. every learnset move exists). Throws a readable
// ContentError listing every problem found.

import { z } from 'zod';
import {
  ArchetypeSchema,
  BalanceSchema,
  MoveSchema,
  RewardSchema,
  RulesetSchema,
  SpeciesSchema,
  TypeChartSchema,
  type Content,
} from '../core/contentSchema';
import archetypesJson from './archetypes.json';
import balanceJson from './balance.json';
import movesJson from './moves.json';
import rewardsJson from './rewards.json';
import rulesetJson from './ruleset.json';
import speciesJson from './species.json';
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
  ruleset: unknown;
  balance: unknown;
}

export const RAW_CONTENT: RawContent = {
  species: speciesJson,
  moves: movesJson,
  typeChart: typeChartJson,
  archetypes: archetypesJson,
  rewards: rewardsJson,
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
  const ruleset = parse(RulesetSchema, raw.ruleset, 'ruleset.json', problems);
  const balance = parse(BalanceSchema, raw.balance, 'balance.json', problems);
  if (!species || !moves || !typeChart || !archetypes || !rewards || !ruleset || !balance) {
    throw new ContentError(problems);
  }

  const content: Content = {
    species: toMap(species, 'species.json', problems),
    moves: toMap(moves, 'moves.json', problems),
    typeChart,
    archetypes: toMap(archetypes, 'archetypes.json', problems),
    rewards: toMap(rewards, 'rewards.json', problems),
    ruleset,
    balance,
  };

  // Cross-reference checks.
  for (const s of content.species.values()) {
    for (const entry of s.learnset) {
      if (!content.moves.has(entry.move)) problems.push(`species "${s.id}" learns unknown move "${entry.move}"`);
    }
    if (!s.learnset.some((e) => e.level <= 1)) problems.push(`species "${s.id}" has no level-1 move`);
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
