// Map, shop and money items (M8.75 item effects, slices 3a and 3b): Repels,
// Flutes, Incense, Mail, the Poké Doll, Apricorns, Coupons, the Point Card and
// friends. Data: catalog entries with `effect.kind` "encounter" (wild Pokémon
// and catching) or "perk" (shops and money). How long each lasts:
//   - "battles" / "throws": charges in run.mapEffects, used up one per wild battle / matching ball throw;
//   - "purchases" / "shops" / "trainers": uses, one per shop purchase / shop visit / trainer win;
//   - "stage": the rest of the current stage; "nextStage": the whole next stage;
//   - "run": a run-long perk, counted in run.passives like the Amulet Coin.
// Every random choice here uses a generator of its own, seeded from the run
// seed and the map node, so a run that doesn't use these items plays exactly
// as before, and the items never change another stream's rolls.

import type { CatalogEffect, CatalogEntry, Content, EncounterMod, Perk, Theme, TypeName } from './contentSchema';
import { hooksOf } from './battle/held';
import { findNode } from './map';
import { hashSeed, Rng } from './rng';
import type { PokemonInstance, RunState } from './state';
import { typesPool, wildEligibleSpecies, type PoolEntry } from './themes';
import { getSpecies } from './pokemon';

export interface ActiveMod {
  itemId: string;
  mod: EncounterMod;
  /** Copies working at once (run-long items: copies owned). */
  copies: number;
}

export interface ActivePerk {
  itemId: string;
  perk: Perk;
  copies: number;
}

type MapEffect = NonNullable<RunState['mapEffects']>[number];
type MapItemEffect = Extract<CatalogEffect, { kind: 'encounter' | 'perk' }>;
type Lasts = MapItemEffect['lasts'];
/** The parts of a run map items read (the shop screen passes what it has). */
export type MapItemRun = Partial<Pick<RunState, 'passives' | 'mapEffects' | 'stage' | 'regionIndex'>>;

/** Names the current stage, so "rest of the stage" effects know when it has ended. */
export function stageKey(run: MapItemRun): string | null {
  return run.stage ? `${run.regionIndex ?? 0}:${run.stage.kind}:${run.stage.index}` : null;
}

function mapItemEffect(content: Content, itemId: string): MapItemEffect | null {
  const effect = content.catalog.get(itemId)?.effect;
  return effect?.kind === 'encounter' || effect?.kind === 'perk' ? effect : null;
}

/** Which counter on a run.mapEffects entry an item uses up, if any. */
function counterOf(lasts: Lasts): 'battles' | 'throws' | 'uses' | null {
  if (lasts.for === 'battles' || lasts.for === 'throws') return lasts.for;
  if (lasts.for === 'purchases' || lasts.for === 'shops' || lasts.for === 'trainers' || lasts.for === 'manual') return 'uses';
  return null;
}

function isActive(run: MapItemRun, e: MapEffect): boolean {
  if (e.battles !== undefined) return e.battles > 0;
  if (e.throws !== undefined) return e.throws > 0;
  if (e.uses !== undefined) return e.uses > 0;
  return e.stage !== undefined && e.stage === stageKey(run);
}

/** Every map, shop and money item working right now, with how many copies. */
function activeEffects(content: Content, run: MapItemRun): { itemId: string; effect: MapItemEffect; copies: number }[] {
  const out: { itemId: string; effect: MapItemEffect; copies: number }[] = [];
  for (const [itemId, copies] of Object.entries(run.passives ?? {})) {
    const effect = mapItemEffect(content, itemId);
    if (effect?.lasts.for === 'run') out.push({ itemId, effect, copies });
  }
  const counts = new Map<string, number>();
  for (const e of run.mapEffects ?? []) if (isActive(run, e)) counts.set(e.itemId, (counts.get(e.itemId) ?? 0) + 1);
  for (const [itemId, copies] of counts) {
    const effect = mapItemEffect(content, itemId);
    if (effect) out.push({ itemId, effect, copies });
  }
  return out;
}

/** Every wild-encounter effect working right now. */
export function activeMods(content: Content, run: MapItemRun): ActiveMod[] {
  return activeEffects(content, run).flatMap(({ itemId, effect, copies }) => (effect.kind === 'encounter' ? effect.mods.map((mod) => ({ itemId, mod, copies })) : []));
}

