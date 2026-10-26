// The turn-based battle engine. It knows nothing about graphics: it takes the
// battle state plus the player's choice, changes the state, and returns a list
// of events ("Bulbasaur used Vine Whip", "It's super effective!", ...) that the
// battle screen plays back in order.
//
// Turn order: switching and items happen first, then moves (priority, then
// Speed, then a seeded coin flip), then end-of-turn damage (weather, burn,
// poison, binding, Leech Seed), then fainted Pokémon are replaced.
//
// A Pokémon charging a two-turn move (Solar Beam, Fly) or locked into Thrash
// must use that move next turn: the player's move choice is replaced by it.

import type { TypeModifiers } from '../archetypes';
import type { AttributeEffects } from '../attributes';
import type { BoostStat, Content, Move, Semi, StatusId, TransformKind, TypeName, Weather } from '../contentSchema';
import { catchProbability, resolveCatchRoll } from '../capture';
import { applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem, lastStandItemId } from '../items';
import { calcStats, getSpecies } from '../pokemon';
import type { Rng } from '../rng';
import { cooldownKey, hasBattleEffect, markBattleEffect } from '../story/ledger';
import { currentEnemy, freshHeldState, freshStages, freshTransform, freshVolatile, type BattleState, type PokemonInstance, type Stages, type Volatile } from '../state';
import {
  calcDamage,
  clampStage,
  confusionHitChance,
  lowHpPower,
  multiHitCount,
  ohkoAccuracy,
  compareTurnOrder,
  critChance,
  effectiveSpeed,
  hitChance,
  isStatusImmune,
  typeEffectiveness,
} from './damage';
import * as Held from './held';
import { applyTransformations, transformProblem, type TransformEvent, type TransformRequest } from './transform';

export type Side = 'player' | 'enemy';

export type BattleEvent =
  | { type: 'move'; side: Side; moveId: string }
  | { type: 'noPp'; side: Side }
  | { type: 'miss'; side: Side }
  | { type: 'damage'; side: Side; amount: number; hpAfter: number; effectiveness: number; crit: boolean }
  | { type: 'noEffect'; side: Side }
  | { type: 'fail'; side: Side }
  | { type: 'status'; side: Side; status: StatusId }
  | { type: 'stat'; side: Side; stat: BoostStat; change: number }
  | { type: 'statLimit'; side: Side; stat: BoostStat; up: boolean }
  | { type: 'cant'; side: Side; reason: 'slp' | 'frz' | 'par' | 'flinch' | 'recharge' }
  /** Became confused; `confusion` is the "is confused!" check at the start of its move; `confusionEnd` snapped out. */
  | { type: 'confused'; side: Side }
  | { type: 'confusion'; side: Side }
  | { type: 'confusionEnd'; side: Side }
  | { type: 'confusionHit'; side: Side; amount: number; hpAfter: number }
  /** A multi-hit move hit this many times. */
  | { type: 'hits'; side: Side; count: number }
  | { type: 'heal'; side: Side; amount: number; hpAfter: number }
  /** `protect`: it protected itself; `protected`: it blocked a move. */
  | { type: 'protect'; side: Side }
  | { type: 'protected'; side: Side }
  | { type: 'ohko'; side: Side }
  /** The user fainted from its own move (Explosion). */
  | { type: 'selfKo'; side: Side }
  | { type: 'bound'; side: Side; moveId: string }
  | { type: 'bindDamage'; side: Side; amount: number; hpAfter: number }
  | { type: 'bindEnd'; side: Side }
  | { type: 'seeded'; side: Side }
  | { type: 'seedDamage'; side: Side; amount: number; hpAfter: number }
  /** First turn of a two-turn move; `semi` says where it hid, if anywhere. */
  | { type: 'charge'; side: Side; moveId: string; semi: Semi | null }
  /** A move missed because the target was hidden (in the air, underground, ...). */
  | { type: 'avoided'; side: Side }
  /** Thrash and Outrage ended and the user became confused from fatigue. */
  | { type: 'fatigue'; side: Side }
  | { type: 'weather'; weather: Weather }
  | { type: 'weatherEnd'; weather: Weather }
  | { type: 'weatherDamage'; side: Side; weather: Weather; amount: number; hpAfter: number }
  | { type: 'wake'; side: Side }
  | { type: 'thaw'; side: Side }
  | { type: 'residual'; side: Side; status: StatusId; amount: number; hpAfter: number }
  | { type: 'drain'; side: Side; amount: number; hpAfter: number }
  | { type: 'recoil'; side: Side; amount: number; hpAfter: number }
  | { type: 'lastStand'; side: Side; itemId: string }
  /** Love: the Pokémon hung on at 1 HP. */
  | { type: 'endure'; side: Side }
  /** `uid` and `participants` let the run award experience for this faint. */
  | { type: 'faint'; side: Side; uid: string; participants: string[] }
  | { type: 'switchOut'; side: Side; uid: string }
  | { type: 'switchIn'; side: Side; uid: string; speciesId: string; level: number }
  | { type: 'item'; itemId: string; targetUid: string; message: string; hpAfter: number }
  | { type: 'ball'; itemId: string; shakes: number; caught: boolean }
  | Held.HeldEvent
  /** Mega Evolution / Primal Reversion (battle/transform.ts). */
  | TransformEvent;

export type PlayerAction =
  /** `transform`: Mega Evolve (etc.) before moving this turn. */
  | { kind: 'move'; index: number; transform?: TransformRequest }
  | { kind: 'switch'; partyIndex: number }
  | { kind: 'item'; itemId: string; targetIndex?: number };

interface Combatant {
  side: Side;
  mon: PokemonInstance;
  stages: Stages;
  /** Battle-only conditions (confusion, recharge, Protect, binding, Leech Seed). */
  vol: Volatile;
  flinched: boolean;
  /** Protected by Protect this turn. */
  protected: boolean;
}

export interface BattleContext {
  content: Content;
  battle: BattleState;
  party: PokemonInstance[];
  /** Bag contents (items used in battle are removed from here). */
  inventory: Record<string, number>;
  /** The "battle" random stream. */
  rng: Rng;
  /** The "capture" random stream. */
  captureRng: Rng;
  /** Multiplier on the final catch probability (e.g. Green's 0.85). */
  catchMultiplier: number;
  /** Multiplier on HP restored by healing items used in battle (a trainer passive). */
  healMultiplier?: number;
  /** The trainer's type-based damage multipliers for the player's side. */
  typeModifiers?: TypeModifiers;
  /** The player's attributes (damage, Speed, damage taken, Love's chance to hang on). */
  attributes?: AttributeEffects;
  /** The player's team items (run.passives): the Plates help every team member. */
  teamItems?: Record<string, number>;
  /** Transformations switched off for this run (a challenge). */
  disabledMechanics?: readonly TransformKind[];
  /**
   * Set during a turn: the side that loses if both sides run out of Pokémon at
   * once (the user of Explosion loses; the user of a recoil move wins).
   */
  doubleKoLoser?: Side;
}

