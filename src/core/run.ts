// The run "state machine". Every player action is a function that takes the
// current run state and returns a NEW run state (the old one is untouched),
// plus whatever the screens need to show what happened.
//
// Phases:  starter → map → battle → (decision) → reward → (decision) → map → ... → over
//   map      = choose the next node on the stage map (or visit a healing stop / shop beside the current one)
//   shop     = buying items at a shop stop
//   decision = choices the player must make: learning a move, or what to do
//              with a caught Pokémon.
// Beating the gym leader at the end of a stage moves the run to a new stage
// with a new theme. After the region's last stage comes its Pokémon League
// (Elite Four, then the champion); beating the champion moves the run to the
// next region, or wins the run after the last one.

import { captureMultiplier, friendshipMultiplier, getArchetype, healingMultiplier, moneyMultiplier, priceMultiplier, shopUnlockOffset, trainerPreviews, typeModifiers, xpMultiplier } from './archetypes';
import { createBattle, resolveTurn, startBattle, type BattleContext, type BattleEvent, type PlayerAction } from './battle/engine';
import { endBattle as endHeldBattle, expMultiplier, giveBossItems, growthOnLevelUp } from './battle/held';
import { bossMechanics, revertTransformations } from './battle/transform';
import { RARITIES, type AttributeKey, type Content, type TypeName } from './contentSchema';
import {
  bossTeamSpecies,
  candiesForRelease,
  CHAMPION_CLASS,
  enemyLevel,
  rollShiny,
  ELITE_FOUR_CLASS,
  GYM_LEADER_CLASS,
  createPlannedPokemon,
  leagueScale,
  levelScale,
  planChampion,
  planEliteFour,
  planGymLeader,
  planTrainer,
  planWild,
  type TrainerPlan,
} from './encounters';
import { evolveFully, type EvolutionResult } from './evolution';
import { changeFriendship } from './friendship';
import { addItem, applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem } from './items';
import { createPokemon, gainXp, getSpecies, MAX_PP_UPS, maxHp, maxPp, xpForDefeat } from './pokemon';
import { applyReward, generateDraft, rewardTargetProblem, type RewardResult } from './rewards';
import { addEventStops, eventBattleWon, eventGymPreview } from './events';
import { currentColumn, findNode, generateLeagueMap, generateStageMap, nextChoices, validateLeagueMap, validateStageMap } from './map';
import { addRunAttribute, attributeText, luckWeights, readAttributes, runAttributeEffects, zeroAttributes } from './attributes';
import { count, discover } from './progress';
import { passivePercent } from './catalog';
import { defaultPrep, draftStarters, startingResources, withSignatureStarter } from './runPrep';
import { currentRegion, generateRegionOrder, getCampaign, pickLeague, runLevelCap } from './regions';
import {
  activeMods,
  addBridgeStops,
  addItemStops,
  afterPurchase,
  afterTrainerWin,
  earlyStockCount,
  fishingRod,
  hiddenItemFound,
  hiddenItemNode,
  hasPerk,
  mapItemRng,
  activePerks,
  markUsedThisStage,
  perksOf,
  perkItem,
  type MapItemRun,
  priceMultiplierFromItems,
  prizeMoneyFromItems,
  regionMoneyFromItems,
  repelActive,
  spendUse,
  stageKey,
  startStageEffects,
  usedThisStage,
  usesLeft,
  throwMultiplier,
  useRepel,
  useThrowCharges,
  useUses,
  useWildBattleCharges,
  voucherOf,
  wildBattleSetup,
  wildExpMultiplier,
  wildLevelBonus,
  wildShinyMultiplier,
  wildSpeciesWithItems,
} from './mapItems';
import { applyBossHp, describeMechanics, describeRewards, freshRaidBattle, getRaid, placeRaidDens, raidLevel, raidSpecies, type RaidPreview } from './raid/raid';
import type { RaidDef } from './raid/schema';
import { applyTotemHp, describeAlly, describeTotemRewards, freshTotemBattle, getTotem, placeTotem, totemLevel, totemSpecies, type TotemPreview } from './totem/totem';
import type { TotemDef } from './totem/schema';
import { createStreams, hashSeed, Rng, withStream } from './rng';
import { currentEnemy, type BattleState, type MapNode, type SideStop, type RunPrep, type PastPokemon, type PendingDecision, type PokemonInstance, type RunState, type StageState } from './state';
import { getTheme, pickGymLeader, pickTheme, typesPool } from './themes';
import {
  ensureHistories,
  recordBattleStarted,
  recordBattleTurn,
  recordCaught,
  recordChanges,
  recordReleased,
  recordRewardTaken,
  recordRouteChosen,
  recordRunStarted,
} from './story/hooks';
import { buildHyperContext } from './story/hyper';
import type { PresentationCue } from './story/queue';
import { openingDrama, planDrama, type DialogueFrequency, type DramaLine } from './drama';
import { createStoryState } from './story/record';
import { simulateRivalWorld } from './rivals/world';
import { rivalReturn, rivalReturnFlag, waitingRival } from './rivals/adapt';
import { rematchRule, returnFlag, revisedTeam, waitingTrainer } from './story/returns';
import { planReunion, reunionPokemon } from './story/reunion';

export interface NewRunOptions {
  runId: string;
  seed: string;
  archetypeId: string;
  /** "full" (default) or a shorter campaign such as "dev". Ignored when `prep` is given. */
  campaignId?: string;
  /** The Preparation Desk's choices (default: the classic pool, the standard draft, no token). */
  prep?: RunPrep;
  /** The profile's permanent attributes (default: none). */
  attributes?: Record<string, number>;
  /** The profile's past Pokémon; one may come back this run (core/story/reunion.ts). */
  pastPokemon?: readonly PastPokemon[];
}

export function createRun(content: Content, opts: NewRunOptions): RunState {
  const archetype = getArchetype(content, opts.archetypeId);
  const prep: RunPrep = opts.prep ?? { ...defaultPrep(content), campaignId: opts.campaignId ?? 'full' };
  const resources = startingResources(content, archetype, prep);
  const inventory: Record<string, number> = {};
  for (const [id, n] of Object.entries(resources.items)) addItem(inventory, id, n);
  const campaign = getCampaign(content, prep.campaignId);
  const rng = createStreams(opts.seed);
  const draft = withStream(rng, 'starter', (r) => draftStarters(content, r, prep));
  // Used once here, so its own seed-derived generator needs no saved stream.
  const starterChoices = withSignatureStarter(content, new Rng(hashSeed(`${opts.seed}::signature`)), archetype, prep, draft.choices);
  const regionOrder = withStream(rng, 'map', (r) => generateRegionOrder(content, campaign, r));
  const run: RunState = {
    runId: opts.runId,
    seed: opts.seed,
    archetypeId: opts.archetypeId,
    phase: 'starter',
    starterChoices,
    prep: { ...prep, campaignId: campaign.id, note: draft.note },
    party: [],
    money: resources.money,
    inventory,
    candies: 0,
    encountersCompleted: 0,
    battle: null,
    pending: [],
    afterDecisions: 'reward',
    stage: null,
    usedThemes: [],
    usedLeaders: [],
    badges: [],
    campaignId: campaign.id,
    regionOrder,
    regionIndex: 0,
    regionsCleared: [],
    victory: false,
    draft: null,
    disabledMechanics: [],
    baseAttributes: opts.attributes ? readAttributes(content, opts.attributes) : zeroAttributes(),
    attributeModifiers: zeroAttributes(),
    rng,
    nextUid: 1,
    log: { rewardsTaken: [], battlesWon: 0, counters: {}, speciesSeen: [], speciesCaught: [], charmUsedInRegion: false, defeatedBy: null, starterUid: null },
    story: createStoryState(),
    raids: { entered: 0, won: 0, lost: 0, bestTier: 0, done: [] },
    totems: { entered: 0, won: 0, lost: 0, done: [], unlocks: [], research: 0 },
  };
  const reunion = planReunion(content, opts.seed, opts.pastPokemon ?? []);
  if (reunion) run.reunion = reunion;
  recordRunStarted(content, run);
  return run;
}

function assertPhase(run: RunState, ...phases: RunState['phase'][]): void {
  if (!phases.includes(run.phase)) throw new Error(`Action needs phase "${phases.join('" or "')}" but run is in "${run.phase}"`);
}

export function nextUid(run: RunState, prefix: string): string {
  const uid = `${prefix}${run.nextUid}`;
  run.nextUid += 1;
  return uid;
}

/** A new Pokémon for this run; its ability comes from the run seed and its uid. */
export function newMon(content: Content, run: RunState, speciesId: string, level: number, prefix: 'p' | 'e'): PokemonInstance {
  const uid = nextUid(run, prefix);
  return createPokemon(content, speciesId, level, uid, `${run.seed}:${uid}`);
}

function speciesName(content: Content, id: string): string {
  return getSpecies(content, id).name;
}

export function chooseStarter(content: Content, current: RunState, choiceIndex: number): RunState {
  assertPhase(current, 'starter');
  const speciesId = current.starterChoices[choiceIndex];
  if (!speciesId) throw new Error(`Invalid starter choice ${choiceIndex}`);
  const run = structuredClone(current);
  run.party = [newMon(content, run, speciesId, content.balance.starterLevel, 'p')];
  run.party[0]!.friendship = content.balance.friendship.starter;
  run.log.starterUid = run.party[0]!.uid;
  enterStage(content, run, 0);
  recordChanges(content, current, run, 'level');
  return run;
}

/**
 * Saves from before regions existed have no region order. Gives them one
 * (mutates `run`; does nothing when the run already has one).
 */
export function fillRegionOrder(content: Content, run: RunState): void {
  if (run.regionOrder.length > 0) return;
  const campaign = getCampaign(content, run.campaignId);
  run.regionOrder = withStream(run.rng, 'map', (r) => generateRegionOrder(content, campaign, r));
  run.regionIndex = Math.min(run.regionIndex, run.regionOrder.length - 1);
}

/** Returns a copy of `run` with a region order (see fillRegionOrder), or `run` itself if it has one. */
export function ensureRegionOrder(content: Content, run: RunState): RunState {
  if (run.regionOrder.length > 0) return run;
  const copy = structuredClone(run);
  fillRegionOrder(content, copy);
  return copy;
}

/**
 * Fills in what an older save could not have: the region order and a story
 * history for every party Pokémon. Returns `run` itself when nothing was missing.
 */
export function prepareLoadedRun(content: Content, run: RunState): RunState {
  const ordered = ensureRegionOrder(content, run);
  if (run.party.every((m) => ordered.story.histories[m.uid])) return ordered;
  const copy = ordered === run ? structuredClone(run) : ordered;
  ensureHistories(content, copy);
  return copy;
}

