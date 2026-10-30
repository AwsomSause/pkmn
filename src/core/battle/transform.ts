// Battle transformations (Milestone 8.5, GAME_DESIGN.md §5f): Mega Evolution,
// Primal Reversion, Terastallization, Z-Moves and Dynamax/Gigantamax.
//
// Rules ("PokeRogue style", the director's pick, 2026-10-29):
// - Each mechanic needs its key item in the Bag (Mega Ring, Tera Orb, Z-Ring,
//   Dynamax Band).
// - Forms are permanent while you own the key item: every Pokémon with its
//   Mega Stone in the Bag Mega Evolves by itself in every battle, and with the
//   Dynamax Band every Pokémon with a Gigantamax form takes it. Primal
//   Reversion (Red/Blue Orb) works the same way and needs no key item. The
//   form change happens before anyone moves on its first turn out, so the new
//   Speed already counts.
// - Terastallization, Z-Moves and Dynamax work once per battle for each side,
//   and a Pokémon can use only one of the three per battle. A Mega Evolved or
//   Primal Pokémon can't Dynamax.
// - A changed Pokémon's speciesId is its new form until the battle ends;
//   `battle.transform.forms` remembers the old one and revertTransformations
//   changes it back. HP stays the same (capped at the new maximum).
// - Terastallization needs the Tera Orb. The Pokémon's types become its Tera
//   Type (teraTypeOf) until the battle ends. It keeps STAB on its original
//   types; moves of its Tera Type get STAB too (2× when the Tera Type is one
//   of its original types), and those with less than 60 power are raised to
//   60 (not multi-hit or priority moves).
// - Z-Moves need the Z-Ring and the Z-Crystal of the chosen move's type. A
//   damaging move becomes its type's Z-Move (zMoves.json power, never misses,
//   priority 0, no side effects, a quarter of its damage through Protect). A
//   status move works as itself and adds its Z bonus (stat boosts, clearing
//   lowered stats, or a full heal). The Z-Power is spent, and a status move's
//   bonus lands, at the start of the turn, like the other transformations.
// - Dynamax needs the Dynamax Band. For balance.transformations.dynamaxTurns
//   turns (counting the first) its HP is doubled and every move becomes a
//   Max Move (maxMoves.json): damaging moves turn into their type's Max Move,
//   which never misses, has no priority, hits through Protect for a quarter
//   and then sets the weather or changes stats; status moves become Max
//   Guard. In its Gigantamax form, its type's Max Move becomes its G-Max
//   Move. Switching out or fainting ends it early. It can't be made to flinch.
// - Bosses (balance.transformations) may transform their ace, the last
//   Pokémon of their team, and need no items.
// - A run can switch mechanics off (run.disabledMechanics, a challenge); that
//   applies to both sides.
// The engine only emits 'transform' events; the battle screen turns them into
// presentation (text, sprite swap; cinematics come in M9.5).

import type { BoostStat, Content, MaxEffect, Move, TransformKind, TypeName } from '../contentSchema';
import { clampStage } from './damage';
import { teraTypeOf } from '../items';
import { calcStats, getSpecies } from '../pokemon';
import type { BattleState, PokemonInstance } from '../state';

type Side = 'player' | 'enemy';
export type FormChangeKind = 'mega' | 'primal' | 'gigantamax' | 'tera';
/** The mechanics that work once per battle; a Pokémon can use only one of them. */
export type BattleMechanic = 'tera' | 'zmove' | 'dynamax';

/** The player's request, sent with a move (a Z-Move applies to that move). */
export type TransformRequest = { kind: 'tera' } | { kind: 'zmove' } | { kind: 'dynamax' };

export interface TransformEvent {
  type: 'transform';
  side: Side;
  uid: string;
  /** `dynamaxEnd`: a Dynamax (or Gigantamax) ran out or ended early. */
  kind: FormChangeKind | 'zmove' | 'dynamax' | 'gigantamax' | 'dynamaxEnd';
  from: string;
  to: string;
  /** The item that made it happen (Mega Stone or orb); null for bosses and Tera. */
  itemId: string | null;
  /** Terastallization: the type it became. */
  teraType?: TypeName;
  /** Z-Move: the move it powered up and what it became (the same id for a status move). */
  moveId?: string;
  zMoveId?: string;
}

