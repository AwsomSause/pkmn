// The turn-based battle engine. It knows nothing about graphics: it takes the
// battle state plus the player's choice, changes the state, and returns a list
// of events ("Bulbasaur used Vine Whip", "It's super effective!", ...) that the
// battle screen plays back in order.
//
// Turn order: switching and items happen first, then moves (priority, then
// Speed, then a seeded coin flip), then end-of-turn burn/poison damage, then
// fainted Pokémon are replaced.

import type { BoostStat, Content, Move, StatusId } from '../contentSchema';
import { catchProbability, resolveCatchRoll } from '../capture';
import { applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem, lastStandItemId } from '../items';
import { calcStats, getSpecies } from '../pokemon';
import type { Rng } from '../rng';
import { currentEnemy, freshStages, type BattleState, type PokemonInstance, type Stages } from '../state';
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
  | { type: 'lastStand'; side: Side; itemId: string }
  /** `uid` and `participants` let the run award experience for this faint. */
  | { type: 'faint'; side: Side; uid: string; participants: string[] }
  | { type: 'switchOut'; side: Side; uid: string }
  | { type: 'switchIn'; side: Side; uid: string; speciesId: string; level: number }
  | { type: 'item'; itemId: string; targetUid: string; message: string; hpAfter: number }
  | { type: 'ball'; itemId: string; shakes: number; caught: boolean };

export type PlayerAction =
  | { kind: 'move'; index: number }
  | { kind: 'switch'; partyIndex: number }
  | { kind: 'item'; itemId: string; targetIndex?: number };

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
  /** Bag contents (items used in battle are removed from here). */
  inventory: Record<string, number>;
  /** The "battle" random stream. */
  rng: Rng;
  /** The "capture" random stream. */
  captureRng: Rng;
  /** Multiplier on the final catch probability (e.g. Green's 0.85). */
  catchMultiplier: number;
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
    participants: [activeUid],
    needsSwitch: false,
    lastStandUsed: false,
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

/** Why the player can't switch to this party slot, or null if they can. */
export function switchProblem(ctx: Pick<BattleContext, 'battle' | 'party'>, partyIndex: number): string | null {
  const mon = ctx.party[partyIndex];
  if (!mon) return 'There is no Pokémon in that slot.';
  if (partyIndex === ctx.battle.activeIndex && !ctx.battle.needsSwitch) return 'That Pokémon is already in battle.';
  if (mon.hp <= 0) return 'That Pokémon has fainted.';
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

  validateAction(ctx, action);
  const enemy: Combatant = { side: 'enemy', mon: currentEnemy(battle), stages: battle.enemyStages, flinched: false };
  const enemyMoveIndex = chooseEnemyMove(enemy.mon, rng);
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

  const player = (): Combatant => ({ side: 'player', mon: ctx.party[battle.activeIndex]!, stages: battle.playerStages, flinched: false });
  const playerC = player();

  // 2. Moves.
  if (action.kind === 'move') {
    const playerMove = resolveMove(content, playerC.mon, action.index);
    const order = decideOrder(content, rng, playerC, playerMove, enemy, enemyMove);
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

  // 3. End of turn: burn and poison.
  if (!anyFainted(playerC, enemy)) {
    for (const c of [playerC, enemy]) {
      applyResidual(ctx, c, events);
    }
    recordFaints(ctx, playerC, enemy, events);
  }

  // 4. Decide the outcome or replace fainted Pokémon.
  settleFaints(ctx, events);
  battle.turn += 1;
  return events;
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
  const message = applyItemToPokemon(content, item, target);
  events.push({ type: 'item', itemId, targetUid: target.uid, message, hpAfter: target.hp });
}

function switchIn(ctx: BattleContext, partyIndex: number, events: BattleEvent[]): void {
  const { battle } = ctx;
  const mon = ctx.party[partyIndex]!;
  battle.activeIndex = partyIndex;
  battle.playerStages = freshStages();
  if (!battle.participants.includes(mon.uid)) battle.participants.push(mon.uid);
  events.push({ type: 'switchIn', side: 'player', uid: mon.uid, speciesId: mon.speciesId, level: mon.level });
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

/**
 * Removes HP, applying the Last Stand Charm if this would knock out the
 * player's last usable Pokémon. Returns the HP actually lost.
 */
function takeHp(ctx: BattleContext, c: Combatant, amount: number): { lost: number; lastStand: string | null } {
  let lost = Math.min(Math.max(0, amount), c.mon.hp);
  let lastStand: string | null = null;
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
  return { lost, lastStand };
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

  const { lost: dealt, lastStand } = takeHp(ctx, target, damage);
  events.push({ type: 'damage', side: target.side, amount: dealt, hpAfter: target.mon.hp, effectiveness, crit });
  if (lastStand) events.push({ type: 'lastStand', side: target.side, itemId: lastStand });

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
  if (fx.recoil && dealt > 0) applyRecoil(ctx, user, Math.max(1, Math.floor(dealt * fx.recoil)), events);
  if (fx.recoilMaxHp) applyRecoil(ctx, user, Math.max(1, Math.floor(calcStats(content, user.mon).hp * fx.recoilMaxHp)), events);

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
  if (!didSomething && !fx.statChanges?.length && !fx.status) events.push({ type: 'fail', side: user.side });
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

function applyRecoil(ctx: BattleContext, user: Combatant, amount: number, events: BattleEvent[]): void {
  const { lost, lastStand } = takeHp(ctx, user, amount);
  if (lost <= 0) return;
  events.push({ type: 'recoil', side: user.side, amount: lost, hpAfter: user.mon.hp });
  if (lastStand) events.push({ type: 'lastStand', side: user.side, itemId: lastStand });
}

function applyResidual(ctx: BattleContext, c: Combatant, events: BattleEvent[]): void {
  const { content } = ctx;
  if (c.mon.hp <= 0 || !c.mon.status) return;
  const id = c.mon.status.id;
  const fraction =
    id === 'brn' ? content.ruleset.burnResidualFraction : id === 'psn' ? content.ruleset.poisonResidualFraction : 0;
  if (fraction === 0) return;
  const { lost, lastStand } = takeHp(ctx, c, Math.max(1, Math.floor(calcStats(content, c.mon).hp * fraction)));
  events.push({ type: 'residual', side: c.side, status: id, amount: lost, hpAfter: c.mon.hp });
  if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
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
 * If both sides run out in the same turn, the player wins.
 */
function settleFaints(ctx: BattleContext, events: BattleEvent[]): void {
  const { battle } = ctx;
  const enemy = currentEnemy(battle);
  if (enemy.hp <= 0) {
    const next = battle.enemyTeam.findIndex((m, i) => i > battle.enemyIndex && m.hp > 0);
    if (next < 0) {
      battle.outcome = 'win';
      return;
    }
    battle.enemyIndex = next;
    battle.enemyStages = freshStages();
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
