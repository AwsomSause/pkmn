// Major Update §4/§7: the unified Bag lists every owned item once, held items with their holders.

import { describe, expect, it } from 'vitest';
import { bagEntries, bagEntryText, entriesInPocket, giveHeld, giveHeldProblem, takeOffHeld } from '../../src/core/bag';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

const fresh = () => chooseStarter(content, createRun(content, { runId: 'r', seed: 'bag', archetypeId: 'red' }), 0);

describe('unified Bag', () => {
  it('lists Bag items, held items with holders, and team items, each once', () => {
    const run = fresh();
    run.inventory = { 'poke-ball': 5, potion: 2 };
    run.party[0]!.held = { charcoal: 2, leftovers: 1 };
    run.passives = { 'amulet-coin': 1 };
    const entries = bagEntries(content, run);
    expect(entries.map((e) => e.key)).toEqual(['bag:poke-ball', 'bag:potion', 'held:charcoal', 'held:leftovers', 'team:amulet-coin']);
    const charcoal = entries.find((e) => e.itemId === 'charcoal')!;
    expect(charcoal).toMatchObject({ quantity: 2, equipped: true, pocket: 'held', rarity: 'uncommon' });
    expect(charcoal.holders).toEqual([{ index: 0, name: content.species.get(run.party[0]!.speciesId)!.name, copies: 2 }]);
    expect(bagEntryText(charcoal)).toMatch(/Held by .+ ×2\. Up to 3 per Pokémon/);
    // Held items are not Bag items: the inventory is unchanged and nothing is counted twice.
    expect(run.inventory).toEqual({ 'poke-ball': 5, potion: 2 });
    expect(entries.find((e) => e.itemId === 'potion')!.rarity).toBe(content.rewards.get('potion')!.rarity);
    expect(entriesInPocket(entries, 'balls').map((e) => e.itemId)).toEqual(['poke-ball']);
    expect(entriesInPocket(entries, 'all')).toHaveLength(entries.length);
  });

  it('adds up one item held by two Pokémon into one row (boundary: zero copies and unknown ids are skipped)', () => {
    const run = fresh();
    run.inventory = { potion: 0, 'not-an-item': 3 };
    run.party.push(structuredClone(run.party[0]!));
    run.party[0]!.held = { charcoal: 1 };
    run.party[1]!.held = { charcoal: 2, 'not-an-item': 1 };
    const entries = bagEntries(content, run);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.quantity).toBe(3);
    expect(entries[0]!.holders.map((h) => [h.index, h.copies])).toEqual([[0, 1], [1, 2]]);
  });

  it('an empty run has an empty Bag', () => {
    const run = fresh();
    run.inventory = {};
    run.party.forEach((p) => (p.held = {}));
    run.passives = {};
    run.mapEffects = [];
    expect(bagEntries(content, run)).toEqual([]);
  });
});

describe('taking held items off and giving them back', () => {
  it('moves every copy into the Bag, lists it as loose, and gives one copy at a time', () => {
    const run = fresh();
    run.phase = 'map';
    run.party.push(structuredClone(run.party[0]!));
    run.party[0]!.held = { charcoal: 2 };
    run.party[1]!.held = {};
    const off = takeOffHeld(content, run, 0, 'charcoal');
    expect(run.party[0]!.held).toEqual({ charcoal: 2 }); // the input run is untouched
    expect(off.run.party[0]!.held).toEqual({});
    expect(off.run.looseHeld).toEqual({ charcoal: 2 });
    expect(off.message).toMatch(/took the Charcoal ×2/);
    expect(bagEntries(content, off.run).find((e) => e.itemId === 'charcoal')).toMatchObject({ source: 'loose', quantity: 2, equipped: false, pocket: 'held' });
    const given = giveHeld(content, off.run, 'charcoal', 1);
    expect(given.run.party[1]!.held).toEqual({ charcoal: 1 });
    expect(given.run.looseHeld).toEqual({ charcoal: 1 });
    const again = giveHeld(content, given.run, 'charcoal', 1);
    expect(again.run.looseHeld).toEqual({});
    expect(giveHeldProblem(content, again.run, 'charcoal', 1)).toMatch(/none of those/);
  });

  it('refuses in battle, without the item, and past the stack limit', () => {
    const run = fresh();
    run.phase = 'map';
    expect(() => takeOffHeld(content, run, 0, 'charcoal')).toThrow(/not holding/);
    run.party[0]!.held = { charcoal: 3 };
    run.looseHeld = { charcoal: 1 };
    expect(giveHeldProblem(content, run, 'charcoal', 0)).toMatch(/holds the most/);
    run.phase = 'battle';
    expect(() => takeOffHeld(content, run, 0, 'charcoal')).toThrow(/outside battle/);
  });
});