export function createBattle(
  kind: BattleState['kind'],
  enemyTeam: PokemonInstance[],
  activeIndex: number,
  activeUid: string,
  trainer: BattleState['trainer'] = null,
): BattleState {
  return {
    kind,
    turn: 1,
    activeIndex,
    enemyTeam,
    enemyIndex: 0,
    trainer,
    playerStages: freshStages(),
    enemyStages: freshStages(),
    playerVolatile: freshVolatile(),
    enemyVolatile: freshVolatile(),
    weather: null,
    participants: [activeUid],
    needsSwitch: false,
    lastStandUsed: false,
    storyEffects: [],
    outcome: null,
    levelInfo: [],
    ai: 0,
    transform: freshTransform(),
    held: freshHeldState(),
  };
}

export function hasUsableMove(mon: PokemonInstance): boolean {
  return mon.moves.some((m) => m.pp > 0);
}

/** What a clever enemy needs to know to pick its best move. */
export interface EnemyBrain {
  content: Content;
  /** 0–1: the chance this turn's move is the best one rather than a random one. */
  ai: number;
  /** The player's Pokémon it is facing. */
  target: PokemonInstance;
  /** The enemy's own stat stages (it won't keep using a set-up move once boosted). */
  stages: Stages;
}

/**
 * Enemy move choice: a random move that still has PP (Struggle if none).
 * Bosses (ai > 0) instead pick their best move that often: the strongest
 * attack against the target's types, or a status or set-up move when it
 * would help more.
 */
export function chooseEnemyMove(enemy: PokemonInstance, rng: Rng, brain?: EnemyBrain): number {
  const usable = enemy.moves.map((m, i) => ({ m, i })).filter((x) => x.m.pp > 0);
  if (usable.length === 0) return -1;
  if (brain && brain.ai > 0 && rng.chance(brain.ai)) {
    const scored = usable.map((x) => ({ i: x.i, score: moveValue(brain, enemy, x.m.id) }));
    return scored.reduce((best, x) => (x.score > best.score ? x : best)).i;
  }
  return rng.pick(usable).i;
}

/** Rough value of a move for a clever enemy (higher is better). */
function moveValue(brain: EnemyBrain, user: PokemonInstance, moveId: string): number {
  const { content, target, stages } = brain;
  const move = content.moves.get(moveId);
  if (!move) return 0;
  const userSpecies = getSpecies(content, user.speciesId);
  const targetSpecies = getSpecies(content, target.speciesId);
  const userStats = calcStats(content, user);
  const targetStats = calcStats(content, target);
  const attackPower = (m: Move) => {
    if (m.category === 'status') return 0;
    const effectiveness = m.flags.includes('typeless') ? 1 : typeEffectiveness(content.typeChart, m.type, targetSpecies.types);
    // A two-turn move is worth about half as much per turn.
    const power = (m.effects.fixedDamage === 'level' ? user.level : (m.power ?? 0)) * (m.effects.charge ? 0.5 : 1);
    const ratio = m.category === 'physical' ? userStats.atk / targetStats.def : userStats.spa / targetStats.spd;
    const stab = userSpecies.types.includes(m.type) ? 1.5 : 1;
    return power * ((m.accuracy ?? 100) / 100) * effectiveness * stab * ratio;
  };
  if (move.category !== 'status') return attackPower(move);
  // A status or set-up move is worth about as much as the best attack it makes possible.
  const best = Math.max(1, ...user.moves.map((m) => content.moves.get(m.id)).filter((m): m is Move => Boolean(m)).map(attackPower));
  const fx = move.effects;
  if (fx.heal) return user.hp / calcStats(content, user).hp < 0.5 ? best : 0;
  if (fx.weather) return best * 0.3;
  if (fx.protect) return best * 0.1;
  if (fx.confuse) return best * 0.4 * ((move.accuracy ?? 100) / 100);
  if (fx.seed) return getSpecies(content, target.speciesId).types.includes('grass') ? 0 : best * 0.5;
  const status = fx.status;
  if (status) {
    if (target.status || isStatusImmune(status.id, targetSpecies.types, move)) return 0;
    const weight = status.id === 'slp' ? 1.1 : status.id === 'par' || status.id === 'brn' ? 0.8 : 0.5;
    return best * weight * ((move.accuracy ?? 100) / 100);
  }
  const boosts = (move.effects.statChanges ?? []).filter((c) => c.target === 'self' && c.stages > 0);
  if (boosts.length > 0) {
    const healthy = user.hp / calcStats(content, user).hp > 0.6;
    const room = boosts.some((c) => (stages[c.stat] ?? 0) < 2);
    return healthy && room ? best * 0.9 : 0;
  }
  return best * 0.2;
}

/** The move a Pokémon must use this turn (the second turn of Solar Beam, more Thrash), or null. */
export function forcedMoveId(vol: Volatile | undefined): string | null {
  return vol?.charging ?? vol?.locked?.moveId ?? null;
}

/** The move slot the player's Pokémon must use this turn (a two-turn move, Thrash, or a Choice item's lock), or null if it can choose. */
export function forcedMoveIndex(battle: BattleState, party: PokemonInstance[]): number | null {
  const mon = party[battle.activeIndex];
  const id = forcedMoveId(battle.playerVolatile) ?? choiceLock(battle, mon);
  if (!id) return null;
  const index = mon?.moves.findIndex((m) => m.id === id) ?? -1;
  return index >= 0 ? index : null;
}

/** A Choice item's locked move, while it still has PP. */
function choiceLock(battle: BattleState, mon: PokemonInstance | undefined): string | null {
  const id = mon ? Held.choiceLockedMove({ battle }, mon) : null;
  return id && mon!.moves.some((m) => m.id === id && m.pp > 0) ? id : null;
}

/** Why the player can't switch to this party slot, or null if they can. */
export function switchProblem(ctx: Pick<BattleContext, 'battle' | 'party'> & Partial<Pick<BattleContext, 'content' | 'teamItems'>>, partyIndex: number): string | null {
  const mon = ctx.party[partyIndex];
  if (!mon) return 'There is no Pokémon in that slot.';
  if (partyIndex === ctx.battle.activeIndex && !ctx.battle.needsSwitch) return 'That Pokémon is already in battle.';
  if (mon.hp <= 0) return 'That Pokémon has fainted.';
  const active = ctx.party[ctx.battle.activeIndex];
  const shedShell = active && 'content' in ctx ? Held.canAlwaysSwitch(ctx as Pick<BattleContext, 'content' | 'teamItems'>, active, 'player') : false;
  if (!ctx.battle.needsSwitch && !shedShell && (ctx.battle.playerVolatile?.bound ?? 0) > 0) return "Your Pokémon is bound and can't escape!";
  if (!ctx.battle.needsSwitch && forcedMoveId(ctx.battle.playerVolatile)) return 'Your Pokémon is in the middle of a move!';
  return null;
}

