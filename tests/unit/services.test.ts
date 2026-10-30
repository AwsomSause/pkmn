// Service stops (Untitled doc §19): Center, Tutor, Reminder, Lab, Trade Post, Scout Tower.

import { describe, expect, it } from 'vitest';
import { placeServiceStop } from '../../src/core/services/gate';
import { serviceView, tradeOffer, useService } from '../../src/core/services/flow';
import { SERVICES, ServicesSchema } from '../../src/core/services/schema';
import { chooseStarter, createRun } from '../../src/core/run';
import { maxHp } from '../../src/core/pokemon';
import { getSpecies } from '../../src/core/pokemon';
import { specialFamily } from '../../src/core/specialForms';
import type { RunState } from '../../src/core/state';
import servicesJson from '../../src/data/services.json';
import { content } from './helpers';

function stopRun(serviceId: string, seed = 'svc'): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'sv', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = [{ id: 'svc-test', kind: 'service', serviceId: serviceId, used: false }];
  run.stage!.current = node.id;
  run.money = 5000;
  run.badges = ['a', 'b'] as never;
  return run;
}

describe('service data and placement', () => {
  it('validates, and only supported services are placed', () => {
    expect(ServicesSchema.safeParse(servicesJson).success).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'p', seed: `place-${i}`, archetypeId: 'red' }), 0));
      run.badges = ['a', 'b', 'c'] as never;
      for (const n of run.stage!.map.nodes) n.sides = [];
      placeServiceStop(run);
      const stops = run.stage!.map.nodes.flatMap((n) => n.sides).filter((s) => s.kind === 'service');
      expect(stops.length).toBeLessThanOrEqual(1);
      for (const s of stops) {
        expect(SERVICES.services.find((x) => x.id === s.serviceId)!.status).not.toBe('planned');
        seen.add(s.serviceId!);
      }
      const again = structuredClone(run);
      for (const n of again.stage!.map.nodes) n.sides = [];
      placeServiceStop(again);
      expect(again.stage!.map.nodes.flatMap((n) => n.sides)).toEqual(stops);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe('Pokémon Center', () => {
  it('heals for a price, refuses when nothing is wrong, and refuses without money', () => {
    const run = stopRun('center');
    expect(serviceView(content, run, 'svc-test').options.find((o) => o.id === 'heal')!.problem).toMatch(/top shape/);
    run.party[0]!.hp = 1;
    run.party[0]!.status = { id: 'poison' } as never;
    const heal = serviceView(content, run, 'svc-test').options.find((o) => o.id === 'heal')!;
    expect(heal.cost).toBeGreaterThan(0);
    const out = useService(content, run, 'svc-test', 'heal');
    expect(out.run.party[0]!.hp).toBe(maxHp(content, out.run.party[0]!));
    expect(out.run.party[0]!.status).toBeNull();
    expect(out.run.money).toBe(5000 - heal.cost);
    expect(run.party[0]!.hp).toBe(1);
    run.money = 0;
    expect(() => useService(content, run, 'svc-test', 'heal')).toThrow(/need/);
  });
  it('revives a fainted Pokémon at half HP and stays usable', () => {
    const run = stopRun('center');
    run.party[0]!.hp = 0;
    const out = useService(content, run, 'svc-test', `revive:${run.party[0]!.uid}`);
    expect(out.run.party[0]!.hp).toBe(Math.floor(maxHp(content, out.run.party[0]!) / 2));
    expect(out.run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'svc-test')!.used).toBe(false);
  });
});

describe('Move Tutor and Move Reminder', () => {
  it('previews the forgotten move and teaches once', () => {
    const run = stopRun('tutor');
    run.party[0]!.moves = run.party[0]!.moves.concat(run.party[0]!.moves).slice(0, 1);
    const view = serviceView(content, run, 'svc-test');
    expect(view.options.length).toBeGreaterThan(0);
    const opt = view.options[0]!;
    expect(opt.text).toMatch(/free slot|forgets/);
    const out = useService(content, run, 'svc-test', opt.id);
    const moveId = opt.id.split(':')[2]!;
    expect(out.run.party.find((m) => m.uid === opt.id.split(':')[1])!.moves.some((m) => m.id === moveId)).toBe(true);
    expect(serviceView(content, out.run, 'svc-test').options.every((o) => o.problem !== null)).toBe(true);
    expect(content.moves.get(moveId)!.supported).toBe(true);
  });
  it('the reminder only offers level-up moves the Pokémon is old enough for', () => {
    const run = stopRun('reminder');
    const mon = run.party[0]!;
    mon.level = 40;
    mon.moves = mon.moves.slice(0, 1);
    const view = serviceView(content, run, 'svc-test');
    const species = getSpecies(content, mon.speciesId);
    for (const o of view.options.filter((x) => x.id.includes(mon.uid))) {
      const moveId = o.id.split(':')[2]!;
      expect(species.learnset.some((e) => e.move === moveId && e.level <= 40)).toBe(true);
    }
  });
});

