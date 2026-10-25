// Stage themes (director rule, 2026-10-25): every stage is themed after a pair
// of types, e.g. "Stormy Nightmares" = Electric/Ghost. The theme decides which
// wild Pokémon appear, which trainer classes show up, and which gym leader
// waits at the end. Themes and gym leaders never repeat within a run (D6).

import type { Content, GymLeader, Species, Theme, TrainerClass, TypeName } from './contentSchema';
import { isUsableMove } from './pokemon';
import type { Rng } from './rng';

export function getTheme(content: Content, id: string): Theme {
  const theme = content.themes.get(id);
  if (!theme) throw new Error(`Unknown theme "${id}"`);
  return theme;
}

const sharesType = (types: readonly TypeName[], other: readonly TypeName[]) => types.some((t) => other.includes(t));

const wildCache = new WeakMap<Content, Species[]>();

const baseStatTotal = (s: Species) => Object.values(s.baseStats).reduce((a, b) => a + b, 0);

/**
 * Whether a species can be met in the wild (and drawn for ordinary trainers' teams before
 * evolving): a first-stage species, not legendary or mythical, not a Mega/Gigantamax/battle
 * form, with at least one move the battle engine supports, and base stats no higher than
 * balance.wildMaxBaseStats (which keeps Ultra Beasts and Paradox Pokémon out of early routes).
 */
export function isWildEligible(content: Content, s: Species): boolean {
  if (s.evolutionStage !== 1 || s.tags.includes('legendary') || s.tags.includes('mythical')) return false;
  if (s.form && s.form.kind !== 'regional' && s.form.kind !== 'alternate') return false;
  if (baseStatTotal(s) > content.balance.wildMaxBaseStats) return false;
  return s.learnset.some((e) => isUsableMove(content, e.move));
}

/** Species that can be met in the wild (see isWildEligible). */
export function wildEligibleSpecies(content: Content): Species[] {
  let cached = wildCache.get(content);
  if (!cached) {
    cached = [...content.species.values()].filter((s) => isWildEligible(content, s));
    wildCache.set(content, cached);
  }
  return cached;
}

/** Region eligibility: a species is native to a region if it is from one of the region's generations or is its regional form. */
export function isNative(content: Content, s: Species, regionId: string | undefined): boolean {
  const region = regionId ? content.regions.get(regionId) : undefined;
  if (!region) return false;
  if (s.form?.region) return s.form.region === region.id;
  return region.generations.length === 0 || region.generations.includes(s.generation);
}

export interface PoolEntry {
  speciesId: string;
  weight: number;
}

/**
 * The wild Pokémon of a theme: every wild-eligible species with either of the
 * theme's types. Species with both types are more common (dualTypeWeight), and
 * so are species native to the region (nativeWeight). If the pool is very
 * small it is topped up from balance.wildPool.
 */
export function themePool(content: Content, theme: Theme, regionId?: string): PoolEntry[] {
  return typesPool(content, theme.types, regionId);
}

/** Like themePool, for any list of types (an Elite Four member's speciality, for example). */
export function typesPool(content: Content, types: readonly TypeName[], regionId?: string): PoolEntry[] {
  const { dualTypeWeight, nativeWeight, minThemePool, wildPool } = content.balance;
  const pool: PoolEntry[] = wildEligibleSpecies(content)
    .filter((s) => sharesType(s.types, types))
    .map((s) => ({
      speciesId: s.id,
      weight: (types.length > 1 && types.every((t) => s.types.includes(t)) ? dualTypeWeight : 1) * (isNative(content, s, regionId) ? nativeWeight : 1),
    }));
  if (pool.length < minThemePool) {
    for (const id of wildPool) if (!pool.some((p) => p.speciesId === id)) pool.push({ speciesId: id, weight: 1 });
  }
  return pool;
}

/** Picks a species from the theme, preferring ones that share a type with `prefer` (e.g. a trainer's speciality). */
export function pickThemeSpecies(content: Content, theme: Theme, rng: Rng, prefer?: readonly TypeName[], regionId?: string): string {
  return pickFromPool(content, themePool(content, theme, regionId), rng, prefer);
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
