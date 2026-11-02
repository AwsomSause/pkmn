// Shop types (shops redesign, Kice 2026-11-02; mock-ups in project files `redesign/shops/`). Kice picked six
// looks as different kinds of shop: Poké Mart (Shop Channel, mock-up 03), Boutique (Aero Carousel, 08),
// Kecleon's Bazaar (07), Supply Depot (Basket & Register, 05), PokéNet (web store, 10) and Night Market (12).
// Which kind a shop stop is comes from a hash of the run seed and the stop's place, never from gameplay RNG,
// so no roll changes (it lives in core because the shop type will decide stock and perks, Kice 2026-11-02). Night Market is the shop after dark and wherever Giovanni's Black Market runs.

import { hashSeed } from './rng';

export const SHOP_TYPE_IDS = ['mart', 'boutique', 'bazaar', 'depot', 'pokenet', 'night'] as const;
export type ShopTypeId = (typeof SHOP_TYPE_IDS)[number];

export const SHOP_TYPE_LABELS: Record<ShopTypeId, string> = {
  mart: 'Poké Mart',
  boutique: 'Aero Boutique',
  bazaar: "Kecleon's Bazaar",
  depot: 'Supply Depot',
  pokenet: 'PokéNet Shop',
  night: 'Night Market',
};

/** The types with a built screen; the rest draw as the Poké Mart until their slice lands. */
export const SHOP_TYPES_READY: readonly ShopTypeId[] = ['mart', 'boutique'];

/** How often each daytime type turns up (Night Market is decided by the clock, not by weight). */
export const SHOP_TYPE_WEIGHTS: Record<Exclude<ShopTypeId, 'night'>, number> = { mart: 40, boutique: 15, bazaar: 15, depot: 15, pokenet: 15 };

export interface ShopPlace {
  seed: string;
  regionIndex: number;
  stageIndex: number;
  nodeId: string | number | null;
  /** The clock period ('morning', 'afternoon', 'evening', 'night'). */
  period: string;
  /** Giovanni's Black Market is open this run. */
  blackMarket: boolean;
}

/** The kind of shop at this place (ignores whether its screen is built yet). */
export function shopTypeAt(place: ShopPlace): ShopTypeId {
  if (place.period === 'night' || place.blackMarket) return 'night';
  const total = Object.values(SHOP_TYPE_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = hashSeed(`${place.seed}::shop-type::${place.regionIndex}::${place.stageIndex}::${place.nodeId}`).a % total;
  for (const [id, w] of Object.entries(SHOP_TYPE_WEIGHTS) as [ShopTypeId, number][]) {
    if (roll < w) return id;
    roll -= w;
  }
  return 'mart';
}

/** The screen a shop draws with: its type when built, else the Poké Mart. A debug override wins when it is built. */
export function shopScreenType(place: ShopPlace, override?: string): ShopTypeId {
  if (override && SHOP_TYPES_READY.includes(override as ShopTypeId)) return override as ShopTypeId;
  const t = shopTypeAt(place);
  return SHOP_TYPES_READY.includes(t) ? t : 'mart';
}
