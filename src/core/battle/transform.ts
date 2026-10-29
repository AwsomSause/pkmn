// Battle transformations (Milestone 8.5, GAME_DESIGN.md §5f): Mega Evolution,
// Primal Reversion and Terastallization so far; Z-Moves and Dynamax follow as
// their own slices.
//
// Rules:
// - Each mechanic needs its key item in the Bag (Mega Ring) and works once
//   per battle for each side. A Pokémon can only transform once per battle.
// - Mega Evolution also needs that species' Mega Stone in the Bag. The player
//   asks for it together with a move; it happens before anyone moves, so the
//   new Speed already counts for that turn's order.
// - Primal Reversion (Red/Blue Orb) is automatic at the start of the move
//   phase, needs no key item and doesn't use up the Mega.
// - The transformed Pokémon's speciesId is its new form until the battle ends;
//   `battle.transform.forms` remembers the old one and revertTransformations
//   changes it back. HP stays the same (capped at the new maximum).
// - Terastallization needs the Tera Orb. The Pokémon's types become its Tera
//   Type (teraTypeOf) until the battle ends. It keeps STAB on its original
//   types; moves of its Tera Type get STAB too (2× when the Tera Type is one
//   of its original types), and those with less than 60 power are raised to
//   60 (not multi-hit or priority moves).
// - Bosses (balance.transformations) may transform their ace, the last
//   Pokémon of their team, and need no items.
// - A run can switch mechanics off (run.disabledMechanics, a challenge); that
//   applies to both sides.
// The engine only emits 'transform' events; the battle screen turns them into
// presentation (text, sprite swap; cinematics come in M9.5).

import type { Content, Move, TransformKind, TypeName } from '../contentSchema';
import { teraTypeOf } from '../items';
import { calcStats, getSpecies } from '../pokemon';
import type { BattleState, PokemonInstance } from '../state';

type Side = 'player' | 'enemy';
export type FormChangeKind = 'mega' | 'primal' | 'tera';

/** The player's request, sent with a move. */
export type TransformRequest = { kind: 'mega'; formId?: string } | { kind: 'tera' };

export interface TransformEvent {
  type: 'transform';
  side: Side;
  uid: string;
  kind: FormChangeKind;
  from: string;
  to: string;
  /** The item that made it happen (Mega Stone or orb); null for bosses and Tera. */
  itemId: string | null;
  /** Terastallization: the type it became. */
  teraType?: TypeName;
}

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

/** The Mega forms the player's active Pokémon can take right now (empty when it can't Mega Evolve). */
export function megaOptions(ctx: TransformContext): FormOption[] {
  const mon = ctx.party[ctx.battle.activeIndex];
  if (!mon) return [];
  return megaProblem(ctx, mon, undefined) ? [] : ownedMegaForms(ctx.content, ctx.inventory, mon);
}

/** Why the player's active Pokémon can't do this transformation now, or null if it can. */
export function transformProblem(ctx: TransformContext, request: TransformRequest): string | null {
  const mon = ctx.party[ctx.battle.activeIndex];
  if (!mon) return 'No active Pokémon.';
  return request.kind === 'mega' ? megaProblem(ctx, mon, request.formId) : teraProblem(ctx, mon);
}

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
  if (battle.transform.forms[mon.uid]) return 'That Pokémon has already transformed this battle.';
  return null;
}

function megaProblem(ctx: TransformContext, mon: PokemonInstance, formId: string | undefined): string | null {
  const { content, battle, inventory } = ctx;
  if (ctx.disabledMechanics?.includes('mega')) return 'Mega Evolution is switched off for this run.';
  if (!hasKeyItem(content, inventory, 'mega')) return 'You need a Mega Ring to Mega Evolve.';
  if (battle.transform.used.player.includes('mega')) return 'You have already Mega Evolved this battle.';
  if (battle.transform.forms[mon.uid]) return 'That Pokémon has already transformed this battle.';
  const options = ownedMegaForms(content, inventory, mon);
  if (options.length === 0) return `${getSpecies(content, mon.speciesId).name} has no Mega Stone.`;
  if (formId !== undefined && !options.some((o) => o.formId === formId)) return "You don't have the stone for that Mega form.";
  return null;
}

