// Major Update §1: smart item distribution (core/itemDistribution.ts) and the rarity audit.

import { describe, expect, it } from 'vitest';
import { catalogRewardId } from '../../src/data/index';
import { adjustTierWeights, epicsTaken, rewardRelevance } from '../../src/core/itemDistribution';
import { generateDraft } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import { maxHp } from '../../src/core/pokemon';
import { content } from './helpers';

const fresh = () => chooseStarter(content, createRun(content, { runId: 'r', seed: 'dist', archetypeId: 'red' }), 0);
const reward = (catalogId: string) => content.rewards.get(catalogRewardId(catalogId))!;
const cfg = content.balance.itemDistribution;

describe('item relevance', () => {
  it('never offers a species item nobody in the party can use (Light Ball without Pikachu)', () => {
    const run = fresh();
    expect(run.party.some((p) => p.speciesId === 'pikachu')).toBe(false);
    expect(rewardRelevance(content, run, reward('light-ball'))).toBe(0);
    for (let i = 0; i < 400; i++) expect(generateDraft(content, run, new Rng(hashSeed(`ls-${i}`)))).not.toContain(catalogRewardId('light-ball'));
    run.party[0]!.speciesId = 'pikachu';
    expect(rewardRelevance(content, run, reward('light-ball'))).toBeGreaterThan(0);
  });

  it('a type item is rarer when nobody knows a move of its type, and each owned copy lowers it', () => {
    const run = fresh();
    const mon = run.party[0]!;
    mon.moves = [{ id: 'ember', pp: 25 }];
    const fire = rewardRelevance(content, run, reward('charcoal'));
    const ice = rewardRelevance(content, run, reward('nevermeltice'));
    expect(ice).toBeCloseTo(fire * cfg.offTypeWeight);
    mon.held = { charcoal: 1 };
    expect(rewardRelevance(content, run, reward('charcoal'))).toBeCloseTo(fire / (1 + cfg.ownedPenalty));
  });

  it('healing grows with how hurt the party is (boundary: full HP gives the idle weight)', () => {
    const run = fresh();
    const mon = run.party[0]!;
    mon.hp = maxHp(content, mon);
    const potion = content.rewards.get('potion')!;
    const idle = rewardRelevance(content, run, potion);
    expect(idle).toBeCloseTo(cfg.healIdleWeight / (1 + cfg.ownedPenalty * ((run.inventory['potion'] ?? 0) / 2)));
    mon.hp = 1;
    expect(rewardRelevance(content, run, potion)).toBeGreaterThan(idle * 2);
  });
});

describe('tier weights', () => {
  it('rare and epic grow with badges up to the cap; epics taken make the next epic rarer down to the floor', () => {
    const run = fresh();
    const base = content.balance.rarityWeights;
    expect(adjustTierWeights(content, run, base)).toEqual({ ...base, rare: base.rare, epic: base.epic });
    run.badges = Array.from({ length: 40 }, (_, i) => `b${i}`);
    const many = adjustTierWeights(content, run, base);
    expect(many.rare).toBeCloseTo(base.rare! * (1 + cfg.rarePerBadge * cfg.badgeCap));
    expect(many.common).toBe(base.common);
    run.badges = [];
    const epic = [...content.rewards.values()].find((r) => r.rarity === 'epic')!;
    run.log.rewardsTaken.push(...Array(10).fill(epic.id));
    expect(epicsTaken(content, run)).toBe(10);
    expect(adjustTierWeights(content, run, base).epic).toBeCloseTo(base.epic! * cfg.epicRepeatFloor);
  });

  it('drafts stay deterministic and distinct', () => {
    const run = fresh();
    for (let i = 0; i < 50; i++) {
      const a = generateDraft(content, run, new Rng(hashSeed(`d-${i}`)));
      expect(generateDraft(content, run, new Rng(hashSeed(`d-${i}`)))).toEqual(a);
      expect(new Set(a).size).toBe(a.length);
    }
  });
});

describe('rarity audit', () => {
  it('strong held items are rare, money-only valuables are not epic, type boosters stay uncommon but stack to 3', () => {
    expect(content.catalog.get('charcoal')!.rarity).toBe('uncommon');
    for (const id of ['scope-lens', 'focus-band', 'expert-belt', 'leftovers', 'choice-band', 'life-orb']) expect(content.catalog.get(id)!.rarity, id).toBe('rare');
    for (const id of ['relic-statue', 'relic-crown', 'ruby', 'sapphire']) expect(content.catalog.get(id)!.rarity, id).not.toBe('epic');
    expect(content.catalog.get('charcoal')!.max).toBe(3);
    expect(content.catalog.get('leftovers')!.max).toBe(2);
  });
});