/** Starts a stage (mutates `run`): picks a fresh theme and gym leader, generates the map, and shows it. */
function enterStage(content: Content, run: RunState, index: number): void {
  fillRegionOrder(content, run);
  const campaign = getCampaign(content, run.campaignId);
  const region = currentRegion(content, run);
  const { theme, leader, map } = withStream(run.rng, 'map', (r) => {
    const theme = pickTheme(content, run.usedThemes, r);
    const leader = pickGymLeader(content, theme, run.usedLeaders, r, region.gymLeaders);
    return { theme, leader, map: generateStageMap(content, campaign, r) };
  });
  const problems = validateStageMap(map);
  if (problems.length > 0) throw new Error(`Generated an invalid stage map: ${problems.join('; ')}`);
  run.usedThemes.push(theme.id);
  run.usedLeaders.push(leader.id);
  run.stage = { kind: 'stage', index, themeId: theme.id, leaderId: leader.id, eliteFour: [], map, current: null, visited: [] };
  startStageEffects(run);
  simulateRivalWorld(content, run);
  // Rods, and Wave, Tropic and Harbor Mail, add stops to the new map; then the event ("?") stops.
  addItemStops(content, run);
  addEventStops(content, run);
  placeRaidDens(content, run);
  placeTotem(content, run);
  run.battle = null;
  run.phase = 'map';
}

/** Starts the region's Pokémon League (mutates `run`): picks the Elite Four and champion and heals the party. */
function enterLeague(content: Content, run: RunState): void {
  fillRegionOrder(content, run);
  const campaign = getCampaign(content, run.campaignId);
  const region = currentRegion(content, run);
  const league = withStream(run.rng, 'map', (r) => pickLeague(content, region, campaign, run.usedLeaders, r));
  const map = generateLeagueMap(campaign.eliteFourSize);
  const problems = validateLeagueMap(map);
  if (problems.length > 0) throw new Error(`Generated an invalid league map: ${problems.join('; ')}`);
  run.usedLeaders.push(...league.eliteFour, league.champion);
  const themeId = run.usedThemes[run.usedThemes.length - 1] ?? run.stage?.themeId ?? '';
  run.stage = {
    kind: 'league',
    index: campaign.stagesPerRegion,
    themeId,
    leaderId: league.champion,
    eliteFour: league.eliteFour,
    map,
    current: null,
    visited: [],
  };
  startStageEffects(run);
  healParty(content, run);
  run.battle = null;
  run.phase = 'map';
}

/** Starts the next region at its first stage, or ends the run in victory after the last one (mutates `run`). */
function enterNextRegion(content: Content, run: RunState): void {
  if (run.regionIndex + 1 >= run.regionOrder.length) {
    run.victory = true;
    run.phase = 'over';
    return;
  }
  run.regionIndex += 1;
  run.log.charmUsedInRegion = false;
  // Pass Orbs turn into money in each new region.
  const orbMoney = regionMoneyFromItems(content, run);
  run.money += orbMoney;
  count(run, 'moneyEarned', orbMoney);
  enterStage(content, run, 0);
}

function requireStage(run: RunState): StageState {
  if (!run.stage) throw new Error('The run has no stage');
  return run.stage;
}

/** Moves to a node on the map and starts its encounter. */
export function chooseNode(content: Content, current: RunState, nodeId: string): RunState {
  assertPhase(current, 'map');
  const choices = mapChoices(content, current);
  if (!choices.some((n) => n.id === nodeId)) throw new Error(`Node "${nodeId}" is not one of the next choices`);
  const run = structuredClone(current);
  const stage = run.stage!;
  const mode = run.moveMode;
  delete run.moveMode;
  const node = findNode(stage.map, nodeId);
  // The Bicycle rides through a node of the skipped column without stopping.
  if (mode === 'bicycle') stage.visited.push(nextChoices(stage).find((n) => n.next.includes(nodeId))!.id);
  if (mode && (mode !== 'machBike' || node.kind === 'wild')) markUsedThisStage(run, perkItem(content, run, mode)!);
  stage.current = nodeId;
  stage.visited.push(nodeId);
  // Bridge Mail adds a stop beside the node the player reaches.
  addBridgeStops(content, run, nodeId);
  recordRouteChosen(content, run, nodeId, node.harder, node.kind);
  // The Mach Bike rides past a wild Pokémon: no battle, but the reward draft still comes.
  if (mode === 'machBike' && node.kind === 'wild') {
    run.afterDecisions = 'reward';
    continueAfterDecisions(content, run);
    return run;
  }
  // A Repel keeps a wild Pokémon away: no battle and no reward, but the level counts.
  if (node.kind === 'wild' && repelActive(content, run)) {
    useRepel(content, run);
    return run;
  }
  startEncounter(content, run, node);
  return run;
}

// ---------- map items: getting around (M8.75 slice 3b-2) ----------

/** The nodes the player may move to next: the normal choices, or where a chosen bike can reach. */
export function mapChoices(content: Content, run: RunState): MapNode[] {
  const stage = requireStage(run);
  const plain = nextChoices(stage);
  if (run.moveMode === 'bicycle') {
    const ahead = new Map<string, MapNode>();
    for (const n of plain) for (const id of n.next) ahead.set(id, findNode(stage.map, id));
    return ahead.size > 0 ? [...ahead.values()] : plain;
  }
  if (run.moveMode === 'acroBike') {
    const column = currentColumn(stage) + 1;
    return stage.map.nodes.filter((n) => n.column === column);
  }
  return plain;
}

export type MapActionKind = 'escapeRope' | 'bicycle' | 'acroBike' | 'machBike' | 'rematch';

export interface MapAction {
  kind: MapActionKind;
  itemId: string;
  /** What the item does now, for the Items menu. */
  text: string;
  /** Why it can't be used now, or null. */
  problem: string | null;
  /** A bike chosen for the next move. */
  on: boolean;
}

/** Where an Escape Rope leads: the index in `visited` of the last node with a choice of paths (-1 = the start), or null. */
function lastFork(stage: StageState): number | null {
  for (let i = stage.visited.length - 2; i >= 0; i--) if (findNode(stage.map, stage.visited[i]!).next.length > 1) return i;
  return stage.visited.length > 0 && stage.map.nodes.filter((n) => n.column === 1).length > 1 ? -1 : null;
}

/** The trainer a VS Seeker calls back: the last one beaten on this stage. */
function rematchNode(stage: StageState): MapNode | null {
  for (let i = stage.visited.length - 1; i >= 0; i--) {
    const node = findNode(stage.map, stage.visited[i]!);
    if (node.kind === 'trainer') return node;
  }
  return null;
}

/** The map items the player can use from the map's Items menu, with why each can't be used now. */
export function mapActions(content: Content, run: RunState): MapAction[] {
  const stage = run.stage;
  if (!stage) return [];
  const out: MapAction[] = [];
  const league = stage.kind === 'league' ? 'Not in the Pokémon League.' : null;
  const rope = perkItem(content, run, 'escapeRope');
  if (rope) {
    const fork = lastFork(stage);
    out.push({
      kind: 'escapeRope',
      itemId: rope,
      text: `Go back to the last fork and choose again (${usesLeft(run, rope)} left)`,
      problem: league ?? (fork === null ? 'No fork behind you on this stage.' : null),
      on: false,
    });
  }
  const plain = nextChoices(stage);
  const bikes: { kind: 'bicycle' | 'acroBike' | 'machBike'; text: string; problem: string | null }[] = [
    { kind: 'bicycle', text: 'Ride two columns ahead, skipping one', problem: plain.every((n) => n.next.length === 0) ? 'Nothing two columns ahead.' : null },
    { kind: 'acroBike', text: 'Jump to any stop in the next column', problem: null },
    { kind: 'machBike', text: 'Ride past the next wild Pokémon and still get its reward', problem: plain.some((n) => n.kind === 'wild') ? null : 'No wild Pokémon ahead.' },
  ];
  for (const bike of bikes) {
    const itemId = perkItem(content, run, bike.kind);
    if (!itemId) continue;
    const used = usedThisStage(run, itemId) ? 'Already used on this stage.' : null;
    out.push({ kind: bike.kind, itemId, text: `${bike.text} (once per stage)`, problem: league ?? used ?? bike.problem, on: run.moveMode === bike.kind });
  }
  const seeker = perkItem(content, run, 'rematch');
  if (seeker) {
    const node = rematchNode(stage);
    out.push({
      kind: 'rematch',
      itemId: seeker,
      text: `Fight a trainer from this stage again for double money (${usesLeft(run, seeker)} left)`,
      problem: league ?? (node ? null : 'No trainer beaten on this stage yet.'),
      on: false,
    });
  }
  return out;
}

/** Uses a map item from the Items menu: an Escape Rope, a bike (chosen for the next move, or put away), or a VS Seeker. */
export function useMapAction(content: Content, current: RunState, kind: MapActionKind): { run: RunState; message: string } {
  assertPhase(current, 'map');
  const action = mapActions(content, current).find((a) => a.kind === kind);
  if (!action) throw new Error("You don't have that item");
  if (action.problem && !action.on) throw new Error(action.problem);
  const run = structuredClone(current);
  const stage = run.stage!;
  const name = content.catalog.get(action.itemId)!.name;
  switch (kind) {
    case 'escapeRope': {
      const fork = lastFork(stage)!;
      spendUse(run, action.itemId);
      stage.visited = stage.visited.slice(0, fork + 1);
      stage.current = fork < 0 ? null : stage.visited[fork]!;
      delete run.moveMode;
      return { run, message: `You used the ${name} and went back to the last fork.` };
    }
    case 'rematch': {
      spendUse(run, action.itemId);
      const node = rematchNode(stage)!;
      startEncounter(content, run, node, new Rng(hashSeed(`${run.seed}::rematch::${stageKey(run)}::${run.encountersCompleted}`)));
      return { run, message: `The ${name} buzzed: a trainer wants a rematch!` };
    }
    default: {
      if (action.on) {
        delete run.moveMode;
        return { run, message: `You put the ${name} away.` };
      }
      run.moveMode = kind;
      return { run, message: `You got on the ${name}. Choose where to ride.` };
    }
  }
}

/** One map node's preview from a map item: who waits there. */
export interface NodePreview {
  /** The item showing it, or null when the trainer's passive does (Cynthia, Oak). */
  itemId: string | null;
  /** Who shows it, in words: the item's or the trainer's name. */
  source: string;
  /** Species in battle order, with levels when they are known. */
  team: { speciesId: string; level: number | null }[];
  trainerName: string | null;
}

/**
 * What map items show about the nodes on this stage: the next wild Pokémon
 * (Devon Scope), the next trainers' teams (Town Map), the gym leader's ace
 * (Rule Book) or whole team (Orange Mail). Battles are planned on a copy of
 * the run, so previews never use a gameplay roll; they show exactly the
 * battle the player gets by choosing that node next.
 */