/** Every shop and money effect working right now. */
export function activePerks(content: Content, run: MapItemRun): ActivePerk[] {
  return activeEffects(content, run).flatMap(({ itemId, effect, copies }) => (effect.kind === 'perk' ? effect.perks.map((perk) => ({ itemId, perk, copies })) : []));
}

function modsOf<K extends EncounterMod['mod']>(all: ActiveMod[], kind: K): (ActiveMod & { mod: Extract<EncounterMod, { mod: K }> })[] {
  return all.filter((m) => m.mod.mod === kind) as (ActiveMod & { mod: Extract<EncounterMod, { mod: K }> })[];
}

export function perksOf<K extends Perk['perk']>(all: ActivePerk[], kind: K): (ActivePerk & { perk: Extract<Perk, { perk: K }> })[] {
  return all.filter((p) => p.perk.perk === kind) as (ActivePerk & { perk: Extract<Perk, { perk: K }> })[];
}

/** How many of this item the run holds now (for its max): charges or uses left, stage effects waiting or working, or run-long copies. */
export function mapItemCopies(run: RunState, entry: CatalogEntry): number {
  const effect = entry.effect;
  if (effect?.kind !== 'encounter' && effect?.kind !== 'perk') return 0;
  if (effect.lasts.for === 'run') return run.passives?.[entry.id] ?? 0;
  let total = 0;
  for (const e of run.mapEffects ?? []) {
    if (e.itemId !== entry.id) continue;
    const counter = e.battles ?? e.throws ?? e.uses;
    if (counter !== undefined) total += counter;
    else if (e.stage === 'next' || isActive(run, e)) total += 1;
  }
  return total;
}

/** Adds a map, shop or money item taken from the draft (mutates `run`). Run-long items are counted by the caller in run.passives. */
export function addMapItem(content: Content, run: RunState, entry: CatalogEntry): void {
  const effect = mapItemEffect(content, entry.id);
  if (!effect) throw new Error(`${entry.name} is not a map item`);
  const lasts = effect.lasts;
  if (lasts.for === 'run') return;
  const effects = [...(run.mapEffects ?? [])].filter((e) => e.stage === 'next' || isActive(run, e));
  const counter = counterOf(lasts);
  if (counter && 'count' in lasts) {
    const existing = effects.find((e) => e.itemId === entry.id && e[counter] !== undefined);
    if (existing) existing[counter] = existing[counter]! + lasts.count;
    else effects.push({ itemId: entry.id, [counter]: lasts.count });
  } else {
    // Taken right after a gym leader or champion, a "rest of this stage" item waits for the next stage instead.
    const stage = run.stage;
    const ending = stage && stage.current !== null && ['gym', 'champion'].includes(findNode(stage.map, stage.current).kind);
    effects.push({ itemId: entry.id, stage: lasts.for === 'stage' && !ending ? (stageKey(run) ?? 'next') : 'next' });
  }
  run.mapEffects = effects;
}

/** When a new stage starts: "next stage" items begin, and the old stage's effects end (mutates `run`). */
export function startStageEffects(run: RunState): void {
  if (!run.mapEffects) return;
  const key = stageKey(run)!;
  run.mapEffects = run.mapEffects
    .map((e) => (e.stage === 'next' ? { ...e, stage: key } : e))
    .filter((e) => e.stage === undefined || e.stage === key)
    .filter((e) => (e.battles ?? 1) > 0 && (e.throws ?? 1) > 0 && (e.uses ?? 1) > 0);
}

/** Uses up one use of every item that lasts a number of shop purchases, shop visits or trainer wins (mutates `run`). */
export function useUses(content: Content, run: RunState, kind: 'purchases' | 'shops' | 'trainers'): void {
  if (!run.mapEffects) return;
  run.mapEffects = run.mapEffects
    .map((e) => (e.uses !== undefined && e.uses > 0 && mapItemEffect(content, e.itemId)?.lasts.for === kind ? { ...e, uses: e.uses - 1 } : e))
    .filter((e) => e.uses !== 0);
}

// ---------- wild battles ----------

/** Wild Pokémon level change from map items and the lead's Cleanse Tag. */
export function wildLevelBonus(content: Content, run: RunState, mods = activeMods(content, run)): number {
  let total = modsOf(mods, 'level').reduce((sum, m) => sum + m.mod.amount * m.copies, 0);
  const lead = run.party.find((p) => p.hp > 0);
  if (lead) for (const { hook, copies } of hooksOf({ content }, lead, 'player')) if (hook.hook === 'wildLevel') total += hook.amount * copies;
  return total;
}

