// The turn-based battle engine. It knows nothing about graphics: it takes the
// battle state plus the player's choice, changes the state, and returns a list
// of events ("Bulbasaur used Vine Whip", "It's super effective!", ...) that the
// battle screen plays back in order.

import type { BoostStat, Content, Move, StatusId } from '../contentSchema';
import { calcStats, getSpecies } from '../pokemon';
import type { Rng } from '../rng';
import { freshStages, type BattleState, type PokemonInstance, type Stages } from '../state';
import {
  calcDamage,
  clampStage,
  compareTurnOrder,
  critChance,
  effectiveSpeed,
  hitChance,
  isStatusImmune,
  typeEffectiveness,
} from './damage';

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
  | { type: 'cant'; side: Side; reason: 'slp' | 'frz' | 'par' | 'flinch' }
  | { type: 'wake'; side: Side }
  | { type: 'thaw'; side: Side }
  | { type: 'residual'; side: Side; status: StatusId; amount: number; hpAfter: number }
  | { type: 'drain'; side: Side; amount: number; hpAfter: number }
  | { type: 'recoil'; side: Side; amount: number; hpAfter: number }
  | { type: 'faint'; side: Side };

interface Combatant {
  side: Side;
  mon: PokemonInstance;
  stages: Stages;
  flinched: boolean;
}

export interface BattleContext {
  content: Content;
  battle: BattleState;
  party: PokemonInstance[];
  /** The "battle" random stream. */
  rng: Rng;
}

export function createWildBattle(enemy: PokemonInstance, activeIndex: number, activeUid: string): BattleState {
  return {
    kind: 'wild',
    turn: 1,
    activeIndex,
    enemy,
    playerStages: freshStages(),
    enemyStages: freshStages(),
    participants: [activeUid],
    outcome: null,
  };
}

export function hasUsableMove(mon: PokemonInstance): boolean {
  return mon.moves.some((m) => m.pp > 0);
}

/** Enemy move choice: a random move that still has PP (Struggle if none). */
export function chooseEnemyMove(enemy: PokemonInstance, rng: Rng): number {
  const usable = enemy.moves.map((m, i) => ({ m, i })).filter((x) => x.m.pp > 0);
  if (usable.length === 0) return -1;
  return rng.pick(usable).i;
}

/**
 * Plays one full turn. `playerMoveIndex` is the chosen move slot, or -1 for
 * Struggle (only allowed when no move has PP left).
 */
export function resolveTurn(ctx: BattleContext, playerMoveIndex: number): BattleEvent[] {
  const { battle, content, rng } = ctx;
  if (battle.outcome) throw new Error('Battle is already over');
  const playerMon = ctx.party[battle.activeIndex];
  if (!playerMon) throw new Error('No active Pokémon');
  validateChoice(playerMon, playerMoveIndex);

  const events: BattleEvent[] = [];
  const player: Combatant = { side: 'player', mon: playerMon, stages: battle.playerStages, flinched: false };
  const enemy: Combatant = { side: 'enemy', mon: battle.enemy, stages: battle.enemyStages, flinched: false };

  const enemyMoveIndex = chooseEnemyMove(enemy.mon, rng);
  const playerMove = resolveMove(content, playerMon, playerMoveIndex);
  const enemyMove = resolveMove(content, enemy.mon, enemyMoveIndex);

  const order = decideOrder(content, rng, player, playerMove, enemy, enemyMove);
  const actions = order === 'player'
    ? [{ user: player, target: enemy, move: playerMove, slot: playerMoveIndex }, { user: enemy, target: player, move: enemyMove, slot: enemyMoveIndex }]
    : [{ user: enemy, target: player, move: enemyMove, slot: enemyMoveIndex }, { user: player, target: enemy, move: playerMove, slot: playerMoveIndex }];

  actions.forEach((action, index) => {
    if (battle.outcome || action.user.mon.hp <= 0) return;
    executeMove(ctx, action.user, action.target, action.move, action.slot, index === 0, events);
    checkFaints(ctx, player, enemy, events);
  });

  if (!battle.outcome) {
    for (const c of order === 'player' ? [player, enemy] : [enemy, player]) {
      applyResidual(content, c, events);
      checkFaints(ctx, player, enemy, events);
      if (battle.outcome) break;
    }
  }

  battle.turn += 1;
  return events;
}

