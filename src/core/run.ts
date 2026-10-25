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

import { captureMultiplier, getArchetype, moneyMultiplier, xpMultiplier } from './archetypes';
import { createBattle, resolveTurn, type BattleEvent, type PlayerAction } from './battle/engine';
import type { Content } from './contentSchema';
import {
  candiesForRelease,
  CHAMPION_CLASS,
  ELITE_FOUR_CLASS,
  generateStarterChoices,
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
import { addItem, applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem } from './items';
import { createPokemon, gainXp, getSpecies, maxHp, xpForDefeat } from './pokemon';
import { applyReward, generateDraft, rewardTargetProblem, type RewardResult } from './rewards';
import { findNode, generateLeagueMap, generateStageMap, nextChoices, validateLeagueMap, validateStageMap } from './map';
import { currentRegion, generateRegionOrder, getCampaign, pickLeague, runLevelCap } from './regions';
import { createStreams, Rng, withStream } from './rng';
import { ATTRIBUTE_NAMES, currentEnemy, type MapNode, type PendingDecision, type PokemonInstance, type RunState, type StageState } from './state';
import { getTheme, pickGymLeader, pickTheme } from './themes';

export interface NewRunOptions {
  runId: string;
  seed: string;
  archetypeId: string;
  /** "full" (default) or a shorter campaign such as "dev". */
  campaignId?: string;
}

export function createRun(content: Content, opts: NewRunOptions): RunState {
  getArchetype(content, opts.archetypeId); // throws if unknown
  const campaign = getCampaign(content, opts.campaignId ?? 'full');
  const rng = createStreams(opts.seed);
  const starterChoices = withStream(rng, 'starter', (r) => generateStarterChoices(content, r));
  const regionOrder = withStream(rng, 'map', (r) => generateRegionOrder(content, campaign, r));
  return {
    runId: opts.runId,
    seed: opts.seed,
    archetypeId: opts.archetypeId,
    phase: 'starter',
    starterChoices,
    party: [],
    money: content.balance.money.startingMoney,
    inventory: { ...content.balance.startingItems },
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
    attributeModifiers: Object.fromEntries(ATTRIBUTE_NAMES.map((a) => [a, 0])),
    rng,
    nextUid: 1,
    log: { rewardsTaken: [], battlesWon: 0 },
  };
}

function assertPhase(run: RunState, ...phases: RunState['phase'][]): void {
  if (!phases.includes(run.phase)) throw new Error(`Action needs phase "${phases.join('" or "')}" but run is in "${run.phase}"`);
}

function nextUid(run: RunState, prefix: string): string {
  const uid = `${prefix}${run.nextUid}`;
  run.nextUid += 1;
  return uid;
}

function speciesName(content: Content, id: string): string {
  return getSpecies(content, id).name;
}

export function chooseStarter(content: Content, current: RunState, choiceIndex: number): RunState {
  assertPhase(current, 'starter');
  const speciesId = current.starterChoices[choiceIndex];
  if (!speciesId) throw new Error(`Invalid starter choice ${choiceIndex}`);
  const run = structuredClone(current);
  run.party = [createPokemon(content, speciesId, content.balance.starterLevel, nextUid(run, 'p'))];
  enterStage(content, run, 0);
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
  startEncounter(content, run, findNode(stage.map, nodeId));
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
    const plan = withStream(run.rng, 'encounter', (r) => {
      const [lo, hi] = content.balance.difficulty.harderBonus;
      const bonus = node.harder ? r.int(lo, hi) : 0;
      return planWild(content, archetype, theme, scale, bonus, r);
    });
    const enemy = createPokemon(content, plan.speciesId, plan.level, nextUid(run, 'e'));
    enemy.shiny = plan.shiny;
    run.battle = createBattle('wild', [enemy], activeIndex, activeUid);
    run.battle.levelInfo = [plan.levelInfo];
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
          return planTrainer(content, archetype, theme, stageNumber, scale, r);
      }
    });
    const team = plan.members.map((m) => createPlannedPokemon(content, m, nextUid(run, 'e')));
    run.battle = createBattle('trainer', team, activeIndex, activeUid, { classId: plan.classId, name: plan.name, leaderId: plan.leaderId });
    run.battle.ai = plan.ai;
    run.battle.levelInfo = plan.levelInfo;
  }
  run.phase = 'battle';
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
    return { run, message: 'Your Pokémon were fully healed!' };
  }
  run.phase = 'shop';
  return { run, message: 'Welcome to the shop!' };
}

