// Trainer Plaza rework (spec §18): districts cover every section, the look and crowd are deterministic per stage,
// stages differ, returning faces appear, and building the layout never changes the run.

import { describe, expect, it } from 'vitest';
import { plazaLayout, PLAZA_LIFE } from '../../src/core/plaza/layout';
import { rareVisitorHere, sectionView, usePlaza } from '../../src/core/plaza/flow';
import { isGiftable } from '../../src/core/events';
import { createPokemon } from '../../src/core/pokemon';
import { answerMentorship, planMentorship } from '../../src/core/story/mentorship';
import { startMentorship, MENTORS } from '../../src/core/mentors';
import { openHistory } from '../../src/core/story/record';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

function plazaRun(seed: string, badges = 2): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'pl', seed, archetypeId: 'red' }), 0));
  const middle = Math.ceil(run.stage!.map.columns / 2);
  const node = run.stage!.map.nodes.find((n) => n.column === middle)!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  run.badges = Array.from({ length: badges }, (_, i) => `b${i}`) as never;
  return run;
}
const sideOf = (run: RunState): string => run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!.sides.find((s) => s.kind === 'plaza')!.id;

describe('plaza layout', () => {
  it('puts every plaza section in exactly one district', () => {
    const all = PLAZA_LIFE.districts.flatMap((d) => d.sections);
    expect(new Set(all).size).toBe(all.length);
    for (const id of ['stalls', 'oddities', 'traders', 'board', 'rumors', 'club', 'errands', 'alley', 'services', 'people', 'caravan']) expect(all).toContain(id);
  });

  it('is the same on a reload and does not touch the run', () => {
    const run = plazaRun('layout-a');
    const before = JSON.stringify(run);
    const a = plazaLayout(content, run, sideOf(run));
    const b = plazaLayout(content, run, sideOf(run));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(run)).toBe(before);
  });

  it('gives a crowd with trainers, Pokémon and chatter, and every district a count', () => {
    const run = plazaRun('layout-b');
    const l = plazaLayout(content, run, sideOf(run));
    expect(l.districts).toHaveLength(6);
    expect(l.crowd.filter((w) => w.kind === 'regular').length).toBeGreaterThan(3);
    expect(l.crowd.filter((w) => w.kind === 'traveler').length).toBeGreaterThanOrEqual(3);
    const mons = l.crowd.filter((w) => w.kind === 'pokemon');
    expect(mons.length).toBeGreaterThan(0);
    for (const m of mons) expect(content.species.has(m.speciesId!)).toBe(true);
    for (const c of l.chats) {
      const ids = new Set(l.crowd.map((w) => w.id));
      expect(ids.has(c.a) && ids.has(c.b)).toBe(true);
    }
    expect(l.districts.find((d) => d.id === 'market')!.count).toBeGreaterThan(0);
  });

  it('varies between runs and shows past rivals and foes', () => {
    const looks = new Set<string>();
    const crowds = new Set<string>();
    let sawFoe = false;
    for (let i = 0; i < 12; i++) {
      const run = plazaRun(`layout-v${i}`);
      run.plaza.foes.push({ name: 'Old Hiker', classId: 'hiker', won: true });
      const l = plazaLayout(content, run, sideOf(run));
      looks.add(l.look.id);
      crowds.add(l.crowd.filter((w) => w.kind === 'traveler').map((w) => w.name).join('|'));
      if (l.crowd.some((w) => w.kind === 'foe')) sawFoe = true;
    }
    expect(looks.size).toBeGreaterThan(1);
    expect(crowds.size).toBeGreaterThan(1);
    expect(sawFoe).toBe(true);
  });

  it('opens the secret alley district only when the alley is open', () => {
    const run = plazaRun('layout-alley', 0);
    const closed = plazaLayout(content, run, sideOf(run)).districts.find((d) => d.id === 'secret')!;
    run.plaza.flags.push('alley');
    const open = plazaLayout(content, run, sideOf(run)).districts.find((d) => d.id === 'secret')!;
    expect(open.locked).toBe(false);
    if (closed.locked) expect(closed.count).toBe(0);
  });

  it('gives trainer figures real class sprites', () => {
    const run = plazaRun('layout-sprites');
    const l = plazaLayout(content, run, sideOf(run));
    const people = l.crowd.filter((w) => w.kind !== 'pokemon');
    expect(people.length).toBeGreaterThan(0);
    for (const w of people) expect(w.spriteId, w.id).toBeTruthy();
  });
});

