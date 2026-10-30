// Rival Scheduler, account archive and legacy layer (Living Rivalry doc §11-13).

import { describe, expect, it } from 'vitest';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { RIVAL_SEEN_ANY, rivalSeenFlag, scheduleKey, waitingRival } from '../../src/core/rivals/adapt';
import { applyLegacy, archiveRivals, legacyLine, pickLegacyRival } from '../../src/core/rivals/legacy';
import { RIVAL_CONFIG } from '../../src/core/rivals/schema';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { ArchivedRivalSchema, type Rival } from '../../src/core/story/schema';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const traits = { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 };
function rival(id: string, over: Partial<Rival> = {}): Rival {
  return {
    id, classId: 'youngster', name: id, archetype: 'proud', style: 'rush', traits: { ...traits }, rivalPotential: 10, state: 'recurring', arc: null, away: 0, cooldown: 0, progress: 0,
    encounters: 3, setbacks: 0, adaptations: [], bonds: {}, offscreen: [], origin: { eventId: `e-${id}`, where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'spark' },
    memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 0.8, turns: 5, team: [] } }, ...over,
  } as Rival;
}
function runWith(rivals: Rival[], region = 0, stage = 3): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'sch', seed: 'sch', archetypeId: 'red' }), 0));
  run.story.rivals = rivals;
  run.regionIndex = region;
  run.stage!.index = stage;
  return run;
}

describe('Rival Scheduler', () => {
  it('a rival that has not come back since its Spark may return at once', () => {
    expect(waitingRival(runWith([rival('a')]))?.id).toBe('a');
  });
  it('waits by ladder state: a recurring rival sits out 3 stages, a nemesis 4, a background name never returns', () => {
    const run = runWith([rival('a')], 0, 3);
    run.story.flags[rivalSeenFlag('a')] = scheduleKey({ regionIndex: 0, stage: { index: 1 } as never });
    expect(waitingRival(run)).toBeNull(); // 2 stages later: too soon for a recurring rival
    run.stage!.index = 4;
    expect(waitingRival(run)?.id).toBe('a');
    const nemesis = runWith([rival('n', { state: 'nemesis' })], 0, 4);
    nemesis.story.flags[rivalSeenFlag('n')] = 0;
    nemesis.stage!.index = 3;
    expect(waitingRival(nemesis)).toBeNull();
    nemesis.stage!.index = 4;
    expect(waitingRival(nemesis)?.id).toBe('n');
    const bg = runWith([rival('b', { state: 'recognized' })], 2, 3);
    bg.story.flags[rivalSeenFlag('b')] = 0;
    expect(waitingRival(bg)).toBeNull();
  });
  it('no rival appears in the stage right after another one, and the stronger rivalry goes first', () => {
    const run = runWith([rival('low', { state: 'recurring' }), rival('high', { state: 'contender', rivalPotential: 40 })]);
    expect(waitingRival(run)?.id).toBe('high');
    run.story.flags[RIVAL_SEEN_ANY] = scheduleKey(run);
    expect(waitingRival(run)).toBeNull();
    run.story.flags[RIVAL_SEEN_ANY] = scheduleKey(run) - RIVAL_CONFIG.scheduler.anyGap;
    expect(waitingRival(run)?.id).toBe('high');
  });
});

describe('rival archive and legacy layer', () => {
  it('archives a finished run\'s rivals once and keeps only the newest', () => {
    const profile = createProfile(content, 'p1');
    const run = runWith([rival('keep', { encounters: 3 }), rival('skip', { encounters: 0 })]);
    archiveRivals(profile, run);
    archiveRivals(profile, run);
    expect(profile.rivalArchive.map((a) => a.name)).toEqual(['keep']);
    expect(ArchivedRivalSchema.safeParse(profile.rivalArchive[0]).success).toBe(true);
    for (let i = 0; i < RIVAL_CONFIG.legacy.archiveMax + 5; i++) archiveRivals(profile, { ...runWith([rival(`r${i}`)]), runId: `run${i}` } as RunState);
    expect(profile.rivalArchive).toHaveLength(RIVAL_CONFIG.legacy.archiveMax);
  });
  it('finalizing a run archives its rivals exactly once', () => {
    const run = runWith([rival('legend', { state: 'nemesis' })]);
    run.phase = 'over';
    const first = finalizeRun(content, createProfile(content, 'p1'), run);
    expect(first.profile.rivalArchive.map((a) => a.name)).toEqual(['legend']);
    expect(finalizeRun(content, first.profile, run).applied).toBe(false);
  });
  it('picks a legend from the seed only, from strong archived rivals only, and shapes one new rival once', () => {
    const archive = [
      { runId: 'o', name: 'Old Rival', classId: 'ace', archetype: 'proud', style: 'wall', traits: { ...traits, pride: 100 }, state: 'nemesis', encounters: 5, resolution: null },
      { runId: 'o2', name: 'Weak', classId: 'ace', archetype: 'proud', style: 'wall', traits, state: 'recognized', encounters: 5, resolution: null },
    ];
    let picked = 0;
    for (let i = 0; i < 100; i++) {
      const a = pickLegacyRival(archive, `seed${i}`);
      expect(pickLegacyRival(archive, `seed${i}`)).toEqual(a);
      if (a) { picked++; expect(a.name).toBe('Old Rival'); }
    }
    expect(picked).toBeGreaterThan(10);
    expect(picked).toBeLessThan(80);
    const run = runWith([]);
    run.legacyRival = archive[0]! as never;
    const first = rival('first', { legacyOf: undefined });
    applyLegacy(run, first);
    expect(first.legacyOf).toBe('Old Rival');
    expect(first.style).toBe('wall');
    expect(first.traits.pride).toBeGreaterThan(50);
    expect(legacyLine(first)).toMatch(/Old Rival/);
    const second = rival('second');
    applyLegacy(run, second);
    expect(second.legacyOf).toBeUndefined();
    expect(archive[0]!.traits.pride).toBe(100);
  });
  it('an old profile without an archive loads with an empty one', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const profile = createProfile(content, 'p1');
    const { rivalArchive: _drop, ...old } = profile as unknown as Record<string, unknown>;
    saves.saveProfile(old as never);
    const loaded = saves.loadOrCreateProfile(() => 'fresh');
    expect(loaded.profile.rivalArchive).toEqual([]);
    expect(loaded.warning ?? '').toBe('');
  });
});
