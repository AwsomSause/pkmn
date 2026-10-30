// Game events (Untitled doc §17, plan Part 4b): weekly rotation by ISO week, yearly windows,
// themed rules, objectives and rewards that pay once, and saves.

import { describe, expect, it } from 'vitest';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { eligibleEvents } from '../../src/core/events';
import { activeGameEvents, awardGameEvents, editionKey, isoWeek, objectiveViews, rewardEarned, weeklyEventOn, weeklyRotation } from '../../src/core/gameEvents';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const NOW = '2026-10-30T12:00:00.000Z';
const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function runIn(editions: string[], seed = 'ge'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId: 'red', gameEvents: editions }), 0);
}

function finished(editions: string[], counters: Record<string, number>, seed: string): RunState {
  const run = runIn(editions, seed);
  run.log.counters = { ...run.log.counters, ...counters };
  run.phase = 'over';
  return run;
}

describe('the calendar', () => {
  it('works out ISO weeks, including the ones that cross a new year', () => {
    expect(isoWeek(at('2021-01-03')).label).toBe('2020-W53');
    expect(isoWeek(at('2024-12-30')).label).toBe('2025-W01');
    expect(isoWeek(at('2026-10-30')).label).toBe('2026-W44');
  });

  it('rotates one weekly event per week, the same all week, every event in turn', () => {
    const weekly = weeklyRotation(content);
    expect(weekly.length).toBeGreaterThanOrEqual(8);
    expect(weeklyEventOn(content, at('2026-10-26'))!.id).toBe(weeklyEventOn(content, at('2026-11-01'))!.id);
    expect(weeklyEventOn(content, at('2026-11-02'))!.id).not.toBe(weeklyEventOn(content, at('2026-11-01'))!.id);
    const seen = new Set<string>();
    for (let w = 0; w < weekly.length; w++) seen.add(weeklyEventOn(content, new Date(at('2026-10-26').getTime() + w * 7 * 86_400_000))!.id);
    expect(seen.size).toBe(weekly.length);
    const active = activeGameEvents(content, at('2026-10-30'));
    expect(active[0]!.edition).toBe(`${active[0]!.event.id}@2026-W44`);
    expect(active[0]!.endsIn).toBeLessThanOrEqual(7 * 86_400_000);
  });

  it('shows a yearly event only inside its window, wrapping the new year', () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    const base = raw.gameEvents.events[0];
    raw.gameEvents.events.push({ ...base, id: 'winter-test', kind: 'holiday', schedule: { kind: 'yearly', start: '12-20', end: '01-05' }, seedRule: 'year' });
    const c = buildContent(raw);
    const has = (d: string) => activeGameEvents(c, at(d)).some((a) => a.event.id === 'winter-test');
    expect(has('2026-12-19')).toBe(false);
    expect(has('2026-12-20')).toBe(true);
    expect(has('2027-01-05')).toBe(true);
    expect(has('2027-01-06')).toBe(false);
    expect(editionKey(c.gameEvents.get('winter-test')!, at('2027-01-02'))).toBe('winter-test@2026');
  });
});

describe('runs during an event', () => {
  it("play by the event's rules and remember the edition, the same after a reload", () => {
    const event = content.gameEvents.get('catch-carnival')!;
    const run = runIn(['catch-carnival@2026-W44']);
    expect(run.gameEvents).toEqual(['catch-carnival@2026-W44']);
    expect(run.perkEffects).toEqual(event.modifiers);
    expect(runIn([]).perkEffects).toEqual([]);
    expect(JSON.stringify(runIn(['catch-carnival@2026-W44'], 'same'))).toBe(JSON.stringify(runIn(['catch-carnival@2026-W44'], 'same')));
  });

  it("an event's own map events only appear in runs started while it is on", () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    raw.events.events.find((e: any) => e.id === 'haunted-house').gameEvent = 'rivalry-week';
    const c = buildContent(raw);
    const run = (ed: string[]) => chooseStarter(c, createRun(c, { runId: 'r', seed: 'own', archetypeId: 'red', gameEvents: ed }), 0);
    expect(eligibleEvents(c, run([])).some((e) => e.id === 'haunted-house')).toBe(false);
    expect(eligibleEvents(c, run(['rivalry-week@2026-W44'])).some((e) => e.id === 'haunted-house')).toBe(true);
  });
});

describe('objectives and rewards', () => {
  it('counts every run of the edition, pays each objective once and the event reward once', () => {
    const ed = 'gym-circuit@2026-W44';
    let p = createProfile(content, 'p');
    p = finalizeRun(content, p, finished([ed], { gymLeadersDefeated: 3 }, 'a'), NOW).profile;
    expect(objectiveViews(p, content.gameEvents.get('gym-circuit')!, ed).map((v) => v.done)).toEqual([true, false, false]);
    const result = finalizeRun(content, p, finished([ed], { gymLeadersDefeated: 5 }, 'b'), NOW);
    p = result.profile;
    expect(p.gameEvents[ed]!.gymLeadersDefeated).toBe(8);
    expect(result.summary!.gameEvents[0]!.objectives.map((o) => o.id)).toEqual(['five-badges', 'eight-badges']);
    expect(result.summary!.gameEvents[0]!.final).toMatchObject({ fallback: false });
    expect(rewardEarned(p, 'gym-circuit')).toBe(true);
    expect(p.titles).toContain('Circuit Champion');
    expect(p.unlockedPools).toContain('league-kanto');
    // The same run again pays nothing; a later edition pays the fallback once.
    expect(finalizeRun(content, p, finished([ed], { gymLeadersDefeated: 5 }, 'b'), NOW).applied).toBe(false);
    const rp = p.researchPoints;
    const later = finalizeRun(content, p, finished(['gym-circuit@2027-W10'], { gymLeadersDefeated: 8 }, 'c'), NOW);
    expect(later.summary!.gameEvents[0]!.final).toMatchObject({ fallback: true });
    expect(later.profile.researchPoints).toBeGreaterThan(rp);
    const again = later.profile;
    expect(awardGameEvents(content, again, finished(['gym-circuit@2027-W10'], { gymLeadersDefeated: 8 }, 'd'), { gymLeadersDefeated: 8 }, NOW)).toEqual([]);
  });

  it('a run outside every event counts for none', () => {
    const p = finalizeRun(content, createProfile(content, 'p'), finished([], { gymLeadersDefeated: 8 }, 'none'), NOW).profile;
    expect(p.gameEvents).toEqual({});
  });
});

describe('game events in saves', () => {
  it('a version 9 profile loads with no event progress', () => {
    const storage = new MemoryStorageProvider();
    const { gameEvents: _g, ...old } = createProfile(content, 'old');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 9, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('old');
    expect(profile.gameEvents).toEqual({});
    expect(CURRENT_VERSIONS.profile).toBeGreaterThanOrEqual(10);
  });

  it('a version 20 run loads in no game event', () => {
    const storage = new MemoryStorageProvider();
    const { gameEvents: _g, ...old } = runIn(['rivalry-week@2026-W44'], 'save20');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 20, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(20);
    expect(loaded.data.gameEvents).toEqual([]);
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(21);
  });
});
