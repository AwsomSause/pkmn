// Catalog slice 5: Quick Route pacing (#100), Solo Run and No Evolution contracts (#98, #152).

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun, useItemOutsideBattle } from '../../src/core/run';
import { noEvolution, partyCap, rulesProblem, STANDARD_CHOICE, type RulesChoice } from '../../src/core/rules';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

const start = (seed: string, rules: Partial<RulesChoice> = {}): RunState => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', rules: { ...STANDARD_CHOICE, ...rules } }), 0);

describe('Quick Route pacing', () => {
  it('uses a shorter campaign that does not count for progress', () => {
    const run = start('qr', { modifierIds: ['quick-route'] });
    expect(run.campaignId).toBe('quick-route');
    const c = content.campaigns.get('quick-route')!;
    expect(c.stagesPerRegion).toBeLessThan(content.campaigns.get('full')!.stagesPerRegion);
    expect(c.countsForProgress).toBe(false);
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['quick-route'] })).toBeNull();
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
