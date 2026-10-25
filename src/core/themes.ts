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
  const { dualTypeWeight, minThemePool, wildPool } = content.balance;
  const pool: PoolEntry[] = wildEligibleSpecies(content)
    .filter((s) => sharesType(s.types, theme.types))
    .map((s) => ({ speciesId: s.id, weight: theme.types.every((t) => s.types.includes(t)) ? dualTypeWeight : 1 }));
  if (pool.length < minThemePool) {
    for (const id of wildPool) if (!pool.some((p) => p.speciesId === id)) pool.push({ speciesId: id, weight: 1 });
  }
  return pool;
}

/** Picks a species from the theme, preferring ones that share a type with `prefer` (e.g. a trainer's speciality). */
export function pickThemeSpecies(content: Content, theme: Theme, rng: Rng, prefer?: readonly TypeName[]): string {
  const pool = themePool(content, theme);
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
 * A gym leader not met yet this run, preferring one whose speciality matches
 * the theme. Their team is always drawn from the theme.
 */
export function pickGymLeader(content: Content, theme: Theme, used: readonly string[], rng: Rng): GymLeader {
  const all = [...content.gymLeaders.values()];
  const fresh = all.filter((l) => !used.includes(l.id));
  const candidates = fresh.length > 0 ? fresh : all;
  const matching = candidates.filter((l) => sharesType(l.types, theme.types));
  return rng.pick(matching.length > 0 ? matching : candidates);
}

/** Battle background asset for a theme: its first type's arena. */
export function arenaFor(content: Content, theme: Theme): string | undefined {
  return content.arenas[theme.types[0]];
}
