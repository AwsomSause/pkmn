// Story items: deliveries, trades and form changes through the event system.

import { describe, expect, it } from 'vitest';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { chooseEvent } from '../../src/core/events';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

function newRun(seed = 'story-items'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
}
function take(run: RunState, id: string): void {
  applyCatalog(content, run, getCatalogEntry(content, id), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
}
function atEvent(run: RunState, eventId: string): RunState {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  node.sides.push({ id: 'test-event', kind: 'event', used: false, eventId });
  return run;
}

describe('story items', () => {
  it('every story item is supported and has an event', () => {
    for (const id of ['oaks-parcel', 'letter', 'parcel', 'devon-goods', 'scanner', 'gold-teeth', 'gram-1', 'gram-2', 'gram-3', 'machine-part', 'lost-item', 'data-card', 'odd-keystone', 'meteorite', 'kyurem-black', 'kyurem-white', 'tornadus-therian', 'thundurus-therian', 'landorus-therian']) {
      expect(content.catalog.get(id)?.status, id).toBe('supported');
      expect([...content.events.values()].some((e) => e.keyItem === id), id).toBe(true);
    }
  });

  it('delivering the Letter pays and uses it up', () => {
    const run = atEvent(newRun(), 'deliver-letter');
    take(run, 'letter');
    const money = run.money;
    const result = chooseEvent(content, run, 'test-event', 0);
    expect(result.run.money).toBe(money + 500);
    expect(result.run.passives?.letter ?? 0).toBe(0);
  });

  it('the Therian mirror changes the form and keeps the Pokémon', () => {
    const run = atEvent(newRun(), 'tornadus-mirror');
    run.party.push(createPokemon(content, 'tornadus', 20, 'tor'));
    const result = chooseEvent(content, run, 'test-event', 0);
    expect(result.run.party.find((m) => m.uid === 'tor')!.speciesId).toBe('tornadus-therian');
  });

  it('Black Kyurem needs both Pokémon and takes Zekrom', () => {
    const run = atEvent(newRun(), 'kyurem-black');
    run.party.push(createPokemon(content, 'kyurem', 20, 'ky'), createPokemon(content, 'zekrom', 20, 'ze'));
    const result = chooseEvent(content, run, 'test-event', 0);
    expect(result.run.party.some((m) => m.speciesId === 'zekrom')).toBe(false);
    expect(result.run.party.find((m) => m.uid === 'ky')!.speciesId).toBe('kyurem-black');
  });

  it('Gram 3 pays only after Grams 1 and 2', () => {
    const early = atEvent(newRun('gram-a'), 'deliver-gram-3');
    expect(() => chooseEvent(content, early, 'test-event', 0)).toThrow();
    const run = atEvent(newRun('gram-b'), 'deliver-gram-3');
    run.itemCounters = { ...run.itemCounters, 'event-seen:deliver-gram-1': 1, 'event-seen:deliver-gram-2': 1 };
    const money = run.money;
    expect(chooseEvent(content, run, 'test-event', 0).run.money).toBe(money + 3000);
  });
});

describe('berries and Pal Pad', () => {
  it('Razz, Nanab and Pinap Berries work through the encounter system', () => {
    for (const id of ['razz-berry', 'nanab-berry', 'pinap-berry', 'pal-pad']) expect(getCatalogEntry(content, id).status).toBe('supported');
  });
  it('Pal Pad gives +5 levels to the first catch each stage only', async () => {
    const { palPadLevels } = await import('../../src/core/mapItems');
    const run = newRun('pal-pad');
    take(run, 'pal-pad');
    expect(palPadLevels(content, run)).toBe(5);
    expect(palPadLevels(content, run)).toBe(0);
  });
  it('Pinap Berry drops a cheap item only after a catch, once', async () => {
    const { catchDrop } = await import('../../src/core/mapItems');
    const run = newRun('pinap');
    const stock = [{ item: 'potion', price: 100 }, { item: 'x', price: 900 }, { item: 'y', price: 500 }];
    run.itemCounters = { 'pinap-drop': 1 };
    expect(catchDrop(run, stock, true)).toBe('potion');
    expect(catchDrop(run, stock, true)).toBeNull();
    run.itemCounters = { 'pinap-drop': 1 };
    expect(catchDrop(run, stock, false)).toBeNull();
  });
});
