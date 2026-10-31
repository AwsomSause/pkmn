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

import { relationshipCounters } from '../../src/core/relationships';
import { createPokemon } from '../../src/core/pokemon';
describe('relationship achievements', () => {
  it('the Relationship category has chains, and counters read from the run', () => {
    const rel = [...content.achievements.values()].filter((a) => a.category === 'relationship');
    expect(rel.length).toBeGreaterThanOrEqual(10);
    const run = chooseStarter(content, createRun(content, { runId: 'rel', seed: 'rel', archetypeId: 'red' }), 0);
    run.party[0]!.friendship = content.balance.friendship.max;
    expect(relationshipCounters(content, run).bestFriends).toBe(1);
    expect(relationshipCounters(content, run).mentorshipsStarted).toBe(0);
  });
});

import { researchLevel, researchLines } from '../../src/core/trainerResearch';
describe('Trainer Research', () => {
  it('grows with finished runs as that trainer', () => {
    const red = content.archetypes.get('red')!;
    const p = rich({ trainerCounters: { red: { runsFinished: 3 } } });
    expect(researchLevel(p, 'red')).toBe(2);
    expect(researchLevel(rich(), 'red')).toBe(0);
    const lines = researchLines(content, p, red);
    expect(lines.some((l) => l.startsWith('Background'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Habits'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Story'))).toBe(false);
    expect(researchLines(content, { ...p, trainerCounters: { red: { runsFinished: 6 } } }, red).some((l) => l.startsWith('Story'))).toBe(true);
  });
});

import { awardLiveAchievements, applyRunToProfile } from '../../src/core/progress';
describe('achievements mid-run', () => {
  it('pay as soon as the run meets them, and never again at run end', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'live', seed: 'live', archetypeId: 'red' }), 0);
    run.log.counters.battlesWon = 1;
    const p = createProfile(content, 'p');
    const earned = awardLiveAchievements(content, p, run, '2026-10-31T00:00:00Z');
    expect(earned.map((a) => a.id)).toContain('first-steps');
    expect(p.achievements['first-steps']).toBeTruthy();
    expect(p.bankCredits).toBeGreaterThanOrEqual(100);
    expect(awardLiveAchievements(content, p, run, '2026-10-31T00:00:00Z')).toEqual([]);
    const end = applyRunToProfile(content, structuredClone(p), run, '2026-10-31T01:00:00Z');
    expect(end.achievements.map((a) => a.id)).not.toContain('first-steps');
  });
});

import { endRunEarly, wipeStatus } from '../../src/core/run';
describe('Adventure end run', () => {
  it('shows the wipe count and ends the run on purpose; other modes cannot', () => {
    const adv = chooseStarter(content, createRun(content, { runId: 'adv', seed: 'adv', archetypeId: 'red', rules: { modeId: 'adventure', difficultyId: 'standard', modifierIds: [], deathBlock: false } }), 0);
    expect(wipeStatus(adv)).toEqual({ wipes: 0, max: 8 });
    const over = endRunEarly(adv);
    expect(over.phase).toBe('over');
    expect(over.victory).toBe(false);
    const std = chooseStarter(content, createRun(content, { runId: 's', seed: 's', archetypeId: 'red' }), 0);
    expect(wipeStatus(std)).toBeNull();
    expect(() => endRunEarly(std)).toThrow(/Adventure/);
  });
});

import { buyCandyPerk, candyPerkProblem, candyStart } from '../../src/core/candyShop';
describe('Candy Shop', () => {
  it('sells each perk once for candies and adds it to every run start', () => {
    const p = rich({ candies: 100 });
    const bought = buyCandyPerk(content, p, 'pantry');
    expect(bought.candies).toBe(100 - content.balance.candyShop.find((x) => x.id === 'pantry')!.cost);
    expect(candyPerkProblem(content, bought, 'pantry')).toMatch(/already own/);
    expect(candyPerkProblem(content, rich({ candies: 0 }), 'lucky-coin')).toMatch(/need/);
    const start = candyStart(content, ['pantry', 'lucky-coin']);
    expect(start.items.potion).toBe(3);
    expect(start.money).toBe(500);
    const base = startingResources(content, content.archetypes.get('red')!, defaultPrep(content));
    const withPerks = startingResources(content, content.archetypes.get('red')!, defaultPrep(content), ['pantry', 'lucky-coin']);
    expect(withPerks.money).toBe(base.money + 500);
    expect(withPerks.items.potion).toBe((base.items.potion ?? 0) + 3);
    for (const perk of content.balance.candyShop) for (const id of Object.keys(perk.items)) expect(content.items.has(id), id).toBe(true);
  });
});

import { addItemAttribute, growthProgress } from '../../src/core/attributes';

describe('attribute item falloff and growth progress', () => {
  it('repeat boosts from items diminish after the free ones', () => {
    const run = createRun(content, { runId: 'f', seed: 'f', archetypeId: 'red' });
    const { afterBoosts } = content.balance.attributeItemFalloff;
    const before = run.attributeModifiers.charisma ?? 0;
    for (let i = 0; i < afterBoosts; i++) addItemAttribute(content, run, 'charisma', 4);
    expect(run.attributeModifiers.charisma).toBe(before + 4 * afterBoosts);
    addItemAttribute(content, run, 'charisma', 4);
    expect(run.attributeModifiers.charisma).toBe(before + 4 * afterBoosts + 2);
    addItemAttribute(content, run, 'charisma', 1);
    expect(run.attributeModifiers.charisma).toBe(before + 4 * afterBoosts + 3);
  });
  it('shows progress toward the next permanent point', () => {
    const profile = createProfile(content, 'p');
    const g = content.balance.attributeGrowth.find((x) => x.counter)!;
    profile.counters[g.counter!] = g.per + 1;
    expect(growthProgress(content, profile, g.attribute)).toContain(`1/${g.per}`);
  });
});


describe('hidden achievements from a won run', () => {
  const base = () => {
    const run = createRun(content, { runId: 'h', seed: 'h', archetypeId: 'red' });
    run.victory = true;
    return run;
  };
  it('pay only on a won run, and each has its own rule', () => {
    const run = base();
    run.log.counters.moneySpent = content.balance.frugalRunMaxSpent;
    expect(relationshipCounters(content, run)).toMatchObject({ frugalWins: 1, noHealWins: 1, comebackWins: 0, rainbowWins: 0 });
    run.log.counters.moneySpent = content.balance.frugalRunMaxSpent + 1;
    run.log.counters.healStopsUsed = 1;
    run.rules.wipes = 1;
    expect(relationshipCounters(content, run)).toMatchObject({ frugalWins: 0, noHealWins: 0, comebackWins: 1 });
    run.victory = false;
    expect(relationshipCounters(content, run).frugalWins).toBeUndefined();
  });
  it('six different types make a rainbow party', () => {
    const run = base();
    const ids = ['charmander', 'squirtle', 'bulbasaur', 'pikachu', 'geodude', 'gastly'];
    run.party = ids.map((id, i) => createPokemon(content, id, 20, `r${i}`));
    expect(relationshipCounters(content, run).rainbowWins).toBe(1);
    run.party[5] = createPokemon(content, 'charmeleon', 20, 'dup');
    expect(relationshipCounters(content, run).rainbowWins).toBe(0);
  });
  it('the four achievements exist, hidden and earnable', () => {
    for (const id of ['penny-pincher', 'no-turning-back', 'one-of-a-kind', 'wrong-way-right-result']) expect(content.achievements.get(id)?.hidden, id).toBe(true);
  });
});
