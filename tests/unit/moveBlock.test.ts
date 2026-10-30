import { describe, expect, it } from 'vitest';
import { moveBlockReason } from '../../src/core/battle/moveBlock';
import { chooseStarter, createRun } from '../../src/core/run';
import { STANDARD_CHOICE } from '../../src/core/rules';
import type { BattleState } from '../../src/core/state';
import { content } from './helpers';

const fresh = () => {
  const run = chooseStarter(content, createRun(content, { runId: 'mb', seed: 'mb', archetypeId: 'red', rules: STANDARD_CHOICE }), 0);
  return run;
};

describe('move block reasons (#123)', () => {
  it('says why a move is blocked and says nothing when it is free', () => {
    const run = fresh();
    const mon = run.party[0]!;
    const battle = { playerVolatile: { disabled: null, torment: false, lastMove: null, taunt: 0, throat: 0 }, enemyVolatile: {} } as unknown as BattleState;
    expect(moveBlockReason(content, battle, mon, 0)).toBeNull();
    battle.playerVolatile.taunt = 2;
    const status = mon.moves.findIndex((m) => content.moves.get(m.id)?.category === 'status');
    if (status >= 0) expect(moveBlockReason(content, battle, mon, status)).toMatch(/Taunt/);
    battle.playerVolatile.disabled = { moveId: mon.moves[0]!.id, turns: 2 };
    expect(moveBlockReason(content, battle, mon, 0)).toBe('Disabled for 2 more turns');
    mon.moves[0]!.pp = 0;
    expect(moveBlockReason(content, battle, mon, 0)).toBe('no PP left');
  });
});
