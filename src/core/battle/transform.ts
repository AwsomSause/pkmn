// Battle transformations (Milestone 8.5, GAME_DESIGN.md §5f). This slice has
// Mega Evolution and Primal Reversion; Terastallization, Z-Moves and Dynamax
// follow as their own slices.
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
// - Bosses (balance.transformations) may transform their ace, the last
//   Pokémon of their team, and need no items.
// - A run can switch mechanics off (run.disabledMechanics, a challenge); that
//   applies to both sides.
// The engine only emits 'transform' events; the battle screen turns them into
// presentation (text, sprite swap; cinematics come in M9.5).

import type { Content, TransformKind } from '../contentSchema';
import { calcStats, getSpecies } from '../pokemon';
import type { BattleState, PokemonInstance } from '../state';

type Side = 'player' | 'enemy';
export type FormChangeKind = 'mega' | 'primal';

/** The player's request, sent with a move. */
export type TransformRequest = { kind: 'mega'; formId?: string };

export interface TransformEvent {
  type: 'transform';
  side: Side;
  uid: string;
  kind: FormChangeKind;
  from: string;
  to: string;
  /** The item that made it happen (Mega Stone or orb); null for bosses. */
  itemId: string | null;
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
  return megaProblem(ctx, mon, request.formId);
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

  // 3. The opponent's: a boss Mega Evolves its ace as soon as it can.
  if (enemy.hp > 0 && enemyMay(enemy) && !battle.transform.used.enemy.includes('mega') && !battle.transform.forms[enemy.uid]) {
    const option = stoneForms(content, enemy.speciesId, false)[0];
    if (option) {
      changeForm(ctx, 'enemy', enemy, 'mega', { ...option, itemId: null }, events);
      battle.transform.used.enemy.push('mega');
    }
  }
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
}

/** The mechanics a trainer battle's opponent may use (bosses only; see balance.transformations). */
export function bossMechanics(content: Content, role: 'gym' | 'elite' | 'champion' | null, gymNumber: number, disabled: readonly TransformKind[]): TransformKind[] {
  const rules = content.balance.transformations;
  const allowed = role === 'gym' ? gymNumber >= rules.bossGymFrom : role !== null && rules.league;
  if (!allowed) return [];
  return (['mega'] as TransformKind[]).filter((m) => !disabled.includes(m));
}
