// The run "state machine". Every player action is a function that takes the
// current run state and returns a NEW run state (the old one is untouched),
// plus whatever the screens need to show what happened.
//
// Phases:  starter → battle → (decision) → reward → (decision) → battle → ... → over
//   decision = choices the player must make: learning a move, or what to do
//              with a caught Pokémon.

import { captureMultiplier, getArchetype, moneyMultiplier, xpMultiplier } from './archetypes';
import { createBattle, resolveTurn, type BattleEvent, type PlayerAction } from './battle/engine';
import type { Content } from './contentSchema';
import {
  candiesForRelease,
  enemyLevel,
  generateStarterChoices,
  isTrainerEncounter,
  pickWildSpecies,
  planTrainer,
  rollShiny,
} from './encounters';
import { evolveFully, type EvolutionResult } from './evolution';
import { addItem, applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem } from './items';
import { createPokemon, gainXp, getSpecies, maxHp, xpForDefeat } from './pokemon';
import { applyReward, generateDraft, rewardTargetProblem, type RewardResult } from './rewards';
import { createStreams, Rng, withStream } from './rng';
import { ATTRIBUTE_NAMES, currentEnemy, type PendingDecision, type PokemonInstance, type RunState } from './state';

export interface NewRunOptions {
  runId: string;
  seed: string;
  archetypeId: string;
}

export function createRun(content: Content, opts: NewRunOptions): RunState {
  getArchetype(content, opts.archetypeId); // throws if unknown
  const rng = createStreams(opts.seed);
  const starterChoices = withStream(rng, 'starter', (r) => generateStarterChoices(content, r));
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
  startNextEncounter(content, run);
  return run;
}

/** Sets up the next battle (mutates `run`): a trainer every Nth encounter, otherwise a wild Pokémon. */
function startNextEncounter(content: Content, run: RunState): void {
  const archetype = getArchetype(content, run.archetypeId);
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const activeUid = run.party[activeIndex]!.uid;

  if (isTrainerEncounter(content, run.encountersCompleted + 1)) {
    const plan = withStream(run.rng, 'encounter', (r) => planTrainer(content, archetype, run.encountersCompleted, r));
    const team = plan.members.map((m) => createPokemon(content, m.speciesId, m.level, nextUid(run, 'e')));
    run.battle = createBattle('trainer', team, activeIndex, activeUid, { classId: plan.classId, name: plan.name });
  } else {
    const { speciesId, level, shiny } = withStream(run.rng, 'encounter', (r) => {
      const speciesId = pickWildSpecies(content, r);
      const level = enemyLevel(content, archetype, run.encountersCompleted, r).level;
      return { speciesId, level, shiny: rollShiny(content, r) };
    });
    const enemy = createPokemon(content, speciesId, level, nextUid(run, 'e'));
    enemy.shiny = shiny;
    run.battle = createBattle('wild', [enemy], activeIndex, activeUid);
  }
  run.phase = 'battle';
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
      const result = gainXp(content, mon, amount);
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
  if (battle.kind === 'trainer' && battle.trainer) {
    const trainerClass = content.trainers.get(battle.trainer.classId)!;
    base = trainerClass.moneyPerLevel * Math.max(...battle.enemyTeam.map((m) => m.level));
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
  run.battle = null;
  run.encountersCompleted += 1;
  run.log.battlesWon += 1;
  run.afterDecisions = 'reward';
  continueAfterDecisions(content, run);
  return { outcome, moneyGained, caughtSpeciesId, evolutions };
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
  if (run.afterDecisions === 'reward') {
    run.draft = withStream(run.rng, 'reward', (r) => generateDraft(content, run, r));
    run.phase = 'reward';
  } else {
    startNextEncounter(content, run);
  }
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
  run.afterDecisions = 'battle';
  continueAfterDecisions(content, run);
  return { run, reward };
}

/** Uses a Bag item on a party member between battles. */
export function useItemOutsideBattle(content: Content, current: RunState, itemId: string, partyIndex: number): { run: RunState; message: string } {
  assertPhase(current, 'reward', 'decision');
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
  assertPhase(current, 'reward', 'decision');
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
  for (const mon of run.party) {
    mon.hp = maxHp(content, mon);
    mon.status = null;
    for (const slot of mon.moves) slot.pp = content.moves.get(slot.id)!.pp;
  }
  return run;
}

/** Debug: adds items to the Bag. */
export function debugGiveItem(content: Content, current: RunState, itemId: string, quantity: number): RunState {
  getItem(content, itemId);
  const run = structuredClone(current);
  addItem(run.inventory, itemId, quantity);
  return run;
}