/**
 * Plays one player action. Usually that's a full turn. When the active
 * Pokémon has fainted (`battle.needsSwitch`), the only allowed action is a
 * switch, which happens immediately and doesn't use a turn.
 */
export function resolveTurn(ctx: BattleContext, action: PlayerAction): BattleEvent[] {
  const { battle, content, rng } = ctx;
  if (battle.outcome) throw new Error('Battle is already over');
  const events: BattleEvent[] = [];

  if (battle.needsSwitch) {
    if (action.kind !== 'switch') throw new Error('Choose a Pokémon to send out');
    const problem = switchProblem(ctx, action.partyIndex);
    if (problem) throw new Error(problem);
    switchIn(ctx, action.partyIndex, events);
    battle.needsSwitch = false;
    return events;
  }

  battle.playerVolatile ??= freshVolatile();
  battle.enemyVolatile ??= freshVolatile();
  battle.weather ??= null;
  battle.held ??= freshHeldState();
  // X items and Dire Hit take effect when a Pokémon is first in battle.
  enterField(ctx, { side: 'player', mon: ctx.party[battle.activeIndex]!, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false });
  enterField(ctx, { side: 'enemy', mon: currentEnemy(battle), stages: battle.enemyStages, vol: battle.enemyVolatile, flinched: false });
  // A Pokémon in the middle of a two-turn or lock-in move must carry on with it.
  const forced = forcedMoveIndex(battle, ctx.party);
  if (forced !== null) {
    if (action.kind !== 'move') throw new Error('Your Pokémon is in the middle of a move!');
    action = { kind: 'move', index: forced };
  } else {
    if (forcedMoveId(battle.playerVolatile)) battle.playerVolatile = freshVolatileKeeping(battle.playerVolatile);
    validateAction(ctx, action);
  }
  ctx.doubleKoLoser = undefined;
  const enemy: Combatant = { side: 'enemy', mon: currentEnemy(battle), stages: battle.enemyStages, vol: battle.enemyVolatile, flinched: false, protected: false };
  const enemyForced = forcedMoveId(enemy.vol);
  const enemyForcedIndex = enemyForced ? enemy.mon.moves.findIndex((m) => m.id === enemyForced) : -1;
  const enemyChoice = choiceLock(battle, enemy.mon);
  const enemyChoiceIndex = enemyChoice ? enemy.mon.moves.findIndex((m) => m.id === enemyChoice) : -1;
  const enemyMoveIndex =
    enemyForcedIndex >= 0 ? enemyForcedIndex : enemyChoiceIndex >= 0 ? enemyChoiceIndex : chooseEnemyMove(enemy.mon, rng, { content, ai: battle.ai, target: ctx.party[battle.activeIndex]!, stages: battle.enemyStages });
  const enemyMove = resolveMove(content, enemy.mon, enemyMoveIndex);

  // 1. Switching and items go before any move.
  if (action.kind === 'switch') {
    events.push({ type: 'switchOut', side: 'player', uid: ctx.party[battle.activeIndex]!.uid });
    switchIn(ctx, action.partyIndex, events);
  } else if (action.kind === 'item') {
    useItemInBattle(ctx, action.itemId, action.targetIndex, events);
    if (battle.outcome === 'caught') {
      battle.turn += 1;
      return events;
    }
  }

  // Transformations (Mega Evolution, ...) happen before any move, so they count for turn order.
  if (!battle.outcome) applyTransformations(ctx, action.kind === 'move' ? action.transform : undefined, events as TransformEvent[]);

  const player = (): Combatant => ({ side: 'player', mon: ctx.party[battle.activeIndex]!, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false, protected: false });
  const playerC = player();

  // 2. Moves.
  if (action.kind === 'move') {
    const playerMove = resolveMove(content, playerC.mon, action.index);
    const order = decideOrder(ctx, rng, playerC, playerMove, enemy, enemyMove);
    const actions =
      order === 'player'
        ? [{ user: playerC, target: enemy, move: playerMove, slot: action.index }, { user: enemy, target: playerC, move: enemyMove, slot: enemyMoveIndex }]
        : [{ user: enemy, target: playerC, move: enemyMove, slot: enemyMoveIndex }, { user: playerC, target: enemy, move: playerMove, slot: action.index }];
    actions.forEach((a, index) => {
      if (anyFainted(playerC, enemy) || a.user.mon.hp <= 0) return;
      executeMove(ctx, a.user, a.target, a.move, a.slot, index === 0, events);
    });
  } else {
    executeMove(ctx, enemy, playerC, enemyMove, enemyMoveIndex, false, events);
  }
  recordFaints(ctx, playerC, enemy, events);

  // 3. End of turn: weather, then burn, poison, binding and Leech Seed.
  if (!anyFainted(playerC, enemy)) {
    applyWeather(ctx, [playerC, enemy], events);
    recordFaints(ctx, playerC, enemy, events);
  }
  if (!anyFainted(playerC, enemy)) {
    applyResidual(ctx, playerC, enemy, events);
    applyResidual(ctx, enemy, playerC, events);
    recordFaints(ctx, playerC, enemy, events);
  }
  // Held items at the end of the turn (Leftovers, Orbs, berries), then battle boosts count down.
  if (!anyFainted(playerC, enemy)) {
    Held.endOfTurn(ctx, playerC, events as Held.HeldEvent[]);
    Held.endOfTurn(ctx, enemy, events as Held.HeldEvent[]);
    recordFaints(ctx, playerC, enemy, events);
  }

  // A Pokémon that switched in this turn still gets its "first turn" next turn (Fake Out).
  if (action.kind !== 'switch') playerC.vol.turnsOut += 1;
  enemy.vol.turnsOut += 1;

  // 4. Decide the outcome or replace fainted Pokémon.
  settleFaints(ctx, events);
  battle.turn += 1;
  return events;
}

/** Clears a stuck two-turn or lock-in move (its move slot is gone), keeping the other conditions. */
function freshVolatileKeeping(vol: Volatile): Volatile {
  return { ...vol, charging: null, semi: null, locked: null };
}

function anyFainted(a: Combatant, b: Combatant): boolean {
  return a.mon.hp <= 0 || b.mon.hp <= 0;
}

