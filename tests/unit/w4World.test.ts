// Ideas W4 (map, world and run structure): traversal obstacles, skill-prompt event choices, the wandering
// trainer and companion, express moves, the treasure map, regional landmarks, the time rift and run v34.

import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/core/contentSchema';
import { chooseEvent, conditionMet, eventView, giveItem } from '../../src/core/events';
import { hashSeed, Rng } from '../../src/core/rng';
import { nextChoices } from '../../src/core/map';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { chooseNode, chooseNodeWithNotes, chooseStarter, createRun, mapActions, mapPreviews, useMapAction, TREASURE_DIG_EVENT } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { crossingFor, crossingHint, obstacleWeight, placeLandmark, placeObstacles, TRAVERSAL, obstacleDef, towerClimb, tremorStep } from '../../src/core/traversal';
import { befriendWanderer, companionLeft, startWanderer, wandererLeft, wandererStageStart, WANDERER_CHALLENGE, WANDERER_VISIT } from '../../src/core/wanderer';
import { promptById } from '../../src/core/interaction/prompt';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { content } from './helpers';

function newRun(c: Content = content, seed = 'w4'): RunState {
  return chooseStarter(c, createRun(c, { runId: 'r', seed, archetypeId: 'red' }), 0);
}
const lead = (run: RunState, species: string) => (run.party[0] = createPokemon(content, species, 20, run.party[0]!.uid));
/** Puts an obstacle on the first column-1 node (so `chooseNode` can walk onto it). */
function obstacleAhead(run: RunState, id: string) {
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  run.stage!.obstacles = { [node.id]: id };
  return node;
}
function atEvent(run: RunState, eventId: string) {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  node.sides.push({ id: 'w4-test', kind: 'event', used: false, eventId });
  return run;
}

describe('traversal data', () => {
  it('every obstacle names its idea, gives a reward or a detour, and every item and event it names exists', () => {
    expect(TRAVERSAL.obstacles.length).toBeGreaterThanOrEqual(20);
    for (const o of TRAVERSAL.obstacles) {
      expect(o.pass.length, o.id).toBeGreaterThan(0);
      for (const t of o.types) expect(Object.keys(content.typeChart), `${o.id} ${t}`).toContain(t);
      for (const a of o.abilities) expect(content.abilities.has(a), `${o.id} ${a}`).toBe(true);
      for (const e of [...o.pass, ...o.detour]) {
        if (e.kind === 'itemFrom') for (const i of e.ids) expect(content.catalog.has(i) || content.items.has(i), `${o.id} ${i}`).toBe(true);
        if (e.kind === 'addEvent') expect(content.events.get(e.eventId)?.room, e.eventId).toBe(true);
      }
    }
  });
});

describe('placing obstacles', () => {
  it('puts a few on wild nodes in the middle of the map, never closing a path, the same for the same seed', () => {
    for (const seed of ['w4', 'w4b', 'w4c', 'w4d', 'w4e']) {
      const run = newRun(content, seed);
      const stage = run.stage!;
      const placed = Object.entries(stage.obstacles ?? {});
      expect(placed.length).toBeLessThanOrEqual(TRAVERSAL.perStage);
      for (const [nodeId, id] of placed) {
        const node = stage.map.nodes.find((n) => n.id === nodeId)!;
        expect(node.kind).toBe('wild');
        expect(node.column).toBeGreaterThanOrEqual(TRAVERSAL.fromColumn);
        expect(node.column).toBeLessThanOrEqual(stage.map.columns - 2);
        expect(obstacleDef(id)).toBeDefined();
        // Every node leading in has another way forward without an obstacle.
        for (const p of stage.map.nodes.filter((n) => n.next.includes(nodeId))) expect(p.next.some((x) => !stage.obstacles![x]), `${seed} ${p.id}`).toBe(true);
      }
      expect(newRun(content, seed).stage!.obstacles).toEqual(stage.obstacles);
    }
  });

  it('is off with balance.world.traversal false, and live events add obstacles and tilt the kinds', () => {
    const off: Content = { ...content, balance: { ...content.balance, world: { ...content.balance.world, traversal: false } } };
    expect(newRun(off).stage!.obstacles).toBeUndefined();
    const run = newRun();
    run.perkEffects = [...(run.perkEffects ?? []), { kind: 'traversalExtra', count: 3 }, { kind: 'traversalWeight', obstacle: 'lava-river', value: 1000 }];
    placeObstacles(content, run);
    const ids = Object.values(run.stage!.obstacles!);
    expect(ids.length).toBeGreaterThan(TRAVERSAL.perStage);
    expect(ids.filter((i) => i === 'lava-river').length).toBeGreaterThanOrEqual(ids.length - 1);
  });

  it('seasonal terrain: a spring flood only in spring, a frozen pond only in winter', () => {
    const run = newRun();
    const flood = obstacleDef('flooded-path')!;
    const pond = obstacleDef('frozen-pond')!;
    run.clock.day = 1; // Spring
    expect(obstacleWeight(content, run, flood, [])).toBeGreaterThan(0);
    expect(obstacleWeight(content, run, pond, [])).toBe(0);
    run.clock.day = 1 + 3 * content.balance.clock.seasonLength; // Winter
    expect(obstacleWeight(content, run, flood, [])).toBe(0);
    expect(obstacleWeight(content, run, pond, [])).toBeGreaterThan(0);
  });
});

