// Ideas W1: doubles combo attack (two allies, matching move types).
import { describe, expect, it } from 'vitest';
import { createBattle, type BattleContext, type SlotCommand } from '../../src/core/battle/engine';
import { makeDoubles, resolveDoublesTurn } from '../../src/core/battle/doubles';
import { createPokemon } from '../../src/core/pokemon';
import { Rng, hashSeed } from '../../src/core/rng';
import { content } from './helpers';

function turn(moves: [string, string]) {
  const mk = (species: string, uid: string, m: string) => {
    const mon = createPokemon(content, species, 50, uid);
    mon.moves = [{ id: m, pp: content.moves.get(m)!.pp }];
    return mon;
  };
  const party = [mk('charizard', 'p0', moves[0]), mk('arcanine', 'p1', moves[1])];
  const team = [mk('snorlax', 'e0', 'splash'), mk('snorlax', 'e1', 'splash')];
  const battle = createBattle('trainer', team, 0, party[0]!.uid, { classId: 'ace-trainer', name: 'Pat', leaderId: null });
  makeDoubles(battle, party);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('combo')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  const cmd = (): SlotCommand => ({ action: { kind: 'move', index: 0 }, target: { side: 'enemy', spot: 0 } });
  return resolveDoublesTurn(ctx, { kind: 'double', commands: [cmd(), cmd()] });
}
const hasCombo = (ev: ReturnType<typeof turn>) => ev.some((e) => e.type === 'spectacle' && e.kind === 'combo');

describe('doubles combo attack', () => {
  it('matching types line up a combo; different types do not', () => {
    expect(hasCombo(turn(['flamethrower', 'fire-blast']))).toBe(true);
    expect(hasCombo(turn(['flamethrower', 'surf']))).toBe(false);
  });
});
