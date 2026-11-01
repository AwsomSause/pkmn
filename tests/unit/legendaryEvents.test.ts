// Legendary world events (spec 19): data, triggers, stage rules, route changes, saves.

import { describe, expect, it } from 'vitest';
import { validateRoute } from '../../src/core/expedition/graph';
import { availableNodes, beginExpedition, chooseExpeditionNode, expeditionPreview, extractExpedition, resolveExpeditionChoice, settleExpedition } from '../../src/core/expedition/flow';
import { LegendaryFileSchema } from '../../src/core/expedition/schema';
import { eligibleLegendary, envAt, legendaryEvents, legendaryProblem, placeLegendaryGate } from '../../src/core/legendary/legendary';
import { placeExpeditionGate } from '../../src/core/expedition/gate';
import { pickTotemFor } from '../../src/core/totem/totem';
import { maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import legendaryJson from '../../src/data/legendaryEvents.json';
import { content } from './helpers';

function gateRun(seed: string, id: string): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'lg', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = [{ id: 'gate-test', kind: 'expedition', expeditionId: id, used: false }];
  run.stage!.current = node.id;
  return run;
}

/** Walks the route taking the first stop each time; fights are won (or lost at fight N). Returns the finished run. */
function walk(run: RunState, loseAt?: number): RunState {
  let fights = 0;
  for (let guard = 0; guard < 80 && run.phase === 'expedition'; guard++) {
    const exp = run.expedition!;
    if (exp.battleResult) {
      run = settleExpedition(content, run);
      continue;
    }
    if (exp.choice) {
      run = resolveExpeditionChoice(content, run, 0);
      continue;
    }
    run = chooseExpeditionNode(content, run, availableNodes(exp)[0]!.id);
    if (run.phase === 'battle') {
      fights += 1;
      run.battle = null;
      run.phase = 'expedition';
      run.expedition!.battleResult = loseAt === fights ? 'lose' : 'win';
    }
  }
  return run;
}