function validateAction(ctx: BattleContext, action: PlayerAction): void {
  const mon = ctx.party[ctx.battle.activeIndex];
  if (!mon) throw new Error('No active Pokémon');
  if (action.kind === 'move') {
    if (action.index === -1) {
      if (hasUsableMove(mon)) throw new Error('Struggle is only allowed when no move has PP');
      return;
    }
    const slot = mon.moves[action.index];
    if (!slot) throw new Error(`Invalid move slot ${action.index}`);
    if (slot.pp <= 0) throw new Error(`${slot.id} has no PP left`);
    if (action.transform) {
      const problem = transformProblem(ctx, action.transform);
      if (problem) throw new Error(problem);
    }
  } else if (action.kind === 'switch') {
    const problem = switchProblem(ctx, action.partyIndex);
    if (problem) throw new Error(problem);
  } else {
    const problem = itemProblem(ctx, action.itemId, action.targetIndex);
    if (problem) throw new Error(problem);
  }
}

/** Why this item can't be used right now, or null if it can. */
export function itemProblem(ctx: Pick<BattleContext, 'content' | 'battle' | 'party' | 'inventory'>, itemId: string, targetIndex?: number): string | null {
  const item = ctx.content.items.get(itemId);
  if (!item) return `Unknown item "${itemId}".`;
  if (itemCount(ctx.inventory, itemId) <= 0) return `You have no ${item.name} left.`;
  if (!item.usableInBattle) return `${item.name} can't be used in battle.`;
  if (item.effect.kind === 'catch') {
    if (ctx.battle.kind !== 'wild') return "You can't catch another trainer's Pokémon!";
    return null;
  }
  const target = targetIndex === undefined ? undefined : ctx.party[targetIndex];
  if (!target) return 'Choose a Pokémon to use it on.';
  return itemUseProblem(ctx.content, item, target);
}

function useItemInBattle(ctx: BattleContext, itemId: string, targetIndex: number | undefined, events: BattleEvent[]): void {
  const { content, battle } = ctx;
  const item = getItem(content, itemId);
  consumeItem(ctx.inventory, itemId);
  if (item.effect.kind === 'catch') {
    const enemy = currentEnemy(battle);
    const species = getSpecies(content, enemy.speciesId);
    const probability = catchProbability({
      maxHp: calcStats(content, enemy).hp,
      hp: enemy.hp,
      catchRate: species.catchRate,
      ballMultiplier: item.effect.multiplier,
      statusMultiplier: enemy.status ? content.ruleset.catchStatusMultipliers[enemy.status.id] ?? 1 : 1,
      finalMultiplier: ctx.catchMultiplier,
    });
    const roll = resolveCatchRoll(probability, ctx.captureRng.float());
    events.push({ type: 'ball', itemId, shakes: roll.shakes, caught: roll.caught });
    if (roll.caught) battle.outcome = 'caught';
    return;
  }
  const target = ctx.party[targetIndex!]!;
  const message = applyItemToPokemon(content, item, target, { healMultiplier: ctx.healMultiplier ?? 1 });
  events.push({ type: 'item', itemId, targetUid: target.uid, message, hpAfter: target.hp });
}

function switchIn(ctx: BattleContext, partyIndex: number, events: BattleEvent[]): void {
  const { battle } = ctx;
  const outgoing = ctx.party[battle.activeIndex];
  if (outgoing) leaveField(ctx, outgoing);
  const mon = ctx.party[partyIndex]!;
  battle.activeIndex = partyIndex;
  battle.playerStages = freshStages();
  battle.playerVolatile = freshVolatile();
  if (!battle.participants.includes(mon.uid)) battle.participants.push(mon.uid);
  events.push({ type: 'switchIn', side: 'player', uid: mon.uid, speciesId: mon.speciesId, level: mon.level });
  enterField(ctx, { side: 'player', mon, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false });
}

/** A Pokémon comes onto the field: its battle boosts (X items, Dire Hit) apply once per stay. */
function enterField(ctx: BattleContext, holder: Held.Holder): void {
  const state = ctx.battle.held!;
  const key = `entered:${holder.mon.uid}`;
  if (state.used[key]) return;
  state.used[key] = { on: 1 };
  Held.onSwitchIn(ctx, holder);
}

function leaveField(ctx: BattleContext, mon: PokemonInstance): void {
  delete ctx.battle.held?.used[`entered:${mon.uid}`];
  Held.onSwitchOut(ctx, mon);
}

function resolveMove(content: Content, mon: PokemonInstance, index: number): Move {
  const id = index === -1 ? content.ruleset.struggleMoveId : mon.moves[index]?.id;
  const move = id ? content.moves.get(id) : undefined;
  if (!move) throw new Error(`Unknown move "${id}"`);
  return move;
}

function decideOrder(ctx: BattleContext, rng: Rng, player: Combatant, pMove: Move, enemy: Combatant, eMove: Move): Side {
  const { content } = ctx;
  const speedOf = (c: Combatant) =>
    effectiveSpeed(content.ruleset, Math.floor(calcStats(content, c.mon).spe * Held.heldStatMultiplier(ctx, c.mon, c.side, 'spe')), c.stages.spe, c.mon.status?.id === 'par') *
    (c.side === 'player' ? (ctx.attributes?.speed ?? 1) : 1);
  // Custap Berry moves first and Lagging Tail last within the same priority.
  const result = compareTurnOrder(
    { priority: pMove.priority + Held.orderBracket(ctx, player) / 10, speed: speedOf(player) },
    { priority: eMove.priority + Held.orderBracket(ctx, enemy) / 10, speed: speedOf(enemy) },
  );
  if (result === 'tie') return rng.chance(0.5) ? 'player' : 'enemy';
  return result === 'a' ? 'player' : 'enemy';
}

/** Checks recharging, sleep, freeze, flinching, confusion and paralysis. Returns false if the Pokémon can't act. */
function canAct(ctx: BattleContext, user: Combatant, events: BattleEvent[]): boolean {
  const { content, rng } = ctx;
  if (user.vol.recharge) {
    user.vol.recharge = false;
    events.push({ type: 'cant', side: user.side, reason: 'recharge' });
    return false;
  }
  const status = user.mon.status;
  if (status?.id === 'slp') {
    const turns = status.turns ?? 0;
    if (turns > 0) {
      status.turns = turns - 1;
      events.push({ type: 'cant', side: user.side, reason: 'slp' });
      return false;
    }
    user.mon.status = null;
    events.push({ type: 'wake', side: user.side });
  }
  if (user.mon.status?.id === 'frz') {
    if (rng.chance(content.ruleset.freezeThawChance)) {
      user.mon.status = null;
      events.push({ type: 'thaw', side: user.side });
    } else {
      events.push({ type: 'cant', side: user.side, reason: 'frz' });
      return false;
    }
  }
  if (user.flinched) {
    events.push({ type: 'cant', side: user.side, reason: 'flinch' });
    return false;
  }
  if (user.vol.confusion > 0) {
    user.vol.confusion -= 1;
    if (user.vol.confusion === 0) {
      events.push({ type: 'confusionEnd', side: user.side });
    } else {
      events.push({ type: 'confusion', side: user.side });
      if (rng.chance(confusionHitChance)) {
        // It hits itself with a typeless 40-power physical attack (no critical hits).
        const stats = calcStats(content, user.mon);
        const damage = calcDamage(content.ruleset, {
          level: user.mon.level,
          power: 40,
          attack: stats.atk,
          defense: stats.def,
          attackStage: user.stages.atk,
          defenseStage: user.stages.def,
          stab: false,
          effectiveness: 1,
          crit: false,
          randomFactor: rng.int(content.ruleset.randomFactorMin, 100),
          burned: user.mon.status?.id === 'brn',
          physical: true,
        });
        const { lost, lastStand } = takeHp(ctx, user, damage);
        events.push({ type: 'confusionHit', side: user.side, amount: lost, hpAfter: user.mon.hp });
        if (lastStand) events.push({ type: 'lastStand', side: user.side, itemId: lastStand });
        return false;
      }
    }
  }
  if (user.mon.status?.id === 'par' && rng.chance(content.ruleset.fullParalysisChance)) {
    events.push({ type: 'cant', side: user.side, reason: 'par' });
    return false;
  }
  return true;
}

