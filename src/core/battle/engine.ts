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
//
// Abilities (abilities.ts) hook in at each step: when a Pokémon comes in
// (Intimidate, Drizzle), in turn order (Swift Swim, Prankster), before a move
// lands (Levitate, Volt Absorb), in the damage formula (Blaze, Thick Fat),
// after a hit (Static, Rough Skin), at the end of the turn (Speed Boost) and
// when switching out (Regenerator).

import type { TypeModifiers } from '../archetypes';
import type { AttributeEffects } from '../attributes';
import type { BoostStat, Content, Move, Semi, StatusId, Terrain, TransformKind, TypeName, Weather } from '../contentSchema';
import { catchProbability, resolveCatchRoll } from '../capture';
import { applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem, lastStandItemId } from '../items';
import { abilityOf, calcStats, getSpecies } from '../pokemon';
import type { Rng } from '../rng';
import { cooldownKey, hasBattleEffect, markBattleEffect } from '../story/ledger';
import type { StoryTriggerKind } from '../story/schema';
import { currentEnemy, freshHeldState, freshStages, freshTransform, freshVolatile, type BattleState, type PokemonInstance, type Stages, type Volatile } from '../state';
import {
  calcDamage,
  pokeRound,
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
import {
  ABSORB,
  CONTACT_HURT,
  CONTACT_STATUS,
  DROP_GUARD,
  FLAG_BOOST,
  HIT_BOOST,
  INTIMIDATE_GUARD,
  KO_BOOST,
  MOLD_BREAKERS,
  PINCH,
  STATUS_IMMUNE,
  TYPE_CHANGE,
  WEATHER_DAMAGE_IMMUNE,
  WEATHER_EVASION,
  TERRAIN_SETTERS, WEATHER_SETTERS,
  WEATHER_SPEED,
} from './abilities';
import * as Held from './held';
import { freshHyperBattle, rollHyper, type EnemyRage, type HyperContext, type HyperEligibility } from './hyper';
import { applyTransformations, battleMove, battleTypes, endDynamax, maxMoveExtras, maxMoveTerrain, maxMoveWeather, stabMultiplier, teraPower, tickDynamax, transformProblem, zMoveFor, type TransformEvent, type TransformRequest, type TransformStepEvent } from './transform';

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
  | { type: 'cant'; side: Side; reason: 'slp' | 'frz' | 'par' | 'flinch' | 'recharge' | 'truant' }
  /** Its ability did something (shown as "Gyarados's Intimidate!" before the effect). */
  | { type: 'ability'; side: Side; ability: string }
  /** Its status was cured (Shed Skin, Hydration). */
  | { type: 'cured'; side: Side }
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
  | { type: 'terrain'; terrain: Terrain }
  | { type: 'terrainEnd'; terrain: Terrain }
  | { type: 'weatherDamage'; side: Side; weather: Weather; amount: number; hpAfter: number }
  | { type: 'wake'; side: Side }
  | { type: 'thaw'; side: Side }
  | { type: 'residual'; side: Side; status: StatusId; amount: number; hpAfter: number }
  | { type: 'drain'; side: Side; amount: number; hpAfter: number }
  | { type: 'recoil'; side: Side; amount: number; hpAfter: number }
  | { type: 'lastStand'; side: Side; itemId: string }
  /**
   * A Hyper moment (story.json definition `defId`): the Pokémon hung on at 1 HP, got back up,
   * shook off its status (`cured`) or dug in. `hpAfter` is its HP after the moment.
   */
  | { type: 'hyper'; side: Side; uid: string; defId: string; variant: string | null; hpAfter: number; cured: boolean }
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
  /** The player's attributes (damage, Speed, damage taken). */
  attributes?: AttributeEffects;
  /** The player's team items (run.passives): the Plates help every team member. */
  teamItems?: Record<string, number>;
  /** Hyper moments for your Pokémon (none when absent). */
  hyper?: HyperContext;
  /** Set during a turn once a Hyper moment has changed the battle (one per turn). */
  hyperUsed?: boolean;
  /** The same for the opposing side (its rage). */
  enemyHyperUsed?: boolean;
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
    terrain: null,
    pendingEntry: ['player', 'enemy'],
    participants: [activeUid],
    needsSwitch: false,
    lastStandUsed: false,
    storyEffects: [],
    hyper: freshHyperBattle(),
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
  const targetAbilityId = abilityOf(content, target);
  const attackPower = (m: Move) => {
    if (m.category === 'status') return 0;
    const effectiveness = m.flags.includes('typeless') ? 1 : typeEffectiveness(content.typeChart, m.type, targetSpecies.types);
    // It knows the obvious ability immunities (Levitate, Volt Absorb, Wonder Guard).
    if (targetAbilityId && (ABSORB[targetAbilityId]?.type === m.type || (targetAbilityId === 'levitate' && m.type === 'ground') || (targetAbilityId === 'wonder-guard' && effectiveness <= 1))) return 0;
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
    resolveEntries(ctx, events);
    return events;
  }

  battle.playerVolatile ??= freshVolatile();
  battle.enemyVolatile ??= freshVolatile();
  battle.weather ??= null;
  battle.terrain ??= null;
  battle.pendingEntry ??= [];
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
  ctx.hyperUsed = false;
  ctx.enemyHyperUsed = false;
  battle.hyper ??= freshHyperBattle();
  // Entry abilities still waiting from the start of the battle (the battle screen normally plays them first, see startBattle).
  resolveEntries(ctx, events);
  const enemy: Combatant = { side: 'enemy', mon: currentEnemy(battle), stages: battle.enemyStages, vol: battle.enemyVolatile, flinched: false, protected: false };
  const enemyForced = forcedMoveId(enemy.vol);
  const enemyForcedIndex = enemyForced ? enemy.mon.moves.findIndex((m) => m.id === enemyForced) : -1;
  const enemyChoice = choiceLock(battle, enemy.mon);
  const enemyChoiceIndex = enemyChoice ? enemy.mon.moves.findIndex((m) => m.id === enemyChoice) : -1;
  let enemyMoveIndex =
    enemyForcedIndex >= 0 ? enemyForcedIndex : enemyChoiceIndex >= 0 ? enemyChoiceIndex : chooseEnemyMove(enemy.mon, rng, { content, ai: battle.ai, target: ctx.party[battle.activeIndex]!, stages: battle.enemyStages });
  let enemyMove = resolveMove(content, enemy.mon, enemyMoveIndex);

  // 1. Switching and items go before any move.
  if (action.kind === 'switch') {
    events.push({ type: 'switchOut', side: 'player', uid: ctx.party[battle.activeIndex]!.uid });
    // Switching out ends a Dynamax.
    endDynamax(content, battle, 'player', ctx.party[battle.activeIndex]!, events as TransformStepEvent[]);
    switchOutAbility(ctx, ctx.party[battle.activeIndex]!);
    switchIn(ctx, action.partyIndex, events);
    resolveEntries(ctx, events);
  } else if (action.kind === 'item') {
    useItemInBattle(ctx, action.itemId, action.targetIndex, events);
    if (battle.outcome === 'caught') {
      battle.turn += 1;
      return events;
    }
  }

  // Transformations (Mega Evolution, ...) happen before any move, so they count for turn order.
  if (!battle.outcome) {
    const move = action.kind === 'move' ? action : undefined;
    applyTransformations(ctx, move?.transform, events as TransformStepEvent[], move?.index);
  }
  // A boss that unleashed its Z-Power this turn uses that Z-Move instead of the move it chose.
  const bossZ = (events as TransformStepEvent[]).find((e) => e.type === 'transform' && e.side === 'enemy' && e.kind === 'zmove');
  if (bossZ?.type === 'transform' && bossZ.moveId) {
    const zMove = zMoveFor(content, content.moves.get(bossZ.moveId)!);
    const slot = enemy.mon.moves.findIndex((m) => m.id === bossZ.moveId);
    if (zMove && slot >= 0) {
      enemyMove = zMove;
      enemyMoveIndex = slot;
    }
  }
  // A Dynamaxed Pokémon uses Max Moves.
  enemyMove = battleMove(content, battle, enemy.mon, enemyMove);

  const player = (): Combatant => ({ side: 'player', mon: ctx.party[battle.activeIndex]!, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false, protected: false });
  const playerC = player();
  // Two rivals on the field recognise each other (Heated Rivalry).
  if (!battle.outcome) meetRival(ctx, playerC, enemy, events);

  // 2. Moves.
  if (action.kind === 'move') {
    const chosen = resolveMove(content, playerC.mon, action.index);
    // A Z-Move replaces the chosen move (its Z-Power was spent above).
    const playerMove = battleMove(content, battle, playerC.mon, action.transform?.kind === 'zmove' ? (zMoveFor(content, chosen) ?? chosen) : chosen);
    const order = decideOrder(ctx, rng, playerC, playerMove, enemy, enemyMove);
    const actions =
      order === 'player'
        ? [{ user: playerC, target: enemy, move: playerMove, slot: action.index }, { user: enemy, target: playerC, move: enemyMove, slot: enemyMoveIndex }]
        : [{ user: enemy, target: playerC, move: enemyMove, slot: enemyMoveIndex }, { user: playerC, target: enemy, move: playerMove, slot: action.index }];
    actions.forEach((a, index) => {
      if (anyFainted(playerC, enemy) || a.user.mon.hp <= 0) return;
      if (a.user.side === 'enemy' && loseFreeTurn(battle, events)) return;
      actWithRage(ctx, a.user, enemy, events, () => executeMove(ctx, a.user, a.target, a.move, a.slot, index === 0, events));
    });
  } else if (!loseFreeTurn(battle, events)) {
    actWithRage(ctx, enemy, enemy, events, () => executeMove(ctx, enemy, playerC, enemyMove, enemyMoveIndex, false, events));
  }
  recordFaints(ctx, playerC, enemy, events);

  // 3. End of turn: weather (and Rain Dish), Shed Skin, then burn, poison, binding and Leech Seed, then Speed Boost.
  if (!anyFainted(playerC, enemy)) {
    applyWeather(ctx, [playerC, enemy], events);
    applyTerrain(ctx, [playerC, enemy], events);
    recordFaints(ctx, playerC, enemy, events);
  }
  if (!anyFainted(playerC, enemy)) {
    for (const c of [playerC, enemy]) statusCureAbility(ctx, c, events);
    applyResidual(ctx, playerC, enemy, events);
    applyResidual(ctx, enemy, playerC, events);
    recordFaints(ctx, playerC, enemy, events);
  }
  if (!anyFainted(playerC, enemy)) {
    for (const c of [playerC, enemy]) {
      // Not on the turn it switched in.
      const justIn = c.side === 'player' && action.kind === 'switch';
      if (abilityIn(ctx, c) === 'speed-boost' && c.stages.spe < 6 && !justIn) {
        events.push({ type: 'ability', side: c.side, ability: 'speed-boost' });
        applyStageChange(ctx, c, 'spe', 1, events);
      }
    }
  }
  // Held items at the end of the turn (Leftovers, Orbs, berries), then battle boosts count down.
  if (!anyFainted(playerC, enemy)) {
    Held.endOfTurn(ctx, playerC, events as Held.HeldEvent[]);
    Held.endOfTurn(ctx, enemy, events as Held.HeldEvent[]);
    recordFaints(ctx, playerC, enemy, events);
  }

  // Hyper moments that come from how the turn went (Hung In There, a bond that shakes off a status).
  if (!battle.outcome && enemy.mon.hp > 0) {
    hyperEndOfTurn(ctx, player(), events);
    rageEndOfTurn(ctx, enemy, events);
  }

  // A Pokémon that switched in this turn still gets its "first turn" next turn (Fake Out).
  if (action.kind !== 'switch') playerC.vol.turnsOut += 1;
  enemy.vol.turnsOut += 1;

  // Dynamax turns run down (and a fainted Dynamax Pokémon shrinks back).
  tickDynamax(content, battle, ctx.party, events as TransformStepEvent[]);

  // 4. Decide the outcome or replace fainted Pokémon.
  const enemyBefore = battle.enemyIndex;
  settleFaints(ctx, events);
  // A trainer's next Pokémon saw its ally fall.
  if (!battle.outcome && battle.enemyIndex !== enemyBefore) warnRage(ctx, currentEnemy(battle), events);
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
      const problem = transformProblem(ctx, action.transform, action.index);
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
  battle.pendingEntry = [...(battle.pendingEntry ?? []).filter((side) => side !== 'player'), 'player'];
  enterField(ctx, { side: 'player', mon, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false });
}