/** Shiny chance multiplier from map items (Poké Radar, Glitter Mail). */
export function wildShinyMultiplier(content: Content, run: RunState, mods = activeMods(content, run)): number {
  return modsOf(mods, 'shiny').reduce((m, x) => m * x.mod.multiplier ** x.copies, 1);
}

/** Extra EXP from wild battles (White Flute), as a multiplier. */
export function wildExpMultiplier(content: Content, run: RunState): number {
  return 1 + modsOf(activeMods(content, run), 'exp').reduce((sum, m) => sum + m.mod.percent * m.copies, 0) / 100;
}

/** Whether a Repel will keep the next wild battle away. */
export function repelActive(content: Content, run: MapItemRun): boolean {
  return modsOf(activeMods(content, run), 'repel').length > 0;
}

/** The generator for map-item rolls at one map node. */
export function mapItemRng(run: RunState, nodeId: string): Rng {
  return new Rng(hashSeed(`${run.seed}::map-items::${run.regionIndex}::${run.stage?.kind}::${run.stage?.index}::${nodeId}`));
}

const statTotal = (content: Content, id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);

/**
 * Changes the wild Pokémon map items ask for: another type (Incense, Mail),
 * any type (Mosaic Mail), a first-generation Pokémon (Retro Mail), Unown, or
 * the strongest of three (Honey, Dream Mail). Returns `speciesId` unchanged
 * when no item applies.
 */
export function wildSpeciesWithItems(content: Content, run: RunState, theme: Theme, speciesId: string, rng: Rng, mods = activeMods(content, run)): string {
  const regionId = run.regionOrder[run.regionIndex];
  let pool: PoolEntry[] | null = null;
  if (modsOf(mods, 'anyType').length > 0) pool = wildEligibleSpecies(content).map((s) => ({ speciesId: s.id, weight: 1 }));
  for (const { mod, copies } of modsOf(mods, 'types')) {
    if (!rng.chance(Math.min(100, mod.percent * copies) / 100)) continue;
    const types = mod.types
      .map((t) => (t === 'themeFirst' ? theme.types[0] : t === 'themeSecond' ? (theme.types[1] ?? theme.types[0]) : t))
      .filter((t): t is TypeName => t !== undefined);
    pool = typesPool(content, types, regionId);
    break;
  }
  if (modsOf(mods, 'gen1').length > 0) {
    const from = pool ?? typesPool(content, theme.types, regionId);
    const old = from.filter((p) => getSpecies(content, p.speciesId).generation === 1);
    pool = old.length > 0 ? old : from;
  }
  let picked = pool ? rng.weighted(pool.map((p) => ({ item: p.speciesId, weight: p.weight }))) : speciesId;
  if (modsOf(mods, 'rare').length > 0) {
    const from = pool ?? typesPool(content, theme.types, regionId);
    const draws = [picked, ...[0, 1].map(() => rng.weighted(from.map((p) => ({ item: p.speciesId, weight: p.weight }))))];
    picked = draws.reduce((best, id) => (statTotal(content, id) > statTotal(content, best) ? id : best));
  }
  for (const { mod, copies } of modsOf(mods, 'species')) {
    if (content.species.has(mod.species) && rng.chance(Math.min(100, mod.percent * copies) / 100)) picked = mod.species;
  }
  return picked;
}

/** Uses up one wild battle from every "next wild battles" item (mutates `run`). */
export function useWildBattleCharges(run: RunState): void {
  if (!run.mapEffects) return;
  run.mapEffects = run.mapEffects.map((e) => (e.battles !== undefined && e.battles > 0 ? { ...e, battles: e.battles - 1 } : e)).filter((e) => e.battles !== 0);
}

/** Uses up the Repel charge only (the battle is skipped, so the other items wait for the next one). */
export function useRepel(content: Content, run: RunState): string {
  const effects = run.mapEffects ?? [];
  const index = effects.findIndex((e) => {
    const effect = mapItemEffect(content, e.itemId);
    return (e.battles ?? 0) > 0 && effect?.kind === 'encounter' && effect.mods.some((m) => m.mod === 'repel');
  });
  if (index < 0) throw new Error('No Repel is working');
  const e = effects[index]!;
  const name = content.catalog.get(e.itemId)!.name;
  run.mapEffects = effects.map((x, i) => (i === index ? { ...x, battles: x.battles! - 1 } : x)).filter((x) => x.battles !== 0);
  return name;
}