/** Events the transformation step can add (stat and HP changes use the engine's own event shapes). */
export type TransformStepEvent =
  | TransformEvent
  | { type: 'stat'; side: Side; stat: BoostStat; change: number }
  | { type: 'statLimit'; side: Side; stat: BoostStat; up: boolean }
  | { type: 'heal'; side: Side; amount: number; hpAfter: number };

export interface TransformContext {
  content: Content;
  battle: BattleState;
  party: PokemonInstance[];
  inventory: Record<string, number>;
  disabledMechanics?: readonly TransformKind[];
}

const owns = (inventory: Record<string, number>, id: string) => (inventory[id] ?? 0) > 0;

/** True when the Bag holds the key item that unlocks this mechanic. */
export function hasKeyItem(content: Content, inventory: Record<string, number>, mechanic: TransformKind): boolean {
  for (const item of content.items.values()) {
    if (item.effect.kind === 'keyItem' && item.effect.mechanic === mechanic && owns(inventory, item.id)) return true;
  }
  return false;
}

export interface FormOption {
  formId: string;
  /** The stone or orb that allows it; null for bosses, who need none. */
  itemId: string | null;
}

/** Every Mega (or, with `primal`, Primal) form this species can take, with the item for each, in data order. */
export function stoneForms(content: Content, speciesId: string, primal: boolean): FormOption[] {
  const out: FormOption[] = [];
  for (const item of content.items.values()) {
    if (item.effect.kind !== 'megaStone' || item.effect.primal !== primal) continue;
    const to = item.effect.forms[speciesId];
    if (to) out.push({ formId: to, itemId: item.id });
  }
  return out;
}

/** The Mega forms the player's Pokémon could take with the stones in the Bag (ignores per-battle limits). */
export function ownedMegaForms(content: Content, inventory: Record<string, number>, mon: PokemonInstance): FormOption[] {
  return stoneForms(content, mon.speciesId, false).filter((o) => o.itemId !== null && owns(inventory, o.itemId));
}

/** The form this Pokémon takes by itself in battle: its Mega form (the first stone you own) or its Gigantamax form, or null. */
export function permanentForm(content: Content, inventory: Record<string, number>, mon: PokemonInstance, disabled: readonly TransformKind[] = []): { kind: 'mega' | 'gigantamax'; option: FormOption } | null {
  const mega = !disabled.includes('mega') && hasKeyItem(content, inventory, 'mega') ? ownedMegaForms(content, inventory, mon)[0] : undefined;
  if (mega) return { kind: 'mega', option: mega };
  const gmax = !disabled.includes('dynamax') && hasKeyItem(content, inventory, 'dynamax') ? gmaxFormFor(content, mon.speciesId) : null;
  return gmax ? { kind: 'gigantamax', option: { formId: gmax, itemId: null } } : null;
}

/** Why this Pokémon can't use another once-per-battle mechanic, or null. */
function oncePerPokemon(ctx: TransformContext, mon: PokemonInstance): string | null {
  return ctx.battle.transform.mechanics[mon.uid] ? 'That Pokémon has already transformed this battle.' : null;
}

/** Why the player's active Pokémon can't do this transformation now (with the move in `moveIndex`), or null if it can. */
export function transformProblem(ctx: TransformContext, request: TransformRequest, moveIndex = -1): string | null {
  const mon = ctx.party[ctx.battle.activeIndex];
  if (!mon) return 'No active Pokémon.';
  if (request.kind === 'zmove') return zMoveProblem(ctx, mon, moveIndex);
  if (request.kind === 'dynamax') return dynamaxProblem(ctx, mon);
  return teraProblem(ctx, mon);
}

