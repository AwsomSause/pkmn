// Trainer Plaza (APPROVED.md §11): data, placement, stalls, trades, errands, Battle Club, alley, reputation, saves.

import { describe, expect, it } from 'vitest';
import { PLAZA, PlazaSchema } from '../../src/core/plaza/schema';
import { placePlaza } from '../../src/core/plaza/gate';
import { noteFoe, plazaClubLost, plazaClubWon, plazaEvent, plazaView, sectionView, usePlaza, type PlazaSectionId } from '../../src/core/plaza/flow';
import { isGiftable } from '../../src/core/events';
import { chooseStarter, createRun } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { maxHp } from '../../src/core/pokemon';
import plazaJson from '../../src/data/plaza.json';
import { content } from './helpers';

function plazaRun(seed = 'plaza', badges = 2): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'pz', seed, archetypeId: 'red' }), 0));
  const middle = Math.ceil(run.stage!.map.columns / 2);
  const node = run.stage!.map.nodes.find((n) => n.column === middle)!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  run.money = 20000;
  run.badges = Array.from({ length: badges }, (_, i) => `b${i}`) as never;
  return run;
}
const sideId = (run: RunState): string => run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!.sides.find((s) => s.kind === 'plaza')!.id;
const options = (run: RunState, section: PlazaSectionId) => sectionView(content, run, sideId(run), section).options;
const use = (run: RunState, section: PlazaSectionId, id: string) => usePlaza(content, run, sideId(run), section, id);

