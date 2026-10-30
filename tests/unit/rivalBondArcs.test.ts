// The 19 bond and Overdrive character arcs (Examples section 7 E-F).

import { describe, expect, it } from 'vitest';
import { startTriggeredArc, triggerFits, triggeredArc } from '../../src/core/rivals/arcs';
import { RIVAL_ARCS } from '../../src/core/rivals/schema';
import { simulateRivalWorld } from '../../src/core/rivals/world';
import { chooseStarter, createRun } from '../../src/core/run';
import type { Bond, Rival } from '../../src/core/story/schema';
import { content } from './helpers';

const traits = { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 };
const bond = (over: Partial<Bond> = {}): Bond => ({ trust: 50, affection: 50, respect: 50, synchronization: 50, confidence: 50, autonomy: 50, strain: 10, sharedHistory: 0, hyperReadiness: 0, trait: 'brave', habits: {}, recent: [], ...over }) as Bond;
const rival = (over: Partial<Rival> = {}): Rival => ({
  id: 'r', classId: 'youngster', name: 'R', archetype: 'proud', style: 'rush', traits: { ...traits }, rivalPotential: 10, state: 'active', arc: null, away: 0, cooldown: 0, progress: 0,
  encounters: 1, setbacks: 0, adaptations: [], bonds: {}, offscreen: [], origin: { eventId: 'e', where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'x' },
  memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 0.5, turns: 5, team: ['rattata', 'pidgey'] } }, ...over,
}) as Rival;

const ids = RIVAL_ARCS.arcs.filter((a) => a.trigger).map((a) => a.id);

/** A rival built to fit exactly one arc's trigger. */
function fitting(id: string): Rival {
  const t = RIVAL_ARCS.arcs.find((a) => a.id === id)!.trigger!;
  const mid = (r: readonly [number, number]) => (r[1] >= 100 ? r[0] + 5 : r[0] <= 0 ? r[1] - 5 : Math.round((r[0] + r[1]) / 2));
  const b = bond(Object.fromEntries(Object.entries(t.bond ?? {}).map(([k, r]) => [k, k === 'sharedHistory' ? r[0] : Math.max(r[0], Math.min(r[1], mid(r)))])) as Partial<Bond>);
  if (t.traits) b.trait = t.traits[0]!;
  const bonds: Record<string, Bond> = { rattata: b };
  if (t.gap) { bonds.rattata = { ...b, [t.gap.dim]: 90 } as Bond; bonds.pidgey = { ...b, [t.gap.dim]: 10 } as Bond; }
  return rival({ bonds, progress: t.minProgress ?? 0, setbacks: t.minSetbacks ?? 0, traits: { ...traits, ...Object.fromEntries(Object.entries(t.rival ?? {}).map(([k, r]) => [k, mid(r)])) } });
}

describe('bond and Overdrive arcs', () => {
  it('there are 9 bond arcs and 10 Overdrive arcs with triggers, all in the catalog', () => {
    expect(ids).toHaveLength(19);
  });
  for (const id of ids) {
    it(`${id} fits its own trigger and starts`, () => {
      const r = fitting(id);
      const arc = RIVAL_ARCS.arcs.find((a) => a.id === id)!;
      expect(triggerFits(r, arc)).toBe(true);
      expect(triggeredArc(r)).toBeDefined();
    });
  }
  it('a rival with no bonds never gets one, and a finished arc is not repeated', () => {
    expect(triggeredArc(rival())).toBeUndefined();
    const r = fitting('overdrive-addict');
    r.arcsDone = ids;
    expect(triggeredArc(r)).toBeUndefined();
  });
  it('a running arc is not replaced, a finished one makes way for the new arc', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ba', seed: 'ba', archetypeId: 'red' }), 0));
    const r = fitting('overdrive-addict');
    r.arc = { id: 'prodigy-learns-humility', stage: 1, ticks: 2, resolution: null };
    expect(startTriggeredArc(content, run, r)).toBeNull();
    r.arc.resolution = 'good';
    const started = startTriggeredArc(content, run, r);
    expect(started).not.toBeNull();
    expect(r.arc.id).toBe(started!.id);
    expect(r.arcsDone).toContain('prodigy-learns-humility');
  });
  it('the living world gives rivals bond arcs across seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const run = structuredClone(chooseStarter(content, createRun(content, { runId: `bw${i}`, seed: `bw${i}`, archetypeId: 'red' }), 0));
      run.story.rivals = [rival({ id: `r${i}`, traits: { ...traits, ambition: 40 + (i % 50), pride: 30 + (i % 60) } })];
      for (let s = 0; s < 14; s++) {
        run.stage!.index = s;
        simulateRivalWorld(content, run);
        if (run.story.rivals[0]!.arc && ids.includes(run.story.rivals[0]!.arc.id)) seen.add(run.story.rivals[0]!.arc.id);
        for (const d of run.story.rivals[0]!.arcsDone ?? []) if (ids.includes(d)) seen.add(d);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});