/**
 * Removes HP, applying the Last Stand Charm if this would knock out the
 * player's last usable Pokémon. Returns the HP actually lost.
 */
/**
 * The player's damage bonuses and penalties: the trainer's type passives
 * (more damage from your Pokémon of a type, more super-effective damage taken
 * by them) and the attributes (Strength, Intelligence, Rage, Peace). A hit
 * always does at least 1 damage.
 */
function applyTypeModifiers(ctx: BattleContext, user: Combatant, target: Combatant, effectiveness: number, damage: number, physical: boolean): number {
  const mods = ctx.typeModifiers;
  const attrs = ctx.attributes;
  if (!mods && !attrs) return damage;
  let multiplier = 1;
  if (user.side === 'player') {
    if (mods) for (const t of getSpecies(ctx.content, user.mon.speciesId).types) multiplier *= mods.damageDealt[t] ?? 1;
    if (attrs) multiplier *= (physical ? attrs.physicalDamage : attrs.specialDamage) * attrs.damageDealt;
  }
  if (target.side === 'player') {
    if (mods && effectiveness > 1) for (const t of getSpecies(ctx.content, target.mon.speciesId).types) multiplier *= mods.weaknessTaken[t] ?? 1;
    if (attrs) multiplier *= attrs.damageTaken;
  }
  return multiplier === 1 ? damage : Math.max(1, Math.floor(damage * multiplier));
}

function takeHp(ctx: BattleContext, c: Combatant, amount: number, fromMove = false): { lost: number; lastStand: string | null; endured: boolean } {
  let lost = Math.min(Math.max(0, amount), c.mon.hp);
  let lastStand: string | null = null;
  // Love: each of your Pokémon may hang on at 1 HP after a move's hit (rolled only when Love is above 0).
  // It is the "loveEndure" story event (story.json): its cooldown key in the
  // battle's story ledger makes it once per battle per Pokémon. Destiny Knot raises the chance.
  const endureChance = (ctx.attributes?.endureChance ?? 0) * Held.endureMultiplier(ctx, c.mon, c.side);
  const endure = endureChance > 0 ? ctx.content.story.definitions.find((d) => d.triggerConditions.trigger === 'loveEndure') : undefined;
  const endureKey = endure ? cooldownKey(endure, c.mon.uid) : '';
  if (endure && fromMove && c.side === 'player' && lost > 0 && lost >= c.mon.hp && c.mon.hp > 1 && !hasBattleEffect(ctx.battle, endureKey)) {
    if (ctx.rng.chance(endureChance)) {
      markBattleEffect(ctx.battle, endureKey);
      lost = c.mon.hp - 1;
      c.mon.hp -= lost;
      return { lost, lastStand: null, endured: true };
    }
  }
  if (c.side === 'player' && lost > 0 && lost >= c.mon.hp && !ctx.battle.lastStandUsed) {
    const charm = lastStandItemId(ctx.content);
    const othersHealthy = ctx.party.some((p) => p.uid !== c.mon.uid && p.hp > 0);
    if (charm && !othersHealthy && itemCount(ctx.inventory, charm) > 0) {
      consumeItem(ctx.inventory, charm);
      ctx.battle.lastStandUsed = true;
      lost = c.mon.hp - 1;
      lastStand = charm;
    }
  }
  c.mon.hp -= lost;
  return { lost, lastStand, endured: false };
}

function executeMove(
  ctx: BattleContext,
  user: Combatant,
  target: Combatant,
  move: Move,
  slot: number,
  movedFirst: boolean,
  events: BattleEvent[],
): void {
  const continuing = forcedMoveId(user.vol) === move.id;
  if (!canAct(ctx, user, events)) {
    // Being unable to move cancels a two-turn or lock-in move.
    user.vol.charging = null;
    user.vol.semi = null;
    user.vol.locked = null;
    return;
  }

  // The second turn of a two-turn move and more Thrash use no PP.
  if (slot === -1) events.push({ type: 'noPp', side: user.side });
  else if (!continuing) user.mon.moves[slot]!.pp -= 1;
  events.push({ type: 'move', side: user.side, moveId: move.id });
  if (!move.effects.protect) user.vol.protectChain = 0;
  if (slot !== -1) Held.noteMoveUsed(ctx, user, move.id);

  runMove(ctx, user, target, move, movedFirst, events);

  // Thrash: 2–3 turns in a row, then confusion from fatigue.
  if (move.effects.lockIn) {
    if (!user.vol.locked) {
      user.vol.locked = { moveId: move.id, turns: ctx.rng.int(1, 2) };
    } else {
      user.vol.locked.turns -= 1;
      if (user.vol.locked.turns <= 0) {
        user.vol.locked = null;
        if (user.mon.hp > 0 && user.vol.confusion === 0) {
          user.vol.confusion = ctx.rng.int(2, 5);
          events.push({ type: 'fatigue', side: user.side });
        }
      }
    }
  }

  // Explosion: the user faints whether or not the move worked.
  if (move.effects.selfFaint && user.mon.hp > 0) {
    user.mon.hp = 0;
    events.push({ type: 'selfKo', side: user.side });
    ctx.doubleKoLoser = user.side;
  }
}

