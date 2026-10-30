// What a shop row shows besides name and price (Visual Bible "Shops": category
// icons, a bought/unavailable state, and on focus what it does, who can use it
// and what you already own). Worked out without Phaser so it can be tested.

import type { Content, Item } from '../core/contentSchema';
import { getSpecies } from '../core/pokemon';
import { itemCount, itemUseProblem } from '../core/items';
import type { RunState } from '../core/state';

/** Frames of `pack.ess.pockets` (Essentials bag pockets). */
export const POCKET = { items: 0, medicine: 1, balls: 2, tms: 3, berries: 4, mail: 5, battle: 6, key: 7 } as const;

const POCKET_OF: Record<Item['category'], { frame: number; word: string }> = {
  ball: { frame: POCKET.balls, word: 'Poké Ball' },
  healing: { frame: POCKET.medicine, word: 'Medicine' },
  revive: { frame: POCKET.medicine, word: 'Medicine' },
  pp: { frame: POCKET.medicine, word: 'Medicine' },
  charm: { frame: POCKET.battle, word: 'Charm' },
  attribute: { frame: POCKET.battle, word: 'Training' },
  evolution: { frame: POCKET.items, word: 'Evolution' },
  transformation: { frame: POCKET.items, word: 'Form item' },
  key: { frame: POCKET.key, word: 'Key item' },
};

export function pocketOf(item: Item): { frame: number; word: string } {
  return POCKET_OF[item.category];
}

/**
 * Who in the party can use it, for items that only fit some Pokémon (evolution and form items),
 * e.g. "Pikachu can use it" or "Nobody in your party can use it". Null for items anyone can use.
 */
export function shopUsers(content: Content, run: RunState, item: Item): string | null {
  if (item.category !== 'evolution' && item.category !== 'transformation') return null;
  const regionId = run.regionOrder[run.regionIndex];
  const names = run.party.filter((mon) => itemUseProblem(content, item, mon, regionId) === null).map((mon) => getSpecies(content, mon.speciesId).name);
  if (names.length === 0) return 'Nobody in your party can use it';
  return `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''} can use it`;
}

/** The focus hint: what it does, who can use it, what you own. */
export function shopHint(content: Content, run: RunState, item: Item): string {
  const owned = item.effect.kind === 'attribute' ? 0 : itemCount(run.inventory, item.id);
  const users = shopUsers(content, run, item);
  return [`${pocketOf(item).word}: ${item.description}`, users, owned > 0 ? `You have ${owned}` : null, `₽${run.money} to spend`].filter(Boolean).join('  ·  ');
}
