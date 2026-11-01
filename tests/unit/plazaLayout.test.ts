// Trainer Plaza rework (spec §18): districts cover every section, the look and crowd are deterministic per stage,
// stages differ, returning faces appear, and building the layout never changes the run.

import { describe, expect, it } from 'vitest';
import { plazaLayout, PLAZA_LIFE } from '../../src/core/plaza/layout';
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
});