export function mapPreviews(content: Content, run: RunState): Record<string, NodePreview> {
  const stage = run.stage;
  if (!stage || run.phase !== 'map') return {};
  const working = activePreviewItems(content, run);
  const perks = (what: 'wild' | 'trainers' | 'gymAce' | 'gymTeam') =>
    working.find((id) => {
      const effect = content.catalog.get(id)?.effect;
      return effect?.kind === 'perk' && effect.perks.some((p) => p.perk === 'preview' && p.what === what);
    }) ?? null;
  const out: Record<string, NodePreview> = {};
  const archetype = getArchetype(content, run.archetypeId);
  // An item's preview wins over the trainer's (it names the item); either shows the same battle.
  const source = (what: 'wild' | 'trainers' | 'gymTeam', itemId: string | null): { itemId: string | null; source: string } | null =>
    itemId ? { itemId, source: content.catalog.get(itemId)?.name ?? itemId } : trainerPreviews(archetype, what) ? { itemId: null, source: archetype.name } : null;
  const wildFrom = source('wild', perks('wild'));
  const trainerFrom = source('trainers', perks('trainers'));
  for (const node of mapChoices(content, run)) {
    const from = node.kind === 'wild' ? wildFrom : node.kind === 'trainer' ? trainerFrom : null;
    if (!from) continue;
    const copy = structuredClone(run);
    // A preview never stops the map: with no Pokémon able to battle there is nothing to show.
    if (!copy.party.some((p) => p.hp > 0)) break;
    startEncounter(content, copy, node);
    const battle = copy.battle!;
    out[node.id] = { ...from, team: battle.enemyTeam.map((m) => ({ speciesId: m.speciesId, level: m.level })), trainerName: battle.trainer?.name ?? null };
  }
  const gym = stage.map.nodes.find((n) => n.kind === 'gym');
  const teamItem = perks('gymTeam') ?? perks('gymAce');
  const teamFrom = teamItem ? source('gymTeam', teamItem) : (source('gymTeam', null) ?? (eventGymPreview(run) ? { itemId: null, source: 'Your scouting' } : null));
  if (gym && teamFrom) {
    const campaign = getCampaign(content, run.campaignId);
    const species = bossTeamSpecies(content, 'gym', stage.leaderId, run.regionIndex * campaign.stagesPerRegion + stage.index);
    const shown = perks('gymTeam') || !teamItem ? species : species.slice(-1);
    out[gym.id] = { ...teamFrom, team: shown.map((speciesId) => ({ speciesId, level: null })), trainerName: null };
  }
  return out;
}

/** The map items giving a preview that are working right now. */
function activePreviewItems(content: Content, run: RunState): string[] {
  const ids = new Set<string>();
  for (const id of Object.keys(run.passives ?? {}).concat((run.mapEffects ?? []).map((e) => e.itemId))) {
    const probe = { ...run, passives: run.passives?.[id] ? { [id]: run.passives[id]! } : {}, mapEffects: (run.mapEffects ?? []).filter((e) => e.itemId === id) };
    if (hasPerk(content, probe, 'preview')) ids.add(id);
  }
  return [...ids];
}

/**
 * Fame Checker: the gym leaders of this region's stages still to come, found
 * by starting those stages on a copy of the run, so they are exactly the ones
 * the player will meet and no roll is used.
 */
export function nextGymLeaders(content: Content, run: RunState): { leaderId: string; types: TypeName[] }[] {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || !hasPerk(content, run, 'nextLeaders')) return [];
  const campaign = getCampaign(content, run.campaignId);
  const copy = structuredClone(run);
  const out: { leaderId: string; types: TypeName[] }[] = [];
  for (let index = stage.index + 1; index < campaign.stagesPerRegion; index++) {
    enterStage(content, copy, index);
    out.push({ leaderId: copy.stage!.leaderId, types: [...getTheme(content, copy.stage!.themeId).types] });
  }
  return out;
}

// ---------- fishing (M8.75 slice 3b-3) ----------

/** The fishing spot beside the current node, checked for use. */
function fishingSpot(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = findNode(stage.map, stage.current);
  const side = node.sides.find((s) => s.id === sideId);
  if (!side || side.kind !== 'fish') throw new Error(`No fishing spot "${sideId}" here`);
  if (side.used) throw new Error('You already fished here');
  return { node, side };
}

/**
 * What a fishing spot offers: Water Pokémon at this level of the stage, one
 * without a Rod or with the Old Rod, two with the Good Rod, three with the
 * Super Rod (the last the strongest of four). Rolled by a generator of the
 * spot's own, so looking changes nothing and the offer is the same every time.
 */
export function fishingOffer(content: Content, run: RunState, sideId: string): { speciesId: string; level: number; shiny: boolean }[] {
  const { node } = fishingSpot(run, sideId);
  const stage = run.stage!;
  const rod = fishingRod(content, run) ?? { choices: 1, rare: false };
  const rng = new Rng(hashSeed(`${run.seed}::fishing::${stageKey(run)}::${node.id}::${sideId}`));
  const pool = typesPool(content, ['water'], run.regionOrder[run.regionIndex]).map((p) => ({ item: p.speciesId, weight: p.weight }));
  const bst = (id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);
  const scale = levelScale(content, getCampaign(content, run.campaignId), run.regionIndex, stage.index, node.column);
  const archetype = getArchetype(content, run.archetypeId);
  const shinyChance = runAttributeEffects(content, run).shinyChance;
  const out: { speciesId: string; level: number; shiny: boolean }[] = [];
  for (let i = 0; i < rod.choices; i++) {
    let speciesId = rng.weighted(pool);
    for (let tries = 0; tries < 5 && out.some((o) => o.speciesId === speciesId); tries++) speciesId = rng.weighted(pool);
    if (rod.rare && i === rod.choices - 1) {
      for (let j = 0; j < 3; j++) {
        const other = rng.weighted(pool);
        if (bst(other) > bst(speciesId)) speciesId = other;
      }
    }
    out.push({ speciesId, level: enemyLevel(content, archetype, scale, 0, rng).level, shiny: rollShiny(content, rng, shinyChance) });
  }
  return out;
}