describe('crossing an obstacle', () => {
  it('a Water-type surfs the lake: a reward, a fishing spot and friendship; the obstacle is gone', () => {
    const run = newRun();
    lead(run, 'squirtle');
    const node = obstacleAhead(run, 'lake');
    expect(crossingFor(content, run, node)!.how).toBe('type');
    expect(crossingHint(content, run, node)).toContain('Squirtle can cross');
    const bag = Object.values(run.inventory).reduce((a, b) => a + b, 0) + run.money;
    const friend = run.party[0]!.friendship;
    const { run: after, crossing } = chooseNodeWithNotes(content, run, node.id);
    expect(crossing).toContain('Squirtle surfs the party across the Wide Lake');
    const here = after.stage!.map.nodes.find((n) => n.id === node.id)!;
    expect(here.sides.some((s) => s.kind === 'fish')).toBe(true);
    expect(after.stage!.obstacles![node.id]).toBeUndefined();
    expect(Object.values(after.inventory).reduce((a, b) => a + b, 0) + after.money).toBeGreaterThan(bag);
    expect(after.party[0]!.friendship).toBeGreaterThan(friend);
    expect(after.log.counters.obstaclesCleared).toBe(1);
  });

  it('without a fitting Pokémon the party takes the long way round: HP lost, never a knockout, battle still starts', () => {
    const run = newRun();
    lead(run, 'rattata');
    run.party[0]!.hp = 1;
    const node = obstacleAhead(run, 'lake');
    expect(crossingFor(content, run, node)!.how).toBeNull();
    const { run: after, crossing } = chooseNodeWithNotes(content, run, node.id);
    expect(crossing).toContain('long shore');
    expect(after.party[0]!.hp).toBe(1);
    expect(after.log.counters.obstaclesDetoured).toBe(1);
    expect(after.battle).not.toBeNull();
  });

  it('the weather clash: a rain front puts the wildfire out; a flyer spends stamina over a cliff', () => {
    const run = newRun();
    lead(run, 'rattata');
    const node = obstacleAhead(run, 'wildfire');
    run.stage!.extraFronts.push({ weather: 'rain', from: 1, to: 2 });
    expect(crossingFor(content, run, node)!.how).toBe('weather');
    const flyer = newRun();
    lead(flyer, 'pidgey');
    const cliff = obstacleAhead(flyer, 'cliff');
    const full = maxHp(content, flyer.party[0]!);
    flyer.party[0]!.hp = full;
    const after = chooseNode(content, flyer, cliff.id);
    expect(after.party[0]!.hp).toBeLessThan(full);
  });

  it('the same crossing gives the same reward (seeded from the run and node, no gameplay stream)', () => {
    const a = newRun();
    lead(a, 'squirtle');
    const node = obstacleAhead(a, 'lake');
    const b = structuredClone(a);
    expect(chooseNodeWithNotes(content, a, node.id).crossing).toBe(chooseNodeWithNotes(content, b, node.id).crossing);
    expect(chooseNode(content, a, node.id).rng).toEqual(chooseNode(content, b, node.id).rng);
  });
});

describe('skill prompts on event choices', () => {
  it('the grade decides the choice; no grade counts as a miss', () => {
    const def = content.events.get('w4-zip-line')!;
    const i = def.choices.findIndex((c) => c.prompt);
    expect(promptById(def.choices[i]!.prompt!.id).kind).toBe('timing');
    expect(eventView(content, atEvent(newRun(), 'w4-zip-line'), 'w4-test').choices[i]!.risk).toContain('Skill');
    expect(chooseEvent(content, atEvent(newRun(), 'w4-zip-line'), 'w4-test', i, undefined, 'good').success).toBe(true);
    expect(chooseEvent(content, atEvent(newRun(), 'w4-zip-line'), 'w4-test', i, undefined, 'miss').success).toBe(false);
    expect(chooseEvent(content, atEvent(newRun(), 'w4-zip-line'), 'w4-test', i).success).toBe(false);
  });

  it('every prompt an event names exists and every prompt choice has a failure', () => {
    for (const e of content.events.values()) for (const c of e.choices) if (c.prompt) {
      expect(() => promptById(c.prompt!.id), `${e.id}`).not.toThrow();
      expect(c.failure, e.id).toBeDefined();
    }
  });
});

