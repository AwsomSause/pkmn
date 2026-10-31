// Exploration (APPROVED.md §5-6): fog of war, weather fronts, roaming Legendaries, camps, secret
// paths, callbacks, landmark rooms and the stops of the limited-time events.

import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/core/contentSchema';
import { addEventStops, chooseEvent, eligibleEvents, stopIsHidden } from '../../src/core/events';
import { findNode, nextChoices } from '../../src/core/map';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { chooseStarter, chooseNode, createRun } from '../../src/core/run';
import { StageStateSchema, type RunState } from '../../src/core/state';
import { advanceRoamers, applyFrontWeather, convoyStep, healConvoy, forecast, foggedAt, frontAt, isFogged, placeCamp, roamerOn, scoutAhead, sightRange, spawnRoamers, stageFronts, stageHasCamp, visibleColumn } from '../../src/core/world';
import { content } from './helpers';

const withWorld = (patch: Partial<Content['balance']['world']>): Content => ({ ...content, balance: { ...content.balance, world: { ...content.balance.world, ...patch } } });

function newRun(c: Content = content, seed = 'world'): RunState {
  return chooseStarter(c, createRun(c, { runId: 'r', seed, archetypeId: 'red' }), 0);
}

/** Puts a Pokémon of this species in the lead (its own ability, not an override). */
function setLead(run: RunState, species: string): void {
  run.party[0] = createPokemon(content, species, 5, run.party[0]!.uid);
}

const eventStops = (run: RunState) => run.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.kind === 'event').map((s) => ({ node: n, side: s })));

/** Stands the run on the first node with this event beside it. */
function atEvent(run: RunState, eventId: string, sideId = 'test-event'): RunState {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  node.sides.push({ id: sideId, kind: 'event', used: false, eventId });
  return run;
}

describe('fog of war', () => {
  it('shows a few columns ahead, never the gym, and never what you have visited', () => {
    const run = newRun();
    const stage = run.stage!;
    const sight = sightRange(content, run);
    expect(sight).toBeGreaterThanOrEqual(content.balance.world.fogSight);
    const seen = visibleColumn(content, run);
    expect(seen).toBe(sight); // before the first node
    const far = stage.map.nodes.find((n) => n.column === seen + 1)!;
    expect(foggedAt(stage, seen, far)).toBe(true);
    expect(isFogged(content, run, far)).toBe(true);
    const near = stage.map.nodes.find((n) => n.column === 1)!;
    expect(isFogged(content, run, near)).toBe(false);
    const gym = stage.map.nodes.find((n) => n.column === stage.map.columns)!;
    expect(isFogged(content, run, gym)).toBe(false);
    stage.visited.push(far.id);
    expect(isFogged(content, run, far)).toBe(false);
  });

  it('scouting shows more columns for the rest of the stage and walking moves the fog on', () => {
    const run = newRun();
    const before = visibleColumn(content, run);
    expect(scoutAhead(content, run, 4)).toBe(before + 4);
    expect(visibleColumn(content, run)).toBe(before + 4);
    const walked = chooseNode(content, newRun(), nextChoices(newRun().stage!)[0]!.id);
    expect(visibleColumn(content, walked)).toBeGreaterThan(before);
  });

  it('a keen-eyed or Flying party sees a column further', () => {
    const run = newRun();
    const base = sightRange(content, run);
    setLead(run, 'sentret'); // Keen Eye
    expect(sightRange(content, run)).toBe(base + 1);
  });
});