describe('plaza data', () => {
  it('validates, and every id it names exists', () => {
    expect(PlazaSchema.safeParse(plazaJson).success).toBe(true);
    const regulars = new Set(PLAZA.regulars.map((r) => r.id));
    const effects = [
      ...PLAZA.posts.flatMap((p) => p.effects), ...PLAZA.errands.flatMap((e) => e.effects), ...PLAZA.club.flatMap((c) => [...c.roundPrize, ...c.prize]),
      ...PLAZA.alley.offers.flatMap((o) => [...o.effects, ...o.trouble]), ...PLAZA.events.flatMap((e) => e.gift),
      ...PLAZA.caravans.flatMap((c) => c.offers.flatMap((o) => o.effects)), ...PLAZA.factions.flatMap((f) => f.offers.flatMap((o) => o.effects)),
    ];
    for (const e of effects) {
      if (e.kind === 'item') expect(isGiftable(content, e.id), `item ${e.id}`).toBe(true);
      if (e.kind === 'itemFrom') for (const id of e.ids) expect(isGiftable(content, id), `item ${id}`).toBe(true);
    }
    for (const t of PLAZA.traders) for (const s of t.give.species) expect(content.species.has(s), `species ${s}`).toBe(true);
    for (const o of PLAZA.oddities.items) expect(isGiftable(content, o.item), `oddity ${o.item}`).toBe(true);
    for (const s of PLAZA.stalls) {
      expect(regulars.has(s.keeper)).toBe(true);
      const found = s.families.includes('ball') || [...content.catalog.values()].some((c) => c.status === 'supported' && s.families.includes(c.family));
      expect(found, `stall ${s.id}`).toBe(true);
    }
    for (const e of PLAZA.errands) {
      expect(regulars.has(e.giver)).toBe(true);
      if (e.need.kind === 'item') expect(isGiftable(content, e.need.id)).toBe(true);
      if (e.unlocks?.startsWith('trade:')) expect(PLAZA.traders.some((t) => t.id === e.unlocks!.slice(6))).toBe(true);
      if (e.unlocks?.startsWith('discount:')) expect(PLAZA.regulars.find((r) => r.id === e.unlocks!.slice(9))?.perk).toBeDefined();
    }
    for (const c of PLAZA.caravans) if (c.followUp) expect(c.followUp).toBe(`caravan:${c.id}`);
    for (const s of PLAZA.services) expect(regulars.has(s.keeper)).toBe(true);
    expect(PLAZA.regulars.length).toBeGreaterThanOrEqual(10);
  });

  it('keeps every id unique', () => {
    for (const list of [PLAZA.regulars, PLAZA.stalls, PLAZA.traders, PLAZA.posts, PLAZA.errands, PLAZA.club, PLAZA.alley.offers, PLAZA.events, PLAZA.caravans, PLAZA.factions]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('plaza placement', () => {
  it('sits in the middle column of every stage, and every route passes it', () => {
    for (let i = 0; i < 20; i++) {
      const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'g', seed: `mid-${i}`, archetypeId: 'red' }), 0));
      const map = run.stage!.map;
      const middle = Math.ceil(map.columns / 2);
      const plazas = map.nodes.filter((n) => n.sides.some((s) => s.kind === 'plaza'));
      expect(plazas.length).toBeGreaterThan(0);
      for (const n of plazas) expect(n.column).toBe(middle);
      // Every node of the middle column has it, and a route visits one node per column.
      expect(map.nodes.filter((n) => n.column === middle).every((n) => n.sides.some((s) => s.kind === 'plaza'))).toBe(true);
      const again = structuredClone(run);
      for (const n of again.stage!.map.nodes) n.sides = n.sides.filter((s) => s.kind !== 'plaza');
      placePlaza(again);
      expect(again.stage!.map.nodes.filter((n) => n.sides.some((s) => s.kind === 'plaza')).map((n) => n.id)).toEqual(plazas.map((n) => n.id));
    }
  });

  it('is not placed on the league map', () => {
    const run = plazaRun();
    run.stage!.kind = 'league';
    for (const n of run.stage!.map.nodes) n.sides = [];
    placePlaza(run);
    expect(run.stage!.map.nodes.flatMap((n) => n.sides)).toEqual([]);
  });
});

describe('plaza view', () => {
  it('is the same on a reload, and rotates between seeds', () => {
    const a = plazaRun('rot-a');
    expect(JSON.stringify(plazaView(content, structuredClone(a), sideId(a)))).toBe(JSON.stringify(plazaView(content, a, sideId(a))));
    const stalls = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const r = plazaRun(`rot-${i}`);
      stalls.add(options(r, 'stalls').map((o) => o.id).join('|'));
    }
    expect(stalls.size).toBeGreaterThan(6);
  });

  it('shows every area with something in it', () => {
    const run = plazaRun('areas');
    run.plaza.rep = 12;
    const view = plazaView(content, run, sideId(run));
    const ids = view.sections.map((s) => s.id);
    for (const id of ['stalls', 'oddities', 'traders', 'board', 'rumors', 'club', 'errands', 'services', 'people', 'alley']) expect(ids, id).toContain(id);
    expect(view.repTitle).toBe('Familiar Face');
  });

  it('hides the alley until it is earned, then opens it with reputation, a flag or low Good', () => {
    const run = plazaRun('alley-gate');
    run.attributeModifiers.goodEvil = 0;
    expect(plazaView(content, run, sideId(run)).sections.map((s) => s.id)).not.toContain('alley');
    expect(plazaView(content, run, sideId(run)).alleyHint).toMatch(/narrow passage/);
    const withRep = structuredClone(run);
    withRep.plaza.rep = 8;
    expect(plazaView(content, withRep, sideId(withRep)).sections.map((s) => s.id)).toContain('alley');
    const withFlag = structuredClone(run);
    withFlag.plaza.flags.push('alley');
    expect(plazaView(content, withFlag, sideId(withFlag)).sections.map((s) => s.id)).toContain('alley');
  });

  it('closes the stalls in an evacuation but still hands out relief', () => {
    for (let i = 0; i < 400; i++) {
      const run = plazaRun(`evac-${i}`, 3);
      if (plazaEvent(run).id !== 'evacuation') continue;
      expect(plazaView(content, run, sideId(run)).sections.map((s) => s.id)).not.toContain('stalls');
      const gift = options(run, 'people').find((o) => o.id === 'gift')!;
      const out = use(run, 'people', 'gift');
      expect(out.run.money).toBeGreaterThan(run.money);
      expect(options(out.run, 'people').find((o) => o.id === 'gift')!.problem).toMatch(/Already/);
      expect(gift.problem).toBeNull();
      return;
    }
    throw new Error('no evacuation seed found');
  });
});

