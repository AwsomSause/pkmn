// Story Overhaul F0: save bumps (profile v20, run v40, settings v39), the story containers, name sanitizing and the data loader.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { buildContent } from '../../src/data';
import { freshProfileStory, graphemeCount, romanceEnabled, sanitizeName, STORY_SETTINGS_DEFAULTS, StoryDataSchema } from '../../src/core/story2/schema';
import { CURRENT_VERSIONS, DEFAULT_SETTINGS, MIGRATIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const envelope = (record: string, v: number, data: unknown) => JSON.stringify({ format: 'pkmn-roguelike', record, schemaVersion: v, savedAt: '', data });
const profileOf = () => new SaveManager(new MemoryStorageProvider(), content).loadOrCreateProfile(() => 'p1').profile;

describe('save versions', () => {
  it('are profile 20, run 40, settings 40 and every step has a migration', () => {
    expect(CURRENT_VERSIONS).toMatchObject({ profile: 20, run: 40, settings: 40 });
    expect(MIGRATIONS.profile[19]).toBeTypeOf('function');
    expect(MIGRATIONS.run[39]).toBeTypeOf('function');
    expect(MIGRATIONS.settings[38]).toBeTypeOf('function');
  });
});

describe('profile v19 -> v20', () => {
  const old = () => {
    const { story: _s, ...rest } = profileOf();
    return rest;
  };
  it('profile_v19_loads_to_v20: story exists with defaults', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.profile', envelope('profile', 19, { ...old(), candies: 5 }));
    const { profile } = new SaveManager(storage, content).loadOrCreateProfile(() => 'x');
    expect(profile.story).toEqual(freshProfileStory());
    expect(profile.candies).toBe(5);
    expect(profile.profileId).toBe('p1');
  });
  it('profile_v20_lore_migrated: npcMemory.lore ids become known, and npcMemory is untouched', () => {
    const base = old();
    const npcMemory = { ...base.npcMemory, lore: ['lore_a', 'lore_b'] };
    const storage = new MemoryStorageProvider();
    storage.set('pkr.profile', envelope('profile', 19, { ...base, npcMemory }));
    const { profile } = new SaveManager(storage, content).loadOrCreateProfile(() => 'x');
    expect(profile.story.lore).toEqual({ lore_a: { state: 'known', sources: [] }, lore_b: { state: 'known', sources: [] } });
    expect(profile.npcMemory).toEqual(npcMemory);
  });
  it('profile_v20_roundtrip: save then load gives the same profile', () => {
    const sm = new SaveManager(new MemoryStorageProvider(), content);
    const profile = profileOf();
    profile.story.protagonist.name = 'Ash';
    profile.story.endingsSeen = ['e1'];
    sm.saveProfile(profile);
    expect(sm.loadOrCreateProfile(() => 'x').profile).toEqual(profile);
  });
  it('profile_v20_bad_story_object: a corrupt story falls back to defaults and the rest survives', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.profile', envelope('profile', 20, { ...profileOf(), candies: 9, story: { protagonist: 12, lore: 'nope' } }));
    const { profile } = new SaveManager(storage, content).loadOrCreateProfile(() => 'x');
    expect(profile.story).toEqual(freshProfileStory());
    expect(profile.candies).toBe(9);
    expect(profile.profileId).toBe('p1');
  });
  it('profile_v20_size_budget: a worst-case story object stays under 300 KB', () => {
    const story = freshProfileStory();
    for (let i = 0; i < 74; i++) story.remembrance[`r${i}`] = { state: 'unlocked', firstSeenRun: i, runs: 9, mastery: 3 };
    for (let i = 0; i < 200; i++) story.lore[`lore_entry_${i}`] = { state: 'verified', sources: ['s1', 's2', 's3', 's4'] };
    for (let i = 0; i < 90; i++) story.cast[`c${i}`] = { tellings: ['a', 'b', 'c', 'd', 'e', 'f'], wins: 3, losses: 3, runs: ['r1', 'r2'] };
    story.chronicles = Array.from({ length: 40 }, (_, i) => ({ runId: `run_${i}`, endedAt: '2026-11-06T00:00:00.000Z', victory: true, seed: 'seed', title: 'x'.repeat(80), stops: { done: 44, planned: 44 }, losses: 9, relationships: Object.fromEntries(Array.from({ length: 90 }, (_, j) => [`ch_character_${j}`, 'acquaintance'])), highlights: Array.from({ length: 12 }, (_, j) => `scene_${j}`) }));
    story.sceneSnapshots = Array.from({ length: 60 }, () => ({ text: 'x'.repeat(300) }));
    expect(JSON.stringify(story).length).toBeLessThan(300_000);
  });
});