function validateChoice(mon: PokemonInstance, index: number): void {
  if (index === -1) {
    if (hasUsableMove(mon)) throw new Error('Struggle is only allowed when no move has PP');
    return;
  }
  const slot = mon.moves[index];
  if (!slot) throw new Error(`Invalid move slot ${index}`);
  if (slot.pp <= 0) throw new Error(`${slot.id} has no PP left`);
}

function resolveMove(content: Content, mon: PokemonInstance, index: number): Move {
  const id = index === -1 ? content.ruleset.struggleMoveId : mon.moves[index]?.id;
  const move = id ? content.moves.get(id) : undefined;
  if (!move) throw new Error(`Unknown move "${id}"`);
  return move;
}

function decideOrder(content: Content, rng: Rng, player: Combatant, pMove: Move, enemy: Combatant, eMove: Move): Side {
  const speedOf = (c: Combatant) =>
    effectiveSpeed(content.ruleset, calcStats(content, c.mon).spe, c.stages.spe, c.mon.status?.id === 'par');
  const result = compareTurnOrder(
    { priority: pMove.priority, speed: speedOf(player) },
    { priority: eMove.priority, speed: speedOf(enemy) },
  );
  if (result === 'tie') return rng.chance(0.5) ? 'player' : 'enemy';
  return result === 'a' ? 'player' : 'enemy';
}

/** Checks sleep/freeze/flinch/paralysis. Returns false if the Pokémon can't act. */
function canAct(content: Content, rng: Rng, user: Combatant, events: BattleEvent[]): boolean {
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
  if (user.mon.status?.id === 'par' && rng.chance(content.ruleset.fullParalysisChance)) {
    events.push({ type: 'cant', side: user.side, reason: 'par' });
    return false;
  }
  return true;
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
  const { content, rng } = ctx;
  if (!canAct(content, rng, user, events)) return;

  if (slot === -1) events.push({ type: 'noPp', side: user.side });
  else user.mon.moves[slot]!.pp -= 1;
  events.push({ type: 'move', side: user.side, moveId: move.id });

  const targetsEnemy = move.target === 'enemy';
  if (targetsEnemy && rng.float() >= hitChance(move.accuracy, user.stages.acc, target.stages.eva)) {
    events.push({ type: 'miss', side: user.side });
    return;
  }

  if (move.category === 'status') {
    applyStatusMove(content, rng, user, target, move, events);
    return;
  }

  // Damaging move.
  const targetTypes = getSpecies(content, target.mon.speciesId).types;
  const effectiveness = move.flags.includes('typeless') ? 1 : typeEffectiveness(content.typeChart, move.type, targetTypes);
  if (effectiveness === 0) {
    events.push({ type: 'noEffect', side: target.side });
    return;
  }

  let damage: number;
  let crit = false;
  if (move.effects.fixedDamage === 'level') {
    damage = user.mon.level;
  } else {
    const userStats = calcStats(content, user.mon);
    const targetStats = calcStats(content, target.mon);
    const physical = move.category === 'physical';
    crit = rng.chance(critChance(content.ruleset, move.critStage));
    const randomFactor = rng.int(content.ruleset.randomFactorMin, 100);
    const userTypes = getSpecies(content, user.mon.speciesId).types;
    damage = calcDamage(content.ruleset, {
      level: user.mon.level,
      power: move.power ?? 0,
      attack: physical ? userStats.atk : userStats.spa,
      defense: physical ? targetStats.def : targetStats.spd,
      attackStage: physical ? user.stages.atk : user.stages.spa,
      defenseStage: physical ? target.stages.def : target.stages.spd,
      stab: !move.flags.includes('typeless') && userTypes.includes(move.type),
      effectiveness,
      crit,
      randomFactor,
      burned: user.mon.status?.id === 'brn',
      physical,
    });
  }

  const dealt = Math.min(damage, target.mon.hp);
  target.mon.hp -= dealt;
  events.push({ type: 'damage', side: target.side, amount: dealt, hpAfter: target.mon.hp, effectiveness, crit });

  // A damaging Fire move thaws a frozen target.
  if (move.type === 'fire' && target.mon.status?.id === 'frz' && target.mon.hp > 0) {
    target.mon.status = null;
    events.push({ type: 'thaw', side: target.side });
  }

  const fx = move.effects;
  if (fx.drain && dealt > 0) {
    const userMax = calcStats(content, user.mon).hp;
    const heal = Math.min(userMax - user.mon.hp, Math.max(1, Math.floor(dealt * fx.drain)));
    if (heal > 0) {
      user.mon.hp += heal;
      events.push({ type: 'drain', side: user.side, amount: heal, hpAfter: user.mon.hp });
    }
  }
  if (fx.recoil && dealt > 0) applyRecoil(user, Math.max(1, Math.floor(dealt * fx.recoil)), events);
  if (fx.recoilMaxHp) applyRecoil(user, Math.max(1, Math.floor(calcStats(content, user.mon).hp * fx.recoilMaxHp)), events);

  // Secondary effects only land if the target is still standing.
  if (target.mon.hp > 0) {
    if (fx.status && rng.chance(fx.status.chance / 100)) tryInflictStatus(content, rng, target, fx.status.id, move, events, false);
    if (fx.flinchChance && movedFirst && rng.chance(fx.flinchChance / 100)) target.flinched = true;
  }
  for (const change of fx.statChanges ?? []) {
    const recipient = change.target === 'self' ? user : target;
    if (recipient.mon.hp <= 0) continue;
    if (rng.chance(change.chance / 100)) applyStageChange(recipient, change.stat, change.stages, events);
  }
}