/** Battle set-up from map items for a wild battle: free turns (Poké Doll) and the foe's lowered Speed (Poké Toy). */
export function wildBattleSetup(content: Content, run: RunState, mods = activeMods(content, run)): { freeTurns: number; foeSpeed: number } {
  return {
    freeTurns: modsOf(mods, 'freeTurn').length > 0 ? 1 : 0,
    foeSpeed: modsOf(mods, 'foeSpeed').reduce((sum, m) => sum + m.mod.stages * m.copies, 0),
  };
}

// ---------- ball throws ----------

function catchApplies(content: Content, mod: Extract<EncounterMod, { mod: 'catch' }>, target: PokemonInstance): boolean {
  if (mod.shiny && !target.shiny) return false;
  if (mod.types && !getSpecies(content, target.speciesId).types.some((t) => mod.types!.includes(t))) return false;
  return true;
}

/** Catch-rate multiplier from map items for a throw at `target` (Apricorns, Fluffy Tail). */
export function throwMultiplier(content: Content, run: RunState, target: PokemonInstance): number {
  return modsOf(activeMods(content, run), 'catch').reduce((m, x) => (catchApplies(content, x.mod, target) ? m * x.mod.multiplier : m), 1);
}

/** After a ball is thrown at `target`: each matching "next throws" item uses up one throw (mutates `run`). */
export function useThrowCharges(content: Content, run: RunState, target: PokemonInstance): void {
  if (!run.mapEffects) return;
  run.mapEffects = run.mapEffects
    .map((e) => {
      if (e.throws === undefined || e.throws <= 0) return e;
      const effect = mapItemEffect(content, e.itemId);
      const mods = effect?.kind === 'encounter' ? effect.mods : [];
      const applies = mods.some((m) => m.mod === 'catch' && catchApplies(content, m, target));
      return applies ? { ...e, throws: e.throws - 1 } : e;
    })
    .filter((e) => e.throws !== 0);
}

/** Short text for the map screen: what is working now, e.g. "Repel ×2 · Black Flute". */
export function mapItemSummary(content: Content, run: RunState): string {
  const parts: string[] = [];
  for (const e of run.mapEffects ?? []) {
    const name = content.catalog.get(e.itemId)?.name ?? e.itemId;
    const left = e.battles ?? e.throws ?? e.uses;
    if (left !== undefined) {
      if (left > 0) parts.push(`${name} ×${left}`);
    } else if (e.stage === 'next') parts.push(`${name} (next stage)`);
    else if (isActive(run, e)) parts.push(name);
  }
  // Point Card and Blue Card: points toward the next prize.
  for (const { itemId, perk } of activePerks(content, run)) {
    if (perk.perk === 'points' || perk.perk === 'trainerPoints') parts.push(`${content.catalog.get(itemId)!.name} ${pointsOf(run, itemId)}/${perk.every}`);
  }
  return parts.join(' · ');
}

// ---------- shops and money ----------

const pointsKey = (itemId: string) => `points:${itemId}`;

/** Points collected toward a Point Card or Blue Card prize. */
export function pointsOf(run: Pick<RunState, 'itemCounters'>, itemId: string): number {
  return run.itemCounters?.[pointsKey(itemId)] ?? 0;
}

function addPoints(run: RunState, itemId: string, amount: number): number {
  const total = pointsOf(run, itemId) + amount;
  run.itemCounters = { ...run.itemCounters, [pointsKey(itemId)]: total };
  return total;
}

/** Shop price multiplier from Coupons (0 when the Point Card makes this purchase free). */
export function priceMultiplierFromItems(content: Content, run: MapItemRun & Pick<RunState, 'itemCounters'>): number {
  const perks = activePerks(content, run);
  if (perksOf(perks, 'points').some((p) => pointsOf(run, p.itemId) >= p.perk.every)) return 0;
  return perksOf(perks, 'discount').reduce((m, p) => m * (1 - p.perk.percent / 100), 1);
}

/** After a shop purchase: Coupons are used up, and the Point Card earns a point or pays for this one (mutates `run`). */
export function afterPurchase(content: Content, run: RunState, free: boolean): void {
  useUses(content, run, 'purchases');
  for (const { itemId, perk, copies } of perksOf(activePerks(content, run), 'points')) {
    if (free) addPoints(run, itemId, -perk.every);
    else addPoints(run, itemId, copies);
  }
}

