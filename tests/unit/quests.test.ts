// Trainer quests (plan Part 2b), the claim ledger (Part 0) and Run Quests.

import { describe, expect, it } from 'vitest';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { awardQuestSteps, claim, evolutionUnlocked, pickRunQuest, questLineView, runQuestProgress, stepsDone } from '../../src/core/quests';
import { chooseStarter, createRun } from '../../src/core/run';
import type { Profile, RunState } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const NOW = '2026-10-30T12:00:00.000Z';

function newRun(seed = 'quests', archetypeId = 'misty'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId }), 0);
}

/** A finished run with these counters, played as the trainer. */
function finished(seed: string, archetypeId: string, counters: Record<string, number>): RunState {
  const run = newRun(seed, archetypeId);
  run.log.counters = { ...run.log.counters, ...counters };
  run.phase = 'over';
  return run;
}

describe('quest data', () => {
  it('gives every trainer a five-step line; only the special trainers end in a Trainer Evolution', () => {
    const special = ['red', 'blue', 'cynthia', 'giovanni', 'n', 'oak'];
    for (const a of content.archetypes.values()) {
      const line = content.questLines.get(a.id);
      expect(line, a.id).toBeDefined();
      expect(line!.steps).toHaveLength(5);
      expect(line!.steps[4]!.reward.evolution, a.id).toBe(special.includes(a.id));
    }
    expect(content.runQuests.size).toBeGreaterThanOrEqual(20);
  });
});

describe('the claim ledger', () => {
  it('pays a key once', () => {
    const p = createProfile(content, 'p');
    expect(claim(p, 'quest:misty:1', NOW)).toBe(true);
    expect(claim(p, 'quest:misty:1', NOW)).toBe(false);
    expect(Object.keys(p.claims)).toEqual(['quest:misty:1']);
  });
});

describe('quest lines', () => {
  it('counts only runs played as that trainer, claims steps in order and pays once', () => {
    let p: Profile = createProfile(content, 'p');
    // Brock's run counts nothing for Misty.
    p = finalizeRun(content, p, finished('a', 'brock', { 'defeatedOrCaught.water': 30 }), NOW).profile;
    expect(stepsDone(content, p, 'misty')).toBe(0);
    const before = p.researchPoints;
    const result = finalizeRun(content, p, finished('b', 'misty', { 'defeatedOrCaught.water': 30 }), NOW);
    p = result.profile;
    expect(stepsDone(content, p, 'misty')).toBe(1);
    expect(result.summary!.questSteps.map((s) => s.index)).toEqual([0]);
    expect(p.titles).toContain('Cerulean Hopeful');
    expect(p.researchPoints).toBeGreaterThanOrEqual(before + 50);
    // Awarding again pays nothing more.
    const rp = p.researchPoints;
    expect(awardQuestSteps(content, p, 'misty', NOW)).toEqual([]);
    expect(p.researchPoints).toBe(rp);
  });

  it('never skips a step: a later step that is met waits for the earlier one', () => {
    let p: Profile = createProfile(content, 'p');
    // Misty step 3 (3 Water-led boss wins) is met, but step 1 isn't.
    p = finalizeRun(content, p, finished('c', 'misty', { 'bossWinsLead.water': 5 }), NOW).profile;
    expect(stepsDone(content, p, 'misty')).toBe(0);
    expect(questLineView(content, p, 'misty')!.steps[2]!.progress.met).toBe(true);
  });

  it('a special trainer finishing the line unlocks the Trainer Evolution', () => {
    let p: Profile = createProfile(content, 'p');
    p = finalizeRun(content, p, finished('d', 'red', { battlesWon: 40, runQuestsDone: 3, gymLeadersDefeated: 8, evolutions: 4, championsDefeated: 1 }), NOW).profile;
    expect(questLineView(content, p, 'red')!.steps.map((s) => s.progress.met)).toEqual([true, true, true, true, true]);
    expect(stepsDone(content, p, 'red')).toBe(5);
    expect(evolutionUnlocked(p, 'red')).toBe(true);
    expect(p.unlockedPools).toContain('trainer-red');
  });

  it('a reloaded profile keeps its claims', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const p = finalizeRun(content, createProfile(content, 'p'), finished('e', 'misty', { 'defeatedOrCaught.water': 30 }), NOW).profile;
    saves.saveProfile(p);
    const { profile: loaded } = saves.loadOrCreateProfile(() => 'new');
    expect(loaded.profileId).toBe('p');
    expect(stepsDone(content, loaded, 'misty')).toBe(1);
    expect(awardQuestSteps(content, loaded, 'misty', NOW)).toEqual([]);
  });
});

describe('Run Quests', () => {
  it('each run gets one from its seed, the same every time', () => {
    expect(newRun('rq').runQuest).toBe(pickRunQuest(content, 'rq'));
    expect(newRun('rq').runQuest).not.toBeNull();
  });

  it('finishing it pays Research Points and counts for quest lines', () => {
    const run = newRun('rq-done');
    const quest = content.runQuests.get(run.runQuest!)!;
    run.log.counters[quest.counter] = quest.atLeast;
    run.phase = 'over';
    expect(runQuestProgress(content, run)!.met).toBe(true);
    const { profile, summary } = finalizeRun(content, createProfile(content, 'p'), run, NOW);
    expect(summary!.runQuestDone?.id).toBe(quest.id);
    expect(profile.counters.runQuestsDone).toBe(1);
    expect(profile.trainerCounters.misty!.runQuestsDone).toBe(1);
  });
});

describe('quests in saves', () => {
  it('a version 7 profile loads with an empty claim ledger', () => {
    const storage = new MemoryStorageProvider();
    const { claims: _c, trainerCounters: _t, trainerBest: _b, ...old } = createProfile(content, 'old');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 7, savedAt: '', data: old }));
    const { profile: loaded, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(loaded.profileId).toBe('old');
    expect(loaded.claims).toEqual({});
    expect(CURRENT_VERSIONS.profile).toBe(8);
  });

  it('a version 17 run loads with no Run Quest', () => {
    const storage = new MemoryStorageProvider();
    const { runQuest: _q, ...old } = newRun('save17');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 17, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(17);
    expect(loaded.data.runQuest).toBeNull();
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(18);
  });
});
