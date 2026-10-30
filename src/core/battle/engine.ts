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

import { shadowDamageMultiplier } from '../shadow';
import { championsAuraStages, firstStrikeBonus } from '../trainerEvolution';
import { freshDrama } from '../drama/schema';
import type { Perks, TypeModifiers } from '../archetypes';
import type { AttributeEffects } from '../attributes';
import { TYPE_NAMES } from '../contentSchema';
import type { BoostStat, Content, ItemEffect, Move, PowerRule, Semi, SideMove, Species, StatusId, Terrain, TransformKind, TypeName, Weather } from '../contentSchema';
import { catchProbability, resolveCatchRoll } from '../capture';
import { applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem, lastStandItemId } from '../items';
import { abilityOf, calcStats, createPokemon, getSpecies, maxHp } from '../pokemon';
import { enemyHyperChancePerk, weatherHealPercent, burnDamagePerk, ppCostExtra, statusChancePerk, statusTurnsPerk, statusLengthPerk, damageDealtPerk, damageTakenPerk, critDamagePerk, critChancePerk, bonusFriendship, enemyHealingBlocked, isSpreadMove, turnHealPercent, healingMoveMultiplier, burnDamageTakenPerk, statusMoveAccuracyPerk, isBossClass, isLegendaryLike, critChanceBonusPerk, hypeMeterOf, isUltraBeast, moveStyleOf, poisonDamagePerk, evasionPerk, moveFlagsOf, unusualKind } from '../trainerPerks';
import type { Rng } from '../rng';
import { cooldownKey, hasBattleEffect, markBattleEffect } from '../story/ledger';
import type { StoryTriggerKind } from '../story/schema';
import { currentEnemy, freshExtra, freshHeldState, freshSideEffects, freshStages, freshTransform, freshVolatile, type BattleState, type PokemonInstance, type Stages, type Volatile } from '../state';
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
  AURAS,
  ENTRY_BOOST,
  UNTRACEABLE,
  SPREADS_ON_CONTACT,
  PRIORITY_GUARD,
  TYPE_BOOST,
  CONTACT_HURT,
  CONTACT_STATUS,
  DROP_GUARD,
  FLAG_BOOST,
  HIT_BOOST,
  HALF_HP_BOOST,
  RUINS,
  TRAPPERS,
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
import { genderOf, oppositeGender, sameGender } from '../gender';
import * as Held from './held';
import { absorbHit, advanceRaid, chargedDamage, takeExtraAction } from '../raid/raid';
import type { RaidPhase } from '../raid/schema';
import { allyDue, allyLevel, getTotem } from '../totem/totem';
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
  | { type: 'cant'; side: Side; reason: 'slp' | 'frz' | 'par' | 'flinch' | 'recharge' | 'truant' | 'infatuation' }
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
  /** A raid message: shield up/broken, a new phase, a charged attack, the timer. */
  | { type: 'raid'; tone: 'shield' | 'phase' | 'warn' | 'info'; text: string }
  /** A Substitute took a hit (and `broke`). */
  | { type: 'substituteHit'; side: Side; broke: boolean }
  /** Perish Song countdown. */
  | { type: 'perish'; side: Side; count: number }
  | { type: 'fieldStart'; field: string }
  | { type: 'fieldEnd'; field: string }
  /** The user (or `side`) is now in a state: Focus Energy, Wish, trapped... */
  | { type: 'selfState'; side: Side; state: string }
  /** Disable, Encore, Torment, Taunt, Heal Block or Spite took hold. */
  | { type: 'disrupted'; side: Side; kind: 'disable' | 'encore' | 'torment' | 'taunt' | 'healBlock' | 'spite' | 'throatChop'; moveId: string | null }
  /** Every stat change was reset (Haze, Clear Smog). */
  | { type: 'statsReset'; side: Side }
  /** The move was stopped before it began (Disable, Torment, Taunt). */
  | { type: 'blocked'; side: Side; moveId: string }
  /** Something was set up on (`on`) or wore off a side of the field. */
  | { type: 'sideEffect'; side: Side; effect: SideMove | 'hazards'; on: boolean }
  /** An entry hazard hurt or affected a Pokémon coming in. */
  | { type: 'hazard'; side: Side; hazard: 'spikes' | 'stealthRock' | 'toxicSpikes' | 'stickyWeb'; amount: number; hpAfter: number }
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
  /** A trainer's Pokémon evolved between turns (core/drama/evolution.ts). */
  /** Bond Engine (core/bond): a Pokémon acted on its own before the turn. */
  | { type: 'refused'; side: Side; uid: string; moveId: string }
  | { type: 'initiative'; side: Side; uid: string; from: string; to: string }
  | { type: 'combo'; side: Side; from: string; to: string; stat: 'atk' | 'spa' }
  | { type: 'newMove'; side: Side; uid: string; moveId: string; replaced: string | null }
  | { type: 'turningPoint'; side: Side; uid: string; emotion: string }
  | { type: 'evolved'; side: Side; uid: string; from: string; to: string; hpAfter: number }
  | { type: 'switchIn'; side: Side; uid: string; speciesId: string; level: number }
  /** Double battles: the events that follow are about this Pokémon on `side` (battle/doubles.ts). */
  | { type: 'focus'; side: Side; uid: string }
  /** Ally Switch: the two Pokémon on `side` traded spots. */
  | { type: 'allySwitch'; side: Side }
  | { type: 'item'; itemId: string; targetUid: string; message: string; hpAfter: number }
  | { type: 'ball'; itemId: string; shakes: number; caught: boolean }
  | Held.HeldEvent
  /** Mega Evolution / Primal Reversion (battle/transform.ts). */
  | TransformEvent;

export type PlayerAction =
  /** `transform`: Mega Evolve (etc.) before moving this turn. */
  | { kind: 'move'; index: number; transform?: TransformRequest }
  | { kind: 'switch'; partyIndex: number }
  | { kind: 'item'; itemId: string; targetIndex?: number }
  /** The Pokémon refused its command and does nothing this turn (only the Bond Engine sends this). */
  | { kind: 'idle' }
  /** A double battle: one command per spot (null for an empty or fainted spot). See battle/doubles.ts. */
  | { kind: 'double'; commands: (SlotCommand | null)[] };

/** One Pokémon's command in a double battle, and which Pokémon its move is aimed at. */
export type SlotAction = Exclude<PlayerAction, { kind: 'double' }>;
export interface SlotCommand {
  action: SlotAction;
  target?: { side: Side; spot: 0 | 1 };
}

export interface Combatant {
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
  /** Species this run has caught (Repeat Ball). */
  speciesCaught?: string[];
  /** Multiplier on HP restored by healing items used in battle (a trainer passive). */
  healMultiplier?: number;
  /** The trainer's type-based damage multipliers for the player's side. */
  typeModifiers?: TypeModifiers;
  /** The trainer's perks (Trainers.md): see core/trainerPerks.ts. */
  perks?: Perks;
  /** The Empty Bag Challenge Contract: only Poké Balls can be used. */
  noBattleItems?: boolean;
  /** The run's starter (starter perks). */
  starterUid?: string | null;
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
  /** Set during a double battle's turn (battle/doubles.ts). */
  doublesTurn?: DoublesTurn;
}

