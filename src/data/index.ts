// Loads every content JSON file, checks it against its schema, and checks
// cross-references (e.g. every learnset move exists). Throws a readable
// ContentError listing every problem found.

import { z } from 'zod';
import {
  AbilitySchema,
  AchievementSchema,
  TrainerQuestsFileSchema,
  GameEventsFileSchema,
  ATTRIBUTE_KEYS,
  EventsFileSchema,
  RunPrepFileSchema,
  ArchetypeSchema,
  BalanceSchema,
  ZMoveDataSchema,
  MaxMoveDataSchema,
  BossProfileSchema,
  BossTeamsFileSchema,
  CatalogEntrySchema,
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
  type CatalogEntry,
  type Content,
  type Requirement,
  type Reward,
} from '../core/contentSchema';
import abilitiesJson from './abilities.json';
import { HISTORY_MEMORIES, HYPER_EFFECTS } from '../core/story/hyper';
import { MOMENT_EFFECTS } from '../core/story/moments';
import { STORY_TRIGGERS, StoryConfigSchema } from '../core/story/schema';
import achievementsJson from './achievements.json';
import trainerQuestsJson from './trainerQuests.json';
import gameEventsJson from './gameEvents.json';
import runPrepJson from './runPrep.json';
import archetypesJson from './archetypes.json';
import balanceJson from './balance.json';
import bossesJson from './bosses.json';
import bossTeamsJson from './bossTeams.json';
import itemsJson from './items.json';
import itemCatalogJson from './itemCatalog.json';
import learnablesJson from './learnables.json';
import megaStonesJson from './megaStones.json';
import zMovesJson from './zMoves.json';
import maxMovesJson from './maxMoves.json';
import regionsJson from './regions.json';
import movesJson from './moves.json';
import rewardsJson from './rewards.json';
import rulesetJson from './ruleset.json';
import shopJson from './shop.json';
import speciesJson from './species.json';
import customSpeciesJson from './customSpecies.json';
import customEvolutionsJson from './customEvolutions.json';
import themesJson from './themes.json';
import trainersJson from './trainers.json';
import typeChartJson from './typeChart.json';
import storyJson from './story.json';
import raidsJson from './raids.json';
import totemsJson from './totems.json';
import expeditionsJson from './expeditions.json';
import { ExpeditionFileSchema } from '../core/expedition/schema';
import minigamesJson from './minigames.json';
import { MinigameFileSchema } from '../core/minigame/schema';
import { MINIGAMES } from '../core/minigame/games';
import { TotemFileSchema } from '../core/totem/schema';
import { RaidFileSchema } from '../core/raid/schema';
import eventsJson from './events.json';
import { isGiftable } from '../core/events';

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Game data has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

export interface RawContent {
  species: unknown;
  moves: unknown;
  abilities: unknown;
  typeChart: unknown;
  archetypes: unknown;
  achievements: unknown;
  trainerQuests: unknown;
  gameEvents: unknown;
  runPrep: unknown;
  rewards: unknown;
  items: unknown;
  itemCatalog: unknown;
  learnables: unknown;
  trainers: unknown;
  bosses: unknown;
  bossTeams: unknown;
  regions: unknown;
  themes: unknown;
  shop: unknown;
  ruleset: unknown;
  balance: unknown;
  story: unknown;
  raids: unknown;
  events: unknown;
  totems: unknown;
  expeditions: unknown;
  minigames: unknown;
  zMoves: unknown;
  maxMoves: unknown;
}

/**
 * Every species: PokeAPI's (species.json, npm run data:species) plus the
 * director's custom forms (customSpecies.json, npm run data:custom). New
 * evolutions of existing species (Raticate -> Bruticate) live in
 * customEvolutions.json so re-running either tool keeps them.
 */
