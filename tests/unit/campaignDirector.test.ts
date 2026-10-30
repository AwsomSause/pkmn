// The Campaign Director (Electric §4): acts, region focus, recap and route labels.

import { describe, expect, it } from 'vitest';
import { ACTS, FOCUSES, actOf, focusDenBonus, recapRegion, regionFocus, routeKind, tellAct } from '../../src/core/campaign/director';
import { validateStageMap } from '../../src/core/map';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

function fresh(seed: string) {
  return structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
}

describe('Campaign Director', () => {
  it('a region has one focus, fixed by the seed, and regions differ across seeds', () => {
    const run = fresh('dir-focus');
    expect(regionFocus(run, 0)).toBe(regionFocus(run, 0));
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(regionFocus({ seed: `s${i}`, regionOrder: run.regionOrder }, 0));
    expect(seen.size).toBeGreaterThan(1);
    for (const f of seen) expect(FOCUSES).toContain(f);
    expect(focusDenBonus(run, 'raids') + focusDenBonus(run, 'exploration')).toBeLessThanOrEqual(0.2);
  });

  it('acts run Arrival to Climax through a region and the league is the climax', () => {
    const run = fresh('dir-acts');
    expect(actOf(content, run)).toBe('arrival');
    const last = ACTS.indexOf('climax');
    expect(last).toBeGreaterThan(0);
    run.stage!.index = 99;
    expect(actOf(content, run)).toBe('climax');
    run.stage!.kind = 'league';
    expect(actOf(content, run)).toBe('climax');
  });

  it('the act is told once, and the recap once per region', () => {
    const run = fresh('dir-tell');
    const count = () => run.story.chronicle.filter((c) => c.text.startsWith('Act ')).length;
    const before = count();
    tellAct(content, run);
    tellAct(content, run);
    expect(count()).toBe(before);
    run.stage!.index = 99;
    run.stage!.kind = 'league';
    tellAct(content, run);
    tellAct(content, run);
    expect(count()).toBe(before + 1);
    recapRegion(content, run);
    recapRegion(content, run);
    expect(run.story.chronicle.filter((c) => c.text.startsWith('Act V')).length).toBe(1);
  });

  it('routes are labelled by what they promise, and every generated map stays completable', () => {
    const run = fresh('dir-route');
    const node = run.stage!.map.nodes[0]!;
    expect(routeKind(run, { ...node, harder: true, sides: [] })).toBe('highRisk');
    expect(routeKind(run, { ...node, harder: false, kind: 'wild', sides: [{ id: 'x', kind: 'heal', used: false }] })).toBe('safe');
    expect(routeKind(run, { ...node, harder: false, kind: 'wild', sides: [{ id: 'x', kind: 'event', used: false }] })).toBe('mystery');
    expect(routeKind(run, { ...node, harder: false, kind: 'wild', sides: [{ id: 'x', kind: 'raid', raidId: 'storm-sovereign-contact', used: false }] })).toBe('story');
    for (let i = 0; i < 60; i++) expect(validateStageMap(fresh(`dir-map-${i}`).stage!.map)).toEqual([]);
  });
});