describe('Research Lab, Scout Tower and Trade Post', () => {
  it('research adds end-of-run points once; scan needs hidden stops', () => {
    const run = stopRun('lab');
    for (const n of run.stage!.map.nodes) n.sides = n.sides.filter((x) => x.kind !== 'event');
    expect(serviceView(content, run, 'svc-test').options.find((o) => o.id === 'scan')!.problem).toMatch(/no hidden/);
    const out = useService(content, run, 'svc-test', 'research');
    expect(out.run.log.counters.labResearch).toBe(SERVICES.costs.researchPoints);
    expect(() => useService(content, out.run, 'svc-test', 'research')).toThrow();
  });
  it('scan reveals a hidden event stop', () => {
    const run = stopRun('lab');
    const other = run.stage!.map.nodes.find((n) => n.column === 2)!;
    other.sides = [{ id: 'ev', kind: 'event', used: false, eventId: [...content.events.keys()][0]!, hidden: true }];
    const out = useService(content, run, 'svc-test', 'scan');
    expect(out.run.stage!.map.nodes.find((n) => n.id === other.id)!.sides[0]!.hidden).toBeUndefined();
  });
  it('the Scout Tower names the boss types', () => {
    const run = stopRun('lookout');
    const out = useService(content, run, 'svc-test', 'scout');
    expect(out.message).toMatch(/uses .* Pokémon/);
  });
  it('the Trade Post swaps one Pokémon for a similar one, the same way on reload, only once', () => {
    const run = stopRun('trade');
    const view = serviceView(content, run, 'svc-test');
    expect(view.options.length).toBeGreaterThan(0);
    expect(serviceView(content, structuredClone(run), 'svc-test').options.map((o) => o.id)).toEqual(view.options.map((o) => o.id));
    const opt = view.options[0]!;
    const to = opt.id.split(':')[2]!;
    const out = useService(content, run, 'svc-test', opt.id);
    expect(out.run.party.some((m) => m.speciesId === to)).toBe(true);
    expect(out.run.party.some((m) => m.uid === opt.id.split(':')[1])).toBe(false);
    expect(() => useService(content, out.run, 'svc-test', opt.id)).toThrow();
  });
  it('special forms only come from a regional offer, never the Delta/Z/Spooky families', () => {
    const run = stopRun('trade');
    let regional = 0;
    for (let i = 0; i < 200; i++) {
      const to = tradeOffer(content, run, `s${i}`, run.party[0]!);
      if (!to) continue;
      const fam = specialFamily(getSpecies(content, to));
      if (fam) { expect(fam).toBe('regional'); regional++; }
    }
    expect(regional).toBeGreaterThan(0);
  });
});