describe('weather fronts', () => {
  it('come from the seed, cover columns of the stage and are the same every time', () => {
    let found = 0;
    for (let i = 0; i < 12; i++) {
      const run = newRun(content, `front-${i}`);
      const fronts = stageFronts(content, run);
      expect(stageFronts(content, structuredClone(run))).toEqual(fronts);
      for (const f of fronts) {
        found++;
        expect(f.from).toBeGreaterThanOrEqual(1);
        expect(f.to).toBeLessThan(run.stage!.map.columns);
        expect(content.balance.world.frontWeathers).toContain(f.weather);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('a battle on a node inside a front starts in that weather, and a node outside it does not', () => {
    const run = newRun();
    run.stage!.extraFronts.push({ weather: 'sand', from: 1, to: 1 });
    const inside = chooseNode(content, structuredClone(run), nextChoices(run.stage!)[0]!.id);
    if (inside.battle) expect(inside.battle.weather?.id).toBe('sand');
    const node = run.stage!.map.nodes.find((n) => n.column === 3 && n.kind === 'wild')!;
    expect(applyFrontWeather(content, { ...run, battle: null }, node)).toBeNull();
  });

  it('a forecast names the next front within the telegraph distance', () => {
    const run = newRun();
    run.stage!.extraFronts.push({ weather: 'hail', from: 3, to: 4 });
    const fc = forecast(content, run);
    expect(fc?.front.weather === 'hail' || fc !== null).toBe(true);
    const mine = stageFronts(content, run).find((f) => f.weather === 'hail' && f.from === 3)!;
    expect(frontAt(content, run, run.stage!.map.nodes.find((n) => n.column === 3)!)?.weather).toBe(mine.weather);
  });

  it('a Weather Vane brings a chosen front in', () => {
    const run = atEvent(newRun(), 'weather-vane');
    const after = chooseEvent(content, run, 'test-event', 0).run;
    expect(after.stage!.extraFronts.some((f) => f.weather === 'rain')).toBe(true);
  });
});

describe('roaming Legendaries', () => {
  const c = withWorld({ roamerChance: 1, roamerMinStage: 1 });

  it('a map can hold one, shown as a stop beside a node that moves as you do', () => {
    const run = newRun(c, 'roam');
    const stage = run.stage!;
    expect(stage.roamers).toHaveLength(1);
    const r = stage.roamers[0]!;
    expect(roamerOn(stage, r.nodeId!)).toBe(r.species);
    const stops = () => eventStops(run).filter((s) => s.side.roamer);
    expect(stops()).toHaveLength(1);
    expect(content.events.get(`roamer-${r.species}`)?.stop).toBe('roamer');
    // Stepping onto the first column moves it ahead (or it rests), never behind.
    const start = findNode(stage.map, r.nodeId!);
    const step = stage.map.nodes.find((n) => n.column === 1)!;
    advanceRoamers(c, run, step);
    const now = stage.roamers[0]!;
    if (now.status === 'roaming') expect(findNode(stage.map, now.nodeId!).column).toBeGreaterThanOrEqual(start.column);
    expect(stops().filter((s) => !s.side.used).length).toBe(now.status === 'roaming' ? 1 : 0);
  });

  it('is deterministic: the same run and step move it to the same place', () => {
    const a = newRun(c, 'roam-2');
    const b = newRun(c, 'roam-2');
    expect(a.stage!.roamers).toEqual(b.stage!.roamers);
    const step = a.stage!.map.nodes.find((n) => n.column === 1)!;
    advanceRoamers(c, a, step);
    advanceRoamers(c, b, step);
    expect(a.stage!.roamers).toEqual(b.stage!.roamers);
  });

  it('a roamer left behind slips away, and playing its stop ends the chase', () => {
    const run = newRun(c, 'roam-3');
    const stage = run.stage!;
    const roamer = stage.roamers[0]!;
    const here = findNode(stage.map, roamer.nodeId!);
    const stop = here.sides.find((s) => s.roamer)!;
    stage.current = here.id;
    stage.visited.push(here.id);
    const after = chooseEvent(c, run, stop.id, 2).run; // watch from a distance
    expect(after.stage!.roamers[0]!.status).toBe('done');
    const passed = newRun(c, 'roam-4');
    const lead = passed.stage!.map.nodes.find((n) => n.column === passed.stage!.map.columns - 1)!;
    advanceRoamers(c, passed, lead);
    expect(passed.stage!.roamers[0]!.status).toBe('gone');
  });

  it('the Legendary Beasts Chase puts all three beasts on the map together', () => {
    const run = newRun(c, 'beasts');
    run.gameEvents = ['legendary-beasts-chase@2026-W44'];
    spawnRoamers(c, run);
    expect(run.stage!.roamers.map((r) => r.species).sort()).toEqual(['entei', 'raikou', 'suicune']);
  });

  it('has an event and a species for every roamer in the balance file', () => {
    for (const r of content.balance.world.roamers) {
      expect(content.species.has(r.species), r.species).toBe(true);
      expect(content.events.get(`roamer-${r.species}`)?.stop).toBe('roamer');
    }
  });
});

describe('checkpoint camps', () => {
  it('a camp turns up every other stage, in the middle of the map, and gives one free service', () => {
    const run = newRun();
    expect(stageHasCamp(content, run)).toBe(false); // the first stage has none
    run.stage!.index = 2;
    expect(stageHasCamp(content, run)).toBe(true);
    placeCamp(content, run);
    const camps = eventStops(run).filter((s) => s.side.eventId === 'camp-checkpoint');
    expect(camps).toHaveLength(1);
    const [lo, hi] = content.balance.world.campColumns;
    expect(camps[0]!.node.column).toBeGreaterThanOrEqual(lo);
    expect(camps[0]!.node.column).toBeLessThanOrEqual(hi);
    const there = atEvent(run, 'camp-checkpoint');
    there.party[0]!.hp = 1;
    const after = chooseEvent(content, there, 'test-event', 0).run;
    expect(after.party[0]!.hp).toBe(maxHp(content, after.party[0]!));
    const planned = chooseEvent(content, atEvent(newRun(), 'camp-checkpoint'), 'test-event', 1).run;
    expect(planned.stage!.scoutedTo).toBeGreaterThan(0);
  });

  it('is never drawn as an ordinary event', () => {
    expect(eligibleEvents(content, newRun()).some((e) => e.id === 'camp-checkpoint')).toBe(false);
  });
});

describe('secret paths', () => {
  it('stay a "?" until a party Pokémon has the ability, then show themselves', () => {
    const run = atEvent(newRun(), 'secret-keen-eye-ledge');
    const node = run.stage!.map.nodes[0]!;
    const side = node.sides.find((s) => s.id === 'test-event')!;
    side.hidden = true;
    run.stage!.current = null;
    expect(stopIsHidden(content, run, node, side)).toBe(true);
    setLead(run, 'sentret');
    expect(stopIsHidden(content, run, node, side)).toBe(false);
  });

  it('their choices are locked without the ability and work with it', () => {
    const run = atEvent(newRun(), 'secret-levitate-chasm');
    expect(() => chooseEvent(content, run, 'test-event', 0)).toThrow(/Levitating/);
    setLead(run, 'gastly');
    const after = chooseEvent(content, run, 'test-event', 0).run;
    expect(after.stage!.scoutedTo).toBeGreaterThan(0);
  });
});

describe('follow-up scenes', () => {
  it('a kindness comes back on the next stage as a stop, once', () => {
    const run = newRun();
    run.story.flags['ev:fed-wild'] = 1;
    run.stage!.index = 3;
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'starving-wild-returns')).toBe(true);
    run.itemCounters = { ...run.itemCounters, 'event-seen:starving-wild-returns': 1 };
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'starving-wild-returns')).toBe(false);
  });

  it('the egg cradle plays out over three stages with the flag counting up', () => {
    let run = atEvent(newRun(), 'egg-cradle-find');
    run.stage!.index = 3;
    run = chooseEvent(content, run, 'test-event', 0).run;
    expect(run.story.flags['ev:cradle']).toBe(1);
    expect(run.eggs.length).toBeGreaterThan(0);
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'egg-cradle-night')).toBe(true);
    run = atEvent(run, 'egg-cradle-night', 'night');
    run = chooseEvent(content, run, 'night', 0).run;
    expect(run.story.flags['ev:cradle']).toBe(2);
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'egg-cradle-hatch')).toBe(true);
  });
});

