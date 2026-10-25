import { describe, expect, it } from 'vitest';
import { finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import { GameSession } from '../../src/game/GameSession';
import { CURRENT_VERSIONS, MIGRATIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider, StorageUnavailableError, type StorageProvider } from '../../src/save/storage';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

function makeRun() {
  return chooseStarter(content, createRun(content, { runId: 'run-a', seed: 'save-seed', archetypeId: 'green' }), 0);
}

describe('save manager', () => {
  it('round-trips a run exactly', () => {
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    const run = makeRun();
    expect(saves.saveRun(run)).toEqual({ ok: true });
    const loaded = saves.loadRun();
    expect(loaded).toEqual({ status: 'ok', data: run });
  });

  it('reports "none" when there is no save', () => {
    expect(new SaveManager(new MemoryStorageProvider(), content).loadRun()).toEqual({ status: 'none' });
  });

  it('detects malformed JSON and damaged data', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    storage.set('pkr.run', '{not json');
    expect(saves.loadRun().status).toBe('corrupt');
    saves.saveRun(makeRun());
    const env = JSON.parse(storage.get('pkr.run')!);
    env.data.party[0].level = 'high';
    storage.set('pkr.run', JSON.stringify(env));
    expect(saves.loadRun().status).toBe('corrupt');
  });

  it('detects references to content that no longer exists', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    saves.saveRun(makeRun());
    const env = JSON.parse(storage.get('pkr.run')!);
    env.data.party[0].speciesId = 'missingno';
    storage.set('pkr.run', JSON.stringify(env));
    const result = saves.loadRun();
    expect(result.status).toBe('corrupt');
  });

  it('refuses saves from a newer game version', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    saves.saveRun(makeRun());
    const env = JSON.parse(storage.get('pkr.run')!);
    env.schemaVersion = CURRENT_VERSIONS.run + 1;
    storage.set('pkr.run', JSON.stringify(env));
    expect(saves.loadRun().status).toBe('incompatible');
  });

  it('runs migrations for older saves', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const original = CURRENT_VERSIONS.settings;
    CURRENT_VERSIONS.settings = 2;
    MIGRATIONS.settings[1] = (data) => ({ ...(data as object), muted: true });
    try {
      storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 1, savedAt: '', data: { musicVolume: 0.1, sfxVolume: 0.2, muted: false } }));
      expect(saves.loadSettings()).toEqual({ musicVolume: 0.1, sfxVolume: 0.2, muted: true });
    } finally {
      CURRENT_VERSIONS.settings = original;
      delete MIGRATIONS.settings[1];
    }
  });

  it('reports a failed write instead of crashing', () => {
    const broken: StorageProvider = {
      name: 'broken',
      get: () => null,
      set: () => { throw new StorageUnavailableError('full'); },
      remove: () => {},
    };
    expect(new SaveManager(broken, content).saveRun(makeRun())).toEqual({ ok: false, reason: 'full' });
  });

  it('backs up a damaged profile instead of deleting it', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.profile', 'garbage');
    const saves = new SaveManager(storage, content);
    const { profile, warning } = saves.loadOrCreateProfile(() => 'new-profile');
    expect(profile.profileId).toBe('new-profile');
    expect(warning).toMatch(/could not be loaded/);
    expect(storage.keys().some((k) => k.startsWith('pkr.profile.corrupt.'))).toBe(true);
  });
});

describe('profile and run end', () => {
  it('finalizing the same run twice only counts it once', () => {
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    const { profile } = saves.loadOrCreateProfile(() => 'p');
    const run = makeRun();
    const first = finalizeRun(profile, run);
    const second = finalizeRun(first.profile, run);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.profile.stats.runsEnded).toBe(1);
  });

  it('a defeat ends the run but keeps the permanent profile', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    session.newRun('red', 'defeat-seed');
    session.chooseStarter(0);
    session.run!.party[0]!.hp = 1;
    session.run!.battle!.enemyTeam = [createPokemon(content, 'growlithe', 40, 'e-big')];
    let guard = 0;
    while (session.run!.phase === 'battle' && guard++ < 50) {
      session.takeTurn({ kind: 'move', index: session.run!.party[0]!.moves.findIndex((m) => m.pp > 0) });
    }
    expect(session.run!.phase).toBe('over');
    expect(storage.get('pkr.run')).toBeNull();
    const reloaded = new GameSession(content, storage);
    expect(reloaded.profile.stats.runsStarted).toBe(1);
    expect(reloaded.profile.stats.runsEnded).toBe(1);
    expect(reloaded.profile.unlockedArchetypes).toEqual(['red', 'blue', 'green']);
  });
});

describe('game session save/load', () => {
  it('continue resumes exactly where the player left off', () => {
    const storage = new MemoryStorageProvider();
    const a = new GameSession(content, storage);
    a.newRun('blue', 'continue-seed');
    a.chooseStarter(1);
    a.takeTurn({ kind: 'move', index: 0 });
    const b = new GameSession(content, storage);
    expect(b.canContinue).toBe(true);
    expect(b.continueRun()).toEqual(a.run);
  });

  it('reloading after choosing a reward does not grant it again', () => {
    const storage = new MemoryStorageProvider();
    const a = new GameSession(content, storage);
    a.newRun('red', 'reward-seed');
    a.chooseStarter(0);
    a.run!.party[0] = createPokemon(content, a.run!.party[0]!.speciesId, 40, a.run!.party[0]!.uid);
    while (a.run!.phase === 'battle') a.takeTurn({ kind: 'move', index: a.run!.party[0]!.moves.findIndex((m) => m.pp > 0) });
    expect(a.run!.phase).toBe('reward');
    a.chooseReward(0);
    const moneyAfter = a.run!.money;
    const b = new GameSession(content, storage);
    const resumed = b.continueRun();
    expect(resumed.phase).toBe('battle');
    expect(resumed.log.rewardsTaken).toHaveLength(1);
    expect(resumed.money).toBe(moneyAfter);
  });

  it('reloading during the reward screen shows the same five rewards', () => {
    const storage = new MemoryStorageProvider();
    const a = new GameSession(content, storage);
    a.newRun('red', 'same-draft');
    a.chooseStarter(0);
    a.run!.party[0] = createPokemon(content, a.run!.party[0]!.speciesId, 40, a.run!.party[0]!.uid);
    while (a.run!.phase === 'battle') a.takeTurn({ kind: 'move', index: a.run!.party[0]!.moves.findIndex((m) => m.pp > 0) });
    const b = new GameSession(content, storage);
    expect(b.continueRun().draft).toEqual(a.run!.draft);
  });
});