/** Fishes up one of the offered Pokémon and starts a wild battle with it; the spot is used up. */
export function fish(content: Content, current: RunState, sideId: string, index: number): RunState {
  assertPhase(current, 'map');
  const pick = fishingOffer(content, current, sideId)[index];
  if (!pick) throw new Error(`No fishing choice ${index}`);
  const activeIndex = current.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const run = structuredClone(current);
  fishingSpot(run, sideId).side.used = true;
  const enemy = createPokemon(content, pick.speciesId, pick.level, nextUid(run, 'e'));
  enemy.shiny = pick.shiny;
  if (pick.shiny) count(run, 'shiniesFound');
  run.battle = createBattle('wild', [enemy], activeIndex, run.party[activeIndex]!.uid);
  run.battle.fishing = true;
  discover(run, enemy.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
  return run;
}

/** Raid dens: what the player may review before paying (rules in core/raid). */
export function raidPreview(content: Content, current: RunState, sideId: string): RaidPreview {
  const { node, side } = raidDen(current, sideId);
  const def = getRaid(content, side.raidId!);
  const { speciesId, level } = raidBoss(content, current, def, node.id + sideId);
  return { id: def.id, name: def.name, tier: def.tier, blurb: def.blurb, speciesId, level, entryCost: def.entryCost, mechanics: describeMechanics(def), rewards: describeRewards(def) };
}

function raidDen(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = findNode(stage.map, stage.current);
  const side = node.sides.find((x) => x.id === sideId && x.kind === 'raid' && x.raidId);
  if (!side) throw new Error(`No raid den "${sideId}" here`);
  return { node, side };
}

function raidBoss(content: Content, run: RunState, def: RaidDef, key: string): { speciesId: string; level: number } {
  const stage = requireStage(run);
  const campaign = getCampaign(content, run.campaignId);
  const scale = levelScale(content, campaign, run.regionIndex, stage.index, campaign.columns);
  return { speciesId: raidSpecies(def, run, key), level: raidLevel(def, scale.end, scale.cap) };
}

/** Pays the entry cost and starts the raid battle. The den is used up at once, so a reload can't charge or reward twice. */
export function enterRaid(content: Content, current: RunState, sideId: string): RunState {
  assertPhase(current, 'map');
  const { node, side } = raidDen(current, sideId);
  if (side.used) throw new Error('This raid has already been fought');
  const def = getRaid(content, side.raidId!);
  if (current.money < def.entryCost) throw new Error(`You need ₽${def.entryCost} to enter this raid`);
  const activeIndex = current.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const run = structuredClone(current);
  raidDen(run, sideId).side.used = true;
  run.money -= def.entryCost;
  const { speciesId, level } = raidBoss(content, run, def, node.id + sideId);
  const boss = newMon(content, run, speciesId, level, 'e');
  applyBossHp(def, boss);
  boss.hp = maxHp(content, boss);
  run.battle = createBattle('wild', [boss], activeIndex, run.party[activeIndex]!.uid);
  run.battle.ai = 0.6;
  run.battle.raid = freshRaidBattle(def);
  if (def.weather) run.battle.weather = { id: def.weather, turns: 999 };
  run.raids.entered += 1;
  discover(run, boss.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
  return run;
}

/** Totem territory preview. */
export function totemPreview(content: Content, current: RunState, sideId: string): TotemPreview {
  const { node, side } = totemDen(current, sideId);
  const def = getTotem(content, side.totemId!);
  const { speciesId, level } = totemBoss(content, current, def, node.id + sideId);
  return {
    id: def.id, name: def.name, tier: def.tier, blurb: def.blurb, speciesId, level, aura: def.aura.text,
    environment: def.environment?.text ?? null, ally: describeAlly(def), phases: def.phases.length, rewards: describeTotemRewards(def),
  };
}

function totemDen(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = findNode(stage.map, stage.current);
  const side = node.sides.find((x) => x.id === sideId && x.kind === 'totem' && x.totemId);
  if (!side) throw new Error(`No Totem territory "${sideId}" here`);
  return { node, side };
}

function totemBoss(content: Content, run: RunState, def: TotemDef, key: string): { speciesId: string; level: number } {
  const stage = requireStage(run);
  const campaign = getCampaign(content, run.campaignId);
  const scale = levelScale(content, campaign, run.regionIndex, stage.index, campaign.columns);
  return { speciesId: totemSpecies(def, run, key), level: totemLevel(def, scale.end, scale.cap) };
}

/** Starts the Totem fight. The territory is used up at once, so a reload can't repeat it or its rewards. */
export function enterTotem(content: Content, current: RunState, sideId: string): RunState {
  assertPhase(current, 'map');
  const { node, side } = totemDen(current, sideId);
  if (side.used) throw new Error('This Totem has already been fought');
  const def = getTotem(content, side.totemId!);
  const activeIndex = current.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const run = structuredClone(current);
  totemDen(run, sideId).side.used = true;
  const { speciesId, level } = totemBoss(content, run, def, node.id + sideId);
  const boss = newMon(content, run, speciesId, level, 'e');
  applyTotemHp(def, boss);
  boss.hp = maxHp(content, boss);
  run.battle = createBattle('wild', [boss], activeIndex, run.party[activeIndex]!.uid);
  run.battle.ai = 0.6;
  run.battle.totem = freshTotemBattle(def, boss.uid);
  run.totems.entered += 1;
  discover(run, boss.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
  return run;
}

/** Totem victory: money, items, draft choices, a rare Pokémon, an unlock and research (once: the battle is cleared right after). */
function claimTotemRewards(content: Content, run: RunState, battle: BattleState): { items: string[]; draftExtra: number; money: number } {
  const def = getTotem(content, battle.totem!.id);
  const totem = battle.enemyTeam.find((m) => m.uid === battle.totem!.uid) ?? currentEnemy(battle);
  const money = def.rewards.moneyPerLevel * totem.level;
  run.money += money;
  count(run, 'moneyEarned', money);
  const rng = new Rng(hashSeed(`${run.seed}::totem-reward::${def.id}:${run.encountersCompleted}`));
  const items = def.rewards.items.filter((i) => rng.chance(i.chance)).map((i) => i.item);
  const rare = def.rewards.rareJoin;
  if (rare && rng.chance(rare.chance)) {
    const mon = newMon(content, run, rare.species, Math.max(2, totem.level - 2), 'p');
    count(run, 'pokemonCaught');
    discover(run, mon.speciesId, true);
    run.pending.unshift({ kind: 'caught', mon });
  }
  run.totems.won += 1;
  run.totems.done.push(def.id);
  run.totems.research += def.rewards.research;
  if (def.rewards.unlock && !run.totems.unlocks.includes(def.rewards.unlock)) run.totems.unlocks.push(def.rewards.unlock);
  return { items, draftExtra: def.rewards.draftExtra, money };
}

/** A lost or timed-out raid: no rewards, the party is back on its feet, and the run goes on. */
function failRaid(content: Content, run: RunState): void {
  const battle = run.battle!;
  const raidId = battle.raid?.id ?? battle.totem!.id;
  const frac = battle.totem ? content.totems.failureHealFraction : content.raids.failureHealFraction;
  for (const mon of run.party) {
    mon.hp = Math.max(1, Math.floor(maxHp(content, mon) * frac));
    mon.status = null;
  }
  if (battle.totem) {
    run.totems.lost += 1;
    run.totems.done.push(raidId);
  } else {
    run.raids.lost += 1;
    run.raids.done.push(raidId);
  }
  run.battle = null;
  run.phase = 'map';
}

/** Raid victory: money, item rolls (a seeded generator), extra draft choices and maybe the boss joining (applies once: the battle is cleared right after). */
function claimRaidRewards(content: Content, run: RunState, battle: BattleState): { items: string[]; draftExtra: number; money: number } {
  const def = getRaid(content, battle.raid!.id);
  const boss = currentEnemy(battle);
  const money = def.rewards.moneyPerLevel * boss.level;
  run.money += money;
  count(run, 'moneyEarned', money);
  const rng = new Rng(hashSeed(`${run.seed}::raid-reward::${def.id}:${run.encountersCompleted}`));
  const items = def.rewards.items.filter((i) => rng.chance(i.chance)).map((i) => i.item);
  if (rng.chance(def.rewards.joinChance)) {
    const joined = structuredClone(boss);
    joined.uid = nextUid(run, 'p');
    delete joined.statBoosts;
    joined.hp = maxHp(content, joined);
    joined.status = null;
    count(run, 'pokemonCaught');
    discover(run, joined.speciesId, true);
    run.pending.unshift({ kind: 'caught', mon: joined });
  }
  run.raids.won += 1;
  run.raids.bestTier = Math.max(run.raids.bestTier, def.tier);
  run.raids.done.push(def.id);
  return { items, draftExtra: def.rewards.draftExtra, money };
}

/**
 * Sets up the battle for a map node (mutates `run`). A VS Seeker rematch passes
 * a generator of its own, so the encounter stream (and every later battle) is unchanged.
 */
function startEncounter(content: Content, run: RunState, node: MapNode, rematch?: Rng): void {
  const stage = run.stage!;
  const archetype = getArchetype(content, run.archetypeId);
  const theme = getTheme(content, stage.themeId);
  const campaign = getCampaign(content, run.campaignId);
  const scale = stage.kind === 'league' ? leagueScale(content, run.regionIndex) : levelScale(content, campaign, run.regionIndex, stage.index, node.column);
  // Counts stages from the start of the run (trainer and gym teams grow with it).
  const stageNumber = run.regionIndex * campaign.stagesPerRegion + stage.index;
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const activeUid = run.party[activeIndex]!.uid;

  if (node.kind === 'wild') {
    // Map items (Flutes, Incense, Mail, Poké Radar...) change the wild Pokémon; their own rolls use a generator of their own.
    const mods = activeMods(content, run);
    const plan = withStream(run.rng, 'encounter', (r) => {
      const [lo, hi] = content.balance.difficulty.harderBonus;
      const bonus = (node.harder ? r.int(lo, hi) : 0) + wildLevelBonus(content, run, mods);
      const shiny = runAttributeEffects(content, run).shinyChance * wildShinyMultiplier(content, run, mods);
      return planWild(content, archetype, theme, scale, bonus, r, run.regionOrder[run.regionIndex], shiny);
    });
    const speciesId = wildSpeciesWithItems(content, run, theme, plan.speciesId, mapItemRng(run, node.id), mods);
    const enemy = newMon(content, run, speciesId, plan.level, 'e');
    enemy.shiny = plan.shiny;
    if (plan.shiny) count(run, 'shiniesFound');
    run.battle = createBattle('wild', [enemy], activeIndex, activeUid);
    run.battle.levelInfo = [plan.levelInfo];
    const setup = wildBattleSetup(content, run, mods);
    if (setup.freeTurns > 0) run.battle.mapItems = { freeTurns: setup.freeTurns, thrown: 0 };
    if (setup.foeSpeed !== 0) run.battle.enemyStages.spe = Math.max(-6, Math.min(6, run.battle.enemyStages.spe + setup.foeSpeed));
    useWildBattleCharges(run);
  } else {
    const roll = <T>(fn: (r: Rng) => T): T => (rematch ? fn(rematch) : withStream(run.rng, 'encounter', fn));
    let plan: TrainerPlan = roll((r) => {
      switch (node.kind) {
        case 'gym':
          return planGymLeader(content, archetype, stage.leaderId, stageNumber, scale, r);
        case 'elite': {
          const memberId = stage.eliteFour[node.column - 1];
          if (!memberId) throw new Error(`No Elite Four member for column ${node.column}`);
          return planEliteFour(content, archetype, memberId, run.regionIndex, scale, r);
        }
        case 'champion':
          return planChampion(content, archetype, stage.leaderId, run.regionIndex, scale, r);
        default:
          return planTrainer(content, archetype, theme, stageNumber, scale, r, run.regionOrder[run.regionIndex]);
      }
    });
    // A trainer that vowed to return takes the place of the first ordinary trainer of a later stage.
    const rule = node.kind === 'trainer' && !rematch ? rematchRule(content) : null;
    const back = rule ? waitingTrainer(run) : null;
    if (rule && back) {
      plan = revisedTeam(content, run, back, plan, rule.effect);
      run.story.flags[returnFlag(back.id)] = 'returned';
    }
    // A rival that sparked earlier takes the first ordinary trainer slot once per region.
    const rivalBack = rule && !back ? waitingRival(run) : null;
    let rivalNote: string | null = null;
    if (rule && rivalBack) {
      const ret = rivalReturn(content, run, rivalBack, plan, rule.effect);
      plan = ret.plan;
      rivalNote = ret.note;
      if (ret.note) rivalBack.adaptations.push(ret.note);
      run.story.flags[rivalReturnFlag(rivalBack.id)] = run.regionIndex;
      rivalBack.away = 0;
    }
    // RSVP Mail: the first ordinary trainer of the stage is a rival, a few levels up.
    const rsvp = node.kind === 'trainer' && !rematch && !back && !rivalBack ? perkItem(content, run, 'rival') : null;
    let isRival = false;
    if (rsvp && !usedThisStage(run, rsvp)) {
      isRival = true;
      markUsedThisStage(run, rsvp);
      const bonus = perksOf(activePerks(content, run), 'rival')[0]!.perk.levelBonus;
      plan = { ...plan, name: `Rival ${plan.name}`, members: plan.members.map((m) => ({ ...m, level: m.level + bonus })) };
    }
    const team = plan.members.map((m) => {
      const uid = nextUid(run, 'e');
      return createPlannedPokemon(content, m, uid, `${run.seed}:${uid}`);
    });
    run.battle = createBattle('trainer', team, activeIndex, activeUid, { classId: plan.classId, name: plan.name, leaderId: plan.leaderId });
    run.battle.ai = plan.ai;
    run.battle.levelInfo = plan.levelInfo;
    if (rematch) run.battle.rematch = true;
    if (back) run.battle.returning = back.id;
    if (isRival) run.battle.rival = true;
    if (rivalBack) {
      run.battle.rivalId = rivalBack.id;
      if (rivalNote) run.battle.rivalNote = rivalNote;
    }
    const role = node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion' ? node.kind : null;
    // Bosses hold items, from their own generator so no other roll changes.
    if (role) giveBossItems(content, team, role, run.regionIndex, new Rng(hashSeed(`${run.seed}::boss-items::${run.regionIndex}::${stage.index}::${node.id}`)));
    // Gym number counted from the start of the run (1 = the first gym).
    run.battle.transform.enemyMechanics = bossMechanics(content, role, run.badges.length + 1, run.disabledMechanics);
  }
  for (const mon of run.battle.enemyTeam) discover(run, mon.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
}

/** Uses a healing stop or enters a shop beside the current node. */
export function visitSide(content: Content, current: RunState, sideId: string): { run: RunState; message: string } {
  assertPhase(current, 'map');
  const stage = requireStage(current);
  if (stage.current === null) throw new Error('Choose a node first');
  const side = findNode(stage.map, stage.current).sides.find((s) => s.id === sideId);
  if (!side) throw new Error(`No side stop "${sideId}" here`);
  if (side.kind === 'heal' && side.used) throw new Error('This healing stop has already been used');
  if (side.kind === 'fish') throw new Error('Choose a Pokémon to fish for (fishingOffer, then fish)');
  if (side.kind === 'raid') throw new Error('Review the raid first (raidPreview), then enterRaid');
  if (side.kind === 'event') throw new Error('Make a choice at the event (eventView, then chooseEvent)');
  if (side.kind === 'totem') throw new Error('Review the Totem first (totemPreview), then enterTotem');
  const run = structuredClone(current);
  const runSide = findNode(run.stage!.map, stage.current).sides.find((s) => s.id === sideId)!;
  if (side.kind === 'heal') {
    healParty(content, run);
    runSide.used = true;
    count(run, 'healStopsUsed');
    return { run, message: 'Your Pokémon were fully healed!' };
  }
  run.phase = 'shop';
  // A Bike Voucher is traded for its bike (or money, if the player already has one).
  const voucher = voucherOf(content, run);
  if (voucher) {
    spendUse(run, voucher.itemId);
    const entry = content.catalog.get(voucher.item)!;
    const owned = run.passives?.[voucher.item] ?? 0;
    if (entry.max === null || owned < entry.max) {
      run.passives = { ...run.passives, [voucher.item]: owned + 1 };
      return { run, message: `Welcome to the shop! You traded your voucher for a ${entry.name}.` };
    }
    run.money += voucher.refund;
    count(run, 'moneyEarned', voucher.refund);
    return { run, message: `Welcome to the shop! You already have a ${entry.name}, so the voucher was worth ₽${voucher.refund}.` };
  }
  return { run, message: 'Welcome to the shop!' };
}

export function healParty(content: Content, run: RunState): void {
  for (const mon of run.party) {
    mon.hp = maxHp(content, mon);
    mon.status = null;
    for (const slot of mon.moves) slot.pp = maxPp(content, slot);
  }
}

/**
 * What the shop sells right now: more stock unlocks as the player earns badges,
 * and the Member Card and Wepear Berry put the next locked entries on sale early.
 * Key items you own aren't sold again.
 */
export function shopStock(content: Content, run: Pick<RunState, 'badges' | 'archetypeId'> & Partial<Pick<RunState, 'inventory'>> & MapItemRun): Content['shop'] {
  const owned = (e: Content['shop'][number]) => !!run.inventory && ownsKeepsake(content, run.inventory, e.item);
  const open = (e: Content['shop'][number]) => run.badges.length >= shopBadgesNeeded(content, run, e);
  const early = content.shop
    .filter((e) => !open(e) && !owned(e))
    .sort((a, b) => shopBadgesNeeded(content, run, a) - shopBadgesNeeded(content, run, b))
    .slice(0, earlyStockCount(content, run));
  return content.shop.filter((e) => (open(e) || early.includes(e)) && !owned(e));
}

/** Key items, Mega Stones and Z-Crystals last the whole run, so you only ever need one. */
function ownsKeepsake(content: Content, inventory: Record<string, number>, itemId: string): boolean {
  const kind = content.items.get(itemId)?.effect.kind;
  return (kind === 'keyItem' || kind === 'megaStone' || kind === 'zCrystal') && itemCount(inventory, itemId) > 0;
}

/** Badges needed before the shop sells an entry, after the trainer's shopUnlockOffset. */
export function shopBadgesNeeded(content: Content, run: Pick<RunState, 'archetypeId'>, entry: Content['shop'][number]): number {
  return Math.max(0, entry.minBadges - shopUnlockOffset(getArchetype(content, run.archetypeId)));
}

/** An entry's price for this run: some trainers pay more for some items, and Charisma lowers every price. */
export function shopPrice(content: Content, run: RunState, entry: Content['shop'][number]): number {
  // Coupons lower the price; a full Point Card makes it free.
  return Math.round(entry.price * priceMultiplier(getArchetype(content, run.archetypeId), entry.item) * runAttributeEffects(content, run).price * priceMultiplierFromItems(content, run));
}

/** Buys one of an item at the shop. */
export function buyItem(content: Content, current: RunState, itemId: string): { run: RunState; message: string } {
  assertPhase(current, 'shop');
  const entry = content.shop.find((e) => e.item === itemId);
  if (!entry) throw new Error(`The shop doesn't sell "${itemId}"`);
  const item = getItem(content, itemId);
  if (ownsKeepsake(content, current.inventory, itemId)) throw new Error(`You already have the ${item.name}.`);
  const badges = shopBadgesNeeded(content, current, entry);
  if (!shopStock(content, current).includes(entry)) throw new Error(`The shop sells ${item.name} once you have ${badges} badges.`);
  const price = shopPrice(content, current, entry);
  if (current.money < price) throw new Error(`You need ₽${price} for a ${item.name}.`);
  const run = structuredClone(current);
  run.money -= price;
  count(run, 'moneySpent', price);
  afterPurchase(content, run, priceMultiplierFromItems(content, current) === 0);
  if (item.effect.kind === 'attribute') {
    // Attribute items work as soon as they're bought.
    const value = addRunAttribute(content, run, item.effect.attribute, item.effect.amount);
    return { run, message: `You bought a ${item.name} for ₽${price}: ${attributeText(item.effect.attribute, value)}.` };
  }
  addItem(run.inventory, itemId, 1);
  return { run, message: `You bought a ${item.name} for ₽${price}.` };
}

export function leaveShop(content: Content, current: RunState): RunState {
  assertPhase(current, 'shop');
  const run = structuredClone(current);
  run.phase = 'map';
  // A Wepear Berry's extra item lasts one shop visit.
  useUses(content, run, 'shops');
  return run;
}

/** Events the run adds to the battle engine's events (experience and level-ups). */
export type RunEvent =
  | BattleEvent
  | { type: 'xp'; uid: string; amount: number }
  | { type: 'levelUp'; uid: string; level: number }
  | { type: 'learnedMove'; uid: string; moveId: string }
  | { type: 'wantsMove'; uid: string; moveId: string };

export interface BattleEndResult {
  outcome: 'win' | 'caught';
  moneyGained: number;
  /** Bag items found after the battle (Loot Sack, Blue Card). */
  itemsFound: string[];
  caughtSpeciesId: string | null;
  evolutions: (EvolutionResult & { uid: string })[];
  /** The gym leader's id when this win beat a gym leader. */
  badge: string | null;
  /** The region's id when this win beat its champion. */
  regionCleared: string | null;
  /** What an event battle you won paid out, in words. */
  eventRewards: string[];
  /** True when this win beat the last champion and so won the run. */
  victory: boolean;
}

export interface TurnResult {
  run: RunState;
  events: RunEvent[];
  /** Set when the battle was won or the Pokémon caught. */
  end: BattleEndResult | null;
  defeated: boolean;
  /** Story moments to show while playing `events` (presentation only: never saved, never read by the rules). */
  cues: PresentationCue[];
  /** A raid was lost or timed out: the party is back on its feet and the map is next (the run goes on). */
  raidFailed?: boolean;
  /** What the trainer says during the turn (presentation only). */
  drama: DramaLine[];
}

/** The battle engine's view of the run's battle (the engine changes `run` in place). */
function battleContext(content: Content, run: RunState, rng: Rng, captureRng: Rng, hyperRng?: Rng): BattleContext {
  const archetype = getArchetype(content, run.archetypeId);
  const attributes = runAttributeEffects(content, run);
  return {
    content,
    battle: run.battle!,
    party: run.party,
    inventory: run.inventory,
    rng,
    captureRng,
    catchMultiplier: captureMultiplier(archetype) * attributes.catchRate * throwMultiplier(content, run, currentEnemy(run.battle!)),
    healMultiplier: healingMultiplier(archetype) * attributes.healing,
    typeModifiers: typeModifiers(archetype),
    attributes,
    disabledMechanics: run.disabledMechanics,
    hyper: hyperRng ? buildHyperContext(content, run, hyperRng) : undefined,
    teamItems: run.passives,
  };
}

/**
 * Battle start: plays both first Pokémon's entry abilities (Intimidate,
 * Drizzle). Does nothing if they already happened. Uses no random numbers.
 */
/** The trainer's opening line (shown once per battle; the saved state stops a repeat after a reload). */
export function battleOpening(content: Content, current: RunState, dialogue: DialogueFrequency = 'normal'): { run: RunState; drama: DramaLine[] } {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const drama = openingDrama(content, run, dialogue);
  return { run, drama };
}

export function beginBattle(content: Content, current: RunState): { run: RunState; events: RunEvent[] } {
  assertPhase(current, 'battle');
  if ((current.battle!.pendingEntry ?? []).length === 0) return { run: current, events: [] };
  const run = structuredClone(current);
  const rng = new Rng(run.rng.battle);
  const events = startBattle(battleContext(content, run, rng, new Rng(run.rng.capture)));
  run.rng.battle = rng.state;
  countAttributeGrowth(content, run, events);
  return { run, events };
}

export function takeTurn(content: Content, current: RunState, action: PlayerAction, dialogue: DialogueFrequency = 'normal'): TurnResult {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const battle = run.battle!;
  const rng = new Rng(run.rng.battle);
  const captureRng = new Rng(run.rng.capture);
  const hyperRng = new Rng(run.rng.hyper);
  const targetUid = currentEnemy(battle).uid;
  const engineEvents = resolveTurn(battleContext(content, run, rng, captureRng, hyperRng), action);
  run.rng.battle = rng.state;
  run.rng.capture = captureRng.state;
  run.rng.hyper = hyperRng.state;
  // Apricorns and the Fluffy Tail are used up by the throws they help.
  const thrownAt = engineEvents.some((e) => e.type === 'ball') ? (battle.enemyTeam.find((m) => m.uid === targetUid) ?? null) : null;
  if (thrownAt) useThrowCharges(content, run, thrownAt);
  if (engineEvents.some((e) => e.type === 'lastStand' && e.side === 'player')) run.log.charmUsedInRegion = true;
  countAttributeGrowth(content, run, engineEvents);
  applyHeldAttributes(content, run, engineEvents);
  for (const e of engineEvents) {
    const fainted = e.type === 'faint' && e.side === 'player' ? run.party.find((p) => p.uid === e.uid) : undefined;
    if (fainted) changeFriendship(content, fainted, content.balance.friendship.perFaint);
  }

  const events = awardExperience(content, run, engineEvents);
  const cues = recordBattleTurn(content, current, run, events);
  // Trainer dialogue for what just happened (presentation only: it never changes the battle).
  const drama = planDrama(content, run, current.battle!, engineEvents, dialogue);
  // Mega Evolution and other transformations end with the battle, and so do "next battle" item effects.
  if (battle.outcome) {
    revertTransformations(content, battle, run.party);
    for (const mon of run.party) endHeldBattle(mon);
  }

  if (battle.outcome === 'win' || battle.outcome === 'caught') {
    const end = finishBattle(content, run);
    const caught = run.pending.find((d) => d.kind === 'caught');
    if (end.outcome === 'caught' && caught?.kind === 'caught') recordCaught(content, run, caught.mon);
    recordChanges(content, current, run, 'battle');
    return { run, events, end, defeated: false, cues, drama };
  }
  if (battle.outcome === 'lose' && (battle.raid || battle.totem)) {
    failRaid(content, run);
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: false, cues, drama, raidFailed: true };
  }
  if (battle.outcome === 'lose') {
    const enemy = currentEnemy(battle);
    run.log.defeatedBy = { speciesId: enemy.speciesId, level: enemy.level, trainer: battle.trainer?.name ?? null };
    run.phase = 'over';
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: true, cues, drama };
  }
  recordChanges(content, current, run, 'battle');
  return { run, events, end: null, defeated: false, cues, drama };
}

/**
 * Held items that change the run's attributes: healing berries' side effects,
 * and the Scarves (+1 per knockout, at most `cap` from each Scarf in a run).
 */
function applyHeldAttributes(content: Content, run: RunState, events: BattleEvent[]): void {
  for (const e of events) {
    if (e.type !== 'held' || e.what !== 'attribute' || !e.attribute || !e.amount) continue;
    const effect = content.catalog.get(e.itemId)?.effect;
    const cap = effect?.kind === 'held' ? effect.hooks.find((h) => h.hook === 'koAttribute')?.cap : undefined;
    let amount = e.amount;
    if (cap !== undefined) {
      const key = `ko:${e.itemId}`;
      const used = run.itemCounters?.[key] ?? 0;
      amount = Math.max(0, Math.min(amount, cap - used));
      if (amount === 0) continue;
      run.itemCounters = { ...run.itemCounters, [key]: used + amount };
    }
    addRunAttribute(content, run, e.attribute as AttributeKey, amount);
  }
}

/** Counts what grows attributes: stats your Pokémon raise on themselves, and enemies defeated or caught by type. */
function countAttributeGrowth(content: Content, run: RunState, events: BattleEvent[]): void {
  const battle = run.battle!;
  for (const e of events) {
    if (e.type === 'stat' && e.side === 'player' && e.change > 0) count(run, 'statsBoosted');
    const defeated =
      e.type === 'faint' && e.side === 'enemy' ? battle.enemyTeam.find((m) => m.uid === e.uid) : e.type === 'ball' && e.caught ? currentEnemy(battle) : undefined;
    if (defeated) for (const type of getSpecies(content, defeated.speciesId).types) count(run, `defeatedOrCaught.${type}`);
  }
}

/**
 * Gives experience to every participant still standing when an enemy faints
 * or is caught (full experience each, as in Gen 6+). Inserts xp/level-up
 * events right after the faint or catch so they're shown in order.
 */
function awardExperience(content: Content, run: RunState, events: BattleEvent[]): RunEvent[] {
  const battle = run.battle!;
  const effects = runAttributeEffects(content, run);
  // White Flute: more EXP from wild battles.
  const multiplier = xpMultiplier(getArchetype(content, run.archetypeId)) * effects.exp * (battle.kind === 'wild' ? wildExpMultiplier(content, run) : 1);
  const out: RunEvent[] = [];
  for (const e of events) {
    out.push(e);
    let defeated: PokemonInstance | undefined;
    let participants: string[] = [];
    if (e.type === 'faint' && e.side === 'enemy') {
      defeated = battle.enemyTeam.find((m) => m.uid === e.uid);
      participants = e.participants;
    } else if (e.type === 'ball' && e.caught) {
      defeated = currentEnemy(battle);
      participants = battle.participants.filter((uid) => run.party.some((p) => p.uid === uid && p.hp > 0));
    }
    if (!defeated) continue;
    const baseExp = getSpecies(content, defeated.speciesId).baseExp;
    // Exp. Share: party members that didn't battle get its percent of the EXP.
    const share = passivePercent(content, run, 'expShare');
    const sharers = share > 0 ? run.party.filter((p) => p.hp > 0 && !participants.includes(p.uid)).map((p) => p.uid) : [];
    const leadLevel = run.party[0]?.level ?? 0;
    for (const uid of [...participants, ...sharers]) {
      const mon = run.party.find((p) => p.uid === uid);
      if (!mon || mon.hp <= 0) continue;
      // Teachy TV: Pokémon below the lead's level catch up faster.
      const catchUp = mon.level < leadLevel ? passivePercent(content, run, 'catchUpExp') : 0;
      // Macho Brace: more EXP for its holder.
      const full = xpForDefeat(baseExp, defeated.level, mon.level, multiplier * (1 + catchUp / 100) * expMultiplier(content, mon));
      const amount = participants.includes(uid) ? full : Math.floor((full * Math.min(100, share)) / 100);
      if (amount <= 0) continue;
      const result = gainXp(content, mon, amount, runLevelCap(content, run));
      out.push({ type: 'xp', uid, amount });
      if (result.levelsGained > 0) {
        out.push({ type: 'levelUp', uid, level: result.newLevel });
        growthOnLevelUp(content, mon, result.newLevel - result.levelsGained);
        changeFriendship(content, mon, content.balance.friendship.perLevel * result.levelsGained, effects.friendship);
      }
      for (const moveId of result.learnedMoves) out.push({ type: 'learnedMove', uid, moveId });
      for (const moveId of result.skippedMoves) {
        out.push({ type: 'wantsMove', uid, moveId });
        run.pending.push({ kind: 'learnMove', uid, moveId });
      }
    }
  }
  return out;
}

/** After a win or a catch: prize money, evolutions, then decisions or the reward draft. */
function finishBattle(content: Content, run: RunState): BattleEndResult {
  const battle = run.battle!;
  const archetype = getArchetype(content, run.archetypeId);
  let base: number;
  const topLevel = Math.max(...battle.enemyTeam.map((m) => m.level));
  const { money } = content.balance;
  const classId = battle.trainer?.classId;
  if (classId === GYM_LEADER_CLASS) {
    base = money.gymLeaderPerLevel * topLevel;
  } else if (classId === ELITE_FOUR_CLASS) {
    base = money.eliteFourPerLevel * topLevel;
  } else if (classId === CHAMPION_CLASS) {
    base = money.championPerLevel * topLevel;
  } else if (battle.kind === 'trainer' && battle.trainer) {
    // An event's trainer (no trainer class) pays the events' rate.
    base = (content.trainers.get(battle.trainer.classId)?.moneyPerLevel ?? content.balance.events.trainerMoneyPerLevel) * topLevel;
  } else {
    base = content.balance.money.wildPerEnemyLevel * currentEnemy(battle).level;
  }
  // Amulet Coin (all prize money) and Luck Incense (trainers only) add their percent per copy.
  const itemBonus = passivePercent(content, run, 'money') + (battle.kind === 'trainer' ? passivePercent(content, run, 'trainerMoney') : 0);
  // Reply and Bead Mail (trainers), Soot Sack (wild battles on its type's stages).
  const theme = run.stage ? (content.themes.get(run.stage.themeId) ?? null) : null;
  const mapItemMoney = prizeMoneyFromItems(content, run, battle.kind, theme);
  // A VS Seeker rematch pays double.
  const rematch = battle.rematch ? 2 : 1;
  let moneyGained = Math.floor(base * rematch * moneyMultiplier(archetype) * runAttributeEffects(content, run).money * (1 + (itemBonus + mapItemMoney.percent) / 100)) + mapItemMoney.flat;
  run.money += moneyGained;
  count(run, 'moneyEarned', moneyGained);

  let caughtSpeciesId: string | null = null;
  const caughtPending: PendingDecision[] = [];
  const itemsFoundByRaid: string[] = [];
  if (battle.outcome === 'caught') {
    const caught = structuredClone(currentEnemy(battle));
    caught.uid = nextUid(run, 'p');
    caughtSpeciesId = caught.speciesId;
    count(run, 'pokemonCaught');
    // Photo Album: a species caught for the first time this run gives Love.
    const album = passivePercent(content, run, 'newSpeciesLove');
    if (album > 0 && !run.log.speciesCaught.includes(caught.speciesId)) addRunAttribute(content, run, 'love', album);
    discover(run, caught.speciesId, true);
    caughtPending.push({ kind: 'caught', mon: caught });
  }

  if (battle.outcome === 'win') {
    const { perBattleWon, perBossWon } = content.balance.friendship;
    const boss = classId === GYM_LEADER_CLASS || classId === ELITE_FOUR_CLASS || classId === CHAMPION_CLASS;
    const gainMultiplier = runAttributeEffects(content, run).friendship * friendshipMultiplier(getArchetype(content, run.archetypeId));
    for (const mon of run.party) {
      if (mon.hp > 0 && battle.participants.includes(mon.uid)) changeFriendship(content, mon, boss ? perBossWon : perBattleWon, gainMultiplier);
    }
  }

  const evolutions: BattleEndResult['evolutions'] = [];
  for (const mon of run.party) {
    for (const evo of evolveFully(content, mon, run.regionOrder[run.regionIndex])) {
      evolutions.push({ ...evo, uid: mon.uid });
      for (const moveId of evo.wantsToLearn) run.pending.push({ kind: 'learnMove', uid: mon.uid, moveId });
    }
  }
  count(run, 'evolutions', evolutions.length);
  // The caught Pokémon's decision comes first.
  run.pending = [...caughtPending, ...run.pending];

  const outcome = battle.outcome as 'win' | 'caught';
  const raidWin = battle.raid && outcome === 'win' ? claimRaidRewards(content, run, battle) : battle.totem && outcome === 'win' ? claimTotemRewards(content, run, battle) : null;
  if (raidWin) {
    itemsFoundByRaid.push(...raidWin.items);
    moneyGained += raidWin.money;
  }
  const won = outcome === 'win' && battle.trainer?.leaderId ? battle.trainer.leaderId : null;
  const badge = won && classId === GYM_LEADER_CLASS ? won : null;
  if (badge) {
    run.badges.push(badge);
    // Coin Case: interest on the money held; Fashion Case: Charisma per stage cleared.
    const interest = Math.floor((run.money * passivePercent(content, run, 'gymInterest')) / 100);
    run.money += interest;
    count(run, 'moneyEarned', interest);
    const charisma = passivePercent(content, run, 'stageCharisma');
    if (charisma > 0) addRunAttribute(content, run, 'charisma', charisma);
  }
  // Loot Sack and Blue Card: Bag items after trainer wins, from a generator of their own.
  // Bridge Mail S: the next trainer's reward draft gets the gym leader's odds.
  const bridge = perkItem(content, run, 'betterDraft');
  if (outcome === 'win' && battle.kind === 'trainer' && bridge) {
    spendUse(run, bridge);
    run.itemCounters = { ...run.itemCounters, 'better-draft': 1 };
  }
  // Bloom Mail: one more choice in the draft after a trainer win. Dowsing Machine: one more in each stage's first draft.
  let extraChoices = raidWin?.draftExtra ?? 0;
  // RSVP Mail: beating the rival gives the gym leader's odds and one more choice.
  if (outcome === 'win' && battle.rival) {
    run.itemCounters = { ...run.itemCounters, 'better-draft': 1 };
    extraChoices += 1;
  }
  if (outcome === 'win' && battle.kind === 'trainer' && hasPerk(content, run, 'extraChoice')) extraChoices += 1;
  const dowsing = perkItem(content, run, 'dowsing');
  if (dowsing && !battle.fishing && !usedThisStage(run, dowsing)) {
    markUsedThisStage(run, dowsing);
    extraChoices += 1;
  }
  if (extraChoices > 0) run.itemCounters = { ...run.itemCounters, 'draft-extra': extraChoices };
  const stock = shopStock(content, run).map((e) => ({ item: e.item, price: e.price }));
  const itemsFound =
    outcome === 'win' && battle.kind === 'trainer'
      ? afterTrainerWin(content, run, stock, new Rng(hashSeed(`${run.seed}::trainer-loot::${run.encountersCompleted}`)))
      : [...itemsFoundByRaid];
  // Itemfinder: the hidden item at this stage's marked wild stop.
  const hidden = battle.kind === 'wild' ? hiddenItemFound(content, run, stock) : null;
  if (hidden) itemsFound.push(hidden);
  for (const id of itemsFound) addItem(run.inventory, id, 1);
  if (outcome === 'win') {
    count(run, 'battlesWon');
    const role = classId === GYM_LEADER_CLASS ? 'gymLeadersDefeated' : classId === ELITE_FOUR_CLASS ? 'eliteFourDefeated' : classId === CHAMPION_CLASS ? 'championsDefeated' : null;
    if (role) {
      count(run, role);
      const lead = run.party[battle.activeIndex];
      for (const type of lead ? getSpecies(content, lead.speciesId).types : []) count(run, `bossWinsLead.${type}`);
    } else {
      count(run, battle.kind === 'wild' ? 'wildDefeated' : 'trainersDefeated');
    }
  }
  // The Elite Four heal your party after each battle.
  if (won && classId === ELITE_FOUR_CLASS) healParty(content, run);
  let regionCleared: string | null = null;
  if (won && classId === CHAMPION_CLASS) {
    regionCleared = currentRegion(content, run).id;
    run.regionsCleared.push(regionCleared);
    count(run, 'regionsCleared');
    if (!run.log.charmUsedInRegion) count(run, 'regionsClearedNoCharm');
    if (run.log.starterUid && run.party.some((m) => m.uid === run.log.starterUid)) count(run, 'regionsClearedWithStarter');
    if (run.regionIndex + 1 >= run.regionOrder.length) run.victory = true;
  }
  run.battle = null;
  run.encountersCompleted += 1;
  count(run, 'encountersCompleted');
  run.log.battlesWon += 1;
  // A Pokémon from a past run comes to meet you (after any caught Pokémon's decision).
  const reunion = run.reunion;
  if (reunion && !reunion.done && !run.victory && run.encountersCompleted >= reunion.afterEncounters) {
    reunion.done = true;
    const level = Math.max(...battle.enemyTeam.map((m) => m.level));
    const mon = reunionPokemon(content, reunion.mon, level, nextUid(run, 'p'));
    run.pending.splice(caughtPending.length, 0, { kind: 'reunion', mon, hallOfFame: reunion.mon.hallOfFame });
    count(run, 'reunions');
  }
  // An event battle you won pays its own rewards.
  const eventRewards = outcome === 'win' && battle.event ? eventBattleWon(content, run, battle.event) : [];
  // A fished Pokémon is an extra catch, and an event battle has its own rewards: no reward draft after them.
  run.afterDecisions = battle.fishing || battle.event ? 'map' : 'reward';
  continueAfterDecisions(content, run);
  return { outcome, moneyGained, itemsFound, caughtSpeciesId, evolutions, badge, regionCleared, victory: run.victory, eventRewards };
}

/**
 * Drops move-learning decisions that no longer apply: duplicates (a level-up
 * and an evolution can both offer the same move), moves already known, and
 * Pokémon no longer in the party.
 */
function prunePending(run: RunState): void {
  const seen = new Set<string>();
  run.pending = run.pending.filter((d) => {
    if (d.kind !== 'learnMove') return true;
    const key = `${d.uid}:${d.moveId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const mon = run.party.find((p) => p.uid === d.uid);
    return !!mon && !mon.moves.some((m) => m.id === d.moveId);
  });
}

/** Moves on once no decisions are pending: to the reward draft, or to the next battle. */
export function continueAfterDecisions(content: Content, run: RunState): void {
  prunePending(run);
  if (run.pending.length > 0) {
    run.phase = 'decision';
    return;
  }
  if (run.victory) {
    // The last champion is beaten: the run is won.
    run.draft = null;
    run.phase = 'over';
    return;
  }
  if (run.afterDecisions === 'reward') {
    const better = (run.itemCounters?.['better-draft'] ?? 0) > 0;
    if (better) run.itemCounters = Object.fromEntries(Object.entries(run.itemCounters!).filter(([key]) => key !== 'better-draft'));
    const weights = luckWeights(better ? content.balance.bossRarityWeights : rewardWeights(content, run), runAttributeEffects(content, run));
    run.draft = newDraft(content, run, weights);
    run.phase = 'reward';
    return;
  }
  // Back to the map. After the gym leader, the next stage (or the league) begins;
  // after the champion, the next region.
  const stage = run.stage;
  const kind = stage && stage.current !== null ? findNode(stage.map, stage.current).kind : null;
  if (!stage) {
    enterStage(content, run, 0); // a save from before stage maps existed
  } else if (kind === 'gym') {
    const campaign = getCampaign(content, run.campaignId);
    if (stage.index + 1 >= campaign.stagesPerRegion) enterLeague(content, run);
    else enterStage(content, run, stage.index + 1);
  } else if (kind === 'champion') {
    enterNextRegion(content, run);
  } else {
    run.phase = 'map';
  }
}

/** A fresh reward draft. The draft items' extra choices and carried-over rewards (Lock Capsule, Favored Mail) are used up here. */
function newDraft(content: Content, run: RunState, weights: Parameters<typeof generateDraft>[3]): string[] {
  const extra = run.itemCounters?.['draft-extra'] ?? 0;
  const forced = run.draftCarry ?? [];
  if (extra > 0) run.itemCounters = Object.fromEntries(Object.entries(run.itemCounters!).filter(([key]) => key !== 'draft-extra'));
  delete run.draftCarry;
  return withStream(run.rng, 'reward', (r) => generateDraft(content, run, r, weights, undefined, { size: content.balance.draftSize + extra, forced }));
}

/** Puts a reward into the next draft (once). */
function carryReward(run: RunState, rewardId: string): void {
  if (!(run.draftCarry ?? []).includes(rewardId)) run.draftCarry = [...(run.draftCarry ?? []), rewardId];
}

export type DraftItemKind = 'reroll' | 'lock';

/** Uses left of the Bag item behind a reward-screen action: Cornn Berry re-rolls one choice, Lock Capsule carries one into the next draft. */
export function draftItemUses(content: Content, run: RunState, kind: DraftItemKind): number {
  const itemId = perkItem(content, run, kind === 'reroll' ? 'rerollOne' : 'lockOne');
  return itemId ? usesLeft(run, itemId) : 0;
}

/** Uses a Cornn Berry (swap one draft choice for a new one) or a Lock Capsule (that choice comes back in the next draft too). */
export function useDraftItem(content: Content, current: RunState, kind: DraftItemKind, draftIndex: number): { run: RunState; message: string } {
  assertPhase(current, 'reward');
  const rewardId = current.draft?.[draftIndex];
  if (!rewardId) throw new Error(`Invalid reward choice ${draftIndex}`);
  const itemId = perkItem(content, current, kind === 'reroll' ? 'rerollOne' : 'lockOne');
  if (!itemId) throw new Error(kind === 'reroll' ? 'You have no Cornn Berry' : 'You have no Lock Capsule');
  const run = structuredClone(current);
  spendUse(run, itemId);
  const name = content.rewards.get(rewardId)!.name;
  if (kind === 'lock') {
    carryReward(run, rewardId);
    return { run, message: `${name} is locked in: it will be in the next draft too.` };
  }
  const weights = luckWeights(rewardWeights(content, run), runAttributeEffects(content, run));
  const fresh = withStream(run.rng, 'reward', (r) => generateDraft(content, run, r, weights, undefined, { size: 1, exclude: run.draft! }))[0]!;
  run.draft![draftIndex] = fresh;
  return { run, message: `${name} was swapped for ${content.rewards.get(fresh)!.name}.` };
}

/** Better rewards after harder routes and gym leaders. */
function rewardWeights(content: Content, run: RunState) {
  const stage = run.stage;
  if (!stage || stage.current === null) return content.balance.rarityWeights;
  const node = findNode(stage.map, stage.current);
  if (node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion') return content.balance.bossRarityWeights;
  if (node.harder) return content.balance.harderRarityWeights;
  return content.balance.rarityWeights;
}

export type DecisionChoice =
  | { kind: 'forgetMove'; moveIndex: number }
  | { kind: 'skipMove' }
  | { kind: 'addToParty' }
  | { kind: 'replace'; partyIndex: number }
  | { kind: 'release' }
  | { kind: 'keepsake' }
  | { kind: 'teachMove'; moveIndex: number }
  | { kind: 'ppUpMove'; moveIndex: number };

export interface DecisionResult {
  run: RunState;
  message: string;
}

/** Answers the oldest pending decision. Replacing or releasing can't be undone, so the screen confirms first. */
export function resolveDecision(content: Content, current: RunState, choice: DecisionChoice): DecisionResult {
  assertPhase(current, 'decision');
  const run = structuredClone(current);
  const decision = run.pending[0];
  if (!decision) throw new Error('No decision is pending');
  let message: string;
  let followUp: PendingDecision | null = null;

  if (decision.kind === 'learnMove') {
    const mon = run.party.find((p) => p.uid === decision.uid);
    const move = content.moves.get(decision.moveId)!;
    if (!mon) {
      message = '';
    } else if (choice.kind === 'forgetMove') {
      const old = mon.moves[choice.moveIndex];
      if (!old) throw new Error(`Invalid move slot ${choice.moveIndex}`);
      mon.moves[choice.moveIndex] = { id: move.id, pp: move.pp };
      message = `${speciesName(content, mon.speciesId)} forgot ${content.moves.get(old.id)!.name} and learned ${move.name}!`;
    } else if (choice.kind === 'skipMove') {
      message = `${speciesName(content, mon.speciesId)} did not learn ${move.name}.`;
    } else {
      throw new Error('Choose a move to forget, or skip');
    }
  } else if (decision.kind === 'caught') {
    const caught = decision.mon;
    const name = speciesName(content, caught.speciesId);
    if (choice.kind === 'addToParty') {
      if (run.party.length >= content.balance.partyMax) throw new Error('Your party is full');
      run.party.push(caught);
      count(run, 'caughtKept');
      message = `${name} joined your party!`;
    } else if (choice.kind === 'replace') {
      const old = run.party[choice.partyIndex];
      if (!old) throw new Error('Choose a party member to replace');
      run.party[choice.partyIndex] = caught;
      count(run, 'caughtKept');
      message = `${speciesName(content, old.speciesId)} left the party. ${name} joined!`;
    } else if (choice.kind === 'release') {
      const candies = candiesForRelease(content, caught.level);
      run.candies += candies;
      count(run, 'candiesEarned', candies);
      count(run, 'caughtToCandies');
      message = `${name} was released. You got ${candies} cand${candies === 1 ? 'y' : 'ies'}.`;
      recordReleased(content, run, caught);
    } else {
      throw new Error('Choose what to do with the caught Pokémon');
    }
  } else if (decision.kind === 'reunion') {
    const mon = decision.mon;
    const name = speciesName(content, mon.speciesId);
    if (choice.kind === 'addToParty') {
      if (run.party.length >= content.balance.partyMax) throw new Error('Your party is full');
      run.party.push(mon);
      message = `${name} joined your party again!`;
    } else if (choice.kind === 'replace') {
      const old = run.party[choice.partyIndex];
      if (!old) throw new Error('Choose a party member to replace');
      run.party[choice.partyIndex] = mon;
      message = `${speciesName(content, old.speciesId)} left the party. ${name} joined you again!`;
    } else if (choice.kind === 'keepsake') {
      const candies = candiesForRelease(content, mon.level) * content.balance.reunion.keepsakeCandyMultiplier;
      run.candies += candies;
      count(run, 'candiesEarned', candies);
      message = `${name} left you a keepsake: ${candies} cand${candies === 1 ? 'y' : 'ies'}.`;
    } else if (choice.kind === 'release') {
      message = `${name} went on with its own journey.`;
    } else {
      throw new Error('Choose what to do with the past Pokémon');
    }
  } else if (decision.kind === 'teachMove') {
    const mon = run.party.find((p) => p.uid === decision.uid);
    if (!mon) {
      message = '';
    } else if (choice.kind === 'teachMove') {
      const moveId = decision.moveIds[choice.moveIndex];
      if (!moveId) throw new Error(`Invalid move choice ${choice.moveIndex}`);
      const move = content.moves.get(moveId)!;
      if (mon.moves.length < 4) {
        mon.moves.push({ id: move.id, pp: move.pp });
        message = `${speciesName(content, mon.speciesId)} learned ${move.name}!`;
      } else {
        // Four moves known: ask which to forget, like a level-up move.
        followUp = { kind: 'learnMove', uid: mon.uid, moveId };
        message = `${speciesName(content, mon.speciesId)} wants to learn ${move.name}.`;
      }
    } else if (choice.kind === 'skipMove') {
      message = `The ${decision.itemName} went unused.`;
    } else {
      throw new Error('Choose a move to teach, or skip');
    }
  } else {
    const mon = run.party.find((p) => p.uid === decision.uid);
    if (!mon) {
      message = '';
    } else if (choice.kind === 'ppUpMove') {
      const slot = mon.moves[choice.moveIndex];
      if (!slot) throw new Error(`Invalid move slot ${choice.moveIndex}`);
      const room = MAX_PP_UPS - (slot.ppUps ?? 0);
      if (room <= 0) throw new Error('That move already has the most PP it can.');
      const before = maxPp(content, slot);
      slot.ppUps = (slot.ppUps ?? 0) + Math.min(room, decision.ups);
      slot.pp += maxPp(content, slot) - before;
      message = `${content.moves.get(slot.id)!.name}'s max PP rose to ${maxPp(content, slot)}!`;
    } else if (choice.kind === 'skipMove') {
      message = `The ${decision.itemName} went unused.`;
    } else {
      throw new Error('Choose a move for the ' + decision.itemName);
    }
  }

  run.pending.shift();
  if (followUp) run.pending.unshift(followUp);
  continueAfterDecisions(content, run);
  recordChanges(content, current, run, 'level');
  return { run, message };
}

export interface RewardChoiceResult {
  run: RunState;
  reward: RewardResult;
}

/**
 * Applies exactly one reward from the draft. Rewards for a Pokémon go to
 * `targetIndex`. Then any new decisions (from a level-up), then the next battle.
 */
export function chooseReward(content: Content, current: RunState, draftIndex: number, targetIndex = 0): RewardChoiceResult {
  assertPhase(current, 'reward');
  const rewardId = current.draft?.[draftIndex];
  if (!rewardId) throw new Error(`Invalid reward choice ${draftIndex}`);
  const problem = rewardTargetProblem(content, current, content.rewards.get(rewardId)!, targetIndex);
  if (problem) throw new Error(problem);
  const run = structuredClone(current);
  const reward = withStream(run.rng, 'reward', (r) => applyReward(content, run, getArchetype(content, run.archetypeId), rewardId, targetIndex, r));
  count(run, 'moneyEarned', run.money - current.money);
  if (reward.reroll) {
    // A free re-roll: a fresh draft, still in the reward phase.
    const weights = luckWeights(rewardWeights(content, run), runAttributeEffects(content, run));
    run.draft = newDraft(content, run, weights);
    return { run, reward };
  }
  // Favored Mail: the best reward you skipped comes back in the next draft (the earlier one on a tie).
  const favored = perkItem(content, run, 'favored');
  if (favored) {
    const skipped = current.draft!.filter((_, i) => i !== draftIndex).map((id) => content.rewards.get(id)!);
    const best = skipped.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity))[0];
    if (best) {
      spendUse(run, favored);
      carryReward(run, best.id);
      reward.messages.push(`The Favored Mail keeps ${best.name} for your next draft.`);
    }
  }
  run.draft = null;
  run.pending.push(...reward.pending);
  run.afterDecisions = 'map';
  recordRewardTaken(content, run, rewardId);
  continueAfterDecisions(content, run);
  recordChanges(content, current, run, 'reward');
  return { run, reward };
}

