// Catalog slice 5: Quick Route pacing (#100), Solo Run and No Evolution contracts (#98, #152).

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun, useItemOutsideBattle } from '../../src/core/run';
import { bossTeamSpecies } from '../../src/core/encounters';
import { bossRemix, campaignCounts, noEvolution, partyCap, rewardMultiplier, rulesProblem, STANDARD_CHOICE, type RulesChoice } from '../../src/core/rules';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

const start = (seed: string, rules: Partial<RulesChoice> = {}): RunState => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', rules: { ...STANDARD_CHOICE, ...rules } }), 0);

describe('Quick Route mode', () => {
  it('is a real mode on a shorter campaign whose runs count for the account', () => {
    const run = start('qr', { modeId: 'quick-route' });
    expect(run.campaignId).toBe('quick-route');
    const c = content.campaigns.get('quick-route')!;
    expect(c.stagesPerRegion).toBeLessThan(content.campaigns.get('full')!.stagesPerRegion);
    expect(c.countsForProgress).toBe(false);
    expect(campaignCounts(c, 'quick-route')).toBe(true);
    expect(campaignCounts(c, 'standard')).toBe(false);
    expect(rulesProblem({ ...STANDARD_CHOICE, modeId: 'quick-route' })).toBeNull();
  });
  it('pays 60% of the account rewards of a Standard run', () => {
    expect(rewardMultiplier({ ...STANDARD_CHOICE, modeId: 'quick-route' })).toBeCloseTo(rewardMultiplier(STANDARD_CHOICE) * 0.6, 2);
  });
  it('the old practice modifier is retired and cannot start a new run', () => {
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['quick-route'] })).toMatch(/not available/);
  });
});

describe('contracts', () => {
  it('Solo Run holds one Pokémon', () => {
    const run = start('solo', { modifierIds: ['solo-run'] });
    expect(partyCap(content, run.rules)).toBe(1);
  });
  it('No Evolution refuses evolution items and is a different group from the bag contract', () => {
    const run = start('noevo', { modifierIds: ['no-evolution'] });
    expect(noEvolution(run.rules)).toBe(true);
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['no-evolution', 'no-battle-items'] })).toBeNull();
    const stone = [...content.items.values()].find((i) => i.effect.kind === 'evolve' && i.usableOutside)!;
    const withStone = { ...run, inventory: { ...run.inventory, [stone.id]: 1 } };
    expect(() => useItemOutsideBattle(content, withStone, stone.id, 0)).toThrow();
  });
});

describe('Boss Remix (#149)', () => {
  it('reorders a boss team without changing who is on it, and is stable', () => {
    const plain = bossTeamSpecies(content, 'gym', 'brock', 3);
    const remix = bossTeamSpecies(content, 'gym', 'brock', 3, true);
    expect([...remix].sort()).toEqual([...plain].sort());
    expect(remix).not.toEqual(plain);
    expect(bossTeamSpecies(content, 'gym', 'brock', 3, true)).toEqual(remix);
  });
  it('is a modifier that reaches the rules', () => {
    expect(bossRemix({ modifierIds: ['boss-remix'] })).toBe(true);
    expect(bossRemix({ modifierIds: [] })).toBe(false);
  });
});
