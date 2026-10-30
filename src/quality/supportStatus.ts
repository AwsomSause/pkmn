// Support status of every content entry (CLAUDE.md §4). Passing the schema is
// not the same as working in the game, so each species, form, move, item and
// evolution gets one of four statuses, with the reasons:
//
//   supported — works in the game with no known gaps
//   limited   — works, with documented limits (listed in `notes`)
//   disabled  — in the data but switched off until its mechanic is built
//   invalid   — the data is broken (a missing reference, art or value)
//
// The statuses are worked out from the data every time, so they can't drift
// out of date; src/quality/knownLimits.json adds the limits a rule can't see.
// Nothing here changes how the game plays.

import type { Content, Evolution, Item, Move, Species } from '../core/contentSchema';
import { isUsableMove, usableLearnset } from '../core/pokemon';
import { isWildEligible } from '../core/themes';
import { eligibleSpecies } from '../core/runPrep';
import { pokemonEntries, filesOf } from '../assets/catalog';
import knownLimits from './knownLimits.json';

export const SUPPORT_STATUSES = ['supported', 'limited', 'disabled', 'invalid'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const ENTRY_KINDS = ['species', 'form', 'move', 'item', 'evolution'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export interface EntryStatus {
  kind: EntryKind;
  id: string;
  status: SupportStatus;
  /** Why it isn't fully supported (empty when it is). */
  notes: string[];
}

/** What the status rules need from outside the game data. */
export interface StatusInputs {
  /** Whether a file exists under public/assets/ (the tool checks the disk). */
  assetExists: (path: string) => boolean;
}

/** Forms that only appear through mechanics that aren't built yet (M8.5). */
const TRANSFORMATION_KINDS = new Set(['mega', 'gigantamax', 'primal', 'battle']);

/** Evolution items that stand in for a main-game rule the game doesn't have (GAME_DESIGN.md §5c). */
const SUBSTITUTE_ITEMS: Record<string, string> = {
  'linking-cord': 'trade evolution done with the Linking Cord (there is no trading)',
  'soothe-bell': 'friendship evolution can also use the Soothe Bell',
};

/** Fewer distinct usable level-up moves than this, because some are unsupported, and a species is "limited". */
export const MIN_USABLE_MOVES = 4;

const KNOWN: { moves: Record<string, string[]>; species: Record<string, string[]> } = knownLimits;

function worst(notes: { status: SupportStatus; note: string }[]): { status: SupportStatus; notes: string[] } {
  const rank = (s: SupportStatus) => SUPPORT_STATUSES.indexOf(s);
  const status = notes.reduce<SupportStatus>((acc, n) => (rank(n.status) > rank(acc) ? n.status : acc), 'supported');
  return { status, notes: notes.map((n) => `${n.status === 'limited' ? '' : `${n.status}: `}${n.note}`) };
}

/** Every item id a player can get: rewards, shop, starting items, trainers' items and preparation tokens. */
export function obtainableItems(content: Content): Set<string> {
  const ids = new Set<string>();
  for (const r of content.rewards.values()) if (r.effect.kind === 'addItem') ids.add(r.effect.item);
  for (const e of content.shop) ids.add(e.item);
  for (const id of Object.keys(content.balance.startingItems)) ids.add(id);
  for (const a of content.archetypes.values()) for (const id of Object.keys(a.startingItems)) ids.add(id);
  for (const t of content.prepTokens.values()) for (const id of Object.keys(t.items)) ids.add(id);
  return ids;
}

/**
 * Species a player can own: wild Pokémon, starters, and everything they evolve
 * into. Ordinary trainers draw from the wild pool too. Boss team members only
 * count with `withBosses` (bosses bring their own moves, and can't be caught).
 */
export function meetableSpecies(content: Content, withBosses = false): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  const add = (id: string) => {
    if (!seen.has(id) && content.species.has(id)) {
      seen.add(id);
      queue.push(id);
    }
  };
  for (const s of content.species.values()) if (isWildEligible(content, s)) add(s.id);
  for (const pool of content.starterPools.values()) for (const id of eligibleSpecies(content, pool)) add(id);
  if (withBosses) for (const boss of content.bosses.values()) for (const role of ['gym', 'elite', 'champion'] as const) for (const t of boss.teams[role]) for (const m of t.members) add(m.speciesId);
  while (queue.length > 0) {
    const s = content.species.get(queue.pop()!)!;
    for (const evo of s.evolutions) add(evo.to);
  }
  return seen;
}

/** The species a form belongs to (itself for a base species). */
const lineOf = (content: Content, id: string) => content.species.get(id)?.form?.base ?? id;

/** Mega and Primal forms that a Mega Stone or orb can reach (M8.5, built). */
function stoneTargets(content: Content): Set<string> {
  const out = new Set<string>();
  for (const item of content.items.values()) if (item.effect.kind === 'megaStone') for (const to of Object.values(item.effect.forms)) out.add(to);
  return out;
}

export function isTransformation(s: Species): boolean {
  return Boolean(s.form && TRANSFORMATION_KINDS.has(s.form.kind));
}

export function moveStatus(content: Content, m: Move): EntryStatus {
  const notes: { status: SupportStatus; note: string }[] = [];
  // Same rule as the content check in src/data/index.ts: these effects set the damage themselves.
  if (m.supported && m.category !== 'status' && m.power === null && !m.effects.fixedDamage && !m.effects.ohko && !m.effects.lowHpPower) notes.push({ status: 'invalid', note: 'damaging move with no power' });
  // The schema only allows effects the engine runs, so a status move with any effect does something.
  if (m.supported && m.category === 'status' && Object.keys(m.effects).length === 0) notes.push({ status: 'invalid', note: 'status move with no effect the engine runs' });
  // The type Z-Moves are made in battle from a move and its Z-Crystal (M8.5, battle/transform.ts zMoveFor).
  const zMade = Object.values(content.zMoves.byType).includes(m.id);
  const maxMade = Object.values(content.maxMoves.byType).includes(m.id) || m.id === content.maxMoves.guard || m.id in content.maxMoves.gmax;
  if (zMade) notes.push({ status: 'limited', note: 'Z-Move: made in battle from a move of its type with the Z-Crystal (M8.5); never learned' });
  else if (maxMade) notes.push({ status: 'limited', note: 'Max Move: used by a Dynamaxed Pokémon (M8.5); terrain and most G-Max side effects not built yet' });
  else if (!m.supported) notes.push({ status: 'disabled', note: m.needs ? `needs: ${m.needs}` : 'not supported by the battle engine yet' });
  for (const note of KNOWN.moves[m.id] ?? []) notes.push({ status: 'limited', note });
  return { kind: 'move', id: m.id, ...worst(notes) };
}

export function speciesStatus(content: Content, s: Species, inputs: StatusInputs, artOwners: Map<string, string>, cryOwners: Map<string, string>): EntryStatus {
  const notes: { status: SupportStatus; note: string }[] = [];
  if (s.evolvesFrom && !content.species.has(s.evolvesFrom)) notes.push({ status: 'invalid', note: `evolves from unknown species "${s.evolvesFrom}"` });
  if (s.form && !content.species.has(s.form.base)) notes.push({ status: 'invalid', note: `form of unknown species "${s.form.base}"` });
  const [front, back, shiny, shinyBack, icon, cry] = pokemonEntries(s.assets);
  if (!filesOf(front!).every(inputs.assetExists)) notes.push({ status: 'invalid', note: 'front sprite file missing' });
  if (!filesOf(icon!).every(inputs.assetExists)) notes.push({ status: 'invalid', note: 'party icon file missing' });
  if (!filesOf(cry!).every(inputs.assetExists)) notes.push({ status: 'invalid', note: 'cry file missing' });
  for (const [entry, what] of [[back!, 'back sprite'], [shiny!, 'shiny sprite'], [shinyBack!, 'shiny back sprite']] as const) {
    if (!filesOf(entry).every(inputs.assetExists)) notes.push({ status: 'limited', note: `${what} missing (a fallback is shown)` });
  }
  const artOwner = artOwners.get(s.assets.sprite);
  if (artOwner && artOwner !== s.id) notes.push({ status: 'limited', note: `uses the art of "${artOwner}"` });
  // Regional and alternate forms share their species' cry in the main games too; the director's custom forms don't.
  const cryOwner = cryOwners.get(s.assets.cry);
  const custom = s.tags.some((t) => t === 'delta' || t === 'zform' || t === 'spooky');
  if (cryOwner && cryOwner !== s.id && (custom || lineOf(content, cryOwner) !== lineOf(content, s.id))) notes.push({ status: 'limited', note: `uses the cry of "${cryOwner}"` });
  if (isTransformation(s)) {
    if (s.form!.kind === 'gigantamax') notes.push({ status: 'limited', note: 'Gigantamax form: taken in every battle while you own the Dynamax Band (M8.5); most G-Max side effects not built yet' });
    else if (stoneTargets(content).has(s.id)) notes.push({ status: 'limited', note: `${s.form!.kind} form: reached in battle with its stone or orb (M8.5); abilities aren't modelled yet` });
    else notes.push({ status: 'disabled', note: `${s.form!.kind} form: appears only through Advanced Mechanics not built yet (M8.5)` });
  }
  const usable = new Set(usableLearnset(content, s).map((e) => e.move));
  const total = new Set(s.learnset.map((e) => e.move)).size;
  if (usable.size === 0) notes.push({ status: 'disabled', note: 'no level-up move the battle engine supports' });
  else if (usable.size < MIN_USABLE_MOVES && usable.size < total) notes.push({ status: 'limited', note: `only ${usable.size} of ${total} level-up moves supported` });
  for (const note of KNOWN.species[s.id] ?? []) notes.push({ status: 'limited', note });
  return { kind: s.form ? 'form' : 'species', id: s.id, ...worst(notes) };
}

export function itemStatus(content: Content, item: Item, obtainable: Set<string>, usedForEvolution: Set<string>): EntryStatus {
  const notes: { status: SupportStatus; note: string }[] = [];
  if (!obtainable.has(item.id)) notes.push({ status: 'disabled', note: 'no reward, shop, trainer or preparation gives it' });
  if (item.effect.kind === 'evolve' && !usedForEvolution.has(item.id)) notes.push({ status: 'invalid', note: 'evolution item that no species uses' });
  if (SUBSTITUTE_ITEMS[item.id]) notes.push({ status: 'limited', note: SUBSTITUTE_ITEMS[item.id]! });
  return { kind: 'item', id: item.id, ...worst(notes) };
}

/** An evolution's id: "<from>-><to>" (with the item when there are several ways). */
export const evolutionId = (from: string, evo: Evolution) => `${from}->${evo.to}${evo.item ? ` (${evo.item})` : evo.level ? ` (L${evo.level})` : ''}`;

/** What is wrong with one evolution: broken data (invalid) or a way to evolve the player can't reach (disabled). */
export function evolutionStatus(content: Content, from: Species, evo: Evolution, obtainable: Set<string>, maxLevel: number): EntryStatus {
  const notes: { status: SupportStatus; note: string }[] = [];
  const target = content.species.get(evo.to);
  if (!target) notes.push({ status: 'invalid', note: `evolves into unknown species "${evo.to}"` });
  else {
    if (target.evolvesFrom !== from.id && !(from.form && target.evolvesFrom === from.form.base)) {
      notes.push({ status: 'limited', note: `"${evo.to}" says it evolves from "${target.evolvesFrom ?? 'nothing'}"` });
    }
    if (target.learnset.every((e) => !isUsableMove(content, e.move))) notes.push({ status: 'disabled', note: `"${evo.to}" has no supported move` });
    if (isTransformation(target)) notes.push({ status: 'disabled', note: `"${evo.to}" is a ${target.form!.kind} form` });
  }
  if (isTransformation(from)) notes.push({ status: 'disabled', note: `"${from.id}" is a ${from.form!.kind} form` });
  if (evo.item) {
    const item = content.items.get(evo.item);
    if (!item || item.effect.kind !== 'evolve') notes.push({ status: 'invalid', note: `"${evo.item}" is not an evolution item` });
    else if (!obtainable.has(evo.item)) notes.push({ status: 'disabled', note: `"${evo.item}" can't be obtained` });
    if (SUBSTITUTE_ITEMS[evo.item]) notes.push({ status: 'limited', note: SUBSTITUTE_ITEMS[evo.item]! });
  }
  if (evo.level !== undefined && evo.level > maxLevel) notes.push({ status: 'disabled', note: `level ${evo.level} is above the highest level (${maxLevel})` });
  if (evo.condition) notes.push({ status: 'limited', note: `needs ${evo.condition} (Tyrogue's Attack/Defense rule)` });
  if (evo.region) notes.push({ status: 'limited', note: `preferred branch in region "${evo.region}"` });
  return { kind: 'evolution', id: evolutionId(from.id, evo), ...worst(notes) };
}

/** The status of every species, form, move, item and evolution. */
export function allStatuses(content: Content, inputs: StatusInputs): EntryStatus[] {
  // The first species (in data order) to use a sprite or cry owns it; later ones borrow it.
  const artOwners = new Map<string, string>();
  const cryOwners = new Map<string, string>();
  for (const s of content.species.values()) {
    if (!artOwners.has(s.assets.sprite)) artOwners.set(s.assets.sprite, s.id);
    if (!cryOwners.has(s.assets.cry)) cryOwners.set(s.assets.cry, s.id);
  }
  const obtainable = obtainableItems(content);
  const usedForEvolution = new Set<string>();
  for (const s of content.species.values()) for (const e of s.evolutions) if (e.item) usedForEvolution.add(e.item);
  const maxLevel = content.balance.difficulty.maxLevel;
  const out: EntryStatus[] = [];
  for (const s of content.species.values()) out.push(speciesStatus(content, s, inputs, artOwners, cryOwners));
  for (const m of content.moves.values()) out.push(moveStatus(content, m));
  for (const item of content.items.values()) out.push(itemStatus(content, item, obtainable, usedForEvolution));
  for (const s of content.species.values()) for (const evo of s.evolutions) out.push(evolutionStatus(content, s, evo, obtainable, maxLevel));
  return out;
}

/** How many entries of each kind have each status. */
export function statusSummary(statuses: EntryStatus[]): Record<EntryKind, Record<SupportStatus, number>> {
  const summary = Object.fromEntries(ENTRY_KINDS.map((k) => [k, Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0]))])) as Record<EntryKind, Record<SupportStatus, number>>;
  for (const e of statuses) summary[e.kind][e.status] += 1;
  return summary;
}
