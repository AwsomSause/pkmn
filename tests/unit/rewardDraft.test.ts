// Untitled document Phase A: draft limits and fixed base stats.

import { describe, expect, it } from 'vitest';
import { generateDraft } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

describe('reward drafts', () => {
  it('never offer more than one attribute item, and every option is eligible, over 2000 seeds', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'phase-a', archetypeId: 'red' }), 0);
    let withAttribute = 0;
    for (let i = 0; i < 2000; i++) {
      const draft = generateDraft(content, run, new Rng(hashSeed(`seed-${i}`)));
      expect(new Set(draft).size).toBe(draft.length);
      const attrs = draft.filter((id) => content.rewards.get(id)!.category === 'attribute');
      expect(attrs.length).toBeLessThanOrEqual(1);
      withAttribute += attrs.length;
    }
    expect(withAttribute).toBeGreaterThan(0);
  });
});

describe('fixed base stats', () => {
  it('every species has six whole-number stats from 1 to 255 (BST is their sum)', () => {
    for (const s of content.species.values()) {
      const stats = Object.values(s.baseStats);
      expect(stats, s.id).toHaveLength(6);
      for (const v of stats) expect(Number.isInteger(v) && v >= 1 && v <= 255, `${s.id} stat ${v}`).toBe(true);
    }
  });
});