function applyStatusMove(content: Content, rng: Rng, user: Combatant, target: Combatant, move: Move, events: BattleEvent[]): void {
  const fx = move.effects;
  let didSomething = false;
  if (fx.status) {
    didSomething = tryInflictStatus(content, rng, target, fx.status.id, move, events, true) || didSomething;
  }
  for (const change of fx.statChanges ?? []) {
    const recipient = change.target === 'self' ? user : target;
    didSomething = applyStageChange(recipient, change.stat, change.stages, events) || didSomething;
  }
  if (!didSomething && !fx.statChanges?.length) events.push({ type: 'fail', side: user.side });
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
  if (target.mon.status || isStatusImmune(status, types, move)) {
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

function applyRecoil(user: Combatant, amount: number, events: BattleEvent[]): void {
  const taken = Math.min(amount, user.mon.hp);
  if (taken <= 0) return;
  user.mon.hp -= taken;
  events.push({ type: 'recoil', side: user.side, amount: taken, hpAfter: user.mon.hp });
}

function applyResidual(content: Content, c: Combatant, events: BattleEvent[]): void {
  if (c.mon.hp <= 0 || !c.mon.status) return;
  const id = c.mon.status.id;
  const fraction =
    id === 'brn' ? content.ruleset.burnResidualFraction : id === 'psn' ? content.ruleset.poisonResidualFraction : 0;
  if (fraction === 0) return;
  const amount = Math.min(c.mon.hp, Math.max(1, Math.floor(calcStats(content, c.mon).hp * fraction)));
  c.mon.hp -= amount;
  events.push({ type: 'residual', side: c.side, status: id, amount, hpAfter: c.mon.hp });
}

function checkFaints(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): void {
  const { battle } = ctx;
  for (const c of [player, enemy]) {
    if (c.mon.hp <= 0 && !events.some((e) => e.type === 'faint' && e.side === c.side)) {
      events.push({ type: 'faint', side: c.side });
    }
  }
  if (enemy.mon.hp <= 0) battle.outcome = 'win';
  else if (player.mon.hp <= 0) battle.outcome = 'lose';
}