function healParty(content: Content, run: RunState): void {
  for (const mon of run.party) {
    mon.hp = maxHp(content, mon);
    mon.status = null;
    for (const slot of mon.moves) slot.pp = content.moves.get(slot.id)!.pp;
  }
}

/** What the shop sells right now: more stock unlocks as the player earns badges. */
export function shopStock(content: Content, run: Pick<RunState, 'badges'>): Content['shop'] {
  return content.shop.filter((e) => run.badges.length >= e.minBadges);
}

/** Buys one of an item at the shop. */
export function buyItem(content: Content, current: RunState, itemId: string): { run: RunState; message: string } {
  assertPhase(current, 'shop');
  const entry = content.shop.find((e) => e.item === itemId);
  if (!entry) throw new Error(`The shop doesn't sell "${itemId}"`);
  const item = getItem(content, itemId);
  if (current.badges.length < entry.minBadges) throw new Error(`The shop sells ${item.name} once you have ${entry.minBadges} badges.`);
  if (current.money < entry.price) throw new Error(`You need ₽${entry.price} for a ${item.name}.`);
  const run = structuredClone(current);
  run.money -= entry.price;
  addItem(run.inventory, itemId, 1);
  return { run, message: `You bought a ${item.name} for ₽${entry.price}.` };
}

export function leaveShop(current: RunState): RunState {
  assertPhase(current, 'shop');
  const run = structuredClone(current);
  run.phase = 'map';
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
}

export function takeTurn(content: Content, current: RunState, action: PlayerAction): TurnResult {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const battle = run.battle!;
  const archetype = getArchetype(content, run.archetypeId);
  const rng = new Rng(run.rng.battle);
  const captureRng = new Rng(run.rng.capture);
  const engineEvents = resolveTurn(
    { content, battle, party: run.party, inventory: run.inventory, rng, captureRng, catchMultiplier: captureMultiplier(archetype) },
    action,
  );
  run.rng.battle = rng.state;
  run.rng.capture = captureRng.state;

  const events = awardExperience(content, run, engineEvents);

  if (battle.outcome === 'win' || battle.outcome === 'caught') {
    const end = finishBattle(content, run);
    return { run, events, end, defeated: false };
  }
  if (battle.outcome === 'lose') {
    run.phase = 'over';
    return { run, events, end: null, defeated: true };
  }
  return { run, events, end: null, defeated: false };
}

/**
 * Gives experience to every participant still standing when an enemy faints
 * or is caught (full experience each, as in Gen 6+). Inserts xp/level-up
 * events right after the faint or catch so they're shown in order.
 */
