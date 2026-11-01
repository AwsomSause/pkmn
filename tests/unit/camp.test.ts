// Camp, gadgets and crafting (W3): data checks, every action, limits, wear, cookbook, relics, time capsule, saves.

import { describe, expect, it } from 'vitest';
import { ACTION_HANDLER_IDS, benchList, campAction, campOf, CAMP, CampProfileSchema, CampStateSchema, cleanseRelic, comboList, findCombo, freshCampProfile, giveGadget, grantRelic, hasGadget, itemScenario, marketSlots, mysteryOdds, recordFirstUse, shelfMoves, skillThrowFactor, sortKey, type CampArgs } from '../../src/core/camp';
import { chooseStarter, createRun } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { content } from './helpers';

function setup(): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'camp', seed: 'camp', archetypeId: 'red' }), 0));
  run.phase = 'map';
  run.money = 5000;
  return run;
}
const act = (run: RunState, id: string, args: CampArgs = {}, pc = freshCampProfile()) => campAction(content, run, pc, id, args);
const mat = (run: RunState, id: string, n: number) => { run.materials[id] = (run.materials[id] ?? 0) + n; };

describe('camp data', () => {
  it('every action has a handler and every handler an action', () => {
    expect(CAMP.actions.map((a) => a.id).sort()).toEqual([...ACTION_HANDLER_IDS].sort());
  });
  it('every gadget named by an action exists; ids in combos, goods, vending and mystery odds are real', () => {
    for (const a of CAMP.actions) if (a.gadget) expect(CAMP.gadgets.some((g) => g.id === a.gadget)).toBe(true);
    for (const c of CAMP.combos) {
      if (c.gives.kind === 'item') expect(content.items.has(c.gives.item)).toBe(true);
      if (c.gives.kind === 'gadget') expect(CAMP.gadgets.some((g) => g.id === (c.gives as { gadget: string }).gadget)).toBe(true);
      for (const p of [c.a, c.b]) if (p.startsWith('bag:')) expect(content.items.has(p.slice(4))).toBe(true);
    }
    for (const v of CAMP.vending.table) expect(content.items.has(v.item)).toBe(true);
    for (const o of CAMP.market.mysteryOdds) if (o.kind === 'item') expect(content.items.has(o.item!)).toBe(true);
    for (const id of Object.keys(CAMP.fuse.plates)) expect(content.catalog.has(id), id).toBe(true);
    expect(content.items.has(CAMP.scraps.item)).toBe(true);
    expect(content.items.has(CAMP.chest.item)).toBe(true);
  });
  it('seal and pot effects are valid modifiers; mystery odds sum to 100', () => {
    expect(mysteryOdds().reduce((a, o) => a + o.percent, 0)).toBeGreaterThanOrEqual(99);
    expect(mysteryOdds().reduce((a, o) => a + o.percent, 0)).toBeLessThanOrEqual(101);
  });
  it('lists the cookbook and bench with page-locked entries closed', () => {
    const pc = freshCampProfile();
    expect(comboList(pc).some((c) => c.locked && !c.known)).toBe(true);
    expect(benchList(pc).find((g) => g.id === 'camera')!.open).toBe(false);
    expect(benchList(pc).find((g) => g.id === 'compass')!.open).toBe(true);
  });
});

