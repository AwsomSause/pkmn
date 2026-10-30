// Draft personalities (catalog 94) and draft archetypes (catalog 97).

import { describe, expect, it } from 'vitest';
import { applyReward, biasWeight, generateDraft, isRewardEligible } from '../../src/core/rewards';
import { chooseStarter, createRun } from '../../src/core/run';
import { hashSeed, Rng } from '../../src/core/rng';
import { getArchetype } from '../../src/core/archetypes';
import { content } from './helpers';

function fresh(seed: string) {
  return structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
}

describe('draft deals', () => {
  it('bundles add every item, bargains need and take the money, and a risk is rolled from the seed', () => {
    const run = fresh('deal');
    const archetype = getArchetype(content, run.archetypeId);
    const before = run.inventory['ultra-ball'] ?? 0;
    applyReward(content, run, archetype, 'deal-trapper-bundle');
    expect(run.inventory['ultra-ball']).toBe(before + 2);

    run.money = 100;
    expect(isRewardEligible(content, run, content.rewards.get('deal-ball-bargain')!)).toBe(false);
    run.money = 1000;
    expect(isRewardEligible(content, run, content.rewards.get('deal-ball-bargain')!)).toBe(true);
    const msgs = applyReward(content, run, archetype, 'deal-ball-bargain').messages;
    expect(run.money).toBe(400);
    expect(msgs[0]).toContain('₽600');
    expect(run.inventory['ultra-ball']).toBe(before + 2 + 8);

    const outcomes = new Set<boolean>();
    for (let i = 0; i < 30; i++) {
      const r = fresh(`gamble-${i}`);
      const had = r.inventory['hyper-potion'] ?? 0;
      applyReward(content, r, archetype, 'deal-medic-gamble');
      outcomes.add((r.inventory['hyper-potion'] ?? 0) > had);
      const again = fresh(`gamble-${i}`);
      applyReward(content, again, archetype, 'deal-medic-gamble');
      expect(again.inventory['hyper-potion'] ?? 0).toBe(r.inventory['hyper-potion'] ?? 0);
    }
    expect(outcomes.size).toBe(2);
  });
});

describe('draft archetypes', () => {
  it('a focus token favours its categories by its weight and leaves every other family alone', () => {
    const token = content.prepTokens.get('focus-aggressive')!;
    expect(token.draftBias!.weight).toBeGreaterThan(1);
    const buff = [...content.rewards.values()].filter((r) => r.category === 'stat-buff');
    const heal = [...content.rewards.values()].filter((r) => r.category === 'healing');
    expect(biasWeight(token.draftBias, buff)).toBe(token.draftBias!.weight);
    expect(biasWeight(token.draftBias, heal)).toBe(1);
    expect(biasWeight(null, buff)).toBe(1);
  });

  it('a draft without a token is the same as before, and one with a token still returns a full legal draft', () => {
    const plain = fresh('bias-same');
    const a = generateDraft(content, plain, new Rng(hashSeed('bias-7')));
    const withToken = structuredClone(plain);
    withToken.prep = { ...withToken.prep, tokenId: 'focus-defensive' };
    const b = generateDraft(content, withToken, new Rng(hashSeed('bias-7')));
    expect(a).toHaveLength(content.balance.draftSize);
    expect(b).toHaveLength(content.balance.draftSize);
    expect(new Set(b).size).toBe(b.length);
    expect(generateDraft(content, plain, new Rng(hashSeed('bias-7')))).toEqual(a);
  });

  it('over many drafts a focus raises its categories\' share', () => {
    const all = { common: 1, uncommon: 1, rare: 1, epic: 1 };
    const share = (token: string | null) => {
      let hits = 0;
      for (let i = 0; i < 400; i++) {
        const run = fresh('bias-share');
        run.prep = { ...run.prep, tokenId: token };
        const [id] = generateDraft(content, run, new Rng(hashSeed(`pick-${i}`)), all, undefined, { size: 1 });
        if (content.rewards.get(id!)!.category === 'stat-buff') hits++;
      }
      return hits / 400;
    };
    const plain = share(null);
    const biased = share('focus-aggressive');
    expect(plain).toBeGreaterThan(0);
    expect(biased).toBeGreaterThan(plain * 1.3);
    expect(biased).toBeLessThan(1);
  });
});
