// Legacy runs (M9): every finished run leaves one immutable record on the profile (v14).

import { describe, expect, it } from 'vitest';
import { buildLegacyRun, legacyAce, legacyInteraction, legacyRotation, legacyRunStart, legacyScore, LEGACY_RUNS, pickAce, recordLegacyRun, rememberedDefeat, rivalHallOfFame, viewRandom } from '../../src/core/legacyRuns';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import { LegacyRunSchema, ProfileSchema, type LegacyRun, type RunRecord } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const NOW = '2026-10-31T02:00:00Z';
const started = (id: string) => structuredClone(chooseStarter(content, createRun(content, { runId: id, seed: id, archetypeId: 'red' }), 0));
const history = (over: Partial<RunRecord>): RunRecord => ({
  runId: 'h', endedAt: '2026-10-30T00:00:00Z', seed: 's', archetypeId: 'red', campaignId: 'full', victory: false, regionsCleared: 1, regions: 3, badges: 4, encounters: 30,
  defeatedBy: { speciesId: 'onix', level: 30, trainer: 'Brock' }, party: [{ speciesId: 'pikachu', level: 30, shiny: false }, { speciesId: 'onix', level: 34, shiny: true }],
  bankCredits: 0, researchPoints: 0, achievements: [], moments: ['A close call.'], journal: ['Stage 1'], epitaph: 'Gone too soon.', legacy: [], ...over,
});

