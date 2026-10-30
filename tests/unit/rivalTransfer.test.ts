// Rival Pokémon transfer and the unscheduled challenge (Examples section 8).

import { describe, expect, it } from 'vitest';
import { interruptFlag, interruptingRival } from '../../src/core/rivals/interrupt';
import { RIVAL_WORLD } from '../../src/core/rivals/schema';
import { rivalTransfers } from '../../src/core/rivals/transfer';
import { chooseStarter, createRun, rivalChallenge } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import type { Bond, Rival } from '../../src/core/story/schema';
import { content } from './helpers';

const traits = { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 80, resilience: 50 };
const bond = (over: Partial<Bond> = {}): Bond => ({ trust: 60, affection: 50, respect: 50, synchronization: 50, confidence: 50, autonomy: 50, strain: 10, sharedHistory: 0, hyperReadiness: 0, trait: 'brave', habits: {}, recent: [], ...over }) as Bond;
const rival = (id: string, teamIds: string[], bonds: Record<string, Bond>, over: Partial<Rival> = {}): Rival => ({
  id, classId: 'youngster', name: id, archetype: 'proud', style: 'rush', traits: { ...traits }, rivalPotential: 30, state: 'nemesis', arc: null, away: 0, cooldown: 0, progress: 0,
  encounters: 2, setbacks: 0, adaptations: [], bonds, offscreen: [], origin: { eventId: `e-${id}`, where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'x' },
  memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 0.5, turns: 5, team: teamIds } }, ...over,
}) as Rival;
const baseRun = (seed: string): RunState => structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));

describe('rival Pokémon transfer', () => {
  it('releases a Pokémon that does not trust its trainer, keeps a minimum team, and drops its empathy', () => {
    let released = 0;
    for (let i = 0; i < 80; i++) {
      const run = baseRun(`rel${i}`);
      const r = rival('a', ['rattata', 'pidgey', 'caterpie'], { rattata: bond({ trust: 10, strain: 80 }), pidgey: bond(), caterpie: bond() });
      run.story.rivals = [r];
      const rumor = rivalTransfers(content, run, `0.${i}`);
      if (rumor) {
        released += 1;
        expect(r.memory.lastBattle.team).toEqual(['pidgey', 'caterpie']);
        expect(r.bonds.rattata).toBeUndefined();
        expect(r.traits.empathy).toBe(50 + RIVAL_WORLD.transfer.releaseEmpathy);
      }
    }
    expect(released).toBeGreaterThan(5);
    const run = baseRun('tiny');
    const r = rival('a', ['rattata', 'pidgey'], { rattata: bond({ trust: 10, strain: 80 }), pidgey: bond({ trust: 10, strain: 80 }) });
    run.story.rivals = [r];
    for (let i = 0; i < 40; i++) rivalTransfers(content, run, `0.${i}`);
    expect(r.memory.lastBattle.team).toHaveLength(2);
  });

  it('friends rehome a loved but strained Pokémon and trade; the bond travels with a trust cost', () => {
    const seen = { rehome: false, trade: false };
    for (let i = 0; i < 200 && !(seen.rehome && seen.trade); i++) {
      const run = baseRun(`tr${i}`);
      const a = rival('a', ['rattata', 'pidgey'], { rattata: bond({ affection: 90, strain: 70 }), pidgey: bond() });
      const b = rival('b', ['caterpie', 'weedle'], { caterpie: bond(), weedle: bond() });
      run.story.rivals = [a, b];
      run.story.rivalGraph = [{ a: 'a', b: 'b', kind: 'friends' }];
      const rumor = rivalTransfers(content, run, `1.${i}`);
      if (rumor?.includes('gave')) {
        seen.rehome = true;
        expect(b.memory.lastBattle.team).toContain('rattata');
        expect(a.memory.lastBattle.team).not.toContain('rattata');
        expect(b.bonds.rattata!.trust).toBe(60 - RIVAL_WORLD.transfer.tradeTrustLoss);
      }
      const c = rival('c', ['rattata', 'pidgey'], { rattata: bond(), pidgey: bond() });
      const d = rival('d', ['caterpie', 'weedle'], { caterpie: bond(), weedle: bond() });
      run.story.rivals = [c, d];
      run.story.rivalGraph = [{ a: 'c', b: 'd', kind: 'partners' }];
      if (rivalTransfers(content, run, `2.${i}`)?.includes('traded')) {
        seen.trade = true;
        expect(c.memory.lastBattle.team).toContain('caterpie');
        expect(d.memory.lastBattle.team).toContain('pidgey');
        expect(c.bonds.caterpie).toBeDefined();
      }
    }
    expect(seen).toEqual({ rehome: true, trade: true });
  });

  it('enemies never trade, and the result depends only on the seed', () => {
    const make = () => {
      const run = baseRun('same');
      run.story.rivals = [rival('a', ['rattata', 'pidgey'], { rattata: bond(), pidgey: bond() }), rival('b', ['caterpie', 'weedle'], { caterpie: bond(), weedle: bond() })];
      run.story.rivalGraph = [{ a: 'a', b: 'b', kind: 'enemies' }];
      for (let i = 0; i < 30; i++) rivalTransfers(content, run, `3.${i}`);
      return run.story.rivals.map((r) => r.memory.lastBattle.team);
    };
    expect(make()).toEqual([['rattata', 'pidgey'], ['caterpie', 'weedle']]);
  });
});

