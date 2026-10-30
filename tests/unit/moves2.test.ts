// Features catch-up: the 49 moves added in this batch (all built from effects the engine already has).

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function run(move: string, seed = 'moves2') {
  const player = createPokemon(content, 'rattata', 50, 'p');
  player.moves = [{ id: move, pp: content.moves.get(move)!.pp }];
  const enemy = createPokemon(content, 'snorlax', 50, 'e');
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  resolveTurn(ctx, { kind: 'move', index: 0 });
  return battle;
}

describe('moves added in the catch-up', () => {
  it('are marked supported', () => {
    for (const id of ['shell-smash', 'swagger', 'lumina-crash', 'dragon-darts', 'oblivion-wing', 'malignant-chain']) expect(content.moves.get(id)!.supported).not.toBe(false);
  });
  it('Shell Smash raises three stats and drops two', () => {
    const b = run('shell-smash');
    expect([b.playerStages.atk, b.playerStages.spa, b.playerStages.spe, b.playerStages.def, b.playerStages.spd]).toEqual([2, 2, 2, -1, -1]);
  });
  it('Swagger confuses and raises the target\'s Attack', () => {
    const b = run('swagger');
    expect(b.enemyStages.atk).toBe(2);
    expect(b.enemyVolatile.confusion).toBeGreaterThan(0);
  });
  it('Lumina Crash lowers Sp. Def by two', () => {
    expect(run('lumina-crash').enemyStages.spd).toBe(-2);
  });
  it('Ice Hammer lowers the user\'s Speed', () => {
    expect(run('ice-hammer').playerStages.spe).toBe(-1);
  });
});
