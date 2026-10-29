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

import { captureMultiplier, getArchetype, healingMultiplier, moneyMultiplier, priceMultiplier, shopUnlockOffset, typeModifiers, xpMultiplier } from './archetypes';
import { createBattle, resolveTurn, startBattle, type BattleContext, type BattleEvent, type PlayerAction } from './battle/engine';
import { endBattle as endHeldBattle, expMultiplier, giveBossItems, growthOnLevelUp } from './battle/held';
import { bossMechanics, revertTransformations } from './battle/transform';
import type { AttributeKey, Content } from './contentSchema';
import {
  candiesForRelease,
  CHAMPION_CLASS,
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
import { findNode, generateLeagueMap, generateStageMap, nextChoices, validateLeagueMap, validateStageMap } from './map';
import { addRunAttribute, attributeText, luckWeights, readAttributes, runAttributeEffects, zeroAttributes } from './attributes';
import { count, discover } from './progress';
import { passivePercent } from './catalog';
import { defaultPrep, draftStarters, startingResources } from './runPrep';
import { currentRegion, generateRegionOrder, getCampaign, pickLeague, runLevelCap } from './regions';
import {
  activeMods,
  afterPurchase,
  afterTrainerWin,
  earlyStockCount,
  mapItemRng,
  type MapItemRun,
  priceMultiplierFromItems,
  prizeMoneyFromItems,
  regionMoneyFromItems,
  repelActive,
  startStageEffects,
  throwMultiplier,
  useRepel,
  useThrowCharges,
  useUses,
  useWildBattleCharges,
  wildBattleSetup,
  wildExpMultiplier,
  wildLevelBonus,
  wildShinyMultiplier,
  wildSpeciesWithItems,
} from './mapItems';
import { createStreams, hashSeed, Rng, withStream } from './rng';
import { currentEnemy, type MapNode, type RunPrep, type PendingDecision, type PokemonInstance, type RunState, type StageState } from './state';
import { getTheme, pickGymLeader, pickTheme } from './themes';
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
import type { PresentationCue } from './story/queue';
import { createStoryState } from './story/record';

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
  const starterChoices = draft.choices;
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
  };
  recordRunStarted(content, run);
  return run;
}

function assertPhase(run: RunState, ...phases: RunState['phase'][]): void {
  if (!phases.includes(run.phase)) throw new Error(`Action needs phase "${phases.join('" or "')}" but run is in "${run.phase}"`);
}

function nextUid(run: RunState, prefix: string): string {
  const uid = `${prefix}${run.nextUid}`;
  run.nextUid += 1;
  return uid;
}

/** A new Pokémon for this run; its ability comes from the run seed and its uid. */
function newMon(content: Content, run: RunState, speciesId: string, level: number, prefix: 'p' | 'e'): PokemonInstance {
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
  const choices = nextChoices(requireStage(current));
  if (!choices.some((n) => n.id === nodeId)) throw new Error(`Node "${nodeId}" is not one of the next choices`);
  const run = structuredClone(current);
  const stage = run.stage!;
  stage.current = nodeId;
  stage.visited.push(nodeId);
  const node = findNode(stage.map, nodeId);
  recordRouteChosen(content, run, nodeId, node.harder, node.kind);
  // A Repel keeps a wild Pokémon away: no battle and no reward, but the level counts.
  if (node.kind === 'wild' && repelActive(content, run)) {
    useRepel(content, run);
    return run;
  }
  startEncounter(content, run, node);
  return run;
}

