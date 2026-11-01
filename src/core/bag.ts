// The unified Bag (Major Update §4 and §7): one list of everything the run owns.
//
// Sources, each counted once (nothing is duplicated):
//   - Bag items (run.inventory): medicine, balls, evolution items...
//   - Held items: catalog items on party Pokémon (mon.held). They stay on their
//     holder; the Bag lists them with who holds how many.
//   - Team and player items (run.passives): Amulet Coin, plates, key items...
//   - Map effects still running (run.mapEffects): repels, flutes...
// Reads state only; changes nothing and rolls nothing.

import { itemScenario, labelOf, sortKey } from './camp';
import type { CatalogEntry, Content, Rarity } from './contentSchema';
import { catalogTargetProblem } from './catalog';
import { mapItemCopies } from './mapItems';
import type { RunState } from './state';

export const BAG_POCKETS = ['all', 'medicine', 'balls', 'held', 'battle', 'evolution', 'key', 'other'] as const;
export type BagPocket = (typeof BAG_POCKETS)[number];
export const POCKET_NAMES: Record<BagPocket, string> = {
  all: 'All',
  medicine: 'Medicine',
  balls: 'Poké Balls',
  held: 'Held',
  battle: 'Battle',
  evolution: 'Evolution',
  key: 'Key & passive',
  other: 'Other',
};

export interface BagHolder {
  index: number;
  name: string;
  copies: number;
}

export interface BagEntry {
  /** Unique per row: `<source>:<id>`. */
  key: string;
  itemId: string;
  source: 'bag' | 'held' | 'loose' | 'team' | 'map';
  pocket: Exclude<BagPocket, 'all'>;
  name: string;
  description: string;
  rarity: Rarity | null;
  /** Copies owned in total (for held items: across every holder). */
  quantity: number;
  /** Most copies one owner can have (null: no limit). */
  max: number | null;
  /** Who holds it (held items only). */
  holders: BagHolder[];
  /** Assigned to a Pokémon (held) or always on (team, player and running map items). */
  equipped: boolean;
  /** Passive (works by itself) or used (picked from the Bag or a menu). */
  use: 'passive' | 'use';
  /** A short line on what limits it, or ''. */
  restriction: string;
  iconAssetId: string | null;
}

const ITEM_POCKET: Record<string, BagEntry['pocket']> = {
  ball: 'balls',
  healing: 'medicine',
  revive: 'medicine',
  pp: 'medicine',
  evolution: 'evolution',
  transformation: 'evolution',
  key: 'key',
  charm: 'key',
  attribute: 'other',
};

function catalogPocket(entry: CatalogEntry): BagEntry['pocket'] {
  const kind = entry.effect?.kind;
  if (kind === 'held') return entry.stacksOn === 'pokemon' ? 'held' : 'battle';
  if (kind === 'care' || kind === 'teamCare') return 'medicine';
  if (kind === 'battleBoost' || kind === 'bagItem') return 'battle';
  if (kind === 'passive' || kind === 'perk' || kind === 'encounter') return 'key';
  return 'other';
}

/** A Bag item's rarity: the reward card that gives it, else the catalog entry with its id; null when neither exists (shop-only balls). */
function bagItemRarity(content: Content, id: string): Rarity | null {
  for (const r of content.rewards.values()) if (r.effect.kind === 'addItem' && r.effect.item === id) return r.rarity;
  return content.catalog.get(id)?.rarity ?? null;
}

const catalogIcon = (content: Content, id: string): string | null => content.rewards.get(`item:${id}`)?.iconAssetId ?? null;

