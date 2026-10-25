// Loads every content JSON file, checks it against its schema, and checks
// cross-references (e.g. every learnset move exists). Throws a readable
// ContentError listing every problem found.

import { z } from 'zod';
import {
  AchievementSchema,
  RunPrepFileSchema,
  ArchetypeSchema,
  BalanceSchema,
  BossProfileSchema,
  BossTeamsFileSchema,
  ItemSchema,
  MoveSchema,
  RegionSchema,
  RewardSchema,
  RulesetSchema,
  ShopEntrySchema,
  SpeciesSchema,
  ThemesFileSchema,
  TrainerClassSchema,
  TypeChartSchema,
  type Content,
  type Requirement,
} from '../core/contentSchema';
import achievementsJson from './achievements.json';
import runPrepJson from './runPrep.json';
import archetypesJson from './archetypes.json';
import balanceJson from './balance.json';
import bossesJson from './bosses.json';
import bossTeamsJson from './bossTeams.json';
import itemsJson from './items.json';
import regionsJson from './regions.json';
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
  achievements: unknown;
  runPrep: unknown;
  rewards: unknown;
  items: unknown;
  trainers: unknown;
  bosses: unknown;
  bossTeams: unknown;
  regions: unknown;
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
  achievements: achievementsJson,
  runPrep: runPrepJson,
  rewards: rewardsJson,
  items: itemsJson,
  trainers: trainersJson,
  bosses: bossesJson,
  bossTeams: bossTeamsJson,
  regions: regionsJson,
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
  const achievements = parse(z.array(AchievementSchema), raw.achievements, 'achievements.json', problems);
  const runPrep = parse(RunPrepFileSchema, raw.runPrep, 'runPrep.json', problems);
  const rewards = parse(z.array(RewardSchema), raw.rewards, 'rewards.json', problems);
  const items = parse(z.array(ItemSchema), raw.items, 'items.json', problems);
  const trainers = parse(z.array(TrainerClassSchema), raw.trainers, 'trainers.json', problems);
  const bossProfiles = parse(z.array(BossProfileSchema), raw.bosses, 'bosses.json', problems);
  const bossTeams = parse(BossTeamsFileSchema, raw.bossTeams, 'bossTeams.json', problems);
  const regions = parse(z.array(RegionSchema), raw.regions, 'regions.json', problems);
  const themes = parse(ThemesFileSchema, raw.themes, 'themes.json', problems);
  const shop = parse(z.array(ShopEntrySchema), raw.shop, 'shop.json', problems);
  const ruleset = parse(RulesetSchema, raw.ruleset, 'ruleset.json', problems);
  const balance = parse(BalanceSchema, raw.balance, 'balance.json', problems);
  if (!species || !moves || !typeChart || !archetypes || !achievements || !runPrep || !rewards || !items || !trainers || !bossProfiles || !bossTeams || !regions || !themes || !shop || !ruleset || !balance) {
    throw new ContentError(problems);
  }

  const content: Content = {
    species: toMap(species, 'species.json', problems),
    moves: toMap(moves, 'moves.json', problems),
    typeChart,
    archetypes: toMap(archetypes, 'archetypes.json', problems),
    achievements: toMap(achievements, 'achievements.json', problems),
    starterPools: toMap(runPrep.starterPools, 'runPrep.json starterPools', problems),
    draftRules: toMap(runPrep.draftRules, 'runPrep.json draftRules', problems),
    prepTokens: toMap(runPrep.tokens, 'runPrep.json tokens', problems),
    licenses: toMap(runPrep.licenses, 'runPrep.json licenses', problems),
    rewards: toMap(rewards, 'rewards.json', problems),
    items: toMap(items, 'items.json', problems),
    trainers: toMap(trainers, 'trainers.json', problems),
    bosses: new Map(),
    regions: toMap(regions, 'regions.json', problems),
    campaigns: toMap(balance.campaigns, 'balance.json campaigns', problems),
    themes: toMap(themes.themes, 'themes.json', problems),
    arenas: themes.arenas,
    shop,
    ruleset,
    balance,
  };

  for (const [id, profile] of toMap(bossProfiles, 'bosses.json', problems)) {
    const teams = bossTeams[id];
    if (!teams) problems.push(`boss "${id}" has no teams in bossTeams.json (run npm run data:bosses)`);
    else content.bosses.set(id, { ...profile, teams });
  }
  for (const id of Object.keys(bossTeams)) if (!content.bosses.has(id)) problems.push(`bossTeams.json has teams for unknown boss "${id}"`);

  // Cross-reference checks.
  for (const s of content.species.values()) {
    for (const entry of s.learnset) {
      if (!content.moves.has(entry.move)) problems.push(`species "${s.id}" learns unknown move "${entry.move}"`);
    }
    for (const evo of s.evolutions) {
      if (!content.species.has(evo.to)) problems.push(`species "${s.id}" evolves into unknown species "${evo.to}"`);
      if (evo.item && content.items.get(evo.item)?.effect.kind !== 'evolve') problems.push(`species "${s.id}" evolves with "${evo.item}", which is not an evolution item`);
      if (evo.region && !content.regions.has(evo.region)) problems.push(`species "${s.id}" has an evolution for unknown region "${evo.region}"`);
    }
    if (s.evolvesFrom && !content.species.has(s.evolvesFrom)) problems.push(`species "${s.id}" evolves from unknown species "${s.evolvesFrom}"`);
    if (s.form && !content.species.has(s.form.base)) problems.push(`species "${s.id}" is a form of unknown species "${s.form.base}"`);
  }
  const usable = (id: string) => content.moves.get(id)?.supported === true;
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
  if (content.bosses.size === 0) problems.push('bosses.json has no bosses');
  for (const boss of content.bosses.values()) {
    for (const role of ['gym', 'elite', 'champion'] as const) {
      boss.teams[role].forEach((team, i) => {
        for (const m of team.members) {
          const where = `boss "${boss.id}" ${role} team ${i + 1}`;
          if (!content.species.has(m.speciesId)) problems.push(`${where} uses unknown species "${m.speciesId}"`);
          for (const move of m.moves) if (!content.moves.has(move)) problems.push(`${where} uses unknown move "${move}"`);
        }
      });
    }
  }
  for (const entry of shop) {
    if (!content.items.has(entry.item)) problems.push(`shop.json sells unknown item "${entry.item}"`);
  }
  const { stage } = balance;
  if (stage.minWidth > stage.maxWidth) problems.push('balance.stage.minWidth is larger than maxWidth');
  const regular = [...content.regions.values()].filter((r) => !r.grand);
  const grand = [...content.regions.values()].filter((r) => r.grand);
  if (grand.length > 1) problems.push('regions.json has more than one Grand Region');
  for (const c of content.campaigns.values()) {
    for (const [first, last] of c.trainerColumns) {
      if (first > last || last >= c.columns - 1) problems.push(`campaign "${c.id}" trainer column range [${first}, ${last}] must end before column ${c.columns - 1}`);
    }
    if (c.trainerColumns.length !== 2) problems.push(`campaign "${c.id}" needs exactly 2 trainer column ranges`);
    if (c.regularRegions > regular.length) problems.push(`campaign "${c.id}" wants ${c.regularRegions} regions but only ${regular.length} exist`);
    if (c.grandRegion && grand.length === 0) problems.push(`campaign "${c.id}" needs a Grand Region`);
  }
  if (!content.campaigns.has('full')) problems.push('balance.json has no "full" campaign');
  for (const r of content.regions.values()) {
    for (const id of [...r.gymLeaders, ...r.eliteFour, ...r.champions]) if (!content.bosses.has(id)) problems.push(`region "${r.id}" lists unknown boss "${id}"`);
  }
  if (!content.moves.has(ruleset.struggleMoveId)) problems.push(`ruleset struggleMoveId "${ruleset.struggleMoveId}" is not a move`);
  for (const id of balance.wildPool) {
    const s = content.species.get(id);
    if (!s) problems.push(`balance.json references unknown species "${id}"`);
    else if (!s.learnset.some((e) => usable(e.move))) problems.push(`balance.json species "${id}" has no supported moves`);
  }
  for (const m of content.moves.values()) {
    if (m.supported && m.category !== 'status' && m.power === null && !m.effects.fixedDamage) {
      problems.push(`damaging move "${m.id}" has no power`);
    }
  }
  // Permanent progression (achievements and trainer unlocks).
  const checkRequirement = (req: Requirement | null, where: string) => {
    if (req?.kind === 'achievement' && !content.achievements.has(req.id)) problems.push(`${where} requires unknown achievement "${req.id}"`);
  };
  for (const a of content.achievements.values()) {
    checkRequirement(a.requirement, `achievement "${a.id}"`);
    if ((a.chain === undefined) !== (a.tier === undefined)) problems.push(`achievement "${a.id}" needs both chain and tier, or neither`);
  }
  const chainTiers = new Set<string>();
  for (const a of content.achievements.values()) {
    if (!a.chain) continue;
    const key = `${a.chain}#${a.tier}`;
    if (chainTiers.has(key)) problems.push(`achievement chain "${a.chain}" has tier ${a.tier} twice`);
    chainTiers.add(key);
  }
  for (const a of content.archetypes.values()) {
    checkRequirement(a.unlock, `trainer "${a.id}"`);
    if (!a.unlockedByDefault && !a.unlock) problems.push(`trainer "${a.id}" is locked but has no unlock requirement`);
    for (const id of Object.keys(a.startingItems)) if (!content.items.has(id)) problems.push(`trainer "${a.id}" starts with unknown item "${id}"`);
    for (const m of a.modifiers) {
      if (m.kind === 'priceMultiplier') for (const id of m.items) if (!content.items.has(id)) problems.push(`trainer "${a.id}" changes the price of unknown item "${id}"`);
    }
  }
  if (![...content.archetypes.values()].some((a) => a.unlockedByDefault)) problems.push('archetypes.json has no starting trainer');
  // Run-Prep: starter pools, draft rules, preparation tokens and licenses.
  const checkLicense = (id: string | null, where: string) => {
    if (id !== null && !content.licenses.has(id)) problems.push(`${where} needs unknown license "${id}"`);
  };
  for (const pool of content.starterPools.values()) {
    checkRequirement(pool.unlock, `starter pool "${pool.id}"`);
    checkLicense(pool.license, `starter pool "${pool.id}"`);
    // Species that aren't in the game yet are allowed (they arrive with the full Pokédex); known ones must be first-stage.
    for (const id of pool.species) {
      const s = content.species.get(id);
      if (s && s.evolutionStage !== 1) problems.push(`starter pool "${pool.id}" lists "${id}", which is not a first-stage species`);
    }
  }
  const startingPools = [...content.starterPools.values()].filter((pool) => pool.unlockedByDefault);
  if (startingPools.length === 0) problems.push('runPrep.json has no starter pool unlocked from the start');
  for (const pool of startingPools) {
    const known = new Set(pool.species.filter((id) => content.species.has(id)));
    if (known.size < balance.starterChoices) problems.push(`starting starter pool "${pool.id}" has ${known.size} species but ${balance.starterChoices} are needed`);
  }
  if ([...content.draftRules.values()].filter((r) => r.kind === 'standard' && r.license === null).length !== 1) {
    problems.push('runPrep.json needs exactly one standard draft rule that needs no license');
  }
  for (const r of content.draftRules.values()) checkLicense(r.license, `draft rule "${r.id}"`);
  for (const t of content.prepTokens.values()) {
    checkRequirement(t.unlock, `preparation "${t.id}"`);
    checkLicense(t.license, `preparation "${t.id}"`);
    for (const id of Object.keys(t.items)) if (!content.items.has(id)) problems.push(`preparation "${t.id}" gives unknown item "${id}"`);
  }
  for (const l of content.licenses.values()) checkRequirement(l.unlock, `license "${l.id}"`);
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}

let cached: Content | null = null;
/** The game's content, validated once and then reused. */
export function getContent(): Content {
  cached ??= buildContent();
  return cached;
}
