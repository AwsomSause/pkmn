// The run "state machine". Every player action is a function that takes the
// current run state and returns a NEW run state (the old one is untouched),
// plus whatever the screens need to show what happened.
//
// Phases:  starter → battle ⇄ reward → ... → over

import { getArchetype, moneyMultiplier, xpMultiplier } from './archetypes';
import { createWildBattle, resolveTurn, type BattleEvent } from './battle/engine';
import type { Content } from './contentSchema';
import { enemyLevel, generateStarterChoices, pickWildSpecies, type EnemyLevelBreakdown } from './encounters';
import { createPokemon, gainXp, getSpecies, maxHp, xpForDefeat, type LevelUpResult } from './pokemon';
import { applyReward, generateDraft, type RewardResult } from './rewards';
import { createStreams, withStream } from './rng';
import { ATTRIBUTE_NAMES, type RunState } from './state';

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
    encountersCompleted: 0,
    battle: null,
    draft: null,
    attributeModifiers: Object.fromEntries(ATTRIBUTE_NAMES.map((a) => [a, 0])),
    rng,
    nextUid: 1,
    log: { rewardsTaken: [], battlesWon: 0 },
  };
}

function assertPhase(run: RunState, phase: RunState['phase']): void {
  if (run.phase !== phase) throw new Error(`Action needs phase "${phase}" but run is in "${run.phase}"`);
}

function nextUid(run: RunState, prefix: string): string {
  const uid = `${prefix}${run.nextUid}`;
  run.nextUid += 1;
  return uid;
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

/** Sets up the next wild battle (mutates `run`). Returns the level breakdown for debugging. */
function startNextEncounter(content: Content, run: RunState): EnemyLevelBreakdown {
  const archetype = getArchetype(content, run.archetypeId);
  const { speciesId, level } = withStream(run.rng, 'encounter', (r) => {
    const speciesId = pickWildSpecies(content, r);
    return { speciesId, level: enemyLevel(content, archetype, run.encountersCompleted, r) };
  });
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const enemy = createPokemon(content, speciesId, level.level, nextUid(run, 'e'));
  run.battle = createWildBattle(enemy, activeIndex, run.party[activeIndex]!.uid);
  run.phase = 'battle';
  return level;
}

export interface VictoryResult {
  xpGained: number;
  moneyGained: number;
  levelUp: LevelUpResult;
}

export interface TurnResult {
  run: RunState;
  events: BattleEvent[];
  victory: VictoryResult | null;
  defeated: boolean;
}

export function takeTurn(content: Content, current: RunState, moveIndex: number): TurnResult {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const battle = run.battle!;
  const events = withStream(run.rng, 'battle', (rng) => resolveTurn({ content, battle, party: run.party, rng }, moveIndex));

  if (battle.outcome === 'win') {
    const victory = awardVictory(content, run);
    run.battle = null;
    run.encountersCompleted += 1;
    run.log.battlesWon += 1;
    run.draft = withStream(run.rng, 'reward', (r) => generateDraft(content, run, r));
    run.phase = 'reward';
    return { run, events, victory, defeated: false };
  }
  if (battle.outcome === 'lose') {
    // Milestone 1 has a one-Pokémon party, so the active Pokémon fainting ends
    // the run. Switching and the Last Stand Charm arrive in Milestone 2.
    if (!run.party.some((p) => p.hp > 0)) run.phase = 'over';
    return { run, events, victory: null, defeated: run.phase === 'over' };
  }
  return { run, events, victory: null, defeated: false };
}

function awardVictory(content: Content, run: RunState): VictoryResult {
  const archetype = getArchetype(content, run.archetypeId);
  const battle = run.battle!;
  const enemy = battle.enemy;
  const enemySpecies = getSpecies(content, enemy.speciesId);
  const winner = run.party[battle.activeIndex]!;
  const xpGained = xpForDefeat(enemySpecies.baseExp, enemy.level, winner.level, xpMultiplier(archetype));
  const levelUp = gainXp(content, winner, xpGained);
  const moneyGained = Math.floor(content.balance.money.wildPerEnemyLevel * enemy.level * moneyMultiplier(archetype));
  run.money += moneyGained;
  return { xpGained, moneyGained, levelUp };
}

export interface RewardChoiceResult {
  run: RunState;
  reward: RewardResult;
}

/** Applies exactly one reward from the draft and moves on to the next encounter. */
export function chooseReward(content: Content, current: RunState, draftIndex: number): RewardChoiceResult {
  assertPhase(current, 'reward');
  const rewardId = current.draft?.[draftIndex];
  if (!rewardId) throw new Error(`Invalid reward choice ${draftIndex}`);
  const run = structuredClone(current);
  const reward = applyReward(content, run, getArchetype(content, run.archetypeId), rewardId);
  run.draft = null;
  startNextEncounter(content, run);
  return { run, reward };
}

/** Debug helper: replaces the current wild opponent. */
export function debugReplaceEnemy(content: Content, current: RunState, speciesId: string, level: number): RunState {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const enemy = createPokemon(content, speciesId, level, nextUid(run, 'e'));
  const active = run.party[run.battle!.activeIndex]!;
  run.battle = createWildBattle(enemy, run.battle!.activeIndex, active.uid);
  return run;
}

/** Debug helper: fully heals the party and restores PP. */
export function debugHealParty(content: Content, current: RunState): RunState {
  const run = structuredClone(current);
  for (const mon of run.party) {
    mon.hp = maxHp(content, mon);
    mon.status = null;
    for (const slot of mon.moves) slot.pp = content.moves.get(slot.id)!.pp;
  }
  return run;
}
