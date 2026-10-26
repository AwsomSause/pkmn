// Map and encounter items (M8.75 item effects, slice 3a): Repels, Flutes,
// Incense, Mail, the Poké Doll, Apricorns and friends. Data: catalog entries
// with `effect.kind: "encounter"`. How long each lasts:
//   - "battles" / "throws": charges in run.mapEffects, used up one per wild battle / matching ball throw;
//   - "stage": the rest of the current stage; "nextStage": the whole next stage;
//   - "run": a run-long perk, counted in run.passives like the Amulet Coin.
// Every random choice here uses a generator of its own, seeded from the run
// seed and the map node, so a run that doesn't use these items plays exactly
// as before, and the items never change another stream's rolls.

import type { CatalogEntry, Content, EncounterMod, Theme, TypeName } from './contentSchema';
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

type MapEffect = NonNullable<RunState['mapEffects']>[number];

/** Names the current stage, so "rest of the stage" effects know when it has ended. */
export function stageKey(run: RunState): string | null {
  return run.stage ? `${run.regionIndex}:${run.stage.kind}:${run.stage.index}` : null;
}

function encounterEffect(content: Content, itemId: string) {
  const effect = content.catalog.get(itemId)?.effect;
  return effect?.kind === 'encounter' ? effect : null;
}

function isActive(run: RunState, e: MapEffect): boolean {
  if (e.battles !== undefined) return e.battles > 0;
  if (e.throws !== undefined) return e.throws > 0;
  return e.stage !== undefined && e.stage === stageKey(run);
}

/** Every map-item effect working right now. */
export function activeMods(content: Content, run: RunState): ActiveMod[] {
  const out: ActiveMod[] = [];
  for (const [itemId, copies] of Object.entries(run.passives ?? {})) {
    const effect = encounterEffect(content, itemId);
    if (effect?.lasts.for === 'run') for (const mod of effect.mods) out.push({ itemId, mod, copies });
  }
  const counts = new Map<string, number>();
  for (const e of run.mapEffects ?? []) if (isActive(run, e)) counts.set(e.itemId, (counts.get(e.itemId) ?? 0) + 1);
  for (const [itemId, copies] of counts) {
    for (const mod of encounterEffect(content, itemId)?.mods ?? []) out.push({ itemId, mod, copies });
  }
  return out;
}

function modsOf<K extends EncounterMod['mod']>(all: ActiveMod[], kind: K): (ActiveMod & { mod: Extract<EncounterMod, { mod: K }> })[] {
  return all.filter((m) => m.mod.mod === kind) as (ActiveMod & { mod: Extract<EncounterMod, { mod: K }> })[];
}

/** How many of this item the run holds now (for its max): charges left, stage effects waiting or working, or run-long copies. */
export function mapItemCopies(run: RunState, entry: CatalogEntry): number {
  const effect = entry.effect;
  if (effect?.kind !== 'encounter') return 0;
  if (effect.lasts.for === 'run') return run.passives?.[entry.id] ?? 0;
  let total = 0;
  for (const e of run.mapEffects ?? []) {
    if (e.itemId !== entry.id) continue;
    if (e.battles !== undefined) total += e.battles;
    else if (e.throws !== undefined) total += e.throws;
    else if (e.stage === 'next' || isActive(run, e)) total += 1;
  }
  return total;
}

/** Adds a map item taken from the draft (mutates `run`). Run-long items are counted by the caller in run.passives. */
export function addMapItem(content: Content, run: RunState, entry: CatalogEntry): void {
  const effect = encounterEffect(content, entry.id);
  if (!effect) throw new Error(`${entry.name} is not a map item`);
  const lasts = effect.lasts;
  if (lasts.for === 'run') return;
  const effects = [...(run.mapEffects ?? [])].filter((e) => e.stage === 'next' || isActive(run, e));
  if (lasts.for === 'battles' || lasts.for === 'throws') {
    const key = lasts.for;
    const existing = effects.find((e) => e.itemId === entry.id && e[key] !== undefined);
    if (existing) existing[key] = existing[key]! + lasts.count;
    else effects.push({ itemId: entry.id, [key]: lasts.count });
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
    .filter((e) => (e.battles ?? 1) > 0 && (e.throws ?? 1) > 0);
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
export function repelActive(content: Content, run: RunState): boolean {
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
  const index = effects.findIndex((e) => (e.battles ?? 0) > 0 && encounterEffect(content, e.itemId)?.mods.some((m) => m.mod === 'repel'));
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
      const mods = encounterEffect(content, e.itemId)?.mods ?? [];
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
    if (e.battles !== undefined && e.battles > 0) parts.push(`${name} ×${e.battles}`);
    else if (e.throws !== undefined && e.throws > 0) parts.push(`${name} ×${e.throws}`);
    else if (e.stage === 'next') parts.push(`${name} (next stage)`);
    else if (isActive(run, e)) parts.push(name);
  }
  return parts.join(' · ');
}
