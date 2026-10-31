// Pokémon-to-Pokémon rivalry kinds (left-out plan 5.4): Bitter, One-Sided → Mutual, Friendly tag-ins, Generational.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { freshSos } from '../../src/core/battle/sos';
import type { Content } from '../../src/core/contentSchema';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { emit, openRelationship } from '../../src/core/story/record';
import { grownSince, noteRivalryLoss, noteRivalryWin, speciesRivalry } from '../../src/core/story/rivalryKinds';
import { content, toBattle } from './helpers';

const always: Content = { ...content, story: { ...content.story, rarity: { ...content.story.rarity, momentChance: 1, flairChance: 1, cooldownBattles: 0 } } };
const where = { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 1 };

function runWith(lead: PokemonInstance, foes: PokemonInstance[]): RunState {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'rk', seed: 'rk', archetypeId: 'red' }), 0)));
  lead.uid = run.party[0]!.uid;
  run.party[0] = lead;
  run.log.starterUid = null;
  run.battle = createBattle('wild', foes, 0, lead.uid);
  run.battle.sos = { ...freshSos(), answered: 1 };
  return run;
}

describe('Rivalry kinds', () => {
  it('a loss to a nearly-beaten foe starts a Bitter rivalry; a loss to a much stronger one a One-Sided rivalry; an even loss nothing', () => {
    const me = createPokemon(content, 'pikachu', 20, 'x');
    const run = runWith(me, [createPokemon(content, 'rattata', 20, 'e1')]);
    const low = createPokemon(content, 'rattata', 20, 'e1');
    low.hp = 1;
    noteRivalryLoss(content, run, run.party[0]!, low, where);
    expect(speciesRivalry(run, run.party[0]!.uid, 'rattata')?.tone).toBe('bitter');
    noteRivalryLoss(content, run, run.party[0]!, createPokemon(content, 'onix', 30, 'e2'), where);
    expect(speciesRivalry(run, run.party[0]!.uid, 'onix')?.tone).toBe('oneSided');
    noteRivalryLoss(content, run, run.party[0]!, createPokemon(content, 'geodude', 21, 'e3'), where);
    expect(speciesRivalry(run, run.party[0]!.uid, 'geodude')).toBeUndefined();
    expect(noteRivalryWin(run, run.party[0]!.uid, 'rattata')).toBe(false); // bitter stays bitter
    expect(noteRivalryWin(run, run.party[0]!.uid, 'onix')).toBe(true);
    expect(speciesRivalry(run, run.party[0]!.uid, 'onix')?.tone).toBe('mutual');
  });

  it("It Hasn't Forgotten That Loss!: the lead meets its bitter rival and powers up", () => {
    const me = createPokemon(content, 'jolteon', 50, 'x');
    me.moves = [{ id: 'growl', pp: 40 }];
    const run = runWith(me, [createPokemon(content, 'rattata', 10, 'e1')]);
    const low = createPokemon(content, 'rattata', 10, 'e9');
    low.hp = 1;
    noteRivalryLoss(content, run, run.party[0]!, low, where);
    const result = takeTurn(always, run, { kind: 'move', index: 0 });
    expect(result.cues.map((c) => c.title).join('·')).toContain("It Hasn't Forgotten That Loss!");
  });

  it("Now It's a Real Rivalry!: knocking out the species of a one-sided rival makes it mutual", () => {
    const me = createPokemon(content, 'jolteon', 50, 'x');
    me.moves = [{ id: 'tackle', pp: 35 }];
    const foe = createPokemon(content, 'rattata', 5, 'e1');
    foe.hp = 1;
    const run = runWith(me, [foe]);
    const cause = emit(content, run, 'rivalryFormed', { where, actors: [me.uid], data: {} });
    openRelationship(content, run, 'rivalry', { kind: 'pokemon', id: run.party[0]!.uid }, { kind: 'enemy', id: 'species:rattata' }, cause)!.tone = 'oneSided';
    const before = run.party[0]!.friendship;
    const result = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(result.cues.map((c) => c.title).join('·')).toContain("Now It's a Real Rivalry!");
    expect(speciesRivalry(result.run, run.party[0]!.uid, 'rattata')?.tone).toBe('mutual');
    expect(result.run.party[0]!.friendship).toBeGreaterThan(before);
  });

  it('Friendly Rivals Tag In!: switching to a friendly rival while the other can still fight', () => {
    const me = createPokemon(content, 'jolteon', 50, 'x');
    const mate = createPokemon(content, 'flareon', 50, 'mate');
    const foe = createPokemon(content, 'snorlax', 50, 'e1');
    foe.moves = [{ id: 'growl', pp: 40 }];
    const run = runWith(me, [foe]);
    run.party.push(mate);
    const cause = emit(content, run, 'rivalryFormed', { where, actors: [me.uid], data: {} });
    openRelationship(content, run, 'rivalry', { kind: 'pokemon', id: run.party[0]!.uid }, { kind: 'pokemon', id: 'mate' }, cause);
    run.battle!.turn = 2; // past the first-turn openers
    const result = takeTurn(always, run, { kind: 'switch', partyIndex: 1 });
    expect(result.cues.map((c) => c.title).join('·')).toContain('Friendly Rivals Tag In!');
  });

  it('Generational: a species that evolved from one the rival brought last time', () => {
    expect(grownSince(content, ['charmander', 'pidgey'], ['charmeleon', 'pidgey'])).toEqual({ from: 'charmander', to: 'charmeleon' });
    expect(grownSince(content, ['charmander'], ['charizard'])).toEqual({ from: 'charmander', to: 'charizard' });
    expect(grownSince(content, ['pidgey'], ['pidgey', 'rattata'])).toBeNull();
  });
});