/**
 * The move a move becomes as a Z-Move: a damaging move turns into its type's
 * Z-Move; a status move with a Z bonus stays itself. Null when it has no Z-Move.
 */
export function zMoveFor(content: Content, move: Move): Move | null {
  if (move.flags.includes('zmove') || move.supported === false) return null;
  if (move.category === 'status') return content.zMoves.status[move.id] ? move : null;
  const power = content.zMoves.power[move.id];
  const zId = content.zMoves.byType[move.type];
  const z = zId ? content.moves.get(zId) : undefined;
  if (!power || !z) return null;
  return {
    ...z,
    type: move.type,
    category: move.category,
    power,
    accuracy: null,
    pp: 1,
    priority: 0,
    critStage: 0,
    target: 'enemy',
    flags: ['zmove'],
    effects: {},
    supported: true,
  };
}

/** The Z-Crystal in the Bag for this type, or null. */
export function ownedZCrystal(content: Content, inventory: Record<string, number>, type: TypeName): string | null {
  for (const item of content.items.values()) {
    if (item.effect.kind === 'zCrystal' && item.effect.type === type && owns(inventory, item.id)) return item.id;
  }
  return null;
}

/** For each of the active Pokémon's moves, the Z-Move it can become right now (null when it can't). */
export function zMoveOptions(ctx: TransformContext): (Move | null)[] {
  const mon = ctx.party[ctx.battle.activeIndex];
  if (!mon) return [];
  return mon.moves.map((slot, index) => (zMoveProblem(ctx, mon, index) ? null : zMoveFor(ctx.content, ctx.content.moves.get(slot.id)!)));
}

function zMoveProblem(ctx: TransformContext, mon: PokemonInstance, moveIndex: number): string | null {
  const { content, battle, inventory } = ctx;
  if (ctx.disabledMechanics?.includes('zmove')) return 'Z-Moves are switched off for this run.';
  if (!hasKeyItem(content, inventory, 'zmove')) return 'You need a Z-Ring to use a Z-Move.';
  if (battle.transform.used.player.includes('zmove')) return 'You have already used a Z-Move this battle.';
  if (oncePerPokemon(ctx, mon)) return oncePerPokemon(ctx, mon);
  const slot = mon.moves[moveIndex];
  const move = slot ? content.moves.get(slot.id) : undefined;
  if (!slot || !move) return 'Choose a move for the Z-Move.';
  if (slot.pp <= 0) return 'That move has no PP left.';
  if (!zMoveFor(content, move)) return `${move.name} can't become a Z-Move.`;
  if (!ownedZCrystal(content, inventory, move.type)) return `You need the ${typeName(move.type)} Z-Crystal for ${move.name}.`;
  return null;
}

/** True when the player's active Pokémon can Dynamax now. */
export function canDynamax(ctx: TransformContext): boolean {
  const mon = ctx.party[ctx.battle.activeIndex];
  return Boolean(mon && !dynamaxProblem(ctx, mon));
}

function dynamaxProblem(ctx: TransformContext, mon: PokemonInstance): string | null {
  const { content, battle, inventory } = ctx;
  if (ctx.disabledMechanics?.includes('dynamax')) return 'Dynamax is switched off for this run.';
  if (!hasKeyItem(content, inventory, 'dynamax')) return 'You need a Dynamax Band to Dynamax.';
  if (battle.transform.used.player.includes('dynamax')) return 'You have already Dynamaxed this battle.';
  if (oncePerPokemon(ctx, mon)) return oncePerPokemon(ctx, mon);
  const form = battle.transform.forms[mon.uid]?.kind;
  if (form === 'mega' || form === 'primal') return `A ${form === 'mega' ? 'Mega Evolved' : 'Primal'} Pokémon can't Dynamax.`;
  return null;
}

/** The Gigantamax form this species takes when it Dynamaxes, or null. */
export function gmaxFormFor(content: Content, speciesId: string): string | null {
  if (content.species.get(`${speciesId}-gmax`)?.form?.kind === 'gigantamax') return `${speciesId}-gmax`;
  for (const s of content.species.values()) if (s.form?.kind === 'gigantamax' && s.form.base === speciesId) return s.id;
  return null;
}