describe('express moves, the wandering trainer and the companion', () => {
  it('an express ride skips a column without any item', () => {
    const run = atEvent(newRun(), 'w4-riddle-signpost');
    const after = chooseEvent(content, run, 'w4-test', 0).run;
    expect(after.moveMode).toBe('bicycle');
    const target = nextChoices(after.stage!).flatMap((n) => n.next)[0]!;
    const moved = chooseNode(content, after, target);
    expect(moved.stage!.current).toBe(target);
  });

  it('a tailing trainer steps out after its nodes; beating them makes a companion who catches up next stage', () => {
    const run = newRun();
    startWanderer(run, 1);
    const first = run.stage!.map.nodes.find((n) => n.column === 1)!;
    run.stage!.obstacles = {};
    const after = chooseNode(content, run, first.id);
    expect(wandererLeft(after)).toBe(0);
    expect(after.stage!.map.nodes.find((n) => n.id === first.id)!.sides.some((s) => s.eventId === WANDERER_CHALLENGE)).toBe(true);
    befriendWanderer(after, 2);
    wandererStageStart(after);
    expect(companionLeft(after)).toBe(1);
    expect(after.stage!.map.nodes.some((n) => n.sides.some((s) => s.eventId === WANDERER_VISIT))).toBe(true);
  });
});

describe('treasure map, time rift, landmarks and conditions', () => {
  it('the Treasure Map opens a dig site a few columns ahead and is used up', () => {
    const run = newRun();
    expect(giveItem(content, run, 'treasure-map', 1, new Rng(hashSeed('t')))).toContain('Treasure Map');
    const action = mapActions(content, run).find((a) => a.kind === 'treasureMap');
    expect(action?.problem ?? null).toBeNull();
    const { run: after } = useMapAction(content, run, 'treasureMap');
    const site = after.stage!.map.nodes.find((n) => n.sides.some((s) => s.eventId === TREASURE_DIG_EVENT))!;
    expect(site.column).toBeGreaterThanOrEqual(2);
    expect(mapActions(content, after).some((a) => a.kind === 'treasureMap')).toBe(false);
  });

  it('a time rift shows the battles at the next nodes', () => {
    const run = atEvent(newRun(), 'w4-time-rift');
    const after = chooseEvent(content, run, 'w4-test', 0).run;
    expect(Object.values(mapPreviews(content, after)).some((p) => p.source === 'The time rift')).toBe(true);
  });

  it("each region's landmark is placed once on its second stage and grants a lasting effect", () => {
    const run = newRun();
    run.stage!.index = 1;
    placeLandmark(content, run);
    const side = run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => content.events.get(s.eventId ?? '')?.stop === 'landmark')!;
    expect(side).toBeDefined();
    const node = run.stage!.map.nodes.find((n) => n.sides.includes(side))!;
    run.stage!.current = node.id;
    run.stage!.visited = [node.id];
    const before = (run.perkEffects ?? []).length;
    const after = chooseEvent(content, run, side.id, 0).run;
    expect((after.perkEffects ?? []).length).toBeGreaterThan(before);
    // Not placed again once seen, and every region has exactly one landmark.
    after.stage!.map.nodes.forEach((n) => (n.sides = n.sides.filter((s) => s.id !== side.id)));
    placeLandmark(content, after);
    expect(after.stage!.map.nodes.flatMap((n) => n.sides).some((s) => s.eventId === side.eventId)).toBe(false);
    const landmarks = [...content.events.values()].filter((e) => e.stop === 'landmark');
    for (const region of content.regions.keys()) expect(landmarks.filter((e) => e.requires.some((c) => c.kind === 'region' && c.ids.includes(region))).length, region).toBe(1);
  });

  it('season and region conditions read the run', () => {
    const run = newRun();
    run.clock.day = 1;
    expect(conditionMet(content, run, { kind: 'season', in: ['Spring'] })).toBe(true);
    expect(conditionMet(content, run, { kind: 'season', in: ['Winter'] })).toBe(false);
    expect(conditionMet(content, run, { kind: 'region', ids: [run.regionOrder[run.regionIndex]!] })).toBe(true);
  });
});