/** Sets up the battle for a map node (mutates `run`). */
function startEncounter(content: Content, run: RunState, node: MapNode): void {
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
    const plan: TrainerPlan = withStream(run.rng, 'encounter', (r) => {
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
    const team = plan.members.map((m) => {
      const uid = nextUid(run, 'e');
      return createPlannedPokemon(content, m, uid, `${run.seed}:${uid}`);
    });
    run.battle = createBattle('trainer', team, activeIndex, activeUid, { classId: plan.classId, name: plan.name, leaderId: plan.leaderId });
    run.battle.ai = plan.ai;
    run.battle.levelInfo = plan.levelInfo;
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
  const run = structuredClone(current);
  const runSide = findNode(run.stage!.map, stage.current).sides.find((s) => s.id === sideId)!;
  if (side.kind === 'heal') {
    healParty(content, run);
    runSide.used = true;
    count(run, 'healStopsUsed');
    return { run, message: 'Your Pokémon were fully healed!' };
  }
  run.phase = 'shop';
  return { run, message: 'Welcome to the shop!' };
}

function healParty(content: Content, run: RunState): void {
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

/** Key items and Mega Stones last the whole run, so you only ever need one. */
function ownsKeepsake(content: Content, inventory: Record<string, number>, itemId: string): boolean {
  const kind = content.items.get(itemId)?.effect.kind;
  return (kind === 'keyItem' || kind === 'megaStone') && itemCount(inventory, itemId) > 0;
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
}

/** The battle engine's view of the run's battle (the engine changes `run` in place). */
function battleContext(content: Content, run: RunState, rng: Rng, captureRng: Rng): BattleContext {
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
    teamItems: run.passives,
  };
}

/**
 * Battle start: plays both first Pokémon's entry abilities (Intimidate,
 * Drizzle). Does nothing if they already happened. Uses no random numbers.
 */
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

export function takeTurn(content: Content, current: RunState, action: PlayerAction): TurnResult {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const battle = run.battle!;
  const rng = new Rng(run.rng.battle);
  const captureRng = new Rng(run.rng.capture);
  const targetUid = currentEnemy(battle).uid;
  const engineEvents = resolveTurn(battleContext(content, run, rng, captureRng), action);
  run.rng.battle = rng.state;
  run.rng.capture = captureRng.state;
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
    return { run, events, end, defeated: false, cues };
  }
  if (battle.outcome === 'lose') {
    const enemy = currentEnemy(battle);
    run.log.defeatedBy = { speciesId: enemy.speciesId, level: enemy.level, trainer: battle.trainer?.name ?? null };
    run.phase = 'over';
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: true, cues };
  }
  recordChanges(content, current, run, 'battle');
  return { run, events, end: null, defeated: false, cues };
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
    const trainerClass = content.trainers.get(battle.trainer.classId)!;
    base = trainerClass.moneyPerLevel * topLevel;
  } else {
    base = content.balance.money.wildPerEnemyLevel * currentEnemy(battle).level;
  }
  // Amulet Coin (all prize money) and Luck Incense (trainers only) add their percent per copy.
  const itemBonus = passivePercent(content, run, 'money') + (battle.kind === 'trainer' ? passivePercent(content, run, 'trainerMoney') : 0);
  // Reply and Bead Mail (trainers), Soot Sack (wild battles on its type's stages).
  const theme = run.stage ? (content.themes.get(run.stage.themeId) ?? null) : null;
  const mapItemMoney = prizeMoneyFromItems(content, run, battle.kind, theme);
  const moneyGained = Math.floor(base * moneyMultiplier(archetype) * runAttributeEffects(content, run).money * (1 + (itemBonus + mapItemMoney.percent) / 100)) + mapItemMoney.flat;
  run.money += moneyGained;
  count(run, 'moneyEarned', moneyGained);

  let caughtSpeciesId: string | null = null;
  const caughtPending: PendingDecision[] = [];
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
    const gainMultiplier = runAttributeEffects(content, run).friendship;
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
  const itemsFound =
    outcome === 'win' && battle.kind === 'trainer'
      ? afterTrainerWin(content, run, shopStock(content, run).map((e) => ({ item: e.item, price: e.price })), new Rng(hashSeed(`${run.seed}::trainer-loot::${run.encountersCompleted}`)))
      : [];
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
  run.afterDecisions = 'reward';
  continueAfterDecisions(content, run);
  return { outcome, moneyGained, itemsFound, caughtSpeciesId, evolutions, badge, regionCleared, victory: run.victory };
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
function continueAfterDecisions(content: Content, run: RunState): void {
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
    const weights = luckWeights(rewardWeights(content, run), runAttributeEffects(content, run));
    run.draft = withStream(run.rng, 'reward', (r) => generateDraft(content, run, r, weights));
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
    run.draft = withStream(run.rng, 'reward', (r) => generateDraft(content, run, r, weights));
    return { run, reward };
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
