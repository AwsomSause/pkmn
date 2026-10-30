import { describe, expect, it } from 'vitest';
import { moveLore, moveRank, recordMoveMastery, topMoves } from '../../src/core/moveMastery';
import { chooseStarter, createRun } from '../../src/core/run';
import { STANDARD_CHOICE } from '../../src/core/rules';
import type { Profile } from '../../src/core/state';
import { content } from './helpers';

const profile = () => ({ claims: {}, researchPoints: 0 }) as unknown as Profile;

describe('Move Mastery (#107)', () => {
  it('ranks by uses', () => {
    expect([0, 9, 10, 30, 100].map(moveRank)).toEqual(['none', 'none', 'bronze', 'silver', 'gold']);
  });
  it('pays each rank once and never twice for the same uses', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'mm', seed: 'mm', archetypeId: 'red', rules: STANDARD_CHOICE }), 0);
    const h = Object.values(run.story.histories)[0]!;
    const move = run.party[0]!.moves[0]!.id;
    h.moves = { [move]: 30, 'not-a-move': 99 };
    const p = profile();
    const ups = recordMoveMastery(content, p, run, 't');
    expect(ups.map((u) => u.rank)).toEqual(['bronze', 'silver']);
    expect(p.researchPoints).toBe(7);
    expect(p.moveUses).toEqual({ [move]: 30 });
    h.moves = { [move]: 1 };
    expect(recordMoveMastery(content, p, run, 't2')).toEqual([]);
    expect(p.researchPoints).toBe(7);
    expect(topMoves(p)[0]).toMatchObject({ moveId: move, uses: 31, rank: 'silver' });
  });
  it('lore grows with rank and adds no power', () => {
    const move = [...content.moves.keys()][0]!;
    expect(moveLore(content, move, 'none')).toEqual([]);
    expect(moveLore(content, move, 'bronze')).toHaveLength(1);
    expect(moveLore(content, move, 'silver')).toHaveLength(2);
    expect(moveLore(content, move, 'gold')).toHaveLength(3);
  });
});
