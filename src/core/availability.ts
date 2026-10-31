// Spreadsheet availability (left-out plan 0.1): Kice's Pokemon_Spreadsheet.xlsx gives every
// species a minimum level and a rarity (availability.json, `npm run data:availability`).
// A species whose minimum level is more than balance.availability.levelSlack above the
// encounter's level is not unlocked yet and has zero odds in ordinary wild and trainer
// encounters, fishing and raid dens; rarity scales the odds of the ones that are.
// Forms share their base species' row (same Pokédex number); species with no row are never gated.

import { z } from 'zod';
import availabilityJson from '../data/availability.json';
import type { Content } from './contentSchema';
import type { PoolEntry } from './themes';

export const AVAILABILITY_RARITIES = ['common', 'uncommon', 'rare', 'veryRare', 'legendary', 'mythical'] as const;
export type AvailabilityRarity = (typeof AVAILABILITY_RARITIES)[number];

export const AvailabilityRowSchema = z.object({
  rarity: z.enum(AVAILABILITY_RARITIES),
  difficulty: z.number().int().min(1).max(10),
  minLevel: z.number().int().min(1).max(100),
  maxLevel: z.number().int().min(1).max(100),
  captureRate: z.number().int().min(0).max(255),
});
export type AvailabilityRow = z.infer<typeof AvailabilityRowSchema>;
export const AvailabilityFileSchema = z.object({ status: z.literal('suggested'), source: z.string(), species: z.record(z.string(), AvailabilityRowSchema) });

const FILE = AvailabilityFileSchema.parse(availabilityJson);

const rowCache = new WeakMap<Content, Map<string, AvailabilityRow | null>>();

/** The spreadsheet row for a species, or its base species' row (same Pokédex number) for a form; null when there is none. */
export function availabilityOf(content: Content, speciesId: string): AvailabilityRow | null {
  let cache = rowCache.get(content);
  if (!cache) {
    cache = new Map();
    const byDex = new Map<number, AvailabilityRow>();
    for (const [id, row] of Object.entries(FILE.species)) {
      const s = content.species.get(id);
      if (s && !s.form) byDex.set(s.dex, row);
    }
    for (const s of content.species.values()) cache.set(s.id, FILE.species[s.id] ?? byDex.get(s.dex) ?? null);
    rowCache.set(content, cache);
  }
  return cache.get(speciesId) ?? null;
}

/** The level at which a species unlocks for ordinary encounters: its minimum level minus the slack (1 without a row). */
export function unlockLevel(content: Content, speciesId: string): number {
  const row = availabilityOf(content, speciesId);
  return row ? Math.max(1, row.minLevel - content.balance.availability.levelSlack) : 1;
}

export const isUnlockedAt = (content: Content, speciesId: string, level: number): boolean => unlockLevel(content, speciesId) <= level;

/** Odds multiplier from the spreadsheet rarity (1 without a row). */
export function availabilityWeight(content: Content, speciesId: string): number {
  const row = availabilityOf(content, speciesId);
  return row ? content.balance.availability.rarityWeights[row.rarity] : 1;
}

/**
 * Keeps the pool's species unlocked at `level`, with their odds scaled by rarity. If fewer than
 * balance.minThemePool are unlocked, the earliest-unlocking locked ones fill the gap (a bounded
 * fallback, so a theme is never empty); `fallbacks` names them.
 */
export function gatePool(content: Content, pool: readonly PoolEntry[], level: number): { pool: PoolEntry[]; fallbacks: string[] } {
  const open = pool.filter((p) => isUnlockedAt(content, p.speciesId, level));
  const need = Math.max(0, Math.min(pool.length, content.balance.minThemePool) - open.length);
  const extra = need === 0 ? [] : pool
    .filter((p) => !isUnlockedAt(content, p.speciesId, level))
    .sort((a, b) => unlockLevel(content, a.speciesId) - unlockLevel(content, b.speciesId) || a.speciesId.localeCompare(b.speciesId))
    .slice(0, need);
  const scale = (p: PoolEntry): PoolEntry => ({ speciesId: p.speciesId, weight: p.weight * availabilityWeight(content, p.speciesId) });
  return { pool: [...open, ...extra].map(scale), fallbacks: extra.map((p) => p.speciesId) };
}
