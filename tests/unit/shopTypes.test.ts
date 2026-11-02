import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { SHOP_TYPE_IDS, SHOP_TYPES_READY, shopScreenType, shopTypeAt, type ShopPlace } from '../../src/core/shopTypes';
import { chooseStarter, createRun, isBlackMarket, shopBadgesNeeded, shopPrice, shopSaleItem, shopStock } from '../../src/core/run';
import { shopView } from '../../src/ui/shopLook';
import { content } from './helpers';

const place = (over: Partial<ShopPlace> = {}): ShopPlace => ({ seed: 's', regionIndex: 0, stageIndex: 0, nodeId: 'n1', period: 'morning', blackMarket: false, ...over });

describe('shop types (shops redesign)', () => {
  it('the same place always gives the same type, and places spread over every daytime type', () => {
    expect(shopTypeAt(place())).toBe(shopTypeAt(place()));
    const seen = new Set(Array.from({ length: 200 }, (_, i) => shopTypeAt(place({ nodeId: `n${i}` }))));
    for (const t of SHOP_TYPE_IDS.filter((t) => t !== 'night')) expect(seen.has(t)).toBe(true);
    expect(seen.has('night')).toBe(false);
  });

  it('night time and the Black Market make it a Night Market', () => {
    expect(shopTypeAt(place({ period: 'night' }))).toBe('night');
    expect(shopTypeAt(place({ blackMarket: true }))).toBe('night');
    expect(shopTypeAt(place({ period: 'evening' }))).not.toBe('night');
  });

  it('an unbuilt type draws as the Poké Mart; an override only wins when built', () => {
    for (let i = 0; i < 50; i++) expect(SHOP_TYPES_READY).toContain(shopScreenType(place({ nodeId: i })));
    expect(shopScreenType(place(), 'boutique')).toBe('boutique');
    expect(shopScreenType(place({ period: 'night' }), 'nonsense')).toBe('mart');
  });
});

describe('shop view (what every style draws)', () => {
  const run = () => chooseStarter(content, createRun(content, { runId: 'r', seed: 'shop-view', archetypeId: 'red' }), 0);
  const view = (r: ReturnType<typeof run>) =>
    shopView(content, r, {
      stock: shopStock(content, r),
      price: (e) => shopPrice(content, r, e),
      basePrice: (e) => shopPrice(content, r, e),
      badgesFor: (e) => shopBadgesNeeded(content, r, e),
      saleItem: shopSaleItem(content, r),
      isBlack: (e) => isBlackMarket(content, r, e),
      canSell: false,
      working: null,
    });

  it('lists the stock in order with prices, money and the next stock line', () => {
    const r = run();
    r.money = 300;
    const v = view(r);
    expect(v.rows.map((x) => x.itemId)).toEqual(shopStock(content, r).map((e) => e.item));
    expect(v.money).toBe(300);
    expect(v.nextStock).toMatch(/^New stock at \d+ badges$/);
    for (const row of v.rows) expect(row.affordable).toBe(row.price <= 300);
    for (const row of v.rows) expect(row.problem === null).toBe(row.affordable);
  });

  it('an evolution stone names the party members who can use it', () => {
    const r = run();
    r.badges = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const pika = createPokemon(content, 'pikachu', 20, 'pika');
    r.party.push(pika);
    const stone = view(r).rows.find((x) => x.itemId === 'thunder-stone');
    expect(stone?.users).toEqual(['pika']);
    expect(view(r).rows.find((x) => x.itemId === 'poke-ball')?.users).toBeNull();
  });
});