function awardExperience(content: Content, run: RunState, events: BattleEvent[]): RunEvent[] {
  const battle = run.battle!;
  const multiplier = xpMultiplier(getArchetype(content, run.archetypeId));
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
    for (const uid of participants) {
      const mon = run.party.find((p) => p.uid === uid);
      if (!mon || mon.hp <= 0) continue;
      const amount = xpForDefeat(baseExp, defeated.level, mon.level, multiplier);
      const result = gainXp(content, mon, amount, runLevelCap(content, run));
      out.push({ type: 'xp', uid, amount });
      if (result.levelsGained > 0) out.push({ type: 'levelUp', uid, level: result.newLevel });
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
  const moneyGained = Math.floor(base * moneyMultiplier(archetype));
  run.money += moneyGained;

  let caughtSpeciesId: string | null = null;
  const caughtPending: PendingDecision[] = [];
  if (battle.outcome === 'caught') {
    const caught = structuredClone(currentEnemy(battle));
    caught.uid = nextUid(run, 'p');
    caughtSpeciesId = caught.speciesId;
    caughtPending.push({ kind: 'caught', mon: caught });
  }

  const evolutions: BattleEndResult['evolutions'] = [];
  for (const mon of run.party) {
    for (const evo of evolveFully(content, mon)) {
      evolutions.push({ ...evo, uid: mon.uid });
      for (const moveId of evo.wantsToLearn) run.pending.push({ kind: 'learnMove', uid: mon.uid, moveId });
    }
  }
  // The caught Pokémon's decision comes first.
  run.pending = [...caughtPending, ...run.pending];

  const outcome = battle.outcome as 'win' | 'caught';
  const won = outcome === 'win' && battle.trainer?.leaderId ? battle.trainer.leaderId : null;
  const badge = won && classId === GYM_LEADER_CLASS ? won : null;
  if (badge) run.badges.push(badge);
  // The Elite Four heal your party after each battle.
  if (won && classId === ELITE_FOUR_CLASS) healParty(content, run);
  let regionCleared: string | null = null;
  if (won && classId === CHAMPION_CLASS) {
    regionCleared = currentRegion(content, run).id;
    run.regionsCleared.push(regionCleared);
    if (run.regionIndex + 1 >= run.regionOrder.length) run.victory = true;
  }
  run.battle = null;
  run.encountersCompleted += 1;
  run.log.battlesWon += 1;
  run.afterDecisions = 'reward';
  continueAfterDecisions(content, run);
  return { outcome, moneyGained, caughtSpeciesId, evolutions, badge, regionCleared, victory: run.victory };
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
    const weights = rewardWeights(content, run);
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
  | { kind: 'release' };

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
  } else {
    const caught = decision.mon;
    const name = speciesName(content, caught.speciesId);
    if (choice.kind === 'addToParty') {
      if (run.party.length >= content.balance.partyMax) throw new Error('Your party is full');
      run.party.push(caught);
      message = `${name} joined your party!`;
    } else if (choice.kind === 'replace') {
      const old = run.party[choice.partyIndex];
      if (!old) throw new Error('Choose a party member to replace');
      run.party[choice.partyIndex] = caught;
      message = `${speciesName(content, old.speciesId)} left the party. ${name} joined!`;
    } else if (choice.kind === 'release') {
      const candies = candiesForRelease(content, caught.level);
      run.candies += candies;
      message = `${name} was released. You got ${candies} cand${candies === 1 ? 'y' : 'ies'}.`;
    } else {
      throw new Error('Choose what to do with the caught Pokémon');
    }
  }

  run.pending.shift();
  continueAfterDecisions(content, run);
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
  const reward = applyReward(content, run, getArchetype(content, run.archetypeId), rewardId, targetIndex);
  run.draft = null;
  run.pending.push(...reward.pending);
  run.afterDecisions = 'map';
  continueAfterDecisions(content, run);
  return { run, reward };
}

/** Uses a Bag item on a party member between battles. */
export function useItemOutsideBattle(content: Content, current: RunState, itemId: string, partyIndex: number): { run: RunState; message: string } {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  const item = getItem(content, itemId);
  if (!item.usableOutside) throw new Error(`${item.name} can't be used outside battle`);
  if (itemCount(current.inventory, itemId) <= 0) throw new Error(`You have no ${item.name}`);
  const target = current.party[partyIndex];
  if (!target) throw new Error('Choose a Pokémon');
  const problem = itemUseProblem(content, item, target);
  if (problem) throw new Error(problem);
  const run = structuredClone(current);
  const message = applyItemToPokemon(content, item, run.party[partyIndex]!);
  consumeItem(run.inventory, itemId);
  return { run, message };
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
  const enemy = createPokemon(content, speciesId, level, nextUid(run, 'e'));
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  run.battle = createBattle('wild', [enemy], activeIndex, run.party[activeIndex]!.uid);
  return run;
}

/** Debug: adds a Pokémon to the party (if there is room). */
export function debugAddToParty(content: Content, current: RunState, speciesId: string, level: number): RunState {
  if (current.party.length >= content.balance.partyMax) throw new Error('Your party is full');
  const run = structuredClone(current);
  run.party.push(createPokemon(content, speciesId, level, nextUid(run, 'p')));
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