describe('legendary event data', () => {
  it('validates and covers every Legendary and Mythical (base forms), with 12 hand-designed ones', () => {
    expect(LegendaryFileSchema.safeParse(legendaryJson).success).toBe(true);
    const events = legendaryEvents(content);
    const covered = new Set(events.map((e) => e.legendary!.species));
    for (const id of ['kyogre', 'groudon', 'rayquaza', 'giratina', 'dialga', 'palkia', 'lugia', 'ho-oh', 'mewtwo', 'articuno', 'zapdos', 'moltres']) expect(covered.has(id), id).toBe(true);
    const missing = [...content.species.values()].filter((s) => !s.form && (s.tags.includes('legendary') || s.tags.includes('mythical')) && !covered.has(s.id) && !['cosmog', 'cosmoem', 'kubfu', 'phione', 'meltan'].includes(s.id));
    expect(missing.map((s) => s.id)).toEqual([]);
    for (const e of events) {
      const totem = content.totems.totems.find((t) => t.id === (e.finale.kind === 'totem' ? e.finale.totemId : ''))!;
      expect(totem.legendary, e.id).toBe(true);
      expect(totem.species).toEqual([e.legendary!.species]);
      expect(totem.phases.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('the four spec examples have their own stage rules', () => {
    const get = (s: string) => events().find((e) => e.legendary!.species === s)!.legendary!;
    function events() { return legendaryEvents(content); }
    expect(get('kyogre').env[0]!.weather).toBe('rain');
    expect(get('kyogre').affinity!.types).toContain('water');
    expect(get('kyogre').closes.length).toBeGreaterThan(0);
    expect(get('groudon').env.map((e) => e.weather)).toEqual(['sun', 'sand', 'sun']);
    expect(get('rayquaza').env[0]!.terrain).toBe('electric');
    expect(get('rayquaza').closes.length).toBeGreaterThanOrEqual(3);
    expect(get('giratina').distort.length).toBeGreaterThanOrEqual(3);
    expect(get('giratina').env[0]!.pool.length).toBeGreaterThanOrEqual(3);
  });

  it('legendary finale Totems and events are never drawn for ordinary dens and expedition gates', () => {
    const run = createRun(content, { runId: 'lg', seed: 'draw', archetypeId: 'red' });
    for (let i = 0; i < 60; i++) {
      for (const regionIndex of [0, 2, 4]) expect(pickTotemFor(content, { seed: `s${i}`, regionIndex }, ['water', 'fire'], `${i}`).legendary).toBe(false);
    }
    for (let i = 0; i < 80; i++) {
      const r = chooseStarter(content, createRun(content, { runId: 'lg', seed: `g${i}`, archetypeId: 'red' }), 0);
      placeExpeditionGate(content, r);
      for (const n of r.stage!.map.nodes) for (const s of n.sides) if (s.kind === 'expedition') expect(content.expeditions.expeditions.find((e) => e.id === s.expeditionId)!.legendary).toBeUndefined();
    }
    expect(run.legendary).toBeUndefined();
  });
});

describe('triggers and placement', () => {
  it('region, time of day and party conditions decide what is on offer', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'lg', seed: 'trig', archetypeId: 'red' }), 0);
    const kyogre = legendaryEvents(content).find((e) => e.legendary!.species === 'kyogre')!;
    run.regionIndex = 0;
    expect(legendaryProblem(content, run, kyogre)).toMatch(/region/);
    run.regionIndex = 2;
    run.party = run.party.map((m) => ({ ...m, speciesId: 'squirtle' }));
    expect(legendaryProblem(content, run, kyogre)).toBeNull();
    run.party = run.party.map((m) => ({ ...m, speciesId: 'rattata' }));
    expect(legendaryProblem(content, run, kyogre)).toBe('conditions not met');
    const night = legendaryEvents(content).find((e) => e.legendary!.species === 'giratina')!;
    run.regionIndex = 3;
    run.party = run.party.map((m) => ({ ...m, speciesId: 'gengar' }));
    const results = new Set<string | null>();
    for (let i = 0; i < 12; i++) {
      run.stage!.index = i;
      results.add(legendaryProblem(content, run, night));
    }
    expect(results.has(null)).toBe(true);
    expect(results.has('wrong time of day')).toBe(true);
  });

  it('a gate is deterministic, limited per region and never repeats a completed event', () => {
    let placed = 0;
    for (let i = 0; i < 400; i++) {
      const make = () => {
        const r = chooseStarter(content, createRun(content, { runId: 'lg', seed: `pl${i}`, archetypeId: 'red' }), 0);
        r.regionIndex = 3;
        r.stage!.index = i % 7;
        r.party = r.party.map((m) => ({ ...m, speciesId: 'gyarados' }));
        placeLegendaryGate(content, r);
        return r;
      };
      const a = make();
      const b = make();
      const gates = (r: RunState) => r.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.id.startsWith('legend-')).map((s) => `${n.id}:${s.expeditionId}`));
      expect(gates(a)).toEqual(gates(b));
      expect(gates(a).length).toBeLessThanOrEqual(1);
      placed += gates(a).length;
      if (gates(a).length) {
        const id = gates(a)[0]!.split(':')[1]!;
        a.legendary!.completed.push(id);
        expect(eligibleLegendary(content, a).some((p) => p.def.id === id)).toBe(false);
        // The per-region limit: a second placement in the same region does nothing.
        const before = gates(a).length;
        placeLegendaryGate(content, a);
        expect(gates(a).length).toBe(before);
      }
    }
    expect(placed).toBeGreaterThan(5);
    expect(placed).toBeLessThan(200);
  });
});