/**
 * Applies this turn's transformations, before anyone moves: automatic Primal
 * Reversion for both sides, then the player's request, then the opponent's.
 */
export function applyTransformations(ctx: TransformContext, request: TransformRequest | undefined, events: TransformEvent[]): void {
  const { content, battle } = ctx;
  const player = ctx.party[battle.activeIndex];
  const enemy = battle.enemyTeam[battle.enemyIndex];
  if (!player || !enemy) return;
  const megaOn = !ctx.disabledMechanics?.includes('mega');
  const enemyMay = (mon: PokemonInstance) =>
    megaOn && battle.transform.enemyMechanics.includes('mega') && battle.enemyTeam.indexOf(mon) === battle.enemyTeam.length - 1;

  // 1. Primal Reversion (automatic, free).
  if (megaOn && player.hp > 0 && !battle.transform.forms[player.uid]) {
    const orb = stoneForms(content, player.speciesId, true).find((o) => o.itemId && owns(ctx.inventory, o.itemId));
    if (orb) changeForm(ctx, 'player', player, 'primal', orb, events);
  }
  if (enemy.hp > 0 && !battle.transform.forms[enemy.uid] && enemyMay(enemy)) {
    const orb = stoneForms(content, enemy.speciesId, true)[0];
    if (orb) changeForm(ctx, 'enemy', enemy, 'primal', { ...orb, itemId: null }, events);
  }

  // 2. The player's Mega Evolution.
  if (request?.kind === 'mega' && player.hp > 0 && !megaProblem(ctx, player, request.formId)) {
    const options = ownedMegaForms(content, ctx.inventory, player);
    const option = options.find((o) => o.formId === request.formId) ?? options[0]!;
    changeForm(ctx, 'player', player, 'mega', option, events);
    battle.transform.used.player.push('mega');
  }

  // ... or Terastallization.
  if (request?.kind === 'tera' && player.hp > 0 && !teraProblem(ctx, player)) {
    terastallize(ctx, 'player', player, teraTypeOf(content, player), events);
  }

  // 3. The opponent's: a boss's ace Mega Evolves if it can, otherwise Terastallizes, as soon as it is out.
  const may = (kind: TransformKind) =>
    !ctx.disabledMechanics?.includes(kind) && battle.transform.enemyMechanics.includes(kind) && !battle.transform.used.enemy.includes(kind);
  const isAce = battle.enemyTeam.indexOf(enemy) === battle.enemyTeam.length - 1;
  if (enemy.hp > 0 && isAce && !battle.transform.forms[enemy.uid]) {
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

function terastallize(ctx: TransformContext, side: Side, mon: PokemonInstance, type: TypeName, events: TransformEvent[]): void {
  const { battle } = ctx;
  battle.transform.forms[mon.uid] = { kind: 'tera', from: mon.speciesId };
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

function changeForm(ctx: TransformContext, side: Side, mon: PokemonInstance, kind: FormChangeKind, option: FormOption, events: TransformEvent[]): void {
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
  for (const mon of [...party, ...battle.enemyTeam]) {
    const record = battle.transform.forms[mon.uid];
    if (!record) continue;
    mon.speciesId = record.from;
    mon.hp = Math.min(mon.hp, calcStats(content, mon).hp);
  }
  battle.transform.forms = {};
  battle.transform.teraTypes = {};
}

/** The mechanics a trainer battle's opponent may use (bosses only; see balance.transformations). */
export function bossMechanics(content: Content, role: 'gym' | 'elite' | 'champion' | null, gymNumber: number, disabled: readonly TransformKind[]): TransformKind[] {
  const rules = content.balance.transformations;
  const allowed = role === 'gym' ? gymNumber >= rules.bossGymFrom : role !== null && rules.league;
  if (!allowed) return [];
  return (['mega', 'tera'] as TransformKind[]).filter((m) => !disabled.includes(m));
}
