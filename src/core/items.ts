// Using Bag items on Pokémon (in or out of battle). Balls are handled by the
// battle engine because they need the opponent.

import type { Content, Item } from './contentSchema';
import { getSpecies, maxHp } from './pokemon';
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

/** Why an item can't be used on this Pokémon, or null if it can. */
export function itemUseProblem(content: Content, item: Item, mon: PokemonInstance): string | null {
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
      return mon.moves.some((m) => m.pp < content.moves.get(m.id)!.pp) ? null : `${name}'s PP is already full.`;
    case 'revive':
      return fainted ? null : `${name} hasn't fainted.`;
    case 'catch':
    case 'lastStand':
      return `${item.name} can't be used on your Pokémon.`;
  }
}

/** Applies a healing/revive/PP item to a Pokémon (mutates it). Returns a message. Does not consume the item. */
export function applyItemToPokemon(content: Content, item: Item, mon: PokemonInstance): string {
  const problem = itemUseProblem(content, item, mon);
  if (problem) throw new Error(problem);
  const name = getSpecies(content, mon.speciesId).name;
  const max = maxHp(content, mon);
  switch (item.effect.kind) {
    case 'healHp': {
      const before = mon.hp;
      mon.hp = Math.min(max, mon.hp + item.effect.amount);
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
      for (const slot of mon.moves) slot.pp = Math.min(content.moves.get(slot.id)!.pp, slot.pp + (item.effect as { amount: number }).amount);
      return `${name}'s moves regained PP.`;
    case 'revive':
      mon.hp = Math.max(1, Math.floor(max * item.effect.fraction));
      mon.status = null;
      return `${name} was revived!`;
    default:
      throw new Error(`${item.name} can't be used on a Pokémon`);
  }
}

/** The item (if any) that acts as a Last Stand Charm, found by its effect, not its name. */
export function lastStandItemId(content: Content): string | null {
  for (const item of content.items.values()) if (item.effect.kind === 'lastStand') return item.id;
  return null;
}