/**
 * The Max Move a move becomes for a Dynamaxed Pokémon of this species: Max
 * Guard for a status move, the G-Max Move when its Gigantamax form has one
 * of this type, otherwise its type's Max Move. Null when it has none.
 */
export function maxMoveFor(content: Content, speciesId: string, move: Move): Move | null {
  const data = content.maxMoves;
  if (move.flags.includes('max') || move.flags.includes('zmove') || move.supported === false) return null;
  if (move.category === 'status') {
    const guard = content.moves.get(data.guard)!;
    return { ...guard, category: 'status', power: null, accuracy: null, pp: 1, priority: 4, critStage: 0, target: 'self', flags: ['max'], effects: { protect: true }, supported: true };
  }
  const power = data.power[move.id];
  const gmax = Object.entries(data.gmax).find(([, g]) => g.type === move.type && g.forms.includes(speciesId));
  const id = gmax?.[0] ?? data.byType[move.type];
  const max = id ? content.moves.get(id) : undefined;
  if (!power || !max) return null;
  const effect = gmax ? gmax[1].effects : data.effects[max.id];
  return {
    ...max,
    type: move.type,
    category: move.category,
    power: gmax?.[1].power ?? power,
    accuracy: null,
    pp: 1,
    priority: 0,
    critStage: 0,
    target: 'enemy',
    flags: ['max'],
    effects: maxEffects(effect),
    supported: true,
  };
}

/** A Max Move's side effects in the engine's move-effect form (weather is set by the engine after it hits; see maxMoveWeather). */
function maxEffects(effect: MaxEffect | undefined): Move['effects'] {
  if (!effect) return {};
  return {
    ...(effect.statChanges ? { statChanges: effect.statChanges.map((c) => ({ ...c, chance: 100 })) } : {}),
    ...(effect.status ? { status: { id: effect.status, chance: 100 } } : {}),
    ...(effect.confuse ? { confuse: { chance: 100 } } : {}),
    ...(effect.bind ? { bind: true as const } : {}),
    ...(effect.breaksProtect ? { breaksProtect: true as const } : {}),
  };
}

/** The weather a Max Move sets after it hits (Max Flare: sun), or null. */
export function maxMoveWeather(content: Content, moveId: string): MaxEffect['weather'] | null {
  return content.maxMoves.effects[moveId]?.weather ?? null;
}

/** The terrain a Max Move sets after it hits (Max Lightning: Electric Terrain), or null. */
export function maxMoveTerrain(content: Content, moveId: string): MaxEffect['terrain'] | null {
  return content.maxMoves.effects[moveId]?.terrain ?? null;
}

/** The move a Pokémon really uses this turn: its Max Move while Dynamaxed, otherwise the move itself. */
export function battleMove(content: Content, battle: BattleState, mon: PokemonInstance, move: Move): Move {
  return battle.transform.dynamax[mon.uid] !== undefined ? (maxMoveFor(content, mon.speciesId, move) ?? move) : move;
}

/** For the move list: what each of the active Pokémon's moves becomes if it Dynamaxes (or is Dynamaxed). */
export function maxMoveOptions(ctx: TransformContext): (Move | null)[] {
  const mon = ctx.party[ctx.battle.activeIndex];
  if (!mon) return [];
  // Before its first turn out it hasn't taken its Gigantamax form yet, but it will before it moves.
  const species = ctx.battle.transform.forms[mon.uid] ? mon.speciesId : (permanentForm(ctx.content, ctx.inventory, mon, ctx.disabledMechanics)?.option.formId ?? mon.speciesId);
  return mon.moves.map((slot) => maxMoveFor(ctx.content, species, ctx.content.moves.get(slot.id)!));
}