/** How many locked shop entries are for sale early (Member Card, Wepear Berry). */
export function earlyStockCount(content: Content, run: MapItemRun): number {
  return perksOf(activePerks(content, run), 'earlyStock').reduce((sum, p) => sum + p.perk.count * p.copies, 0);
}

/** Extra prize money from a won battle, in percent (Reply Mail, Bead Mail), and a flat amount (Soot Sack). */
export function prizeMoneyFromItems(content: Content, run: RunState, kind: 'wild' | 'trainer', theme: Theme | null): { percent: number; flat: number } {
  const perks = activePerks(content, run);
  const percent = kind === 'trainer' ? perksOf(perks, 'trainerMoney').reduce((sum, p) => sum + p.perk.percent * p.copies, 0) : 0;
  const flat = kind === 'wild' && theme ? perksOf(perks, 'wildMoney').reduce((sum, p) => sum + (theme.types.includes(p.perk.type) ? p.perk.amount * p.copies : 0), 0) : 0;
  return { percent, flat };
}

/**
 * After a trainer win: the Loot Sack finds a Bag item from the cheapest third
 * of `stock`, and the Blue Card counts the win (a Bag item from the dearest
 * third every 10 wins). Uses up "trainers" uses (Reply Mail). Returns the item
 * ids found (mutates `run`).
 */
export function afterTrainerWin(content: Content, run: RunState, stock: readonly { item: string; price: number }[], rng: Rng): string[] {
  const perks = activePerks(content, run);
  useUses(content, run, 'trainers');
  const sorted = [...stock].sort((a, b) => a.price - b.price || a.item.localeCompare(b.item));
  const third = Math.max(1, Math.ceil(sorted.length / 3));
  const found: string[] = [];
  if (sorted.length === 0) return found;
  for (const { copies } of perksOf(perks, 'trainerLoot')) for (let i = 0; i < copies; i++) found.push(rng.pick(sorted.slice(0, third)).item);
  for (const { itemId, perk } of perksOf(perks, 'trainerPoints')) {
    if (addPoints(run, itemId, 1) >= perk.every) {
      addPoints(run, itemId, -perk.every);
      found.push(rng.pick(sorted.slice(-third)).item);
    }
  }
  return found;
}

/** Money when the run reaches a new region (Pass Orb). */
export function regionMoneyFromItems(content: Content, run: RunState): number {
  return perksOf(activePerks(content, run), 'regionMoney').reduce((sum, p) => sum + p.perk.amount * p.copies, 0);
}

// ---------- getting around the map ----------

/** Whether a perk of this kind is working now (run-long copies or charges left). */
export function hasPerk(content: Content, run: MapItemRun, kind: Perk['perk']): boolean {
  return activePerks(content, run).some((p) => p.perk.perk === kind);
}

/** The item giving a perk of this kind, if one is working. */
export function perkItem(content: Content, run: MapItemRun, kind: Perk['perk']): string | null {
  return activePerks(content, run).find((p) => p.perk.perk === kind)?.itemId ?? null;
}

/** Uses left of a manual item (Escape Rope, VS Seeker). */
export function usesLeft(run: Pick<RunState, 'mapEffects'>, itemId: string): number {
  return (run.mapEffects ?? []).reduce((sum, e) => sum + (e.itemId === itemId ? (e.uses ?? 0) : 0), 0);
}

/** Uses up one use of a manual item (mutates `run`). */
export function spendUse(run: RunState, itemId: string): void {
  const index = (run.mapEffects ?? []).findIndex((e) => e.itemId === itemId && (e.uses ?? 0) > 0);
  if (index < 0) throw new Error('That item is used up');
  run.mapEffects = run.mapEffects!.map((e, i) => (i === index ? { ...e, uses: e.uses! - 1 } : e)).filter((e) => e.uses !== 0);
}

const stageUseKey = (run: MapItemRun, itemId: string) => `stage-use:${itemId}:${stageKey(run)}`;

/** Whether a once-per-stage item (the Bikes) was already used on this stage. */
export function usedThisStage(run: MapItemRun & Pick<RunState, 'itemCounters'>, itemId: string): boolean {
  return (run.itemCounters?.[stageUseKey(run, itemId)] ?? 0) > 0;
}