describe('legacy runs', () => {
  it('records a finished run once, with what it needs to rebuild its start', () => {
    const run = started('leg-a');
    run.log.defeatedBy = { speciesId: 'geodude', level: 12, trainer: null };
    const { profile } = finalizeRun(content, createProfile(content, 'p'), run, NOW);
    expect(profile.legacyRuns).toHaveLength(1);
    const rec = profile.legacyRuns[0]!;
    expect(LegacyRunSchema.parse(rec)).toEqual(rec);
    expect(rec).toMatchObject({ format: 1, source: 'run', runId: 'leg-a', seed: 'leg-a', archetypeId: 'red', outcome: 'defeat', endedAt: NOW });
    expect(rec.starter!.speciesId).toBe(run.party[0]!.speciesId);
    expect(rec.starter!.choices).toEqual(run.starterChoices);
    expect(rec.regionOrder).toEqual(run.regionOrder);
    expect(rec.team[0]).toMatchObject({ uid: run.party[0]!.uid, starter: true });
    expect(rec.aceUid).toBe(run.party[0]!.uid);
    expect(rec.moments.map((m) => m.kind)).toEqual(['runEnding']);
    expect(rec.epitaph).toBe(profile.runHistory[0]!.epitaph);
    expect(legacyRunStart(rec)).toMatchObject({ seed: 'leg-a', archetypeId: 'red', starter: run.party[0]!.speciesId, regionOrder: run.regionOrder });
    // The same run finalized again changes nothing.
    expect(finalizeRun(content, profile, run, NOW).applied).toBe(false);
    expect(recordLegacyRun(content, profile, run, '2027-01-01T00:00:00Z')).toBeNull();
    expect(profile.legacyRuns[0]!.endedAt).toBe(NOW);
  });

  it('is deterministic and frozen once kept', () => {
    const run = started('leg-b');
    expect(buildLegacyRun(content, run, NOW)).toEqual(buildLegacyRun(content, structuredClone(run), NOW));
    const p = createProfile(content, 'p');
    const rec = recordLegacyRun(content, p, run, NOW)!;
    expect(Object.isFrozen(rec) && Object.isFrozen(rec.team)).toBe(true);
    expect(() => {
      (rec.team as unknown as unknown[]).push({});
    }).toThrow();
  });

  it('notes the champion win, legendaries, rivals and survival moments', () => {
    const run = started('leg-c');
    const uid = run.party[0]!.uid;
    run.victory = true;
    run.badges = ['brock'];
    run.log.speciesSeen.push('mewtwo');
    run.log.speciesCaught.push('mewtwo');
    Object.assign(run.story.histories[uid]!, { survivedFatal: 2, longestLowHpStand: LEGACY_RUNS.moments.minLowHpStand });
    const rec = buildLegacyRun(content, run, NOW);
    expect(rec.outcome).toBe('victory');
    expect(rec.legendaries).toEqual({ seen: ['mewtwo'], caught: ['mewtwo'] });
    expect(rec.moments.map((m) => m.kind)).toEqual(['firstGym', 'firstLegendary', 'finalStanding', 'lastSecond', 'championVictory']);
    expect(rec.stats.survivedFatal).toBe(2);
    expect(rec.finalBattle).toMatchObject({ result: 'win' });
  });

  it('picks the Ace by knockouts, bosses and level; the first slot wins a tie', () => {
    const base = { shiny: false, moves: [], abilitySlot: 0, nature: null, held: [], starter: false, titles: [] };
    const a = { ...base, uid: 'a', speciesId: 'a', level: 50, knockouts: 0, bossesBeaten: 0 };
    const b = { ...base, uid: 'b', speciesId: 'b', level: 20, knockouts: 10, bossesBeaten: 2 };
    expect(pickAce([a, b])!.uid).toBe('b');
    expect(pickAce([a, { ...a, uid: 'a2' }])!.uid).toBe('a');
    expect(pickAce([])).toBeNull();
  });

  it('keeps at most the cap, newest first', () => {
    const p = createProfile(content, 'p');
    for (let i = 0; i < LEGACY_RUNS.recordCap + 2; i++) recordLegacyRun(content, p, started(`cap${i}`), NOW);
    expect(p.legacyRuns).toHaveLength(LEGACY_RUNS.recordCap);
    expect(p.legacyRuns[0]!.runId).toBe(`cap${LEGACY_RUNS.recordCap + 1}`);
  });

  it('a clean version 13 profile migrates every Run History entry', () => {
    const storage = new MemoryStorageProvider();
    const old = createProfile(content, 'old') as Record<string, unknown>;
    delete old.legacyRuns;
    old.runHistory = [history({ runId: 'old-1' }), history({ runId: 'old-2', victory: true, defeatedBy: null })];
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 13, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.runHistory).toHaveLength(2);
    const [a, b] = profile.legacyRuns;
    expect(a).toMatchObject({ source: 'history', runId: 'old-1', outcome: 'defeat', prep: null, epitaph: 'Gone too soon.', bosses: { gym: 4, elite: 0, champion: 0 } });
    expect(legacyAce(a!)!.speciesId).toBe('onix');
    expect(a!.moments[0]!.kind).toBe('runEnding');
    expect(b).toMatchObject({ outcome: 'victory', bosses: { champion: 1 } });
    expect(legacyRunStart(a!)).toBeNull();
    expect(ProfileSchema.parse(profile).legacyRuns).toHaveLength(2);
  });

  const rec = (id: string, over: Partial<LegacyRun> = {}): LegacyRun => ({ ...buildLegacyRun(content, started(id), NOW), ...over });
  const rival = (over: Partial<LegacyRun['rivals'][number]> = {}): LegacyRun['rivals'][number] => ({ id: 'rv', name: 'Gary', classId: 'youngster', archetype: 'a', state: 'active', encounters: 3, setbacks: 0, lastResult: 'win', resolution: null, team: ['pidgey'], rank: null, ...over });

  it('scores a run by the §1.2 weights', () => {
    const w = LEGACY_RUNS.score;
    const plain = rec('s1', { encounters: 0 });
    const base = legacyScore(content, plain);
    expect(legacyScore(content, { ...plain, outcome: 'victory', bosses: { gym: 8, elite: 4, champion: 1 } })).toBe(base + w.campaign + 8 * w.gymLeader + 4 * w.eliteFour + w.champion);
    expect(legacyScore(content, { ...plain, rivals: [rival()] })).toBe(base + w.rivalDefeated);
    expect(legacyScore(content, { ...plain, legendaries: { seen: ['mewtwo'], caught: ['mewtwo'] } })).toBe(base + w.legendary);
    expect(legacyScore(content, { ...plain, encounters: 40 })).toBe(Math.round(base + 40 * w.perEncounter));
  });

  it('rotates up to six Trainers: the run in progress first, weighted but not just the top six, same seed same list', () => {
    const records = Array.from({ length: 12 }, (_, i) => rec(`r${i}`, { encounters: i * 10 }));
    const current = started('now');
    const a = legacyRotation(content, records, { seed: 'x', current });
    expect(a).toHaveLength(LEGACY_RUNS.rotation.size);
    expect(a[0]).toMatchObject({ current: true, runId: 'now', outcome: 'inProgress' });
    expect(new Set(a.map((e) => e.runId)).size).toBe(a.length);
    expect(legacyRotation(content, records, { seed: 'x', current })).toEqual(a);
    const picks = new Set<string>();
    for (let s = 0; s < 40; s++) for (const e of legacyRotation(content, records, { seed: `s${s}` })) picks.add(e.runId);
    expect(picks.size).toBeGreaterThan(6);
    // A run on cooldown shows up far less often.
    const shown = (cooldown: string[]) => Array.from({ length: 200 }, (_, s) => legacyRotation(content, records.slice(0, 8), { seed: `c${s}`, cooldown })).filter((l) => l.some((e) => e.runId === 'r0')).length;
    expect(shown(['r0'])).toBeLessThan(shown([]));
    expect(legacyRotation(content, [], { seed: 'x' })).toEqual([]);
  });

  it('legacy interactions are rare and fit the past Trainer', () => {
    const lines = LEGACY_RUNS.interactions.lines;
    const champ = rec('i1', { outcome: 'victory', bosses: { gym: 8, elite: 4, champion: 1 } });
    expect(legacyInteraction(champ, [], 0.99)).toBeNull();
    expect(legacyInteraction(champ, [], 0)).toBe(lines.champion);
    expect(legacyInteraction(champ, [champ.team[0]!.speciesId], 0)).toBe(lines.samePokemon);
    expect(legacyInteraction(rec('i2', { rivals: [rival()], defeatedBy: { speciesId: 'pidgey', level: 9, trainer: 'Gary' } }), [], 0)).toBe(lines.rivalEnding);
    expect(legacyInteraction(rec('i3', { encounters: LEGACY_RUNS.interactions.longRunEncounters }), [], 0)).toBe(lines.longRun);
  });

  it('the world remembers how the last run ended', () => {
    const lines = LEGACY_RUNS.defeats.lines;
    const lost = rec('d1', { outcome: 'defeat', defeatedBy: { speciesId: 'onix', level: 14, trainer: null } });
    const next = { archetypeId: lost.archetypeId, now: NOW };
    expect(rememberedDefeat(content, [lost], next, 0.99)).toBeNull();
    expect(rememberedDefeat(content, [{ ...lost, outcome: 'victory' }], next, 0)).toBeNull();
    expect(rememberedDefeat(content, [{ ...lost, rivals: [rival()], defeatedBy: { speciesId: 'pidgey', level: 9, trainer: 'Gary' } }], next, 0)).toBe(lines.rival.replace('{rival}', 'Gary'));
    expect(rememberedDefeat(content, [lost], { ...next, now: '2027-03-01T00:00:00Z' }, 0)).toBe(lines.absent);
    expect(rememberedDefeat(content, [{ ...lost, regionReached: lost.regionOrder.length - 1 }], next, 0)).toBe(lines.close);
    expect(rememberedDefeat(content, [lost], { ...next, archetypeId: 'someone-else' }, 0)).toBe(lines.different);
    expect(rememberedDefeat(content, [lost], next, 0)).toContain('Onix');
    expect(rememberedDefeat(content, [], next, 0)).toBeNull();
  });

  it('the Rival Hall of Fame lists ranked rivals first, then the deepest rivalries', () => {
    const a = rec('h1', { rivals: [rival({ name: 'Low', encounters: 1 }), rival({ name: 'Deep', encounters: 6, lastResult: 'lose' })] });
    const b = rec('h2', { rivals: [rival({ name: 'Champ', rank: 'champion', encounters: 2 })] });
    const fame = rivalHallOfFame([a, b]);
    expect(fame.map((f) => f.name)).toEqual(['Champ', 'Deep']);
    expect(fame[0]).toMatchObject({ title: 'champion', signature: 'pidgey', defeatedByYou: true });
    expect(fame[1]).toMatchObject({ defeatedByYou: false, encounters: 6 });
  });

  it('presentation randomness is its own seeded generator', () => {
    const a = viewRandom('k');
    const b = viewRandom('k');
    expect([a(), a()]).toEqual([b(), b()]);
  });
});
