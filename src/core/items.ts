// Using Bag items on Pokémon (in or out of battle). Balls are handled by the
// battle engine because they need the opponent.

import type { Content, Item, TypeName } from './contentSchema';
import { blocksEvolution } from './battle/held';
import { evolve, itemEvolutionTargets } from './evolution';
import { getSpecies, maxHp, maxPp } from './pokemon';
import type { PokemonInstance } from './state';

export function getItem(content: Content, id: string): Item {
  const item = content.items.get(id);
  if (!item) throw new Error(`Unknown item "${id}"`);
  return item;
}

export function itemCount(inventory: Record<string, number>, id: string): number {
  return inventory[id] ?? 0;
}

export function addItem(inventory: Record<string, number>, id: string, quantity: number): void {
  inventory[id] = itemCount(inventory, id) + quantity;
}

export function consumeItem(inventory: Record<string, number>, id: string): void {
  const count = itemCount(inventory, id);
  if (count <= 0) throw new Error(`No ${id} left`);
  if (count === 1) delete inventory[id];
  else inventory[id] = count - 1;
}

/** Why an item can't be used on this Pokémon, or null if it can. `regionId` decides regional evolutions. */
export function itemUseProblem(content: Content, item: Item, mon: PokemonInstance, regionId?: string): string | null {
  const fainted = mon.hp <= 0;
  const name = getSpecies(content, mon.speciesId).name;
  switch (item.effect.kind) {
    case 'healHp':
      if (fainted) return `${name} has fainted.`;
      if (mon.hp >= maxHp(content, mon)) return `${name}'s HP is already full.`;
      return null;
    case 'cureStatus':
      if (fainted) return `${name} has fainted.`;
      return mon.status ? null : `${name} has no status problem.`;
    case 'fullRestore':
      if (fainted) return `${name} has fainted.`;
      return mon.hp < maxHp(content, mon) || mon.status ? null : `${name} is already healthy.`;
    case 'restorePp':
      if (fainted) return `${name} has fainted.`;
      return mon.moves.some((m) => m.pp < maxPp(content, m)) ? null : `${name}'s PP is already full.`;
    case 'revive':
      return fainted ? null : `${name} hasn't fainted.`;
    case 'evolve':
      if (fainted) return `${name} has fainted.`;
      if (blocksEvolution(content, mon)) return `${name} is holding an Everstone.`;
      return itemEvolutionTargets(content, mon, item.id, regionId).length > 0 ? null : `It won't have any effect on ${name}.`;
    case 'catch':
    case 'lastStand':
    case 'attribute':
      return `${item.name} can't be used on your Pokémon.`;
    case 'keyItem':
    case 'megaStone':
      return `${item.name} works by itself in battle.`;
    case 'teraShard':
      if (teraTypeOf(content, mon) === item.effect.type) return `${name}'s Tera Type is already ${typeLabel(item.effect.type)}.`;
      return null;
  }
}

export interface ItemUseOptions {
  /** The current region (for regional evolutions). */
  regionId?: string;
  /** For an evolution item with several possible results (Eevee), the one the player chose. */
  evolveTo?: string;
  /** Scales HP restored by healing items (a trainer passive). */
  healMultiplier?: number;
}

/** Uses an item on a Pokémon (mutates it). Returns a message. Does not consume the item. */
export function applyItemToPokemon(content: Content, item: Item, mon: PokemonInstance, opts: ItemUseOptions = {}): string {
  const problem = itemUseProblem(content, item, mon, opts.regionId);
  const healMultiplier = opts.healMultiplier ?? 1;
  if (problem) throw new Error(problem);
  const name = getSpecies(content, mon.speciesId).name;
  const max = maxHp(content, mon);
  switch (item.effect.kind) {
    case 'healHp': {
      const before = mon.hp;
      mon.hp = Math.min(max, mon.hp + Math.floor(item.effect.amount * healMultiplier));
      return `${name} recovered ${mon.hp - before} HP.`;
    }
    case 'cureStatus':
      mon.status = null;
      return `${name} is cured of its status problem.`;
    case 'fullRestore':
      mon.hp = max;
      mon.status = null;
      return `${name} is fully restored.`;
    case 'restorePp':
      for (const slot of mon.moves) slot.pp = Math.min(maxPp(content, slot), slot.pp + (item.effect as { amount: number }).amount);
      return `${name}'s moves regained PP.`;
    case 'revive':
      mon.hp = Math.max(1, Math.floor(max * item.effect.fraction));
      mon.status = null;
      return `${name} was revived!`;
    case 'evolve': {
      const targets = itemEvolutionTargets(content, mon, item.id, opts.regionId);
      const to = opts.evolveTo ?? (targets.length === 1 ? targets[0] : undefined);
      if (!to || !targets.includes(to)) throw new Error(`Choose what ${name} evolves into`);
      const result = evolve(content, mon, to);
      const newName = getSpecies(content, to).name;
      const learned = result.learnedMoves.map((m) => ` ${newName} learned ${content.moves.get(m)!.name}!`).join('');
      const skipped = result.wantsToLearn.length > 0 ? ` (It already knows four moves, so it didn't learn ${result.wantsToLearn.map((m) => content.moves.get(m)!.name).join(', ')}.)` : '';
      return `${name} evolved into ${newName}!${learned}${skipped}`;
    }
    case 'teraShard':
      mon.teraType = item.effect.type;
      return `${name}'s Tera Type is now ${typeLabel(item.effect.type)}!`;
    default:
      throw new Error(`${item.name} can't be used on a Pokémon`);
  }
}

const typeLabel = (type: string) => type[0]!.toUpperCase() + type.slice(1);

/** The type this Pokémon becomes when it Terastallizes: its own choice, or its first type. */
export function teraTypeOf(content: Content, mon: PokemonInstance): TypeName {
  return mon.teraType ?? getSpecies(content, mon.speciesId).types[0]!;
}

/** The item (if any) that acts as a Last Stand Charm, found by its effect, not its name. */
export function lastStandItemId(content: Content): string | null {
  for (const item of content.items.values()) if (item.effect.kind === 'lastStand') return item.id;
  return null;
}
