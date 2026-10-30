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
