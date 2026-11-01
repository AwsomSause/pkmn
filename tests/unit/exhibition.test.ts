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
    // A real engine battle: the loser's whole team is knocked out, and different keys can end differently.
    const loser = a.winner === 0 ? 1 : 0;
    const names = a.teams[loser].fighters.length;
    expect(a.lines.filter((l) => l.includes(`(${a.teams[loser].trainer}) is knocked out`)).length).toBe(names);
    const winners = new Set(Array.from({ length: 12 }, (_, i) => exhibitionFor(content, run, `k${i}`).winner));
    expect(winners.size).toBe(2);
  });
});