/** Uses a Bag item on a party member between battles. */
export function useItemOutsideBattle(content: Content, current: RunState, itemId: string, partyIndex: number, evolveTo?: string): { run: RunState; message: string } {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  const item = getItem(content, itemId);
  if (!item.usableOutside) throw new Error(`${item.name} can't be used outside battle`);
  if (itemCount(current.inventory, itemId) <= 0) throw new Error(`You have no ${item.name}`);
  const target = current.party[partyIndex];
  if (!target) throw new Error('Choose a Pokémon');
  const regionId = current.regionOrder[current.regionIndex];
  const problem = itemUseProblem(content, item, target, regionId);
  if (problem) throw new Error(problem);
  const run = structuredClone(current);
  const message = applyItemToPokemon(content, item, run.party[partyIndex]!, {
    regionId,
    evolveTo,
    healMultiplier: healingMultiplier(getArchetype(content, run.archetypeId)) * runAttributeEffects(content, run).healing,
  });
  if (item.effect.kind === 'evolve') count(run, 'evolutions');
  consumeItem(run.inventory, itemId);
  recordChanges(content, current, run, 'item');
  return { run, message };
}

/** Whether a Bag item can be cashed in now: it has a cash-in value and nobody in the party can use it. */
export function canCashIn(content: Content, run: RunState, itemId: string): boolean {
  const item = content.items.get(itemId);
  if (!item?.cashIn || itemCount(run.inventory, itemId) <= 0) return false;
  const regionId = run.regionOrder[run.regionIndex];
  return !run.party.some((mon) => itemUseProblem(content, item, mon, regionId) === null);
}