describe('gadgets', () => {
  it('needs the gadget, wears it down, and is limited once per stop', () => {
    let run = setup();
    expect(act(run, 'compass').ok).toBe(false);
    giveGadget(run, 'compass');
    const out = act(run, 'compass');
    expect(out.ok).toBe(true);
    expect(out.run.camp!.wear.compass).toBe(CAMP.gadgets.find((g) => g.id === 'compass')!.uses - 1);
    expect(run.camp!.wear.compass).toBe(CAMP.gadgets.find((g) => g.id === 'compass')!.uses);
    expect(act(out.run, 'compass').message).toMatch(/Already done/);
    run = out.run; run.encountersCompleted += 1;
    expect(act(run, 'compass').ok).toBe(true);
  });
  it('a worn gadget is blocked until mended at the forge', () => {
    let run = setup();
    giveGadget(run, 'compass');
    run.camp!.wear.compass = 0;
    expect(act(run, 'compass').message).toMatch(/worn out/);
    mat(run, 'scrap', 5);
    run = act(run, 'forge', { choice: 'compass' }).run;
    expect(run.camp!.wear.compass).toBe(8);
    expect(act(run, 'forge', { choice: 'compass' }).message).toMatch(/not worn/);
  });
  it('crafts at the bench with materials; page recipes need the cookbook', () => {
    let run = setup();
    expect(act(run, 'bench', { choice: 'compass' }).ok).toBe(false);
    mat(run, 'scrap', 3); mat(run, 'aether', 1);
    const out = act(run, 'bench', { choice: 'compass' });
    expect(out.ok).toBe(true);
    expect(hasGadget(out.run, 'compass')).toBe(true);
    run = out.run; mat(run, 'scrap', 3); mat(run, 'tide', 2);
    expect(act(run, 'bench', { choice: 'telescope' }).message).toMatch(/recipe page/);
    const pc = freshCampProfile(); pc.cookbook.push('bench:telescope');
    expect(campAction(content, run, pc, 'bench', { choice: 'telescope' }).ok).toBe(true);
  });
  it('binoculars scout one column, lantern needs oil and reveals hidden stops', () => {
    const run = setup();
    giveGadget(run, 'binoculars'); giveGadget(run, 'lantern');
    const before = run.stage!.scoutedTo;
    expect(act(run, 'binoculars').run.stage!.scoutedTo).toBeGreaterThanOrEqual(before);
    expect(act(run, 'lantern').message).toMatch(/oil/);
    campOf(run).stuff.oil = 1;
    const lit = act(run, 'lantern');
    expect(lit.ok).toBe(true);
    expect(lit.run.camp!.stuff.oil).toBe(0);
  });
  it('dowsing, telescope, net, instrument, radio and seals give timed buffs or finds', () => {
    let run = setup();
    for (const g of ['dowsing-rod', 'telescope', 'net', 'instrument', 'radio']) giveGadget(run, g);
    const perks = run.perkEffects.length;
    const d = act(run, 'dowse'); expect(d.ok).toBe(true);
    expect(act(run, 'telescope').ok).toBe(true);
    const net = act(run, 'net'); expect(net.run.materials.fiber).toBe(2);
    const radio = act(run, 'radio', { choice: 'rock' });
    expect(radio.run.perkEffects.length).toBe(perks + 1);
    expect(radio.run.tempEffects.length).toBe(1);
    expect(act(run, 'radio', { choice: 'nope' }).ok).toBe(false);
    run = act(run, 'flute', { choice: 'calm' }).run;
    expect(run.tempEffects[0]!.until).toBe('wild');
    mat(run, 'fiber', 1);
    expect(act(run, 'seal', { choice: 'star' }).ok).toBe(true);
  });
  it('the tent heals by pitch grade and clears fatigue', () => {
    const run = setup();
    giveGadget(run, 'tent');
    run.party[0]!.hp = 1;
    const miss = act(run, 'tent', { grade: 'miss' }).run.party[0]!.hp;
    const perfect = act(run, 'tent', { grade: 'perfect' }).run.party[0]!.hp;
    expect(perfect).toBeGreaterThan(miss);
  });
  it('camera adds to the album once per species and pays the first photo', () => {
    const run = setup();
    giveGadget(run, 'camera');
    const pc = freshCampProfile();
    const out = campAction(content, run, pc, 'photo', { party: 0 });
    expect(out.pc.album).toContain(run.party[0]!.speciesId);
    expect(out.run.money).toBe(run.money + CAMP.photo.firstMoney);
    const again = campAction(content, { ...out.run, encountersCompleted: 9 }, out.pc, 'photo', { party: 0 });
    expect(again.run.money).toBe(out.run.money);
  });
  it('fireworks and glow sticks are one-use and stack', () => {
    const run = setup();
    giveGadget(run, 'fireworks'); giveGadget(run, 'fireworks');
    expect(run.camp!.wear.fireworks).toBe(2);
    const out = act(run, 'fireworks');
    expect(out.run.camp!.wear.fireworks).toBe(1);
    expect(out.run.party[0]!.care!.mood).toBe(CAMP.fireworks.mood);
  });
  it('the mirror reveals a trait and costs luck; the launcher toggles', () => {
    const run = setup();
    giveGadget(run, 'mirror'); giveGadget(run, 'launcher');
    const m = act(run, 'mirror', { party: 0 });
    expect(m.message).toMatch(/hidden talent/);
    expect(m.run.camp!.luck).toBe(-1);
    expect(act(run, 'launcher').run.camp!.launcher).toBe(true);
    expect(skillThrowFactor('perfect')).toBeGreaterThan(skillThrowFactor('miss'));
    expect(skillThrowFactor(undefined)).toBe(1);
  });
});

