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

/** One thing on the shelf, everything a shop style needs to draw it (no Phaser). */
export interface ShopRow {
  itemId: string;
  name: string;
  /** The name as the list shows it, with "(on sale!)", "(early)" or "(black market)". */
  label: string;
  iconAssetId: string;
  price: number;
  /** The price before the sale of the day, when it is on sale. */
  wasPrice: number | null;
  sale: boolean;
  early: boolean;
  black: boolean;
  affordable: boolean;
  /** How many you own (attribute items are used on the spot, so always 0). */
  owned: number;
  pocket: { frame: number; word: string };
  category: Item['category'];
  description: string;
  /** Uids of party members who can use it (evolution and form items), else null. */
  users: string[] | null;
  hint: string;
  problem: string | null;
}

export interface ShopView {
  money: number;
  rows: ShopRow[];
  /** "New stock at N badges", when more stock is still locked. */
  nextStock: string | null;
  canSell: boolean;
}

/** The shop as data: one row per item in stock, in stock order. */
export function shopView(content: Content, run: RunState, deps: {
  stock: Content['shop'];
  price: (e: Content['shop'][number]) => number;
  basePrice: (e: Content['shop'][number]) => number;
  badgesFor: (e: Content['shop'][number]) => number;
  saleItem: string | null;
  isBlack: (e: Content['shop'][number]) => boolean;
  canSell: boolean;
  working: string | null;
}): ShopView {
  const next = content.shop.filter((e) => !deps.stock.includes(e)).sort((a, b) => deps.badgesFor(a) - deps.badgesFor(b))[0];
  const nextStock = next ? `New stock at ${deps.badgesFor(next)} badges` : null;
  const regionId = run.regionOrder[run.regionIndex];
  const rows = deps.stock.map((entry): ShopRow => {
    const item = content.items.get(entry.item)!;
    const price = deps.price(entry);
    const sale = deps.saleItem === entry.item;
    const early = run.badges.length < deps.badgesFor(entry);
    const black = deps.isBlack(entry);
    const users = item.category === 'evolution' || item.category === 'transformation' ? run.party.filter((m) => itemUseProblem(content, item, m, regionId) === null).map((m) => m.uid) : null;
    return {
      itemId: entry.item,
      name: item.name,
      label: black ? `${item.name} (black market)` : early ? `${item.name} (early)` : sale ? `${item.name} (on sale!)` : item.name,
      iconAssetId: item.iconAssetId,
      price,
      wasPrice: sale ? deps.basePrice(entry) : null,
      sale,
      early,
      black,
      affordable: run.money >= price,
      owned: item.effect.kind === 'attribute' ? 0 : itemCount(run.inventory, entry.item),
      pocket: pocketOf(item),
      category: item.category,
      description: item.description,
      users,
      hint: `${shopHint(content, run, item)}.${nextStock ? `  ${nextStock}.` : ''}${deps.working ? `  ·  ${deps.working}` : ''}`,
      problem: run.money < price ? `Not enough money for the ${item.name} (₽${price}, you have ₽${run.money}).` : null,
    };
  });
  return { money: run.money, rows, nextStock, canSell: deps.canSell };
}