describe('landmarks and dungeons', () => {
  it('a landmark opens its rooms one after another beside the same node', () => {
    let run = atEvent(newRun(), 'lighthouse-entrance');
    run = chooseEvent(content, run, 'test-event', 0).run;
    const here = findNode(run.stage!.map, run.stage!.current!);
    expect(here.sides.some((s) => s.eventId === 'lighthouse-1' && !s.used)).toBe(true);
  });

  it('rooms are never drawn on their own', () => {
    const rooms = [...content.events.values()].filter((e) => e.room);
    expect(rooms.length).toBeGreaterThan(40);
    const run = newRun();
    run.stage!.index = 4;
    const drawn = new Set(eligibleEvents(content, run).map((e) => e.id));
    for (const r of rooms) expect(drawn.has(r.id), r.id).toBe(false);
  });

  it('every room is reached from an event, and every room an event opens exists', () => {
    const opened = new Set<string>();
    for (const e of content.events.values()) {
      for (const ch of e.choices) {
        for (const o of [ch.success, ch.failure]) {
          for (const ef of [...(o?.effects ?? []), ...(o?.battle?.win ?? [])]) {
            if (ef.kind === 'addEvent') opened.add(ef.eventId);
            if (ef.kind === 'addEventFrom') ef.ids.forEach((i) => opened.add(i));
          }
        }
      }
    }
    for (const id of opened) expect(content.events.get(id)?.room, id).toBe(true);
    for (const e of content.events.values()) if (e.room) expect(opened.has(e.id), e.id).toBe(true);
  });

  it('a Mystery Dungeon floor picks its next room from the floor below', () => {
    let run = atEvent(newRun(), 'md-entrance');
    run = chooseEvent(content, run, 'test-event', 0).run;
    const here = findNode(run.stage!.map, run.stage!.current!);
    const room = here.sides.find((s) => s.eventId?.startsWith('md-1-'));
    expect(room).toBeDefined();
  });

  it('the Tower of Legends has five floors', () => {
    for (let i = 1; i <= 5; i++) expect(content.events.get(`tower-${i}`)?.room, `tower-${i}`).toBe(true);
  });
});

