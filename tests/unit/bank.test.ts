import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { buyTier, claimBankMilestones, exchange, presetSlotCount, scavengerBonus, survivalEntry, fortuneBias, tierProblem } from '../../src/core/bank';
import { buyLicense, licenseProblem } from '../../src/core/runPrep';
import { createProfile } from '../../src/core/profile';
import { shopStock } from '../../src/core/run';

const rich = (over = {}) => ({ ...createProfile(content, 'p'), bankCredits: 20000, lifetimeBankCredits: 20000, ...over });

describe('Bank tiers', () => {
  it('start at tier 1 and cost credits one step at a time', () => {
    let p = rich();
    expect(p.bankTier).toBe(1);
    p = buyTier(content, p, 'now');
    expect(p.bankTier).toBe(2);
    expect(p.bankCredits).toBe(20000 - 300);
    expect(presetSlotCount(content, p)).toBe(content.balance.presetSlots + 2);
    expect(tierProblem(content, rich({ bankCredits: 10 }))).toMatch(/need 300/);
  });
  it('stop at tier 5 and mark the claim for the prestige frame', () => {
    let p = rich();
    for (let i = 0; i < 4; i++) p = buyTier(content, p, 'now');
    expect(p.bankTier).toBe(5);
    expect(p.claims['bank:tier:5']).toBeTruthy();
    expect(() => buyTier(content, p, 'now')).toThrow(/top tier/);
  });
  it('gate licenses by tier', () => {
    const p = rich();
    expect(licenseProblem(p, content.licenses.get('fortune')!)).toMatch(/tier 3/);
    expect(() => buyLicense(content, p, 'survival')).toThrow(/tier 4/);
    const p4 = { ...p, bankTier: 4 };
    expect(buyLicense(content, p4, 'survival').licenses).toContain('survival');
  });
});

describe('Exchange Counter', () => {
  it('needs tier 3, then swaps lots both ways', () => {
    expect(() => exchange(content, rich(), 'toPoints')).toThrow(/tier 3/);
    const p = rich({ bankTier: 3, researchPoints: 60 });
    const a = exchange(content, p, 'toPoints');
    expect([a.bankCredits, a.researchPoints]).toEqual([19900, 85]);
    const b = exchange(content, p, 'toCredits');
    expect([b.bankCredits, b.researchPoints]).toEqual([20010, 10]);
    expect(() => exchange(content, rich({ bankTier: 3 }), 'toCredits')).toThrow(/Research Points/);
  });
});

describe('savings milestones', () => {
  it('pay a title once', () => {
    const p = rich({ lifetimeBankCredits: 2100 });
    expect(claimBankMilestones(content, p, 'now')).toEqual(['Saver', 'Banker']);
    expect(claimBankMilestones(content, p, 'now')).toEqual([]);
    expect(p.titles).toEqual(['Saver', 'Banker']);
  });
});

describe('licenses inside a run', () => {
  it('Survival adds a Last Stand Charm to the shop once, from the second badge', () => {
    const base = { badges: [] as string[], archetypeId: 'red' };
    const stock = (licenses: string[], badges: string[]) => shopStock(content, { ...base, badges, licenses } as never).map((e) => e.item);
    expect(stock([], ['a', 'b'])).not.toContain('last-stand-charm');
    expect(stock(['survival'], ['a', 'b'])).toContain('last-stand-charm');
    expect(survivalEntry(content, [])).toBeNull();
  });
  it('Scavenger pays extra only on a lucky roll; Fortune leans the draft', () => {
    expect(scavengerBonus(content, [], { chance: () => true })).toBe(0);
    expect(scavengerBonus(content, ['scavenger'], { chance: () => false })).toBe(0);
    expect(scavengerBonus(content, ['scavenger'], { chance: () => true })).toBe(content.balance.bank.scavenger.money);
    expect(fortuneBias(content, ['fortune'])?.weight).toBeGreaterThan(1);
    expect(fortuneBias(content, [])).toBeNull();
  });
});