/** What a move does once its user has acted: accuracy, then its status effect or its damage and side effects. */
function runMove(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, movedFirst: boolean, events: BattleEvent[]): void {
  const { content, rng } = ctx;
  const fx = move.effects;
  const weather = ctx.battle.weather?.id ?? null;

  if (fx.firstTurnOnly && user.vol.turnsOut > 0) {
    events.push({ type: 'fail', side: user.side });
    return;
  }

  // Two-turn moves: charge (and maybe hide) this turn, attack next turn.
  if (fx.charge) {
    if (user.vol.charging === move.id) {
      user.vol.charging = null;
      user.vol.semi = null;
    } else if (!(fx.charge.sunSkips && weather === 'sun') && !Held.usePowerHerb(ctx, user, events as Held.HeldEvent[])) {
      user.vol.charging = move.id;
      user.vol.semi = fx.charge.semi ?? null;
      events.push({ type: 'charge', side: user.side, moveId: move.id, semi: user.vol.semi });
      for (const change of fx.charge.boosts ?? []) applyStageChange(user, change.stat, change.stages, events);
      return;
    }
  }

  if (fx.weather) {
    if (weather === fx.weather) {
      events.push({ type: 'fail', side: user.side });
    } else {
      ctx.battle.weather = { id: fx.weather, turns: Held.weatherTurns(ctx, user, fx.weather, 5) };
      events.push({ type: 'weather', weather: fx.weather });
    }
    return;
  }

  if (fx.protect) {
    // Works only when the user moves first; each use in a row is a third as likely to work.
    if (movedFirst && rng.chance(1 / 3 ** user.vol.protectChain)) {
      user.protected = true;
      user.vol.protectChain += 1;
      events.push({ type: 'protect', side: user.side });
    } else {
      user.vol.protectChain = 0;
      events.push({ type: 'fail', side: user.side });
    }
    return;
  }

  const targetsEnemy = move.target === 'enemy';
  // A hidden target can only be hit by the moves that reach it (Earthquake hits Dig).
  if (targetsEnemy && target.vol.semi && fx.hitsSemi?.semi !== target.vol.semi) {
    events.push({ type: 'avoided', side: target.side });
    return;
  }
  if (targetsEnemy && target.protected && !fx.breaksProtect) {
    events.push({ type: 'protected', side: target.side });
    return;
  }
  if (fx.ohko && target.mon.level > user.mon.level) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  // Thunder never misses in rain (half the time in sun); Blizzard never misses in snow or hail.
  const sure = fx.sureIn !== undefined && (fx.sureIn === weather || (fx.sureIn === 'snow' && weather === 'hail'));
  const baseAccuracy = sure ? null : fx.sureIn === 'rain' && weather === 'sun' ? 50 : move.accuracy;
  const itemAccuracy = targetsEnemy ? Held.accuracyMultiplier(ctx, user, target, !movedFirst) : 1;
  const accuracy =
    itemAccuracy === null
      ? 1
      : fx.ohko
        ? ohkoAccuracy(user.mon.level, target.mon.level)
        : Math.min(1, hitChance(baseAccuracy, user.stages.acc, fx.ignoreStages ? 0 : target.stages.eva) * itemAccuracy);
  if (targetsEnemy && rng.float() >= accuracy) {
    events.push({ type: 'miss', side: user.side });
    return;
  }

  if (move.category === 'status') {
    applyStatusMove(ctx, user, target, move, events);
    return;
  }

  // Damaging move.
  const targetTypes = getSpecies(content, target.mon.speciesId).types;
  const moveType = fx.weatherBall && weather ? WEATHER_BALL_TYPE[weather] : Held.moveTypeFor(ctx, user.mon, user.side, move.type);
  const effectiveness = move.flags.includes('typeless') ? 1 : Held.adjustEffectiveness(ctx, target, moveType, typeEffectiveness(content.typeChart, moveType, targetTypes));
  if (effectiveness === 0) {
    events.push({ type: 'noEffect', side: target.side });
    return;
  }

  const hits = fx.hits ? multiHitCount(fx.hits, rng) : 1;
  let dealt = 0;
  let landed = 0;
  for (let hit = 0; hit < hits && target.mon.hp > 0 && user.mon.hp > 0; hit++) {
    let damage: number;
    let crit = false;
    if (fx.ohko) {
      damage = target.mon.hp;
    } else if (fx.fixedDamage === 'level') {
      damage = user.mon.level;
    } else {
      const userStats = calcStats(content, user.mon);
      const targetStats = calcStats(content, target.mon);
      const physical = move.category === 'physical';
      const hitsDefense = physical || fx.targetsDefense;
      crit = rng.chance(critChance(content.ruleset, move.critStage + Held.critStageBonus(ctx, user)));
      const randomFactor = rng.int(content.ruleset.randomFactorMin, 100);
      const userTypes = getSpecies(content, user.mon.speciesId).types;
      let power = fx.lowHpPower ? lowHpPower(user.mon.hp, userStats.hp) : (move.power ?? 0);
      if (fx.doubleBelowHalf && target.mon.hp * 2 <= targetStats.hp) power *= 2;
      if (fx.hitsSemi?.double && target.vol.semi === fx.hitsSemi.semi) power *= 2;
      if (fx.weatherBall && weather) power *= 2;
      if (fx.charge?.sunSkips && weather && weather !== 'sun') power = Math.floor(power / 2);
      const defenseStage = hitsDefense ? target.stages.def : target.stages.spd;
      // Sandstorm raises Rock types' Sp. Def and snow raises Ice types' Defense by half.
      let defense = Math.floor((hitsDefense ? targetStats.def : targetStats.spd) * Held.heldStatMultiplier(ctx, target.mon, target.side, hitsDefense ? 'def' : 'spd'));
      if (weather === 'sand' && !hitsDefense && targetTypes.includes('rock')) defense = Math.floor(defense * 1.5);
      if (weather === 'snow' && hitsDefense && targetTypes.includes('ice')) defense = Math.floor(defense * 1.5);
      const ruleset = crit ? { ...content.ruleset, critMultiplier: Held.critDamage(ctx, user, content.ruleset.critMultiplier) } : content.ruleset;
      damage = calcDamage(ruleset, {
        level: user.mon.level,
        power,
        attack: Math.floor((physical ? userStats.atk : userStats.spa) * Held.heldStatMultiplier(ctx, user.mon, user.side, physical ? 'atk' : 'spa')),
        defense,
        attackStage: physical ? user.stages.atk : user.stages.spa,
        defenseStage: fx.ignoreStages ? 0 : defenseStage,
        stab: !move.flags.includes('typeless') && userTypes.includes(moveType),
        effectiveness,
        crit,
        randomFactor,
        burned: user.mon.status?.id === 'brn',
        physical,
        weather: weatherMultiplier(weather, moveType),
      });
      damage = applyTypeModifiers(ctx, user, target, effectiveness, damage, physical);
      const itemMultiplier =
        Held.attackMultiplier(ctx, user, target, move, moveType, effectiveness, events as Held.HeldEvent[]) *
        Held.defenseMultiplier(ctx, target, moveType, effectiveness, ctx.battle.kind === 'wild' && target.side === 'player', events as Held.HeldEvent[]);
      if (itemMultiplier !== 1) damage = Math.max(1, Math.floor(damage * itemMultiplier));
    }
    damage = Held.survive(ctx, target, damage, events as Held.HeldEvent[]);
    if (fx.leaveOne) damage = Math.min(damage, target.mon.hp - 1);

    const { lost, lastStand, endured } = takeHp(ctx, target, damage, true);
    dealt += lost;
    landed += 1;
    events.push({ type: 'damage', side: target.side, amount: lost, hpAfter: target.mon.hp, effectiveness, crit });
    if (lastStand) events.push({ type: 'lastStand', side: target.side, itemId: lastStand });
    if (endured) events.push({ type: 'endure', side: target.side });
  }
  if (fx.hits) events.push({ type: 'hits', side: target.side, count: landed });
  Held.afterHit(ctx, user, target, move, moveType, effectiveness, dealt, movedFirst, events as Held.HeldEvent[]);
  if (target.mon.hp <= 0) Held.onKnockout(ctx, user, events as Held.HeldEvent[]);
  if (fx.ohko && target.mon.hp <= 0) events.push({ type: 'ohko', side: target.side });
  if (fx.recharge) user.vol.recharge = true;

  // A damaging Fire move thaws a frozen target.
  if (move.type === 'fire' && target.mon.status?.id === 'frz' && target.mon.hp > 0) {
    target.mon.status = null;
    events.push({ type: 'thaw', side: target.side });
  }

  if (fx.drain && dealt > 0) {
    const userMax = calcStats(content, user.mon).hp;
    const heal = Math.min(userMax - user.mon.hp, Math.max(1, Math.floor(dealt * fx.drain * Held.drainMultiplier(ctx, user.mon, user.side))));
    if (heal > 0) {
      user.mon.hp += heal;
      events.push({ type: 'drain', side: user.side, amount: heal, hpAfter: user.mon.hp });
    }
  }
  if (fx.recoil && dealt > 0) {
    applyRecoil(ctx, user, Math.max(1, Math.floor(dealt * fx.recoil)), events);
    // The user of a recoil move wins if both sides run out at once.
    if (user.mon.hp <= 0) ctx.doubleKoLoser = user.side === 'player' ? 'enemy' : 'player';
  }
  if (fx.recoilMaxHp) applyRecoil(ctx, user, Math.max(1, Math.floor(calcStats(content, user.mon).hp * fx.recoilMaxHp)), events);

  // Secondary effects only land if the target is still standing.
  if (target.mon.hp > 0) {
    if (fx.status && rng.chance(fx.status.chance / 100)) tryInflictStatus(content, rng, target, fx.status.id, move, events, false);
    if (fx.flinchChance && movedFirst && rng.chance(fx.flinchChance / 100)) target.flinched = true;
    if (fx.confuse && rng.chance(fx.confuse.chance / 100)) tryConfuse(ctx, target, events, false);
    if (fx.bind && target.vol.bound === 0) {
      target.vol.bound = rng.int(4, 5);
      events.push({ type: 'bound', side: target.side, moveId: move.id });
    }
  }
  // Changes that share a chance are rolled together (Ancient Power raises all five stats or none).
  const rolls = new Map<number, boolean>();
  for (const change of fx.statChanges ?? []) {
    const recipient = change.target === 'self' ? user : target;
    if (recipient.mon.hp <= 0) continue;
    if (!rolls.has(change.chance)) rolls.set(change.chance, rng.chance(change.chance / 100));
    if (rolls.get(change.chance)) changeStage(ctx, user, recipient, change.stat, change.stages, events);
  }
}