describe('run v39 -> v40', () => {
  const run = () => structuredClone(chooseStarter(content, createRun(content, { runId: 'f0', seed: 'f0', archetypeId: 'red' }), 0));
  it('run_v39_loads_to_v40: an old run loads with no story.v2 and Classic play continues', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.run', envelope('run', 39, run()));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(39);
    expect(loaded.data.story.v2).toBeUndefined();
  });
  it('run_v40_story_roundtrip: a Story Run with v2 state saves and loads identically', () => {
    const r = run();
    r.story.v2 = { mode: 'story_run', contentHash: 'abc', heartbondOverrides: 1, autonomy: 'full', heartbond: { latched: [], pending: [], keystoneReady: false, ledger: [] }, dramatic: 'full', feats: { charge: 0, banked: 0, used: [], gains: [], armed: false, first: null }, sigMoves: [], sigNames: {}, cast: { dara: { stage: 'friend', attrs: { trust: 3 }, memories: ['m1'], flags: {}, gates: [], mem: [], scenes: 0, pending: null, last: null } }, arcs: {}, facts: { met_dara: true }, stops: { index: 2, planned: 44, done: ['s1', 's2'] }, replans: [], rel: {}, queue: [], scenesDone: [], rivalScene: null, notes: [], fired: [] };
    const sm = new SaveManager(new MemoryStorageProvider(), content);
    sm.saveRun(r);
    const again = sm.loadRun();
    expect(again.status === 'ok' && again.data).toEqual(r);
  });
});

describe('settings v38 -> v39', () => {
  it('settings_v38_loads_to_v39: story defaults added, old keys unchanged', () => {
    const { story: _s, ...old } = DEFAULT_SETTINGS;
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', envelope('settings', 38, { ...old, musicVolume: 0.1 }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded).toEqual({ ...DEFAULT_SETTINGS, musicVolume: 0.1 });
    expect(loaded.story).toEqual(STORY_SETTINGS_DEFAULTS);
  });
  it('settings_v39_romance_off: a stored "on" loads but romanceEnabled stays false while the balance flag is off', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', envelope('settings', 39, { ...DEFAULT_SETTINGS, story: { ...STORY_SETTINGS_DEFAULTS, romance: 'on' } }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded.story.romance).toBe('on');
    expect(romanceEnabled(loaded, false)).toBe(false);
    expect(romanceEnabled(loaded, true)).toBe(true);
  });
});

describe('migration_failure_keeps_raw', () => {
  it('a migration that throws reports incompatible and leaves the raw save untouched', () => {
    const storage = new MemoryStorageProvider();
    const original = MIGRATIONS.run[39]!;
    MIGRATIONS.run[39] = () => { throw new Error('boom'); };
    try {
      const text = envelope('run', 39, { not: 'a run' });
      storage.set('pkr.run', text);
      expect(new SaveManager(storage, content).loadRun().status).not.toBe('ok');
      expect(storage.get('pkr.run')).toBe(text);
    } finally {
      MIGRATIONS.run[39] = original;
    }
  });
});

describe('story data loader', () => {
  it('ships story data that validates, with a hash', () => {
    expect(content.storyData.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(() => buildContent()).not.toThrow();
  });
  it('rejects a bad record with a readable message', () => {
    const bad = StoryDataSchema.safeParse({ ...content.storyData, characters: [{ id: 'Bad Id' }] });
    expect(bad.success).toBe(false);
  });
});

describe('name sanitizing', () => {
  it('keeps normal names, accents, hyphens and apostrophes', () => {
    for (const n of ['Ash', 'Zoë', "D'Arcy", 'Mary-Jane', 'J. R.', '花子']) expect(sanitizeName(n)).toBe(n);
    expect(sanitizeName('  Ash   Ketchum ')).toBe('Ash Ketchum');
  });
  it('allows 16 grapheme clusters and rejects 17', () => {
    expect(sanitizeName('a'.repeat(16))).toBe('a'.repeat(16));
    expect(sanitizeName('a'.repeat(17))).toBeNull();
    expect(graphemeCount('👨‍👩‍👧')).toBe(1);
  });
  it('rejects markup, bidi, zero-width, control, empty and digits-only names', () => {
    for (const n of ['<b>x</b>', 'a{b}', '100%', 'a‮b', 'a‍b', 'a\u0000b', '', '   ', '12345', 'x'.repeat(10_000), 'a😀b']) expect(sanitizeName(n), JSON.stringify(n)).toBeNull();
  });
  it('never lets a hostile string through', () => {
    const rnd = (seed: number) => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const r = rnd(7);
    for (let i = 0; i < 5000; i++) {
      const s = Array.from({ length: 1 + Math.floor(r() * 24) }, () => String.fromCodePoint(Math.floor(r() * 0x3000))).join('');
      const out = sanitizeName(s);
      if (out !== null) {
        expect(graphemeCount(out)).toBeLessThanOrEqual(16);
        expect(out).not.toMatch(/[<>{}%\p{Cc}\p{Cf}]/u);
      }
    }
  });
});
