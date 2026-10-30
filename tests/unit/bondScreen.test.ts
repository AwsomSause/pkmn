import { describe, expect, it } from 'vitest';
import { BOND_KEYS, BOND_RULES, bondOf } from '../../src/core/bond';
import { BOND_BARS, MOOD_LOOK, bondHint } from '../../src/ui/bondLook';
import { chooseStarter, createRun } from '../../src/core/run';
import { openHistory } from '../../src/core/story/record';
import { content } from './helpers';

describe('Bond screen', () => {
  it('shows a bar for every bond value and a look for every mood', () => {
    expect(BOND_BARS.map((b) => b.key).sort()).toEqual([...BOND_KEYS].sort());
    expect(Object.keys(MOOD_LOOK).sort()).toEqual(['devoted', 'steady', 'wary']);
  });

  it('explains the mood, and warns when a willful, distrustful Pokémon may refuse', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'bs', seed: 'bond-screen', archetypeId: 'red' }), 0));
    const mon = run.party[0]!;
    openHistory(content, run, mon.uid, mon.speciesId, 'starter');
    expect(bondHint(content, run, mon)).toMatch(/^Steady:/);
    const bond = bondOf(run, mon.uid);
    bond.trust = BOND_RULES.refuse.maxTrust;
    bond.autonomy = BOND_RULES.refuse.minAutonomy;
    const hint = bondHint(content, run, mon);
    expect(hint).toMatch(/^Wary:/);
    expect(hint).toContain('may refuse');
  });
});