function applyStatusMove(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, events: BattleEvent[]): void {
  const { content, rng } = ctx;
  const fx = move.effects;
  let didSomething = false;
  if (fx.heal) {
    const max = calcStats(content, user.mon).hp;
    const weather = ctx.battle.weather?.id ?? null;
    let fraction = fx.heal;
    if (fx.healWeather && weather) fraction = weather === 'sun' ? 2 / 3 : 1 / 4;
    if (fx.healSand && weather === 'sand') fraction = 2 / 3;
    const amount = Math.min(max - user.mon.hp, Math.max(1, Math.floor(max * fraction)));
    if (amount > 0) {
      user.mon.hp += amount;
      events.push({ type: 'heal', side: user.side, amount, hpAfter: user.mon.hp });
      didSomething = true;
    }
  }
  if (fx.confuse) didSomething = tryConfuse(ctx, target, events, true) || didSomething;
  if (fx.seed) {
    if (target.vol.seeded || getSpecies(content, target.mon.speciesId).types.includes('grass')) {
      events.push({ type: 'fail', side: target.side });
    } else {
      target.vol.seeded = true;
      events.push({ type: 'seeded', side: target.side });
    }
    return;
  }
  if (fx.status) {
    didSomething = tryInflictStatus(content, rng, target, fx.status.id, move, events, true) || didSomething;
  }
  for (const change of fx.statChanges ?? []) {
    const recipient = change.target === 'self' ? user : target;
    didSomething = changeStage(ctx, user, recipient, change.stat, change.stages, events) || didSomething;
  }
  if (!didSomething && !fx.statChanges?.length && !fx.status && !fx.confuse) events.push({ type: 'fail', side: user.side });
}

/** Confuses for 2–5 turns of moves (1–4 of them are checks). Returns true if it worked. */
function tryConfuse(ctx: BattleContext, target: Combatant, events: BattleEvent[], announceFailure: boolean): boolean {
  if (target.vol.confusion > 0 || Held.statusBlocked(ctx, target, 'confusion')) {
    if (announceFailure) events.push({ type: 'fail', side: target.side });
    return false;
  }
  target.vol.confusion = ctx.rng.int(2, 5);
  events.push({ type: 'confused', side: target.side });
  return true;
}

/** Returns true if the status was applied. `announceFailure` is for status moves. */
function tryInflictStatus(
  content: Content,
  rng: Rng,
  target: Combatant,
  status: StatusId,
  move: Move,
  events: BattleEvent[],
  announceFailure: boolean,
): boolean {
  const types = getSpecies(content, target.mon.speciesId).types;
  if (target.mon.status || isStatusImmune(status, types, move) || Held.statusBlocked({ content }, target, status)) {
    if (announceFailure) events.push({ type: 'fail', side: target.side });
    return false;
  }
  target.mon.status = { id: status };
  if (status === 'slp') {
    // Sleep length (turns skipped) is rolled when it starts.
    target.mon.status.turns = rng.int(content.ruleset.sleepTurnsMin, content.ruleset.sleepTurnsMax);
  }
  events.push({ type: 'status', side: target.side, status });
  return true;
}

/**
 * A move changes a stat stage. The opponent can't lower stats guarded by
 * Guard Spec.; a White Herb undoes a drop once per battle.
 */
function changeStage(ctx: BattleContext, user: Combatant, recipient: Combatant, stat: BoostStat, stages: number, events: BattleEvent[]): boolean {
  if (stages < 0 && recipient !== user && Held.statsGuarded(recipient)) {
    events.push({ type: 'held', side: recipient.side, itemId: 'guard-spec', what: 'guard' });
    return false;
  }
  const changed = applyStageChange(recipient, stat, stages, events);
  if (changed && stages < 0) Held.whiteHerb(ctx, recipient, events as Held.HeldEvent[]);
  return changed;
}