function dynamax(ctx: TransformContext, side: Side, mon: PokemonInstance, events: TransformStepEvent[]): void {
  const { content, battle } = ctx;
  const before = calcStats(content, mon).hp;
  battle.transform.mechanics[mon.uid] = 'dynamax';
  battle.transform.dynamax[mon.uid] = content.balance.transformations.dynamaxTurns;
  battle.transform.used[side].push('dynamax');
  mon.dynamaxed = true;
  mon.hp = Math.max(1, Math.round((mon.hp * calcStats(content, mon).hp) / before));
  events.push({ type: 'transform', side, uid: mon.uid, kind: 'dynamax', from: mon.speciesId, to: mon.speciesId, itemId: null });
}

/** Ends a Dynamax: HP is scaled back to the normal maximum (a Gigantamax form stays until the battle ends). */
export function endDynamax(content: Content, battle: BattleState, side: Side, mon: PokemonInstance, events?: TransformStepEvent[]): void {
  if (battle.transform.dynamax[mon.uid] === undefined) return;
  const before = calcStats(content, mon).hp;
  delete battle.transform.dynamax[mon.uid];
  delete mon.dynamaxed;
  if (mon.hp > 0) mon.hp = Math.max(1, Math.round((mon.hp * calcStats(content, mon).hp) / before));
  events?.push({ type: 'transform', side, uid: mon.uid, kind: 'dynamaxEnd', from: mon.speciesId, to: mon.speciesId, itemId: null });
}

/** End of turn: Dynamax turns run down; it ends when they run out or the Pokémon has fainted. */
export function tickDynamax(content: Content, battle: BattleState, party: PokemonInstance[], events: TransformStepEvent[]): void {
  for (const [side, mon] of [['player', party[battle.activeIndex]], ['enemy', battle.enemyTeam[battle.enemyIndex]]] as const) {
    if (!mon || battle.transform.dynamax[mon.uid] === undefined) continue;
    battle.transform.dynamax[mon.uid]! -= 1;
    if (battle.transform.dynamax[mon.uid]! <= 0 || mon.hp <= 0) endDynamax(content, battle, side, mon, events);
  }
}

const typeName = (type: TypeName) => type[0]!.toUpperCase() + type.slice(1);

/** The Tera Type the player's active Pokémon can Terastallize into right now, or null. */
export function teraOption(ctx: TransformContext): TypeName | null {
  const mon = ctx.party[ctx.battle.activeIndex];
  return mon && !teraProblem(ctx, mon) ? teraTypeOf(ctx.content, mon) : null;
}

function teraProblem(ctx: TransformContext, mon: PokemonInstance): string | null {
  const { content, battle, inventory } = ctx;
  if (ctx.disabledMechanics?.includes('tera')) return 'Terastallization is switched off for this run.';
  if (!hasKeyItem(content, inventory, 'tera')) return 'You need a Tera Orb to Terastallize.';
  if (battle.transform.used.player.includes('tera')) return 'You have already Terastallized this battle.';
  return oncePerPokemon(ctx, mon);
}

/**
 * Applies this turn's transformations, before anyone moves: the forms that
 * happen by themselves (Primal, Mega, Gigantamax) for both sides, then the
 * player's request, then the opponent's.
 */