describe('plaza mini-events', () => {
  it('only pays items that exist', () => {
    const effects = [...PLAZA_LIFE.rare.flatMap((r) => r.gift), ...PLAZA_LIFE.fountain.wishes.flatMap((w) => w.effects), ...PLAZA_LIFE.performance.effects];
    for (const e of effects) if (e.kind === 'item') expect(isGiftable(content, e.id), e.id).toBe(true);
  });

  it('the fountain and the performer work once per stage, and the wish cannot be rerolled', () => {
    const run = plazaRun('mini-a');
    run.money = 5000;
    const side = sideOf(run);
    const ids = (r: RunState) => sectionView(content, r, side, 'people').options.map((o) => o.id);
    expect(ids(run)).toContain('fountain');
    const a = structuredClone(run);
    const b = structuredClone(run);
    const ra = usePlaza(content, a, side, 'people', 'fountain');
    const rb = usePlaza(content, b, side, 'people', 'fountain');
    expect(ra.message).toBe(rb.message);
    expect(() => usePlaza(content, ra.run, side, 'people', 'fountain')).toThrow();
    const shown = usePlaza(content, ra.run, side, 'people', 'show');
    expect(shown.run.plaza.rep).toBeGreaterThan(run.plaza.rep);
    expect(() => usePlaza(content, shown.run, side, 'people', 'show')).toThrow();
  });

  it('a rare visitor gives a gift once', () => {
    for (let i = 0; i < 40; i++) {
      const run = plazaRun(`rare-${i}`, 6);
      const v = rareVisitorHere(run);
      if (!v) continue;
      const side = sideOf(run);
      const r = usePlaza(content, run, side, 'people', `rare:${v.id}`);
      expect(r.message).toContain(v.giftText);
      expect(() => usePlaza(content, r.run, side, 'people', `rare:${v.id}`)).toThrow();
      return;
    }
    throw new Error('no rare visitor in 40 seeds');
  });
});

describe('plaza mentors', () => {
  it('a mentor and protégé in the party train in the plaza, once per stage', () => {
    const run = plazaRun('mentor-plaza');
    run.party[0]!.level = 40;
    const rookie = createPokemon(content, 'rattata', 20, 'rookie');
    run.party.push(rookie);
    openHistory(content, run, rookie.uid, rookie.speciesId, 'caught');
    const h = run.story.histories[run.party[0]!.uid]!;
    h.battles = 12;
    h.bossesBeaten = 2;
    answerMentorship(content, run, planMentorship(content, run)!, true);
    const side = sideOf(run);
    const l = plazaLayout(content, run, side);
    expect(l.crowd.filter((w) => w.id.startsWith('mentor:') || w.id.startsWith('prote:'))).toHaveLength(2);
    const lesson = sectionView(content, run, side, 'people').options.find((o) => o.id.startsWith('lesson:'))!;
    expect(lesson).toBeTruthy();
    const done = usePlaza(content, run, side, 'people', lesson.id);
    expect(done.run.plaza.rep).toBeGreaterThan(run.plaza.rep);
    expect(() => usePlaza(content, done.run, side, 'people', lesson.id)).toThrow();
  });
});

describe('plaza mentor and fellow apprentice', () => {
  it('your mentor and fellow apprentice stand on the terrace; advice and practice work once a stage', () => {
    const run = plazaRun('mentor-npc');
    run.mentor = startMentorship(run.seed, MENTORS[0]!.id, { trust: 0, graduated: 0, apprentices: [] } as never);
    const side = sideOf(run);
    const l = plazaLayout(content, run, side);
    expect(l.crowd.some((w) => w.id.startsWith('mentor:') && w.kind === 'regular')).toBe(true);
    expect(l.crowd.some((w) => w.id.startsWith('fellow:'))).toBe(true);
    const before = run.mentor!.trust;
    const a = usePlaza(content, run, side, 'people', 'mentor:advice');
    expect(a.run.mentor!.trust).toBe(before + 2);
    expect(() => usePlaza(content, a.run, side, 'people', 'mentor:advice')).toThrow();
    const b = usePlaza(content, a.run, side, 'people', 'mentor:spar');
    expect(b.run.mentor!.rivalry).toBe(a.run.mentor!.rivalry + 1);
  });
});