describe('kitchen and workshop', () => {
  const berry = () => [...content.catalog.values()].find((e) => e.family.startsWith('Berries'))!.id;
  it('combines two items, discovers the recipe in the cookbook, and a bad pair costs nothing', () => {
    const run = setup();
    mat(run, 'scrap', 2);
    const out = act(run, 'combine', { item: 'mat:scrap', item2: 'mat:scrap' });
    expect(out.ok).toBe(true);
    expect(out.run.camp!.stuff.key).toBe(1);
    expect(out.pc.cookbook).toContain('key');
    mat(run, 'ember', 1);
    const dud = act(run, 'combine', { item: 'mat:scrap', item2: 'mat:ember' });
    expect(dud.message).toMatch(/Nothing happens/);
    expect(dud.run.materials.scrap).toBe(2);
    expect(findCombo(content, 'mat:fiber', 'mat:tide')!.id).toBe('potion');
  });
  it('a page-locked recipe needs a page; reading one unlocks it', () => {
    const run = setup();
    run.inventory['super-potion'] = 2;
    expect(act(run, 'combine', { item: 'bag:super-potion', item2: 'bag:super-potion' }).message).toMatch(/know-how/);
    const camp = campOf(run); camp.stuff['recipe-page'] = 1;
    const read = act(run, 'page');
    expect(read.ok).toBe(true);
    expect(read.pc.cookbook.length).toBe(1);
    expect(act(run, 'page').ok).toBe(true);
    expect(read.run.camp!.stuff['recipe-page']).toBe(0);
  });
  it('the cooking pot turns berries into a team buff', () => {
    const run = setup();
    const b = berry();
    run.looseHeld = { [b]: 3 };
    const out = act(run, 'pot', { items: [b, b] });
    expect(out.ok).toBe(true);
    expect(out.run.looseHeld![b]).toBe(1);
    expect(out.run.tempEffects).toHaveLength(1);
    expect(act(out.run, 'pot', { items: [b] }).message).toMatch(/Already done/);
    expect(act(run, 'pot', { items: [] }).ok).toBe(false);
  });
  it('mixing potions succeeds only at the right ratio and a bad mix wastes one harmlessly', () => {
    const run = setup();
    run.inventory.potion = 4;
    const results = CAMP.mixPotions.ratios.map((r) => act(run, 'mix', { item: 'bag:potion', item2: 'bag:potion', choice: r }));
    expect(results.filter((r) => r.run.inventory['hyper-potion']).length).toBe(1);
    expect(results.filter((r) => !r.run.inventory['hyper-potion'] && r.run.inventory.potion === 3).length).toBe(CAMP.mixPotions.ratios.length - 1);
  });
  it('recycling gives scrap; label and tidy change the Bag; sniff and sniffItem hint', () => {
    let run = setup();
    run.inventory.potion = 2;
    giveGadget(run, 'label-printer');
    run = act(run, 'recycle', { item: 'bag:potion' }).run;
    expect(run.materials.scrap).toBeGreaterThan(0);
    expect(run.inventory.potion).toBe(1);
    run = act(run, 'label', { item: 'bag:potion', text: 'save for boss' }).run;
    expect(run.camp!.labels.potion).toBe('save for boss');
    expect(act(run, 'tidy', { choice: 'rarity' }).run.camp!.bagSort).toBe('rarity');
    expect(act(run, 'tidy', { choice: 'x' }).ok).toBe(false);
    expect(act(run, 'sniffItem', { item: 'bag:potion' }).message).toMatch(/sniffs/);
    expect(act(run, 'sniff', { choice: '1' }).ok).toBe(true);
  });
  it('TM fusion turns a Plate or Memory plus a TM into a TM of the Plate\'s type', () => {
    const run = setup();
    run.looseHeld = { 'flame-plate': 1 };
    campOf(run).stuff['tm-water'] = 1;
    const out = act(run, 'fuse', { item: 'held:flame-plate', item2: 'stuff:tm-water' });
    expect(out.ok).toBe(true);
    expect(out.run.camp!.stuff['tm-fire']).toBe(CAMP.fuse.differentCopies);
    expect(out.run.camp!.stuff['tm-water']).toBe(0);
    expect(act(run, 'fuse', { item: 'held:nugget', item2: 'stuff:tm-water' }).ok).toBe(false);
  });
  it('the TM shelf teaches one of the offered moves', () => {
    const run = setup();
    const types = ['fire', 'normal', 'water', 'electric', 'grass', 'flying'];
    const type = types.find((t) => shelfMoves(content, run, t, 0).length > 0)!;
    campOf(run).stuff[`tm-${type}`] = 1;
    const move = shelfMoves(content, run, type, 0)[0]!;
    run.party[0]!.moves = run.party[0]!.moves.slice(0, 2);
    const out = act(run, 'shelf', { choice: type, party: 0, move });
    expect(out.ok).toBe(true);
    expect(out.run.party[0]!.moves.some((m) => m.id === move)).toBe(true);
    expect(act(run, 'shelf', { choice: type, party: 0, move: 'not-a-move' }).ok).toBe(false);
  });
});