export function mergeSpecies(base: unknown[], custom: unknown[], evolutions: { from: string; to: string }[]): unknown[] {
  const extra = new Map<string, object[]>();
  for (const { from, ...evo } of evolutions) extra.set(from, [...(extra.get(from) ?? []), evo]);
  const merged = base.map((s) => {
    const entry = s as { id: string; evolutions?: object[] };
    const add = extra.get(entry.id);
    return add ? { ...entry, evolutions: [...(entry.evolutions ?? []), ...add] } : entry;
  });
  return [...merged, ...custom];
}

export const RAW_CONTENT: RawContent = {
  species: mergeSpecies(speciesJson, customSpeciesJson, customEvolutionsJson),
  moves: movesJson,
  abilities: abilitiesJson,
  typeChart: typeChartJson,
  archetypes: archetypesJson,
  achievements: achievementsJson,
  trainerQuests: trainerQuestsJson,
  gameEvents: gameEventsJson,
  runPrep: runPrepJson,
  // Mega Stones are generated (npm run data:megas) and kept in their own file.
  rewards: [...rewardsJson, ...megaStonesJson.rewards],
  items: [...itemsJson, ...megaStonesJson.items],
  itemCatalog: itemCatalogJson,
  learnables: learnablesJson,
  trainers: trainersJson,
  bosses: bossesJson,
  bossTeams: bossTeamsJson,
  regions: regionsJson,
  themes: themesJson,
  shop: shopJson,
  ruleset: rulesetJson,
  balance: balanceJson,
  story: storyJson,
  raids: raidsJson,
  events: eventsJson,
  totems: totemsJson,
  expeditions: expeditionsJson,
  minigames: minigamesJson,
  // Generated: npm run data:zmoves.
  zMoves: zMovesJson,
  // Generated: npm run data:maxmoves.
  maxMoves: maxMovesJson,
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
  const abilities = parse(z.array(AbilitySchema), raw.abilities, 'abilities.json', problems);
  const typeChart = parse(TypeChartSchema, raw.typeChart, 'typeChart.json', problems);
  const archetypes = parse(z.array(ArchetypeSchema), raw.archetypes, 'archetypes.json', problems);
  const achievements = parse(z.array(AchievementSchema), raw.achievements, 'achievements.json', problems);
  const quests = parse(TrainerQuestsFileSchema, raw.trainerQuests, 'trainerQuests.json', problems);
  const gameEventsFile = parse(GameEventsFileSchema, raw.gameEvents, 'gameEvents.json', problems);
  const runPrep = parse(RunPrepFileSchema, raw.runPrep, 'runPrep.json', problems);
  const rewards = parse(z.array(RewardSchema), raw.rewards, 'rewards.json', problems);
  const items = parse(z.array(ItemSchema), raw.items, 'items.json', problems);
  const itemCatalog = parse(z.array(CatalogEntrySchema), raw.itemCatalog, 'itemCatalog.json', problems);
  const learnables = parse(z.record(z.string(), z.object({ egg: z.array(z.string()), other: z.array(z.string()) })), raw.learnables, 'learnables.json', problems);
  const trainers = parse(z.array(TrainerClassSchema), raw.trainers, 'trainers.json', problems);
  const bossProfiles = parse(z.array(BossProfileSchema), raw.bosses, 'bosses.json', problems);
  const bossTeams = parse(BossTeamsFileSchema, raw.bossTeams, 'bossTeams.json', problems);
  const regions = parse(z.array(RegionSchema), raw.regions, 'regions.json', problems);
  const themes = parse(ThemesFileSchema, raw.themes, 'themes.json', problems);
  const shop = parse(z.array(ShopEntrySchema), raw.shop, 'shop.json', problems);
  const ruleset = parse(RulesetSchema, raw.ruleset, 'ruleset.json', problems);
  const balance = parse(BalanceSchema, raw.balance, 'balance.json', problems);
  const story = parse(StoryConfigSchema, raw.story, 'story.json', problems);
  const raids = parse(RaidFileSchema, raw.raids, 'raids.json', problems);
  const totems = parse(TotemFileSchema, raw.totems, 'totems.json', problems);
  const eventsFile = parse(EventsFileSchema, raw.events, 'events.json', problems);
  const expeditions = parse(ExpeditionFileSchema, raw.expeditions, 'expeditions.json', problems);
  const minigames = parse(MinigameFileSchema, raw.minigames, 'minigames.json', problems);
  const zMoves = parse(ZMoveDataSchema, raw.zMoves, 'zMoves.json', problems);
  const maxMoves = parse(MaxMoveDataSchema, raw.maxMoves, 'maxMoves.json', problems);
  if (!quests || !gameEventsFile || !eventsFile || !story || !raids || !totems || !expeditions || !minigames || !zMoves || !maxMoves || !species || !moves || !abilities || !typeChart || !archetypes || !achievements || !runPrep || !rewards || !items || !itemCatalog || !learnables || !trainers || !bossProfiles || !bossTeams || !regions || !themes || !shop || !ruleset || !balance) {
    throw new ContentError(problems);
  }

  const content: Content = {
    species: toMap(species, 'species.json', problems),
    moves: toMap(moves, 'moves.json', problems),
    abilities: toMap(abilities, 'abilities.json', problems),
    typeChart,
    archetypes: toMap(archetypes, 'archetypes.json', problems),
    achievements: toMap(achievements, 'achievements.json', problems),
    questLines: new Map(quests.lines.map((l) => [l.trainerId, l])),
    runQuests: toMap(quests.runQuests, 'trainerQuests.json runQuests', problems),
    gameEvents: toMap(gameEventsFile.events, 'gameEvents.json', problems),
    starterPools: toMap(runPrep.starterPools, 'runPrep.json starterPools', problems),
    draftRules: toMap(runPrep.draftRules, 'runPrep.json draftRules', problems),
    prepTokens: toMap(runPrep.tokens, 'runPrep.json tokens', problems),
    licenses: toMap(runPrep.licenses, 'runPrep.json licenses', problems),
    rewards: toMap(rewards, 'rewards.json', problems),
    items: toMap(items, 'items.json', problems),
    catalog: toMap(itemCatalog, 'itemCatalog.json', problems),
    learnables: new Map(Object.entries(learnables).map(([id, l]) => [id, [...new Set([...l.egg, ...l.other])]])),
    eggMoves: new Map(Object.entries(learnables).map(([id, l]) => [id, l.egg])),
    trainers: toMap(trainers, 'trainers.json', problems),
    bosses: new Map(),
    regions: toMap(regions, 'regions.json', problems),
    campaigns: toMap(balance.campaigns, 'balance.json campaigns', problems),
    themes: toMap(themes.themes, 'themes.json', problems),
    arenas: themes.arenas,
    shop,
    ruleset,
    balance,
    story,
    raids,
    events: toMap(eventsFile.events, 'events.json', problems),
    totems,
    expeditions,
    minigames,
    zMoves,
    maxMoves,
  };

  addCatalog(content, problems);

  for (const [id, profile] of toMap(bossProfiles, 'bosses.json', problems)) {
    const teams = bossTeams[id];
    if (!teams) problems.push(`boss "${id}" has no teams in bossTeams.json (run npm run data:bosses)`);
    else content.bosses.set(id, { ...profile, teams });
  }
  for (const id of Object.keys(bossTeams)) if (!content.bosses.has(id)) problems.push(`bossTeams.json has teams for unknown boss "${id}"`);

  // Species without abilities of their own (the custom Delta, Z and Spooky forms, Bruticate) use
  // those of the species they are a form of, or else evolve from.
  for (const s of content.species.values()) {
    const base = content.species.get(s.form?.base ?? s.evolvesFrom ?? '');
    if (base && s.abilities.normal.length === 0 && s.abilities.hidden === null) s.abilities = base.abilities;
  }

  // Cross-reference checks.
  for (const s of content.species.values()) {
    for (const a of [...s.abilities.normal, ...(s.abilities.hidden ? [s.abilities.hidden] : [])]) {
      if (!content.abilities.has(a)) problems.push(`species "${s.id}" has unknown ability "${a}"`);
    }
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
  // Raids: every boss species, reward item and phase must exist (the boss must be able to fight).
  for (const raid of raids.raids) {
    for (const id of raid.species) if (!content.species.has(id)) problems.push(`raids.json "${raid.id}" has unknown species "${id}"`);
    for (const r of raid.rewards.items) if (!content.items.has(r.item)) problems.push(`raids.json "${raid.id}" gives unknown item "${r.item}"`);
    if (raid.shield && raid.shield.at.length * raid.shield.points >= 0.9) problems.push(`raids.json "${raid.id}" shields are too big`);
    if (raid.phases.some((p, i) => i > 0 && p.atHp >= raid.phases[i - 1]!.atHp)) problems.push(`raids.json "${raid.id}" phases must go down in HP`);
  }
  for (const t of totems.totems) {
    for (const id of [...t.species, t.ally?.species, t.rewards.rareJoin?.species]) if (id && !content.species.has(id)) problems.push(`totems.json "${t.id}" has unknown species "${id}"`);
    for (const r of t.rewards.items) if (!content.items.has(r.item)) problems.push(`totems.json "${t.id}" gives unknown item "${r.item}"`);
    // An aura is one or two stages in total; several big boosts at once make a fight about the boosts, not the mechanic.
    const stages = Object.values(t.aura.boost ?? {}).reduce((a, b) => a + b, 0);
    if (stages > 2) problems.push(`totems.json "${t.id}" aura boosts more than 2 stages`);
    if (t.phases.some((p, i) => i > 0 && p.atHp >= t.phases[i - 1]!.atHp)) problems.push(`totems.json "${t.id}" phases must go down in HP`);
    if (t.tier === 'early' && (t.phases.length > 0 || (t.ally && t.ally.maxCalls > 1))) problems.push(`totems.json "${t.id}": early Totems have one aura and at most one weak ally call`);
  }
  const megaSpecies = new Set([...content.items.values()].flatMap((i) => (i.effect.kind === 'megaStone' ? Object.keys(i.effect.forms) : [])));
  const expIds = new Set(expeditions.expeditions.map((e) => e.id));
  for (const e of expeditions.expeditions) {
    for (const id of e.rentals) if (!content.species.has(id)) problems.push(`expeditions.json "${e.id}" has unknown rental "${id}"`);
    for (const r of [...e.cache, ...e.rewards.items]) if (!content.items.has(r.item)) problems.push(`expeditions.json "${e.id}" gives unknown item "${r.item}"`);
    if (e.rewards.researchBonusItem && !content.items.has(e.rewards.researchBonusItem)) problems.push(`expeditions.json "${e.id}" bonus item is unknown`);
    if (e.unlocks && !expIds.has(e.unlocks)) problems.push(`expeditions.json "${e.id}" unlocks unknown expedition "${e.unlocks}"`);
    const fin = e.finale;
    if (fin.kind === 'megaBoss') for (const id of fin.species) if (!megaSpecies.has(id)) problems.push(`expeditions.json "${e.id}" finale ${id} has no Mega Stone`);
    if (fin.kind === 'raid' && !raids.raids.some((r) => r.id === fin.raidId)) problems.push(`expeditions.json "${e.id}" finale raid is unknown`);
    if (fin.kind === 'totem' && !totems.totems.some((t) => t.id === fin.totemId)) problems.push(`expeditions.json "${e.id}" finale Totem is unknown`);
    if (e.partyMode === 'rental' && e.nodeWeights.recruit) problems.push(`expeditions.json "${e.id}": a rental expedition cannot have recruit nodes`);
  }
  for (const g of minigames.games) {
    if (!(g.id in MINIGAMES)) problems.push(`minigames.json has no module for "${g.id}"`);
    for (const r of [g.rewardTable.bronze, g.rewardTable.silver, g.rewardTable.gold]) if (r.item && !content.items.has(r.item.item)) problems.push(`minigames.json "${g.id}" gives unknown item "${r.item.item}"`);
  }
  for (const ev of expeditions.mysteryEvents) for (const o of ev.options) if (o.effect.item && !content.items.has(o.effect.item)) problems.push(`expeditions.json event "${ev.id}" gives unknown item`);
  const storyIds = toMap(story.definitions, 'story.json definitions', problems);
  for (const def of story.definitions) {
    for (const id of def.followUpEvents) if (!storyIds.has(id)) problems.push(`story.json "${def.id}" follows up with unknown event "${id}"`);
    if (def.effect?.kind === 'item' && !content.items.has(def.effect.itemId)) problems.push(`story.json "${def.id}" gives unknown item "${def.effect.itemId}"`);
    // Hyper moments are decided by the battle engine, which only knows one effect for each trigger.
    const expected = HYPER_EFFECTS[def.triggerConditions.trigger] ?? MOMENT_EFFECTS[def.triggerConditions.trigger];
    const duration = expected === 'rematch' ? 'run' : 'battle';
    if (def.effect?.kind !== expected || def.duration !== duration) {
      problems.push(`story.json "${def.id}": a ${def.triggerConditions.trigger} event needs a "${expected}" effect and ${duration} duration`);
    }
    for (const m of def.triggerConditions.needsMemory ?? []) {
      if (!HISTORY_MEMORIES.includes(m) && !storyIds.has(m)) problems.push(`story.json "${def.id}" needs unknown memory "${m}"`);
    }
  }
  for (const trigger of STORY_TRIGGERS) {
    if (story.definitions.filter((d) => d.triggerConditions.trigger === trigger).length > 1) problems.push(`story.json has more than one "${trigger}" event`);
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
  // Mega Stones: every species and form they name must exist, and the result must be a Mega or Primal form.
  for (const item of content.items.values()) {
    if (item.effect.kind !== 'megaStone') continue;
    for (const [from, to] of Object.entries(item.effect.forms)) {
      if (!content.species.has(from)) problems.push(`item "${item.id}" works on unknown species "${from}"`);
      const kind = content.species.get(to)?.form?.kind;
      if (kind !== (item.effect.primal ? 'primal' : 'mega')) problems.push(`item "${item.id}" turns "${from}" into "${to}", which is not a ${item.effect.primal ? 'Primal' : 'Mega'} form`);
    }
  }
  // Z-Moves: every crystal's Z-Move and every move named must exist.
  for (const [type, id] of Object.entries(zMoves.byType)) if (!content.moves.has(id)) problems.push(`zMoves.json: the ${type} Z-Move "${id}" is not a move`);
  for (const id of [...Object.keys(zMoves.power), ...Object.keys(zMoves.status)]) if (!content.moves.has(id)) problems.push(`zMoves.json names unknown move "${id}"`);
  // Max Moves: every Max and G-Max Move and every move named must exist; G-Max forms must be Gigantamax forms.
  for (const id of [...Object.values(maxMoves.byType), maxMoves.guard, ...Object.keys(maxMoves.gmax), ...Object.keys(maxMoves.power), ...Object.keys(maxMoves.effects)]) {
    if (!content.moves.has(id)) problems.push(`maxMoves.json names unknown move "${id}"`);
  }
  for (const [id, g] of Object.entries(maxMoves.gmax)) {
    for (const form of g.forms) if (content.species.get(form)?.form?.kind !== 'gigantamax') problems.push(`maxMoves.json: ${id} is for "${form}", which is not a Gigantamax form`);
  }
  for (const item of content.items.values()) {
    if (item.effect.kind === 'zCrystal' && !zMoves.byType[item.effect.type]) problems.push(`item "${item.id}" is a ${item.effect.type} Z-Crystal, but that type has no Z-Move`);
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
    if (m.supported && m.category !== 'status' && m.power === null && !m.effects.fixedDamage && !m.effects.halveTarget && !m.effects.endeavor && !m.effects.ohko && !m.effects.lowHpPower) {
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
    if (!a.unlockedByDefault && !a.unlock && !a.evolvedFrom) problems.push(`trainer "${a.id}" is locked but has no unlock requirement`);
    for (const id of Object.keys(a.startingItems)) if (!content.items.has(id)) problems.push(`trainer "${a.id}" starts with unknown item "${id}"`);
    for (const m of a.modifiers) {
      if (m.kind === 'startingAttribute' && !(ATTRIBUTE_KEYS as readonly string[]).includes(m.key)) problems.push(`trainer "${a.id}" starts with unknown attribute "${m.key}"`);
      if (m.kind === 'priceMultiplier' && !m.items && !m.group) problems.push(`trainer "${a.id}" has a price perk with no items or group`);
      if (m.kind === 'priceMultiplier') for (const id of m.items ?? []) if (!content.items.has(id)) problems.push(`trainer "${a.id}" changes the price of unknown item "${id}"`);
    }
    for (const id of a.signatureSpecies) if (!content.species.has(id)) problems.push(`trainer "${a.id}" has unknown signature species "${id}"`);
    if (a.signaturePool && !content.starterPools.has(a.signaturePool)) problems.push(`trainer "${a.id}" has unknown signature pool "${a.signaturePool}"`);
  }
  if (![...content.archetypes.values()].some((a) => a.unlockedByDefault)) problems.push('archetypes.json has no starting trainer');
  // Map events: every id they mention must exist.
  const knownItem = (id: string) => content.items.has(id) || content.catalog.has(id);
  for (const e of content.events.values()) {
    const where = `event "${e.id}"`;
    const effects = e.choices.flatMap((c) => [c.success, ...(c.failure ? [c.failure] : [])]).flatMap((o) => [...o.effects, ...(o.battle?.win ?? [])]);
    for (const f of effects) {
      if (f.kind === 'item' && !knownItem(f.id)) problems.push(`${where} gives unknown item "${f.id}"`);
      if (f.kind === 'loseItem' && f.id && !knownItem(f.id)) problems.push(`${where} uses unknown item "${f.id}"`);
      if (f.kind === 'itemFrom') for (const id of f.ids) if (!knownItem(id)) problems.push(`${where} gives unknown item "${id}"`);
      if (f.kind === 'join') for (const id of f.species) if (!content.species.has(id)) problems.push(`${where} offers unknown species "${id}"`);
    }
    for (const c of e.choices) {
      for (const o of [c.success, c.failure]) {
        const b = o?.battle;
        if (b?.kind === 'wild') for (const id of b.species) if (!content.species.has(id)) problems.push(`${where} battles unknown species "${id}"`);
        if (b?.kind === 'trainer' && b.bossId && !content.bosses.has(b.bossId)) problems.push(`${where} battles unknown boss "${b.bossId}"`);
        if (b?.kind === 'trainer' && b.classId && !content.trainers.has(b.classId)) problems.push(`${where} battles unknown trainer class "${b.classId}"`);
      }
      for (const r of [...c.requires, ...e.requires]) if (r.kind === 'item' && !knownItem(r.id)) problems.push(`${where} needs unknown item "${r.id}"`);
    }
    if (e.keyItem && !knownItem(e.keyItem)) problems.push(`${where} needs unknown key item "${e.keyItem}"`);
    if (e.scene.pokemon && !content.species.has(e.scene.pokemon)) problems.push(`${where} shows unknown species "${e.scene.pokemon}"`);
  }
  for (const id of balance.events.explorerItems) if (!isGiftable(content, id)) problems.push(`balance.events.explorerItems has "${id}", which isn't a working item`);
  for (const entry of content.catalog.values()) {
    if (entry.effect?.kind !== 'perk') continue;
    for (const p of entry.effect.perks) if (p.perk === 'favorSpecies' && !content.species.has(p.species)) problems.push(`item "${entry.id}" favours unknown species "${p.species}"`);
    if (entry.effect.perks.some((p) => p.perk === 'eventKey') && ![...content.events.values()].some((e) => e.keyItem === entry.id)) problems.push(`key item "${entry.id}" opens no event`);
  }
  // Game events: featured and own map events exist, rewards give real starter sets, objective ids are unique.
  for (const ge of content.gameEvents.values()) {
    const where = `game event "${ge.id}"`;
    for (const id of ge.mapEvents) if (!content.events.has(id)) problems.push(`${where} features unknown map event "${id}"`);
    for (const r of [ge.reward, ge.fallbackReward, ...ge.objectives.map((o) => o.reward)]) {
      if (r.pool && !content.starterPools.has(r.pool)) problems.push(`${where} gives unknown starter set "${r.pool}"`);
      if (r.trainer && !content.archetypes.has(r.trainer)) problems.push(`${where} gives unknown trainer "${r.trainer}"`);
    }
    if (new Set(ge.objectives.map((o) => o.id)).size !== ge.objectives.length) problems.push(`${where} has two objectives with the same id`);
    if ((ge.schedule.kind === 'weeklyRotation') !== (ge.seedRule === 'isoWeek')) problems.push(`${where}: weekly events use the ISO week, yearly ones the year`);
  }
  for (const e of content.events.values()) if (e.gameEvent && !content.gameEvents.has(e.gameEvent)) problems.push(`map event "${e.id}" belongs to unknown game event "${e.gameEvent}"`);
  // Trainer quests: one line per trainer, real pools, rewards that exist.
  const lineTrainers = new Set<string>();
  for (const line of quests.lines) {
    const where = `quest line "${line.trainerId}"`;
    if (lineTrainers.has(line.trainerId)) problems.push(`${where} appears twice`);
    lineTrainers.add(line.trainerId);
    if (!content.archetypes.has(line.trainerId)) problems.push(`${where} is for an unknown trainer`);
    line.steps.forEach((step, i) => {
      checkRequirement(step.requirement, `${where} step ${i + 1}`);
      if (step.reward.pool && !content.starterPools.has(step.reward.pool)) problems.push(`${where} step ${i + 1} gives unknown starter set "${step.reward.pool}"`);
      if (step.reward.trainer && !content.archetypes.has(step.reward.trainer)) problems.push(`${where} step ${i + 1} gives unknown trainer "${step.reward.trainer}"`);
      if (step.reward.evolution && i !== line.steps.length - 1) problems.push(`${where} step ${i + 1}: only the last step unlocks a Trainer Evolution`);
    });
  }
  for (const a of content.archetypes.values()) if (a.available !== false && !a.evolvedFrom && !lineTrainers.has(a.id)) problems.push(`trainer "${a.id}" has no quest line`);
  // Trainer Evolutions: the base trainer exists and its quest line ends in the evolution unlock.
  for (const a of content.archetypes.values()) {
    if (!a.evolvedFrom) continue;
    const line = quests.lines.find((l) => l.trainerId === a.evolvedFrom);
    if (!content.archetypes.has(a.evolvedFrom)) problems.push(`evolved trainer "${a.id}": unknown base trainer "${a.evolvedFrom}"`);
    else if (!line?.steps.at(-1)?.reward.evolution) problems.push(`evolved trainer "${a.id}": "${a.evolvedFrom}"'s quest line doesn't unlock a Trainer Evolution`);
  }
  // Run-Prep: starter pools, draft rules, preparation tokens and licenses.
  const checkLicense = (id: string | null, where: string) => {
    if (id !== null && !content.licenses.has(id)) problems.push(`${where} needs unknown license "${id}"`);
  };
  for (const pool of content.starterPools.values()) {
    checkRequirement(pool.unlock, `starter pool "${pool.id}"`);
    checkLicense(pool.license, `starter pool "${pool.id}"`);
    // Listed species may be evolved (they stand for their first stage) but must exist; so must bosses and the filter's region.
    for (const id of pool.species) if (!content.species.has(id)) problems.push(`starter pool "${pool.id}" lists unknown species "${id}"`);
    for (const id of pool.bosses) if (!content.bosses.has(id)) problems.push(`starter pool "${pool.id}" lists unknown boss "${id}"`);
    if (pool.filter?.region && !content.regions.has(pool.filter.region)) problems.push(`starter pool "${pool.id}" filters on unknown region "${pool.filter.region}"`);
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

/** The draft card for a working catalog item; it is offered like any other reward. */
export function catalogReward(entry: CatalogEntry): Reward {
  return {
    id: catalogRewardId(entry.id),
    name: entry.name,
    description: entry.description,
    category: 'item',
    rarity: entry.rarity,
    family: entry.family,
    effect: { kind: 'catalog', entry: entry.id },
    stacking: entry.max === 1 ? 'instant' : 'stacks',
    scope: entry.stacksOn === 'pokemon' ? 'pokemon' : 'run',
    moneyMultiplierApplies: entry.effect?.kind === 'money',
    iconAssetId: catalogIconAssetId(entry),
  };
}

export const catalogRewardId = (entryId: string) => `item:${entryId}`;

/** Catalog items use the director's icon pack (images/items/gen5); 0.png is its blank icon. */
export const catalogIconAssetId = (entry: CatalogEntry) => `item.gen5/${entry.icon ?? '0'}`;

/** Adds draft cards for the working catalog items, cash-in values to Bag items, and checks the catalog. */
function addCatalog(content: Content, problems: string[]): void {
  for (const entry of content.catalog.values()) {
    const where = `itemCatalog.json "${entry.id}"`;
    if (entry.existing && !content.rewards.has(entry.existing) && !content.items.has(entry.existing)) problems.push(`${where} points at unknown reward or item "${entry.existing}"`);
    if (entry.cashIn) {
      const item = entry.existing ? content.items.get(entry.existing) : undefined;
      if (!item) problems.push(`${where} has a cash-in value but no Bag item`);
      else content.items.set(item.id, { ...item, cashIn: entry.cashIn });
    }
    if (entry.status !== 'supported') continue;
    const effect = entry.effect!;
    if (effect.kind === 'fossil' && !content.species.has(effect.species)) problems.push(`${where} revives unknown species "${effect.species}"`);
    if (effect.kind === 'held') {
      for (const hook of effect.hooks) {
        for (const id of ('species' in hook ? hook.species : undefined) ?? []) if (!content.species.has(id)) problems.push(`${where} works for unknown species "${id}"`);
      }
      if (entry.stacksOn === 'player') problems.push(`${where} is a held item, so it must stack on a Pokémon or the team`);
    }
    if (effect.kind === 'encounter') {
      for (const mod of effect.mods) if (mod.mod === 'species' && !content.species.has(mod.species)) problems.push(`${where} brings unknown species "${mod.species}"`);
    }
    if ((effect.kind === 'encounter' || effect.kind === 'perk') && entry.stacksOn === 'pokemon') problems.push(`${where} is a map item, so it must stack on the team or the player`);
    const reward = catalogReward(entry);
    if (content.rewards.has(reward.id)) problems.push(`${where} clashes with reward "${reward.id}"`);
    content.rewards.set(reward.id, reward);
  }
}

let cached: Content | null = null;
/** The game's content, validated once and then reused. */
export function getContent(): Content {
  cached ??= buildContent();
  return cached;
}
