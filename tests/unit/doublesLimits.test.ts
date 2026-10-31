// Doubles limits lifted: either Pokémon can transform, rage follows every move, more boss pairs.

import { describe, expect, it } from 'vitest';
import { createBattle, type BattleContext } from '../../src/core/battle/engine';
import { makeDoubles, resolveDoublesTurn } from '../../src/core/battle/doubles';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function setup() {
  const party = [createPokemon(content, 'snorlax', 50, 'p0'), createPokemon(content, 'garchomp', 50, 'p1')];
  const team = [createPokemon(content, 'machamp', 50, 'e0'), createPokemon(content, 'gengar', 50, 'e1')];
  for (const m of [...party, ...team]) m.moves = [{ id: 'splash', pp: 40 }];
  const battle = createBattle('trainer', team, 0, party[0]!.uid, { classId: 'ace-trainer', name: 'Pat', leaderId: null });
  makeDoubles(battle, party);
  const ctx: BattleContext = { content, battle, party, inventory: { 'tera-orb': 1, 'dynamax-band': 1 }, rng: new Rng(hashSeed('dl')), captureRng: new Rng(hashSeed('dlc')), catchMultiplier: 1 };
  return { ctx, battle, party };
}

describe('doubles limits', () => {
  it('the right-hand Pokémon can transform, and so can the left in the same turn (different mechanics)', () => {
    const { ctx, battle, party } = setup();
    resolveDoublesTurn(ctx, {
      kind: 'double',
      commands: [
        { action: { kind: 'move', index: 0, transform: { kind: 'tera' } } },
        { action: { kind: 'move', index: 0, transform: { kind: 'dynamax' } } },
      ],
    });
    expect(battle.transform.used.player).toEqual(expect.arrayContaining(['tera', 'dynamax']));
    expect(Object.keys(battle.transform.mechanics).sort()).toEqual([party[0]!.uid, party[1]!.uid].sort());
  });

  it('the same mechanic still works once per battle (a second request is ignored)', () => {
    const { ctx, battle } = setup();
    resolveDoublesTurn(ctx, {
      kind: 'double',
      commands: [
        { action: { kind: 'move', index: 0, transform: { kind: 'tera' } } },
        { action: { kind: 'move', index: 0, transform: { kind: 'tera' } } },
      ],
    });
    expect(battle.transform.used.player.filter((k) => k === 'tera')).toHaveLength(1);
    expect(Object.keys(battle.transform.mechanics)).toHaveLength(1);
  });

  it('more bosses fight doubles', () => {
    const ids = content.balance.doubles.bossIds;
    expect(ids).toEqual(expect.arrayContaining(['tate', 'ingo', 'emmet', 'maxie', 'archie']));
    for (const id of ids) expect(content.bosses.get(id), id).toBeTruthy();
  });
});
