// Eggs: laid by events or the Mystery Egg, they hatch after battles (or stages) with their egg moves.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { freshSos } from '../../src/core/battle/sos';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { eggLabel, eggProgress, eggRevealed, eggStatus, eggWarmth, hatchEgg, HATCH_FRIENDSHIP, layEgg, tickEggs } from '../../src/core/eggs';
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

describe('Egg tiers, warmth and progress', () => {
  it('only listed origins roll a tier; an unknown origin is always Ordinary', () => {
    for (let i = 0; i < 20; i++) expect(layEgg(content, newRun(`o${i}`), 'charmander', { level: 5, left: 3, unit: 'stage', source: 'Test' }, rng()).tier).toBe('ordinary');
  });

  it('tiers come from the run seed alone: same seed, same tier, and the caller rng is not moved', () => {
    const a = rng('x');
    const b = rng('x');
    const e1 = layEgg(content, newRun('t1'), 'charmander', { level: 5, left: 3, unit: 'stage', source: 'Mystery Egg' }, a);
    const e2 = layEgg(content, newRun('t1'), 'charmander', { level: 5, left: 3, unit: 'stage', source: 'Mystery Egg' }, b);
    expect(e1).toEqual(e2);
    const tiers = new Set<string>();
    for (let i = 0; i < 300; i++) tiers.add(layEgg(content, newRun(`t${i}`), 'charmander', { level: 5, left: 3, unit: 'stage', source: 'Mystery Egg' }, rng()).tier);
    expect(tiers.has('ordinary')).toBe(true);
    expect(tiers.has('rare') || tiers.has('exceptional')).toBe(true);
  });

  it('a forced rare Egg takes longer, carries more egg moves, and hatches stronger and friendlier', () => {
    const run = newRun();
    const egg = layEgg(content, run, 'charmander', { level: 8, left: 3, unit: 'stage', source: 'Test', tier: 'exceptional' }, rng());
    expect(egg).toMatchObject({ tier: 'exceptional', left: 5, total: 5, hidden: true });
    const mon = hatchEgg(content, run, egg);
    expect(mon).toMatchObject({ eggTier: 'exceptional', level: 11, abilitySlot: -1 });
    expect(mon.friendship).toBe(200);
  });

  it('a Mystery origin hides its tier until it is half hatched', () => {
    const run = newRun();
    const egg = layEgg(content, run, 'charmander', { level: 8, left: 4, unit: 'stage', source: 'Hidden Nest', tier: 'rare' }, rng());
    expect(eggRevealed(egg)).toBe(false);
    expect(eggLabel(egg)).toContain('Mystery Egg');
    const half = { ...egg, left: Math.floor(egg.total! / 2) };
    expect(eggRevealed(half)).toBe(true);
    expect(eggLabel(half)).toContain('Rare Egg');
    expect(eggProgress({ ...egg, left: egg.total! })).toBe(0);
  });

  it('a warm party Pokémon (Flame Body) hatches Eggs faster: two warmth make one extra step', () => {
    const run = newRun();
    const lead = run.party[0]!;
    lead.speciesId = 'magmar';
    lead.abilitySlot = 0;
    expect(eggWarmth(content, run)).toBe(1);
    layEgg(content, run, 'charmander', { level: 5, left: 4, unit: 'stage', source: 'Test' }, rng());
    tickEggs(content, run, 'stage');
    tickEggs(content, run, 'stage');
    expect(run.eggs[0]!.left).toBe(1); // 4 - 2 steps - 1 bonus step
    lead.hp = 0;
    expect(eggWarmth(content, run)).toBe(0);
  });

  it('old Eggs without tier fields still load as Ordinary', () => {
    const run = newRun();
    layEgg(content, run, 'charmander', { level: 5, left: 3, unit: 'stage', source: 'Test' }, rng());
    const raw = JSON.parse(JSON.stringify(run));
    for (const k of ['tier', 'kind', 'total', 'heat', 'hidden', 'blissful']) delete raw.eggs[0][k];
    const loaded = RunStateSchema.parse(raw);
    expect(loaded.eggs[0]).toMatchObject({ tier: 'ordinary', kind: 'standard', heat: 0, hidden: false, blissful: false });
    expect(eggProgress(loaded.eggs[0]!)).toBe(0);
  });
});