describe('limited-time events', () => {
  it('six new weekly events exist and feature only events that exist', () => {
    for (const id of ['legendary-beasts-chase', 'campfire-tales-week', 'plasma-operation', 'hidden-path-week', 'mystery-dungeon-week', 'tower-of-legends']) {
      const g = content.gameEvents.get(id);
      expect(g, id).toBeDefined();
      expect(g!.kind).toBe('weekly');
      for (const e of g!.mapEvents) expect(content.events.has(e), `${id}: ${e}`).toBe(true);
    }
  });

  it("an event's own stops only appear while it is on, and always get a stop on a stage", () => {
    const run = newRun();
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'md-entrance')).toBe(false);
    run.gameEvents = ['mystery-dungeon-week@2026-W44'];
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'md-entrance')).toBe(true);
  });

  it('the Plasma Operation unfolds over its three stops', () => {
    let run = newRun();
    run.gameEvents = ['plasma-operation@2026-W44'];
    run = atEvent(run, 'plasma-op-1');
    run = chooseEvent(content, run, 'test-event', 2).run;
    expect(run.story.flags['ev:plasma-op']).toBe(1);
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'plasma-op-2')).toBe(true);
  });
});

describe('convoy mode', () => {
  const escort = (c: Content = content): RunState => {
    const run = atEvent(newRun(c), 'convoy-lost-researcher');
    return chooseEvent(c, run, 'test-event', 0).run;
  };

  it('an escort event starts a convoy, and not a second one', () => {
    const run = escort();
    expect(run.stage!.convoy).toEqual({ name: 'the researcher', hp: 4, maxHp: 4 });
    expect(eligibleEvents(content, run).some((e) => e.id === 'convoy-lost-researcher')).toBe(false);
  });

  it('battle nodes strike it by a seeded roll, guards soften the blow, and 0 health loses it', () => {
    const hard = withWorld({ convoyHitChance: 1, convoyHit: [2, 2], convoyGuardAbilities: [] });
    const run = escort(hard);
    const node = run.stage!.map.nodes.find((n) => n.kind === 'wild')!;
    convoyStep(hard, run, node);
    expect(run.stage!.convoy!.hp).toBe(2);
    const twin = escort(hard);
    convoyStep(hard, twin, node);
    expect(twin.stage!.convoy).toEqual(run.stage!.convoy);
    convoyStep(hard, run, node);
    expect(run.stage!.convoy).toBeNull();
    expect(run.story.flags['ev:convoy-lost']).toBe(1);
  });

  it('a living escort is delivered at the gym for money; nothing happens with no escort', () => {
    const run = escort();
    run.stage!.convoy!.hp = 3;
    const money = run.money;
    convoyStep(content, run, run.stage!.map.nodes.find((n) => n.kind === 'gym')!);
    expect(run.money).toBe(money + content.balance.world.convoyReward + 3 * content.balance.world.convoyRewardPerHp);
    expect(run.story.flags['ev:convoy-delivered']).toBe(1);
    expect(run.stage!.convoy).toBeNull();
    const none = newRun();
    convoyStep(content, none, none.stage!.map.nodes[0]!);
    expect(none.stage!.convoy).toBeNull();
  });

  it('healing stops at full health, and an old stage loads with no convoy', () => {
    const run = escort();
    run.stage!.convoy!.hp = 1;
    healConvoy(run, 9);
    expect(run.stage!.convoy!.hp).toBe(4);
    const { convoy: _c, ...old } = JSON.parse(JSON.stringify(run.stage));
    expect(StageStateSchema.parse(old).convoy).toBeNull();
  });
});

describe('saves', () => {
  it('a stage saved before these fields existed still loads, with the defaults', () => {
    const run = newRun();
    const { scoutedTo: _s, extraFronts: _f, roamers: _r, ...old } = run.stage!;
    const parsed = StageStateSchema.parse(old);
    expect(parsed.scoutedTo).toBe(0);
    expect(parsed.extraFronts).toEqual([]);
    expect(parsed.roamers).toEqual([]);
  });

  it('a stage with a roamer, a front and a scouted map round-trips through JSON', () => {
    const run = newRun(withWorld({ roamerChance: 1, roamerMinStage: 1 }), 'save');
    run.stage!.scoutedTo = 7;
    run.stage!.extraFronts.push({ weather: 'rain', from: 2, to: 4 });
    expect(StageStateSchema.parse(JSON.parse(JSON.stringify(run.stage)))).toEqual(run.stage);
  });
});