describe('Specialist Mart, Training Dojo and Rival Meeting Place', () => {
  it('the mart only sells evolution items someone in the party can use', () => {
    const run = stopRun('mart2');
    run.party[0]!.speciesId = 'pikachu';
    const view = serviceView(content, run, 'svc-test');
    expect(view.options.map((o) => o.id)).toContain('buy:thunder-stone');
    expect(view.options.map((o) => o.id)).not.toContain('buy:fire-stone');
    const out = useService(content, run, 'svc-test', 'buy:thunder-stone');
    expect(out.run.inventory['thunder-stone']).toBe(1);
    expect(out.run.money).toBe(5000 - SERVICES.costs.evolutionItem);
    run.party[0]!.speciesId = 'rattata';
    run.party = [run.party[0]!];
    expect(serviceView(content, run, 'svc-test').options.every((o) => o.problem !== null)).toBe(true);
  });
  it('the dojo adds one capped stack, once per stop', () => {
    const run = stopRun('dojo');
    const view = serviceView(content, run, 'svc-test');
    const opt = view.options[0]!;
    const [, uid, stat] = opt.id.split(':');
    const out = useService(content, run, 'svc-test', opt.id);
    expect(out.run.party.find((m) => m.uid === uid)!.vitamins[stat as 'hp']).toBe(1);
    expect(() => useService(content, out.run, 'svc-test', opt.id)).toThrow();
    const maxed = stopRun('dojo');
    maxed.party[0]!.vitamins[stat as 'hp'] = content.balance.vitaminMaxStacks;
    expect(serviceView(content, maxed, 'svc-test').options.find((o) => o.id === opt.id)!.problem).toMatch(/fully trained/);
  });
  it('the meeting place needs a living rival, shows its team, and a truce puts it on cooldown', () => {
    const run = stopRun('meeting');
    expect(serviceView(content, run, 'svc-test').options).toHaveLength(0);
    run.story.rivals = [{ id: 'r1', classId: 'youngster', name: 'Joey', state: 'recurring', cooldown: 0, adaptations: [], memory: { lastBattle: { team: ['pidgey'] } } } as never];
    const view = serviceView(content, run, 'svc-test');
    expect(view.options.map((o) => o.id)).toEqual(['size:r1', 'truce:r1']);
    expect(useService(content, run, 'svc-test', 'size:r1').message).toMatch(/Pidgey/);
    const out = useService(content, run, 'svc-test', 'truce:r1');
    expect(out.run.story.rivals[0]!.cooldown).toBe(2);
    expect(serviceView(content, out.run, 'svc-test').options.every((o) => o.problem !== null)).toBe(true);
  });
  it('rival-only services are not placed without a rival', () => {
    let meeting = 0;
    for (let i = 0; i < 120; i++) {
      const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'p', seed: `nr-${i}`, archetypeId: 'red' }), 0));
      run.badges = ['a', 'b', 'c'] as never;
      for (const n of run.stage!.map.nodes) n.sides = [];
      placeServiceStop(run);
      if (run.stage!.map.nodes.some((n) => n.sides.some((s) => s.serviceId === 'meeting'))) meeting++;
    }
    expect(meeting).toBe(0);
  });
});