/** What a double battle's turn needs from the shared engine code. */
export interface DoublesTurn {
  /** The move being used hits more than one Pokémon (0.75× damage). */
  spread: boolean;
  /** Pokémon an ally's Helping Hand powers up this turn (once per Helping Hand). */
  helped: string[];
  /** Runs a move on every Pokémon it hits (called by executeMove in place of runMove). */
  hit?: (user: Combatant, target: Combatant, move: Move, movedFirst: boolean, events: BattleEvent[]) => void;
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
    hype: 0,
    hypeTurns: 0,
    hypeLoaded: false,
    activeIndex,
    enemyTeam,
    enemyIndex: 0,
    trainer,
    drama: freshDrama(),
    playerStages: freshStages(),
    enemyStages: freshStages(),
    playerVolatile: freshVolatile(),
    enemyVolatile: freshVolatile(),
    weather: null,
    terrain: null,
    batonStages: null,
    field: { gravity: 0, trickRoom: 0, waterSport: 0, mudSport: 0 },
    extra: freshExtra(),
    sideEffects: { player: freshSideEffects(), enemy: freshSideEffects() },
    pendingEntry: ['player', 'enemy'],
    participants: [activeUid],
    needsSwitch: false,
    lastStandUsed: false,
    enemyItemsUsed: 0,
    enemySwitches: 0,
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
export function moveValue(brain: EnemyBrain, user: PokemonInstance, moveId: string): number {
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
    if (targetAbilityId && (ABSORB[targetAbilityId]?.type === m.type || ((targetAbilityId === 'levitate' || targetAbilityId === 'eelevate') && m.type === 'ground') || (targetAbilityId === 'wonder-guard' && effectiveness <= 1))) return 0;
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
  if (!ctx.battle.needsSwitch && ctx.battle.extra?.fairyLock === ctx.battle.turn) return "Fairy Lock keeps your Pokémon from switching out!";
  if (!ctx.battle.needsSwitch && !shedShell && ctx.battle.playerVolatile?.trapped) return "Your Pokémon can't be switched out!";
  if (!ctx.battle.needsSwitch && !shedShell && active && 'content' in ctx && ctx.content) {
    const foeMon = currentEnemy(ctx.battle);
    const trapper = foeMon.hp > 0 ? (ctx.battle.enemyVolatile.abilityOverride ?? abilityOf(ctx.content, foeMon)) : null;
    const types = getSpecies(ctx.content, active.speciesId).types;
    const grounded = !types.includes('flying') && abilityOf(ctx.content, active) !== 'levitate';
    const caught = trapper === 'shadow-tag' ? abilityOf(ctx.content, active) !== 'shadow-tag' : trapper === 'arena-trap' ? grounded : trapper === 'magnet-pull' ? types.includes('steel') : false;
    if (trapper && TRAPPERS.has(trapper) && caught && !types.includes('ghost')) return `The foe's ${trapper.replace(/-/g, ' ')} keeps you from switching out!`;
  }
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
  if (action.kind === 'double' || battle.doubles) throw new Error('A double battle takes its turn in battle/doubles.ts');
  const events: BattleEvent[] = [];

  if (battle.needsSwitch) {
    if (action.kind !== 'switch') throw new Error('Choose a Pokémon to send out');
    const problem = switchProblem(ctx, action.partyIndex);
    if (problem) throw new Error(problem);
    switchIn(ctx, action.partyIndex, events);
    if (battle.batonStages) {
      battle.playerStages = battle.batonStages;
      battle.batonStages = null;
    }
    battle.needsSwitch = false;
    resolveEntries(ctx, events);
    return events;
  }

  battle.playerVolatile ??= freshVolatile();
  battle.enemyVolatile ??= freshVolatile();
  battle.weather ??= null;
  battle.terrain ??= null;
  battle.pendingEntry ??= [];
  battle.sideEffects ??= { player: freshSideEffects(), enemy: freshSideEffects() };
  battle.field ??= { gravity: 0, trickRoom: 0, waterSport: 0, mudSport: 0 };
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
  if (battle.totem) {
    totemAura(ctx, events);
    totemCallAlly(ctx, events);
  }
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

  // A smart trainer may heal or swap Pokémon on purpose instead of attacking.
  let enemyActed = false;
  if (!battle.outcome && battle.kind === 'trainer' && battle.ai > 0 && enemyForcedIndex < 0 && enemyChoiceIndex < 0) {
    enemyActed = trainerAiTurn(ctx, enemy, events);
    if (enemyActed) {
      enemy.mon = currentEnemy(battle);
      enemy.stages = battle.enemyStages;
      enemy.vol = battle.enemyVolatile;
      resolveEntries(ctx, events);
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
  for (const v of [playerC.vol, enemy.vol]) {
    v.tookPhysical = 0;
    v.tookSpecial = 0;
    v.endure = false;
    v.plannedAttack = false;
    v.loweredThisTurn = false;
    v.plannedMove = null;
  }
  enemy.vol.plannedAttack = enemyMove.category !== 'status';
  enemy.vol.plannedMove = enemyMove.id;
  enemy.vol.beakHeat = Boolean(enemyMove.effects.beakBlast);
  // Two rivals on the field recognise each other (Heated Rivalry).
  if (!battle.outcome) meetRival(ctx, playerC, enemy, events);

  // 2. Moves.
  if (action.kind === 'move') {
    const chosen = resolveMove(content, playerC.mon, action.index);
    // A Z-Move replaces the chosen move (its Z-Power was spent above).
    const playerMove = battleMove(content, battle, playerC.mon, action.transform?.kind === 'zmove' ? (zMoveFor(content, chosen) ?? chosen) : chosen);
    playerC.vol.plannedAttack = playerMove.category !== 'status';
    playerC.vol.plannedMove = playerMove.id;
    playerC.vol.beakHeat = Boolean(playerMove.effects.beakBlast);
    const order = decideOrder(ctx, rng, playerC, playerMove, enemy, enemyMove);
    const actions =
      order === 'player'
        ? [{ user: playerC, target: enemy, move: playerMove, slot: action.index }, { user: enemy, target: playerC, move: enemyMove, slot: enemyMoveIndex }]
        : [{ user: enemy, target: playerC, move: enemyMove, slot: enemyMoveIndex }, { user: playerC, target: enemy, move: playerMove, slot: action.index }];
    actions.forEach((a, index) => {
      if (anyFainted(playerC, enemy) || a.user.mon.hp <= 0) return;
      if (a.user.side === 'enemy' && (enemyActed || loseFreeTurn(battle, events))) return;
      actWithRage(ctx, a.user, enemy, events, () => executeMove(ctx, a.user, a.target, a.move, a.slot, index === 0, events));
    });
  } else if (!enemyActed && !loseFreeTurn(battle, events)) {
    actWithRage(ctx, enemy, enemy, events, () => executeMove(ctx, enemy, playerC, enemyMove, enemyMoveIndex, false, events));
  }
  recordFaints(ctx, playerC, enemy, events);

  // 3. End of turn: weather (and Rain Dish), Shed Skin, then burn, poison, binding and Leech Seed, then Speed Boost.
  if (!anyFainted(playerC, enemy)) {
    applyWeather(ctx, [playerC, enemy], events);
    applyTurnHeal(ctx, playerC, events);
    applyTerrain(ctx, [playerC, enemy], events);
    tickSides(ctx, events);
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
  primalCheck(ctx, playerC, enemy, events);
  for (const c of [playerC, enemy]) syncForms(ctx, c, events, true);
  endTurnStates(ctx, playerC, enemy, events);
  const raidTimeout = battle.raid ? raidEndOfTurn(ctx, playerC, enemy, events) : false;
  if (battle.totem && !battle.outcome) totemPhases(ctx, enemy, events);

  // Held items at the end of the turn (Leftovers, Orbs, berries), then battle boosts count down.
  if (!anyFainted(playerC, enemy)) {
    Held.endOfTurn(ctx, playerC, events as Held.HeldEvent[]);
    Held.endOfTurn(ctx, enemy, events as Held.HeldEvent[]);
    pokeFlute(ctx, playerC, events);
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

  // U-turn, Baton Pass and friends: the user leaves once the turn is over.
  if (!battle.outcome) resolvePivots(ctx, playerC, enemy, events);

  // 4. Decide the outcome or replace fainted Pokémon.
  const enemyBefore = battle.enemyIndex;
  settleFaints(ctx, events);
  // A trainer's next Pokémon saw its ally fall.
  if (!battle.outcome && battle.enemyIndex !== enemyBefore) warnRage(ctx, currentEnemy(battle), events);
  battle.turn += 1;
  if (raidTimeout && !battle.outcome) battle.outcome = 'lose';
  applyHype(ctx, events);
  return events;
}

/** Encore!: after a turn, critical hits build Hype, a miss or failed move costs some, and full Hype starts the damage boost. */
export function applyHype(ctx: BattleContext, events: BattleEvent[]): void {
  const meter = hypeMeterOf(ctx.perks);
  if (!meter) return;
  const { battle } = ctx;
  if (battle.hypeTurns > 0) battle.hypeTurns -= 1;
  for (const e of events) {
    if (e.type === 'damage' && e.side === 'enemy' && e.crit) battle.hype += 1;
    else if ((e.type === 'miss' || e.type === 'fail') && e.side === 'player') battle.hype = Math.max(0, battle.hype - meter.missPenalty);
    if (battle.hype >= meter.needed) {
      battle.hype = 0;
      battle.hypeTurns = meter.turns;
    }
  }
}

/**
 * Raid end of turn: shield and telegraph messages, new phases (stat boosts, weather, cleansing),
 * a bonus attack under the HP line, and the timer. Returns true when the timer ran out.
 */
function raidEndOfTurn(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): boolean {
  const { battle, content } = ctx;
  let timeout = false;
  for (const a of advanceRaid(content, battle, enemy.mon)) {
    if (a.kind === 'note') events.push({ type: 'raid', tone: a.tone, text: a.text });
    else if (a.kind === 'timeout') {
      timeout = true;
      events.push({ type: 'raid', tone: 'warn', text: 'Time is up! The raid boss slips away...' });
    } else {
      applyBossPhase(ctx, enemy, a.phase, events);
    }
  }
  // A bonus attack (strictly limited by the raid's `max`).
  if (!timeout && !battle.outcome && player.mon.hp > 0 && enemy.mon.hp > 0 && takeExtraAction(content, battle, enemy.mon)) {
    const idx = chooseEnemyMove(enemy.mon, ctx.rng, { content, ai: Math.max(battle.ai, 0.7), target: player.mon, stages: battle.enemyStages });
    if (idx >= 0) {
      events.push({ type: 'raid', tone: 'warn', text: 'The boss attacks again!' });
      executeMove(ctx, enemy, player, resolveMove(content, enemy.mon, idx), idx, false, events);
      recordFaints(ctx, player, enemy, events);
    }
  }
  return timeout;
}

/** A raid or Totem phase starts: its message, stat boosts, weather, and the optional cleanses. */
function applyBossPhase(ctx: BattleContext, enemy: Combatant, p: RaidPhase, events: BattleEvent[]): void {
  const { battle } = ctx;
  events.push({ type: 'raid', tone: 'phase', text: p.text });
  for (const [stat, n] of Object.entries(p.boost ?? {})) applyStageChange(ctx, enemy, stat as BoostStat, n, events);
  if (p.weather) {
    battle.weather = { id: p.weather, turns: 5 };
    events.push({ type: 'weather', weather: p.weather });
  }
  if (p.clearPlayerStages) for (const k of Object.keys(battle.playerStages)) battle.playerStages[k as BoostStat] = 0;
  if (p.cleanse) {
    enemy.mon.status = null;
    for (const k of Object.keys(battle.enemyStages)) if (battle.enemyStages[k as BoostStat] < 0) battle.enemyStages[k as BoostStat] = 0;
  }
}

/** Totem aura (once, when the Totem first takes the field) and the home-field environment. */
function totemAura(ctx: BattleContext, events: BattleEvent[]): void {
  const { battle, content } = ctx;
  const t = battle.totem;
  if (!t || t.auraDone) return;
  const mon = currentEnemy(battle);
  if (mon.uid !== t.uid) return;
  t.auraDone = true;
  const def = getTotem(content, t.id);
  const enemy: Combatant = { side: 'enemy', mon, stages: battle.enemyStages, vol: battle.enemyVolatile, flinched: false, protected: false };
  events.push({ type: 'raid', tone: 'phase', text: def.aura.text });
  for (const [stat, n] of Object.entries(def.aura.boost ?? {})) applyStageChange(ctx, enemy, stat as BoostStat, n, events);
  const weather = def.aura.weather ?? def.environment?.weather;
  if (weather) {
    battle.weather = { id: weather, turns: 999 };
    events.push({ type: 'weather', weather });
  }
  const terrain = def.aura.terrain ?? def.environment?.terrain;
  if (terrain) {
    battle.terrain = { id: terrain, turns: 999 };
    events.push({ type: 'terrain', terrain });
  }
  const hazard = def.aura.hazard;
  if (hazard === 'stealthRock') battle.sideEffects.player.stealthRock = true;
  else if (hazard === 'stickyWeb') battle.sideEffects.player.stickyWeb = true;
  else if (hazard === 'spikes') battle.sideEffects.player.spikes = 1;
  else if (hazard === 'toxicSpikes') battle.sideEffects.player.toxicSpikes = 1;
  if (def.environment) events.push({ type: 'raid', tone: 'info', text: def.environment.text });
}

/** Start of a turn: a Totem below its HP line calls its ally, which takes the field in its place (capped, no loops). */
function totemCallAlly(ctx: BattleContext, events: BattleEvent[]): void {
  const { battle, content } = ctx;
  const t = battle.totem;
  if (!t) return;
  const totemMon = currentEnemy(battle);
  if (!allyDue(content, battle, totemMon)) return;
  const def = getTotem(content, t.id);
  const a = def.ally!;
  const ally = createPokemon(content, a.species, allyLevel(def, totemMon.level), `${t.uid}-ally${t.callsUsed + 1}`);
  t.callsUsed += 1;
  t.allyUid = ally.uid;
  events.push({ type: 'raid', tone: 'phase', text: a.text });
  if (a.support.heal) totemMon.hp = Math.min(maxHp(content, totemMon), totemMon.hp + Math.ceil(maxHp(content, totemMon) * a.support.heal));
  if (a.support.weather) {
    battle.weather = { id: a.support.weather, turns: 5 };
    events.push({ type: 'weather', weather: a.support.weather });
  }
  if (a.support.screens) {
    battle.sideEffects.enemy.reflect = 5;
    battle.sideEffects.enemy.lightScreen = 5;
  }
  battle.enemyTeam.push(ally);
  swapInEnemy(ctx, battle.enemyTeam.length - 1, events);
  resolveEntries(ctx, events);
}

/** End of a turn while the Totem itself is on the field: behaviour phases at their HP lines. */
function totemPhases(ctx: BattleContext, enemy: Combatant, events: BattleEvent[]): void {
  const { battle, content } = ctx;
  const t = battle.totem;
  if (!t || enemy.mon.uid !== t.uid || enemy.mon.hp <= 0) return;
  const share = enemy.mon.hp / maxHp(content, enemy.mon);
  getTotem(content, t.id).phases.forEach((phase, i) => {
    if (t.phasesDone.includes(i) || share > phase.atHp) return;
    t.phasesDone.push(i);
    applyBossPhase(ctx, enemy, phase, events);
  });
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
  } else if (action.kind === 'item') {
    const problem = itemProblem(ctx, action.itemId, action.targetIndex);
    if (problem) throw new Error(problem);
  }
}

/** Why this item can't be used right now, or null if it can. */
export function itemProblem(ctx: Pick<BattleContext, 'content' | 'battle' | 'party' | 'inventory' | 'noBattleItems'>, itemId: string, targetIndex?: number): string | null {
  const item = ctx.content.items.get(itemId);
  if (!item) return `Unknown item "${itemId}".`;
  if (ctx.noBattleItems && item.category !== 'ball') return 'Your Empty Bag contract allows only Poké Balls in battle.';
  if (itemCount(ctx.inventory, itemId) <= 0) return `You have no ${item.name} left.`;
  if (!item.usableInBattle) return `${item.name} can't be used in battle.`;
  if (item.effect.kind === 'catch') {
    if (ctx.battle.kind !== 'wild') return "You can't catch another trainer's Pokémon!";
    if (ctx.battle.totem) return "A Totem can't be caught mid-fight. Beat it and something rare may follow!";
    if (ctx.battle.raid) return "A raid boss can't be caught mid-fight. Beat it and it may join you!";
    // Wild double battle: the ball has no clear target until only one wild Pokémon is left.
    const partner = ctx.battle.doubles ? ctx.battle.enemyTeam[ctx.battle.doubles.enemy.index] : undefined;
    if (partner && partner.hp > 0 && currentEnemy(ctx.battle).hp > 0) return "You can't aim a Poké Ball while two wild Pokémon are out!";
    return null;
  }
  if (item.effect.kind === 'itemDrop') {
    const foe = currentEnemy(ctx.battle);
    return Object.keys(Held.effectiveHeld(ctx, foe)).length > 0 ? null : `${getSpecies(ctx.content, foe.speciesId).name} isn't holding anything.`;
  }
  const target = targetIndex === undefined ? undefined : ctx.party[targetIndex];
  if (!target) return 'Choose a Pokémon to use it on.';
  if (item.effect.kind === 'urge') return urgeProblem(ctx, item.effect.what, target, targetIndex!);
  return itemUseProblem(ctx.content, item, target);
}

const isBerryItem = (content: Content, id: string) => content.catalog.get(id)?.family.startsWith('Berries') === true;

/** Ability, Item and Reset Urge: only the Pokémon in battle, and only when there is something to trigger. */
function urgeProblem(ctx: Pick<BattleContext, 'content' | 'battle' | 'party'>, what: 'ability' | 'item' | 'reset', mon: PokemonInstance, index: number): string | null {
  const name = getSpecies(ctx.content, mon.speciesId).name;
  if (mon.hp <= 0) return `${name} has fainted.`;
  if (index !== ctx.battle.activeIndex) return `${name} isn't in battle.`;
  if (what === 'reset') return Object.values(ctx.battle.playerStages).some((v) => v !== 0) ? null : `${name} has no stat changes.`;
  if (what === 'ability') return mon.abilitySlot === -1 && !ctx.battle.playerVolatile.abilityOverride ? `${name} has no ability to trigger.` : null;
  const held = Held.effectiveHeld(ctx, mon);
  return Object.keys(held).some((id) => isBerryItem(ctx.content, id) || ctx.content.catalog.get(id)?.family.includes('Herb')) ? null : `${name} isn't holding a Berry or Herb.`;
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
      ballMultiplier: ballBonus(ctx, item.effect, enemy, species),
      statusMultiplier: enemy.status ? content.ruleset.catchStatusMultipliers[enemy.status.id] ?? 1 : 1,
      finalMultiplier: ctx.catchMultiplier,
    });
    const roll = resolveCatchRoll(probability, ctx.captureRng.float());
    events.push({ type: 'ball', itemId, shakes: roll.shakes, caught: roll.caught });
    if (roll.caught) {
      battle.outcome = 'caught';
      battle.ball = itemId;
    }
    return;
  }
  if (item.effect.kind === 'itemDrop') {
    const foe = currentEnemy(battle);
    const id = Object.keys(Held.effectiveHeld(ctx, foe))[0]!;
    Held.takeItem(ctx, foe, id);
    events.push({ type: 'item', itemId, targetUid: foe.uid, message: `${getSpecies(content, foe.speciesId).name} dropped its ${content.catalog.get(id)?.name ?? id}!`, hpAfter: foe.hp });
    return;
  }
  const target = ctx.party[targetIndex!]!;
  if (item.effect.kind === 'urge') {
    const { player, enemy } = activeCombatants(ctx);
    const name = getSpecies(content, target.speciesId).name;
    let message = '';
    if (item.effect.what === 'reset') {
      for (const k of Object.keys(player.stages) as (keyof Stages)[]) player.stages[k] = 0;
      message = `${name}'s stat changes were reset!`;
    } else if (item.effect.what === 'ability') {
      entryAbility(ctx, player, enemy, events);
      message = `${name}'s ability was triggered!`;
    } else {
      const held = Held.effectiveHeld(ctx, target);
      const herb = Object.keys(held).find((id) => content.catalog.get(id)?.family.includes('Herb') && !isBerryItem(content, id));
      if (!Held.forceEatBerry(ctx, player, events as Held.HeldEvent[]) && herb) {
        Held.whiteHerb(ctx, player, events as Held.HeldEvent[]);
        Held.usePowerHerb(ctx, player, events as Held.HeldEvent[]);
      }
      message = `${name} used its held item!`;
    }
    events.push({ type: 'item', itemId, targetUid: target.uid, message, hpAfter: target.hp });
    return;
  }
  const message = applyItemToPokemon(content, item, target, { healMultiplier: ctx.healMultiplier ?? 1 });
  events.push({ type: 'item', itemId, targetUid: target.uid, message, hpAfter: target.hp });
}

/** The ball's catch multiplier once its condition (Level, Lure, Quick Ball ...) is counted. */
export function ballBonus(ctx: BattleContext, effect: Extract<ItemEffect, { kind: 'catch' }>, enemy: PokemonInstance, species: Species): number {
  const base = effect.multiplier;
  const mine = ctx.party[ctx.battle.activeIndex];
  const water = species.types.includes('water');
  switch (effect.rule) {
    case 'level': {
      const ratio = mine ? mine.level / Math.max(1, enemy.level) : 1;
      return ratio >= 4 ? 8 : ratio >= 2 ? 4 : ratio > 1 ? 2 : 1;
    }
    case 'lure': return water ? base : 1;
    case 'dive': return water ? base : 1;
    case 'net': return water || species.types.includes('bug') ? base : 1;
    case 'moon': return species.evolutions.some((e) => e.item === 'moon-stone') ? base : 1;
    case 'love': return mine && mine.speciesId === enemy.speciesId && oppositeGender(ctx.content, mine, enemy) ? base : 1;
    case 'heavy': {
      const kg = species.weight ?? 50;
      return kg < 100 ? 0.5 : kg < 200 ? 1 : kg < 300 ? 2 : 4;
    }
    case 'fast': return species.baseStats.spe >= 100 ? base : 1;
    case 'nest': return Math.max(1, (41 - enemy.level) / 10);
    case 'repeat': return ctx.speciesCaught?.includes(enemy.speciesId) ? base : 1;
    case 'timer': return Math.min(base, 1 + (ctx.battle.turn - 1) * (1229 / 4096));
    case 'quick': return ctx.battle.turn === 1 ? base : 1;
    case 'dusk': return species.types.includes('dark') || species.types.includes('ghost') ? base : 1;
    case 'dream': return enemy.status?.id === 'slp' ? base : 1;
    case 'beast': return species.tags.includes('legendary') || species.tags.includes('mythical') ? base : 0.1;
    case 'safari': return enemy.hp >= maxHp(ctx.content, enemy) ? base : 1;
    case 'sport': return species.types.includes('bug') || species.types.includes('fighting') ? base : 1;
    case 'flyer': return species.types.includes('flying') ? base : 1;
    case 'weight100': return (species.weight ?? 50) >= 100 ? base : 1;
    case 'weight300': return (species.weight ?? 50) >= 300 ? base : 1;
    default: return base;
  }
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

/** Forms an ability keeps when the Pokémon is withdrawn. */
const PERSISTENT_FORMS = new Set(['palafin-hero', 'greninja-ash', 'zygarde-complete', 'mimikyu-busted', 'eiscue-noice', 'terapagos-terastal']);

/** Natural Cure and Regenerator, when a Pokémon still standing is called back (silently, as in the main games). */
function switchOutAbility(ctx: BattleContext, mon: PokemonInstance): void {
  if (mon.hp <= 0) return;
  const ability = abilityOf(ctx.content, mon);
  restoreMoves(ctx, mon);
  const rec = ctx.battle.transform.forms[mon.uid];
  if (rec?.kind === 'ability' && !PERSISTENT_FORMS.has(mon.speciesId)) {
    const oldMax = calcStats(ctx.content, mon).hp;
    mon.speciesId = rec.from;
    const max = calcStats(ctx.content, mon).hp;
    mon.hp = Math.max(1, Math.min(max, Math.round((mon.hp * max) / oldMax)));
    delete ctx.battle.transform.forms[mon.uid];
  }
  if (ability === 'zero-to-hero' && mon.speciesId === 'palafin' && ctx.content.species.has('palafin-hero') && !rec) {
    const oldMax = calcStats(ctx.content, mon).hp;
    ctx.battle.transform.forms[mon.uid] = { kind: 'ability', from: 'palafin' };
    mon.speciesId = 'palafin-hero';
    const max = calcStats(ctx.content, mon).hp;
    mon.hp = Math.max(1, Math.min(max, Math.round((mon.hp * max) / oldMax)));
  }
  if (ability === 'natural-cure') mon.status = null;
  if (ability === 'regenerator') {
    const max = calcStats(ctx.content, mon).hp;
    mon.hp = Math.min(max, mon.hp + Math.floor(max / 3));
  }
}

// ---------- abilities ----------

/** The weather that counts: Cloud Nine and Air Lock on either side switch its effects off (it still runs out). */
function weatherNow(ctx: BattleContext): Weather | null {
  const w = ctx.battle.weather?.id ?? null;
  if (!w) return null;
  const mons = [ctx.party[ctx.battle.activeIndex], currentEnemy(ctx.battle), ...benchedActives(ctx).map((b) => b.mon)];
  for (const m of mons) {
    const a = m ? abilityOf(ctx.content, m) : null;
    if (a === 'cloud-nine' || a === 'air-lock') return null;
  }
  return w;
}

function abilityIn(ctx: BattleContext, c: Combatant): string | null {
  const own = c.vol.abilityOverride ?? abilityOf(ctx.content, c.mon);
  if (own === 'neutralizing-gas') return own;
  // Neutralizing Gas on either side switches every other ability off.
  const { battle, party, content } = ctx;
  const mine = party[battle.activeIndex];
  const gas = (mon: PokemonInstance | undefined, v: { abilityOverride: string | null }) => mon && mon.hp > 0 && (v.abilityOverride ?? abilityOf(content, mon)) === 'neutralizing-gas';
  if (gas(mine, battle.playerVolatile) || gas(currentEnemy(battle), battle.enemyVolatile)) return null;
  if (battle.doubles && benchedActives(ctx).some((b) => gas(b.mon, b.vol))) return null;
  return own;
}

/** The target's ability as the attacker's move sees it: Mold Breaker ignores it. */
let moveIgnoresAbility = false;
function targetAbility(ctx: BattleContext, user: Combatant, target: Combatant): string | null {
  if (user === target) return abilityIn(ctx, target);
  if (moveIgnoresAbility) return null;
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

/** In a double battle, the Pokémon beside `c` (null in singles, or when the spot is empty or fainted). */
function allyCombatant(ctx: BattleContext, c: Combatant): Combatant | null {
  const d = ctx.battle.doubles;
  if (!d) return null;
  const { battle } = ctx;
  const team = c.side === 'player' ? ctx.party : battle.enemyTeam;
  const primary = c.side === 'player' ? { mon: ctx.party[battle.activeIndex], stages: battle.playerStages, vol: battle.playerVolatile } : { mon: battle.enemyTeam[battle.enemyIndex], stages: battle.enemyStages, vol: battle.enemyVolatile };
  const slot = d[c.side];
  const other = slot.index >= 0 ? { mon: team[slot.index], stages: slot.stages, vol: slot.vol } : null;
  const pick = primary.mon?.uid === c.mon.uid ? other : other?.mon?.uid === c.mon.uid ? primary : null;
  if (!pick?.mon || pick.mon.hp <= 0) return null;
  return { side: c.side, mon: pick.mon, stages: pick.stages, vol: pick.vol, flinched: false, protected: false };
}

/** The ally's ability (or null): what Friend Guard, Battery, the Veils and the like need. */
function allyAbility(ctx: BattleContext, c: Combatant): string | null {
  const ally = allyCombatant(ctx, c);
  return ally ? abilityIn(ctx, ally) : null;
}

/** The Pokémon waiting in a double battle's second spots (both sides), for field-wide abilities. */
function benchedActives(ctx: BattleContext): { mon: PokemonInstance; vol: Volatile }[] {
  const d = ctx.battle.doubles;
  if (!d) return [];
  const out: { mon: PokemonInstance; vol: Volatile }[] = [];
  const p = d.player.index >= 0 ? ctx.party[d.player.index] : undefined;
  const e = d.enemy.index >= 0 ? ctx.battle.enemyTeam[d.enemy.index] : undefined;
  if (p && p.hp > 0) out.push({ mon: p, vol: d.player.vol });
  if (e && e.hp > 0) out.push({ mon: e, vol: d.enemy.vol });
  return out;
}

/**
 * Double-battle damage changes: spread moves (0.75×), Helping Hand (1.5×), the user's ally's
 * Battery / Power Spot / Steely Spirit / Plus-Minus / Flower Gift and the target's ally's
 * Friend Guard / Flower Gift. 1 in singles.
 */
function doublesDamageMultiplier(ctx: BattleContext, user: Combatant, target: Combatant, physical: boolean, moveType: TypeName): number {
  const turn = ctx.doublesTurn;
  if (!ctx.battle.doubles || !turn) return 1;
  let m = turn.spread ? 0.75 : 1;
  for (const uid of turn.helped) if (uid === user.mon.uid) m *= 1.5;
  const sun = weatherNow(ctx) === 'sun';
  const mine = allyAbility(ctx, user);
  if (mine === 'battery' && !physical) m *= 1.3;
  if (mine === 'power-spot') m *= 1.3;
  if (mine === 'steely-spirit' && moveType === 'steel') m *= 1.5;
  if (mine === 'flower-gift' && sun && physical) m *= 1.5;
  const own = abilityIn(ctx, user);
  if (!physical && (own === 'plus' || own === 'minus') && (mine === 'plus' || mine === 'minus')) m *= 1.5;
  if (user.side !== target.side || user.mon.uid !== target.mon.uid) {
    const theirs = moveIgnoresAbility ? null : allyAbility(ctx, target);
    if (theirs === 'friend-guard') m *= 0.75;
    if (theirs === 'flower-gift' && sun && !physical) m /= 1.5;
  }
  return m;
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
  for (const { c } of sides) enterExtras(ctx, c, events);
  for (const { c } of sides) applyHazards(ctx, c, events);
  if (sides.some(({ c }) => c.mon.hp <= 0)) {
    // A hazard knocked it out as it came in.
    recordFaints(ctx, player, enemy, events);
    settleFaints(ctx, events);
  }
  for (const { c, other } of sides) if (c.mon.hp > 0) entryAbility(ctx, c, other, events);
}

/** Sets the weather unless a primal weather (Desolate Land, Primordial Sea) is holding it. */
function setWeather(ctx: BattleContext, id: Weather, turns: number, primal?: string): boolean {
  const cur = ctx.battle.weather;
  if ((cur?.primal || ctx.battle.extra.delta) && !primal) return false;
  if (primal) ctx.battle.extra.delta = false;
  ctx.battle.weather = primal ? { id, turns, primal } : { id, turns };
  return true;
}

/** Ends a primal weather once nobody on the field has the ability that holds it. */
/** Poké Flute: once per battle, wakes every sleeping Pokémon in the team at the end of a turn. */
function pokeFlute(ctx: BattleContext, player: Combatant, events: BattleEvent[]): void {
  const flute = Held.hooksOf(ctx, player.mon, 'player').find(({ hook }) => hook.hook === 'wakeAll');
  if (!flute) return;
  const sleepers = ctx.party.filter((m) => m.hp > 0 && m.status?.id === 'slp');
  if (sleepers.length === 0 || !Held.firstUse(ctx, 'team', flute.itemId)) return;
  for (const m of sleepers) m.status = null;
  events.push({ type: 'held', side: 'player', itemId: flute.itemId, what: 'cure' });
}

function primalCheck(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): void {
  if (ctx.battle.extra.delta && ![player, enemy].some((c) => c.mon.hp > 0 && abilityIn(ctx, c) === 'delta-stream')) ctx.battle.extra.delta = false;
  const w = ctx.battle.weather;
  if (!w?.primal) return;
  if ([player, enemy].some((c) => c.mon.hp > 0 && abilityIn(ctx, c) === w.primal)) return;
  ctx.battle.weather = null;
  events.push({ type: 'weatherEnd', weather: w.id });
}

/** Puts back the moves Mimic or Transform replaced. */
function restoreMoves(ctx: BattleContext, mon: PokemonInstance): void {
  const rec = ctx.battle.extra.mimic[mon.uid];
  if (!rec) return;
  if (rec.kind === 'mimic') {
    const orig = rec.moves[rec.slot];
    if (orig && mon.moves[rec.slot]) mon.moves[rec.slot] = { ...orig };
  } else mon.moves = rec.moves.map((m) => ({ ...m }));
  delete ctx.battle.extra.mimic[mon.uid];
}

/** Transform and Imposter: the user becomes a copy of the target (form, moves with 5 PP, ability and stat changes) until it leaves the battle. */
function transformInto(ctx: BattleContext, user: Combatant, target: Combatant, events: BattleEvent[]): boolean {
  if (target.mon.hp <= 0 || target.vol.substitute > 0 || ctx.battle.extra.mimic[user.mon.uid]?.kind === 'transform' || ctx.battle.extra.mimic[target.mon.uid]?.kind === 'transform') return false;
  const ability = abilityIn(ctx, target);
  const moves = target.mon.moves.map((m) => ({ id: m.id, pp: Math.min(5, m.pp > 0 ? 5 : 5) }));
  if (ctx.battle.extra.mimic[user.mon.uid]) restoreMoves(ctx, user.mon);
  ctx.battle.extra.mimic[user.mon.uid] = { kind: 'transform', slot: -1, moves: user.mon.moves.map((m) => ({ ...m })) };
  user.mon.moves = moves;
  swapForm(ctx, user, target.mon.speciesId, events);
  user.vol.abilityOverride = ability;
  for (const k of Object.keys(user.stages) as BoostStat[]) user.stages[k] = target.stages[k];
  events.push({ type: 'selfState', side: user.side, state: 'transformed' });
  return true;
}

/** Changes a Pokémon's form for an ability (Zen Mode, Disguise...). It keeps its ability and scales its HP; the battle's end reverts it. */
function swapForm(ctx: BattleContext, c: Combatant, to: string, events: BattleEvent[]): void {
  const { battle, content } = ctx;
  if (c.mon.speciesId === to || !content.species.has(to)) return;
  const rec = battle.transform.forms[c.mon.uid];
  if (rec && rec.kind !== 'ability') return;
  const ability = abilityIn(ctx, c);
  const from = c.mon.speciesId;
  const oldMax = calcStats(content, c.mon).hp;
  if (!rec) battle.transform.forms[c.mon.uid] = { kind: 'ability', from };
  else if (rec.from === to) delete battle.transform.forms[c.mon.uid];
  c.mon.speciesId = to;
  const newMax = calcStats(content, c.mon).hp;
  if (c.mon.hp > 0) c.mon.hp = Math.max(1, Math.min(newMax, Math.round((c.mon.hp * newMax) / oldMax)));
  c.vol.abilityOverride = ability;
  events.push({ type: 'transform', side: c.side, uid: c.mon.uid, kind: 'ability', from, to, itemId: null } as BattleEvent);
}

/** Forms that follow HP, weather or a toggle: [base, alternate] pairs per ability. */
const FORM_PAIRS: Record<string, [string, string][]> = {
  'zen-mode': [['darmanitan', 'darmanitan-zen'], ['darmanitan-galar', 'darmanitan-galar-zen']],
  schooling: [['wishiwashi', 'wishiwashi-school']],
  'power-construct': [['zygarde', 'zygarde-complete']],
  'hunger-switch': [['morpeko', 'morpeko-hangry']],
  'tera-shift': [['terapagos', 'terapagos-terastal']],
  'shields-down': [['minior', 'minior-core']],
};
const FORECAST_FORMS: Partial<Record<Weather, string>> = { sun: 'castform-sunny', rain: 'castform-rainy', snow: 'castform-snowy', hail: 'castform-snowy' };

/** Moves a Pokémon into or out of the form its ability asks for. `endOfTurn` lets Hunger Switch flip. */
function syncForms(ctx: BattleContext, c: Combatant, events: BattleEvent[], endOfTurn: boolean): void {
  if (c.mon.hp <= 0) return;
  for (const { hook } of Held.hooksOf(ctx, c.mon, c.side)) {
    if (hook.hook === 'formHeld' && (c.mon.speciesId === hook.from || c.mon.speciesId === hook.to)) {
      swapForm(ctx, c, hook.to, events);
      return;
    }
  }
  const ability = abilityIn(ctx, c);
  if (!ability) return;
  const max = calcStats(ctx.content, c.mon).hp;
  if (ability === 'forecast') {
    const base = ctx.battle.transform.forms[c.mon.uid]?.from ?? c.mon.speciesId;
    if (!base.startsWith('castform')) return;
    swapForm(ctx, c, (weatherNow(ctx) && FORECAST_FORMS[weatherNow(ctx)!]) || 'castform', events);
    return;
  }
  if (ability === 'ice-face' && weatherNow(ctx) === 'snow' && c.mon.speciesId === 'eiscue-noice') {
    ctx.battle.extra.brokenFace = ctx.battle.extra.brokenFace.filter((u) => u !== c.mon.uid);
    swapForm(ctx, c, 'eiscue', events);
    return;
  }
  const pairs = FORM_PAIRS[ability];
  if (!pairs) return;
  if (ability === 'hunger-switch' && endOfTurn) c.vol.hangry = !c.vol.hangry;
  for (const [base, alt] of pairs) {
    if (c.mon.speciesId !== base && c.mon.speciesId !== alt) continue;
    let useAlt: boolean;
    if (ability === 'zen-mode' || ability === 'shields-down') useAlt = c.mon.hp * 2 <= max;
    else if (ability === 'schooling') useAlt = c.mon.level >= 20 && c.mon.hp * 4 > max;
    else if (ability === 'power-construct') useAlt = c.mon.speciesId === alt || c.mon.hp * 2 <= max;
    else if (ability === 'hunger-switch') useAlt = c.vol.hangry;
    else useAlt = true;
    swapForm(ctx, c, useAlt ? alt : base, events);
    return;
  }
}

function entryAbility(ctx: BattleContext, c: Combatant, other: Combatant, events: BattleEvent[]): void {
  const ability = abilityIn(ctx, c);
  if (!ability) return;
  syncForms(ctx, c, events, false);
  if (ability === 'delta-stream') {
    announce(c, ability, events);
    const old = ctx.battle.weather;
    if (old) {
      ctx.battle.weather = null;
      events.push({ type: 'weatherEnd', weather: old.id });
    }
    ctx.battle.extra.delta = true;
    return;
  }
  if (ability === 'teraform-zero') {
    announce(c, ability, events);
    const old = ctx.battle.weather;
    if (old && !old.primal) {
      ctx.battle.weather = null;
      events.push({ type: 'weatherEnd', weather: old.id });
    }
    if (ctx.battle.terrain) {
      events.push({ type: 'terrainEnd', terrain: ctx.battle.terrain.id });
      ctx.battle.terrain = null;
    }
    return;
  }
  if (ability === 'illusion') {
    const team = c.side === 'player' ? ctx.party : ctx.battle.enemyTeam;
    const alive = team.filter((m) => m.hp > 0 && m.uid !== c.mon.uid && m.speciesId !== c.mon.speciesId);
    const as = alive[alive.length - 1];
    if (as) {
      c.vol.illusion = as.speciesId;
      events.push({ type: 'transform', side: c.side, uid: c.mon.uid, kind: 'illusion', from: c.mon.speciesId, to: as.speciesId, itemId: null });
    }
    return;
  }
  if (ability === 'imposter') {
    announce(c, ability, events);
    transformInto(ctx, c, other, events);
    return;
  }
  const primal = ability === 'desolate-land' ? 'sun' : ability === 'primordial-sea' ? 'rain' : null;
  if (primal) {
    announce(c, ability, events);
    setWeather(ctx, primal, 999, ability);
    events.push({ type: 'weather', weather: primal });
    return;
  }
  const weather = WEATHER_SETTERS[ability];
  if (weather) {
    if (ctx.battle.weather?.id === weather) return;
    announce(c, ability, events);
    if (setWeather(ctx, weather, Held.weatherTurns(ctx, c, weather, 5))) events.push({ type: 'weather', weather });
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
  if (ability === 'trace') {
    const foe = other.mon.hp > 0 ? abilityIn(ctx, other) : null;
    if (foe && !UNTRACEABLE.has(foe)) {
      announce(c, ability, events);
      c.vol.abilityOverride = foe;
      announce(c, foe, events);
      entryAbility(ctx, c, other, events);
    }
    return;
  }
  const entryStat = ENTRY_BOOST[ability];
  if (entryStat) {
    announce(c, ability, events);
    applyStageChange(ctx, c, entryStat, 1, events);
    return;
  }
  if (ability === 'hadron-engine' || ability === 'orichalcum-pulse') {
    const sets = ability === 'hadron-engine' ? { terrain: 'electric' as const } : { weather: 'sun' as const };
    if (sets.terrain && ctx.battle.terrain?.id !== 'electric') {
      announce(c, ability, events);
      ctx.battle.terrain = { id: 'electric', turns: 5 };
      events.push({ type: 'terrain', terrain: 'electric' });
    } else if (sets.weather && ctx.battle.weather?.id !== 'sun') {
      announce(c, ability, events);
      setWeather(ctx, 'sun', Held.weatherTurns(ctx, c, 'sun', 5));
      events.push({ type: 'weather', weather: 'sun' });
    }
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
    if (guard === 'guard-dog') {
      announce(other, guard, events);
      applyStageChange(ctx, other, 'atk', 1, events);
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
  const cure = (ability === 'shed-skin' && ctx.rng.chance(0.3)) || (ability === 'hydration' && weatherNow(ctx) === 'rain');
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
  const primal = ctx.battle.weather?.primal;
  if (primal && move.category !== 'status' && ((primal === 'desolate-land' && moveType === 'water') || (primal === 'primordial-sea' && moveType === 'fire'))) {
    events.push({ type: 'noEffect', side: target.side });
    return true;
  }
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
  if (damaging && (ability === 'levitate' || ability === 'eelevate') && moveType === 'ground' && !move.effects.hitsSemi) blocked = true;
  if (damaging && ability === 'wonder-guard' && effectiveness <= 1 && !move.flags.includes('typeless')) blocked = true;
  if (ability === 'soundproof' && move.flags.includes('sound')) blocked = true;
  if (ability === 'good-as-gold' && !damaging) blocked = true;
  if (ability === 'bulletproof' && move.flags.includes('bullet')) blocked = true;
  if (ability === 'wind-rider' && move.flags.includes('wind') && user.side !== target.side) {
    announce(target, ability, events);
    events.push({ type: 'noEffect', side: target.side });
    applyStageChange(ctx, target, 'atk', 1, events);
    return true;
  }
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
/** A Pokémon's stats, with any Power Trick / Speed Swap / Split overrides applied. */
function statsOf(ctx: BattleContext, c: Combatant): ReturnType<typeof calcStats> {
  const base = calcStats(ctx.content, c.mon);
  const o = c.vol.statOverride;
  const stats = Object.keys(o).length ? { ...base, ...o } : base;
  const ability = abilityIn(ctx, c);
  const boosted = (ability === 'protosynthesis' && weatherNow(ctx) === 'sun') || (ability === 'quark-drive' && ctx.battle.terrain?.id === 'electric');
  if (!boosted) return stats;
  const best = (['atk', 'def', 'spa', 'spd', 'spe'] as const).reduce((a, b) => (stats[b] > stats[a] ? b : a));
  return { ...stats, [best]: Math.floor(stats[best] * (best === 'spe' ? 1.5 : 1.3)) };
}

function speedOf(ctx: BattleContext, c: Combatant): number {
  const { content } = ctx;
  const ability = abilityIn(ctx, c);
  const weather = weatherNow(ctx) ?? undefined;
  const quickFeet = ability === 'quick-feet' && c.mon.status !== null;
  let speed = effectiveSpeed(content.ruleset, Math.floor(statsOf(ctx, c).spe * Held.heldStatMultiplier(ctx, c.mon, c.side, 'spe')), c.stages.spe, c.mon.status?.id === 'par' && !quickFeet);
  if (ability && weather && WEATHER_SPEED[ability]?.includes(weather)) speed *= 2;
  if (quickFeet) speed = Math.floor(speed * 1.5);
  if (ctx.battle.sideEffects[c.side].tailwind > 0) speed *= 2;
  if (ability === 'surge-surfer' && ctx.battle.terrain?.id === 'electric') speed *= 2;
  if (ability === 'slow-start' && c.vol.turnsOut < 5) speed = Math.floor(speed / 2);
  return speed * (c.side === 'player' ? (ctx.attributes?.speed ?? 1) : 1);
}

/** Move priority with Prankster (status moves), Gale Wings (Flying moves at full HP) and Triage (healing moves). */
function priorityOf(ctx: BattleContext, c: Combatant, move: Move): number {
  const ability = abilityIn(ctx, c);
  if (ability === 'prankster' && move.category === 'status') return move.priority + 1;
  if (ability === 'gale-wings' && move.type === 'flying' && c.mon.hp >= calcStats(ctx.content, c.mon).hp) return move.priority + 1;
  if (ability === 'triage' && (move.effects.heal || move.effects.drain)) return move.priority + 3;
  if (ability === 'mycelium-might' && move.category === 'status') return move.priority - 0.5;
  if (ability === 'stall') return move.priority - 0.5;
  const tp = move.effects.terrainPriority;
  if (tp && ctx.battle.terrain?.id === tp.terrain) return move.priority + tp.bonus;
  return move.priority;
}

function decideOrder(ctx: BattleContext, rng: Rng, player: Combatant, pMove: Move, enemy: Combatant, eMove: Move): Side {
  // Trick Room: slower Pokémon move first within a priority.
  const trickSign = ctx.battle.field.trickRoom > 0 ? -1 : 1;
  const quickDraw = (c: Combatant, m: Move): number => (abilityIn(ctx, c) === 'quick-draw' && m.category !== 'status' && rng.chance(0.3) ? 0.2 : 0);
  // Custap Berry moves first and Lagging Tail last within the same priority.
  const result = compareTurnOrder(
    { priority: priorityOf(ctx, player, pMove) + quickDraw(player, pMove) + Held.orderBracket(ctx, player) / 10 + firstStrikeBonus(ctx.perks, ctx.battle), speed: speedOf(ctx, player) * trickSign },
    { priority: priorityOf(ctx, enemy, eMove) + quickDraw(enemy, eMove) + Held.orderBracket(ctx, enemy) / 10, speed: speedOf(ctx, enemy) * trickSign },
  );
  if (result === 'tie') return rng.chance(0.5) ? 'player' : 'enemy';
  return result === 'a' ? 'player' : 'enemy';
}

/** Checks recharging, sleep, freeze, flinching, confusion and paralysis. Returns false if the Pokémon can't act. */
function canAct(ctx: BattleContext, user: Combatant, events: BattleEvent[], move?: Move): boolean {
  const { content, rng } = ctx;
  const ability = abilityIn(ctx, user);
  if (user.vol.skyHeld) {
    const holder = user.side === 'player' ? activeCombatants(ctx).enemy : activeCombatants(ctx).player;
    if (holder.mon.hp > 0 && holder.vol.charging === 'sky-drop') {
      events.push({ type: 'cant', side: user.side, reason: 'flinch' });
      return false;
    }
    user.vol.skyHeld = false;
    if (user.vol.semi === 'air') user.vol.semi = null;
  }
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
      if (!move?.effects.asleepOnly) {
        events.push({ type: 'cant', side: user.side, reason: 'slp' });
        return false;
      }
      return true;
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
  if (user.vol.infatuated) {
    events.push({ type: 'selfState', side: user.side, state: 'inLove' });
    if (rng.chance(0.5)) {
      events.push({ type: 'cant', side: user.side, reason: 'infatuation' });
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
function applyTypeModifiers(ctx: BattleContext, user: Combatant, target: Combatant, effectiveness: number, damage: number, physical: boolean, moveType: TypeName, move: Move): number {
  const mods = ctx.typeModifiers;
  const attrs = ctx.attributes;
  const perks = ctx.perks;
  const rivalry = rivalryMultiplier(ctx, user, target) * doublesDamageMultiplier(ctx, user, target, physical, moveType) * shadowDamageMultiplier(user.mon, target.mon);
  if (!mods && !attrs && !perks && rivalry === 1) return damage;
  let multiplier = rivalry;
  const weather = weatherNow(ctx);
  const weatherName = weather === 'rain' || weather === 'sun' ? weather : null;
  if (user.side === 'player') {
    if (mods) for (const t of getSpecies(ctx.content, user.mon.speciesId).types) multiplier *= mods.damageDealt[t] ?? 1;
    if (attrs) multiplier *= (physical ? attrs.physicalDamage : attrs.specialDamage) * attrs.damageDealt;
    multiplier *= damageDealtPerk(perks, {
      userTypes: getSpecies(ctx.content, user.mon.speciesId).types,
      physical,
      hpShare: user.mon.hp / Math.max(1, calcStats(ctx.content, user.mon).hp),
      userLevel: user.mon.level,
      targetLevel: target.mon.level,
      targetIsBoss: isBossClass(ctx.battle.trainer?.classId),
      weather: weatherName,
      moveType,
      userBaseSpeed: getSpecies(ctx.content, user.mon.speciesId).baseStats.spe,
      userIsMega: getSpecies(ctx.content, user.mon.speciesId).form?.kind === 'mega',
      partyHasMega: ctx.party.some((p) => getSpecies(ctx.content, p.speciesId).form?.kind === 'mega'),
      firstInBattle: ctx.battle.participants[0] === user.mon.uid,
      firstAttack: ctx.battle.held?.playerAttacks === 1,
      isStarter: ctx.starterUid === user.mon.uid,
      targetTypes: getSpecies(ctx.content, target.mon.speciesId).types,
      userHoldsItem: Object.keys(Held.effectiveHeld(ctx, user.mon)).length > 0,
      hypeActive: ctx.battle.hypeTurns > 0,
      effectiveness,
      targetStatused: target.mon.status !== null && target.mon.status !== undefined,
      turnsOut: user.vol.turnsOut,
      moveIsZ: move.flags.includes('zmove'),
      moveIsSpread: isSpreadMove(move.id),
      partyIndex: ctx.party.findIndex((p) => p.uid === user.mon.uid),
      partySize: ctx.party.length,
      userLegendary: isLegendaryLike(getSpecies(ctx.content, user.mon.speciesId)),
      userUltraBeast: isUltraBeast(user.mon.speciesId),
      userRarity: perks?.some((m) => m.kind === 'unusualDamageMultiplier') ? unusualKind(ctx.content, user.mon) : null,
      moveFlags: moveFlagsOf(move),
      sameSpecies: user.mon.speciesId === target.mon.speciesId,
      moveStyle: moveStyleOf(move),
      enemiesDefeated: ctx.battle.kind === 'trainer' ? ctx.battle.enemyIndex : 0,
    });
  }
  if (target.side === 'player') {
    const targetTypes = getSpecies(ctx.content, target.mon.speciesId).types;
    if (mods && effectiveness > 1) for (const t of targetTypes) multiplier *= mods.weaknessTaken[t] ?? 1;
    if (attrs) multiplier *= attrs.damageTaken;
    multiplier *= damageTakenPerk(perks, {
      targetTypes,
      moveType,
      attackerIsLegendary: isLegendaryLike(getSpecies(ctx.content, user.mon.speciesId)),
      attackerIsBoss: isBossClass(ctx.battle.trainer?.classId),
      weather: weatherName,
      targetIsMega: getSpecies(ctx.content, target.mon.speciesId).form?.kind === 'mega',
      effectiveness,
      targetTurnsOut: target.vol.turnsOut,
    });
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
  // Raids: shields soak the boss's damage; a charged attack hits the player harder.
  if (ctx.battle.raid) {
    if (c.side === 'enemy') amount = absorbHit(ctx.content, ctx.battle, c.mon, amount);
    else if (hit !== null) amount = chargedDamage(ctx.content, ctx.battle, amount);
  }
  let lost = Math.min(Math.max(0, amount), c.mon.hp);
  let lastStand: string | null = null;
  if (c.vol.bide && lost > 0) c.vol.bide.damage += lost;
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
  // A trainer perk (Blue, Gen 3): rivals get riled up more often.
  const rolled = ctx.battle.rivalId ? { ...e, chance: Math.min(1, e.chance * enemyHyperChancePerk(ctx.perks)) } : e;
  if (hasBattleEffect(ctx.battle, key) || !rollHyper(ctx.hyper, rolled)) return;
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
  if (!canAct(ctx, user, events, move)) {
    // Being unable to move cancels a two-turn or lock-in move.
    user.vol.charging = null;
    user.vol.semi = null;
    user.vol.locked = null;
    return;
  }

  if (abilityIn(ctx, user) === 'truant') user.vol.truant = true;

  // Disable, Torment and Taunt can stop the move before it starts (it doesn't use up PP).
  if (!continuing && slot !== -1) {
    const v = user.vol;
    const stopped =
      (v.disabled && v.disabled.turns > 0 && v.disabled.moveId === move.id) ||
      (v.torment && v.lastMove === move.id) ||
      (v.taunt > 0 && move.category === 'status') ||
      (v.throat > 0 && move.flags.includes('sound')) ||
      (target.vol.imprison && target.mon.moves.some((m) => m.id === move.id));
    if (stopped) {
      events.push({ type: 'blocked', side: user.side, moveId: move.id });
      return;
    }
  }

  // The second turn of a two-turn move and more Thrash use no PP; Pressure makes a move use 2.
  if (slot === -1) events.push({ type: 'noPp', side: user.side });
  else if (!continuing) {
    const pp = user.mon.moves[slot]!;
    pp.pp = Math.max(0, pp.pp - (abilityIn(ctx, target) === 'pressure' && move.target === 'enemy' ? 2 : 1) - (user.side === 'player' ? ppCostExtra(ctx.perks, move.type) : 0));
  }
  events.push({ type: 'move', side: user.side, moveId: move.id });
  if (user.side === 'player' && !continuing) Held.countPlayerAttack(ctx.battle);
  if (!continuing && slot !== -1) {
    user.vol.prevMove = user.vol.lastMove;
    user.vol.lastMove = move.id;
  }
  user.vol.destinyBond = false;
  user.vol.exposed = false;
  if (!continuing && !user.vol.movesUsed.includes(move.id)) user.vol.movesUsed.push(move.id);
  if (!move.effects.rage) user.vol.raging = false;
  if (!move.effects.protect) user.vol.protectChain = 0;
  if (slot !== -1) Held.noteMoveUsed(ctx, user, move.id);
  if (slot !== -1 && abilityIn(ctx, user) === 'gorilla-tactics' && ctx.battle.held && !ctx.battle.held.choice[user.mon.uid]) ctx.battle.held.choice[user.mon.uid] = move.id;
  if (abilityIn(ctx, user) === 'stance-change') {
    if (move.category !== 'status') swapForm(ctx, user, 'aegislash-blade', events);
    else if (move.id === 'kings-shield') swapForm(ctx, user, 'aegislash', events);
  }

  // Damp stops Explosion and Self-Destruct from either side.
  if (move.effects.selfFaint) {
    const damp = [target, user].find((c) => abilityIn(ctx, c) === 'damp');
    if (damp) {
      announce(damp, 'damp', events);
      events.push({ type: 'fail', side: user.side });
      return;
    }
  }

  const turn = ctx.battle.turn;
  if (move.effects.powerRule === 'echoedVoice') {
    const echo = ctx.battle.extra.echo;
    echo.n = echo.turn === turn || echo.turn === turn - 1 ? Math.min(5, echo.n + (echo.turn === turn ? 0 : 1)) : 1;
    echo.n = Math.max(1, echo.n);
    echo.turn = turn;
  }
  if (move.effects.powerRule === 'fusionFire') ctx.battle.extra.fusion.fire = turn;
  if (move.effects.powerRule === 'fusionElectric') ctx.battle.extra.fusion.electric = turn;
  if (move.effects.powerRule === 'rollout') {
    if (!continuing) {
      user.vol.rollout = 0;
      user.vol.locked = { moveId: move.id, turns: 5 };
    }
  }
  if (move.effects.uproar && !continuing) {
    user.vol.locked = { moveId: move.id, turns: 3 };
    user.vol.uproar = 3;
  }
  if (!preItemMove(ctx, user, move)) {
    events.push({ type: 'fail', side: user.side });
    user.vol.lastFailed = true;
    return;
  }
  const mark = events.length;
  if (ctx.doublesTurn?.hit) ctx.doublesTurn.hit(user, target, move, movedFirst, events);
  else runMove(ctx, user, target, move, movedFirst, events);
  user.vol.lastFailed = events.slice(mark).some((e) => (e.type === 'fail' || e.type === 'miss' || e.type === 'noEffect' || e.type === 'protected') && (e.type === 'noEffect' ? e.side === target.side : e.type === 'protected' ? e.side === target.side : e.side === user.side));
  if (move.effects.powerRule === 'rollout') {
    if (user.vol.lastFailed) {
      user.vol.locked = null;
      user.vol.rollout = 0;
    } else user.vol.rollout += 1;
  }
  if (!move.effects.electricCharge) user.vol.charged = false;

  // Encore: forced to repeat the move for a few turns.
  if (user.vol.locked && !move.effects.lockIn && user.vol.locked.moveId === move.id) {
    user.vol.locked.turns -= 1;
    if (user.vol.locked.turns <= 0) {
      user.vol.locked = null;
      user.vol.rollout = 0;
    }
  }

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

/**
 * Moves whose power depends on the battle (Electro Ball, Hex, Eruption...). Returns the power to use,
 * or null when the move can't be used (Steel Roller with no terrain).
 */
/** Present's rolled power and Fling's item power, set just before the damage step. */
let presentPower = 40;
let flingPower = 30;

/** Weight in kg (Heavy Metal doubles it, Light Metal halves it). */
function weightOf(ctx: BattleContext, c: Combatant): number {
  const base = getSpecies(ctx.content, c.mon.speciesId).weight ?? 50;
  const ability = abilityIn(ctx, c);
  return Math.max(0.1, ability === 'heavy-metal' ? base * 2 : ability === 'light-metal' ? base / 2 : base);
}

function powerFromRule(ctx: BattleContext, rule: PowerRule, base: number, user: Combatant, target: Combatant, userStats: { hp: number; spe: number }, targetStats: { hp: number; spe: number }, movedFirst: boolean, hit = 0): number | null {
  const positive = (st: Record<string, number>) => Object.values(st).reduce((n, v) => n + Math.max(0, v), 0);
  const terrain = ctx.battle.terrain?.id;
  switch (rule) {
    case 'userSpeed': {
      const ratio = userStats.spe / Math.max(1, targetStats.spe);
      return ratio >= 4 ? 150 : ratio >= 3 ? 120 : ratio >= 2 ? 80 : ratio >= 1 ? 60 : 40;
    }
    case 'targetSpeed': return Math.min(150, Math.floor((25 * targetStats.spe) / Math.max(1, userStats.spe)) + 1);
    case 'userHp': return Math.max(1, Math.floor((base * user.mon.hp) / userStats.hp));
    case 'targetHp': return Math.max(1, Math.floor((120 * target.mon.hp) / targetStats.hp));
    case 'doubleTargetStatus': return target.mon.status ? base * 2 : base;
    case 'doubleUserStatus': return user.mon.status ? base * 2 : base;
    case 'doubleTargetPoison': return target.mon.status?.id === 'psn' ? base * 2 : base;
    case 'doubleTargetParalyzed': return target.mon.status?.id === 'par' ? base * 2 : base;
    case 'doubleTargetAsleep': return target.mon.status?.id === 'slp' ? base * 2 : base;
    case 'doubleUserFirst': return movedFirst ? base * 2 : base;
    case 'doubleUserSecond': return movedFirst ? base : base * 2;
    case 'electricTerrainDouble': return terrain === 'electric' ? base * 2 : base;
    case 'electricTerrainBoost': return terrain === 'electric' ? Math.floor(base * 1.5) : base;
    case 'mistyTerrainBoost': return terrain === 'misty' ? Math.floor(base * 1.5) : base;
    case 'psychicTerrainBoost': return terrain === 'psychic' ? Math.floor(base * 1.5) : base;
    case 'needsTerrain': return terrain ? base : null;
    case 'statsRaised': return 20 + 20 * positive(user.stages);
    case 'targetStatsRaised': return Math.min(200, 60 + 20 * positive(target.stages));
    case 'fallenAllies': {
      const team = user.side === 'player' ? ctx.party : ctx.battle.enemyTeam;
      return 50 + 50 * Math.min(6, team.filter((m) => m.hp <= 0).length);
    }
    case 'perHit': return base * (hit + 1);
    case 'magnitude': {
      const r = ctx.rng.int(1, 100);
      return r <= 5 ? 10 : r <= 15 ? 30 : r <= 35 ? 50 : r <= 65 ? 70 : r <= 85 ? 90 : r <= 95 ? 110 : 150;
    }
    case 'sunBoost': return ctx.battle.weather?.id === 'sun' && weatherNow(ctx) === 'sun' ? Math.floor(base * 1.5) : base;
    case 'doubleTargetHurt': return target.vol.tookPhysical + target.vol.tookSpecial > 0 ? base * 2 : base;
    case 'doubleRandom': return ctx.rng.chance(0.3) ? base * 2 : base;
    case 'stockpile': return 100 * user.vol.stockpile;
    case 'friendship': return Math.max(1, Math.min(102, Math.floor((user.side === 'player' ? ((ctx.perks ?? []).some((m) => m.kind === 'friendshipBonusesDisabled') ? 0 : bonusFriendship(ctx.perks, user.mon.friendship)) : user.mon.friendship) / 2.5)));
    case 'rageFist': return Math.min(350, 50 + 50 * user.vol.timesHit);
    case 'stompingTantrum': return user.vol.lastFailed ? base * 2 : base;
    case 'lashOut': return user.vol.loweredThisTurn ? base * 2 : base;
    case 'retaliate': return ctx.battle.extra.allyFaintedTurn[user.side] === ctx.battle.turn - 1 ? base * 2 : base;
    case 'echoedVoice': return Math.min(200, base * Math.max(1, ctx.battle.extra.echo.n));
    case 'rollout': return base * 2 ** Math.min(4, user.vol.rollout);
    case 'fusionFire': return ctx.battle.extra.fusion.electric === ctx.battle.turn ? base * 2 : base;
    case 'fusionElectric': return ctx.battle.extra.fusion.fire === ctx.battle.turn ? base * 2 : base;
    case 'present': return presentPower;
    case 'trumpCard': {
      const pp = user.mon.moves.find((m) => m.id === user.vol.lastMove)?.pp ?? 5;
      return pp <= 0 ? 200 : pp === 1 ? 80 : pp === 2 ? 60 : pp === 3 ? 50 : 40;
    }
    case 'targetWeight': {
      const kg = weightOf(ctx, target);
      return kg < 10 ? 20 : kg < 25 ? 40 : kg < 50 ? 60 : kg < 100 ? 80 : kg < 200 ? 100 : 120;
    }
    case 'weightRatio': {
      const ratio = weightOf(ctx, user) / weightOf(ctx, target);
      return ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40;
    }
    case 'hardPress': return Math.max(1, Math.floor((100 * target.mon.hp) / targetStats.hp));
    case 'acrobatics': return Object.keys(Held.effectiveHeld(ctx, user.mon)).length === 0 ? base * 2 : base;
    case 'doubleDynamax': return target.mon.dynamaxed ? base * 2 : base;
    case 'knockOff': return Object.keys(Held.effectiveHeld(ctx, target.mon)).length > 0 ? Math.floor(base * 1.5) : base;
    case 'terrainPulse': return terrain ? base * 2 : base;
    case 'flingItem': return flingPower;
    case 'friendship': return Math.max(1, Math.min(102, Math.floor(user.mon.friendship / 2.5)));
    case 'frustration': return Math.max(1, Math.min(102, Math.floor((255 - user.mon.friendship) / 2.5)));
  }
}

/** What a move does once its user has acted: accuracy, then its status effect or its damage and side effects. */
function runMove(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, movedFirst: boolean, events: BattleEvent[]): void {
  moveIgnoresAbility = Boolean(move.effects.ignoreAbility) || (move.category === 'status' && abilityIn(ctx, user) === 'mycelium-might');
  try {
    runMoveInner(ctx, user, target, move, movedFirst, events);
  } finally {
    moveIgnoresAbility = false;
  }
}

function runMoveInner(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, movedFirst: boolean, events: BattleEvent[]): void {
  const { content, rng } = ctx;
  const fx = move.effects;
  const weather = weatherNow(ctx);

  // Metronome, Mirror Move, Copycat: use another move instead.
  if (fx.callMove) {
    const pool = [...content.moves.values()].filter((m) => m.supported && !m.effects.callMove && !m.effects.charge && !m.effects.protect && !m.flags.includes('zmove') && !m.flags.includes('max')).map((m) => m.id).sort();
    const id = fx.callMove === 'metronome' ? (pool.length ? rng.pick(pool) : null) : (target.vol.lastMove ?? (fx.callMove === 'copycat' ? user.vol.lastMove : null));
    const called = id ? content.moves.get(id) : undefined;
    if (!called || called.effects.callMove) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    events.push({ type: 'move', side: user.side, moveId: called.id });
    runMove(ctx, user, target, called, movedFirst, events);
    return;
  }

  // Future Sight and Doom Desire: the hit lands two turns later.
  if (fx.delayed) {
    const pending = ctx.battle.extra.delayed;
    if (pending.some((d) => d.side === target.side)) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    pending.push({ side: target.side, turns: 3, userUid: user.mon.uid, userSide: user.side, moveId: move.id });
    events.push({ type: 'selfState', side: user.side, state: 'foresight' });
    return;
  }
  // Bide: store damage for two turns, then hit back for double.
  if (fx.bide) {
    if (!user.vol.bide) {
      user.vol.bide = { turns: 2, damage: 0 };
      user.vol.locked = { moveId: move.id, turns: 3 };
      events.push({ type: 'selfState', side: user.side, state: 'bide' });
      return;
    }
    user.vol.bide.turns -= 1;
    if (user.vol.bide.turns > 0) {
      events.push({ type: 'selfState', side: user.side, state: 'bide' });
      return;
    }
    const stored = user.vol.bide.damage * 2;
    user.vol.bide = null;
    user.vol.locked = null;
    if (stored <= 0 || target.mon.hp <= 0) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    const { lost } = takeHp(ctx, target, stored);
    events.push({ type: 'damage', side: target.side, amount: lost, hpAfter: target.mon.hp, effectiveness: 1, crit: false });
    return;
  }
  // Sleep Talk: asleep, uses one of its other moves.
  if (fx.sleepTalk) {
    const options = user.mon.moves.filter((m) => m.id !== move.id && m.pp > 0 && content.moves.get(m.id)?.supported && !content.moves.get(m.id)!.effects.callMove && !content.moves.get(m.id)!.effects.charge && !content.moves.get(m.id)!.effects.sleepTalk);
    if (user.mon.status?.id !== 'slp' || !options.length) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    const called = content.moves.get(rng.pick(options).id)!;
    events.push({ type: 'move', side: user.side, moveId: called.id });
    runMove(ctx, user, target, called, movedFirst, events);
    return;
  }
  // Me First: copies the foe's chosen attack at 1.5× power.
  if (fx.meFirst) {
    const chosen = target.vol.plannedMove ? content.moves.get(target.vol.plannedMove) : undefined;
    if (!movedFirst || !chosen || chosen.category === 'status' || chosen.effects.callMove || chosen.effects.meFirst) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    events.push({ type: 'move', side: user.side, moveId: chosen.id });
    runMove(ctx, user, target, { ...chosen, power: Math.floor((chosen.power ?? 0) * 1.5) }, true, events);
    return;
  }
  // Snatch: a self-targeting status move used after Snatch is stolen.
  if (move.target === 'self' && move.category === 'status' && !fx.snatch && !fx.protect && target.vol.snatching && target.mon.hp > 0) {
    target.vol.snatching = false;
    events.push({ type: 'selfState', side: target.side, state: 'snatched' });
    applyStatusMove(ctx, target, user, move, events);
    return;
  }
  // Present: damage of 40, 80 or 120, or a gift of 1/4 HP to the target.
  if (fx.powerRule === 'present') {
    const r = rng.int(1, 100);
    if (r <= 20) {
      healMon(ctx, target, 0.25, events);
      return;
    }
    presentPower = r <= 60 ? 40 : r <= 90 ? 80 : 120;
  }

  // Psychic Terrain: a grounded Pokémon can't be hit by a move with priority.
  if (ctx.battle.terrain?.id === 'psychic' && user.side !== target.side && priorityOf(ctx, user, move) > 0 && isGrounded(ctx, target)) {
    events.push({ type: 'fail', side: user.side });
    return;
  }

  // Queenly Majesty, Dazzling, Armor Tail: the foe's priority moves fail.
  if (move.target === 'enemy' && priorityOf(ctx, user, move) > 0) {
    const guard = targetAbility(ctx, user, target);
    if (guard && PRIORITY_GUARD.has(guard)) {
      announce(target, guard, events);
      events.push({ type: 'fail', side: user.side });
      return;
    }
  }

  if (fx.firstTurnOnly && user.vol.turnsOut > 0) {
    events.push({ type: 'fail', side: user.side });
    return;
  }

  // Two-turn moves: charge (and maybe hide) this turn, attack next turn.
  if (fx.charge) {
    if (fx.charge.grab && user.vol.charging !== move.id && (battleTypes(content, ctx.battle, target.mon).includes('flying') || weightOf(ctx, target) >= 200 || target.vol.substitute > 0)) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    if (user.vol.charging === move.id) {
      user.vol.charging = null;
      user.vol.semi = null;
      if (fx.charge.grab) {
        target.flinched = true;
        target.vol.skyHeld = false;
        target.vol.semi = null;
      }
    } else if (!(fx.charge.sunSkips && weather === 'sun') && !Held.usePowerHerb(ctx, user, events as Held.HeldEvent[])) {
      user.vol.charging = move.id;
      user.vol.semi = fx.charge.semi ?? null;
      if (fx.charge.grab) {
        target.flinched = true;
        target.vol.skyHeld = true;
        target.vol.semi = 'air';
      }
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
      setWeather(ctx, fx.weather, Held.weatherTurns(ctx, user, fx.weather, 5));
      events.push({ type: 'weather', weather: fx.weather });
    }
    return;
  }

  if (fx.protect) {
    // Works only when the user moves first; each use in a row is a third as likely to work.
    if (movedFirst && rng.chance(1 / 3 ** user.vol.protectChain)) {
      user.protected = true;
      if (fx.protectContact) PROTECT_CONTACT.set(user, fx.protectContact);
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
  // Protean and Libero: the first move after coming in changes its type to the move's.
  if ((userAbility === 'protean' || userAbility === 'libero') && user.vol.typeShift === null && !move.flags.includes('typeless')) {
    announce(user, userAbility, events);
    user.vol.typeShift = move.type;
  }
  const foeAbility = targetsEnemy ? targetAbility(ctx, user, target) : null;
  const noGuard = userAbility === 'no-guard' || abilityIn(ctx, target) === 'no-guard';
  // A hidden target can only be hit by the moves that reach it (Earthquake hits Dig), or with No Guard.
  if (targetsEnemy && target.vol.semi && fx.hitsSemi?.semi !== target.vol.semi && !noGuard) {
    events.push({ type: 'avoided', side: target.side });
    return;
  }
  // Crafty Shield, Quick Guard, Mat Block, Magic Coat.
  if (targetsEnemy && user !== target) {
    const sh = target.vol.shield;
    if ((sh === 'status' && move.category === 'status') || (sh === 'priority' && priorityOf(ctx, user, move) > 0) || (sh === 'damage' && move.category !== 'status')) {
      events.push({ type: 'protected', side: target.side });
      return;
    }
    if (target.vol.coating && move.category === 'status' && userAbility !== 'magic-bounce') {
      announce(target, 'magic-coat', events);
      target.vol.coating = false;
      applyStatusMove(ctx, target, user, move, events);
      return;
    }
  }
  // Z-Moves go through Protect for a quarter of their damage (see the damage step).
  const piercesProtect = move.flags.includes('contact') && (userAbility === 'unseen-fist' || userAbility === 'piercing-drill');
  if (targetsEnemy && move.category === 'status' && user !== target && foeAbility === 'magic-bounce' && userAbility !== 'magic-bounce' && !target.protected) {
    announce(target, 'magic-bounce', events);
    applyStatusMove(ctx, target, user, move, events);
    return;
  }
  if (targetsEnemy && target.protected && !fx.breaksProtect && !piercesProtect && !move.flags.includes('zmove') && !move.flags.includes('max')) {
    events.push({ type: 'protected', side: target.side });
    const punish = PROTECT_CONTACT.get(target);
    if (punish && move.flags.includes('contact') && user.mon.hp > 0) {
      if (punish.stat && punish.stages) applyStageChange(ctx, user, punish.stat, punish.stages, events, target);
      if (punish.status && canGetStatus(ctx, target, user, punish.status)) tryInflictStatus(ctx, target, user, punish.status, undefined, events, false);
      if (punish.hurt) abilityHurt(ctx, user, Math.max(1, Math.floor(calcStats(content, user.mon).hp * punish.hurt)), events);
    }
    return;
  }
  // Dream Eater, Sucker Punch, Counter, Focus Punch, Blood Moon...: they only work in the right situation.
  const hitThisTurn = user.vol.tookPhysical + user.vol.tookSpecial > 0;
  if (
    (fx.focus === 'unhit' && hitThisTurn) ||
    (fx.focus === 'hitPhysical' && user.vol.tookPhysical <= 0) ||
    (fx.noRepeat && user.vol.prevMove === move.id) ||
    (fx.powerRule === 'stockpile' && user.vol.stockpile <= 0)
  ) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (
    (fx.requiresSleepingTarget && target.mon.status?.id !== 'slp') ||
    (fx.suckerPunch && !(movedFirst && target.vol.plannedAttack)) ||
    (fx.counter && (fx.counter === 'physical' ? user.vol.tookPhysical : fx.counter === 'special' ? user.vol.tookSpecial : user.vol.tookPhysical + user.vol.tookSpecial) <= 0)
  ) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (
    (fx.asleepOnly && user.mon.status?.id !== 'slp') ||
    (fx.precondition === 'allOthers' && (user.mon.moves.length < 2 || !user.mon.moves.every((m) => m.id === move.id || user.vol.movesUsed.includes(m.id)))) ||
    (fx.precondition === 'ateBerry' && !Object.keys(ctx.battle.held?.used[user.mon.uid] ?? {}).some((id) => content.catalog.get(id)?.family.startsWith('Berries'))) ||
    (fx.precondition === 'targetHasItem' && Object.keys(Held.effectiveHeld(ctx, target.mon)).length === 0) ||
    (fx.upperHand && !(movedFirst && target.vol.plannedMove && (content.moves.get(target.vol.plannedMove)?.priority ?? 0) > 0 && content.moves.get(target.vol.plannedMove)?.category !== 'status')) ||
    (fx.synchronoise && !battleTypes(content, ctx.battle, user.mon).some((t) => battleTypes(content, ctx.battle, target.mon).includes(t)))
  ) {
    events.push({ type: fx.synchronoise ? 'noEffect' : 'fail', side: fx.synchronoise ? target.side : user.side });
    return;
  }
  if (fx.stealBoosts) {
    for (const st of ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as const) {
      if (target.stages[st] > 0) {
        user.stages[st] = clampStage(user.stages[st] + target.stages[st]);
        target.stages[st] = 0;
      }
    }
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
  const perkAccuracy = user.side === 'player' && move.category === 'status' ? statusMoveAccuracyPerk(ctx.perks) : 1;
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
    accuracy = hitChance(baseAccuracy, accStage, evaStage) * itemAccuracy * perkAccuracy;
    if (baseAccuracy !== null) {
      if (userAbility === 'compound-eyes') accuracy *= 1.3;
      if (userAbility === 'victory-star') accuracy *= 1.1;
      if (userAbility === 'hustle' && move.category === 'physical') accuracy *= 0.8;
      if (foeAbility && weather && WEATHER_EVASION[foeAbility]?.includes(weather)) accuracy *= 0.8;
      if (foeAbility === 'tangled-feet' && target.vol.confusion > 0) accuracy *= 0.5;
      if (ctx.battle.field.gravity > 0) accuracy *= 5 / 3;
      if (target.side === 'player') accuracy /= evasionPerk(ctx.perks, getSpecies(content, target.mon.speciesId).types);
      if (foeAbility === 'wonder-skin' && move.category === 'status') accuracy = Math.min(accuracy, 0.5);
    }
    accuracy = Math.min(1, accuracy);
  }
  if (noGuard || ((target.vol.exposed || target.vol.telekinesis > 0) && !fx.ohko && targetsEnemy)) accuracy = 1;
  if (user.vol.sureHit && targetsEnemy) {
    accuracy = 1;
    user.vol.sureHit = false;
  }
  if (targetsEnemy && rng.float() >= accuracy) {
    events.push({ type: 'miss', side: user.side });
    if (fx.crashOnMiss) abilityHurt(ctx, user, Math.max(1, Math.floor(calcStats(content, user.mon).hp / 2)), events);
    return;
  }

  // The move's type: Weather Ball follows the weather; Pixilate and friends turn Normal moves into their type.
  const special = specialMoveType(ctx, user, move, weather);
  let baseType: TypeName = special ?? (fx.weatherBall && weather ? WEATHER_BALL_TYPE[weather] : Held.moveTypeFor(ctx, user.mon, user.side, move.type));
  // Ion Deluge, Plasma Fists and Electrify turn Normal moves Electric.
  if (baseType === 'normal' && !move.flags.includes('typeless') && (ctx.battle.extra.ionDeluge || user.vol.electrified)) baseType = 'electric';
  user.vol.electrified = false;
  const typeChange = userAbility ? TYPE_CHANGE[userAbility] : undefined;
  const liquid = userAbility === 'liquid-voice' && move.flags.includes('sound') && !move.flags.includes('typeless');
  const normalized = userAbility === 'normalize' && baseType !== 'normal' && !move.flags.includes('typeless');
  const changedType = liquid || normalized || (typeChange !== undefined && baseType === 'normal' && !move.flags.includes('typeless'));
  const moveType = liquid ? 'water' : normalized ? 'normal' : changedType ? typeChange! : baseType;
  const targetTypes = battleTypes(content, ctx.battle, target.mon);
  // Scrappy: Normal and Fighting moves hit Ghost types.
  const hitTypes = userAbility === 'scrappy' && (moveType === 'normal' || moveType === 'fighting') ? targetTypes.filter((t) => t !== 'ghost') : targetTypes;
  // Foresight / Odor Sleuth / Miracle Eye open the immunities they name.
  const idHit = target.vol.identified === 'ghost' && (moveType === 'normal' || moveType === 'fighting') ? hitTypes.filter((t) => t !== 'ghost') : target.vol.identified === 'dark' && moveType === 'psychic' ? hitTypes.filter((t) => t !== 'dark') : hitTypes;
  let rawEff = fx.superAgainst ? idHit.reduce((n, t) => n * (t === fx.superAgainst ? 2 : typeEffectiveness(content.typeChart, moveType, [t])), 1) : typeEffectiveness(content.typeChart, moveType, idHit);
  if (fx.secondType) rawEff *= typeEffectiveness(content.typeChart, fx.secondType, idHit);
  if (target.vol.tarred && moveType === 'fire') rawEff *= 2;
  if (ctx.battle.extra.delta && idHit.includes('flying')) {
    const vsFlying = typeEffectiveness(content.typeChart, moveType, ['flying']);
    if (vsFlying > 1) rawEff /= vsFlying;
  }
  const effectiveness = move.flags.includes('typeless') ? 1 : Held.adjustEffectiveness(ctx, target, moveType, rawEff);
  // Powder: a Fire move backfires.
  if (user.vol.powdered && moveType === 'fire') {
    user.vol.powdered = false;
    abilityHurt(ctx, user, Math.max(1, Math.floor(calcStats(content, user.mon).hp / 4)), events);
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (targetsEnemy && move.category === 'status' && target.vol.substitute > 0 && user !== target && !move.effects.sideMove && !move.effects.field) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
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
  if ((fx.endeavor && user.mon.hp >= target.mon.hp) || (fx.powerRule === 'needsTerrain' && !ctx.battle.terrain)) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  // Sheer Force: moves with an extra effect are 1.3× as strong and lose the effect.
  const hasExtra = Boolean(fx.status || fx.flinchChance || fx.confuse || changes.some((c) => c.target === 'enemy' || c.chance < 100));
  const sheerForce = userAbility === 'sheer-force' && hasExtra;
  const parental = userAbility === 'parental-bond' && !fx.hits && !fx.ohko && !fx.fixedDamage && !fx.counter && !fx.halveTarget && !fx.endeavor && !fx.userFaint;
  const beaters = fx.beatUp ? (user.side === 'player' ? ctx.party : ctx.battle.enemyTeam).filter((m) => m.hp > 0 && !m.status) : [];
  const hits = fx.beatUp ? Math.max(1, beaters.length) : fx.hits ? (userAbility === 'skill-link' ? fx.hits[1] : multiHitCount(fx.hits, rng)) : parental ? 2 : 1;
  let dealt = 0;
  let landed = 0;
  let anyCrit = false;
  for (let hit = 0; hit < hits && target.mon.hp > 0 && user.mon.hp > 0; hit++) {
    let damage: number;
    let crit = false;
    const targetMax = calcStats(content, target.mon).hp;
    if (fx.ohko) {
      damage = target.mon.hp;
    } else if (fx.fixedDamage || fx.halveTarget || fx.endeavor || fx.counter || fx.userFaint === 'finalGambit') {
      if (fx.userFaint === 'finalGambit') damage = Math.max(1, user.mon.hp);
      else if (fx.counter) damage = Math.max(1, Math.floor((fx.counter === 'physical' ? user.vol.tookPhysical : fx.counter === 'special' ? user.vol.tookSpecial : (user.vol.tookPhysical + user.vol.tookSpecial) * 0.75) * 2));
      else if (fx.endeavor) damage = Math.max(1, target.mon.hp - user.mon.hp);
      else if (fx.halveTarget) damage = Math.max(1, Math.floor(target.mon.hp / 2));
      else if (fx.fixedDamage === 'level') damage = user.mon.level;
      else if (fx.fixedDamage === 'psywave') damage = Math.max(1, Math.floor((user.mon.level * rng.int(50, 150)) / 100));
      else damage = fx.fixedDamage as number;
    } else {
      const userStats = statsOf(ctx, user);
      const targetStats = statsOf(ctx, target);
      const physical = fx.attackFrom === 'best' || fx.autoCategory || (fx.teraBlast && ctx.battle.transform.teraTypes[user.mon.uid]) ? userStats.atk >= userStats.spa : move.category === 'physical';
      const hitsDefense = (physical || fx.targetsDefense) !== (ctx.battle.extra.wonderRoom > 0);
      const userStatus = user.mon.status?.id;
      crit = rng.chance(Math.min(1, critChance(content.ruleset, move.critStage + Held.critStageBonus(ctx, user) + (userAbility === 'super-luck' ? 1 : 0) + (user.vol.focusEnergy ? 2 : 0)) * (user.side === 'player' ? critChancePerk(ctx.perks) : 1) + (user.side === 'player' ? critChanceBonusPerk(ctx.perks) : 0)));
      if (fx.alwaysCrit || user.vol.laserFocus) crit = true;
      if (userAbility === 'merciless' && target.mon.status?.id === 'psn') crit = true;
      if (foeAbility === 'battle-armor' || foeAbility === 'shell-armor' || ctx.battle.sideEffects[target.side].luckyChant > 0) crit = false;
      if (crit) user.vol.laserFocus = false;
      const randomFactor = rng.int(content.ruleset.randomFactorMin, 100);
      let power = fx.lowHpPower ? lowHpPower(user.mon.hp, userStats.hp) : (move.power ?? 0);
      if (fx.beatUp && beaters.length > 0) power = Math.floor(getSpecies(content, beaters[Math.min(hit, beaters.length - 1)]!.speciesId).baseStats.atk / 10) + 5;
      if (fx.powerRule) power = powerFromRule(ctx, fx.powerRule, power, user, target, userStats, targetStats, movedFirst, hit) ?? power;
      power = teraPower(ctx.battle, user.mon, { ...move, type: moveType }, power);
      let stab = move.flags.includes('typeless') ? 1 : stabMultiplier(content, ctx.battle, user.mon, moveType);
      if (stab === 1 && user.vol.typeShift === moveType) stab = content.ruleset.stabMultiplier;
      if (fx.doubleBelowHalf && target.mon.hp * 2 <= targetStats.hp) power *= 2;
      if (fx.hitsSemi?.double && target.vol.semi === fx.hitsSemi.semi) power *= 2;
      if (fx.weatherBall && weather) power *= 2;
      if (fx.charge?.sunSkips && weather && weather !== 'sun') power = Math.floor(power / 2);
      // Abilities that change the move's power.
      let attackBoost = 1;
      let powerMult = 1;
      if (changedType) powerMult *= 1.2;
      if (userAbility === 'technician' && power <= 60) powerMult *= 1.5;
      const flagBoost = userAbility ? FLAG_BOOST[userAbility] : undefined;
      if (flagBoost && move.flags.includes(flagBoost.flag)) powerMult *= flagBoost.multiplier;
      if (userAbility === 'reckless' && fx.recoil) powerMult *= 1.2;
      if (ctx.battle.field.waterSport > 0 && moveType === 'fire') powerMult *= 1 / 3;
      if (ctx.battle.field.mudSport > 0 && moveType === 'electric') powerMult *= 1 / 3;
      if (userAbility && TYPE_BOOST[userAbility] === moveType) powerMult *= 1.5;
      for (const a of [userAbility, abilityIn(ctx, target)]) {
        if (a && AURAS[a] === moveType) powerMult *= userAbility === 'aura-break' || abilityIn(ctx, target) === 'aura-break' ? 0.75 : 4 / 3;
      }
      if (userAbility === 'orichalcum-pulse' && physical && weather === 'sun') attackBoost *= 4 / 3;
      if (userAbility === 'hadron-engine' && !physical && ctx.battle.terrain?.id === 'electric') attackBoost *= 4 / 3;
      if (sheerForce) powerMult *= 1.3;
      // Rivalry: stronger against the same gender, weaker against the opposite one.
      if (userAbility === 'rivalry') powerMult *= sameGender(content, user.mon, target.mon) ? 1.25 : oppositeGender(content, user.mon, target.mon) ? 0.75 : 1;
      if (userAbility === 'analytic' && !movedFirst) powerMult *= 1.3;
      if (foeAbility === 'heatproof' && moveType === 'fire') powerMult *= 0.5;
      if (foeAbility === 'dry-skin' && moveType === 'fire') powerMult *= 1.25;
      if (powerMult !== 1) power = Math.max(1, pokeRound(power, powerMult));
      // Abilities that change the attacking stat.
      const baseAttack = fx.beatUp && beaters.length > 0 ? calcStats(content, beaters[Math.min(hit, beaters.length - 1)]!).atk : fx.attackFrom === 'targetAtk' ? targetStats.atk : fx.attackFrom === 'def' ? userStats.def : physical ? userStats.atk : userStats.spa;
      let attack = Math.floor(baseAttack * Held.heldStatMultiplier(ctx, user.mon, user.side, physical ? 'atk' : 'spa'));
      let attackMult = attackBoost;
      if (physical && (userAbility === 'huge-power' || userAbility === 'pure-power')) attackMult *= 2;
      if (physical && (userAbility === 'hustle' || userAbility === 'gorilla-tactics')) attackMult *= 1.5;
      if (physical && userAbility === 'flower-gift' && weather === 'sun') attackMult *= 1.5;
      if (foeAbility && RUINS[foeAbility] === (physical ? 'atk' : 'spa')) attackMult *= 0.75;
      if (userAbility === 'supreme-overlord') {
        const fallen = ctx.party.filter((m) => m.hp <= 0).length;
        attackMult *= 1 + 0.1 * Math.min(5, user.side === 'player' ? fallen : ctx.battle.enemyTeam.filter((m) => m.hp <= 0).length);
      }
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
      if (!hitsDefense && foeAbility === 'flower-gift' && weather === 'sun') defense = Math.floor(defense * 1.5);
      if (userAbility && RUINS[userAbility] === (hitsDefense ? 'def' : 'spd')) defense = Math.floor(defense * 0.75);
      if (hitsDefense && foeAbility === 'grass-pelt' && ctx.battle.terrain?.id === 'grassy') defense = Math.floor(defense * 1.5);
      // Abilities that change the final damage.
      let final = 1;
      if (target.vol.exposed) final *= 2;
      if (effectiveness > 1 && (foeAbility === 'filter' || foeAbility === 'solid-rock' || foeAbility === 'prism-armor')) final *= 0.75;
      if ((foeAbility === 'multiscale' || foeAbility === 'shadow-shield') && target.mon.hp >= targetStats.hp) final *= 0.5;
      if (!crit) {
        const tfx = ctx.battle.sideEffects[target.side];
        if (tfx.auroraVeil > 0 || (hitsDefense ? tfx.reflect > 0 : tfx.lightScreen > 0)) final *= 0.5;
      }
      if (userAbility === 'tinted-lens' && effectiveness < 1) final *= 2;
      if (userAbility === 'neuroforce' && effectiveness > 1) final *= 1.25;
      if (fx.superEffectiveBoost && effectiveness > 1) final *= 4 / 3;
      if (user.mon.awakened?.includes(move.id)) final *= content.story.awakening.boost;
      if ((foeAbility === 'fluffy' || foeAbility === 'aura-guard') && contact) final *= 0.5;
      if (parental && hit === 1) final *= 0.25;
      if (userAbility === 'stakeout' && target.vol.turnsOut === 0) final *= 2;
      if (foeAbility === 'tera-shell' && target.mon.hp >= targetStats.hp && effectiveness > 0) final *= 0.5 / effectiveness;
      if (foeAbility === 'fluffy' && moveType === 'fire') final *= 2;
      if (foeAbility === 'ice-scales' && !physical) final *= 0.5;
      if (foeAbility === 'punk-rock' && move.flags.includes('sound')) final *= 0.5;
      const ruleset = crit ? { ...content.ruleset, critMultiplier: Held.critDamage(ctx, user, content.ruleset.critMultiplier) * critDamagePerk(ctx.perks, user.side) } : content.ruleset;
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
        weather: weatherMultiplier(userAbility === 'mega-sol' ? 'sun' : weather, moveType),
        final,
      });
      damage = applyTypeModifiers(ctx, user, target, effectiveness, damage, physical, moveType, move);
      const itemMultiplier =
        terrainMultiplier(ctx, user, target, moveType) *
        Held.attackMultiplier(ctx, user, target, move, moveType, effectiveness, events as Held.HeldEvent[]) *
        Held.defenseMultiplier(ctx, target, moveType, effectiveness, ctx.battle.kind === 'wild' && target.side === 'player', events as Held.HeldEvent[]);
      if (itemMultiplier !== 1) damage = Math.max(1, Math.floor(damage * itemMultiplier));
      if (target.protected && (move.flags.includes('zmove') || move.flags.includes('max') || userAbility === 'piercing-drill')) damage = Math.max(1, Math.floor(damage / 4));
    }
    damage = Held.survive(ctx, target, damage, events as Held.HeldEvent[]);
    if (fx.leaveOne || target.vol.endure) damage = Math.min(damage, target.mon.hp - 1);
    // Sturdy: a hit at full HP leaves it with at least 1 HP.
    const sturdy = foeAbility === 'sturdy' && target.mon.hp >= targetMax && target.mon.hp > 1 && damage >= target.mon.hp;
    if (sturdy) damage = target.mon.hp - 1;

    // Disguise and Ice Face take one hit for the Pokémon, then the form breaks.
    if ((foeAbility === 'disguise' || (foeAbility === 'ice-face' && move.category === 'physical')) && !ctx.battle.extra.brokenFace.includes(target.mon.uid) && user !== target) {
      ctx.battle.extra.brokenFace.push(target.mon.uid);
      announce(target, foeAbility, events);
      events.push({ type: 'noEffect', side: target.side });
      if (foeAbility === 'disguise') {
        swapForm(ctx, target, 'mimikyu-busted', events);
        abilityHurt(ctx, target, Math.max(1, Math.floor(targetMax / 8)), events);
      } else swapForm(ctx, target, 'eiscue-noice', events);
      continue;
    }
    // A Substitute takes the hit instead (sound moves go past it).
    if (target.vol.substitute > 0 && !move.flags.includes('sound') && user !== target) {
      target.vol.substitute = Math.max(0, target.vol.substitute - damage);
      events.push({ type: 'substituteHit', side: target.side, broke: target.vol.substitute <= 0 });
      return;
    }
    const { lost, lastStand, hyper, knockedDown } = takeHp(ctx, target, damage, landed);
    dealt += lost;
    landed += 1;
    anyCrit ||= crit;
    // Pushed Itself Back Up: the hit knocks it down first, then it gets up.
    events.push({ type: 'damage', side: target.side, amount: lost, hpAfter: knockedDown ? 0 : target.mon.hp, effectiveness, crit });
    if (sturdy) announce(target, 'sturdy', events);
    if (target.mon.hp <= 0 && target.vol.destinyBond && user.mon.hp > 0) {
      user.mon.hp = 0;
      events.push({ type: 'selfKo', side: user.side });
    }
    if (lastStand) events.push({ type: 'lastStand', side: target.side, itemId: lastStand });
    if (hyper) events.push(hyper);
    if (target.side === 'player' && effectiveness > 1 && target.mon.hp > 0) {
      ctx.battle.hyper.superEffective[target.mon.uid] = (ctx.battle.hyper.superEffective[target.mon.uid] ?? 0) + 1;
    }
  }
  if (fx.hits || fx.beatUp) events.push({ type: 'hits', side: target.side, count: landed });
  if (dealt > 0) {
    if (move.category === 'physical') target.vol.tookPhysical += dealt;
    else if (move.category === 'special') target.vol.tookSpecial += dealt;
  }
  if (landed > 0 && target.mon.hp > 0) {
    // Smelling Salts and Wake-Up Slap use up the status they punish; Steel Roller and Ice Spinner clear the terrain.
    const cures = (fx.powerRule === 'doubleTargetParalyzed' && target.mon.status?.id === 'par') || (fx.powerRule === 'doubleTargetAsleep' && target.mon.status?.id === 'slp');
    if (cures) {
      target.mon.status = null;
      events.push({ type: 'cured', side: target.side });
    }
  }
  if (landed > 0 && (fx.powerRule === 'needsTerrain' || move.id === 'ice-spinner') && ctx.battle.terrain) {
    events.push({ type: 'terrainEnd', terrain: ctx.battle.terrain.id });
    ctx.battle.terrain = null;
  }
  Held.afterHit(ctx, user, target, move, moveType, effectiveness, dealt, movedFirst, events as Held.HeldEvent[]);
  if (dealt > 0 && target.mon.hp > 0 && user.mon.hp > 0) {
    if (Held.triggerOnce(ctx, target, 'redCard', events as Held.HeldEvent[])) forceOut(ctx, user, events);
    else if (Held.triggerOnce(ctx, target, 'ejectButton', events as Held.HeldEvent[])) target.vol.pivot = { baton: false };
  }
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
      if (heal > 0 && !(user.side === 'enemy' && enemyHealingBlocked(ctx.perks))) {
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

  if (landed > 0 && fx.smackDown) {
    target.vol.smackedDown = true;
    if (target.vol.semi === 'air') target.vol.semi = null;
  }
  if (landed > 0 && fx.cure && target.mon.hp > 0) {
    const mons = fx.cure === 'party' ? (user.side === 'player' ? ctx.party : ctx.battle.enemyTeam) : [user.mon];
    let any = false;
    for (const m of mons) if (m.status && m.hp > 0) { m.status = null; any = true; }
    if (any) events.push({ type: 'cured', side: user.side });
  }
  if (landed > 0 && fx.powerRule === 'stockpile') {
    const n = user.vol.stockpile;
    user.vol.stockpile = 0;
    user.stages.def = Math.max(-6, user.stages.def - n);
    user.stages.spd = Math.max(-6, user.stages.spd - n);
  }
  if (landed > 0 && fx.switchOut) user.vol.pivot = { baton: fx.switchOut === 'baton' };
  if (landed > 0 && fx.resetStages) {
    for (const c of fx.resetStages === 'both' ? [user, target] : [target]) for (const k of Object.keys(c.stages) as BoostStat[]) c.stages[k] = 0;
    events.push({ type: 'statsReset', side: target.side });
  }
  if (target.mon.hp <= 0 && user.mon.hp > 0 && userAbility === 'battle-bond') swapForm(ctx, user, 'greninja-ash', events);
  if (fx.koBoost && target.mon.hp <= 0 && user.mon.hp > 0) applyStageChange(ctx, user, fx.koBoost.stat, fx.koBoost.stages, events);
  if (landed > 0 && fx.forceSwitch) forceOut(ctx, target, events);
  if (landed > 0 && fx.trap) target.vol.trapped = true;
  if (landed > 0 && fx.disrupt) disrupt(ctx, user, target, fx.disrupt, events);
  postHitExtras(ctx, user, target, move, landed, movedFirst, events);
  // Hazard-setting and hazard-clearing attacks (Ceaseless Edge, Stone Axe, Rapid Spin).
  if (landed > 0 && fx.sideMove) applySideMove(ctx, user, fx.sideMove, events);
  if (landed > 0 && fx.clearHazards) clearHazards(ctx, user, fx.clearHazards, events);

  // Extra effects only land if the target is still standing. Serene Grace doubles their chances; Shield Dust blocks them.
  const chanceMult = userAbility === 'serene-grace' ? 2 : 1;
  const shielded = foeAbility === 'shield-dust';
  const userTypes = getSpecies(ctx.content, user.mon.speciesId).types;
  const roll = (percent: number, statusId?: string) => rng.chance(Math.min(100, percent * chanceMult * (user.side === 'player' ? statusChancePerk(ctx.perks, userTypes, statusId) : 1)) / 100);
  if (target.mon.hp > 0 && !sheerForce && !shielded) {
    if (fx.randomStatus && roll(fx.randomStatus.chance)) {
      const id = fx.randomStatus.ids[rng.int(0, fx.randomStatus.ids.length - 1)]!;
      tryInflictStatus(ctx, user, target, id, move, events, false);
    }
    if (fx.status && roll(fx.status.chance, fx.status.id)) tryInflictStatus(ctx, user, target, fx.status.id, move, events, false);
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
    setWeather(ctx, maxWeather, Held.weatherTurns(ctx, user, maxWeather, 5));
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
    if (holder === 'cute-charm' && !user.vol.infatuated && rng.chance(0.3) && oppositeGender(ctx.content, target.mon, user.mon) && abilityIn(ctx, user) !== 'oblivious' && !Held.statusBlocked(ctx, user, 'infatuation')) {
      announce(target, holder, events);
      user.vol.infatuated = true;
      events.push({ type: 'selfState', side: user.side, state: 'infatuated' });
    }
    if (holder === 'effect-spore' && rng.chance(0.3)) {
      const spore = (['psn', 'par', 'slp'] as const)[rng.int(0, 2)]!;
      const types = getSpecies(ctx.content, user.mon.speciesId).types;
      if (!types.includes('grass') && userAbility !== 'overcoat' && canGetStatus(ctx, target, user, spore)) {
        announce(target, holder, events);
        tryInflictStatus(ctx, target, user, spore, undefined, events, false);
      }
    }
    if (SPREADS_ON_CONTACT.has(holder) && userAbility && userAbility !== holder && !SPREADS_ON_CONTACT.has(userAbility) && !UNTRACEABLE.has(userAbility)) {
      announce(target, holder, events);
      user.vol.abilityOverride = holder;
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
  if (target.mon.hp > 0 && holder === 'spicy-spray' && user.mon.hp > 0 && canGetStatus(ctx, target, user, 'brn')) {
    announce(target, holder, events);
    tryInflictStatus(ctx, target, user, 'brn', undefined, events, false);
  }
  if (target.mon.hp > 0 && holder === 'sand-spit' && ctx.battle.weather?.id !== 'sand') {
    announce(target, holder, events);
    setWeather(ctx, 'sand', 5);
    events.push({ type: 'weather', weather: 'sand' });
  }
  if (target.mon.hp > 0 && holder === 'seed-sower' && ctx.battle.terrain?.id !== 'grassy') {
    announce(target, holder, events);
    ctx.battle.terrain = { id: 'grassy', turns: 5 };
    events.push({ type: 'terrain', terrain: 'grassy' });
  }
  if (userAbility === 'toxic-chain' && target.mon.hp > 0 && rng.chance(0.3) && canGetStatus(ctx, user, target, 'psn')) {
    announce(user, userAbility, events);
    tryInflictStatus(ctx, user, target, 'psn', undefined, events, false);
  }
  if (holder === 'gulp-missile' && target.mon.hp > 0 && user.mon.hp > 0 && (target.mon.speciesId === 'cramorant-gulping' || target.mon.speciesId === 'cramorant-gorging')) {
    announce(target, holder, events);
    if (userAbility !== 'magic-guard') abilityHurt(ctx, user, Math.max(1, Math.floor(calcStats(ctx.content, user.mon).hp / 4)), events);
    if (target.mon.speciesId === 'cramorant-gulping') applyStageChange(ctx, user, 'def', -1, events, target);
    else if (canGetStatus(ctx, target, user, 'par')) tryInflictStatus(ctx, target, user, 'par', undefined, events, false);
    swapForm(ctx, target, 'cramorant', events);
  }
  if (holder === 'illusion' && target.vol.illusion && move.category !== 'status') {
    events.push({ type: 'transform', side: target.side, uid: target.mon.uid, kind: 'illusion', from: target.vol.illusion, to: target.mon.speciesId, itemId: null, broken: true });
    target.vol.illusion = null;
  }
  if (holder === 'innards-out' && target.mon.hp <= 0 && user.mon.hp > 0 && userAbility !== 'magic-guard') {
    const hit = [...events].reverse().find((e) => e.type === 'damage' && e.side === target.side);
    announce(target, holder, events);
    abilityHurt(ctx, user, Math.max(1, hit && hit.type === 'damage' ? hit.amount : 1), events);
  }
  if (target.mon.hp > 0 && move.category !== 'status' && ((holder === 'electromorphosis') || (holder === 'wind-power' && move.flags.includes('wind')))) {
    announce(target, holder, events);
    target.vol.charged = true;
    events.push({ type: 'selfState', side: target.side, state: 'charged' } as BattleEvent);
  }
  if (target.mon.hp > 0) {
    target.vol.timesHit += 1;
    if (target.vol.raging && target.stages.atk < 6) applyStageChange(ctx, target, 'atk', 1, events);
    if (target.vol.beakHeat && contact && user.mon.hp > 0 && canGetStatus(ctx, target, user, 'brn')) tryInflictStatus(ctx, target, user, 'brn', undefined, events, false);
  }
  if (target.mon.hp > 0 && holder) {
    const boost = HIT_BOOST[holder];
    if (boost && (!boost.types || boost.types.includes(moveType)) && (!boost.physical || move.category === 'physical')) {
      announce(target, holder, events);
      for (const change of boost.changes) applyStageChange(ctx, target, change.stat, change.stages, events);
    }
    const half = HALF_HP_BOOST[holder];
    const lastHit = [...events].reverse().find((e) => e.type === 'damage' && e.side === target.side);
    const dealt = lastHit && lastHit.type === 'damage' ? lastHit.amount : 0;
    const maxHp = calcStats(ctx.content, target.mon).hp;
    if (half && target.mon.hp * 2 < maxHp && (target.mon.hp + dealt) * 2 >= maxHp) {
      announce(target, holder, events);
      applyStageChange(ctx, target, half.stat, half.stages, events);
    }
    if (holder === 'color-change' && !move.flags.includes('typeless') && !battleTypes(ctx.content, ctx.battle, target.mon).every((t) => t === moveType)) {
      announce(target, holder, events);
      target.vol.typeShift = moveType;
      events.push({ type: 'selfState', side: target.side, state: 'typeChanged' });
    }
    if (holder === 'cursed-body' && user.mon.hp > 0 && rng.chance(0.3)) {
      announce(target, holder, events);
      disrupt(ctx, target, user, 'disable', events);
    }
    if (holder === 'cotton-down' && user.mon.hp > 0) {
      announce(target, holder, events);
      applyStageChange(ctx, user, 'spe', -1, events, target);
    }
    if (holder === 'toxic-debris' && move.category === 'physical' && ctx.battle.sideEffects[user.side].toxicSpikes < 2) {
      announce(target, holder, events);
      ctx.battle.sideEffects[user.side].toxicSpikes += 1;
      events.push({ type: 'hazard', side: user.side, hazard: 'toxicSpikes' } as BattleEvent);
    }
    if (holder === 'perish-body' && contact && user.vol.perish === 0 && target.vol.perish === 0 && abilityIn(ctx, user) !== 'soundproof') {
      announce(target, holder, events);
      user.vol.perish = 4;
      target.vol.perish = 4;
      events.push({ type: 'selfState', side: target.side, state: 'perishSong' });
    }
    if (holder === 'wandering-spirit' && contact && userAbility && !UNTRACEABLE.has(userAbility) && userAbility !== holder) {
      announce(target, holder, events);
      user.vol.abilityOverride = holder;
      target.vol.abilityOverride = userAbility;
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

/** Protecting moves that punish contact (King's Shield, Spiky Shield, ...), for the turn they are up. */
const PROTECT_CONTACT = new WeakMap<Combatant, NonNullable<Move['effects']['protectContact']>>();

/** Roar, Whirlwind, Dragon Tail: a trainer's Pokémon is swapped for another; the player's for a random one. A wild Pokémon is unaffected. */
function forceOut(ctx: BattleContext, target: Combatant, events: BattleEvent[]): void {
  const { battle, rng } = ctx;
  if (target.mon.hp <= 0 || target.mon.dynamaxed) return;
  if (target.side === 'enemy') {
    if (battle.kind !== 'trainer') return;
    const others = battle.enemyTeam.map((m, i) => ({ m, i })).filter(({ m, i }) => i !== battle.enemyIndex && i !== battle.doubles?.enemy.index && m.hp > 0);
    if (!others.length) return;
    swapInEnemy(ctx, rng.pick(others).i, events);
  } else {
    const others = ctx.party.map((m, i) => ({ m, i })).filter(({ m, i }) => i !== battle.activeIndex && i !== battle.doubles?.player.index && m.hp > 0);
    if (!others.length) return;
    const outgoing = ctx.party[battle.activeIndex]!;
    events.push({ type: 'switchOut', side: 'player', uid: outgoing.uid });
    switchOutAbility(ctx, outgoing);
    switchIn(ctx, rng.pick(others).i, events);
    resolveEntries(ctx, events);
  }
}

/** The trainer swaps its Pokémon for the one at `index` (the two trade places so the team order stays forward-only). */
/**
 * A smart trainer (ai > 0): drinks a potion when its Pokémon is nearly down,
 * or swaps to a teammate whose moves would hurt the player's Pokémon much more.
 * Uses no random numbers, so it never changes the other rolls. Returns true when it took its turn.
 */
function trainerAiTurn(ctx: BattleContext, enemy: Combatant, events: BattleEvent[]): boolean {
  const { battle, content } = ctx;
  const cfg = content.balance.trainerAi;
  const mon = enemy.mon;
  if (mon.hp <= 0 || mon.dynamaxed) return false;
  const max = calcStats(content, mon).hp;
  if (battle.enemyItemsUsed < cfg.maxItems && mon.hp / max < cfg.healBelow) {
    const gain = Math.min(max - mon.hp, Math.floor(max * cfg.healFraction));
    if (gain > 0) {
      battle.enemyItemsUsed += 1;
      mon.hp += gain;
      events.push({ type: 'item', itemId: 'hyper-potion', targetUid: mon.uid, message: `The trainer used a Hyper Potion on ${getSpecies(content, mon.speciesId).name}!`, hpAfter: mon.hp });
      return true;
    }
  }
  if (battle.enemySwitches >= cfg.maxSwitches || enemy.vol.turnsOut < 1 || enemy.vol.trapped || enemy.vol.bound > 0) return false;
  const target = ctx.party[battle.activeIndex]!;
  const best = (m: PokemonInstance, stages: Stages) =>
    Math.max(0, ...m.moves.filter((x) => x.pp > 0).map((x) => moveValue({ content, ai: 1, target, stages }, m, x.id)));
  const mine = best(mon, battle.enemyStages);
  const spares = battle.enemyTeam.map((m, i) => ({ m, i })).filter(({ m, i }) => i !== battle.enemyIndex && m.hp > 0);
  if (!spares.length) return false;
  const pick = spares.reduce((b, s) => (best(s.m, freshStages()) > best(b.m, freshStages()) ? s : b));
  const theirs = best(pick.m, freshStages());
  if (theirs <= 0 || mine >= theirs * cfg.switchRatio) return false;
  battle.enemySwitches += 1;
  swapInEnemy(ctx, pick.i, events);
  return true;
}

function swapInEnemy(ctx: BattleContext, index: number, events: BattleEvent[]): void {
  const { battle } = ctx;
  const out = battle.enemyTeam[battle.enemyIndex]!;
  const next = battle.enemyTeam[index]!;
  battle.enemyTeam[battle.enemyIndex] = next;
  battle.enemyTeam[index] = out;
  battle.enemyStages = freshStages();
  battle.enemyVolatile = freshVolatile();
  const active = ctx.party[battle.activeIndex]!;
  battle.participants = active.hp > 0 ? [active.uid] : [];
  events.push({ type: 'switchOut', side: 'enemy', uid: out.uid });
  events.push({ type: 'switchIn', side: 'enemy', uid: next.uid, speciesId: next.speciesId, level: next.level });
  battle.pendingEntry = [...(battle.pendingEntry ?? []).filter((side) => side !== 'enemy'), 'enemy'];
}

/** U-turn, Volt Switch, Baton Pass, Teleport...: the user leaves at the end of the turn (a trainer's Pokémon only if it has a spare). */
function resolvePivots(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): void {
  const { battle } = ctx;
  const out = enemy.vol.pivot;
  enemy.vol.pivot = null;
  if (out && enemy.mon.hp > 0 && battle.kind === 'trainer') {
    const spare = battle.enemyTeam.findIndex((m, i) => i !== battle.enemyIndex && m.hp > 0);
    if (spare >= 0) {
      const carried = out.baton ? { ...battle.enemyStages } : null;
      swapInEnemy(ctx, spare, events);
      if (carried) battle.enemyStages = carried;
    }
  }
  const mine = player.vol.pivot;
  player.vol.pivot = null;
  if (mine && player.mon.hp > 0 && !battle.needsSwitch && ctx.party.some((m, i) => i !== battle.activeIndex && m.hp > 0)) {
    battle.batonStages = mine.baton ? { ...battle.playerStages } : null;
    battle.needsSwitch = true;
  }
}

/** Disable, Encore, Torment, Taunt, Heal Block and Spite take hold of the target. */
function disrupt(ctx: BattleContext, user: Combatant, target: Combatant, kind: NonNullable<Move['effects']['disrupt']>, events: BattleEvent[]): boolean {
  const last = target.vol.lastMove;
  const fail = () => {
    events.push({ type: 'fail', side: user.side });
    return false;
  };
  if (kind !== 'spite' && kind !== 'throatChop' && user.side !== target.side && (targetAbility(ctx, user, target) === 'aroma-veil' || (!moveIgnoresAbility && allyAbility(ctx, target) === 'aroma-veil'))) {
    announce(target, 'aroma-veil', events);
    return fail();
  }
  switch (kind) {
    case 'disable':
      if (!last || target.vol.disabled) return fail();
      target.vol.disabled = { moveId: last, turns: 4 };
      break;
    case 'encore':
      if (!last || target.vol.locked || target.vol.charging) return fail();
      target.vol.locked = { moveId: last, turns: 3 };
      break;
    case 'torment':
      if (target.vol.torment) return fail();
      target.vol.torment = true;
      break;
    case 'taunt':
      if (target.vol.taunt > 0) return fail();
      target.vol.taunt = 3;
      if (Held.triggerOnce(ctx, target, 'mentalHerb', events as Held.HeldEvent[])) {
        target.vol.taunt = 0;
        return true;
      }
      break;
    case 'throatChop':
      target.vol.throat = 2;
      break;
    case 'healBlock':
      if (target.vol.healBlock > 0) return fail();
      target.vol.healBlock = 5;
      break;
    case 'spite': {
      const slot = target.mon.moves.find((m) => m.id === last);
      if (!slot || slot.pp <= 0) return fail();
      slot.pp = Math.max(0, slot.pp - 4);
      break;
    }
  }
  events.push({ type: 'disrupted', side: target.side, kind, moveId: last });
  return true;
}

/** End of turn for the new battle states: Ingrain and Aqua Ring, Wish, and the Disable / Taunt / Heal Block clocks. */
/** Future Sight and Doom Desire come due. */
function tickDelayed(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): void {
  const list = ctx.battle.extra.delayed;
  for (const d of [...list]) {
    d.turns -= 1;
    if (d.turns > 0) continue;
    list.splice(list.indexOf(d), 1);
    const target = d.side === 'player' ? player : enemy;
    if (target.mon.hp <= 0) continue;
    const move = ctx.content.moves.get(d.moveId);
    const userMon = (d.userSide === 'player' ? ctx.party : ctx.battle.enemyTeam).find((m) => m.uid === d.userUid);
    if (!move || !userMon) continue;
    const active = d.userSide === 'player' ? player : enemy;
    const user: Combatant = active.mon === userMon ? active : { side: d.userSide, mon: userMon, stages: freshStages(), vol: freshVolatile(), flinched: false, protected: false };
    events.push({ type: 'selfState', side: target.side, state: 'foreseen' });
    runMove(ctx, user, target, { ...move, accuracy: null, effects: { ...move.effects, delayed: undefined } }, true, events);
  }
}

function endTurnStates(ctx: BattleContext, player: Combatant, enemy: Combatant, events: BattleEvent[]): void {
  tickDelayed(ctx, player, enemy, events);
  for (const c of [player, enemy]) endTurnMon(ctx, c, c === player ? enemy : player, events);
  endTurnField(ctx, events);
  recordFaints(ctx, player, enemy, events);
}

/** One Pokémon's end-of-turn states (Nightmare, Curse, Wish, Yawn, Perish Song...). */
function endTurnMon(ctx: BattleContext, c: Combatant, foe: Combatant, events: BattleEvent[]): void {
  {
    if (c.mon.hp <= 0) return;
    const max = calcStats(ctx.content, c.mon).hp;
    if (c.vol.nightmare && c.mon.status?.id !== 'slp') c.vol.nightmare = false;
    if (c.vol.nightmare) abilityHurt(ctx, c, Math.max(1, Math.floor(max / 4)), events);
    if (c.vol.cursed) abilityHurt(ctx, c, Math.max(1, Math.floor(max / 4)), events);
    if (c.vol.saltCure) {
      const t = battleTypes(ctx.content, ctx.battle, c.mon);
      abilityHurt(ctx, c, Math.max(1, Math.floor(max / (t.includes('water') || t.includes('steel') ? 4 : 8))), events);
    }
    if (c.vol.octolock) {
      applyStageChange(ctx, c, 'def', -1, events);
      applyStageChange(ctx, c, 'spd', -1, events);
    }
    if (c.vol.syrup > 0) {
      c.vol.syrup -= 1;
      applyStageChange(ctx, c, 'spe', -1, events);
    }
    if (c.vol.telekinesis > 0) c.vol.telekinesis -= 1;
    if (c.vol.throat > 0) c.vol.throat -= 1;
    c.vol.roost = false;
    if (c.vol.uproar > 0) c.vol.uproar -= 1;
    c.vol.shield = null;
    c.vol.coating = false;
    c.vol.snatching = false;
    c.vol.powdered = false;
    c.vol.beakHeat = false;
    c.vol.electrified = false;
    if (c.mon.hp <= 0) return;
    const heal = (amount: number) => {
      if (c.vol.healBlock > 0) return;
      const gain = Math.min(max - c.mon.hp, Math.max(1, amount));
      if (gain > 0) {
        c.mon.hp += gain;
        events.push({ type: 'heal', side: c.side, amount: gain, hpAfter: c.mon.hp });
      }
    };
    if (c.vol.regen) heal(Math.floor(max / 16));
    if (c.vol.wish) {
      c.vol.wish.turns -= 1;
      if (c.vol.wish.turns <= 0) {
        heal(c.vol.wish.amount);
        c.vol.wish = null;
      }
    }
    if (c.vol.disabled && --c.vol.disabled.turns <= 0) c.vol.disabled = null;
    if (c.vol.taunt > 0) c.vol.taunt -= 1;
    if (c.vol.healBlock > 0) c.vol.healBlock -= 1;
    if (c.vol.magnetRise > 0) c.vol.magnetRise -= 1;
    if (abilityIn(ctx, c) === 'moody') {
      // Moody: one random stat up two stages, another down one (maxed or floored stats are skipped).
      const stats = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
      const up = stats.filter((st) => c.stages[st] < 6);
      const raised = up.length ? up[ctx.rng.int(0, up.length - 1)]! : null;
      const down = stats.filter((st) => st !== raised && c.stages[st] > -6);
      events.push({ type: 'ability', side: c.side, ability: 'moody' });
      if (raised) applyStageChange(ctx, c, raised, 2, events);
      if (down.length) applyStageChange(ctx, c, down[ctx.rng.int(0, down.length - 1)]!, -1, events);
    }
    if (c.vol.yawn > 0 && --c.vol.yawn === 0 && !c.mon.status) {
      tryInflictStatus(ctx, foe, c, 'slp', undefined, events, false);
    }
    if (c.vol.perish > 0) {
      c.vol.perish -= 1;
      events.push({ type: 'perish', side: c.side, count: c.vol.perish });
      if (c.vol.perish === 0) c.mon.hp = 0;
    }
  }
}

/** Field-wide counters at the end of a turn (Wonder Room, Gravity, Trick Room...). */
function endTurnField(ctx: BattleContext, events: BattleEvent[]): void {
  ctx.battle.extra.ionDeluge = false;
  if (ctx.battle.extra.wonderRoom > 0 && --ctx.battle.extra.wonderRoom === 0) events.push({ type: 'fieldEnd', field: 'wonderRoom' });
  Held.tickItemRooms(ctx.battle);
  for (const key of ['gravity', 'trickRoom', 'waterSport', 'mudSport'] as const) {
    if (ctx.battle.field[key] > 0 && --ctx.battle.field[key] === 0) events.push({ type: 'fieldEnd', field: key });
  }
}

const HAZARDS = ['spikes', 'toxicSpikes', 'stealthRock', 'stickyWeb'] as const;
const SIDE_TURNS: Partial<Record<SideMove, number>> = { reflect: 5, lightScreen: 5, auroraVeil: 5, tailwind: 4, safeguard: 5, mist: 5, luckyChant: 5 };
const otherSide = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

/** Sets up a screen, Tailwind, Safeguard, Mist or Lucky Chant on the user's side, or an entry hazard on the foe's. Returns false if it failed. */
function applySideMove(ctx: BattleContext, user: Combatant, move: SideMove, events: BattleEvent[]): boolean {
  const side = (HAZARDS as readonly string[]).includes(move) ? otherSide(user.side) : user.side;
  const fx = ctx.battle.sideEffects[side];
  switch (move) {
    case 'spikes':
      if (fx.spikes >= 3) return false;
      fx.spikes += 1;
      break;
    case 'toxicSpikes':
      if (fx.toxicSpikes >= 2) return false;
      fx.toxicSpikes += 1;
      break;
    case 'stealthRock':
    case 'stickyWeb':
      if (fx[move]) return false;
      fx[move] = true;
      break;
    case 'auroraVeil': {
      const w = weatherNow(ctx);
      if (fx.auroraVeil > 0 || (w !== 'snow' && w !== 'hail')) return false;
      fx.auroraVeil = Held.lightClayTurns(ctx, user) ?? SIDE_TURNS.auroraVeil!;
      break;
    }
    default:
      if (fx[move] > 0) return false;
      fx[move] = (move === 'reflect' || move === 'lightScreen' ? Held.lightClayTurns(ctx, user) : null) ?? SIDE_TURNS[move]!;
  }
  events.push({ type: 'sideEffect', side, effect: move, on: true });
  return true;
}

/** Rapid Spin, Defog, Tidy Up: sweeps entry hazards away. Returns true if there was anything to clear. */
function clearHazards(ctx: BattleContext, user: Combatant, which: 'self' | 'both', events: BattleEvent[]): boolean {
  let cleared = false;
  for (const side of which === 'self' ? [user.side] : (['player', 'enemy'] as const)) {
    const fx = ctx.battle.sideEffects[side];
    if (fx.spikes || fx.toxicSpikes || fx.stealthRock || fx.stickyWeb) {
      fx.spikes = 0;
      fx.toxicSpikes = 0;
      fx.stealthRock = false;
      fx.stickyWeb = false;
      cleared = true;
      events.push({ type: 'sideEffect', side, effect: 'hazards', on: false });
    }
  }
  return cleared;
}


const TERRAIN_TYPE: Record<Terrain, TypeName> = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };

/** Moves whose type comes from the terrain, the Tera type, the user's form or a held Plate / Drive. Null for ordinary moves. */
function specialMoveType(ctx: BattleContext, user: Combatant, move: Move, _weather: Weather | null): TypeName | null {
  const fx = move.effects;
  if (fx.terrainPulse) return ctx.battle.terrain ? TERRAIN_TYPE[ctx.battle.terrain.id] : 'normal';
  if (fx.teraBlast) return ctx.battle.transform.teraTypes[user.mon.uid] ?? move.type;
  if (fx.formType) {
    const id = user.mon.speciesId;
    switch (fx.formType) {
      case 'tauros': return id.includes('blaze') ? 'fire' : id.includes('aqua') ? 'water' : id.includes('combat') ? 'fighting' : 'normal';
      case 'oricorio': return id.includes('pom-pom') ? 'electric' : id.includes('pau') ? 'psychic' : id.includes('sensu') ? 'ghost' : 'fire';
      case 'ogerpon': return id.includes('wellspring') ? 'water' : id.includes('hearthflame') ? 'fire' : id.includes('cornerstone') ? 'rock' : 'grass';
      case 'morpeko': return id.includes('hangry') ? 'dark' : 'electric';
    }
  }
  if (fx.hiddenPower) {
    const types = TYPE_NAMES.filter((t) => t !== 'normal' && t !== 'fairy');
    let h = 0;
    for (const ch of `hidden-power:${user.mon.uid}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return types[h % types.length]!;
  }
  if (fx.itemMove === 'naturalGift') {
    const berry = firstItem(Held.effectiveHeld(ctx, user.mon), (i) => i in BERRY_TYPE);
    return berry ? BERRY_TYPE[berry]! : null;
  }
  if (fx.itemMove === 'itemType') {
    for (const { hook } of Held.hooksOf(ctx, user.mon, user.side)) {
      if (hook.hook === 'drive') return hook.type;
      if (hook.hook === 'typePower' && hook.types.length === 1 && move.id === 'judgment') return hook.types[0]!;
    }
  }
  return null;
}

/** Heals a Pokémon by a share of its max HP (Heal Pulse, Present). Returns false if it was already full. */
function healMon(ctx: BattleContext, c: Combatant, fraction: number, events: BattleEvent[]): boolean {
  const max = calcStats(ctx.content, c.mon).hp;
  const gain = Math.min(max - c.mon.hp, Math.max(1, Math.floor(max * fraction)));
  if (gain <= 0 || c.mon.hp <= 0 || c.vol.healBlock > 0 || (c.side === 'enemy' && enemyHealingBlocked(ctx.perks))) {
    events.push({ type: 'fail', side: c.side });
    return false;
  }
  c.mon.hp += gain;
  events.push({ type: 'heal', side: c.side, amount: gain, hpAfter: c.mon.hp });
  return true;
}

function payHp(ctx: BattleContext, c: Combatant, amount: number, events: BattleEvent[]): void {
  const lost = Math.min(amount, c.mon.hp);
  c.mon.hp -= lost;
  events.push({ type: 'damage', side: c.side, amount: lost, hpAfter: c.mon.hp, effectiveness: 1, crit: false });
}

/** The user faints on purpose (Memento, Healing Wish, Final Gambit). */
function faintSelf(ctx: BattleContext, user: Combatant, events: BattleEvent[]): void {
  user.mon.hp = 0;
  events.push({ type: 'selfKo', side: user.side });
  ctx.doubleKoLoser = user.side;
}

const FLING_POWER: Record<string, number> = { 'iron-ball': 130, 'hard-stone': 100, 'rare-bone': 100, 'deep-sea-tooth': 90, 'grip-claw': 90, 'thick-club': 90, 'razor-fang': 30, 'light-ball': 30, 'flame-orb': 30, 'toxic-orb': 30 };
const FLING_STATUS: Record<string, StatusId> = { 'light-ball': 'par', 'flame-orb': 'brn', 'toxic-orb': 'psn' };
let flungItem: string | null = null;

/** The first item a Pokémon holds, in a fixed order, so moves that take or toss an item are deterministic. */
function firstItem(items: Record<string, number>, only?: (id: string) => boolean): string | null {
  return Object.keys(items).filter((id) => (items[id] ?? 0) > 0 && (!only || only(id))).sort()[0] ?? null;
}
/** The type and power-80 hit Natural Gift gets from each Berry. */
const BERRY_TYPE: Record<string, TypeName> = Object.fromEntries(
  Object.entries({
    fire: 'cheri bluk watmel occa', water: 'chesto nanab durin passho', electric: 'pecha wepear belue wacan', grass: 'rawst pinap rindo', ice: 'aspear pomeg yache',
    fighting: 'leppa kelpsy chople', poison: 'oran qualot kebia', ground: 'persim hondew shuca', flying: 'lum grepa coba', psychic: 'sitrus tamato payapa',
    bug: 'figy cornn tanga', rock: 'wiki magost charti', ghost: 'mago rabuta kasib', dragon: 'aguav nomel haban', dark: 'iapapa spelon colbur', steel: 'razz pamtre babiri',
    normal: 'chilan', fairy: 'roseli',
  }).flatMap(([type, names]) => names.split(' ').map((n) => [`${n}-berry`, type as TypeName])),
);
const isBerry = (ctx: BattleContext, id: string): boolean => Boolean(ctx.content.catalog.get(id)?.family.startsWith('Berries'));

/** Moves that handle items before damage: Fling picks the item and its power. Returns false if the move fails. */
function preItemMove(ctx: BattleContext, user: Combatant, move: Move): boolean {
  if (move.effects.itemMove === 'naturalGift') {
    if (!firstItem(Held.effectiveHeld(ctx, user.mon), (i) => i in BERRY_TYPE)) return false;
    flingPower = 80;
  }
  if (move.effects.itemMove === 'fling') {
    flungItem = firstItem(Held.effectiveHeld(ctx, user.mon));
    if (!flungItem) return false;
    flingPower = FLING_POWER[flungItem] ?? 30;
  }
  return true;
}

/** Everything a damaging move does after it hit: item moves, cures, type loss, Final Gambit, Rage, Grudge and the shared states. */
function postHitExtras(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, landed: number, movedFirst: boolean, events: BattleEvent[]): void {
  const fx = move.effects;
  if (fx.rage) user.vol.raging = true;
  else user.vol.raging = false;
  if (landed <= 0) return;
  if (fx.formStorm && target.mon.hp > 0 && ctx.rng.chance(0.3)) {
    if (user.mon.speciesId.includes('therian')) applyStageChange(ctx, target, 'atk', -1, events, user);
    else applyStageChange(ctx, user, 'atk', 1, events);
  }
  if ((move.id === 'surf' || move.id === 'dive') && abilityIn(ctx, user) === 'gulp-missile' && user.mon.speciesId === 'cramorant') {
    swapForm(ctx, user, user.mon.hp * 2 > calcStats(ctx.content, user.mon).hp ? 'cramorant-gulping' : 'cramorant-gorging', events);
  }
  if (fx.cureTarget && target.mon.hp > 0 && target.mon.status?.id === fx.cureTarget) {
    target.mon.status = null;
    events.push({ type: 'cured', side: target.side });
  }
  if (fx.userFaint === 'finalGambit') faintSelf(ctx, user, events);
  if (fx.statusIfBoosted && target.mon.hp > 0 && Object.values(target.stages).some((v) => v > 0) && canGetStatus(ctx, user, target, fx.statusIfBoosted)) tryInflictStatus(ctx, user, target, fx.statusIfBoosted, undefined, events, false);
  if (fx.suppressIfMoved && target.mon.hp > 0 && movedFirst) {
    target.vol.abilityOverride = 'neutralized';
    events.push({ type: 'selfState', side: target.side, state: 'abilityChanged' });
  }
  if (fx.terrainSecondary && target.mon.hp > 0 && ctx.rng.chance(0.3)) {
    const t = ctx.battle.terrain?.id;
    if (t === 'misty') applyStageChange(ctx, target, 'spa', -1, events, user);
    else if (t === 'psychic') applyStageChange(ctx, target, 'spe', -1, events, user);
    else {
      const st: StatusId = t === 'grassy' ? 'slp' : 'par';
      if (canGetStatus(ctx, user, target, st)) tryInflictStatus(ctx, user, target, st, undefined, events, false);
    }
  }
  if (fx.typeEdit?.mode === 'lose' && fx.typeEdit.type && user.mon.hp > 0) {
    user.vol.typeList = battleTypes(ctx.content, ctx.battle, user.mon).filter((t) => t !== fx.typeEdit!.type);
    events.push({ type: 'selfState', side: user.side, state: 'typeChanged' });
  }
  if (fx.itemMove && user.mon.hp > 0) {
    const theirs = Held.effectiveHeld(ctx, target.mon);
    switch (fx.itemMove) {
      case 'steal': {
        const id = firstItem(theirs);
        if (id && Object.keys(Held.effectiveHeld(ctx, user.mon)).length === 0) {
          Held.takeItem(ctx, target.mon, id, user.mon);
          events.push({ type: 'selfState', side: user.side, state: 'stole' });
        }
        break;
      }
      case 'knock': {
        const id = firstItem(theirs);
        if (id) {
          Held.takeItem(ctx, target.mon, id);
          events.push({ type: 'selfState', side: target.side, state: 'knocked' });
        }
        break;
      }
      case 'burnBerry':
      case 'pluckBerry': {
        const id = firstItem(theirs, (i) => isBerry(ctx, i));
        if (id) {
          Held.takeItem(ctx, target.mon, id);
          events.push({ type: 'selfState', side: target.side, state: 'knocked' });
        }
        break;
      }
      case 'naturalGift': {
        const berry = firstItem(Held.effectiveHeld(ctx, user.mon), (i) => i in BERRY_TYPE);
        if (berry) Held.takeItem(ctx, user.mon, berry);
        break;
      }
      case 'fling':
        if (flungItem) {
          Held.takeItem(ctx, user.mon, flungItem);
          const st = FLING_STATUS[flungItem];
          if (st && target.mon.hp > 0 && canGetStatus(ctx, user, target, st)) tryInflictStatus(ctx, user, target, st, undefined, events, false);
          flungItem = null;
        }
        break;
    }
  }
  if (target.mon.hp <= 0 && target.vol.grudge) {
    const slot = user.mon.moves.find((m) => m.id === move.id);
    if (slot) slot.pp = 0;
  }
  applyStateEffects(ctx, user, target, move, events);
}

const STATE_KEYS = ['nightmare', 'curse', 'imprison', 'fairyLock', 'snatch', 'magicCoat', 'shield', 'powder', 'confuseBoth', 'identify', 'tarShot', 'electrify', 'telekinesis', 'octolock', 'grudge', 'copyAbility'] as const;

/** Setting up lasting states: used by status moves and by damaging moves that also set one. Returns false when a status move fails. */
function applyStateEffects(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, events: BattleEvent[]): boolean {
  const fx = move.effects;
  const state = (c: Combatant, name: string) => events.push({ type: 'selfState', side: c.side, state: name });
  const { content, rng, battle } = ctx;
  if (fx.nightmare) {
    if (target.vol.nightmare || target.mon.status?.id !== 'slp') return false;
    target.vol.nightmare = true;
    state(target, 'nightmare');
  }
  if (fx.curse) {
    if (battleTypes(content, battle, user.mon).includes('ghost')) {
      const cost = Math.floor(calcStats(content, user.mon).hp / 2);
      if (target.vol.cursed || user.mon.hp <= cost) return false;
      payHp(ctx, user, cost, events);
      target.vol.cursed = true;
      state(target, 'cursed');
    } else {
      applyStageChange(ctx, user, 'spe', -1, events);
      applyStageChange(ctx, user, 'atk', 1, events);
      applyStageChange(ctx, user, 'def', 1, events);
    }
  }
  if (fx.imprison) {
    if (user.vol.imprison) return false;
    user.vol.imprison = true;
    state(user, 'imprison');
  }
  if (fx.fairyLock) {
    battle.extra.fairyLock = battle.turn + 1;
    state(user, 'fairyLock');
  }
  if (fx.snatch) {
    user.vol.snatching = true;
    state(user, 'snatch');
  }
  if (fx.magicCoat) {
    user.vol.coating = true;
    state(user, 'magicCoat');
  }
  if (fx.shield) {
    if (fx.shield === 'damage' && user.vol.turnsOut > 0) return false;
    user.vol.shield = fx.shield;
    events.push({ type: 'protect', side: user.side });
  }
  if (fx.powder) {
    target.vol.powdered = true;
    state(target, 'powder');
  }
  if (fx.confuseBoth) {
    for (const c of [user, target]) {
      if (c.vol.confusion === 0 && c.mon.hp > 0 && abilityIn(ctx, c) !== 'own-tempo') {
        c.vol.confusion = rng.int(2, 5);
        events.push({ type: 'confused', side: c.side });
      }
    }
  }
  if (fx.identify) {
    target.vol.identified = fx.identify;
    state(target, 'identified');
  }
  if (fx.tarShot) {
    if (target.vol.tarred) return false;
    target.vol.tarred = true;
    state(target, 'tarred');
    applyStageChange(ctx, target, 'spe', -1, events, user);
  }
  if (fx.electrify === 'field') {
    battle.extra.ionDeluge = true;
    state(user, 'ionDeluge');
  } else if (fx.electrify === 'target') {
    if (target.vol.electrified) return false;
    target.vol.electrified = true;
    state(target, 'electrified');
  }
  if (fx.telekinesis) {
    if (target.vol.telekinesis > 0) return false;
    target.vol.telekinesis = 3;
    state(target, 'telekinesis');
  }
  if (fx.octolock) {
    if (target.vol.octolock) return false;
    target.vol.octolock = true;
    target.vol.trapped = true;
    state(target, 'trapped');
  }
  if (fx.syrupBomb && target.mon.hp > 0) {
    target.vol.syrup = 3;
    state(target, 'syrup');
  }
  if (fx.saltCure && target.mon.hp > 0 && !target.vol.saltCure) {
    target.vol.saltCure = true;
    state(target, 'saltCure');
  }
  if (fx.glaiveRush) user.vol.exposed = true;
  if (fx.beakBlast) user.vol.beakHeat = false;
  if (fx.grudge) {
    user.vol.grudge = true;
    state(user, 'grudge');
  }
  if (fx.copyAbility) {
    const theirs = abilityIn(ctx, target);
    if (!theirs || UNTRACEABLE.has(theirs)) return false;
    user.vol.abilityOverride = theirs;
    state(user, 'abilityChanged');
  }
  return true;
}

/** Healing Wish / Lunar Dance and a passed Substitute take effect on the Pokémon that comes in. */
function enterExtras(ctx: BattleContext, c: Combatant, events: BattleEvent[]): void {
  const ex = ctx.battle.extra;
  const wish = ex.healingWish[c.side];
  if (wish !== 'none' && c.mon.hp > 0) {
    ex.healingWish[c.side] = 'none';
    const max = calcStats(ctx.content, c.mon).hp;
    const gain = max - c.mon.hp;
    c.mon.hp = max;
    c.mon.status = null;
    if (wish === 'dance') for (const m of c.mon.moves) m.pp = content_maxPp(ctx, m);
    events.push({ type: 'heal', side: c.side, amount: gain, hpAfter: c.mon.hp });
  }
  if (ex.passSub[c.side] > 0 && c.mon.hp > 0) {
    c.vol.substitute = ex.passSub[c.side];
    ex.passSub[c.side] = 0;
    events.push({ type: 'selfState', side: c.side, state: 'substitute' });
  }
}

function content_maxPp(ctx: BattleContext, slot: { id: string; pp: number; ppUps?: number }): number {
  const base = ctx.content.moves.get(slot.id)?.pp ?? slot.pp;
  return Math.floor(base * (1 + 0.2 * (slot.ppUps ?? 0)));
}

/** A Pokémon coming in meets the hazards its side has: Stealth Rock, Spikes, Toxic Spikes, Sticky Web. */
function applyHazards(ctx: BattleContext, c: Combatant, events: BattleEvent[]): void {
  const fx = ctx.battle.sideEffects[c.side];
  if (c.mon.hp <= 0 || !(fx.spikes || fx.toxicSpikes || fx.stealthRock || fx.stickyWeb)) return;
  const max = calcStats(ctx.content, c.mon).hp;
  const types = getSpecies(ctx.content, c.mon.speciesId).types;
  const grounded = isGrounded(ctx, c);
  const hurt = (hazard: 'spikes' | 'stealthRock', amount: number) => {
    if (c.mon.hp <= 0 || abilityIn(ctx, c) === 'magic-guard') return;
    const { lost, lastStand } = takeHp(ctx, c, Math.max(1, amount));
    events.push({ type: 'hazard', side: c.side, hazard, amount: lost, hpAfter: c.mon.hp });
    if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
  };
  if (fx.stealthRock) hurt('stealthRock', Math.floor((max / 8) * typeEffectiveness(ctx.content.typeChart, 'rock', types)));
  if (fx.spikes && grounded) hurt('spikes', Math.floor(max / ([8, 6, 4][fx.spikes - 1] ?? 4)));
  if (fx.toxicSpikes && grounded && c.mon.hp > 0) {
    if (types.includes('poison')) {
      fx.toxicSpikes = 0;
      events.push({ type: 'sideEffect', side: c.side, effect: 'toxicSpikes', on: false });
    } else if (canGetStatus(ctx, c, c, 'psn')) {
      tryInflictStatus(ctx, c, c, 'psn', undefined, events, false);
    }
  }
  if (fx.stickyWeb && grounded && c.mon.hp > 0) {
    events.push({ type: 'hazard', side: c.side, hazard: 'stickyWeb', amount: 0, hpAfter: c.mon.hp });
    applyStageChange(ctx, c, 'spe', -1, events);
  }
}

/** End of turn: screens, Tailwind, Safeguard, Mist and Lucky Chant count down and wear off. */
function tickSides(ctx: BattleContext, events: BattleEvent[]): void {
  for (const side of ['player', 'enemy'] as const) {
    const fx = ctx.battle.sideEffects[side];
    for (const key of Object.keys(SIDE_TURNS) as SideMove[]) {
      const turns = fx[key as keyof typeof fx] as number;
      if (turns > 0) {
        (fx[key as keyof typeof fx] as number) = turns - 1;
        if (turns - 1 === 0) events.push({ type: 'sideEffect', side, effect: key, on: false });
      }
    }
  }
}

function applyStatusMove(ctx: BattleContext, user: Combatant, target: Combatant, move: Move, events: BattleEvent[]): void {
  const { content } = ctx;
  const fx = move.effects;
  let didSomething = false;
  const stat5 = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as const;
  if (fx.noop || (fx.oppositeGender && !oppositeGender(content, user.mon, target.mon))) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (fx.toxic) {
    if (!canGetStatus(ctx, user, target, 'psn', move)) return void events.push({ type: 'fail', side: user.side });
    tryInflictStatus(ctx, user, target, 'psn', move, events, true);
    if (target.mon.status?.id === 'psn') target.mon.status.bad = true;
    return;
  }
  if (fx.roost) {
    if (healMon(ctx, user, 0.5, events)) user.vol.roost = true;
    return;
  }
  if (fx.wonderRoom) {
    const ex = ctx.battle.extra;
    if (ex.wonderRoom > 0) {
      ex.wonderRoom = 0;
      events.push({ type: 'fieldEnd', field: 'wonderRoom' });
    } else {
      ex.wonderRoom = 5;
      events.push({ type: 'fieldStart', field: 'wonderRoom' });
    }
    return;
  }
  if (fx.attract) {
    if (target.vol.infatuated || !oppositeGender(content, user.mon, target.mon) || abilityIn(ctx, target) === 'oblivious' || Held.statusBlocked(ctx, target, 'infatuation')) {
      if (abilityIn(ctx, target) === 'oblivious') announce(target, 'oblivious', events);
      return void events.push({ type: 'fail', side: user.side });
    }
    target.vol.infatuated = true;
    events.push({ type: 'selfState', side: target.side, state: 'infatuated' });
    return;
  }
  if (fx.transform) {
    if (!transformInto(ctx, user, target, events)) events.push({ type: 'fail', side: user.side });
    return;
  }
  if (fx.mimic) {
    const copied = target.vol.lastMove;
    const slot = user.mon.moves.findIndex((m) => m.id === move.id);
    const blocked = new Set([ctx.content.ruleset.struggleMoveId, 'mimic', 'transform', 'sketch', 'chatter', 'metronome']);
    if (!copied || slot < 0 || blocked.has(copied) || user.mon.moves.some((m) => m.id === copied) || !ctx.content.moves.has(copied) || ctx.battle.extra.mimic[user.mon.uid]) {
      return void events.push({ type: 'fail', side: user.side });
    }
    ctx.battle.extra.mimic[user.mon.uid] = { kind: 'mimic', slot, moves: user.mon.moves.map((m) => ({ ...m })) };
    user.mon.moves[slot] = { id: copied, pp: Math.min(5, ctx.content.moves.get(copied)!.pp) };
    events.push({ type: 'selfState', side: user.side, state: 'mimicked' });
    return;
  }
  if (fx.needsStatus && target.mon.status?.id !== fx.needsStatus) return void events.push({ type: 'fail', side: user.side });
  if (fx.hpCost) {
    const max = calcStats(content, user.mon).hp;
    const cost = Math.floor(max * fx.hpCost.fraction);
    const useful = fx.hpCost.stats.some((c) => (c.stages > 0 ? user.stages[c.stat] < 6 : user.stages[c.stat] > -6));
    if (user.mon.hp <= cost || !useful || (fx.hpCost.trapSelf && user.vol.trapped)) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    payHp(ctx, user, cost, events);
    for (const c of fx.hpCost.stats) applyStageChange(ctx, user, c.stat, c.stages, events);
    if (fx.hpCost.trapSelf) {
      user.vol.trapped = true;
      events.push({ type: 'selfState', side: user.side, state: 'trapped' });
    }
    return;
  }
  if (fx.randomStat) {
    const open = (['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as const).filter((st) => user.stages[st] < 6);
    if (!open.length) events.push({ type: 'fail', side: user.side });
    else applyStageChange(ctx, user, open[ctx.rng.int(0, open.length - 1)]!, fx.randomStat, events);
    return;
  }
  if (fx.healTarget) {
    const grassyBoost = move.id === 'floral-healing' && ctx.battle.terrain?.id === 'grassy';
    healMon(ctx, target, grassyBoost ? 2 / 3 : fx.healTarget, events);
    return;
  }
  if (fx.fieldBoost) {
    const fb = fx.fieldBoost;
    const hit = fb.types
      ? [user, target].filter((c) => c.mon.hp > 0 && battleTypes(content, ctx.battle, c.mon).some((t) => fb.types!.includes(t)))
      : [user].filter((c) => { const a = abilityIn(ctx, c); return a !== null && fb.abilities!.includes(a); });
    if (!hit.length) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    for (const c of hit) for (const ch of fb.stats) applyStageChange(ctx, c, ch.stat, ch.stages, events);
    return;
  }
  if (fx.statOverride) {
    const mine = statsOf(ctx, user);
    const theirs = statsOf(ctx, target);
    const o = user.vol.statOverride;
    switch (fx.statOverride) {
      case 'swapAtkDef':
        if ('atk' in o && 'def' in o) user.vol.statOverride = {};
        else user.vol.statOverride = { ...o, atk: mine.def, def: mine.atk };
        break;
      case 'swapSpe':
        user.vol.statOverride = { ...o, spe: theirs.spe };
        target.vol.statOverride = { ...target.vol.statOverride, spe: mine.spe };
        break;
      case 'splitDef': {
        const [d, sd] = [Math.floor((mine.def + theirs.def) / 2), Math.floor((mine.spd + theirs.spd) / 2)];
        user.vol.statOverride = { ...o, def: d, spd: sd };
        target.vol.statOverride = { ...target.vol.statOverride, def: d, spd: sd };
        break;
      }
      case 'splitAtk': {
        const [a, sa] = [Math.floor((mine.atk + theirs.atk) / 2), Math.floor((mine.spa + theirs.spa) / 2)];
        user.vol.statOverride = { ...o, atk: a, spa: sa };
        target.vol.statOverride = { ...target.vol.statOverride, atk: a, spa: sa };
        break;
      }
    }
    events.push({ type: 'selfState', side: user.side, state: 'statsChanged' });
    return;
  }
  if (fx.electricCharge) {
    user.vol.charged = true;
    events.push({ type: 'selfState', side: user.side, state: 'charged' });
    applyStageChange(ctx, user, 'spd', 1, events);
    return;
  }
  if (fx.userFaint === 'memento') {
    if (target.mon.hp <= 0) return void events.push({ type: 'fail', side: user.side });
    applyStageChange(ctx, target, 'atk', -2, events, user);
    applyStageChange(ctx, target, 'spa', -2, events, user);
    faintSelf(ctx, user, events);
    return;
  }
  if (fx.userFaint === 'healingWish' || fx.userFaint === 'lunarDance') {
    const team = user.side === 'player' ? ctx.party : ctx.battle.enemyTeam;
    if (!team.some((m) => m !== user.mon && m.hp > 0) || (user.side === 'enemy' && ctx.battle.kind !== 'trainer')) return void events.push({ type: 'fail', side: user.side });
    ctx.battle.extra.healingWish[user.side] = fx.userFaint === 'lunarDance' ? 'dance' : 'wish';
    faintSelf(ctx, user, events);
    return;
  }
  if (fx.revivalBlessing) {
    const team = user.side === 'player' ? ctx.party : ctx.battle.enemyTeam;
    const down = team.find((m) => m.hp <= 0);
    if (!down) return void events.push({ type: 'fail', side: user.side });
    down.hp = Math.max(1, Math.floor(calcStats(content, down).hp / 2));
    events.push({ type: 'selfState', side: user.side, state: 'revived' });
    return;
  }
  if (fx.shedTail) {
    const cost = Math.floor(calcStats(content, user.mon).hp / 2);
    const team = user.side === 'player' ? ctx.party : ctx.battle.enemyTeam;
    if (user.vol.substitute > 0 || user.mon.hp <= cost || !team.some((m) => m !== user.mon && m.hp > 0) || (user.side === 'enemy' && ctx.battle.kind !== 'trainer')) return void events.push({ type: 'fail', side: user.side });
    payHp(ctx, user, cost, events);
    ctx.battle.extra.passSub[user.side] = cost;
    user.vol.pivot = { baton: false };
    events.push({ type: 'selfState', side: user.side, state: 'substitute' });
    return;
  }
  if (fx.typeEdit) {
    const te = fx.typeEdit;
    const mine = battleTypes(content, ctx.battle, user.mon);
    if (te.mode === 'reflect') {
      user.vol.typeList = [...battleTypes(content, ctx.battle, target.mon)];
      events.push({ type: 'selfState', side: user.side, state: 'typeChanged' });
    } else if (te.mode === 'add' && te.type) {
      const theirs = battleTypes(content, ctx.battle, target.mon);
      if (theirs.includes(te.type)) return void events.push({ type: 'fail', side: user.side });
      target.vol.typeList = [...theirs, te.type];
      events.push({ type: 'selfState', side: target.side, state: 'typeChanged' });
    } else if (te.mode === 'resist') {
      const last = target.vol.lastMove ? content.moves.get(target.vol.lastMove) : undefined;
      const pick = last ? TYPE_NAMES.find((t) => !mine.includes(t) && typeEffectiveness(content.typeChart, last.type, [t]) < 1) : undefined;
      if (!pick) return void events.push({ type: 'fail', side: user.side });
      user.vol.typeShift = pick;
      user.vol.typeList = null;
      events.push({ type: 'selfState', side: user.side, state: 'typeChanged' });
    }
    return;
  }
  if (fx.itemMove) {
    const mineI = Held.effectiveHeld(ctx, user.mon);
    const theirsI = Held.effectiveHeld(ctx, target.mon);
    const itemFail = () => void events.push({ type: 'fail', side: user.side });
    switch (fx.itemMove) {
      case 'stuffCheeks': {
        if (!Held.forceEatBerry(ctx, user, events as Held.HeldEvent[])) return itemFail();
        applyStageChange(ctx, user, 'def', 2, events);
        return;
      }
      case 'teatime': {
        const both = activeCombatants(ctx);
        let any = false;
        for (const c of [both.player, both.enemy]) if (c.mon.hp > 0 && Held.forceEatBerry(ctx, c, events as Held.HeldEvent[])) any = true;
        if (!any) itemFail();
        return;
      }
      case 'swap': {
        const a = Held.carriedItems(ctx, user.mon);
        const b = Held.carriedItems(ctx, target.mon);
        if (!Object.keys(a).length && !Object.keys(b).length) return itemFail();
        for (const [id, n] of Object.entries(a)) for (let i = 0; i < n; i++) Held.takeItem(ctx, user.mon, id, target.mon);
        for (const [id, n] of Object.entries(b)) for (let i = 0; i < n; i++) Held.takeItem(ctx, target.mon, id, user.mon);
        events.push({ type: 'selfState', side: user.side, state: 'swappedItems' });
        return;
      }
      case 'bestow': {
        const id = firstItem(mineI);
        if (!id || Object.keys(theirsI).length) return itemFail();
        Held.takeItem(ctx, user.mon, id, target.mon);
        events.push({ type: 'selfState', side: target.side, state: 'bestowed' });
        return;
      }
      case 'embargo':
        if ((ctx.battle.held?.embargo[target.mon.uid] ?? 0) > 0) return itemFail();
        Held.setEmbargo(ctx.battle, target.mon.uid, 5);
        events.push({ type: 'selfState', side: target.side, state: 'embargo' });
        return;
      case 'magicRoom':
        if ((ctx.battle.held?.magicRoom ?? 0) > 0) {
          Held.setMagicRoom(ctx.battle, 0);
          events.push({ type: 'fieldEnd', field: 'magicRoom' });
        } else {
          Held.setMagicRoom(ctx.battle, 5);
          events.push({ type: 'fieldStart', field: 'magicRoom' });
        }
        return;
      case 'remove': {
        const id = firstItem(theirsI);
        if (!id) return itemFail();
        Held.takeItem(ctx, target.mon, id);
        events.push({ type: 'selfState', side: target.side, state: 'knocked' });
        return;
      }
      case 'recycle': {
        const used = ctx.battle.held?.used[user.mon.uid] ?? {};
        const id = Object.keys(used).filter((k) => (used[k] ?? 0) > 0).pop();
        if (!id) return itemFail();
        used[id] = used[id]! - 1;
        events.push({ type: 'selfState', side: user.side, state: 'recycled' });
        return;
      }
    }
  }
  if (!applyStateEffects(ctx, user, target, move, events)) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (STATE_KEYS.some((k) => fx[k])) return;
  if (fx.substitute) {
    const cost = Math.floor(calcStats(content, user.mon).hp / 4);
    if (user.vol.substitute > 0 || user.mon.hp <= cost) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    user.mon.hp -= cost;
    user.vol.substitute = cost;
    events.push({ type: 'damage', side: user.side, amount: cost, hpAfter: user.mon.hp, effectiveness: 1, crit: false });
    events.push({ type: 'selfState', side: user.side, state: 'substitute' });
    return;
  }
  if (fx.destinyBond) {
    user.vol.destinyBond = true;
    events.push({ type: 'selfState', side: user.side, state: 'destinyBond' });
    return;
  }
  if (fx.perishSong) {
    let any = false;
    for (const c of [user, target]) {
      if (c.vol.perish === 0 && abilityIn(ctx, c) !== 'soundproof') {
        c.vol.perish = 4;
        any = true;
      }
    }
    events.push(any ? { type: 'selfState', side: user.side, state: 'perishSong' } : { type: 'fail', side: user.side });
    return;
  }
  if (fx.yawn) {
    if (target.vol.yawn > 0 || target.mon.status || !canGetStatus(ctx, user, target, 'slp')) events.push({ type: 'fail', side: user.side });
    else {
      target.vol.yawn = 2;
      events.push({ type: 'selfState', side: target.side, state: 'yawn' });
    }
    return;
  }
  if (fx.magnetRise) {
    if (user.vol.magnetRise > 0 || user.vol.regen === 'ingrain') events.push({ type: 'fail', side: user.side });
    else {
      user.vol.magnetRise = 5;
      events.push({ type: 'selfState', side: user.side, state: 'magnetRise' });
    }
    return;
  }
  if (fx.field) {
    const f = ctx.battle.field;
    if (fx.field === 'trickRoom' && f.trickRoom > 0) {
      f.trickRoom = 0;
      events.push({ type: 'fieldEnd', field: 'trickRoom' });
    } else if (f[fx.field] > 0) events.push({ type: 'fail', side: user.side });
    else {
      f[fx.field] = 5;
      events.push({ type: 'fieldStart', field: fx.field });
    }
    return;
  }
  if (fx.courtChange) {
    const se = ctx.battle.sideEffects;
    [se.player, se.enemy] = [se.enemy, se.player];
    events.push({ type: 'selfState', side: user.side, state: 'courtChange' });
    return;
  }
  if (fx.abilityChange) {
    const mine = abilityIn(ctx, user);
    const theirs = abilityIn(ctx, target);
    const fixed = (a: string | null) => !a || UNTRACEABLE.has(a) || a === 'wonder-guard';
    const kind = fx.abilityChange;
    const ok =
      kind === 'rolePlay' ? !fixed(theirs) && !fixed(mine)
      : kind === 'skillSwap' ? !fixed(theirs) && !fixed(mine)
      : kind === 'entrainment' ? !fixed(mine) && !fixed(theirs)
      : !fixed(theirs);
    if (!ok) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    if (kind === 'rolePlay') user.vol.abilityOverride = theirs;
    else if (kind === 'skillSwap') [user.vol.abilityOverride, target.vol.abilityOverride] = [theirs, mine];
    else if (kind === 'entrainment') target.vol.abilityOverride = mine;
    else target.vol.abilityOverride = kind === 'simple' ? 'simple' : kind === 'insomnia' ? 'insomnia' : 'none';
    events.push({ type: 'selfState', side: kind === 'rolePlay' ? user.side : target.side, state: 'abilityChanged' });
    return;
  }
  if (fx.setType) {
    const who = move.target === 'self' ? user : target;
    const t = fx.setType === 'terrain'
      ? ({ electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' } as const)[ctx.battle.terrain?.id ?? 'none' as never] ?? 'normal'
      : fx.setType === 'firstMove' ? content.moves.get(user.mon.moves[0]!.id)?.type ?? 'normal' : fx.setType;
    if (who.vol.typeShift === t) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    who.vol.typeShift = t;
    events.push({ type: 'selfState', side: who.side, state: 'typeChanged' });
    return;
  }
  if (fx.stockpile) {
    const v = user.vol;
    if (fx.stockpile === 'store') {
      if (v.stockpile >= 3) {
        events.push({ type: 'fail', side: user.side });
        return;
      }
      v.stockpile += 1;
      changeStage(ctx, user, user, 'def', 1, events);
      changeStage(ctx, user, user, 'spd', 1, events);
    } else {
      const n = v.stockpile;
      const max = calcStats(content, user.mon).hp;
      if (n === 0 || user.vol.healBlock > 0 || user.mon.hp >= max) {
        events.push({ type: 'fail', side: user.side });
        return;
      }
      const gain = Math.min(max - user.mon.hp, Math.floor(max * (n === 1 ? 0.25 : n === 2 ? 0.5 : 1)));
      user.mon.hp += gain;
      events.push({ type: 'heal', side: user.side, amount: gain, hpAfter: user.mon.hp });
      v.stockpile = 0;
      user.stages.def = Math.max(-6, user.stages.def - n);
      user.stages.spd = Math.max(-6, user.stages.spd - n);
    }
    return;
  }
  if (fx.strengthSap) {
    const gain = Math.min(calcStats(content, user.mon).hp - user.mon.hp, calcStats(content, target.mon).atk);
    if (user.vol.healBlock > 0 || gain <= 0) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    user.mon.hp += gain;
    events.push({ type: 'heal', side: user.side, amount: gain, hpAfter: user.mon.hp });
    changeStage(ctx, user, target, 'atk', -1, events);
    return;
  }
  if (fx.statusTrick) {
    if (fx.statusTrick === 'shift') {
      const st = user.mon.status;
      if (!st || !canGetStatus(ctx, user, target, st.id)) {
        events.push({ type: 'fail', side: user.side });
        return;
      }
      user.mon.status = null;
      events.push({ type: 'cured', side: user.side });
      tryInflictStatus(ctx, user, target, st.id, undefined, events, false);
    } else {
      const max = calcStats(content, user.mon).hp;
      if (!target.mon.status) {
        events.push({ type: 'fail', side: user.side });
        return;
      }
      target.mon.status = null;
      events.push({ type: 'cured', side: target.side });
      const gain = Math.min(max - user.mon.hp, Math.floor(max / 2));
      if (gain > 0 && user.vol.healBlock === 0) {
        user.mon.hp += gain;
        events.push({ type: 'heal', side: user.side, amount: gain, hpAfter: user.mon.hp });
      }
    }
    return;
  }
  if (fx.sketch) {
    const last = target.vol.lastMove;
    const slot = user.mon.moves.findIndex((m) => m.id === move.id);
    const learned = last ? content.moves.get(last) : undefined;
    if (!learned || slot < 0 || !learned.supported || learned.id === move.id || user.mon.moves.some((m) => m.id === learned.id)) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    user.mon.moves[slot] = { id: learned.id, pp: learned.pp };
    events.push({ type: 'selfState', side: user.side, state: 'sketched' });
    return;
  }
  if (fx.selfState) {
    const v = user.vol;
    const s = fx.selfState;
    if ((s === 'focusEnergy' && v.focusEnergy) || (s === 'laserFocus' && v.laserFocus) || ((s === 'ingrain' || s === 'aquaRing') && v.regen)) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    if (s === 'focusEnergy') v.focusEnergy = true;
    else if (s === 'laserFocus') v.laserFocus = true;
    else if (s === 'lockOn') v.sureHit = true;
    else if (s === 'endure') v.endure = true;
    else {
      v.regen = s;
      if (s === 'ingrain') v.trapped = true;
    }
    events.push({ type: 'selfState', side: user.side, state: s });
    return;
  }
  if (fx.rest) {
    const max = calcStats(content, user.mon).hp;
    if (user.mon.hp >= max || user.mon.status?.id === 'slp' || terrainBlocksStatus(ctx, user, 'slp')) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    user.mon.hp = max;
    user.mon.status = { id: 'slp', turns: 2 };
    events.push({ type: 'heal', side: user.side, amount: 0, hpAfter: max });
    events.push({ type: 'status', side: user.side, status: 'slp' });
    return;
  }
  if (fx.wish) {
    if (user.vol.wish) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    user.vol.wish = { turns: 2, amount: Math.floor(calcStats(content, user.mon).hp / 2) };
    events.push({ type: 'selfState', side: user.side, state: 'wish' });
    return;
  }
  if (fx.painSplit) {
    const avg = Math.floor((user.mon.hp + target.mon.hp) / 2);
    const cap = (c: Combatant) => Math.min(avg, calcStats(content, c.mon).hp);
    user.mon.hp = Math.max(1, cap(user));
    target.mon.hp = Math.max(1, cap(target));
    events.push({ type: 'heal', side: user.side, amount: 0, hpAfter: user.mon.hp });
    events.push({ type: 'heal', side: target.side, amount: 0, hpAfter: target.mon.hp });
    return;
  }
  if (fx.resetStages === 'both') {
    for (const c of [user, target]) for (const k of stat5) c.stages[k] = 0;
    events.push({ type: 'statsReset', side: user.side });
    return;
  }
  if (fx.stageTrick) {
    const t = fx.stageTrick;
    if (t === 'copy') for (const k of stat5) user.stages[k] = target.stages[k];
    else if (t === 'invert') for (const k of stat5) target.stages[k] = -target.stages[k];
    else {
      const keys = t === 'swapAll' ? stat5 : t === 'swapDefense' ? (['def', 'spd'] as const) : (['atk', 'spa'] as const);
      for (const k of keys) [user.stages[k], target.stages[k]] = [target.stages[k], user.stages[k]];
    }
    events.push({ type: 'statsReset', side: user.side });
    return;
  }
  if (fx.switchOut) {
    for (const change of fx.statChanges ?? []) changeStage(ctx, user, change.target === 'self' ? user : target, change.stat, change.stages, events);
    if (fx.weather) {
      setWeather(ctx, fx.weather, 5);
      events.push({ type: 'weather', weather: fx.weather });
    }
    user.vol.pivot = { baton: fx.switchOut === 'baton' };
    return;
  }
  if (fx.forceSwitch) {
    forceOut(ctx, target, events);
    return;
  }
  if (fx.trap) {
    if (target.vol.trapped) events.push({ type: 'fail', side: user.side });
    else {
      target.vol.trapped = true;
      events.push({ type: 'selfState', side: target.side, state: 'trapped' });
    }
    return;
  }
  if (fx.disrupt) {
    disrupt(ctx, user, target, fx.disrupt, events);
    return;
  }
  if (fx.cure) {
    const mons = fx.cure === 'party' ? (user.side === 'player' ? ctx.party : ctx.battle.enemyTeam) : [user.mon];
    let any = false;
    for (const m of mons) {
      if (m.status && m.hp > 0) {
        m.status = null;
        any = true;
      }
    }
    if (any) events.push({ type: 'cured', side: user.side });
    didSomething = any;
    if (!fx.heal && !fx.statChanges?.length) {
      if (!any) events.push({ type: 'fail', side: user.side });
      return;
    }
  }
  if (fx.heal && (user.vol.healBlock > 0 || (user.side === 'enemy' && enemyHealingBlocked(ctx.perks)))) {
    events.push({ type: 'fail', side: user.side });
    return;
  }
  if (fx.heal) {
    const max = calcStats(content, user.mon).hp;
    const weather = weatherNow(ctx);
    let fraction = fx.heal;
    if (fx.healWeather && weather) fraction = weather === 'sun' ? 2 / 3 : 1 / 4;
    if (fx.healSand && weather === 'sand') fraction = 2 / 3;
    const amount = Math.min(max - user.mon.hp, Math.max(1, Math.floor(max * fraction * (user.side === 'player' ? healingMoveMultiplier(ctx.perks) : 1))));
    if (amount > 0) {
      user.mon.hp += amount;
      events.push({ type: 'heal', side: user.side, amount, hpAfter: user.mon.hp });
      didSomething = true;
    }
  }
  if (fx.sideMove) {
    if (!applySideMove(ctx, user, fx.sideMove, events)) {
      events.push({ type: 'fail', side: user.side });
      return;
    }
    didSomething = true;
  }
  if (fx.clearHazards) didSomething = clearHazards(ctx, user, fx.clearHazards, events) || didSomething;
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
  if (!didSomething && !fx.statChanges?.length && !fx.status && !fx.confuse && !fx.clearHazards) events.push({ type: 'fail', side: user.side });
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
  if (source.side === 'player' && target.side === 'enemy') target.vol.confusion = statusTurnsPerk(ctx.perks, target.vol.confusion);
  events.push({ type: 'confused', side: target.side });
  return true;
}

/** Whether `target` can get this status from `source` (types, abilities such as Limber, Leaf Guard in sun). */
function canGetStatus(ctx: BattleContext, source: Combatant, target: Combatant, status: StatusId, move?: Move): boolean {
  if (target.mon.status || target.mon.hp <= 0) return false;
  if (status === 'slp' && (source.vol.uproar > 0 || target.vol.uproar > 0 || (source === target ? false : false))) return false;
  const corrosive = status === 'psn' && abilityIn(ctx, source) === 'corrosion' && source !== target;
  if (!corrosive && isStatusImmune(status, getSpecies(ctx.content, target.mon.speciesId).types, move)) return false;
  if (Held.statusBlocked(ctx, target, status)) return false;
  if (terrainBlocksStatus(ctx, target, status)) return false;
  if (source !== target && source.side !== target.side && ctx.battle.sideEffects[target.side].safeguard > 0) return false;
  return statusAbilityBlock(ctx, source, target, status) === null;
}

/** The target's ability that stops this status, or null. */
function statusAbilityBlock(ctx: BattleContext, source: Combatant, target: Combatant, status: StatusId): string | null {
  const ability = targetAbility(ctx, source, target);
  if (!ability) return null;
  if (STATUS_IMMUNE[ability]?.includes(status)) return ability;
  if (ability === 'leaf-guard' && weatherNow(ctx) === 'sun') return ability;
  if (ability === 'shields-down' && target.mon.hp * 2 > calcStats(ctx.content, target.mon).hp) return ability;
  return veilBlock(ctx, source, target, status, ability);
}

/** Sweet Veil (sleep), Pastel Veil (poison) and Flower Veil (Grass types) on the target or, in doubles, its ally. */
function veilBlock(ctx: BattleContext, source: Combatant, target: Combatant, status: StatusId, own: string | null): string | null {
  if (source === target) return null;
  const ally = moveIgnoresAbility ? null : allyAbility(ctx, target);
  const grass = getSpecies(ctx.content, target.mon.speciesId).types.includes('grass');
  for (const a of [own, ally]) {
    if (a === 'sweet-veil' && status === 'slp') return a;
    if (a === 'pastel-veil' && status === 'psn') return a;
    if (a === 'flower-veil' && grass) return a;
  }
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
  const corrosive = status === 'psn' && abilityIn(ctx, source) === 'corrosion' && source !== target;
  if (target.mon.status || (!corrosive && isStatusImmune(status, types, move)) || blocker || Held.statusBlocked(ctx, target, status) || terrainBlocksStatus(ctx, target, status) || (source.side !== target.side && ctx.battle.sideEffects[target.side].safeguard > 0)) {
    if (announceFailure && blocker) announce(target, blocker, events);
    if (announceFailure) events.push({ type: 'fail', side: target.side });
    return false;
  }
  target.mon.status = { id: status };
  if (status === 'slp') {
    // Sleep length (turns skipped) is rolled when it starts.
    target.mon.status.turns = rng.int(content.ruleset.sleepTurnsMin, content.ruleset.sleepTurnsMax);
    if (source.side === 'player' && target.side === 'enemy') target.mon.status.turns = statusTurnsPerk(ctx.perks, target.mon.status.turns);
  }
  // Burn and poison wear off after a set number of turns (0 = never); a perk holder's lasts longer.
  const length = status === 'brn' ? content.ruleset.burnTurns : status === 'psn' ? content.ruleset.poisonTurns : 0;
  if (length > 0) target.mon.status.left = length + (source.side === 'player' && target.side === 'enemy' && (status === 'brn' || status === 'psn') ? statusLengthPerk(ctx.perks, status) : 0);
  events.push({ type: 'status', side: target.side, status });
  if (status === 'psn' && source !== target && abilityIn(ctx, source) === 'poison-puppeteer') tryConfuse(ctx, source, target, events, false);
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
  if (source && stages < 0 && source.side !== c.side && ctx.battle.sideEffects[c.side].mist > 0 && ability !== 'contrary') {
    events.push({ type: 'fail', side: c.side });
    return false;
  }
  if (source && stages < 0 && ability === 'mirror-armor' && source.side !== c.side) {
    announce(c, ability, events);
    applyStageChange(ctx, source, stat, stages, events);
    return false;
  }
  if (source && stages < 0 && source.side !== c.side && getSpecies(ctx.content, c.mon.speciesId).types.includes('grass') && (ability === 'flower-veil' || (!moveIgnoresAbility && allyAbility(ctx, c) === 'flower-veil'))) {
    announce(c, 'flower-veil', events);
    events.push({ type: 'fail', side: c.side });
    return false;
  }
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
  if (stages < 0) c.vol.loweredThisTurn = true;
  events.push({ type: 'stat', side: c.side, stat, change: after - before });
  if (after > before) {
    const { player, enemy } = activeCombatants(ctx);
    const foe = c.side === 'player' ? enemy : player;
    if (foe.mon.hp > 0 && abilityIn(ctx, foe) === 'opportunist') {
      announce(foe, 'opportunist', events);
      const fb = foe.stages[stat];
      foe.stages[stat] = clampStage(fb + (after - before));
      if (foe.stages[stat] !== fb) events.push({ type: 'stat', side: foe.side, stat, change: foe.stages[stat] - fb });
    }
  }
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
  if (ctx.battle.field.gravity > 0 || c.vol.smackedDown) return true;
  if (abilityIn(ctx, c) === 'levitate' || abilityIn(ctx, c) === 'eelevate' || c.vol.magnetRise > 0) return false;
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
function applyTerrain(ctx: BattleContext, sides: Combatant[], events: BattleEvent[], tick = true): void {
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
  if (!tick) return;
  terrain.turns -= 1;
  if (terrain.turns <= 0) {
    ctx.battle.terrain = null;
    events.push({ type: 'terrainEnd', terrain: terrain.id });
  }
}

/** End of turn: Pokémon of a perk's type recover a share of their max HP (Erika, Gen 3). */
function applyTurnHeal(ctx: BattleContext, c: Combatant, events: BattleEvent[]): void {
  const percent = turnHealPercent(ctx.perks, getSpecies(ctx.content, c.mon.speciesId).types);
  if (percent <= 0 || c.mon.hp <= 0 || enemyHealingBlockedFor(ctx, c)) return;
  const max = calcStats(ctx.content, c.mon).hp;
  const amount = Math.min(max - c.mon.hp, Math.max(1, Math.floor((max * percent) / 100)));
  if (amount <= 0 || c.vol.healBlock > 0) return;
  c.mon.hp += amount;
  events.push({ type: 'heal', side: c.side, amount, hpAfter: c.mon.hp });
}
const enemyHealingBlockedFor = (ctx: BattleContext, c: Combatant) => c.side === 'enemy' && enemyHealingBlocked(ctx.perks);

function applyWeather(ctx: BattleContext, sides: Combatant[], events: BattleEvent[], tick = true): void {
  const weather = ctx.battle.weather;
  if (!weather) return;
  const negated = weatherNow(ctx) === null;
  const immune = negated ? undefined : WEATHER_IMMUNE[weather.id];
  for (const c of sides) {
    if (c.mon.hp <= 0 || negated) continue;
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
    // A trainer perk (Brassius): Pokémon of a type recover HP each turn in a weather.
    const perkHeal = c.side === 'player' ? weatherHealPercent(ctx.perks, getSpecies(ctx.content, c.mon.speciesId).types, weather.id) : 0;
    if (perkHeal > 0 && c.mon.hp < max) {
      const amount = Math.min(max - c.mon.hp, Math.max(1, Math.floor((max * perkHeal) / 100)));
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
      if (Held.hooksOf(ctx, c.mon, c.side).some(({ hook }) => hook.hook === 'weatherImmune' && hook.weathers.includes(weather.id))) continue;
      const { lost, lastStand } = takeHp(ctx, c, Math.max(1, Math.floor(calcStats(ctx.content, c.mon).hp / 16)));
      events.push({ type: 'weatherDamage', side: c.side, weather: weather.id, amount: lost, hpAfter: c.mon.hp });
      if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
    }
  }
  if (!tick) return;
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
  if (other.mon.status?.id === 'slp' && other.mon.hp > 0 && ability === 'bad-dreams') {
    announce(c, ability, events);
    abilityHurt(ctx, other, Math.max(1, Math.floor(calcStats(content, other.mon).hp / 8)), events);
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
  let fraction = status === 'brn' ? burn * (c.side === 'enemy' ? burnDamagePerk(ctx.perks) : burnDamageTakenPerk(ctx.perks)) : status === 'psn' ? content.ruleset.poisonResidualFraction : 0;
  if (status === 'psn' && c.mon.status?.bad) {
    // Toxic: 1/16 more of max HP each turn, up to 15/16.
    c.mon.status.turns = Math.min(15, (c.mon.status.turns ?? 0) + 1);
    fraction = c.mon.status.turns / 16;
  }
  if (status === 'psn' && c.side === 'enemy') fraction *= poisonDamagePerk(ctx.perks);
  if (c.mon.hp > 0 && status && fraction > 0) {
    const { lost, lastStand } = hurt(fraction);
    events.push({ type: 'residual', side: c.side, status, amount: lost, hpAfter: c.mon.hp });
    if (lastStand) events.push({ type: 'lastStand', side: c.side, itemId: lastStand });
  }
  if (c.mon.hp > 0 && c.mon.status?.left !== undefined && (status === 'brn' || status === 'psn') && --c.mon.status.left <= 0) {
    c.mon.status = null;
    events.push({ type: 'cured', side: c.side });
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
    ctx.battle.extra.allyFaintedTurn[c.side] = ctx.battle.turn;
    for (const o of [player, enemy]) {
      if (o !== c && o.mon.hp > 0 && abilityIn(ctx, o) === 'soul-heart') {
        announce(o, 'soul-heart', events);
        applyStageChange(ctx, o, 'spa', 1, events);
      }
    }
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
  if (ctx.battle.totem) totemAura(ctx, events);
  championsAura(ctx, events);
  return events;
}

/** Champion Cynthia's Champion's Aura: at the start of a boss battle your lead's best stat rises. */
function championsAura(ctx: BattleContext, events: BattleEvent[]): void {
  const stages = championsAuraStages(ctx.perks);
  if (stages === 0 || !isBossClass(ctx.battle.trainer?.classId)) return;
  const { battle, content } = ctx;
  const mon = ctx.party[battle.activeIndex];
  if (!mon || mon.hp <= 0) return;
  const stats = calcStats(content, mon);
  const best = (['atk', 'def', 'spa', 'spd', 'spe'] as const).reduce((a, b) => (stats[b] > stats[a] ? b : a));
  const player: Combatant = { side: 'player', mon, stages: battle.playerStages, vol: battle.playerVolatile, flinched: false, protected: false };
  events.push({ type: 'raid', tone: 'phase', text: "Champion's Aura! Your Pokémon feels the Champion's resolve!" });
  applyStageChange(ctx, player, best, stages, events);
}

/** Engine steps the double-battle turn (battle/doubles.ts) drives. Not meant for other callers. */
export const doublesSteps = {
  executeMove,
  runMove,
  resolveMove,
  speedOf,
  priorityOf,
  abilityIn,
  targetAbility,
  announce,
  applyStageChange,
  recordFaints,
  switchIn,
  switchOutAbility,
  enterField,
  enterExtras,
  applyHazards,
  entryAbility,
  applyWeather,
  applyTurnHeal,
  applyTerrain,
  tickSides,
  statusCureAbility,
  applyResidual,
  endTurnMon,
  endTurnField,
  tickDelayed,
  syncForms,
  validateAction,
  choiceLock,
  moveValue,
  useItemInBattle,
  freshVolatileKeeping,
  healMon,
  allyCombatant,
  weatherNow,
};
