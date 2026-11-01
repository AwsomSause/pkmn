import { describe, expect, it } from 'vitest';
import { exhibitionFor } from '../../src/core/exhibition';
import { chooseStarter, createRun } from '../../src/core/run';
import { content, toBattle } from './helpers';

describe('club exhibition (spectate and wager)', () => {
  it('is the same every time for one key, has two teams of three, and touches no random stream', () => {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'ex', seed: 'ex', archetypeId: 'red' }), 0)));
    run.battle = null;
    const before = JSON.stringify(run.rng);
    const a = exhibitionFor(content, run, 'club:1');
    expect(a).toEqual(exhibitionFor(content, run, 'club:1'));
    expect(a.teams[0].fighters).toHaveLength(3);
    expect(a.teams[1].fighters).toHaveLength(3);
    expect([0, 1]).toContain(a.winner);
    expect(a.lines.length).toBeGreaterThan(0);
    expect(JSON.stringify(run.rng)).toBe(before);
  });
});