/** Every item the run owns: Bag items first (in the order obtained), then held, team and map items (by name). */
export function bagEntries(content: Content, run: RunState): BagEntry[] {
  const out: BagEntry[] = [];
  for (const [id, n] of Object.entries(run.inventory)) {
    const item = content.items.get(id);
    if (!item || n <= 0) continue;
    out.push({
      key: `bag:${id}`,
      itemId: id,
      source: 'bag',
      pocket: ITEM_POCKET[item.category] ?? 'other',
      name: item.name,
      description: item.description,
      rarity: bagItemRarity(content, id),
      quantity: n,
      max: null,
      holders: [],
      equipped: false,
      use: item.usableOutside ? 'use' : 'passive',
      restriction: item.usableOutside ? '' : 'Used in battle, not from the map.',
      iconAssetId: item.iconAssetId,
    });
  }
  const held = new Map<string, BagHolder[]>();
  run.party.forEach((mon, index) => {
    for (const [id, copies] of Object.entries(mon.held ?? {})) {
      if (copies <= 0) continue;
      const name = content.species.get(mon.speciesId)?.name ?? mon.speciesId;
      held.set(id, [...(held.get(id) ?? []), { index, name, copies }]);
    }
  });
  for (const [id, holders] of held) {
    const entry = content.catalog.get(id);
    if (!entry) continue;
    out.push({
      key: `held:${id}`,
      itemId: id,
      source: 'held',
      pocket: 'held',
      name: entry.name,
      description: entry.description,
      rarity: entry.rarity,
      quantity: holders.reduce((n, h) => n + h.copies, 0),
      max: entry.max,
      holders,
      equipped: true,
      use: 'passive',
      restriction: `${entry.max !== null ? `Up to ${entry.max} per Pokémon. ` : ''}Choose it to take it off a holder.`,
      iconAssetId: catalogIcon(content, id),
    });
  }
  for (const [id, copies] of Object.entries(run.looseHeld ?? {})) {
    const entry = content.catalog.get(id);
    if (!entry || copies <= 0) continue;
    out.push({
      key: `loose:${id}`,
      itemId: id,
      source: 'loose',
      pocket: 'held',
      name: entry.name,
      description: entry.description,
      rarity: entry.rarity,
      quantity: copies,
      max: entry.max,
      holders: [],
      equipped: false,
      use: 'use',
      restriction: 'Not held by anyone: choose it to give it to a Pokémon.',
      iconAssetId: catalogIcon(content, id),
    });
  }
  for (const [id, copies] of Object.entries(run.passives ?? {})) {
    const entry = content.catalog.get(id);
    if (!entry || copies <= 0) continue;
    out.push({
      key: `team:${id}`,
      itemId: id,
      source: 'team',
      pocket: catalogPocket(entry),
      name: entry.name,
      description: entry.description,
      rarity: entry.rarity,
      quantity: copies,
      max: entry.max,
      holders: [],
      equipped: true,
      use: entry.how === 'use' ? 'use' : 'passive',
      restriction: entry.max !== null && entry.max > 1 ? `Up to ${entry.max} for the run.` : '',
      iconAssetId: catalogIcon(content, id),
    });
  }
  const seenMap = new Set<string>();
  for (const e of run.mapEffects ?? []) {
    if (seenMap.has(e.itemId) || run.passives?.[e.itemId]) continue;
    seenMap.add(e.itemId);
    const entry = content.catalog.get(e.itemId);
    const copies = entry ? mapItemCopies(run, entry) : 0;
    if (!entry || copies <= 0) continue;
    out.push({
      key: `map:${e.itemId}`,
      itemId: e.itemId,
      source: 'map',
      pocket: 'key',
      name: entry.name,
      description: entry.description,
      rarity: entry.rarity,
      quantity: copies,
      max: entry.max,
      holders: [],
      equipped: true,
      use: 'passive',
      restriction: 'Working now; runs out.',
      iconAssetId: catalogIcon(content, e.itemId),
    });
  }
  const order = { bag: 0, held: 1, loose: 2, team: 3, map: 4 } as const;
  // Camp (W3): a printed label tags the name, and each entry shows an example of when to use it.
  for (const e of out) {
    const label = labelOf(run, e.itemId);
    if (label) e.name = `${e.name} "${label}"`;
    if (e.source === 'bag' || e.source === 'loose') e.description = `${e.description} ${itemScenario(content, e.itemId)}`;
  }
  // Bag items keep the order they were obtained in; the rest sort by name. The Camp's Tidy Bag can re-sort everything.
  const sorted = out.map((e, i) => ({ e, i })).sort((a, b) => order[a.e.source] - order[b.e.source] || (a.e.source === 'bag' ? a.i - b.i : a.e.name.localeCompare(b.e.name))).map((x) => x.e);
  const mode = run.camp?.bagSort ?? 'obtained';
  if (mode === 'obtained') return sorted;
  return sorted.map((e, i) => ({ e, i, k: sortKey(run, mode, e) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i)).map((x) => x.e);
}

export function entriesInPocket(entries: readonly BagEntry[], pocket: BagPocket): BagEntry[] {
  return pocket === 'all' ? [...entries] : entries.filter((e) => e.pocket === pocket);
}

/** The footer line for an entry: description, holders, limits and how it works. */
export function bagEntryText(e: BagEntry, opts: { action?: boolean } = {}): string {
  const sentence = (t: string) => (/[.!?)]$/.test(t) ? t : `${t}.`);
  const parts = [sentence(`${e.name}: ${e.description}`)];
  if (e.holders.length > 0) parts.push(`Held by ${e.holders.map((h) => (h.copies > 1 ? `${h.name} ×${h.copies}` : h.name)).join(', ')}.`);
  if (e.restriction) parts.push(e.restriction);
  if (e.use === 'passive' && e.source !== 'bag' && !opts.action) parts.push('Passive: works by itself.');
  return parts.join(' ');
}