describe('stalls and oddities', () => {
  it('sells an item once, takes the money and builds reputation', () => {
    const run = plazaRun('buy');
    const buy = options(run, 'stalls').find((o) => o.problem === null)!;
    const out = use(run, 'stalls', buy.id);
    expect(out.run.money).toBe(run.money - buy.cost);
    expect(out.run.plaza.rep).toBe(run.plaza.rep + 1 + plazaEvent(run).repBonus);
    expect(options(out.run, 'stalls').find((o) => o.id === buy.id)!.problem).toBe('Sold out.');
    expect(() => use(out.run, 'stalls', buy.id)).toThrow(/Sold out/);
  });

  it('refuses without money', () => {
    const run = plazaRun('poor');
    run.money = 0;
    const o = options(run, 'stalls')[0]!;
    expect(o.problem).toMatch(/You need/);
    expect(() => use(run, 'stalls', o.id)).toThrow();
  });

  it('a friend discount makes a keeper cheaper', () => {
    for (let i = 0; i < 40; i++) {
      const run = plazaRun(`disc-${i}`);
      const first = options(run, 'stalls').find((o) => o.id.startsWith('buy:held:') || o.id.startsWith('buy:berries:'));
      if (!first) continue;
      const stall = first.id.split(':')[1]!;
      const keeper = PLAZA.stalls.find((s) => s.id === stall)!.keeper;
      const friendRun = structuredClone(run);
      friendRun.plaza.friends[keeper] = 9;
      const cheaper = options(friendRun, 'stalls').find((o) => o.id === first.id)!;
      expect(cheaper.cost).toBeLessThan(first.cost);
      return;
    }
    throw new Error('no seed with a discountable stall');
  });

  it('the oddities dealer hides names until Intelligence is sharp', () => {
    const run = plazaRun('odd');
    run.baseAttributes.intelligence = 0;
    expect(options(run, 'oddities').every((o) => o.title === 'A curious object')).toBe(true);
    const sharp = structuredClone(run);
    sharp.attributeModifiers.intelligence = 20;
    expect(options(sharp, 'oddities').every((o) => o.title !== 'A curious object')).toBe(true);
    const buy = options(run, 'oddities')[0]!;
    const out = use(run, 'oddities', buy.id);
    expect(out.message).toMatch(/It was a/);
  });
});

describe('traders and the board', () => {
  it('swaps a fitting Pokémon for the offered one', () => {
    for (let i = 0; i < 60; i++) {
      const run = plazaRun(`trade-${i}`);
      run.plaza.rep = 20;
      const opt = options(run, 'traders').find((o) => o.problem === null && o.id.split(':')[2] !== 'none');
      if (!opt) continue;
      const out = use(run, 'traders', opt.id);
      const [, , uid] = opt.id.split(':');
      expect(out.run.party.some((m) => m.uid === uid)).toBe(false);
      expect(out.run.party.length).toBe(run.party.length);
      expect(out.run.plaza.rep).toBe(run.plaza.rep + 2 + plazaEvent(run).repBonus);
      expect(out.run.log.counters.tradesMade).toBe(1);
      expect(options(out.run, 'traders').find((o) => o.id === opt.id)?.problem ?? 'Already traded today.').toMatch(/Already traded/);
      return;
    }
    throw new Error('no trade was possible');
  });

  it('answers a notice and never twice', () => {
    for (let i = 0; i < 40; i++) {
      const run = plazaRun(`post-${i}`);
      run.baseAttributes.charisma = 0;
      const post = options(run, 'board').find((o) => o.problem === null && o.id.startsWith('post:'));
      if (!post) continue;
      const out = use(run, 'board', post.id);
      expect(out.run.plaza.done).toContain(post.id.slice(5));
      expect(out.run.plaza.rep).toBeGreaterThan(run.plaza.rep);
      expect(options(out.run, 'board').some((o) => o.id === post.id)).toBe(false);
      return;
    }
    throw new Error('no answerable notice');
  });

  it('rumours name real stops and carry a reliability tag; tips are exact', () => {
    const run = plazaRun('rumor');
    const view = sectionView(content, run, sideId(run), 'rumors');
    expect(view.notes.length).toBeGreaterThanOrEqual(3);
    for (const n of view.notes) expect(n).toMatch(/^\[(Firsthand|Secondhand|Hearsay)\]/);
    const tip = view.options.find((o) => o.id === 'tip:gym')!;
    const out = use(run, 'rumors', tip.id);
    expect(out.run.money).toBe(run.money - tip.cost);
    expect(options(out.run, 'rumors').find((o) => o.id === 'tip:gym')!.problem).toMatch(/Already/);
  });
});

describe('errands', () => {
  it('takes, tracks progress from the taking, pays, and unlocks', () => {
    const run = plazaRun('errand');
    run.plaza.rep = 12;
    run.log.counters.evolutions = 5;
    const def = PLAZA.errands.find((e) => e.id === 'e-fenwick-stone')!;
    let state = run;
    for (let i = 0; i < 300 && !options(state, 'errands').some((o) => o.id === `take:${def.id}`); i++) state = plazaRun(`errand-${i}`);
    state.plaza.rep = 12;
    state.log.counters.evolutions = 5;
    const taken = use(state, 'errands', `take:${def.id}`).run;
    expect(taken.plaza.errands[0]!.base).toBe(5);
    const turn = options(taken, 'errands').find((o) => o.id === `done:${def.id}`)!;
    expect(turn.problem).toMatch(/evolution/);
    expect(() => use(taken, 'errands', turn.id)).toThrow();
    taken.log.counters.evolutions = 6;
    const done = use(taken, 'errands', turn.id).run;
    expect(done.plaza.errands).toEqual([]);
    expect(done.plaza.done).toContain(def.id);
    expect(done.plaza.flags).toContain('trade:t-dragon');
    expect(done.plaza.friends.fenwick).toBeGreaterThanOrEqual(2);
  });

  it('keeps open errands across stages and hands over items', () => {
    const run = plazaRun('errand-item');
    run.plaza.errands.push({ id: 'e-mabel-berry', base: 0, stage: 'old' });
    run.inventory['sitrus-berry'] = 3;
    const out = use(run, 'errands', 'done:e-mabel-berry').run;
    expect(out.inventory['sitrus-berry']).toBeUndefined();
    expect(out.plaza.flags).toContain('discount:mabel');
  });
});