/** Trades an evolution item nobody in the party can use for its attribute bonus (M8.75 item effects). */
export function cashInItem(content: Content, current: RunState, itemId: string): { run: RunState; message: string } {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  const item = getItem(content, itemId);
  if (!canCashIn(content, current, itemId)) throw new Error(`The ${item.name} can't be cashed in right now`);
  const run = structuredClone(current);
  consumeItem(run.inventory, itemId);
  const parts = Object.entries(item.cashIn!).map(([key, amount]) => attributeText(key as AttributeKey, addRunAttribute(content, run, key as AttributeKey, amount)));
  return { run, message: `You cashed in the ${item.name}: ${parts.join(', ')}.` };
}

/** Moves a party member to the front, so it leads the next battle. */
export function setLead(current: RunState, partyIndex: number): RunState {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  if (!current.party[partyIndex]) throw new Error('No Pokémon in that slot');
  const run = structuredClone(current);
  const [mon] = run.party.splice(partyIndex, 1);
  run.party.unshift(mon!);
  return run;
}

// ---------- debug helpers ----------

/** Debug: replaces the current battle with a wild Pokémon of your choice. */
export function debugReplaceEnemy(content: Content, current: RunState, speciesId: string, level: number): RunState {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const enemy = newMon(content, run, speciesId, level, 'e');
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  run.battle = createBattle('wild', [enemy], activeIndex, run.party[activeIndex]!.uid);
  recordBattleStarted(content, run);
  return run;
}

