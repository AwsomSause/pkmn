import { describe, expect, it } from 'vitest';
import { habitatList } from '../../src/core/habitat';
import { chooseStarter, createRun } from '../../src/core/run';
import { content, toBattle } from './helpers';

describe('habitat reading', () => {
  it('lists the likeliest species of the stage the same way every time and touches no random stream', () => {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'hab', seed: 'hab', archetypeId: 'red' }), 0)));
    run.battle = null;
    const before = JSON.stringify(run.rng);
    const a = habitatList(content, run);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(habitatList(content, run));
    expect(JSON.stringify(run.rng)).toBe(before);
  });
});
