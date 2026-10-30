// Kice: uncommon items showed up more often than common ones. Every source keeps the order common > uncommon > rare > epic.
import { describe, expect, it } from 'vitest';
import { pickByRarity } from '../../src/core/events';
import { generateDraft } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

const TIERS = ['common', 'uncommon', 'rare', 'epic'] as const;
const inOrder = (t: Record<string, number>) => {
  expect(t.common, JSON.stringify(t)).toBeGreaterThan(t.uncommon!);
  expect(t.uncommon, JSON.stringify(t)).toBeGreaterThan(t.rare!);
  expect(t.rare, JSON.stringify(t)).toBeGreaterThan(t.epic!);
};

describe('rarity order', () => {
  it('the draft weights are ordered for ordinary, harder and boss rewards', () => {
    for (const w of [content.balance.rarityWeights, content.balance.harderRarityWeights, content.balance.bossRarityWeights, content.balance.events.itemRarityWeights]) {
      inOrder({ common: w.common!, uncommon: w.uncommon!, rare: w.rare!, epic: w.epic! });
    }
  });

  it('real drafts hand out common most often, then uncommon, rare, epic', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'rarity', archetypeId: 'red' }), 0);
    for (const weights of [content.balance.rarityWeights, content.balance.harderRarityWeights, content.balance.bossRarityWeights]) {
      const t: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0 };
      for (let i = 0; i < 1500; i++) for (const id of generateDraft(content, run, new Rng(hashSeed(`d${i}`)), weights)) t[content.rewards.get(id)!.rarity]!++;
      inOrder(t);
    }
  });

  it('event gifts (one-of lists and fixed items) follow the same order', () => {
    const t: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0 };
    const rarityOf = (id: string) => content.catalog.get(id)?.rarity ?? content.rewards.get(id)?.rarity ?? 'common';
    const rng = new Rng(hashSeed('events'));
    for (const event of content.events.values()) {
      JSON.stringify(event, (_key, v) => {
        if (v && typeof v === 'object') {
          if (v.kind === 'itemFrom') for (let i = 0; i < 40; i++) t[rarityOf(pickByRarity(content, v.ids, rng))]! += 1 / 40;
          else if (v.kind === 'item') t[rarityOf(v.id)]!++;
        }
        return v;
      });
    }
    for (const tier of TIERS) expect(t[tier]).toBeGreaterThan(0);
    inOrder(t);
  });
});