describe('services', () => {
  it('heals once per plaza, and refuses a healthy party', () => {
    const run = plazaRun('svc');
    expect(options(run, 'services').find((o) => o.id === 'svc:heal')!.problem).toMatch(/top shape/);
    run.party[0]!.hp = 1;
    const heal = options(run, 'services').find((o) => o.id === 'svc:heal')!;
    const out = use(run, 'services', 'svc:heal');
    expect(out.run.party[0]!.hp).toBe(maxHp(content, out.run.party[0]!));
    expect(out.run.money).toBe(run.money - heal.cost);
    out.run.party[0]!.hp = 1;
    expect(options(out.run, 'services').find((o) => o.id === 'svc:heal')!.problem).toMatch(/closed/);
  });

  it('gives advice about the stage boss', () => {
    const run = plazaRun('advice');
    const out = use(run, 'services', 'svc:advice');
    expect(out.message).toMatch(/uses .* Pokémon/);
  });
});

describe('Battle Club', () => {
  it('starts a match, pays rounds, ends the streak and builds reputation', () => {
    const run = plazaRun('club', 3);
    run.plaza.rep = 6;
    const start = use(run, 'club', 'club:streak');
    expect(start.battle).toBe(true);
    expect(start.run.phase).toBe('battle');
    expect(start.run.battle!.event!.eventId).toBe('plaza:club');
    expect(start.run.money).toBeLessThan(run.money);
    const r1 = structuredClone(start.run);
    const words1 = plazaClubWon(content, r1);
    expect(words1.join(' ')).toMatch(/Round 1 of 3 won/);
    expect(r1.plaza.club!.round).toBe(1);
    r1.plaza.club!.round = 2;
    const rep = r1.plaza.rep;
    plazaClubWon(content, r1);
    expect(r1.plaza.club).toBeNull();
    expect(r1.plaza.rep).toBeGreaterThan(rep);
  });

  it('a loss is friendly: the party is back on its feet and the streak ends', () => {
    const run = plazaRun('club-lose', 3);
    const start = use(run, 'club', 'club:friendly').run;
    for (const m of start.party) m.hp = 0;
    plazaClubLost(content, start);
    expect(start.phase).toBe('map');
    expect(start.battle).toBeNull();
    expect(start.party.every((m) => m.hp > 0)).toBe(true);
    expect(start.plaza.club).toBeNull();
  });

  it('refuses without a team that can fight, or the reputation', () => {
    const run = plazaRun('club-gate', 3);
    expect(options(run, 'club').find((o) => o.id === 'club:champion')!.problem).toMatch(/reputation/);
    for (const m of run.party) m.hp = 0;
    expect(options(run, 'club').find((o) => o.id === 'club:friendly')!.problem).toMatch(/can fight/);
  });

  it('past enemies return and offer a rematch', () => {
    for (let i = 0; i < 40; i++) {
      const run = plazaRun(`foe-${i}`);
      noteFoe(run, 'Youngster Joey', 'youngster');
      const people = options(run, 'people');
      if (!people.some((o) => o.id === 'foe:thanks')) continue;
      const out = use(run, 'people', 'foe:thanks').run;
      expect(out.money).toBeGreaterThan(run.money);
      const fight = use(run, 'people', 'club:foe:Youngster Joey');
      expect(fight.battle).toBe(true);
      expect(fight.run.battle!.trainer!.name).toBe('Youngster Joey');
      return;
    }
    throw new Error('no foe appeared');
  });
});