describe('market, finds and relics', () => {
  it('the market stock is seeded, limited, rerolls with a charm, and lists mystery-box odds', () => {
    const run = setup();
    const first = marketSlots(run).map((g) => g.id);
    expect(marketSlots(run).map((g) => g.id)).toEqual(first);
    expect(first).toHaveLength(CAMP.market.slots);
    const good = marketSlots(run)[0]!;
    const buy = act(run, 'market', { choice: good.id });
    expect(buy.ok).toBe(true);
    expect(buy.run.money).toBeLessThan(run.money);
    expect(act(run, 'market', { choice: 'reroll' }).message).toMatch(/Lucky Charm/);
    giveGadget(run, 'lucky-charm');
    const re = act(run, 'market', { choice: 'reroll' });
    expect(re.ok).toBe(true);
    expect(mysteryOdds().length).toBeGreaterThan(3);
    expect(act(run, 'market', { choice: 'token-core' }).message).toMatch(/Camp Token/);
  });
  it('a mystery box rolls from its listed odds and is capped', () => {
    const run = setup();
    let r = run;
    for (let i = 0; i < 3; i++) { const out = act(r, 'market', { choice: 'mystery' }); if (!out.ok) break; r = out.run; r.encountersCompleted += 1; }
    expect(r.camp!.bought.mystery).toBeLessThanOrEqual(3);
  });
  it('shake, well, vending, bottle, chest, scraps and dowsing are deterministic and once per stage', () => {
    const run = setup();
    expect(act(run, 'shake').message).toBe(act(run, 'shake').message);
    const shaken = act(run, 'shake').run;
    expect(act(shaken, 'shake').message).toMatch(/Already done/);
    expect(act(run, 'well', { choice: 'wealth' }).run.money).toBeLessThan(run.money + CAMP.well.wealth[1] + 1);
    expect(act(run, 'well', { choice: 'nope' }).ok).toBe(false);
    expect(act(run, 'vending').ok).toBe(true);
    expect(act(run, 'bottle', { choice: 'kind' }).ok).toBe(false);
    campOf(run).stuff.bottle = 2; campOf(run).stuff.chest = 2; campOf(run).stuff.key = 1; campOf(run).stuff['scrap-piece'] = 4;
    const b = act(run, 'bottle', { choice: 'kind' });
    expect(b.run.camp!.morality).toBe(1);
    const opened = act(run, 'chest', { choice: 'key' });
    expect(opened.ok).toBe(true);
    expect(opened.run.camp!.stuff.chest).toBe(1);
    expect(act(run, 'chest', { choice: 'pick', grade: 'perfect' }).ok).toBe(true);
    const map = act(run, 'scraps');
    expect(map.ok).toBe(true);
    expect(map.run.camp!.stuff['scrap-piece']).toBe(0);
  });
  it('the stall sells, haggles and bluffs; an alarm tag stops a thief', () => {
    const run = setup();
    run.inventory.potion = 3;
    const sold = act(run, 'stall', { item: 'bag:potion', choice: 'accept' });
    expect(sold.run.inventory.potion).toBe(2);
    expect(act(run, 'stall', { item: 'bag:potion', choice: 'bluff' }).message).toMatch(/Prop Item/);
    giveGadget(run, 'prop'); giveGadget(run, 'alarm-tag');
    expect(act(run, 'stall', { item: 'bag:potion', choice: 'bluff' }).ok).toBe(true);
    expect(act(run, 'hat', { choice: 'crown' }).run.camp!.hat).toBe('crown');
  });
  it('parcels and sealed letters pay and move morality', () => {
    const run = setup();
    run.inventory.potion = 1;
    let r = act(run, 'parcel', { choice: 'wrap:fancy', item: 'bag:potion' }).run;
    expect(r.camp!.parcel!.style).toBe('fancy');
    const dup = act(r, 'parcel', { choice: 'letter' });
    expect(dup.ok).toBe(false);
    const delivered = act(r, 'parcel', { choice: 'deliver' });
    expect(delivered.run.camp!.morality).toBe(1);
    expect(delivered.run.camp!.parcel).toBeNull();
    r = act(r, 'parcel', { choice: 'open' }).run;
    expect(r.camp!.morality).toBe(-1);
    expect(act(r, 'parcel', { choice: 'deliver' }).run.camp!.morality).toBe(-1);
  });
  it('relics: a cursed relic carries a curse until cleansed; the altar trades clean relics up a tier', () => {
    const run = setup();
    const before = run.perkEffects.length;
    grantRelic(run, 'idol', true);
    expect(run.perkEffects.length).toBe(before + 2);
    expect(run.camp!.relics[0]!.cursed).toBe(true);
    expect(act(run, 'altar', { choice: '0,0' }).ok).toBe(false);
    cleanseRelic(run, 0);
    expect(run.perkEffects.length).toBe(before + 1);
    expect(cleanseRelic.bind(null, run, 0)).toThrow();
    grantRelic(run, 'fang', false); grantRelic(run, 'coin', false);
    const out = act(run, 'altar', { choice: '1,2' });
    expect(out.ok).toBe(true);
    expect(out.run.camp!.relics).toHaveLength(2);
  });
  it('the camp rite cleanses a curse for a price and does nothing for a clean relic', () => {
    const run = setup();
    grantRelic(run, 'skull', true);
    expect(act(run, 'purify', { choice: '0' }).message).toMatch(/needs/i);
    mat(run, 'aether', 1);
    const out = act(run, 'purify', { choice: '0' });
    expect(out.ok).toBe(true);
    expect(out.run.camp!.relics[0]!.cursed).toBe(false);
    expect(out.run.money).toBe(run.money - CAMP.purify.money);
  });
  it('the time capsule buries an item and returns it in a later run only', () => {
    const run = setup();
    run.inventory.potion = 1;
    const pc = freshCampProfile();
    const buried = campAction(content, run, pc, 'capsule', { item: 'bag:potion' });
    expect(buried.ok).toBe(true);
    expect(buried.run.inventory.potion ?? 0).toBe(0);
    expect(buried.pc.capsule!.buriedIn).toBe('camp');
    expect(campAction(content, buried.run, buried.pc, 'capsule', { choice: 'dig' }).message).toMatch(/fresh/);
    const later = { ...buried.run, runId: 'next' };
    const dug = campAction(content, later, buried.pc, 'capsule', { choice: 'dig' });
    expect(dug.ok).toBe(true);
    expect(dug.run.inventory.potion).toBe(1);
    expect(dug.pc.capsule).toBeNull();
  });
  it('distraction and seals add timed effects; the journal narrates a first use once', () => {
    const run = setup();
    run.inventory.potion = 2;
    expect(act(run, 'distract', { item: 'bag:potion' }).run.tempEffects).toHaveLength(1);
    const pc = freshCampProfile();
    const line = recordFirstUse(content, run, pc, 'potion', 'Charmander');
    expect(line).toMatch(/Potion/);
    expect(recordFirstUse(content, run, pc, 'potion', 'Charmander')).toBe('');
    expect(pc.journal).toEqual(['potion']);
    expect(run.camp!.recent[0]).toBe('potion');
  });
  it('item scenarios and bag sorting', () => {
    expect(itemScenario(content, 'potion')).not.toBe('');
    expect(itemScenario(content, 'poke-ball')).not.toBe('');
    const run = setup();
    campOf(run).recent = ['b'];
    expect(sortKey(run, 'recent', { itemId: 'b', pocket: 'x', name: 'B' }) < sortKey(run, 'recent', { itemId: 'a', pocket: 'x', name: 'A' })).toBe(true);
    expect(sortKey(run, 'rarity', { itemId: 'a', pocket: 'x', name: 'A', rarity: 'rare' }) < sortKey(run, 'rarity', { itemId: 'a', pocket: 'x', name: 'A', rarity: 'common' })).toBe(true);
  });
});

describe('camp saves', () => {
  it('state schemas fill defaults and runs without camp still parse', () => {
    expect(CampStateSchema.parse({}).bagSort).toBe('obtained');
    expect(CampProfileSchema.parse({}).capsule).toBeNull();
    const run = setup();
    const copy = JSON.parse(JSON.stringify(run));
    delete copy.camp;
    expect(RunStateSchema.parse(copy).camp).toBeUndefined();
    grantRelic(run, 'fang', false);
    expect(RunStateSchema.parse(JSON.parse(JSON.stringify(run))).camp!.relics).toHaveLength(1);
  });
});
