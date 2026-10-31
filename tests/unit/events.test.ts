// Map events ("?" stops): placement, choices, checks, battles, event items and saves.

import { describe, expect, it } from 'vitest';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { addEventStops, eligibleEvents, choiceRisk, chooseEvent, eventView, stopIsHidden } from '../../src/core/events';
import { EventChoiceSchema } from '../../src/core/contentSchema';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, takeTurn, type TurnResult } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

function newRun(seed = 'events'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
}

function take(run: RunState, id: string): RunState {
  applyCatalog(content, run, getCatalogEntry(content, id), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
  return run;
}

/** Stands the run on the first node with this event beside it. */
function atEvent(run: RunState, eventId: string, sideId = 'test-event'): RunState {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  node.sides.push({ id: sideId, kind: 'event', used: false, eventId });
  return run;
}

const eventStops = (run: RunState) => run.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.kind === 'event').map((s) => ({ node: n, side: s })));

function win(run: RunState): TurnResult {
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 80 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    turn = takeTurn(content, run, { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

describe('event data', () => {
  it('holds every event from the plan, the key-item events and the rest spots', () => {
    expect(content.events.size).toBeGreaterThanOrEqual(300);
    for (const id of ['mysterious-chest', 'pokemon-center', 'villain-hideout', 'rest-meadow', 'rest-field', 'rest-photo', 'eon-ticket-island', 'lost-property', 'dark-deal', 'safari-zone', 'hot-spring']) expect(content.events.has(id), id).toBe(true);
  });

  it('gives every key item and ticket an event, and makes them work', () => {
    const keys = [...content.catalog.values()].filter((e) => e.effect?.kind === 'perk' && e.effect.perks.some((p) => p.perk === 'eventKey'));
    expect(keys.length).toBeGreaterThanOrEqual(30);
    for (const k of keys) expect([...content.events.values()].some((e) => e.keyItem === k.id), k.id).toBe(true);
    for (const id of ['silph-scope', 'inquiry-mail', 'bridgemail-v', 'explorer-kit', 'prop-case', 'tidal-bell', 'clear-bell']) expect(content.catalog.get(id)?.status, id).toBe('supported');
  });
});

describe('placing event stops', () => {
  it('puts 3–5 events and two rest spots on a stage, never beside the gym, the same for a seed', () => {
    const run = newRun('place');
    const stops = eventStops(run);
    const rests = stops.filter((s) => content.events.get(s.side.eventId!)!.stop === 'rest');
    expect(rests).toHaveLength(content.balance.events.restPerStage);
    expect(stops.length - rests.length).toBeGreaterThanOrEqual(content.balance.events.perStage[0]);
    expect(stops.length - rests.length).toBeLessThanOrEqual(content.balance.events.perStage[1]);
    for (const s of stops) expect(s.node.kind).not.toBe('gym');
    expect(JSON.stringify(newRun('place').stage!.map)).toBe(JSON.stringify(run.stage!.map));
  });

  it('places a key item event while you hold the key', () => {
    const run = take(newRun('key'), 'rm-1-key');
    for (const n of run.stage!.map.nodes) n.sides = n.sides.filter((s) => s.kind !== 'event');
    addEventStops(content, run);
    expect(eventStops(run).some((s) => s.side.eventId === 'rm-1-key-cabin')).toBe(true);
  });

  it('hides some stops as "?" until reached; the Silph Scope shows them all', () => {
    let hidden = null;
    for (let i = 0; i < 30 && !hidden; i++) {
      const run = newRun(`hide-${i}`);
      hidden = eventStops(run).find((s) => s.side.hidden && run.stage!.current !== s.node.id) ? run : null;
    }
    expect(hidden).not.toBeNull();
    const stop = eventStops(hidden!).find((s) => s.side.hidden)!;
    expect(stopIsHidden(content, hidden!, stop.node, stop.side)).toBe(true);
    take(hidden!, 'silph-scope');
    expect(stopIsHidden(content, hidden!, stop.node, stop.side)).toBe(false);
  });
});

describe('recruit events', () => {
  it('stop appearing for a trainer you already own', () => {
    const fresh = newRun('own');
    const owned = structuredClone(fresh);
    owned.itemCounters = { ...owned.itemCounters, 'owned:npc-youngster-joey': 1 };
    const has = (r: RunState) => eligibleEvents(content, r).some((e) => e.id === 'npc-meet-youngster-joey');
    expect(has(fresh)).toBe(true);
    expect(has(owned)).toBe(false);
  });
});

describe('choosing at an event', () => {
  it('records an eventChoice story event', () => {
    const r = chooseEvent(content, atEvent(newRun('choose'), 'pokemon-center'), 'test-event', 0).run;
    const ev = r.story.events.filter((e) => e.type === 'eventChoice');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.data.event).toBe('pokemon-center');
  });

  it('applies the outcome once, and the same seed gives the same result', () => {
    const a = chooseEvent(content, atEvent(newRun('choose'), 'pokemon-center'), 'test-event', 0);
    const b = chooseEvent(content, atEvent(newRun('choose'), 'pokemon-center'), 'test-event', 0);
    expect(JSON.stringify(a.run)).toBe(JSON.stringify(b.run));
    expect(a.run.phase).toBe('map');
    expect(() => chooseEvent(content, a.run, 'test-event', 0)).toThrow('over');
    expect(a.run.itemCounters?.['event-seen:pokemon-center']).toBe(1);
  });

  it('a reloaded run makes the same roll', () => {
    const run = atEvent(newRun('reload'), 'mysterious-chest');
    const reloaded = JSON.parse(JSON.stringify(run)) as RunState;
    expect(JSON.stringify(chooseEvent(content, run, 'test-event', 0))).toBe(JSON.stringify(chooseEvent(content, reloaded, 'test-event', 0)));
  });

  it('locks a choice whose requirement is missing', () => {
    const run = atEvent(newRun('locked'), 'rest-meadow');
    delete run.inventory['oran-berry'];
    const view = eventView(content, run, 'test-event');
    expect(view.choices[0]!.locked).toMatch(/Oran Berry/);
    expect(() => chooseEvent(content, run, 'test-event', 0)).toThrow();
  });

  it('a won event battle pays its win effects and skips the reward draft', () => {
    const run = take(atEvent(newRun('fight'), 'rm-2-key-cabin'), 'rm-2-key');
    const started = chooseEvent(content, run, 'test-event', 0);
    expect(started.battle).toBe(true);
    expect(started.run.passives?.['rm-2-key']).toBeUndefined();
    const before = started.run.money;
    const end = win(started.run);
    expect(end.run.money).toBeGreaterThanOrEqual(before + 2000);
    expect(end.run.phase).not.toBe('reward');
  });

  it('a temporary ally fights beside you in a double battle and leaves the party afterwards', () => {
    const run = atEvent(newRun('ally'), 'borrowed-ally');
    const size = run.party.length;
    const started = chooseEvent(content, run, 'test-event', 0);
    const battle = started.run.battle!;
    expect(battle.doubles).toBeDefined();
    expect(battle.loaner).toBeDefined();
    expect(started.run.party).toHaveLength(size + 1);
    expect(started.run.party[started.run.party.length - 1]!.uid).toBe(battle.loaner);
    const end = win(started.run);
    expect(end.run.party).toHaveLength(size);
  });

  it('a held-item gift goes to a Pokémon that can hold it', () => {
    const run = atEvent(newRun('gift'), 'card-key-silph');
    const result = chooseEvent(content, run, 'test-event', 0);
    expect(result.changes[0]).toMatch(/for |sold for/);
  });
});

describe('event items', () => {
  it('Inquiry Mail shows the outcome before you choose and is used up', () => {
    const run = take(atEvent(newRun('inquiry'), 'mysterious-chest'), 'inquiry-mail');
    expect(eventView(content, run, 'test-event').choices[0]!.preview).toBeTruthy();
    const after = chooseEvent(content, run, 'test-event', 0).run;
    expect(eventView(content, atEvent(after, 'pokemon-center', 'second'), 'second').choices[0]!.preview).toBeNull();
  });

  it('Explorer Kit turns up one more item at each event', () => {
    const run = take(atEvent(newRun('explorer'), 'pokemon-center'), 'explorer-kit');
    expect(chooseEvent(content, run, 'test-event', 0).changes.some((c) => c.startsWith('Explorer Kit'))).toBe(true);
  });

  it('Prop Case doubles Charisma at a Contest stop', () => {
    const plain = chooseEvent(content, take(atEvent(newRun('contest'), 'contest-pass-hall'), 'contest-pass'), 'test-event', 1);
    const doubled = chooseEvent(content, take(take(atEvent(newRun('contest'), 'contest-pass-hall'), 'contest-pass'), 'prop-case'), 'test-event', 1);
    expect(doubled.success).toBe(plain.success);
    expect((doubled.run.attributeModifiers.charisma ?? 0) - (plain.run.attributeModifiers.charisma ?? 0)).toBeGreaterThan(0);
  });

  it('Tidal Bell makes Lugia answer at Navel Rock', () => {
    for (let i = 0; i < 5; i++) {
      const run = take(take(atEvent(newRun(`bell-${i}`), 'mysticticket-rock'), 'mysticticket'), 'tidal-bell');
      const result = chooseEvent(content, run, 'test-event', 0);
      expect(result.run.battle?.enemyTeam[0]?.speciesId).toBe('lugia');
    }
  });

  it('S.S. Ticket ferries you next to the gym and opens a shop', () => {
    const run = take(atEvent(newRun('ferry'), 'ss-ticket-ferry'), 'ss-ticket');
    const after = chooseEvent(content, run, 'test-event', 0).run;
    const stage = after.stage!;
    const gym = stage.map.nodes.find((n) => n.kind === 'gym')!;
    const here = stage.map.nodes.find((n) => n.id === stage.current)!;
    expect(here.next).toContain(gym.id);
    expect(here.sides.some((s) => s.kind === 'shop')).toBe(true);
  });
});

describe('events in saves', () => {
  it('a version 14 run loads with its event stops', () => {
    const storage = new MemoryStorageProvider();
    const run = newRun('save14');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 14, savedAt: '', data: run }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(14);
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(15);
    expect(eventStops(loaded.data).length).toBe(eventStops(run).length);
  });
});

describe('choice cards: cost and kind of risk (Visual Bible event screens)', () => {
  const choice = (c: object) => EventChoiceSchema.parse({ label: 'x', success: { text: 's' }, ...c });

  it('a sure choice says it is certain and names what it costs, not what it gives', () => {
    const r = choiceRisk(content, choice({ success: { text: 's', effects: [{ kind: 'money', amount: -400 }, { kind: 'item', id: 'great-ball', count: 3 }] } }));
    expect(r).toEqual({ cost: '−₽400', risk: 'Certain outcome' });
    expect(choiceRisk(content, choice({ success: { text: 's', battle: { kind: 'wild', species: ['rattata'] } } })).risk).toBe('Certain · leads to a battle');
  });

  it('an uncertain choice says what it depends on and what failing means', () => {
    expect(choiceRisk(content, choice({ check: 'luck', failure: { text: 'f' } })).risk).toBe('Depends on your Luck · nothing lost if it fails');
    expect(choiceRisk(content, choice({ chance: 0.5, failure: { text: 'f', effects: [{ kind: 'damage', share: 0.2 }] } })).risk).toBe('Luck of the draw · a setback if it fails');
    const fight = content.events.get('fight-or-flight-2')!.choices.find((c) => c.check && c.failure?.battle)!;
    expect(choiceRisk(content, fight).risk).toMatch(/^Depends on your \w+ · a fight if it fails$/);
  });

  it('a cost paid either way counts; a cost only on success does not (it would spoil the outcome)', () => {
    const both = { kind: 'money', amount: -100 };
    expect(choiceRisk(content, choice({ chance: 0.5, success: { text: 's', effects: [both] }, failure: { text: 'f', effects: [both] } })).cost).toBe('−₽100');
    expect(choiceRisk(content, choice({ chance: 0.5, success: { text: 's', effects: [both] }, failure: { text: 'f' } })).cost).toBeNull();
  });

  it('every event view carries a risk line for each choice', () => {
    const run = atEvent(newRun('risk'), 'department-store-sale');
    const view = eventView(content, run, 'test-event');
    expect(view.choices.every((c) => c.risk.length > 0)).toBe(true);
    expect(view.choices[0]!.cost).toBe('−₽400');
  });
});

describe('trade events', () => {
  const choiceOf = (run: RunState, id: string) => eventView(content, run, 'test-event').choices[0]!;

  it('stay locked, with the requirement in words, until a fitting Pokémon is in the party', () => {
    const run = atEvent(newRun('trade-lock'), 'water-fan-swap');
    run.party = [createPokemon(content, 'charmander', 5, 'a'), createPokemon(content, 'bulbasaur', 5, 'b')];
    expect(choiceOf(run, 'water-fan-swap').locked).toBe('Needs a Water-type in your party');
    expect(() => chooseEvent(content, run, 'test-event', 0)).toThrow(/Water-type/);
    expect(choiceOf(run, 'water-fan-swap').cost).toBe('trade away a Water-type');
  });

  it('take the lowest-level fitting Pokémon and give one back', () => {
    const run = atEvent(newRun('trade-go'), 'water-fan-swap');
    run.party = [createPokemon(content, 'squirtle', 12, 'a'), createPokemon(content, 'charmander', 5, 'b'), createPokemon(content, 'psyduck', 7, 'c')];
    expect(choiceOf(run, 'water-fan-swap').locked).toBeNull();
    const result = chooseEvent(content, run, 'test-event', 0);
    expect(result.run.party.map((m) => m.speciesId)).toEqual(['squirtle', 'charmander']);
    expect(result.run.pending.some((p) => p.kind === 'caught')).toBe(true);
    expect(result.changes[0]).toBe('Traded away Psyduck');
  });

  it('never trade away the last Pokémon', () => {
    const run = atEvent(newRun('trade-last'), 'water-fan-swap');
    run.party = [createPokemon(content, 'squirtle', 5, 'a')];
    expect(choiceOf(run, 'water-fan-swap').locked).toBe('Needs 2 Pokémon in your party');
  });
});

describe('trade picks and species traits', () => {
  it('lets the player pick which fitting Pokémon goes', () => {
    const run = atEvent(newRun('trade-pick'), 'water-fan-swap');
    run.party = [createPokemon(content, 'squirtle', 12, 'a'), createPokemon(content, 'psyduck', 7, 'c')];
    const view = eventView(content, run, 'test-event').choices[0]!;
    expect(view.tradePicks!.map((p) => p.uid)).toEqual(['c', 'a']);
    const result = chooseEvent(content, run, 'test-event', 0, 'a');
    expect(result.run.party.map((m) => m.speciesId)).toEqual(['psyduck']);
    expect(() => chooseEvent(content, run, 'test-event', 0, 'nope')).toThrow(/does not fit/);
  });

  it('asks for egg groups and colours', () => {
    expect(content.species.get('pikachu')!.eggGroups).toContain('fairy');
    expect(content.species.get('pikachu')!.color).toBe('yellow');
    const run = atEvent(newRun('trade-color'), 'red-collector');
    run.party = [createPokemon(content, 'bulbasaur', 5, 'a'), createPokemon(content, 'squirtle', 5, 'b')];
    expect(eventView(content, run, 'test-event').choices[0]!.locked).toBe('Needs a red Pokémon in your party');
    run.party.push(createPokemon(content, 'charmander', 5, 'c'));
    expect(eventView(content, run, 'test-event').choices[0]!.locked).toBeNull();
  });
});