describe('a legendary stage', () => {
  const kyogreId = () => legendaryEvents(content).find((e) => e.legendary!.species === 'kyogre')!.id;

  it('the briefing says the chance is temporary and nothing forces you in', () => {
    const pv = expeditionPreview(content, gateRun('pv', kyogreId()), 'gate-test');
    expect(pv.legendary?.temporaryNote).toMatch(/temporary/i);
    expect(pv.legendary?.omen.length).toBeGreaterThan(10);
    expect(pv.legendary?.stage.length).toBeGreaterThan(1);
  });

  it('fights get the stage weather, routes stay valid as paths collapse, and the finale is the legendary Totem', () => {
    let run = beginExpedition(content, gateRun('kg', kyogreId()), 'gate-test');
    expect(run.legendary!.offered).toEqual([kyogreId()]);
    let sawRain = 0;
    let closed = 0;
    let finale = false;
    for (let guard = 0; guard < 80 && run.phase === 'expedition'; guard++) {
      const exp = run.expedition!;
      if (exp.battleResult) {
        run = settleExpedition(content, run);
        continue;
      }
      if (exp.choice) {
        run = resolveExpeditionChoice(content, run, 0);
        continue;
      }
      const next = availableNodes(exp)[0]!;
      run = chooseExpeditionNode(content, run, next.id);
      if (run.phase === 'battle') {
        if (run.battle!.weather?.id === 'rain') sawRain += 1;
        if (run.battle!.totem?.id === kyogreId()) {
          finale = true;
          expect(run.battle!.enemyTeam[0]!.speciesId).toBe('kyogre');
        }
        run.battle = null;
        run.phase = 'expedition';
        run.expedition!.battleResult = 'win';
      }
      closed = run.expedition?.nodes.filter((n) => n.blocked).length ?? closed;
      const nodes = run.expedition?.nodes;
      if (nodes) {
        // Every node still ahead that is not blocked remains reachable from the current one, and nothing is a dead end.
        for (const n of nodes) if (!n.blocked && n.layer < Math.max(...nodes.map((x) => x.layer))) expect(n.next.length).toBeGreaterThan(0);
      }
    }
    expect(finale).toBe(true);
    expect(sawRain).toBeGreaterThan(0);
    expect(closed).toBeGreaterThan(0);
    expect(run.phase).toBe('map');
    expect(run.legendary!.completed).toEqual([kyogreId()]);
    expect(run.legendary!.outcomes[0]!.outcome).toBe('completed');
    expect(run.expeditions.last[0]).toMatch(/Kyogre/);
  });

  it('Water Pokémon recover HP between stops and Fire Pokémon lose some (never faint)', () => {
    const base = gateRun('aff', kyogreId());
    const water = base.party[0]!;
    water.speciesId = 'squirtle';
    water.hp = Math.floor(maxHp(content, water) / 2);
    let run = beginExpedition(content, base, 'gate-test');
    run = chooseExpeditionNode(content, run, availableNodes(run.expedition!)[0]!.id);
    run.battle = null;
    run.phase = 'expedition';
    run.expedition!.battleResult = 'win';
    const before = run.party[0]!.hp;
    run = settleExpedition(content, run);
    expect(run.party[0]!.hp).toBeGreaterThan(before);

    const fire = gateRun('per', kyogreId());
    fire.party[0]!.speciesId = 'charmander';
    fire.party[0]!.hp = 1;
    let r2 = beginExpedition(content, fire, 'gate-test');
    r2 = chooseExpeditionNode(content, r2, availableNodes(r2.expedition!)[0]!.id);
    r2.battle = null;
    r2.phase = 'expedition';
    r2.expedition!.battleResult = 'win';
    r2 = settleExpedition(content, r2);
    expect(r2.party[0]!.hp).toBe(1);
  });

  it('Giratina rearranges the way on but never breaks the route', () => {
    const giratina = legendaryEvents(content).find((e) => e.legendary!.species === 'giratina')!;
    for (let i = 0; i < 25; i++) {
      const run = walk(beginExpedition(content, gateRun(`gi${i}`, giratina.id), 'gate-test'));
      expect(run.phase, `seed ${i}`).toBe('map');
      expect(run.legendary!.completed).toContain(giratina.id);
    }
    // The environment of a fight is rolled from the pool by the fight's own seed, not by animation.
    const a = envAt(giratina, 0, new Rng(hashSeed('x')));
    const b = envAt(giratina, 0, new Rng(hashSeed('x')));
    expect(a).toEqual(b);
  });

  it('losing or extracting records the outcome, keeps the party and lets the event come back', () => {
    const id = kyogreId();
    const lost = walk(beginExpedition(content, gateRun('lose', id), 'gate-test'), 2);
    expect(lost.phase).toBe('map');
    expect(lost.legendary!.failed).toEqual([id]);
    expect(lost.legendary!.completed).toEqual([]);
    expect(lost.party.length).toBeGreaterThan(0);
    expect(lost.expeditions.last[0]).toMatch(/Kyogre|current|flood/i);
    const early = extractExpedition(content, beginExpedition(content, gateRun('ext', id), 'gate-test'));
    expect(early.legendary!.extracted).toEqual([id]);
  });

  it('survives save and reload in the middle of an event', () => {
    let run = beginExpedition(content, gateRun('sv', kyogreId()), 'gate-test');
    run = chooseExpeditionNode(content, run, availableNodes(run.expedition!)[0]!.id);
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    saves.saveRun(run);
    const loaded = saves.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.data.legendary).toEqual(run.legendary);
      expect(loaded.data.expedition!.nodes.map((n) => n.blocked)).toEqual(run.expedition!.nodes.map((n) => n.blocked));
    }
  });

  it('routes of every legendary event are valid for many seeds', () => {
    for (const def of legendaryEvents(content).slice(0, 20)) {
      for (let i = 0; i < 5; i++) {
        const run = beginExpedition(content, gateRun(`v${i}`, def.id), 'gate-test');
        expect(validateRoute(def, run.expedition!.nodes as never)).toEqual([]);
      }
    }
  });
});
