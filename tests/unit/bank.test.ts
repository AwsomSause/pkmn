import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { buyTier, claimBankMilestones, exchange, presetSlotCount, scavengerBonus, bankShopEntries, claimRegionAccounts, vaultDeposit, vaultTake, loanDue, runBankFlags, fortuneBias, tierProblem } from '../../src/core/bank';
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
    expect(bankShopEntries(content, [])).toEqual([]);
  });
  it('Scavenger pays extra only on a lucky roll; Fortune leans the draft', () => {
    expect(scavengerBonus(content, [], { chance: () => true })).toBe(0);
    expect(scavengerBonus(content, ['scavenger'], { chance: () => false })).toBe(0);
    expect(scavengerBonus(content, ['scavenger'], { chance: () => true })).toBe(content.balance.bank.scavenger.money);
    expect(fortuneBias(content, ['fortune'])?.weight).toBeGreaterThan(1);
    expect(fortuneBias(content, [])).toBeNull();
  });
});

describe('Regional Accounts, Vault and loans', () => {
  it('a cleared region opens its account once; tier 4 adds its item to the shop', () => {
    const p = rich({ bankTier: 4 });
    expect(claimRegionAccounts(content, p, ['kanto', 'nowhere'], 'now')).toEqual(['kanto']);
    expect(claimRegionAccounts(content, p, ['kanto'], 'now')).toEqual([]);
    expect(runBankFlags(p)).toContain('region:kanto');
    expect(runBankFlags({ ...p, bankTier: 3 })).not.toContain('region:kanto');
    expect(bankShopEntries(content, ['region:kanto']).map((e) => e.item)).toEqual([content.balance.bank.regional.kanto!.item]);
  });
  it('the Vault keeps one rare held item at tier 5, up to its slots, and gives it back once', () => {
    const run = { inventory: { 'last-stand-charm': 1, 'poke-ball': 5, 'focus-sash': 1 } };
    expect(vaultDeposit(content, rich({ bankTier: 4 }), run)).toBeNull();
    const p = rich({ bankTier: 5 });
    expect(vaultDeposit(content, p, run)).toBe('focus-sash');
    vaultDeposit(content, p, run);
    vaultDeposit(content, p, run);
    expect(vaultDeposit(content, p, run)).toBeNull();
    expect(p.vault).toHaveLength(content.balance.bank.vault.slots);
    expect(vaultTake(p, 'focus-sash')).toBe(true);
    expect(vaultTake(p, 'nothing')).toBe(false);
  });
  it('an unpaid loan costs credits, a repaid one nothing', () => {
    const l = content.balance.bank.loan;
    const prep = { loan: true } as never;
    expect(loanDue(content, { prep, badges: [] })).toBe(l.penalty);
    expect(loanDue(content, { prep, badges: Array(l.badges).fill('b') })).toBe(0);
    expect(loanDue(content, { prep: { loan: false } as never, badges: [] })).toBe(0);
  });
});

import { draftStarters, defaultPrep, withTokenAttribute, startingResources } from '../../src/core/runPrep';
import { Rng, hashSeed } from '../../src/core/rng';
import { licenseNote } from '../../src/core/license';
import { chooseStarter, createRun } from '../../src/core/run';

describe('draft modifiers and tokens', () => {
  const prepOf = (draftRuleId: string, poolId = 'classic') => ({ ...defaultPrep(content), draftRuleId, poolId });
  const draft = (rule: string, seed: string, pool?: string) => draftStarters(content, new Rng(hashSeed(seed)), prepOf(rule, pool));
  it('every new rule drafts three distinct starters, deterministically', () => {
    for (const rule of ['expanded-research', 'regional-research', 'rare-specimen', 'evolution-specialist']) {
      for (let i = 0; i < 20; i++) {
        const a = draft(rule, `s${i}`);
        expect(new Set(a.choices).size, rule).toBe(content.balance.starterChoices);
        expect(draft(rule, `s${i}`).choices).toEqual(a.choices);
      }
    }
  });
  it('Evolution Specialist prefers lines that evolve twice; Regional keeps one home region', () => {
    const chain = (id: string) => content.species.get(id)!.evolutions.some((e) => content.species.get(e.to)!.evolutions.length > 0);
    const hit = draft('evolution-specialist', 'x');
    expect(hit.choices.filter(chain).length).toBeGreaterThanOrEqual(1);
    expect(draft('regional-research', 'y').note).toBeTruthy();
  });
  it('tokens: attribute bonus and first-region intel', () => {
    const prep = { ...defaultPrep(content), tokenId: 'training-regimen' };
    expect(withTokenAttribute(content, prep, { strength: 0 }).strength).toBe(1);
    expect(startingResources(content, content.archetypes.get('red')!, prep).money).toBe(startingResources(content, content.archetypes.get('red')!, defaultPrep(content)).money);
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'intel', archetypeId: 'red', prep: { ...defaultPrep(content), tokenId: 'scout-report' } }), 0);
    expect(licenseNote(content, run)).toMatch(/uses .* Pokémon/);
    expect(licenseNote(content, { ...run, regionIndex: 1 })).toBeNull();
  });
});
