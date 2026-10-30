// Phase G balance checks (Untitled doc §23): deterministic whole-run simulations with the test autoplayer. Same seeds, same numbers.
// They check trends, not exact values: harder presets must not be easier, and no reward multiplier can be farmed by switching modes.

import { describe, expect, it } from 'vitest';
import { RUN_RULES, rewardMultiplier, type RulesChoice } from '../../src/core/rules';
import { autoplay } from './autoplay';

const SEEDS = ['eco-a', 'eco-b', 'eco-c', 'eco-d'];
const choice = (difficultyId: string, over: Partial<RulesChoice> = {}): RulesChoice => ({ modeId: 'standard', difficultyId, modifierIds: [], deathBlock: false, ...over });

function average(rules: RulesChoice) {
  const runs = SEEDS.map((seed) => autoplay({ seed, steps: 4000, rules, healOnMap: true }));
  const mean = (f: (r: (typeof runs)[number]) => number) => runs.reduce((n, r) => n + f(r), 0) / runs.length;
  return { encounters: mean((r) => r.encountersCompleted), money: mean((r) => r.log.counters.moneyEarned ?? 0), badges: mean((r) => r.badges.length), early: runs.filter((r) => r.phase === 'over' && r.encountersCompleted < 10).length / runs.length };
}

describe('economy and difficulty simulations', () => {
  it('a harder preset never lets the same bot get further than an easier one', () => {
    const story = average(choice('story'));
    const nightmare = average(choice('nightmare'));
    expect(nightmare.encounters).toBeLessThanOrEqual(story.encounters);
    expect(nightmare.badges).toBeLessThanOrEqual(story.badges);
  }, 300000);
  it('the published reward multiplier grows with difficulty and never passes the cap', () => {
    const ladder = RUN_RULES.difficulties.map((d) => rewardMultiplier(choice(d.id)));
    expect([...ladder].sort((a, b) => a - b)).toEqual(ladder);
    for (const d of RUN_RULES.difficulties) {
      for (const m of RUN_RULES.modifiers) {
        const value = rewardMultiplier(choice(d.id, { modifierIds: [m.id] }));
        expect(value).toBeLessThanOrEqual(RUN_RULES.multiplierCap);
        expect(value).toBeGreaterThan(0);
      }
      expect(rewardMultiplier(choice(d.id, { deathBlock: true }))).toBeLessThan(rewardMultiplier(choice(d.id)));
      expect(rewardMultiplier(choice(d.id, { modeId: 'adventure' }))).toBe(0);
    }
  });
});

describe('the gentle opening', () => {
  it('a smart player rarely loses the very first fight (under 20% over 60 seeds)', () => {
    let lost = 0;
    for (let i = 0; i < 60; i++) {
      const r = autoplay({ seed: `first-${i}`, steps: 400, smart: true });
      if (r.phase === 'over' && r.encountersCompleted === 0) lost++;
    }
    expect(lost / 60).toBeLessThan(0.2);
  }, 300000);
  it('every starter that can attack starts with an attacking move, and low-level enemies carry no fixed-damage move', async () => {
    const { content } = await import('./helpers');
    const { movesAtLevel } = await import('../../src/core/pokemon');
    for (const s of content.species.values()) {
      const usable = s.learnset.filter((e) => (content.moves.get(e.move)?.power ?? 0) > 0 && content.moves.get(e.move)?.supported);
      if (usable.length === 0 || s.evolutionStage !== 1) continue;
      const moves = movesAtLevel(content, s, 5);
      if (usable.some((e) => e.level <= 5)) expect(moves.some((m) => (content.moves.get(m)?.power ?? 0) > 0), s.id).toBe(true);
    }
    const { createPokemon } = await import('../../src/core/pokemon');
    const { softenOpeningMoves } = await import('../../src/core/rules');
    const deino = createPokemon(content, 'deino', 2, 'x');
    softenOpeningMoves(content, deino);
    expect(deino.moves.every((m) => typeof (content.moves.get(m.id)?.effects as { fixedDamage?: unknown } | undefined)?.fixedDamage !== 'number')).toBe(true);
  });
});