export function applyTransformations(ctx: TransformContext, request: TransformRequest | undefined, events: TransformStepEvent[], moveIndex = -1): void {
  const { content, battle } = ctx;
  const player = ctx.party[battle.activeIndex];
  const enemy = battle.enemyTeam[battle.enemyIndex];
  if (!player || !enemy) return;
  const megaOn = !ctx.disabledMechanics?.includes('mega');
  const enemyMay = (mon: PokemonInstance) =>
    megaOn && battle.transform.enemyMechanics.includes('mega') && battle.enemyTeam.indexOf(mon) === battle.enemyTeam.length - 1;

  // 1. Forms that happen by themselves: Primal Reversion, then Mega Evolution or Gigantamax.
  if (player.hp > 0 && !battle.transform.forms[player.uid]) {
    const orb = megaOn ? stoneForms(content, player.speciesId, true).find((o) => o.itemId && owns(ctx.inventory, o.itemId)) : undefined;
    const form = orb ? null : permanentForm(content, ctx.inventory, player, ctx.disabledMechanics);
    if (orb) changeForm(ctx, 'player', player, 'primal', orb, events);
    else if (form) changeForm(ctx, 'player', player, form.kind, form.option, events);
  }
  if (enemy.hp > 0 && !battle.transform.forms[enemy.uid] && enemyMay(enemy)) {
    const orb = stoneForms(content, enemy.speciesId, true)[0];
    if (orb) changeForm(ctx, 'enemy', enemy, 'primal', { ...orb, itemId: null }, events);
  }

  // 2. The player's Terastallization...
  if (request?.kind === 'tera' && player.hp > 0 && !teraProblem(ctx, player)) {
    terastallize(ctx, 'player', player, teraTypeOf(content, player), events);
  }

  // ... or a Z-Move (the engine swaps in the Z-Move itself; see zMoveFor).
  if (request?.kind === 'zmove' && player.hp > 0 && !zMoveProblem(ctx, player, moveIndex)) {
    const move = content.moves.get(player.moves[moveIndex]!.id)!;
    const z = zMoveFor(content, move)!;
    battle.transform.mechanics[player.uid] = 'zmove';
    battle.transform.used.player.push('zmove');
    events.push({
      type: 'transform', side: 'player', uid: player.uid, kind: 'zmove', from: player.speciesId, to: player.speciesId,
      itemId: ownedZCrystal(content, ctx.inventory, move.type), moveId: move.id, zMoveId: z.id,
    });
    if (move.category === 'status') applyZBonus(ctx, 'player', player, move.id, events);
  }

  // ... or Dynamax (the engine turns its moves into Max Moves; see battleMove).
  if (request?.kind === 'dynamax' && player.hp > 0 && !dynamaxProblem(ctx, player)) dynamax(ctx, 'player', player, events);

  // 3. The opponent's: a boss's ace Mega Evolves if it can, otherwise Terastallizes, as soon as it is out.
  const may = (kind: TransformKind) =>
    !ctx.disabledMechanics?.includes(kind) && battle.transform.enemyMechanics.includes(kind) && !battle.transform.used.enemy.includes(kind);
  const isAce = battle.enemyTeam.indexOf(enemy) === battle.enemyTeam.length - 1;
  if (enemy.hp > 0 && isAce && !battle.transform.forms[enemy.uid] && !battle.transform.mechanics[enemy.uid]) {
    const option = may('mega') ? stoneForms(content, enemy.speciesId, false)[0] : undefined;
    if (option) {
      changeForm(ctx, 'enemy', enemy, 'mega', { ...option, itemId: null }, events);
      battle.transform.used.enemy.push('mega');
    } else if (may('tera')) {
      // A type specialist Terastallizes into their speciality.
      const specialty = battle.trainer?.leaderId ? content.bosses.get(battle.trainer.leaderId)?.types[0] : undefined;
      terastallize(ctx, 'enemy', enemy, specialty ?? teraTypeOf(content, enemy), events);
    }
  }
}

/** A status Z-Move's bonus for its user: stat boosts, clearing lowered stats, or a full heal. */
function applyZBonus(ctx: TransformContext, side: Side, mon: PokemonInstance, moveId: string, events: TransformStepEvent[]): void {
  const bonus = ctx.content.zMoves.status[moveId];
  const stages = side === 'player' ? ctx.battle.playerStages : ctx.battle.enemyStages;
  for (const { stat, stages: by } of bonus?.boosts ?? []) {
    const before = stages[stat];
    const after = clampStage(before + by);
    if (after === before) events.push({ type: 'statLimit', side, stat, up: by > 0 });
    else {
      stages[stat] = after;
      events.push({ type: 'stat', side, stat, change: after - before });
    }
  }
  if (bonus?.effect === 'clearNegative') {
    for (const stat of Object.keys(stages) as BoostStat[]) {
      if (stages[stat] >= 0) continue;
      events.push({ type: 'stat', side, stat, change: -stages[stat] });
      stages[stat] = 0;
    }
  }
  if (bonus?.effect === 'heal') {
    const amount = calcStats(ctx.content, mon).hp - mon.hp;
    if (amount > 0) {
      mon.hp += amount;
      events.push({ type: 'heal', side, amount, hpAfter: mon.hp });
    }
  }
}

