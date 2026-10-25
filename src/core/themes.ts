// Stage themes (director rule, 2026-10-25): every stage is themed after a pair
// of types, e.g. "Stormy Nightmares" = Electric/Ghost. The theme decides which
// wild Pokémon appear, which trainer classes show up, and which gym leader
// waits at the end. Themes and gym leaders never repeat within a run (D6).

import type { Content, GymLeader, Species, Theme, TrainerClass, TypeName } from './contentSchema';
import type { Rng } from './rng';

export function getTheme(content: Content, id: string): Theme {
  const theme = content.themes.get(id);
  if (!theme) throw new Error(`Unknown theme "${id}"`);
  return theme;
}

const sharesType = (types: readonly TypeName[], other: readonly TypeName[]) => types.some((t) => other.includes(t));

const wildCache = new WeakMap<Content, Species[]>();

/** Species that can be met in the wild: no species in the data evolves into them by levelling up. */
export function wildEligibleSpecies(content: Content): Species[] {
  let cached = wildCache.get(content);
  if (!cached) {
    const evolvedForms = new Set([...content.species.values()].flatMap((s) => s.evolutions.map((e) => e.to)));
    cached = [...content.species.values()].filter((s) => !evolvedForms.has(s.id));
    wildCache.set(content, cached);
  }
  return cached;
}

export interface PoolEntry {
  speciesId: string;
  weight: number;
}

/**
 * The wild Pokémon of a theme: every wild-eligible species with either of the
 * theme's types. Species with both types are more common (dualTypeWeight).
 * If the pool is very small it is topped up from balance.wildPool.
 */
export function themePool(content: Content, theme: Theme): PoolEntry[] {
  return typesPool(content, theme.types);
}

/** Like themePool, for any list of types (an Elite Four member's speciality, for example). */
export function typesPool(content: Content, types: readonly TypeName[]): PoolEntry[] {
  const { dualTypeWeight, minThemePool, wildPool } = content.balance;
  const pool: PoolEntry[] = wildEligibleSpecies(content)
    .filter((s) => sharesType(s.types, types))
    .map((s) => ({ speciesId: s.id, weight: types.length > 1 && types.every((t) => s.types.includes(t)) ? dualTypeWeight : 1 }));
  if (pool.length < minThemePool) {
    for (const id of wildPool) if (!pool.some((p) => p.speciesId === id)) pool.push({ speciesId: id, weight: 1 });
  }
  return pool;
}

/** Picks a species from the theme, preferring ones that share a type with `prefer` (e.g. a trainer's speciality). */
export function pickThemeSpecies(content: Content, theme: Theme, rng: Rng, prefer?: readonly TypeName[]): string {
  return pickFromPool(content, themePool(content, theme), rng, prefer);
}

export function pickTypeSpecies(content: Content, types: readonly TypeName[], rng: Rng): string {
  return pickFromPool(content, typesPool(content, types), rng);
}

function pickFromPool(content: Content, pool: PoolEntry[], rng: Rng, prefer?: readonly TypeName[]): string {
  const preferred = prefer ? pool.filter((p) => sharesType(content.species.get(p.speciesId)!.types, prefer)) : [];
  const from = preferred.length > 0 ? preferred : pool;
  return rng.weighted(from.map((p) => ({ item: p.speciesId, weight: p.weight })));
}

/** A theme not used yet this run (any theme once all have been used). */
export function pickTheme(content: Content, used: readonly string[], rng: Rng): Theme {
  const all = [...content.themes.values()];
  const fresh = all.filter((t) => !used.includes(t.id));
  return rng.pick(fresh.length > 0 ? fresh : all);
}

/** Trainer classes that fit the theme (sharing a type), or every class if none do. */
export function trainerClassesFor(content: Content, theme: Theme): TrainerClass[] {
  const all = [...content.trainers.values()];
  const fitting = all.filter((c) => sharesType(c.types, theme.types));
  return fitting.length > 0 ? fitting : all;
}

/**
 * A gym leader not met yet this run. In order of preference: one from this
 * region whose speciality matches the theme, any from this region, any whose
 * speciality matches, anyone unused, then anyone. Their team is always drawn
 * from the theme. `regionPool` empty means the region has no leaders of its own.
 */
export function pickGymLeader(content: Content, theme: Theme, used: readonly string[], rng: Rng, regionPool: readonly string[] = []): GymLeader {
  const all = [...content.gymLeaders.values()];
  const fresh = all.filter((l) => !used.includes(l.id));
  const local = fresh.filter((l) => regionPool.includes(l.id));
  const matches = (list: GymLeader[]) => list.filter((l) => sharesType(l.types, theme.types));
  for (const list of [matches(local), local, matches(fresh), fresh, all]) if (list.length > 0) return rng.pick(list);
  throw new Error('There are no gym leaders');
}

/** Battle background asset for a theme: its first type's arena. */
export function arenaFor(content: Content, theme: Theme): string | undefined {
  return content.arenas[theme.types[0]];
}
