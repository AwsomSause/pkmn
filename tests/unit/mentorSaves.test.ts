// Run save v32 -> v33 and profile v14 -> v15 (mentors, spec section 15): older saves load with no mentor and no bonds.
import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { content } from './helpers';

describe('mentor saves', () => {
  it('a version 32 run loads with no mentor and no mentor on the Preparation Desk', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'm28', seed: 'm28', archetypeId: 'red' }), 0));
    const { mentor: _m, prep, ...rest } = run;
    const { mentorId: _id, ...oldPrep } = prep;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 32, savedAt: '', data: { ...rest, prep: oldPrep } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(32);
    expect(loaded.data.mentor).toBeNull();
    expect(loaded.data.prep.mentorId).toBeNull();
  });

  it('a version 14 profile loads with no mentor bonds', () => {
    const storage = new MemoryStorageProvider();
    const { mentorBonds: _b, ...old } = createProfile(content, 'p15');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 14, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('p15');
    expect(profile.mentorBonds).toEqual({});
  });
});