describe('Lodge, Relic Shrine, Auction House, Event Hall and Raid Observatory', () => {
  it('the lodge raises friendship once and not for a fainted Pokémon', () => {
    const run = stopRun('lodge');
    run.party[0]!.friendship = 50;
    const out = useService(content, run, 'svc-test', `rest:${run.party[0]!.uid}`);
    expect(out.run.party[0]!.friendship).toBe(50 + SERVICES.costs.lodgeFriendship);
    expect(() => useService(content, out.run, 'svc-test', `rest:${run.party[0]!.uid}`)).toThrow();
    run.party[0]!.hp = 0;
    expect(serviceView(content, run, 'svc-test').options[0]!.problem).toMatch(/fainted/);
  });
  it('fossil restoration revives one of two fossils, to the PC when the party is full, once per stop', () => {
    const run = stopRun('fossil');
    run.money = 5000;
    const view = serviceView(content, run, 'svc-test');
    expect(view.options).toHaveLength(2);
    expect(serviceView(content, run, 'svc-test').options.map((o) => o.id)).toEqual(view.options.map((o) => o.id));
    const out = useService(content, run, 'svc-test', view.options[0]!.id);
    expect(out.run.party.length + out.run.box.length).toBe(run.party.length + run.box.length + 1);
    expect(out.run.money).toBeLessThan(5000);
    expect(() => useService(content, out.run, 'svc-test', view.options[1]!.id)).toThrow();
  });
  it('the training school adds levels once, never past the cap or for a fainted Pokémon', () => {
    const run = stopRun('school');
    run.money = 5000;
    run.party[0]!.level = 5;
    const out = useService(content, run, 'svc-test', `class:${run.party[0]!.uid}`);
    expect(out.run.party[0]!.level).toBeGreaterThanOrEqual(5 + SERVICES.costs.schoolLevels);
    expect(out.run.money).toBeLessThan(5000);
    expect(() => useService(content, out.run, 'svc-test', `class:${run.party[0]!.uid}`)).toThrow();
  });
  it('the black market sells shop stock your badges have not opened, once, at a markup', () => {
    const run = stopRun('market');
    run.money = 50000;
    run.badges = [];
    const view = serviceView(content, run, 'svc-test');
    expect(view.options.length).toBeGreaterThan(0);
    const opt = view.options[0]!;
    const out = useService(content, run, 'svc-test', opt.id);
    expect(out.run.money).toBe(50000 - opt.cost);
    expect(() => useService(content, out.run, 'svc-test', opt.id)).toThrow();
  });
  it('the berry garden hands its seeded berry to one Pokémon, once', () => {
    const run = stopRun('garden');
    run.money = 5000;
    const view = serviceView(content, run, 'svc-test');
    const opt = view.options.find((o) => !o.problem)!;
    expect(opt).toBeDefined();
    const out = useService(content, run, 'svc-test', opt.id);
    expect(out.run.money).toBeLessThan(5000);
    expect(Object.keys(out.run.party.find((m) => m.uid === opt.id.split(':')[1])!.held ?? {})).toHaveLength(1);
    expect(() => useService(content, out.run, 'svc-test', opt.id)).toThrow();
  });
  it('the safari offers three seeded Pokémon and the catch result is fixed by the seed', () => {
    const a = stopRun('safari');
    a.money = 9000;
    const view = serviceView(content, a, 'svc-test');
    expect(view.options).toHaveLength(3);
    const opt = view.options[0]!;
    const out = useService(content, a, 'svc-test', opt.id);
    const again = useService(content, structuredClone(a), 'svc-test', opt.id);
    expect(out.message).toBe(again.message);
    expect(out.run.money).toBeLessThan(9000);
    expect(() => useService(content, out.run, 'svc-test', view.options[1]!.id)).toThrow();
  });
  it('the ability researcher switches a Pokémon to another of its abilities, once', () => {
    const run = stopRun('researcher');
    run.money = 9000;
    const lead = run.party.find((m) => serviceView(content, run, 'svc-test').options.some((o) => o.id.startsWith(`ability:${m.uid}:`)))!;
    const opt = serviceView(content, run, 'svc-test').options.find((o) => o.id.startsWith(`ability:${lead.uid}:`))!;
    const slot = Number(opt.id.split(':')[2]);
    const out = useService(content, run, 'svc-test', opt.id);
    expect(out.run.party.find((m) => m.uid === lead.uid)!.abilitySlot).toBe(slot);
    expect(() => useService(content, out.run, 'svc-test', opt.id)).toThrow();
  });
  it('the nursery sells one Mystery Egg per stop', () => {
    const run = stopRun('nursery');
    run.money = 5000;
    const before = run.money;
    const out = useService(content, run, 'svc-test', 'egg');
    expect(out.run.eggs).toHaveLength(1);
    expect(out.run.money).toBeLessThan(before);
    expect(() => useService(content, out.run, 'svc-test', 'egg')).toThrow();
  });
  it('the shrine shows both sides and applies a run-only exchange', () => {
    const run = stopRun('relic');
    const view = serviceView(content, run, 'svc-test');
    expect(view.options).toHaveLength(3);
    const opt = view.options[0]!;
    const [, gain, lose] = opt.id.split(':');
    expect(opt.text).toContain(gain!);
    expect(opt.text).toContain(lose!);
    const out = useService(content, run, 'svc-test', opt.id);
    expect(out.run.attributeModifiers[gain!]).toBe((run.attributeModifiers[gain!] ?? 0) + SERVICES.costs.relicGain);
    expect(out.run.attributeModifiers[lose!]).toBe((run.attributeModifiers[lose!] ?? 0) - SERVICES.costs.relicLoss);
    expect(serviceView(content, structuredClone(run), 'svc-test').options.map((o) => o.id)).toEqual(view.options.map((o) => o.id));
  });
  it('an auction bid costs money only when it wins, the result is fixed by the seed, and there is one bid', () => {
    const run = stopRun('auction');
    const view = serviceView(content, run, 'svc-test');
    expect(view.options.length).toBe(6);
    let wins = 0;
    for (const o of view.options) {
      const out = useService(content, structuredClone(run), 'svc-test', o.id);
      const again = useService(content, structuredClone(run), 'svc-test', o.id);
      expect(out.message).toBe(again.message);
      const won = /won the auction/.test(out.message);
      expect(out.run.money).toBe(won ? 5000 - o.cost : 5000);
      if (won) wins++;
    }
    expect(wins).toBeGreaterThan(0);
    const done = useService(content, run, 'svc-test', view.options[1]!.id);
    expect(() => useService(content, done.run, 'svc-test', view.options[0]!.id)).toThrow();
  });
  it('the hall reads the run\'s editions and the observatory lists raid dens', () => {
    const run = stopRun('hall');
    run.gameEvents = ['rivalry-week@2026-W44'];
    expect(useService(content, run, 'svc-test', 'read').message).toMatch(/rivalry-week/);
    const obs = stopRun('observatory');
    expect(serviceView(content, obs, 'svc-test').options[0]!.problem).toMatch(/no raid dens/);
    const raidId = content.raids.raids[0]!.id;
    obs.stage!.map.nodes.find((n) => n.column === 2)!.sides = [{ id: 'den', kind: 'raid', raidId, used: false }];
    expect(useService(content, obs, 'svc-test', 'survey').message).toContain(content.raids.raids[0]!.name);
  });
});