describe('W9 live events that waited on W4', () => {
  it('Map Mutator Week puts three more obstacles on a stage; Blizzard Week fills it with snowdrifts', () => {
    const plain = newRun(content, 'mut');
    const mutant = chooseStarter(content, createRun(content, { runId: 'r', seed: 'mut', archetypeId: 'red', gameEvents: ['map-mutator-week@2026'] }), 0);
    expect(Object.keys(mutant.stage!.obstacles!).length).toBeGreaterThan(Object.keys(plain.stage!.obstacles!).length);
    const blizzard = chooseStarter(content, createRun(content, { runId: 'r', seed: 'snow', archetypeId: 'red', gameEvents: ['blizzard-week@2026'] }), 0);
    const ids = Object.values(blizzard.stage!.obstacles!);
    expect(ids.length).toBeGreaterThan(TRAVERSAL.perStage);
    expect(ids).toContain('snowdrift');
  });

  const weekRun = (id: string, seed = 'wk') => chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red', gameEvents: [`${id}@2026`] }), 0);

  it('Earthquake Tremors: every 3 nodes walked, two stops ahead swap places (seeded, same result twice)', () => {
    const shake = () => {
      const run = weekRun('earthquake-tremors', 'quake');
      const stage = run.stage!;
      const here = stage.map.nodes.find((n) => n.column === 1)!;
      stage.current = here.id;
      stage.visited = ['a', 'b', here.id];
      const ahead = stage.map.nodes.filter((n) => n.column > 1 && n.column < stage.map.columns);
      ahead[0]!.sides.push({ id: 'marker', kind: 'heal', used: false });
      const before = ahead.map((n) => n.sides.map((x) => x.id).join());
      const words = tremorStep(content, run);
      return { words, changed: ahead.map((n) => n.sides.map((x) => x.id).join()).filter((v, i) => v !== before[i]).length, run };
    };
    const first = shake();
    expect(first.words).toMatch(/ground shakes/);
    expect(first.changed).toBe(2);
    expect(shake().words).toBe(first.words);
    // Not on a step that is not a multiple of 3, and never without the week.
    first.run.stage!.visited.push('d');
    expect(tremorStep(content, first.run)).toBeNull();
    const calm = newRun(content, 'quake');
    calm.stage!.current = calm.stage!.map.nodes[0]!.id;
    calm.stage!.visited = ['a', 'b', calm.stage!.current];
    expect(tremorStep(content, calm)).toBeNull();
  });

  it('Sky Tower Climb: the map climbs and every 5th level has a healing checkpoint (not on the last two)', () => {
    const run = weekRun('sky-tower-climb');
    expect(towerClimb(content, run)).toEqual({ checkpointEvery: 5 });
    expect(towerClimb(content, newRun())).toBeNull();
    const stage = run.stage!;
    const points = stage.map.nodes.filter((n) => n.sides.some((x) => x.id.startsWith('checkpoint-')));
    expect(points.length).toBeGreaterThan(0);
    for (const n of points) {
      expect(n.column % 5).toBe(0);
      expect(n.column).toBeLessThan(stage.map.columns - 1);
    }
  });

  it('Magical Forest Maze: each stage has the looping clearing; wrong paths loop back, the glowing path gets out', () => {
    const run = weekRun('magical-forest-week');
    expect(run.stage!.map.nodes.some((n) => n.sides.some((x) => x.eventId === 'w4-forest-maze'))).toBe(true);
    expect(newRun().stage!.map.nodes.some((n) => n.sides.some((x) => x.eventId === 'w4-forest-maze'))).toBe(false);
    const mazeSides = (r: RunState) => r.stage!.map.nodes[0]!.sides.filter((x) => x.eventId === 'w4-forest-maze' && !x.used).length;
    const lost = chooseEvent(content, atEvent(newRun(), 'w4-forest-maze'), 'w4-test', 0).run;
    expect(mazeSides(lost)).toBe(1);
    const out = chooseEvent(content, atEvent(newRun(), 'w4-forest-maze'), 'w4-test', 2).run;
    expect(mazeSides(out)).toBe(0);
  });

  it('every W4 event a live week features exists and is drawn normally (not a room)', () => {
    for (const g of content.gameEvents.values()) for (const id of g.mapEvents ?? []) if (id.startsWith('w4-')) expect(content.events.get(id)?.room, `${g.id} ${id}`).toBeFalsy();
  });
});

describe('run v34', () => {
  it('a version 33 run loads with no obstacles on its stage', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(newRun());
    delete run.stage!.obstacles;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 33, savedAt: '', data: run }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(33);
    expect(loaded.data.stage!.obstacles).toEqual({});
  });

  it('obstacles survive a save and reload', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const run = newRun();
    run.stage!.obstacles = { c3r0: 'lake' };
    saves.saveRun(run);
    const loaded = saves.loadRun();
    expect(loaded.status === 'ok' && loaded.data.stage!.obstacles).toEqual({ c3r0: 'lake' });
  });
});