/** Returns true if the stage actually changed. */
function applyStageChange(c: Combatant, stat: BoostStat, stages: number, events: BattleEvent[]): boolean {
  const before = c.stages[stat];
  const after = clampStage(before + stages);
  if (after === before) {
    events.push({ type: 'statLimit', side: c.side, stat, up: stages > 0 });
    return false;
  }
  c.stages[stat] = after;
  events.push({ type: 'stat', side: c.side, stat, change: after - before });
  return true;
}

function applyRecoil(ctx: BattleContext, user: Combatant, amount: number, events: BattleEvent[]): void {
  const { lost, lastStand } = takeHp(ctx, user, amount);
  if (lost <= 0) return;
  events.push({ type: 'recoil', side: user.side, amount: lost, hpAfter: user.mon.hp });
  if (lastStand) events.push({ type: 'lastStand', side: user.side, itemId: lastStand });
}

/** Weather Ball's type in each weather. */
const WEATHER_BALL_TYPE: Record<Weather, TypeName> = { rain: 'water', sun: 'fire', sand: 'rock', snow: 'ice', hail: 'ice' };
/** Types that sandstorm and hail don't hurt. */
const WEATHER_IMMUNE: Partial<Record<Weather, TypeName[]>> = { sand: ['rock', 'ground', 'steel'], hail: ['ice'] };

/** Rain powers up Water moves and weakens Fire moves; sun does the opposite. */
export function weatherMultiplier(weather: Weather | null, type: TypeName): number {
  if (weather === 'rain') return type === 'water' ? 1.5 : type === 'fire' ? 0.5 : 1;
  if (weather === 'sun') return type === 'fire' ? 1.5 : type === 'water' ? 0.5 : 1;
  return 1;
}

/** End of turn: sandstorm and hail hurt (1/16 HP) the types they don't spare; then the weather counts down. */
function applyWeather(ctx: BattleContext, sides: Combatant[], events: BattleEvent[]): void {
  const weather = ctx.battle.weather;
  if (!weather) return;
  const immune = WEATHER_IMMUNE[weather.id];
  if (immune) {
    for (const c of sides) {
      if (c.mon.hp <= 0 || c.vol.semi === 'underground' || c.vol.semi === 'underwater') continue;
      if (getSpecies(ctx.content, c.mon.speciesId).types.some((t) => immune.includes(t))) continue;
      const { lost, lastStand } = takeHp(ctx, c, Math.max(1, Math.floor(calcStats(ctx.content, c.mon).hp / 16)));
      events.push({ type: 'weatherDamage', side: c.side, weather: weather.id, amount: lost, hpAfter: c.mon.hp });
      if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
    }
  }
  weather.turns -= 1;
  if (weather.turns <= 0) {
    ctx.battle.weather = null;
    events.push({ type: 'weatherEnd', weather: weather.id });
  }
}

/** End-of-turn damage for one side: burn or poison, then binding, then Leech Seed (which heals the other side). */
function applyResidual(ctx: BattleContext, c: Combatant, other: Combatant, events: BattleEvent[]): void {
  const { content } = ctx;
  const max = calcStats(content, c.mon).hp;
  const hurt = (fraction: number) => {
    const { lost, lastStand } = takeHp(ctx, c, Math.max(1, Math.floor(max * fraction)));
    return { lost, lastStand };
  };
  const status = c.mon.status?.id;
  const fraction = status === 'brn' ? content.ruleset.burnResidualFraction : status === 'psn' ? content.ruleset.poisonResidualFraction : 0;
  if (c.mon.hp > 0 && status && fraction > 0) {
    const { lost, lastStand } = hurt(fraction);
    events.push({ type: 'residual', side: c.side, status, amount: lost, hpAfter: c.mon.hp });
    if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
  }
  if (c.mon.hp > 0 && c.vol.bound > 0) {
    c.vol.bound -= 1;
    if (c.vol.bound === 0) {
      events.push({ type: 'bindEnd', side: c.side });
    } else {
      const { lost, lastStand } = hurt((1 / 8) * Held.bindMultiplier(ctx, other.mon, other.side));
      events.push({ type: 'bindDamage', side: c.side, amount: lost, hpAfter: c.mon.hp });
      if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
    }
  }
  if (c.mon.hp > 0 && c.vol.seeded) {
    const { lost, lastStand } = hurt(1 / 8);
    events.push({ type: 'seedDamage', side: c.side, amount: lost, hpAfter: c.mon.hp });
    if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
    const otherMax = calcStats(content, other.mon).hp;
    const heal = Math.min(otherMax - other.mon.hp, lost);
    if (other.mon.hp > 0 && heal > 0) {
      other.mon.hp += heal;
      events.push({ type: 'heal', side: other.side, amount: heal, hpAfter: other.mon.hp });
    }
  }
}

/** Adds a faint event (once) for each fainted active Pokémon. */
function recordFaints(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): void {
  for (const c of [player, enemy]) {
    if (c.mon.hp > 0) continue;
    if (events.some((e) => e.type === 'faint' && e.uid === c.mon.uid)) continue;
    const participants = c.side === 'enemy' ? ctx.battle.participants.filter((uid) => ctx.party.some((p) => p.uid === uid && p.hp > 0)) : [];
    events.push({ type: 'faint', side: c.side, uid: c.mon.uid, participants });
  }
}

/**
 * After a turn: decides whether someone has won, sends out the trainer's next
 * Pokémon, or asks the player to choose a replacement.
 */
function settleFaints(ctx: BattleContext, events: BattleEvent[]): void {
  const { battle } = ctx;
  const enemy = currentEnemy(battle);
  if (enemy.hp <= 0) {
    const next = battle.enemyTeam.findIndex((m, i) => i > battle.enemyIndex && m.hp > 0);
    if (next < 0) {
      // Both sides out at once: the user of Explosion loses, the user of a recoil move wins; otherwise the player wins.
      const playerOut = !ctx.party.some((p) => p.hp > 0);
      battle.outcome = playerOut && ctx.doubleKoLoser === 'player' ? 'lose' : 'win';
      return;
    }
    battle.enemyIndex = next;
    battle.enemyStages = freshStages();
    battle.enemyVolatile = freshVolatile();
    const active = ctx.party[battle.activeIndex]!;
    battle.participants = active.hp > 0 ? [active.uid] : [];
    const sent = battle.enemyTeam[next]!;
    events.push({ type: 'switchIn', side: 'enemy', uid: sent.uid, speciesId: sent.speciesId, level: sent.level });
  }
  const active = ctx.party[battle.activeIndex]!;
  if (active.hp <= 0) {
    if (ctx.party.some((p) => p.hp > 0)) battle.needsSwitch = true;
    else battle.outcome = 'lose';
  }
}