describe('unscheduled challenge', () => {
  function stopRun(seed: string) {
    const run = baseRun(seed);
    const stage = run.stage!;
    const node = stage.map.nodes.find((n) => n.kind === 'wild' || n.kind === 'trainer')!;
    node.sides.push({ id: 'ev1', kind: 'event', used: false, eventId: 'x' });
    stage.current = node.id;
    stage.visited.push(node.id);
    run.regionIndex = 0;
    stage.index = 3;
    run.story.rivals = [rival('r1', ['rattata', 'pidgey'], { rattata: bond(), pidgey: bond() })];
    return { run, node };
  }

  it('fires for a due driven rival on an event stop, once per stage, and leaves the stop unused', () => {
    let fired: RunState | null = null;
    for (let i = 0; i < 60 && !fired; i++) fired = rivalChallenge(content, stopRun(`ic${i}`).run, 'ev1');
    expect(fired).not.toBeNull();
    expect(fired!.phase).toBe('battle');
    expect(fired!.battle!.rivalId).toBe('r1');
    expect(fired!.battle!.rivalNote).toContain('cut in on you');
    expect(fired!.story.flags[interruptFlag(fired!)]).toBe('r1');
    expect(fired!.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'ev1')!.used).toBe(false);
    fired!.phase = 'map';
    expect(rivalChallenge(content, fired!, 'ev1')).toBeNull();
  });

  it('never fires for a calm rival, a boss node, the League or a used stop, and does not change the run when it does not fire', () => {
    for (let i = 0; i < 30; i++) {
      const calm = stopRun(`cm${i}`);
      calm.run.story.rivals[0]!.state = 'recognized';
      expect(rivalChallenge(content, calm.run, 'ev1')).toBeNull();
      const boss = stopRun(`bs${i}`);
      boss.node.kind = 'gym';
      expect(interruptingRival(content, boss.run, boss.node.sides[0]!)).toBeNull();
      const league = stopRun(`lg${i}`);
      league.run.stage!.kind = 'league';
      expect(interruptingRival(content, league.run, league.node.sides[0]!)).toBeNull();
      const used = stopRun(`us${i}`);
      used.node.sides[0]!.used = true;
      expect(interruptingRival(content, used.run, used.node.sides[0]!)).toBeNull();
    }
    const quiet = stopRun('quiet').run;
    const before = JSON.stringify(quiet);
    for (let i = 0; i < 5; i++) interruptingRival(content, quiet, quiet.stage!.map.nodes.flatMap((n) => n.sides)[0]!);
    expect(JSON.stringify(quiet)).toBe(before);
  });

  it('is deterministic for a seed', () => {
    const a = stopRun('det');
    const b = stopRun('det');
    expect(Boolean(interruptingRival(content, a.run, a.node.sides[0]!))).toBe(Boolean(interruptingRival(content, b.run, b.node.sides[0]!)));
  });
});
