// Hub Town's Strange Merchant (spec 2026-11-01 §5): a few odd items each local day, one of each, paid in Bank Credits.
// What you buy waits as the next run's boon (Pocket Town's profile.town.boon.items, handed over by townStartGrants),
// so it is never an unlimited power source: limited stock, one per item per day, and the boon's own item cap.
// Pure; the stock comes from a hash of the day (its own stream), never from gameplay RNG.

import { z } from 'zod';
import json from '../../data/hubMerchant.json';
import { hashSeed, Rng } from '../rng';
import type { Profile } from '../state';
import { freshTown } from '../town/schema';
import { TOWN } from '../town/schema';

export const HubMerchantSchema = z.object({
  note: z.string(),
  stockSize: z.number().int().min(1),
  pool: z.array(z.object({ item: z.string().min(1), price: z.number().int().positive(), line: z.string() })).min(1),
});
export const HUB_MERCHANT = HubMerchantSchema.parse(json);
export type MerchantWare = (typeof HUB_MERCHANT.pool)[number];

/** Today's wares (the same all day, different tomorrow). */
export function merchantStock(day: string, merchant = HUB_MERCHANT): MerchantWare[] {
  const rng = new Rng(hashSeed(`hubtown-merchant::${day}`));
  const pool = [...merchant.pool];
  const out: MerchantWare[] = [];
  while (out.length < merchant.stockSize && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  return out;
}

/** Items already bought today (yesterday's list no longer counts). */
export function boughtToday(p: Pick<Profile, 'hubTown'>, day: string): string[] {
  return p.hubTown.merchantDay === day ? p.hubTown.bought : [];
}

/** Why a ware cannot be bought now, or null. */
export function merchantProblem(p: Profile, ware: MerchantWare, day: string): string | null {
  if (!merchantStock(day).some((w) => w.item === ware.item)) return 'Not in stock today.';
  if (boughtToday(p, day).includes(ware.item)) return 'Sold out. Come back tomorrow.';
  if (p.bankCredits < ware.price) return `Needs ${ware.price} Bank Credits.`;
  const boon = (p.town ?? freshTown()).boon.items;
  if (Object.keys(boon).length >= TOWN.caps.boonItems && !(ware.item in boon)) return 'Your pack for the next run is full.';
  return null;
}

/** Buy one ware: pay, mark it sold for today and put it in the next run's boon. Returns a new profile (or the same one if refused). */
export function buyFromMerchant(p: Profile, item: string, day: string): Profile {
  const ware = HUB_MERCHANT.pool.find((w) => w.item === item);
  if (!ware || merchantProblem(p, ware, day)) return p;
  const town = structuredClone(p.town ?? freshTown());
  town.boon.items[item] = (town.boon.items[item] ?? 0) + 1;
  return {
    ...p,
    bankCredits: p.bankCredits - ware.price,
    town,
    hubTown: { ...p.hubTown, merchantDay: day, bought: [...boughtToday(p, day), item] },
  };
}