function terastallize(ctx: TransformContext, side: Side, mon: PokemonInstance, type: TypeName, events: TransformStepEvent[]): void {
  const { battle } = ctx;
  battle.transform.mechanics[mon.uid] = 'tera';
  battle.transform.teraTypes[mon.uid] = type;
  battle.transform.used[side].push('tera');
  events.push({ type: 'transform', side, uid: mon.uid, kind: 'tera', from: mon.speciesId, to: mon.speciesId, itemId: null, teraType: type });
}

/** A Pokémon's types in this battle: its Tera Type once Terastallized, otherwise its species' types. */
export function battleTypes(content: Content, battle: BattleState, mon: PokemonInstance): readonly TypeName[] {
  const tera = battle.transform.teraTypes[mon.uid];
  return tera ? [tera] : getSpecies(content, mon.speciesId).types;
}

/** The STAB multiplier for a move of this type (1 = none), counting Terastallization. */
export function stabMultiplier(content: Content, battle: BattleState, mon: PokemonInstance, moveType: TypeName): number {
  const base = content.ruleset.stabMultiplier;
  const own = getSpecies(content, mon.speciesId).types.includes(moveType);
  const tera = battle.transform.teraTypes[mon.uid];
  if (tera === moveType) return own ? 2 : base;
  return own ? base : 1;
}

/** A Terastallized Pokémon's weak moves of its Tera Type hit with at least 60 power. */
export function teraPower(battle: BattleState, mon: PokemonInstance, move: Move, power: number): number {
  const tera = battle.transform.teraTypes[mon.uid];
  if (!tera || move.type !== tera || power >= 60 || move.effects.hits || move.priority > 0) return power;
  return 60;
}

function changeForm(ctx: TransformContext, side: Side, mon: PokemonInstance, kind: FormChangeKind, option: FormOption, events: TransformStepEvent[]): void {
  const from = mon.speciesId;
  ctx.battle.transform.forms[mon.uid] = { kind, from };
  mon.speciesId = option.formId;
  mon.hp = Math.min(mon.hp, calcStats(ctx.content, mon).hp);
  events.push({ type: 'transform', side, uid: mon.uid, kind, from, to: option.formId, itemId: option.itemId });
}

/**
 * Changes every transformed Pokémon back (call when the battle ends, before
 * evolutions and the after-battle screens). HP is kept, capped at the
 * original form's maximum.
 */
export function revertTransformations(content: Content, battle: BattleState, party: PokemonInstance[]): void {
  for (const mon of party) endDynamax(content, battle, 'player', mon);
  for (const mon of battle.enemyTeam) endDynamax(content, battle, 'enemy', mon);
  for (const mon of [...party, ...battle.enemyTeam]) {
    const record = battle.transform.forms[mon.uid];
    if (!record) continue;
    mon.speciesId = record.from;
    mon.hp = Math.min(mon.hp, calcStats(content, mon).hp);
  }
  battle.transform.forms = {};
  battle.transform.teraTypes = {};
  battle.transform.dynamax = {};
  battle.transform.mechanics = {};
}

/** The mechanics a trainer battle's opponent may use (bosses only; see balance.transformations). */
export function bossMechanics(content: Content, role: 'gym' | 'elite' | 'champion' | null, gymNumber: number, disabled: readonly TransformKind[]): TransformKind[] {
  const rules = content.balance.transformations;
  const allowed = role === 'gym' ? gymNumber >= rules.bossGymFrom : role !== null && rules.league;
  if (!allowed) return [];
  // Bosses don't use Z-Moves or Dynamax yet.
  return (['mega', 'tera'] as TransformKind[]).filter((m) => !disabled.includes(m));
}
