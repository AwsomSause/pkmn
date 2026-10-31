// Bond Engine outside battle: devoted Pokémon evolve by friendship earlier and learn a ready move after a win.

import { describe, expect, it } from 'vitest';
import { adjustBond, bondEvolves, bondLessons, bondOf } from '../../src/core/bond';
import { evolutionTarget } from '../../src/core/evolution';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { openHistory } from '../../src/core/story/record';
import { content } from './helpers';

function setup() {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'bo', seed: 'bond-out', archetypeId: 'red' }), 0));
  const lead = run.party[0]!;
  openHistory(content, run, lead.uid, lead.speciesId, 'starter');
  return { run, lead };
}
const devote = (run: ReturnType<typeof setup>['run'], uid: string) => adjustBond(bondOf(run, uid), { trust: 100, synchronization: 100 });

describe('bond evolution', () => {
  it('a devoted Pokémon evolves by friendship before the usual threshold; a steady one does not', () => {
    const { run } = setup();
    const pichu = createPokemon(content, 'pichu', 5, 'pi1');
    run.party.push(pichu);
    openHistory(content, run, pichu.uid, 'pichu', 'caught');
    pichu.friendship = Math.ceil(content.balance.friendship.evolveAt * 0.7);
    expect(bondEvolves(content, run, pichu)).toBe(false);
    expect(evolutionTarget(content, pichu, undefined, 0, bondEvolves(content, run, pichu))).toBeNull();
    devote(run, pichu.uid);
    expect(bondEvolves(content, run, pichu)).toBe(true);
    expect(evolutionTarget(content, pichu, undefined, 0, true)).toBe('pikachu');
    pichu.friendship = 10;
    expect(bondEvolves(content, run, pichu)).toBe(false);
  });
});

describe('bond lessons', () => {
  it('a devoted fighter with a free slot learns a ready move; others and full movesets are untouched', () => {
    const { run, lead } = setup();
    lead.level = 40;
    lead.moves = lead.moves.slice(0, 1);
    expect(bondLessons(content, run, [lead.uid])).toEqual([]);
    devote(run, lead.uid);
    expect(bondLessons(content, run, [])).toEqual([]);
    const got = bondLessons(content, run, [lead.uid]);
    expect(got).toHaveLength(1);
    expect(lead.moves.some((m) => m.id === got[0]!.moveId)).toBe(true);
    lead.moves = lead.moves.concat(Array(4).fill({ id: lead.moves[0]!.id, pp: 1 })).slice(0, 4);
    expect(bondLessons(content, run, [lead.uid])).toEqual([]);
  });
});
