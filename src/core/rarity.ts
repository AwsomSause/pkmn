// Rarity overhaul (Overhaul slice 10, THE OVERHAUL.md section 4): 8 species tiers in config.
// The spreadsheet's six tiers (availability.json) map onto them; species overrides add Epic (pseudo-legendaries,
// Ultra Beasts, Paradox) and Special; a form or a hard evolution can sit one tier rarer. Shiny is NOT a tier
// (see eggs.json shinyMultiplier). Wild, trainer, fishing and raid pools (via gatePool) and eggs read the same tier.

import { z } from 'zod';
import rarityJson from '../data/rarity.json';
import { availabilityOf } from './availability';
import type { Content } from './contentSchema';
import type { Rng } from './rng';

export type ItemTier = 'common' | 'uncommon' | 'rare' | 'epic';
const ITEM_TIERS: readonly ItemTier[] = ['common', 'uncommon', 'rare', 'epic'];
export const RARITY_TIERS = ['common', 'uncommon', 'rare', 'veryRare', 'epic', 'legendary', 'mythical', 'special'] as const;
export type RarityTier = (typeof RARITY_TIERS)[number];
const TierSchema = z.enum(RARITY_TIERS);

export const RarityFileSchema = z.object({
  status: z.literal('suggested'),
  source: z.string(),
  tiers: z.array(z.object({ id: TierSchema, name: z.string(), color: z.string() })).length(RARITY_TIERS.length),
  /** The spreadsheet's six tiers -> these tiers. */
  sheetMap: z.object({ common: TierSchema, uncommon: TierSchema, rare: TierSchema, veryRare: TierSchema, legendary: TierSchema, mythical: TierSchema }),
  speciesOverrides: z.record(z.string(), TierSchema),
  /** Tiers rarer (+) a form of this kind sits. Gigantamax forms are rarer than their base. */
  formShift: z.object({ regional: z.number().int(), alternate: z.number().int(), mega: z.number().int(), gigantamax: z.number().int(), primal: z.number().int(), battle: z.number().int() }),
  /** Tiers rarer a species sits when it only evolves by this kind of condition. */
  evolutionShift: z.object({ item: z.number().int(), condition: z.number().int(), region: z.number().int() }),
  /** Tiers that ordinary wild encounters never roll (they come from events and rewards). */
  wildBlocked: z.array(TierSchema),
  /** Tiers that never come out of an egg. */
  eggBlocked: z.array(TierSchema),
});
export type RarityFile = z.infer<typeof RarityFileSchema>;
export const RARITY = RarityFileSchema.parse(rarityJson);

const cache = new WeakMap<Content, Map<string, RarityTier>>();
const order = (t: RarityTier): number => RARITY_TIERS.indexOf(t);
/** Moves a tier `by` steps rarer, but only within the ordinary ladder (never into Legendary and beyond). */
const shiftRarer = (t: RarityTier, by: number): RarityTier => (order(t) > order('epic') ? t : RARITY_TIERS[Math.min(order('epic'), order(t) + by)]!);

/** A species' tier: sheet tier, then override, then form and evolution shifts. Species with no sheet row count as Common. */
export function rarityOf(content: Content, speciesId: string): RarityTier {
  let c = cache.get(content);
  if (!c) cache.set(content, (c = new Map()));
  const hit = c.get(speciesId);
  if (hit) return hit;
  const s = content.species.get(speciesId);
  const row = availabilityOf(content, speciesId);
  let tier: RarityTier = row ? RARITY.sheetMap[row.rarity] : 'common';
  if (s?.tags.includes('mythical')) tier = 'mythical';
  else if (s?.tags.includes('legendary') && order(tier) < order('legendary')) tier = 'legendary';
  const over = RARITY.speciesOverrides[speciesId];
  if (over) tier = over;
  else if (s) {
    if (s.form) tier = shiftRarer(tier, RARITY.formShift[s.form.kind]);
    const from = s.evolvesFrom ? content.species.get(s.evolvesFrom) : undefined;
    const ev = from?.evolutions?.find((e) => e.to === s.id);
    if (ev) {
      if ('condition' in ev || 'gender' in ev) tier = shiftRarer(tier, RARITY.evolutionShift.condition);
      if ('region' in ev) tier = shiftRarer(tier, RARITY.evolutionShift.region);
      if ('item' in ev) tier = shiftRarer(tier, RARITY.evolutionShift.item);
    }
  }
  c.set(speciesId, tier);
  return tier;
}

/** A species' tier where it is met: a regional form outside its home region sits `offRegionShift` tiers rarer. */
export function rarityIn(content: Content, speciesId: string, regionId?: string): RarityTier {
  const t = rarityOf(content, speciesId);
  const form = content.species.get(speciesId)?.form;
  if (regionId && form?.kind === 'regional' && form.region && form.region !== regionId) return shiftRarer(t, content.balance.rarityCaps.offRegionShift);
  return t;
}

/** Odds multiplier for ordinary encounters (0 for tiers wild encounters never roll). */
export function wildRarityWeight(content: Content, speciesId: string, regionId?: string): number {
  const t = rarityIn(content, speciesId, regionId);
  return RARITY.wildBlocked.includes(t) ? 0 : content.balance.availability.rarityWeights[t];
}

/** Odds multiplier for egg species (balance.availability.eggRarityWeights). */
export function eggRarityWeight(content: Content, speciesId: string): number {
  const t = rarityOf(content, speciesId);
  return RARITY.eggBlocked.includes(t) ? 0 : content.balance.availability.eggRarityWeights[t];
}

/** Picks one species by egg rarity, using exactly one roll. Falls back to the whole list if every weight is 0. */
export function pickEggSpecies<T extends { id: string }>(content: Content, list: readonly T[], rng: Rng): T {
  const w = list.map((s) => eggRarityWeight(content, s.id));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return list[Math.floor(rng.float() * list.length)]!;
  let r = rng.float() * total;
  for (let i = 0; i < list.length; i++) { r -= w[i]!; if (r < 0) return list[i]!; }
  return list[list.length - 1]!;
}

/** True when a Trade Post offer of this species is within the trade rarity cap (balance.rarityCaps.trade). */
export const tradeAllowed = (content: Content, speciesId: string): boolean => order(rarityOf(content, speciesId)) <= order(content.balance.rarityCaps.trade);

const itemOrder = (tier: string | undefined): number => (tier ? ITEM_TIERS.indexOf(tier as ItemTier) : -1);

/** True when a shop may sell an item of this tier. */
export const shopTierAllowed = (content: Content, tier: string | undefined): boolean => itemOrder(tier) <= itemOrder(content.balance.rarityCaps.shopItem);

/** The rarest item tier a reward draft may offer with this many badges. */
export function rewardTierCap(content: Content, badges: number): ItemTier {
  let cap: ItemTier = content.balance.rarityCaps.rewardItem[0]!.max;
  let best = -1;
  for (const row of content.balance.rarityCaps.rewardItem) if (row.badges <= badges && row.badges > best) { best = row.badges; cap = row.max; }
  return cap;
}

/** True when a reward draft with this many badges may offer an item of this tier. */
export const rewardTierAllowed = (content: Content, tier: string | undefined, badges: number): boolean => itemOrder(tier) <= itemOrder(rewardTierCap(content, badges));