const MOVE_PHASES: readonly RunState['phase'][] = ['reward', 'decision', 'map', 'shop'];

function checkPhase(run: RunState): void {
  if (!MOVE_PHASES.includes(run.phase)) throw new Error('Held items can only be moved outside battle');
}

/** Takes every copy of a held item off a party Pokémon into the Bag (run.looseHeld). Returns a new run. */
export function takeOffHeld(content: Content, current: RunState, partyIndex: number, itemId: string): { run: RunState; message: string } {
  checkPhase(current);
  const mon = current.party[partyIndex];
  const copies = mon?.held?.[itemId] ?? 0;
  const entry = content.catalog.get(itemId);
  if (!mon || !entry || copies <= 0) throw new Error('That Pokémon is not holding that item');
  const run = structuredClone(current);
  const target = run.party[partyIndex]!;
  delete target.held![itemId];
  run.looseHeld = { ...run.looseHeld, [itemId]: (run.looseHeld?.[itemId] ?? 0) + copies };
  const name = content.species.get(mon.speciesId)?.name ?? mon.speciesId;
  return { run, message: `You took the ${entry.name}${copies > 1 ? ` ×${copies}` : ''} from ${name}. It is in your Bag.` };
}

/** Why a loose held item can't go to this Pokémon (no free slot, at its limit, wrong species), or null. */
export function giveHeldProblem(content: Content, run: RunState, itemId: string, partyIndex: number): string | null {
  const entry = content.catalog.get(itemId);
  const mon = run.party[partyIndex];
  if (!entry || !mon) return 'Choose a Pokémon.';
  if ((run.looseHeld?.[itemId] ?? 0) <= 0) return 'You have none of those in your Bag.';
  return catalogTargetProblem(content, run, entry, mon);
}

/** Gives one loose copy of a held item to a party Pokémon. Returns a new run. */
export function giveHeld(content: Content, current: RunState, itemId: string, partyIndex: number): { run: RunState; message: string } {
  checkPhase(current);
  const problem = giveHeldProblem(content, current, itemId, partyIndex);
  if (problem) throw new Error(problem);
  const run = structuredClone(current);
  const mon = run.party[partyIndex]!;
  mon.held = { ...mon.held, [itemId]: (mon.held?.[itemId] ?? 0) + 1 };
  const left = run.looseHeld![itemId]! - 1;
  if (left > 0) run.looseHeld![itemId] = left;
  else delete run.looseHeld![itemId];
  const name = content.species.get(mon.speciesId)?.name ?? mon.speciesId;
  return { run, message: `${name} is now holding the ${content.catalog.get(itemId)!.name}.` };
}
