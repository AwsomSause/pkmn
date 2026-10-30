// Eggs: laid by events or the Mystery Egg, they hatch after battles (or stages) with their egg moves.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { freshSos } from '../../src/core/battle/sos';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { eggStatus, hatchEgg, HATCH_FRIENDSHIP, layEgg, tickEggs } from '../../src/core/eggs';
import { chooseEvent } from '../../src/core/events';
import { eggMoveOptions } from '../../src/core/mastery';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, hatchEggs, takeTurn } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { content } from './helpers';

const newRun = (seed = 'eggs', archetypeId = 'red'): RunState => structuredClone(chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId }), 0));
const rng = (s = 'egg') => new Rng(hashSeed(s));

/** A wild battle against one Pokémon with 1 HP; the lead knocks it out with one Tackle. */
function inEasyBattle(run: RunState): RunState {
  const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
  lead.moves = [{ id: 'tackle', pp: 35 }];
  run.party[0] = lead;
  const foe = createPokemon(content, 'rattata', 5, 'e1');
  foe.hp = 1;
  foe.moves = [{ id: 'growl', pp: 40 }];
  run.battle = createBattle('wild', [foe], 0, lead.uid);
  run.battle.sos = { ...freshSos(), answered: 1 }; // scripted fight: no SOS call
  run.phase = 'battle';
  return run;
}
const win = (run: RunState) => takeTurn(content, inEasyBattle(run), { kind: 'move', index: 0 }).run;

describe('Eggs', () => {
  it('an Egg is always its line’s first stage, with up to two usable egg moves, and is the same for the same seed', () => {
    const a = layEgg(content, newRun(), 'charizard', { level: 10, left: 2, unit: 'battle', source: 'Test' }, rng());
    const b = layEgg(content, newRun(), 'charizard', { level: 10, left: 2, unit: 'battle', source: 'Test' }, rng());
    expect(a).toEqual(b);
    expect(a.speciesId).toBe('charmander');
    const usable = eggMoveOptions(content, 'charmander').filter((o) => o.active).map((o) => o.id);
    expect(a.eggMoves.length).toBe(Math.min(2, usable.length));
    for (const id of a.eggMoves) expect(usable).toContain(id);
  });

  it('hatches after its battles: friendly, flagged, knows its egg moves, keeps its shine, and waits as a "caught" decision', () => {
    let run = newRun();
    const egg = layEgg(content, run, 'charmander', { level: 8, left: 2, unit: 'battle', source: 'Test' }, rng());
    run.eggs[0]!.shiny = true;
    run = win(run);
    expect(run.eggs[0]?.left).toBe(1);
    expect(run.pending.some((d) => d.kind === 'caught' && d.mon.hatched)).toBe(false);
    run.pending = [];
    run = win(run);
    expect(run.eggs).toEqual([]);
    const hatched = run.pending.find((d) => d.kind === 'caught' && d.mon.hatched);
    expect(hatched?.kind).toBe('caught');
    if (hatched?.kind !== 'caught') return;
    expect(hatched.mon).toMatchObject({ speciesId: 'charmander', level: 8, shiny: true, hatched: true });
    expect(hatched.mon.friendship).toBeGreaterThanOrEqual(HATCH_FRIENDSHIP);
    for (const id of egg.eggMoves) expect(hatched.mon.moves.map((m) => m.id)).toContain(id);
    expect(run.log.counters.eggsHatched).toBe(1);
  });

  it('a stage Egg ignores ordinary battles', () => {
    let run = newRun();
    layEgg(content, run, 'pichu', { level: 5, left: 1, unit: 'stage', source: 'Test' }, rng());
    run = win(run);
    expect(run.eggs).toHaveLength(1);
    expect(tickEggs(content, run, 'stage')).toHaveLength(1);
    expect(run.eggs).toEqual([]);
  });

  it('Elm: hatched Pokémon start three levels higher', () => {
    const run = newRun('eggs', 'elm');
    const egg = layEgg(content, run, 'togepi', { level: 10, left: 1, unit: 'battle', source: 'Test' }, rng());
    expect(hatchEgg(content, run, egg).level).toBe(13);
    expect(hatchEgg(content, newRun(), egg).level).toBe(10);
  });

  it('the Mystery Egg lays a first-stage Egg that hatches after 3 stages', () => {
    const run = newRun();
    const result = applyCatalog(content, run, getCatalogEntry(content, 'mystery-egg'), undefined, { moneyMultiplier: 1, rng: rng() });
    expect(result.messages.join(' ')).toContain('Egg');
    expect(run.eggs).toHaveLength(1);
    expect(run.eggs[0]).toMatchObject({ left: 3, unit: 'stage', source: 'Mystery Egg' });
    expect(content.species.get(run.eggs[0]!.speciesId)!.evolutionStage).toBe(1);
    expect(eggStatus(run.eggs[0]!)).toBe('Hatches in 3 stages');
  });

  it('the Egg Nest event gives an Egg instead of an instant Pokémon', () => {
    const run = newRun();
    const node = run.stage!.map.nodes[0]!;
    run.stage!.current = node.id;
    run.stage!.visited = [node.id];
    node.sides.push({ id: 'nest', kind: 'event', used: false, eventId: 'egg-nest' });
    const out = chooseEvent(content, run, 'nest', 0).run;
    expect(out.eggs).toHaveLength(1);
    expect(out.pending.some((d) => d.kind === 'caught')).toBe(false);
  });

  it('Eggs survive a save round trip, and a save from before Eggs loads with none', () => {
    const run = newRun();
    layEgg(content, run, 'eevee', { level: 5, left: 3, unit: 'battle', source: 'Test' }, rng());
    expect(RunStateSchema.parse(JSON.parse(JSON.stringify(run))).eggs).toEqual(run.eggs);
    const old = JSON.parse(JSON.stringify(run));
    delete old.eggs;
    expect(RunStateSchema.parse(old).eggs).toEqual([]);
  });

  it('a Mystery Egg from an older save (kept as item counters) becomes an Egg at the next stage instead of being lost', () => {
    const run = newRun();
    run.itemCounters = { ...run.itemCounters, 'egg:7': 3, 'egg-shiny:7': 4 };
    hatchEggs(content, run);
    expect(run.itemCounters?.['egg:7']).toBeUndefined();
    expect(run.eggs).toHaveLength(1);
    expect(run.eggs[0]).toMatchObject({ left: 2, unit: 'stage', source: 'Mystery Egg' });
  });
});