/** Debug: adds a Pokémon to the party (if there is room). */
export function debugAddToParty(content: Content, current: RunState, speciesId: string, level: number): RunState {
  if (current.party.length >= content.balance.partyMax) throw new Error('Your party is full');
  const run = structuredClone(current);
  run.party.push(newMon(content, run, speciesId, level, 'p'));
  recordChanges(content, current, run, 'debug');
  return run;
}

/** Debug: fully heals the party and restores PP. */
export function debugHealParty(content: Content, current: RunState): RunState {
  const run = structuredClone(current);
  healParty(content, run);
  return run;
}

/** Debug: moves the player to a node in the column before `column`, so `column` is next. */
export function debugJumpToColumn(current: RunState, column: number): RunState {
  assertPhase(current, 'map');
  const stage = requireStage(current);
  const run = structuredClone(current);
  if (column <= 1) {
    run.stage!.current = null;
    return run;
  }
  const before = stage.map.nodes.find((n) => n.column === Math.min(column, stage.map.columns) - 1);
  if (!before) throw new Error(`No column ${column - 1}`);
  run.stage!.current = before.id;
  return run;
}

/** Debug: skips the rest of the region's stages and goes straight to its Pokémon League. */
export function debugJumpToLeague(content: Content, current: RunState): RunState {
  assertPhase(current, 'map');
  const run = structuredClone(current);
  enterLeague(content, run);
  return run;
}

/** Debug: adds items to the Bag. */
export function debugGiveItem(content: Content, current: RunState, itemId: string, quantity: number): RunState {
  getItem(content, itemId);
  const run = structuredClone(current);
  addItem(run.inventory, itemId, quantity);
  return run;
}