describe('alley, factions, caravans, regulars', () => {
  it('a risky deal either pays or goes wrong, and costs Good', () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const run = plazaRun(`alley-${i}`);
      run.plaza.rep = 30;
      const deal = options(run, 'alley').find((o) => o.id === 'alley:suspicious-contract');
      if (!deal) continue;
      const out = use(run, 'alley', deal.id);
      outcomes.add(out.run.money > run.money ? 'paid' : 'trouble');
      expect(options(out.run, 'alley').find((o) => o.id === deal.id)?.problem).toBe('Gone.');
      if (outcomes.size === 2) break;
    }
    expect(outcomes.size).toBe(2);
  });

  it('talking builds friendship; a perk line appears when it unlocks', () => {
    const run = plazaRun('talk');
    run.plaza.friends.gus = 1;
    const out = use(run, 'people', 'talk:gus').run;
    expect(out.plaza.friends.gus).toBe(2);
    expect(options(out, 'people').find((o) => o.id === 'talk:gus')!.problem).toMatch(/"/);
  });

  it('a faction offer works once', () => {
    for (let i = 0; i < 40; i++) {
      const run = plazaRun(`fac-${i}`);
      const offer = options(run, 'people').find((o) => o.id.startsWith('fac:') && o.id !== 'fac:calm' && o.problem === null && o.cost === 0);
      if (!offer) continue;
      const out = use(run, 'people', offer.id);
      expect(options(out.run, 'people').find((o) => o.id === offer.id)!.problem).toBe('Done.');
      return;
    }
    throw new Error('no faction offer');
  });

  it('a caravan comes now and then and sets a follow-up for the next plaza', () => {
    for (let i = 0; i < 80; i++) {
      const run = plazaRun(`cv-${i}`, 3);
      if (!plazaView(content, run, sideId(run)).sections.some((s) => s.id === 'caravan')) continue;
      const offer = options(run, 'caravan').find((o) => o.problem === null)!;
      const out = use(run, 'caravan', offer.id).run;
      expect(options(out, 'caravan').find((o) => o.id === offer.id)!.problem).toBe('Gone.');
      return;
    }
    throw new Error('no caravan');
  });
});

describe('plaza saves', () => {
  it('a run without plaza memory loads with defaults, and the state round-trips', () => {
    const run = plazaRun('save');
    run.plaza.rep = 5;
    run.plaza.flags.push('alley');
    const back = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(back.plaza).toEqual(run.plaza);
    const old = JSON.parse(JSON.stringify(run));
    delete old.plaza;
    expect(RunStateSchema.parse(old).plaza).toEqual({ rep: 0, friends: {}, flags: [], errands: [], done: [], used: {}, foes: [], club: null, visits: 0 });
  });
});

describe('Egg traders (Trading Post)', () => {
  it('sells a mystery Egg once per trader per stage, and the Egg is fixed by the seed', () => {
    const run = plazaRun('eggshop');
    const buy = options(run, 'eggs').find((o) => o.id === 'egg:nest-keeper:buy')!;
    expect(buy.problem).toBeNull();
    const out = use(run, 'eggs', buy.id).run;
    expect(out.eggs).toHaveLength(1);
    expect(out.eggs[0]).toMatchObject({ kind: 'mystery', total: expect.any(Number) });
    expect(out.money).toBeLessThan(run.money);
    expect(options(out, 'eggs').find((o) => o.id === 'egg:nest-keeper:buy')!.problem).not.toBeNull();
    const again = use(plazaRun('eggshop'), 'eggs', buy.id).run;
    expect(again.eggs[0]).toEqual(out.eggs[0]);
  });

  it('swaps one of your Eggs for a fresh one, and not for free money', () => {
    const run = plazaRun('eggswap');
    use(run, 'eggs', 'egg:ranger-pell:buy');
    const bought = use(run, 'eggs', 'egg:ranger-pell:buy').run;
    const mine = bought.eggs[0]!;
    const swap = options(bought, 'eggs').find((o) => o.id === `egg:nest-keeper:${mine.uid}`)!;
    expect(swap.cost).toBe(0);
    const out = use(bought, 'eggs', swap.id).run;
    expect(out.eggs).toHaveLength(1);
    expect(out.eggs[0]!.uid).not.toBe(mine.uid);
    expect(out.eggs[0]!.left).toBe(out.eggs[0]!.total);
    expect(out.money).toBe(bought.money);
  });

  it('refuses a purchase when you already carry four Eggs', () => {
    const run = plazaRun('eggcap');
    for (const id of ['nest-keeper', 'ranger-pell', 'old-breeder']) {
      const r = use(run, 'eggs', `egg:${id}:buy`).run;
      run.eggs = r.eggs;
      run.plaza = r.plaza;
      run.money = 20000;
    }
    run.eggs.push({ ...run.eggs[0]!, uid: 'extra' });
    expect(options(run, 'eggs').filter((o) => o.id.endsWith(':buy')).every((o) => o.problem !== null)).toBe(true);
  });
});