export function markUsedThisStage(run: RunState, itemId: string): void {
  run.itemCounters = { ...run.itemCounters, [stageUseKey(run, itemId)]: 1 };
}

/** Itemfinder: the wild stop on this stage that hides a Bag item (picked by a generator of its own), or null. */
export function hiddenItemNode(content: Content, run: RunState): string | null {
  if (!run.stage || !hasPerk(content, run, 'hiddenItem')) return null;
  const wild = run.stage.map.nodes.filter((n) => n.kind === 'wild');
  if (wild.length === 0) return null;
  return new Rng(hashSeed(`${run.seed}::itemfinder::${stageKey(run)}`)).pick(wild).id;
}

/** Itemfinder: when the player beats or catches the wild Pokémon at the hidden stop, a Bag item from the shop's middle third (mutates `run`). */
export function hiddenItemFound(content: Content, run: RunState, stock: readonly { item: string; price: number }[]): string | null {
  const node = hiddenItemNode(content, run);
  if (!node || run.stage?.current !== node || stock.length === 0) return null;
  const key = `itemfinder:${stageKey(run)}`;
  if ((run.itemCounters?.[key] ?? 0) > 0) return null;
  run.itemCounters = { ...run.itemCounters, [key]: 1 };
  const sorted = [...stock].sort((a, b) => a.price - b.price);
  const third = Math.max(1, Math.floor(sorted.length / 3));
  const middle = sorted.slice(third, Math.max(third + 1, sorted.length - third));
  return new Rng(hashSeed(`${run.seed}::itemfinder-loot::${stageKey(run)}`)).pick(middle.length > 0 ? middle : sorted).item;
}

/** Bike Voucher: the voucher waiting to be traded at the next shop, if any. */
export function voucherOf(content: Content, run: MapItemRun): { itemId: string; item: string; refund: number } | null {
  const v = perksOf(activePerks(content, run), 'voucher')[0];
  return v ? { itemId: v.itemId, item: v.perk.item, refund: v.perk.refund } : null;
}

// ---------- extra map stops ----------

/** The best Rod working now (most choices, then the stronger last one), or null. */
export function fishingRod(content: Content, run: MapItemRun): { choices: number; rare: boolean } | null {
  const rods = perksOf(activePerks(content, run), 'fishing').map((p) => p.perk);
  if (rods.length === 0) return null;
  const best = rods.reduce((a, b) => (b.choices > a.choices || (b.choices === a.choices && b.rare && !a.rare) ? b : a));
  return { choices: best.choices, rare: best.rare };
}

/**
 * When a stage starts: a fishing spot if the player has a Rod, plus the stops
 * Wave, Tropic and Harbor Mail add, each beside a node picked by a generator of
 * its own (mutates `run`). Not in the Pokémon League.
 */
export function addItemStops(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const kinds: ('heal' | 'shop' | 'fish')[] = [];
  if (fishingRod(content, run)) kinds.push('fish');
  for (const p of perksOf(activePerks(content, run), 'extraStop')) if (p.perk.where === 'stage') for (let i = 0; i < p.copies; i++) kinds.push(p.perk.kind);
  if (kinds.length === 0) return;
  const rng = new Rng(hashSeed(`${run.seed}::item-stops::${stageKey(run)}`));
  let count = 0;
  for (const kind of kinds) {
    // Fishing spots sit beside wild stops; every stop avoids the gym column and nodes that already have one of its kind.
    const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && (kind !== 'fish' || n.kind === 'wild') && !n.sides.some((s) => s.kind === kind));
    if (candidates.length === 0) continue;
    rng.pick(candidates).sides.push({ id: `item-stop-${++count}`, kind, used: false });
  }
}

/** Bridge Mail: the node the player just moved to gets the stops it adds (mutates `run`). */
export function addBridgeStops(content: Content, run: RunState, nodeId: string): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const node = findNode(stage.map, nodeId);
  if (node.column >= stage.map.columns) return; // The gym ends the stage: the bridge waits for the next one.
  for (const p of perksOf(activePerks(content, run), 'extraStop')) {
    if (p.perk.where !== 'nextNode') continue;
    for (let i = 0; i < p.copies; i++) {
      node.sides.push({ id: `bridge-${node.sides.length + 1}`, kind: p.perk.kind, used: false });
      spendUse(run, p.itemId);
    }
  }
}
