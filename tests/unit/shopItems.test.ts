// Milestone 8.75, slice 3b-1: shop and money items (Coupons, Point Card,
// Member Card, Wepear Berry, Reply and Bead Mail, Soot Sack, Loot Sack,
// Blue Card, Pass Orb).

import { describe, expect, it } from 'vitest';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { nextChoices } from '../../src/core/map';
import { afterTrainerWin, mapItemSummary, pointsOf, regionMoneyFromItems, startStageEffects } from '../../src/core/mapItems';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { buyItem, chooseNode, chooseStarter, createRun, debugJumpToColumn, leaveShop, shopPrice, shopStock, takeTurn, visitSide, type TurnResult } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

function newRun(seed = 'shop-items'): RunState {
  const run = chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
  run.money = 100_000;
  return run;
}

function take(run: RunState, id: string, times = 1): RunState {
  for (let i = 0; i < times; i++) applyCatalog(content, run, getCatalogEntry(content, id), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
  return run;
}

/** Puts the run in a shop beside the first map node. */
function inShop(run: RunState): RunState {
  const node = run.stage!.map.nodes[0]!;
  node.sides = [{ id: 'test-shop', kind: 'shop', used: false }];
  run.stage!.current = node.id;
  return visitSide(content, run, 'test-shop').run;
}

const ball = content.shop.find((e) => e.item === 'poke-ball')!;

describe('Coupons', () => {
  it('lower the next purchase only', () => {
    let run = inShop(take(newRun(), 'coupon-2'));
    const full = shopPrice(content, inShop(newRun()), ball);
    expect(shopPrice(content, run, ball)).toBe(Math.round(full * 0.75));
    const money = run.money;
    run = buyItem(content, run, 'poke-ball').run;
    expect(money - run.money).toBe(Math.round(full * 0.75));
    expect(shopPrice(content, run, ball)).toBe(full);
    expect(run.mapEffects).toEqual([]);
  });

  it('stack with each other for one purchase', () => {
    const run = inShop(take(take(newRun(), 'coupon-3'), 'coupon-1'));
    const full = shopPrice(content, inShop(newRun()), ball);
    expect(shopPrice(content, run, ball)).toBe(Math.round(full * 0.5 * 0.9));
    expect(mapItemSummary(content, run)).toBe('Coupon 3 ×1 · Coupon 1 ×1');
  });
});

describe('Point Card', () => {
  it('every 10th purchase is free', () => {
    let run = inShop(take(newRun(), 'point-card'));
    for (let i = 0; i < 10; i++) run = buyItem(content, run, 'poke-ball').run;
    expect(pointsOf(run, 'point-card')).toBe(10);
    expect(shopPrice(content, run, ball)).toBe(0);
    const money = run.money;
    run = buyItem(content, run, 'poke-ball').run;
    expect(run.money).toBe(money);
    expect(pointsOf(run, 'point-card')).toBe(0);
    expect(shopPrice(content, run, ball)).toBeGreaterThan(0);
  });
});

describe('Member Card and Wepear Berry', () => {
  const locked = (run: RunState) => content.shop.filter((e) => !shopStock(content, { ...run, mapEffects: [], passives: {} }).includes(e));

  it('the Member Card sells the next locked item early, every visit', () => {
    const run = take(newRun(), 'member-card');
    const plain = shopStock(content, newRun());
    const stock = shopStock(content, run);
    expect(stock).toHaveLength(plain.length + 1);
    const early = stock.find((e) => !plain.includes(e))!;
    expect(early.minBadges).toBe(Math.min(...locked(run).map((e) => e.minBadges)));
    const shop = inShop(run);
    expect(buyItem(content, shop, early.item).run.inventory[early.item]).toBe(1);
    expect(shopStock(content, leaveShop(content, shop))).toHaveLength(plain.length + 1);
  });

  it('a Wepear Berry adds one for a single shop visit; other locked items still need badges', () => {
    const shop = inShop(take(newRun(), 'wepear-berry'));
    const plain = shopStock(content, newRun()).length;
    expect(shopStock(content, shop)).toHaveLength(plain + 1);
    const stillLocked = content.shop.find((e) => !shopStock(content, shop).includes(e))!;
    expect(() => buyItem(content, shop, stillLocked.item)).toThrow(/badges/);
    expect(shopStock(content, leaveShop(content, shop))).toHaveLength(plain);
  });
});

/** Fights the next node of `kind` with a level 100 lead until the battle ends. */
function winNext(run: RunState, kind: 'wild' | 'trainer'): TurnResult {
  if (kind === 'trainer') run = debugJumpToColumn(run, run.stage!.map.trainerColumns[0]!);
  const node = nextChoices(run.stage!).find((n) => n.kind === kind && !n.harder) ?? nextChoices(run.stage!).find((n) => n.kind === kind)!;
  run = chooseNode(content, run, node.id);
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 50 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    turn = takeTurn(content, run, { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

describe('prize money', () => {
  it('Reply Mail doubles the next trainer win, then is used up', () => {
    const plain = winNext(newRun('reply'), 'trainer');
    const mail = winNext(take(newRun('reply'), 'reply-mail'), 'trainer');
    expect(mail.end!.moneyGained).toBe(plain.end!.moneyGained * 2);
    expect(mail.run.mapEffects).toEqual([]);
  });

  it("Reply Mail isn't used up by wild battles", () => {
    const wild = winNext(take(newRun('reply'), 'reply-mail'), 'wild');
    expect(mapItemSummary(content, wild.run)).toBe('Reply Mail ×1');
  });

  it('Bead Mail: +25% from trainers on the next stage', () => {
    const later = newRun('bead');
    later.stage!.index += 1;
    const plain = winNext(later, 'trainer');
    const run = take(newRun('bead'), 'bead-mail');
    expect(mapItemSummary(content, run)).toBe('Bead Mail (next stage)');
    // The same map, counted as the next stage.
    run.stage!.index += 1;
    startStageEffects(run);
    expect(mapItemSummary(content, run)).toBe('Bead Mail');
    expect(winNext(run, 'trainer').end!.moneyGained).toBe(Math.floor(plain.end!.moneyGained * 1.25));
  });

  it('Soot Sack: +₽20 per copy from wild battles on Fire stages only', () => {
    const fire = newRun('soot');
    fire.stage!.themeId = [...content.themes.values()].find((t) => t.types.includes('fire'))!.id;
    const plain = winNext(structuredClone(fire), 'wild');
    const sacks = winNext(take(structuredClone(fire), 'soot-sack', 2), 'wild');
    expect(sacks.end!.moneyGained).toBe(plain.end!.moneyGained + 40);
    const other = newRun('soot');
    other.stage!.themeId = [...content.themes.values()].find((t) => !t.types.includes('fire'))!.id;
    expect(winNext(take(structuredClone(other), 'soot-sack'), 'wild').end!.moneyGained).toBe(winNext(structuredClone(other), 'wild').end!.moneyGained);
  });

  it('Pass Orbs: ₽200 each in a new region', () => {
    expect(regionMoneyFromItems(content, take(newRun(), 'pass-orb', 3))).toBe(600);
  });
});

describe('Loot Sack and Blue Card', () => {
  it('the Loot Sack finds a cheap Bag item after each trainer win', () => {
    const turn = winNext(take(newRun('loot'), 'loot-sack'), 'trainer');
    expect(turn.end!.itemsFound).toHaveLength(1);
    const id = turn.end!.itemsFound[0]!;
    expect(turn.run.inventory[id]).toBeGreaterThanOrEqual(1);
    const prices = shopStock(content, turn.run).map((e) => e.price).sort((a, b) => a - b);
    expect(content.shop.find((e) => e.item === id)!.price).toBeLessThanOrEqual(prices[Math.ceil(prices.length / 3) - 1]!);
    expect(winNext(newRun('loot'), 'trainer').end!.itemsFound).toEqual([]);
  });

  it('the Blue Card gives a dear Bag item every 10 trainer wins', () => {
    const run = take(newRun(), 'blue-card');
    const stock = shopStock(content, run).map((e) => ({ item: e.item, price: e.price }));
    const rng = new Rng(hashSeed('blue'));
    const found: string[] = [];
    for (let i = 0; i < 10; i++) found.push(...afterTrainerWin(content, run, stock, rng));
    expect(found).toHaveLength(1);
    expect(pointsOf(run, 'blue-card')).toBe(0);
    const prices = stock.map((s) => s.price).sort((a, b) => a - b);
    expect(stock.find((s) => s.item === found[0])!.price).toBeGreaterThanOrEqual(prices[prices.length - Math.ceil(prices.length / 3)]!);
  });
});