/** Poké Doll: the wild Pokémon loses this turn (uses up one free turn). */
function loseFreeTurn(battle: BattleState, events: BattleEvent[]): boolean {
  const items = battle.mapItems;
  if (!items || items.freeTurns <= 0) return false;
  items.freeTurns -= 1;
  events.push({ type: 'held', side: 'enemy', itemId: 'poke-doll', what: 'distracted' });
  return true;
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

/** Natural Cure and Regenerator, when a Pokémon still standing is called back (silently, as in the main games). */
function switchOutAbility(ctx: BattleContext, mon: PokemonInstance): void {
  if (mon.hp <= 0) return;
  const ability = abilityOf(ctx.content, mon);
  if (ability === 'natural-cure') mon.status = null;
  if (ability === 'regenerator') {
    const max = calcStats(ctx.content, mon).hp;
    mon.hp = Math.min(max, mon.hp + Math.floor(max / 3));
  }
}

// ---------- abilities ----------

function abilityIn(ctx: BattleContext, c: Combatant): string | null {
  return abilityOf(ctx.content, c.mon);
}

/** The target's ability as the attacker's move sees it: Mold Breaker ignores it. */
function targetAbility(ctx: BattleContext, user: Combatant, target: Combatant): string | null {
  if (user === target) return abilityIn(ctx, target);
  const own = abilityIn(ctx, user);
  return own && MOLD_BREAKERS.has(own) ? null : abilityIn(ctx, target);
}

function announce(c: Combatant, ability: string, events: BattleEvent[]): void {
  events.push({ type: 'ability', side: c.side, ability });
}

/** Builds the two Pokémon in battle (for steps outside a turn's moves). */
function activeCombatants(ctx: BattleContext): { player: Combatant; enemy: Combatant } {
  const { battle } = ctx;
  battle.playerVolatile ??= freshVolatile();
  battle.enemyVolatile ??= freshVolatile();
  return {
    player: { side: 'player', mon: ctx.party[battle.activeIndex]!, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false, protected: false },
    enemy: { side: 'enemy', mon: currentEnemy(battle), stages: battle.enemyStages, vol: battle.enemyVolatile, flinched: false, protected: false },
  };
}

/**
 * Entry abilities of Pokémon that just came in (battle start, switching,
 * a trainer's next Pokémon), the faster one first. Uses no random numbers.
 */
function resolveEntries(ctx: BattleContext, events: BattleEvent[]): void {
  const { battle } = ctx;
  const pending = battle.pendingEntry ?? [];
  if (pending.length === 0 || battle.outcome || battle.needsSwitch) return;
  battle.pendingEntry = [];
  const { player, enemy } = activeCombatants(ctx);
  const sides = pending.map((side) => (side === 'player' ? { c: player, other: enemy } : { c: enemy, other: player }));
  if (sides.length === 2 && speedOf(ctx, enemy) > speedOf(ctx, player)) sides.reverse();
  for (const { c, other } of sides) if (c.mon.hp > 0) entryAbility(ctx, c, other, events);
}

function entryAbility(ctx: BattleContext, c: Combatant, other: Combatant, events: BattleEvent[]): void {
  const ability = abilityIn(ctx, c);
  if (!ability) return;
  const weather = WEATHER_SETTERS[ability];
  if (weather) {
    if (ctx.battle.weather?.id === weather) return;
    announce(c, ability, events);
    ctx.battle.weather = { id: weather, turns: 5 };
    events.push({ type: 'weather', weather });
    return;
  }
  const terrain = TERRAIN_SETTERS[ability];
  if (terrain) {
    if (ctx.battle.terrain?.id === terrain) return;
    announce(c, ability, events);
    ctx.battle.terrain = { id: terrain, turns: 5 };
    events.push({ type: 'terrain', terrain });
    return;
  }
  if (ability === 'intimidate' && other.mon.hp > 0) {
    announce(c, ability, events);
    const guard = abilityIn(ctx, other);
    if (guard && INTIMIDATE_GUARD.has(guard)) {
      announce(other, guard, events);
      events.push({ type: 'fail', side: other.side });
      return;
    }
    applyStageChange(ctx, other, 'atk', -1, events, c);
    if (guard === 'rattled') applyStageChange(ctx, other, 'spe', 1, events);
    return;
  }
  if (ability === 'download' && other.mon.hp > 0) {
    // Raises Attack if the foe's Defense is lower than its Sp. Def, otherwise Sp. Atk.
    const stats = calcStats(ctx.content, other.mon);
    announce(c, ability, events);
    applyStageChange(ctx, c, stats.def < stats.spd ? 'atk' : 'spa', 1, events);
    return;
  }
  if (ability === 'pressure' || MOLD_BREAKERS.has(ability)) announce(c, ability, events);
}

/** Shed Skin (30%) and Hydration (in rain) cure its status at the end of the turn. */
function statusCureAbility(ctx: BattleContext, c: Combatant, events: BattleEvent[]): void {
  if (c.mon.hp <= 0 || !c.mon.status) return;
  const ability = abilityIn(ctx, c);
  const cure = (ability === 'shed-skin' && ctx.rng.chance(0.3)) || (ability === 'hydration' && ctx.battle.weather?.id === 'rain');
  if (!cure) return;
  announce(c, ability!, events);
  c.mon.status = null;
  events.push({ type: 'cured', side: c.side });
}

/**
 * Abilities that stop a move before it lands: Levitate (Ground), Volt Absorb
 * and friends (take the move and heal or get stronger), Wonder Guard (only
 * super-effective hits), Soundproof. Returns true if the move was stopped.
 */
function abilityBlocksMove(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, moveType: TypeName, effectiveness: number, events: BattleEvent[]): boolean {
  const ability = targetAbility(ctx, user, target);
  if (!ability) return false;
  const damaging = move.category !== 'status';
  const absorb = ABSORB[ability];
  let blocked = false;
  if (absorb && absorb.type === moveType) {
    announce(target, ability, events);
    if (absorb.heal) {
      const max = calcStats(ctx.content, target.mon).hp;
      const amount = Math.min(max - target.mon.hp, Math.max(1, Math.floor(max * absorb.heal)));
      if (amount > 0) {
        target.mon.hp += amount;
        events.push({ type: 'heal', side: target.side, amount, hpAfter: target.mon.hp });
      } else events.push({ type: 'noEffect', side: target.side });
    } else if (absorb.boost) {
      applyStageChange(ctx, target, absorb.boost.stat, absorb.boost.stages, events);
    } else {
      target.vol.flashFire = true;
      events.push({ type: 'noEffect', side: target.side });
    }
    return true;
  }
  if (damaging && ability === 'levitate' && moveType === 'ground' && !move.effects.hitsSemi) blocked = true;
  if (damaging && ability === 'wonder-guard' && effectiveness <= 1 && !move.flags.includes('typeless')) blocked = true;
  if (ability === 'soundproof' && move.flags.includes('sound')) blocked = true;
  if (!blocked) return false;
  announce(target, ability, events);
  events.push({ type: 'noEffect', side: target.side });
  return true;
}

function resolveMove(content: Content, mon: PokemonInstance, index: number): Move {
  const id = index === -1 ? content.ruleset.struggleMoveId : mon.moves[index]?.id;
  const move = id ? content.moves.get(id) : undefined;
  if (!move) throw new Error(`Unknown move "${id}"`);
  return move;
}

/** Speed for turn order: stages, paralysis, the player's Speed attribute and Speed abilities (Swift Swim, Quick Feet, Slow Start). */
function speedOf(ctx: BattleContext, c: Combatant): number {
  const { content } = ctx;
  const ability = abilityIn(ctx, c);
  const weather = ctx.battle.weather?.id;
  const quickFeet = ability === 'quick-feet' && c.mon.status !== null;
  let speed = effectiveSpeed(content.ruleset, Math.floor(calcStats(content, c.mon).spe * Held.heldStatMultiplier(ctx, c.mon, c.side, 'spe')), c.stages.spe, c.mon.status?.id === 'par' && !quickFeet);
  if (ability && weather && WEATHER_SPEED[ability]?.includes(weather)) speed *= 2;
  if (quickFeet) speed = Math.floor(speed * 1.5);
  if (ability === 'slow-start' && c.vol.turnsOut < 5) speed = Math.floor(speed / 2);
  return speed * (c.side === 'player' ? (ctx.attributes?.speed ?? 1) : 1);
}

/** Move priority with Prankster (status moves), Gale Wings (Flying moves at full HP) and Triage (healing moves). */
function priorityOf(ctx: BattleContext, c: Combatant, move: Move): number {
  const ability = abilityIn(ctx, c);
  if (ability === 'prankster' && move.category === 'status') return move.priority + 1;
  if (ability === 'gale-wings' && move.type === 'flying' && c.mon.hp >= calcStats(ctx.content, c.mon).hp) return move.priority + 1;
  if (ability === 'triage' && (move.effects.heal || move.effects.drain)) return move.priority + 3;
  return move.priority;
}

function decideOrder(ctx: BattleContext, rng: Rng, player: Combatant, pMove: Move, enemy: Combatant, eMove: Move): Side {
  // Custap Berry moves first and Lagging Tail last within the same priority.
  const result = compareTurnOrder(
    { priority: priorityOf(ctx, player, pMove) + Held.orderBracket(ctx, player) / 10, speed: speedOf(ctx, player) },
    { priority: priorityOf(ctx, enemy, eMove) + Held.orderBracket(ctx, enemy) / 10, speed: speedOf(ctx, enemy) },
  );
  if (result === 'tie') return rng.chance(0.5) ? 'player' : 'enemy';
  return result === 'a' ? 'player' : 'enemy';
}

/** Checks recharging, sleep, freeze, flinching, confusion and paralysis. Returns false if the Pokémon can't act. */
function canAct(ctx: BattleContext, user: Combatant, events: BattleEvent[]): boolean {
  const { content, rng } = ctx;
  const ability = abilityIn(ctx, user);
  if (user.vol.truant) {
    user.vol.truant = false;
    announce(user, 'truant', events);
    events.push({ type: 'cant', side: user.side, reason: 'truant' });
    return false;
  }
  if (user.vol.recharge) {
    user.vol.recharge = false;
    events.push({ type: 'cant', side: user.side, reason: 'recharge' });
    return false;
  }
  const status = user.mon.status;
  if (status?.id === 'slp') {
    const turns = status.turns ?? 0;
    if (turns > 0) {
      // Early Bird wakes up twice as fast.
      status.turns = Math.max(0, turns - (ability === 'early-bird' ? 2 : 1));
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
    if (ability === 'steadfast') {
      announce(user, ability, events);
      applyStageChange(ctx, user, 'spe', 1, events);
    }
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
  const rivalry = rivalryMultiplier(ctx, user, target);
  if (!mods && !attrs && rivalry === 1) return damage;
  let multiplier = rivalry;
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

/**
 * Takes HP from a Pokémon (`hit` is the hit number when a move did it). `knockedDown` is true when a
 * Hyper moment got it back up after the hit took all its HP (the screen shows it at 0 first).
 */
function takeHp(
  ctx: BattleContext,
  c: Combatant,
  amount: number,
  hit: number | null = null,
): { lost: number; lastStand: string | null; hyper: HyperEvent | null; knockedDown: boolean } {
  let lost = Math.min(Math.max(0, amount), c.mon.hp);
  let lastStand: string | null = null;
  // A fatal hit from a move may be survived by a Hyper moment (decided before the charm).
  if (hit !== null && c.side === 'player' && lost > 0 && lost >= c.mon.hp) {
    const hyper = hyperKnockout(ctx, c, hit);
    if (hyper) {
      lost = c.mon.hp - (hyper.hpAfter > 0 && !hyper.revived ? hyper.hpAfter : 0);
      c.mon.hp = hyper.hpAfter;
      return { lost, lastStand: null, hyper: hyper.event, knockedDown: hyper.revived };
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
  return { lost, lastStand, hyper: null, knockedDown: false };
}

type HyperEvent = Extract<BattleEvent, { type: 'hyper' }>;

/**
 * Tries the moment for `trigger`: eligible, off cooldown, and the roll succeeds (its chance times
 * `multiplier`, from a held item). Marks the cooldown when it fires.
 */
function tryHyper(ctx: BattleContext, trigger: StoryTriggerKind, mon: PokemonInstance, multiplier = 1): HyperEligibility | null {
  if (!ctx.hyper || ctx.hyperUsed) return null;
  const found = ctx.hyper.eligibility(trigger, mon);
  if (!found) return null;
  const e = multiplier === 1 ? found : { ...found, chance: Math.min(1, found.chance * multiplier) };
  const key = cooldownKey(e.def, mon.uid);
  if (hasBattleEffect(ctx.battle, key) || !rollHyper(ctx.hyper, e)) return null;
  markBattleEffect(ctx.battle, key);
  ctx.hyperUsed = true;
  return e;
}

/**
 * A fatal hit on your Pokémon: Toughened It Out (it had enough HP before the hit, first hit only),
 * then Felt a Bond, then Pushed Itself Back Up (it goes down, then gets back up).
 */
function hyperKnockout(ctx: BattleContext, c: Combatant, hit: number): { hpAfter: number; revived: boolean; event: HyperEvent } | null {
  const max = calcStats(ctx.content, c.mon).hp;
  const make = (e: HyperEligibility, hpAfter: number, revived: boolean) => ({
    hpAfter,
    revived,
    event: { type: 'hyper' as const, side: c.side, uid: c.mon.uid, defId: e.def.id, variant: e.variant, hpAfter, cured: false },
  });
  if (hit === 0) {
    const tough = ctx.hyper?.eligibility('toughenedItOut', c.mon);
    const share = tough?.def.triggerConditions.minHpShare ?? 0;
    if (tough && c.mon.hp > 1 && c.mon.hp >= max * share) {
      // A Destiny Knot doubles the holder's chance.
      const e = tryHyper(ctx, 'toughenedItOut', c.mon, Held.endureMultiplier(ctx, c.mon, c.side));
      if (e) return make(e, 1, false);
    }
    if (c.mon.hp > 1) {
      const e = tryHyper(ctx, 'feltABond', c.mon);
      if (e) return make(e, 1, false);
    }
  }
  const back = tryHyper(ctx, 'pushedBackUp', c.mon);
  if (back && back.def.effect?.kind === 'revive') return make(back, Math.max(1, Math.floor(max * back.def.effect.hpShare)), true);
  return null;
}

// ---------- The Enemy Is Getting Riled Up ----------

function rageOf(ctx: BattleContext, uid: string): EnemyRage {
  const all = (ctx.battle.hyper.rage ??= {});
  return (all[uid] ??= { hits: 0, state: 'calm', uncontrollable: false, denied: false });
}

/**
 * Runs one side's move between the rage checks: a warned enemy unleashes its rage just before
 * it acts; afterwards your move may have built it up or calmed it, and the enemy's move may
 * have been denied its finishing blow.
 */
function actWithRage(ctx: BattleContext, user: Combatant, enemy: Combatant, events: BattleEvent[], act: () => void): void {
  if (user.side === 'enemy') unleashRage(ctx, user, events);
  const start = events.length;
  act();
  const done = events.slice(start);
  if (!ctx.hyper) return;
  const rage = rageOf(ctx, enemy.mon.uid);
  if (user.side === 'enemy') {
    if (done.some((e) => (e.type === 'hyper' && e.side === 'player' && !e.cured) || (e.type === 'lastStand' && e.side === 'player') || (e.type === 'held' && e.side === 'player' && e.what === 'survive'))) {
      rage.denied = true;
    }
    return;
  }
  if (rage.state === 'warned') {
    // The counters: a status, a super-effective hit, or a move that lowers its Attack or Sp. Atk.
    const countered = done.some(
      (e) =>
        (e.type === 'status' && e.side === 'enemy') ||
        (e.type === 'damage' && e.side === 'enemy' && e.effectiveness > 1) ||
        (e.type === 'stat' && e.side === 'enemy' && e.change < 0 && (e.stat === 'atk' || e.stat === 'spa')),
    );
    if (countered && enemy.mon.hp > 0) {
      rage.state = 'spent';
      const def = ctx.hyper.eligibility('enemyRiledUp', enemy.mon)?.def;
      if (def) events.push({ type: 'hyper', side: 'enemy', uid: enemy.mon.uid, defId: def.id, variant: 'calmed', hpAfter: enemy.mon.hp, cured: false });
    }
  } else if (rage.state === 'calm' && done.some((e) => e.type === 'damage' && e.side === 'enemy' && e.amount > 0)) {
    rage.hits += 1;
  }
}

/** End of turn: enough hits taken, or a finishing blow denied, and the enemy gets riled up (shown a turn ahead). */
function rageEndOfTurn(ctx: BattleContext, enemy: Combatant, events: BattleEvent[]): void {
  if (!ctx.hyper) return;
  const rage = rageOf(ctx, enemy.mon.uid);
  const need = ctx.hyper.eligibility('enemyRiledUp', enemy.mon)?.def.triggerConditions.hits ?? Infinity;
  if (rage.state === 'calm' && (rage.hits >= need || rage.denied)) warnRage(ctx, enemy.mon, events);
  rage.denied = false;
}

/** The warning: the enemy will be stronger on its next move. A statused enemy can't build up. */
function warnRage(ctx: BattleContext, mon: PokemonInstance, events: BattleEvent[]): void {
  if (!ctx.hyper || ctx.enemyHyperUsed || mon.hp <= 0 || mon.status) return;
  const rage = rageOf(ctx, mon.uid);
  if (rage.state !== 'calm') return;
  const e = ctx.hyper.eligibility('enemyRiledUp', mon);
  if (!e) return;
  const key = cooldownKey(e.def, mon.uid);
  if (hasBattleEffect(ctx.battle, key) || !rollHyper(ctx.hyper, e)) return;
  markBattleEffect(ctx.battle, key);
  ctx.enemyHyperUsed = true;
  // Evil makes its rage uncontrollable more often (rolled only when Evil is above 0).
  const evil = e.def.variants.uncontrollable ? ctx.hyper.attributeShare('evil') : 0;
  rage.uncontrollable = evil > 0 && ctx.hyper.rng.chance(evil);
  rage.state = 'warned';
  events.push({ type: 'hyper', side: 'enemy', uid: mon.uid, defId: e.def.id, variant: rage.uncontrollable ? 'uncontrollable' : null, hpAfter: mon.hp, cured: false });
}

/** Just before a warned enemy acts, its rage is unleashed: it raises its attacks (and lowers its Defense if uncontrollable). */
function unleashRage(ctx: BattleContext, enemy: Combatant, events: BattleEvent[]): void {
  if (!ctx.hyper) return;
  const rage = ctx.battle.hyper.rage?.[enemy.mon.uid];
  if (!rage || rage.state !== 'warned') return;
  rage.state = 'spent';
  const def = ctx.hyper.eligibility('enemyRiledUp', enemy.mon)?.def;
  if (!def || def.effect?.kind !== 'rage') return;
  events.push({ type: 'hyper', side: 'enemy', uid: enemy.mon.uid, defId: def.id, variant: rage.uncontrollable ? 'unleashedUncontrollable' : 'unleashed', hpAfter: enemy.mon.hp, cured: false });
  for (const [stat, stages] of Object.entries(def.effect.stats) as [BoostStat, number][]) applyStageChange(ctx, enemy, stat, stages, events);
  if (rage.uncontrollable) for (const [stat, stages] of Object.entries(def.effect.uncontrollable) as [BoostStat, number][]) applyStageChange(ctx, enemy, stat, stages, events);
}

// ---------- The Two Pokémon Feel a Heated Rivalry ----------

function rivalryDef(ctx: BattleContext, trigger: 'heatedRivalry' | 'friendlyCompetition') {
  const def = ctx.content.story.definitions.find((d) => d.triggerConditions.trigger === trigger);
  return def?.effect?.kind === 'rivalry' ? { def, effect: def.effect } : null;
}

/**
 * Your Pokémon meets an opposing species it has fought in enough battles (counting this one):
 * they recognise each other once per battle, and your Rage may make yours reckless (it hits
 * even harder but lowers its own Defense). The rivalry's damage bonus lasts the battle.
 */
function meetRival(ctx: BattleContext, p: Combatant, e: Combatant, events: BattleEvent[]): void {
  if (!ctx.hyper || p.mon.hp <= 0 || e.mon.hp <= 0) return;
  const h = ctx.battle.hyper;
  const met = (h.met ??= {});
  const seen = (met[p.mon.uid] ??= []);
  if (!seen.includes(e.mon.speciesId)) seen.push(e.mon.speciesId);
  const key = `${p.mon.uid}|${e.mon.speciesId}`;
  const rivals = (h.rivals ??= {});
  const found = rivalryDef(ctx, 'heatedRivalry');
  if (rivals[key] || !found || !ctx.hyper.eligibility('heatedRivalry', p.mon)) return;
  const need = found.def.triggerConditions.battles ?? Infinity;
  const battles = ctx.hyper.rivalBattles(p.mon.uid, e.mon.speciesId) + 1;
  if (battles < need) return;
  // Rage makes it reckless more often (rolled only when Rage is above 0, and not after another moment this turn).
  const rage = found.def.variants.reckless && !ctx.hyperUsed ? ctx.hyper.attributeShare('rage') : 0;
  const reckless = rage > 0 && ctx.hyper.rng.chance(rage);
  rivals[key] = reckless ? 'reckless' : 'calm';
  events.push({ type: 'hyper', side: 'player', uid: p.mon.uid, defId: found.def.id, variant: battles > need ? 'again' : null, hpAfter: p.mon.hp, cured: false });
  if (!reckless) return;
  ctx.hyperUsed = true;
  events.push({ type: 'hyper', side: 'player', uid: p.mon.uid, defId: found.def.id, variant: 'reckless', hpAfter: p.mon.hp, cured: false });
  for (const [stat, stages] of Object.entries(found.effect.reckless) as [BoostStat, number][]) applyStageChange(ctx, p, stat, stages, events);
}

/** A teammate rival saw your Pokémon land a finishing blow: it won't be outdone for the rest of the battle. */
function friendlyFinish(ctx: BattleContext, finisher: PokemonInstance, events: BattleEvent[]): void {
  if (!ctx.hyper) return;
  const found = rivalryDef(ctx, 'friendlyCompetition');
  if (!found) return;
  const outdo = (ctx.battle.hyper.outdo ??= []);
  for (const uid of ctx.hyper.friendlyRivals(finisher.uid)) {
    const mon = ctx.party.find((m) => m.uid === uid);
    if (!mon || mon.hp <= 0 || outdo.includes(uid)) continue;
    outdo.push(uid);
    events.push({ type: 'hyper', side: 'player', uid, defId: found.def.id, variant: 'outdo', hpAfter: mon.hp, cured: false });
  }
}

/** The rivalry damage bonuses for your Pokémon's hit. */
function rivalryMultiplier(ctx: BattleContext, user: Combatant, target: Combatant): number {
  const h = ctx.battle.hyper;
  if (!ctx.hyper || user.side !== 'player' || !h) return 1;
  let multiplier = 1;
  const state = h.rivals?.[`${user.mon.uid}|${target.mon.speciesId}`];
  if (state) {
    const found = rivalryDef(ctx, 'heatedRivalry');
    if (found) multiplier *= 1 + (state === 'reckless' ? found.effect.recklessDamage : found.effect.damage);
  }
  if (h.outdo?.includes(user.mon.uid)) {
    const found = rivalryDef(ctx, 'friendlyCompetition');
    if (found) multiplier *= 1 + found.effect.damage;
  }
  return multiplier;
}

/** End of turn: a bond may shake off a status; a long low-HP stand (or two super-effective hits survived) digs in. */
function hyperEndOfTurn(ctx: BattleContext, c: Combatant, events: BattleEvent[]): void {
  const { battle } = ctx;
  const state = battle.hyper;
  if (c.mon.hp <= 0) {
    state.lowHp = null;
    return;
  }
  const hung = ctx.hyper?.eligibility('hungInThere', c.mon);
  const max = calcStats(ctx.content, c.mon).hp;
  const cond = hung?.def.triggerConditions;
  const low = c.mon.hp <= max * (cond?.lowHpShare ?? 0.25);
  state.lowHp = low ? { uid: c.mon.uid, turns: state.lowHp?.uid === c.mon.uid ? state.lowHp.turns + 1 : 1 } : null;

  if (c.mon.status) {
    const e = tryHyper(ctx, 'feltABond', c.mon);
    if (e) {
      c.mon.status = null;
      events.push({ type: 'hyper', side: c.side, uid: c.mon.uid, defId: e.def.id, variant: e.variant, hpAfter: c.mon.hp, cured: true });
      return;
    }
  }

  if (!hung || !cond) return;
  const stood = (state.lowHp?.turns ?? 0) >= (cond.turns ?? Infinity);
  const shrugged = (state.superEffective[c.mon.uid] ?? 0) >= (cond.superEffectiveHits ?? Infinity);
  if (!stood && !shrugged) return;
  const e = tryHyper(ctx, 'hungInThere', c.mon);
  if (!e || e.def.effect?.kind !== 'boost') return;
  const fx = e.def.effect;
  const variant = !stood && shrugged && e.def.variants.wouldntStayDown ? 'wouldntStayDown' : e.variant;
  events.push({ type: 'hyper', side: c.side, uid: c.mon.uid, defId: e.def.id, variant, hpAfter: c.mon.hp, cured: false });
  for (const [stat, stages] of Object.entries(fx.stats) as [BoostStat, number][]) applyStageChange(ctx, c, stat, stages, events);
  const scale = fx.healAttribute ? ctx.hyper!.attributeShare(fx.healAttribute) : 1;
  const heal = Math.min(max - c.mon.hp, Math.floor(max * fx.healShare * scale));
  if (heal > 0) {
    c.mon.hp += heal;
    events.push({ type: 'heal', side: c.side, amount: heal, hpAfter: c.mon.hp });
  }
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

  if (abilityIn(ctx, user) === 'truant') user.vol.truant = true;

  // The second turn of a two-turn move and more Thrash use no PP; Pressure makes a move use 2.
  if (slot === -1) events.push({ type: 'noPp', side: user.side });
  else if (!continuing) {
    const pp = user.mon.moves[slot]!;
    pp.pp = Math.max(0, pp.pp - (abilityIn(ctx, target) === 'pressure' && move.target === 'enemy' ? 2 : 1));
  }
  events.push({ type: 'move', side: user.side, moveId: move.id });
  if (!move.effects.protect) user.vol.protectChain = 0;
  if (slot !== -1) Held.noteMoveUsed(ctx, user, move.id);

  // Damp stops Explosion and Self-Destruct from either side.
  if (move.effects.selfFaint) {
    const damp = [target, user].find((c) => abilityIn(ctx, c) === 'damp');
    if (damp) {
      announce(damp, 'damp', events);
      events.push({ type: 'fail', side: user.side });
      return;
    }
  }

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

  // Psychic Terrain: a grounded Pokémon can't be hit by a move with priority.
  if (ctx.battle.terrain?.id === 'psychic' && user.side !== target.side && priorityOf(ctx, user, move) > 0 && isGrounded(ctx, target)) {
    events.push({ type: 'fail', side: user.side });
    return;
  }

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
      for (const change of fx.charge.boosts ?? []) applyStageChange(ctx, user, change.stat, change.stages, events);
      return;
    }
  }

  if (fx.terrain) {
    if (ctx.battle.terrain?.id === fx.terrain) {
      events.push({ type: 'fail', side: user.side });
    } else {
      ctx.battle.terrain = { id: fx.terrain, turns: 5 };
      events.push({ type: 'terrain', terrain: fx.terrain });
    }
    return;
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
  const userAbility = abilityIn(ctx, user);
  const foeAbility = targetsEnemy ? targetAbility(ctx, user, target) : null;
  const noGuard = userAbility === 'no-guard' || abilityIn(ctx, target) === 'no-guard';
  // A hidden target can only be hit by the moves that reach it (Earthquake hits Dig), or with No Guard.
  if (targetsEnemy && target.vol.semi && fx.hitsSemi?.semi !== target.vol.semi && !noGuard) {
    events.push({ type: 'avoided', side: target.side });
    return;
  }
  // Z-Moves go through Protect for a quarter of their damage (see the damage step).
  if (targetsEnemy && target.protected && !fx.breaksProtect && !move.flags.includes('zmove') && !move.flags.includes('max')) {
    events.push({ type: 'protected', side: target.side });
    return;
  }
  if (fx.ohko && target.mon.level > user.mon.level) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (fx.ohko && foeAbility === 'sturdy') {
    announce(target, 'sturdy', events);
    events.push({ type: 'noEffect', side: target.side });
    return;
  }
  // Thunder never misses in rain (half the time in sun); Blizzard never misses in snow or hail.
  const sure = fx.sureIn !== undefined && (fx.sureIn === weather || (fx.sureIn === 'snow' && weather === 'hail'));
  const baseAccuracy = sure ? null : fx.sureIn === 'rain' && weather === 'sun' ? 50 : move.accuracy;
  const itemAccuracy = targetsEnemy ? Held.accuracyMultiplier(ctx, user, target, !movedFirst, move) : 1;
  let accuracy: number;
  if (itemAccuracy === null) {
    accuracy = 1;
  } else if (fx.ohko) {
    accuracy = ohkoAccuracy(user.mon.level, target.mon.level);
  } else {
    // Unaware ignores the other side's stages; Keen Eye ignores raised evasion.
    const accStage = foeAbility === 'unaware' ? 0 : user.stages.acc;
    const keenEye = (userAbility === 'keen-eye' || userAbility === 'minds-eye') && target.stages.eva > 0;
    const evaStage = fx.ignoreStages || userAbility === 'unaware' || keenEye ? 0 : target.stages.eva;
    accuracy = hitChance(baseAccuracy, accStage, evaStage) * itemAccuracy;
    if (baseAccuracy !== null) {
      if (userAbility === 'compound-eyes') accuracy *= 1.3;
      if (userAbility === 'victory-star') accuracy *= 1.1;
      if (userAbility === 'hustle' && move.category === 'physical') accuracy *= 0.8;
      if (foeAbility && weather && WEATHER_EVASION[foeAbility]?.includes(weather)) accuracy *= 0.8;
    }
    accuracy = Math.min(1, accuracy);
  }
  if (noGuard) accuracy = 1;
  if (targetsEnemy && rng.float() >= accuracy) {
    events.push({ type: 'miss', side: user.side });
    return;
  }

  // The move's type: Weather Ball follows the weather; Pixilate and friends turn Normal moves into their type.
  const baseType = fx.weatherBall && weather ? WEATHER_BALL_TYPE[weather] : Held.moveTypeFor(ctx, user.mon, user.side, move.type);
  const typeChange = userAbility ? TYPE_CHANGE[userAbility] : undefined;
  const changedType = typeChange !== undefined && baseType === 'normal' && !move.flags.includes('typeless');
  const moveType = changedType ? typeChange : baseType;
  const targetTypes = battleTypes(content, ctx.battle, target.mon);
  // Scrappy: Normal and Fighting moves hit Ghost types.
  const hitTypes = userAbility === 'scrappy' && (moveType === 'normal' || moveType === 'fighting') ? targetTypes.filter((t) => t !== 'ghost') : targetTypes;
  const effectiveness = move.flags.includes('typeless') ? 1 : Held.adjustEffectiveness(ctx, target, moveType, typeEffectiveness(content.typeChart, moveType, hitTypes));
  if (targetsEnemy && abilityBlocksMove(ctx, user, target, move, moveType, effectiveness, events)) return;

  if (move.category === 'status') {
    applyStatusMove(ctx, user, target, move, events);
    return;
  }

  // Damaging move.
  if (effectiveness === 0) {
    events.push({ type: 'noEffect', side: target.side });
    return;
  }

  const contact = move.flags.includes('contact') && userAbility !== 'long-reach';
  const changes = fx.statChanges ?? [];
  // Sheer Force: moves with an extra effect are 1.3× as strong and lose the effect.
  const hasExtra = Boolean(fx.status || fx.flinchChance || fx.confuse || changes.some((c) => c.target === 'enemy' || c.chance < 100));
  const sheerForce = userAbility === 'sheer-force' && hasExtra;
  const hits = fx.hits ? (userAbility === 'skill-link' ? fx.hits[1] : multiHitCount(fx.hits, rng)) : 1;
  let dealt = 0;
  let landed = 0;
  let anyCrit = false;
  for (let hit = 0; hit < hits && target.mon.hp > 0 && user.mon.hp > 0; hit++) {
    let damage: number;
    let crit = false;
    const targetMax = calcStats(content, target.mon).hp;
    if (fx.ohko) {
      damage = target.mon.hp;
    } else if (fx.fixedDamage === 'level') {
      damage = user.mon.level;
    } else {
      const userStats = calcStats(content, user.mon);
      const targetStats = calcStats(content, target.mon);
      const physical = move.category === 'physical';
      const hitsDefense = physical || fx.targetsDefense;
      const userStatus = user.mon.status?.id;
      crit = rng.chance(critChance(content.ruleset, move.critStage + Held.critStageBonus(ctx, user) + (userAbility === 'super-luck' ? 1 : 0)));
      if (userAbility === 'merciless' && target.mon.status?.id === 'psn') crit = true;
      if (foeAbility === 'battle-armor' || foeAbility === 'shell-armor') crit = false;
      const randomFactor = rng.int(content.ruleset.randomFactorMin, 100);
      let power = fx.lowHpPower ? lowHpPower(user.mon.hp, userStats.hp) : (move.power ?? 0);
      power = teraPower(ctx.battle, user.mon, { ...move, type: moveType }, power);
      const stab = move.flags.includes('typeless') ? 1 : stabMultiplier(content, ctx.battle, user.mon, moveType);
      if (fx.doubleBelowHalf && target.mon.hp * 2 <= targetStats.hp) power *= 2;
      if (fx.hitsSemi?.double && target.vol.semi === fx.hitsSemi.semi) power *= 2;
      if (fx.weatherBall && weather) power *= 2;
      if (fx.charge?.sunSkips && weather && weather !== 'sun') power = Math.floor(power / 2);
      // Abilities that change the move's power.
      let powerMult = 1;
      if (changedType) powerMult *= 1.2;
      if (userAbility === 'technician' && power <= 60) powerMult *= 1.5;
      const flagBoost = userAbility ? FLAG_BOOST[userAbility] : undefined;
      if (flagBoost && move.flags.includes(flagBoost.flag)) powerMult *= flagBoost.multiplier;
      if (userAbility === 'reckless' && fx.recoil) powerMult *= 1.2;
      if (sheerForce) powerMult *= 1.3;
      if (userAbility === 'analytic' && !movedFirst) powerMult *= 1.3;
      if (foeAbility === 'heatproof' && moveType === 'fire') powerMult *= 0.5;
      if (foeAbility === 'dry-skin' && moveType === 'fire') powerMult *= 1.25;
      if (powerMult !== 1) power = Math.max(1, pokeRound(power, powerMult));
      // Abilities that change the attacking stat.
      let attack = Math.floor((physical ? userStats.atk : userStats.spa) * Held.heldStatMultiplier(ctx, user.mon, user.side, physical ? 'atk' : 'spa'));
      let attackMult = 1;
      if (physical && (userAbility === 'huge-power' || userAbility === 'pure-power')) attackMult *= 2;
      if (physical && userAbility === 'hustle') attackMult *= 1.5;
      if (physical && userAbility === 'guts' && userStatus) attackMult *= 1.5;
      if (physical && userAbility === 'toxic-boost' && userStatus === 'psn') attackMult *= 1.5;
      if (!physical && userAbility === 'flare-boost' && userStatus === 'brn') attackMult *= 1.5;
      if (!physical && userAbility === 'solar-power' && weather === 'sun') attackMult *= 1.5;
      if (physical && userAbility === 'slow-start' && user.vol.turnsOut < 5) attackMult *= 0.5;
      if (userAbility === 'defeatist' && user.mon.hp * 2 <= userStats.hp) attackMult *= 0.5;
      if (userAbility && PINCH[userAbility] === moveType && user.mon.hp * 3 <= userStats.hp) attackMult *= 1.5;
      if (user.vol.flashFire && moveType === 'fire') attackMult *= 1.5;
      if (foeAbility === 'thick-fat' && (moveType === 'fire' || moveType === 'ice')) attackMult *= 0.5;
      if (attackMult !== 1) attack = Math.max(1, pokeRound(attack, attackMult));
      const defenseStage = hitsDefense ? target.stages.def : target.stages.spd;
      // Sandstorm raises Rock types' Sp. Def and snow raises Ice types' Defense by half.
      let defense = Math.floor((hitsDefense ? targetStats.def : targetStats.spd) * Held.heldStatMultiplier(ctx, target.mon, target.side, hitsDefense ? 'def' : 'spd'));
      if (weather === 'sand' && !hitsDefense && targetTypes.includes('rock')) defense = Math.floor(defense * 1.5);
      if (weather === 'snow' && hitsDefense && targetTypes.includes('ice')) defense = Math.floor(defense * 1.5);
      if (hitsDefense && foeAbility === 'marvel-scale' && target.mon.status) defense = Math.floor(defense * 1.5);
      if (hitsDefense && foeAbility === 'fur-coat') defense *= 2;
      // Abilities that change the final damage.
      let final = 1;
      if (effectiveness > 1 && (foeAbility === 'filter' || foeAbility === 'solid-rock' || foeAbility === 'prism-armor')) final *= 0.75;
      if ((foeAbility === 'multiscale' || foeAbility === 'shadow-shield') && target.mon.hp >= targetStats.hp) final *= 0.5;
      if (userAbility === 'tinted-lens' && effectiveness < 1) final *= 2;
      if (foeAbility === 'fluffy' && contact) final *= 0.5;
      if (foeAbility === 'fluffy' && moveType === 'fire') final *= 2;
      if (foeAbility === 'ice-scales' && !physical) final *= 0.5;
      if (foeAbility === 'punk-rock' && move.flags.includes('sound')) final *= 0.5;
      const ruleset = crit ? { ...content.ruleset, critMultiplier: Held.critDamage(ctx, user, content.ruleset.critMultiplier) } : content.ruleset;
      damage = calcDamage(ruleset, {
        level: user.mon.level,
        power,
        attack,
        defense,
        attackStage: foeAbility === 'unaware' ? 0 : physical ? user.stages.atk : user.stages.spa,
        defenseStage: fx.ignoreStages || userAbility === 'unaware' ? 0 : defenseStage,
        stab: stab > 1,
        // Adaptability: 2× instead of 1.5× (2.25× instead of 2× when Terastallized into its own type).
        stabMultiplier: userAbility === 'adaptability' && stab > 1 ? (stab >= 2 ? 2.25 : 2) : stab,
        effectiveness,
        crit,
        critMultiplier: userAbility === 'sniper' ? ruleset.critMultiplier * 1.5 : undefined,
        randomFactor,
        // Guts ignores the burn's Attack cut.
        burned: userStatus === 'brn' && userAbility !== 'guts',
        physical,
        weather: weatherMultiplier(weather, moveType),
        final,
      });
      damage = applyTypeModifiers(ctx, user, target, effectiveness, damage, physical);
      const itemMultiplier =
        terrainMultiplier(ctx, user, target, moveType) *
        Held.attackMultiplier(ctx, user, target, move, moveType, effectiveness, events as Held.HeldEvent[]) *
        Held.defenseMultiplier(ctx, target, moveType, effectiveness, ctx.battle.kind === 'wild' && target.side === 'player', events as Held.HeldEvent[]);
      if (itemMultiplier !== 1) damage = Math.max(1, Math.floor(damage * itemMultiplier));
      if (target.protected && (move.flags.includes('zmove') || move.flags.includes('max'))) damage = Math.max(1, Math.floor(damage / 4));
    }
    damage = Held.survive(ctx, target, damage, events as Held.HeldEvent[]);
    if (fx.leaveOne) damage = Math.min(damage, target.mon.hp - 1);
    // Sturdy: a hit at full HP leaves it with at least 1 HP.
    const sturdy = foeAbility === 'sturdy' && target.mon.hp >= targetMax && target.mon.hp > 1 && damage >= target.mon.hp;
    if (sturdy) damage = target.mon.hp - 1;

    const { lost, lastStand, hyper, knockedDown } = takeHp(ctx, target, damage, landed);
    dealt += lost;
    landed += 1;
    anyCrit ||= crit;
    // Pushed Itself Back Up: the hit knocks it down first, then it gets up.
    events.push({ type: 'damage', side: target.side, amount: lost, hpAfter: knockedDown ? 0 : target.mon.hp, effectiveness, crit });
    if (sturdy) announce(target, 'sturdy', events);
    if (lastStand) events.push({ type: 'lastStand', side: target.side, itemId: lastStand });
    if (hyper) events.push(hyper);
    if (target.side === 'player' && effectiveness > 1 && target.mon.hp > 0) {
      ctx.battle.hyper.superEffective[target.mon.uid] = (ctx.battle.hyper.superEffective[target.mon.uid] ?? 0) + 1;
    }
  }
  if (fx.hits) events.push({ type: 'hits', side: target.side, count: landed });
  Held.afterHit(ctx, user, target, move, moveType, effectiveness, dealt, movedFirst, events as Held.HeldEvent[]);
  if (target.mon.hp <= 0) Held.onKnockout(ctx, user, events as Held.HeldEvent[]);
  if (fx.ohko && target.mon.hp <= 0) events.push({ type: 'ohko', side: target.side });
  if (fx.recharge) user.vol.recharge = true;

  // A damaging Fire move thaws a frozen target.
  if (moveType === 'fire' && target.mon.status?.id === 'frz' && target.mon.hp > 0) {
    target.mon.status = null;
    events.push({ type: 'thaw', side: target.side });
  }

  if (fx.drain && dealt > 0) {
    const amount = Math.max(1, Math.floor(dealt * fx.drain * Held.drainMultiplier(ctx, user.mon, user.side)));
    if (abilityIn(ctx, target) === 'liquid-ooze') {
      // Liquid Ooze: draining it hurts instead.
      announce(target, 'liquid-ooze', events);
      abilityHurt(ctx, user, amount, events);
    } else {
      const userMax = calcStats(content, user.mon).hp;
      const heal = Math.min(userMax - user.mon.hp, amount);
      if (heal > 0) {
        user.mon.hp += heal;
        events.push({ type: 'drain', side: user.side, amount: heal, hpAfter: user.mon.hp });
      }
    }
  }
  // Rock Head and Magic Guard take no recoil (Struggle's still hurts).
  if (fx.recoil && dealt > 0 && userAbility !== 'rock-head' && userAbility !== 'magic-guard') {
    applyRecoil(ctx, user, Math.max(1, Math.floor(dealt * fx.recoil)), events);
    // The user of a recoil move wins if both sides run out at once.
    if (user.mon.hp <= 0) ctx.doubleKoLoser = user.side === 'player' ? 'enemy' : 'player';
  }
  if (fx.recoilMaxHp) applyRecoil(ctx, user, Math.max(1, Math.floor(calcStats(content, user.mon).hp * fx.recoilMaxHp)), events);

  // Extra effects only land if the target is still standing. Serene Grace doubles their chances; Shield Dust blocks them.
  const chanceMult = userAbility === 'serene-grace' ? 2 : 1;
  const shielded = foeAbility === 'shield-dust';
  const roll = (percent: number) => rng.chance(Math.min(100, percent * chanceMult) / 100);
  if (target.mon.hp > 0 && !sheerForce && !shielded) {
    if (fx.status && roll(fx.status.chance)) tryInflictStatus(ctx, user, target, fx.status.id, move, events, false);
    if (fx.flinchChance && movedFirst && roll(fx.flinchChance)) flinch(ctx, user, target);
    else if (!fx.flinchChance && userAbility === 'stench' && movedFirst && rng.chance(0.1)) flinch(ctx, user, target);
    if (fx.confuse && roll(fx.confuse.chance)) tryConfuse(ctx, user, target, events, false);
  }
  if (target.mon.hp > 0 && fx.bind && target.vol.bound === 0) {
    target.vol.bound = rng.int(4, 5);
    events.push({ type: 'bound', side: target.side, moveId: move.id });
  }
  // Changes that share a chance are rolled together (Ancient Power raises all five stats or none).
  const rolls = new Map<number, boolean>();
  for (const change of changes) {
    const recipient = change.target === 'self' ? user : target;
    if (recipient.mon.hp <= 0) continue;
    if (sheerForce && (change.target === 'enemy' || change.chance < 100)) continue;
    if (shielded && change.target === 'enemy') continue;
    if (!rolls.has(change.chance)) rolls.set(change.chance, roll(change.chance));
    if (rolls.get(change.chance)) changeStage(ctx, user, recipient, change.stat, change.stages, events);
  }
  // Max Moves set the weather after they hit (Max Flare: sun).
  const maxWeather = move.flags.includes('max') && dealt > 0 ? maxMoveWeather(content, move.id) : null;
  if (maxWeather && ctx.battle.weather?.id !== maxWeather) {
    ctx.battle.weather = { id: maxWeather, turns: Held.weatherTurns(ctx, user, maxWeather, 5) };
    events.push({ type: 'weather', weather: maxWeather });
  }
  const maxTerrain = move.flags.includes('max') && dealt > 0 ? maxMoveTerrain(content, move.id) : null;
  if (maxTerrain && ctx.battle.terrain?.id !== maxTerrain) {
    ctx.battle.terrain = { id: maxTerrain, turns: 5 };
    events.push({ type: 'terrain', terrain: maxTerrain });
  }
  // G-Max Finale heals, Sweetness cures, Stun Shock and Befuddle inflict a random status.
  const extras = move.flags.includes('max') && dealt > 0 ? maxMoveExtras(content, move.id) : null;
  if (extras?.heal && user.mon.hp > 0) {
    const max = calcStats(content, user.mon).hp;
    const amount = Math.min(max - user.mon.hp, Math.max(1, Math.floor(max * extras.heal)));
    if (amount > 0) {
      user.mon.hp += amount;
      events.push({ type: 'heal', side: user.side, amount, hpAfter: user.mon.hp });
    }
  }
  if (extras?.cureUser && user.mon.status) {
    user.mon.status = null;
    events.push({ type: 'cured', side: user.side });
  }
  if (extras?.randomStatus && target.mon.hp > 0 && !target.mon.status) {
    tryInflictStatus(ctx, user, target, rng.pick(extras.randomStatus), undefined, events, false);
  }

  if (landed > 0) afterHitAbilities(ctx, user, target, move, moveType, contact, anyCrit, events);
}

/** Damage from an ability (Rough Skin, Liquid Ooze, Aftermath). Magic Guard prevents it. */
function abilityHurt(ctx: BattleContext, c: Combatant, amount: number, events: BattleEvent[]): void {
  if (c.mon.hp <= 0 || abilityIn(ctx, c) === 'magic-guard') return;
  const { lost, lastStand } = takeHp(ctx, c, amount);
  events.push({ type: 'damage', side: c.side, amount: lost, hpAfter: c.mon.hp, effectiveness: 1, crit: false });
  if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
}

/** Makes the target flinch, unless Inner Focus stops it or it is Dynamaxed. */
function flinch(ctx: BattleContext, user: Combatant, target: Combatant): void {
  if (targetAbility(ctx, user, target) !== 'inner-focus' && !target.mon.dynamaxed) target.flinched = true;
}

/**
 * Abilities that react to a hit: the target's contact abilities (Static,
 * Rough Skin, Aftermath), the attacker's Poison Touch, the target's stat
 * boosts (Justified, Stamina, Anger Point) and the attacker's Moxie.
 */
function afterHitAbilities(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, moveType: TypeName, contact: boolean, crit: boolean, events: BattleEvent[]): void {
  const { rng } = ctx;
  const holder = abilityIn(ctx, target);
  const userAbility = abilityIn(ctx, user);
  if (contact && holder && user.mon.hp > 0) {
    const status = CONTACT_STATUS[holder];
    if (status && rng.chance(0.3) && canGetStatus(ctx, target, user, status)) {
      announce(target, holder, events);
      tryInflictStatus(ctx, target, user, status, undefined, events, false);
    }
    if (holder === 'effect-spore' && rng.chance(0.3)) {
      const spore = (['psn', 'par', 'slp'] as const)[rng.int(0, 2)]!;
      const types = getSpecies(ctx.content, user.mon.speciesId).types;
      if (!types.includes('grass') && userAbility !== 'overcoat' && canGetStatus(ctx, target, user, spore)) {
        announce(target, holder, events);
        tryInflictStatus(ctx, target, user, spore, undefined, events, false);
      }
    }
    if (CONTACT_HURT.has(holder) && userAbility !== 'magic-guard') {
      announce(target, holder, events);
      abilityHurt(ctx, user, Math.max(1, Math.floor(calcStats(ctx.content, user.mon).hp / 8)), events);
    }
    if ((holder === 'gooey' || holder === 'tangling-hair') && user.mon.hp > 0) {
      announce(target, holder, events);
      applyStageChange(ctx, user, 'spe', -1, events, target);
    }
    if (holder === 'aftermath' && target.mon.hp <= 0 && userAbility !== 'magic-guard' && userAbility !== 'damp') {
      announce(target, holder, events);
      abilityHurt(ctx, user, Math.max(1, Math.floor(calcStats(ctx.content, user.mon).hp / 4)), events);
    }
  }
  if (contact && userAbility === 'poison-touch' && target.mon.hp > 0 && rng.chance(0.3) && canGetStatus(ctx, user, target, 'psn')) {
    announce(user, userAbility, events);
    tryInflictStatus(ctx, user, target, 'psn', undefined, events, false);
  }
  if (target.mon.hp > 0 && holder) {
    const boost = HIT_BOOST[holder];
    if (boost && (!boost.types || boost.types.includes(moveType)) && (!boost.physical || move.category === 'physical')) {
      announce(target, holder, events);
      for (const change of boost.changes) applyStageChange(ctx, target, change.stat, change.stages, events);
    }
    if (holder === 'anger-point' && crit && target.stages.atk < 6) {
      announce(target, holder, events);
      applyStageChange(ctx, target, 'atk', 12, events);
    }
  }
  const koBoost = userAbility ? KO_BOOST[userAbility] : undefined;
  if (koBoost && target.mon.hp <= 0 && user.mon.hp > 0) {
    let stat: BoostStat;
    if (koBoost === 'best') {
      // Beast Boost raises its highest stat.
      const stats = calcStats(ctx.content, user.mon);
      stat = (['atk', 'def', 'spa', 'spd', 'spe'] as const).reduce((best, s) => (stats[s] > stats[best] ? s : best));
    } else stat = koBoost;
    if (user.stages[stat] < 6) {
      announce(user, userAbility!, events);
      applyStageChange(ctx, user, stat, 1, events);
    }
  }
}

function applyStatusMove(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, events: BattleEvent[]): void {
  const { content } = ctx;
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
  if (fx.confuse) didSomething = tryConfuse(ctx, user, target, events, true) || didSomething;
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
    didSomething = tryInflictStatus(ctx, user, target, fx.status.id, move, events, true) || didSomething;
  }
  for (const change of fx.statChanges ?? []) {
    const recipient = change.target === 'self' ? user : target;
    didSomething = changeStage(ctx, user, recipient, change.stat, change.stages, events) || didSomething;
  }
  if (!didSomething && !fx.statChanges?.length && !fx.status && !fx.confuse) events.push({ type: 'fail', side: user.side });
}

/** Confuses for 2–5 turns of moves (1–4 of them are checks); Own Tempo prevents it. Returns true if it worked. */
function tryConfuse(ctx: BattleContext, source: Combatant, target: Combatant, events: BattleEvent[], announceFailure: boolean): boolean {
  const ownTempo = targetAbility(ctx, source, target) === 'own-tempo';
  if (target.vol.confusion > 0 || ownTempo || Held.statusBlocked(ctx, target, 'confusion')) {
    if (announceFailure && ownTempo) announce(target, 'own-tempo', events);
    if (announceFailure) events.push({ type: 'fail', side: target.side });
    return false;
  }
  target.vol.confusion = ctx.rng.int(2, 5);
  events.push({ type: 'confused', side: target.side });
  return true;
}

/** Whether `target` can get this status from `source` (types, abilities such as Limber, Leaf Guard in sun). */
function canGetStatus(ctx: BattleContext, source: Combatant, target: Combatant, status: StatusId, move?: Move): boolean {
  if (target.mon.status || target.mon.hp <= 0) return false;
  if (isStatusImmune(status, getSpecies(ctx.content, target.mon.speciesId).types, move)) return false;
  if (Held.statusBlocked({ content: ctx.content }, target, status)) return false;
  if (terrainBlocksStatus(ctx, target, status)) return false;
  return statusAbilityBlock(ctx, source, target, status) === null;
}

/** The target's ability that stops this status, or null. */
function statusAbilityBlock(ctx: BattleContext, source: Combatant, target: Combatant, status: StatusId): string | null {
  const ability = targetAbility(ctx, source, target);
  if (!ability) return null;
  if (STATUS_IMMUNE[ability]?.includes(status)) return ability;
  if (ability === 'leaf-guard' && ctx.battle.weather?.id === 'sun') return ability;
  return null;
}

/**
 * Returns true if the status was applied. `announceFailure` is for status
 * moves. Synchronize passes burn, poison and paralysis back to the source.
 */
function tryInflictStatus(
  ctx: BattleContext,
  source: Combatant,
  target: Combatant,
  status: StatusId,
  move: Move | undefined,
  events: BattleEvent[],
  announceFailure: boolean,
): boolean {
  const { content, rng } = ctx;
  const types = getSpecies(content, target.mon.speciesId).types;
  const blocker = target.mon.status ? null : statusAbilityBlock(ctx, source, target, status);
  if (target.mon.status || isStatusImmune(status, types, move) || blocker || Held.statusBlocked({ content }, target, status) || terrainBlocksStatus(ctx, target, status)) {
    if (announceFailure && blocker) announce(target, blocker, events);
    if (announceFailure) events.push({ type: 'fail', side: target.side });
    return false;
  }
  target.mon.status = { id: status };
  if (status === 'slp') {
    // Sleep length (turns skipped) is rolled when it starts.
    target.mon.status.turns = rng.int(content.ruleset.sleepTurnsMin, content.ruleset.sleepTurnsMax);
  }
  events.push({ type: 'status', side: target.side, status });
  if (source !== target && abilityIn(ctx, target) === 'synchronize' && (status === 'brn' || status === 'psn' || status === 'par') && canGetStatus(ctx, target, source, status)) {
    announce(target, 'synchronize', events);
    tryInflictStatus(ctx, target, source, status, undefined, events, false);
  }
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
  const changed = applyStageChange(ctx, recipient, stat, stages, events, recipient !== user ? user : undefined);
  if (changed && stages < 0) Held.whiteHerb(ctx, recipient, events as Held.HeldEvent[]);
  return changed;
}

/**
 * Changes a stat stage. Returns true if it actually changed. `source` is the
 * opposing Pokémon when it caused the change: Clear Body and friends block
 * its drops, and Defiant and Competitive answer them. Simple doubles every
 * change and Contrary reverses it.
 */
function applyStageChange(ctx: BattleContext, c: Combatant, stat: BoostStat, stages: number, events: BattleEvent[], source?: Combatant): boolean {
  const ability = source ? targetAbility(ctx, source, c) : abilityIn(ctx, c);
  if (ability === 'contrary') stages = -stages;
  if (ability === 'simple') stages *= 2;
  if (source && stages < 0 && ability) {
    const guard = DROP_GUARD[ability];
    if (guard === 'all' || guard === stat) {
      announce(c, ability, events);
      events.push({ type: 'fail', side: c.side });
      return false;
    }
  }
  const before = c.stages[stat];
  const after = clampStage(before + stages);
  if (after === before) {
    events.push({ type: 'statLimit', side: c.side, stat, up: stages > 0 });
    return false;
  }
  c.stages[stat] = after;
  events.push({ type: 'stat', side: c.side, stat, change: after - before });
  if (source && after < before && (ability === 'defiant' || ability === 'competitive')) {
    announce(c, ability, events);
    applyStageChange(ctx, c, ability === 'defiant' ? 'atk' : 'spa', 2, events);
  }
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

/**
 * End of turn: sandstorm and hail hurt (1/16 HP) the types and abilities they
 * don't spare, and weather abilities act (Rain Dish, Ice Body, Dry Skin, Solar
 * Power); then the weather counts down.
 */
/** On the ground: not a Flying type and without Levitate (and not hiding in the air or underground). */
function isGrounded(ctx: BattleContext, c: Combatant): boolean {
  if (c.vol.semi === 'air' || c.vol.semi === 'underground' || c.vol.semi === 'underwater') return false;
  if (abilityIn(ctx, c) === 'levitate') return false;
  return !getSpecies(ctx.content, c.mon.speciesId).types.includes('flying');
}

const TERRAIN_BOOST: Record<Terrain, TypeName> = { electric: 'electric', grassy: 'grass', psychic: 'psychic', misty: 'dragon' };

/** Electric, Grassy and Psychic Terrain: ×1.3 for a grounded user's moves of that type; Misty Terrain: ×0.5 for Dragon moves against a grounded target. */
function terrainMultiplier(ctx: BattleContext, user: Combatant, target: Combatant, moveType: TypeName): number {
  const terrain = ctx.battle.terrain?.id;
  if (!terrain || TERRAIN_BOOST[terrain] !== moveType) return 1;
  if (terrain === 'misty') return isGrounded(ctx, target) ? 0.5 : 1;
  return isGrounded(ctx, user) ? 1.3 : 1;
}

/** Electric Terrain stops sleep and Misty Terrain every status, for a grounded Pokémon. */
function terrainBlocksStatus(ctx: BattleContext, target: Combatant, status: StatusId): boolean {
  const terrain = ctx.battle.terrain?.id;
  if (terrain !== 'misty' && !(terrain === 'electric' && status === 'slp')) return false;
  return isGrounded(ctx, target);
}

/** End of turn: Grassy Terrain heals a grounded Pokémon 1/16 of its HP; the terrain runs down. */
function applyTerrain(ctx: BattleContext, sides: Combatant[], events: BattleEvent[]): void {
  const terrain = ctx.battle.terrain;
  if (!terrain) return;
  if (terrain.id === 'grassy') {
    for (const c of sides) {
      const max = calcStats(ctx.content, c.mon).hp;
      if (c.mon.hp <= 0 || c.mon.hp >= max || !isGrounded(ctx, c)) continue;
      const amount = Math.min(max - c.mon.hp, Math.max(1, Math.floor(max / 16)));
      c.mon.hp += amount;
      events.push({ type: 'heal', side: c.side, amount, hpAfter: c.mon.hp });
    }
  }
  terrain.turns -= 1;
  if (terrain.turns <= 0) {
    ctx.battle.terrain = null;
    events.push({ type: 'terrainEnd', terrain: terrain.id });
  }
}

function applyWeather(ctx: BattleContext, sides: Combatant[], events: BattleEvent[]): void {
  const weather = ctx.battle.weather;
  if (!weather) return;
  const immune = WEATHER_IMMUNE[weather.id];
  for (const c of sides) {
    if (c.mon.hp <= 0) continue;
    const ability = abilityIn(ctx, c);
    const max = calcStats(ctx.content, c.mon).hp;
    const heals = (ability === 'rain-dish' && weather.id === 'rain') || (ability === 'ice-body' && (weather.id === 'snow' || weather.id === 'hail'));
    const dryHeal = ability === 'dry-skin' && weather.id === 'rain';
    if ((heals || dryHeal) && c.mon.hp < max) {
      const amount = Math.min(max - c.mon.hp, Math.max(1, Math.floor(max / (dryHeal ? 8 : 16))));
      announce(c, ability!, events);
      c.mon.hp += amount;
      events.push({ type: 'heal', side: c.side, amount, hpAfter: c.mon.hp });
    }
    if ((ability === 'dry-skin' || ability === 'solar-power') && weather.id === 'sun') {
      announce(c, ability, events);
      abilityHurt(ctx, c, Math.max(1, Math.floor(max / 8)), events);
    }
  }
  if (immune) {
    for (const c of sides) {
      if (c.mon.hp <= 0 || c.vol.semi === 'underground' || c.vol.semi === 'underwater') continue;
      if (getSpecies(ctx.content, c.mon.speciesId).types.some((t) => immune.includes(t))) continue;
      const ability = abilityIn(ctx, c);
      if (ability && WEATHER_DAMAGE_IMMUNE[ability]?.includes(weather.id)) continue;
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

/**
 * End-of-turn damage for one side: burn or poison, then binding, then Leech
 * Seed (which heals the other side). Magic Guard takes none of it; Poison
 * Heal heals from poison instead; Heatproof halves burn damage.
 */
function applyResidual(ctx: BattleContext, c: Combatant, other: Combatant, events: BattleEvent[]): void {
  const { content } = ctx;
  const max = calcStats(content, c.mon).hp;
  const ability = abilityIn(ctx, c);
  if (ability === 'poison-heal' && c.mon.status?.id === 'psn' && c.mon.hp > 0 && c.mon.hp < max) {
    const amount = Math.min(max - c.mon.hp, Math.max(1, Math.floor(max / 8)));
    announce(c, ability, events);
    c.mon.hp += amount;
    events.push({ type: 'heal', side: c.side, amount, hpAfter: c.mon.hp });
  }
  if (ability === 'magic-guard') {
    if (c.vol.bound > 0 && --c.vol.bound === 0) events.push({ type: 'bindEnd', side: c.side });
    return;
  }
  const hurt = (fraction: number) => {
    const { lost, lastStand } = takeHp(ctx, c, Math.max(1, Math.floor(max * fraction)));
    return { lost, lastStand };
  };
  const status = ability === 'poison-heal' && c.mon.status?.id === 'psn' ? undefined : c.mon.status?.id;
  const burn = content.ruleset.burnResidualFraction / (ability === 'heatproof' ? 2 : 1);
  const fraction = status === 'brn' ? burn : status === 'psn' ? content.ruleset.poisonResidualFraction : 0;
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
    if (ability === 'liquid-ooze') {
      // Draining Liquid Ooze hurts the seeder instead.
      announce(c, ability, events);
      abilityHurt(ctx, other, lost, events);
      return;
    }
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
    if (c.side === 'enemy' && player.mon.uid === ctx.party[ctx.battle.activeIndex]?.uid) friendlyFinish(ctx, player.mon, events);
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
    battle.pendingEntry = [...(battle.pendingEntry ?? []).filter((side) => side !== 'enemy'), 'enemy'];
  }
  const active = ctx.party[battle.activeIndex]!;
  if (active.hp <= 0) {
    if (ctx.party.some((p) => p.hp > 0)) battle.needsSwitch = true;
    else battle.outcome = 'lose';
  }
  // The trainer's next Pokémon's entry ability (after the player's replacement, if one is needed).
  resolveEntries(ctx, events);
}

/**
 * Battle start: the entry abilities of both first Pokémon (Intimidate,
 * Drizzle). The battle screen calls this once after "Go! Pikachu!"; if it
 * doesn't, the first turn does it. Uses no random numbers.
 */
export function startBattle(ctx: BattleContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  resolveEntries(ctx, events);
  return events;
}
