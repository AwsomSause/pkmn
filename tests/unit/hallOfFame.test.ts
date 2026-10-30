// The Hall of Fame: built from the Run History, which now keeps epitaphs, Legacy Cards and shinies.

import { describe, expect, it } from 'vitest';
import { hallOfFame } from '../../src/core/hallOfFame';
import { createPokemon } from '../../src/core/pokemon';
import { createProfile } from '../../src/core/profile';
import { applyRunToProfile } from '../../src/core/progress';
import { chooseStarter, createRun } from '../../src/core/run';
import { RunRecordSchema, type RunRecord } from '../../src/core/state';
import { advanceChains } from '../../src/core/story/chains';
import { legacyCard } from '../../src/core/story/legacy';
import { answerMentorship, planMentorship } from '../../src/core/story/mentorship';
import { openHistory } from '../../src/core/story/record';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const record = (over: Partial<RunRecord>): RunRecord => ({
  runId: 'r', endedAt: '2026-10-30T00:00:00Z', seed: 's', archetypeId: 'red', campaignId: 'c', victory: false, regionsCleared: 0, regions: 1, badges: 0, encounters: 10,
  defeatedBy: null, party: [], bankCredits: 0, researchPoints: 0, achievements: [], moments: [], journal: [], epitaph: null, legacy: [], ...over,
});
const mon = (speciesId: string, shiny = false) => ({ speciesId, level: 50, shiny });

describe('Hall of Fame', () => {
  it('lists champion teams, unusual wins, shinies, legends and records', () => {
    const p = createProfile(content, 'hof');
    p.runHistory = [
      record({ runId: 'a', victory: true, encounters: 40, badges: 8, party: [mon('pikachu'), mon('onix', true)], epitaph: 'Pikachu carried this journey.' }),
      record({ runId: 'b', victory: true, encounters: 55, badges: 8, party: [mon('a'), mon('b'), mon('c'), mon('d')], legacy: [{ speciesId: 'd', level: 50, shiny: false, titles: ['The Unbroken'], tags: ['Run Ace'], signature: 'Held on at 1 HP', mentor: null, records: [] }] }),
      record({ runId: 'c', victory: false, badges: 3, legacy: [{ speciesId: 'e', level: 20, shiny: false, titles: [], tags: [], signature: null, mentor: null, records: [] }] }),
    ];
    const hof = hallOfFame(p);
    expect(hof.champions.map((r) => r.runId)).toEqual(['a', 'b']);
    expect(hof.unusual).toEqual([{ run: p.runHistory[0], why: 'won with only 2 Pokémon, fastest win (40 encounters), a shiny on the team' }]);
    expect(hof.rareForms.map((f) => f.speciesId)).toEqual(['onix']);
    expect(hof.legends.map((l) => l.card.speciesId)).toEqual(['d']);
    expect(hof.records.find((r) => r.label === 'Fastest win')!.value).toBe('40 encounters');
    expect(hof.records.find((r) => r.label === 'Most badges in a run')!.value).toBe('8');
  });

  it('is empty but valid with no runs', () => {
    const hof = hallOfFame(createProfile(content, 'empty'));
    expect(hof.champions).toEqual([]);
    expect(hof.records.find((r) => r.label === 'Fastest win')!.value).toBe('—');
  });

  it('a version 11 profile keeps its Run History, with no epitaphs, cards or shinies', () => {
    const storage = new MemoryStorageProvider();
    const old = createProfile(content, 'old') as Record<string, unknown>;
    const { epitaph: _e, legacy: _l, party: _p, ...run } = record({ runId: 'old-run', victory: true });
    old.runHistory = [{ ...run, party: [{ speciesId: 'pikachu', level: 40 }] }];
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 11, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.runHistory[0]).toMatchObject({ runId: 'old-run', epitaph: null, legacy: [], party: [{ speciesId: 'pikachu', level: 40, shiny: false }] });
    expect(CURRENT_VERSIONS.profile).toBeGreaterThanOrEqual(12);
  });

  it("a protégé's card carries its mentor, and finishing The Long Gauntlet gives a Legacy Record", () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'leg', seed: 'leg', archetypeId: 'red' }), 0));
    const mentor = run.party[0]!;
    mentor.level = 40;
    const rookie = createPokemon(content, 'rattata', 20, 'rookie');
    run.party.push(rookie);
    openHistory(content, run, rookie.uid, rookie.speciesId, 'caught');
    Object.assign(run.story.histories[mentor.uid]!, { battles: 12, bossesBeaten: 2 });
    answerMentorship(content, run, planMentorship(content, run)!, true);
    for (const step of ['second-wind', 'not-given-up', 'turned-pain']) advanceChains(content, run, step, rookie.uid);
    const card = legacyCard(content, run, rookie.uid)!;
    expect(card.mentor).toBe(mentor.speciesId);
    expect(card.records).toEqual(['The Long Gauntlet']);
    expect(legacyCard(content, run, mentor.uid)!).toMatchObject({ mentor: null, records: [] });
  });

  it('Legacy Records are permanent: their runs are never trimmed from the history', () => {
    const p = createProfile(content, 'perm');
    const held = record({ runId: 'held', legacy: [{ speciesId: 'onix', level: 30, shiny: false, titles: ['The Long Gauntlet'], tags: [], signature: null, mentor: null, records: ['The Long Gauntlet'] }] });
    p.runHistory = [held, ...Array.from({ length: content.balance.runHistorySize }, (_, i) => record({ runId: `old${i}` }))];
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'new', seed: 'new', archetypeId: 'red' }), 0));
    applyRunToProfile(content, p, run, '2026-10-30T01:00:00Z');
    expect(p.runHistory[0]!.runId).toBe('new');
    expect(p.runHistory.some((r) => r.runId === 'held')).toBe(true);
    expect(hallOfFame(p).legacyRecords).toEqual([{ run: held, card: held.legacy[0], record: 'The Long Gauntlet' }]);
  });

  it('a Legacy Card saved before mentors and records loads with none', () => {
    const old = record({ legacy: [] }) as Record<string, unknown>;
    old.legacy = [{ speciesId: 'd', level: 50, shiny: false, titles: [], tags: [], signature: null }];
    expect(RunRecordSchema.parse(old).legacy[0]).toMatchObject({ mentor: null, records: [] });
  });
});
