import { describe, expect, it } from 'vitest';
import { activeGameEvents } from '../../src/core/gameEvents';
import { slotCard } from '../../src/core/presentation/slotLines';
import { createRun, chooseStarter } from '../../src/core/run';
import { GameSession } from '../../src/game/GameSession';
import { ACTIVE_SLOT_KEY, CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider, type StorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const startRun = (session: GameSession, seed: string, rules?: Parameters<GameSession['newRun']>[4]) => {
  session.newRun('red', seed, undefined, undefined, rules);
  session.chooseStarter(0);
};

describe('three save slots', () => {
  it('slot 1 keeps the original keys, so every older save is slot 1', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    startRun(session, 'slot-1');
    expect(session.slot).toBe(1);
    expect(storage.get('pkr.run')).not.toBeNull();
    expect(storage.get('pkr.s2.run')).toBeNull();
    expect(new GameSession(content, storage).canContinue).toBe(true);
  });

  it('slots are independent: a run, profile and timeline in one never show in another', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    startRun(session, 'one');
    const runOne = storage.get('pkr.run');
    session.switchSlot(2);
    expect(session.canContinue).toBe(false);
    expect(session.profile.stats.runsStarted).toBe(0);
    startRun(session, 'two');
    expect(storage.get('pkr.s2.run')).not.toBeNull();
    expect(storage.get('pkr.run')).toBe(runOne); // untouched
    expect(session.profile.stats.runsStarted).toBe(1);
    session.switchSlot(1);
    expect(session.run).toBeNull();
    expect(session.canContinue).toBe(true);
    expect(session.continueRun().seed).toBe('one');
    session.switchSlot(2);
    expect(session.continueRun().seed).toBe('two');
  });

  it('the settings are shared by every slot', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    session.switchSlot(3);
    expect(storage.keys().some((k) => k.startsWith('pkr.s3.settings'))).toBe(false);
  });

  it('the slot in use is remembered across a reload', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    session.switchSlot(3);
    expect(storage.get(ACTIVE_SLOT_KEY)).toBe('3');
    expect(new GameSession(content, storage).slot).toBe(3);
    storage.set(ACTIVE_SLOT_KEY, 'banana');
    expect(new GameSession(content, storage).slot).toBe(1);
  });

  it('looking at a slot writes nothing to it', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    const before = storage.keys().sort();
    const peeks = session.slotPeeks();
    expect(peeks.map((p) => p.slot)).toEqual([1, 2, 3]);
    expect(storage.keys().sort()).toEqual(before);
    expect(slotCard(content, peeks[1]!).status).toBe('empty');
  });

  it('Continue picks the slot saved most recently', () => {
    let tick = 0;
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    session.saves = new SaveManager(storage, content, () => new Date(Date.UTC(2026, 0, 1, 0, tick++)), 1);
    startRun(session, 'old');
    session.switchSlot(2);
    session.saves = new SaveManager(storage, content, () => new Date(Date.UTC(2026, 0, 2, 0, tick++)), 2);
    startRun(session, 'new');
    expect(session.latestRunSlot()).toBe(2);
    session.switchSlot(1);
    expect(session.latestRunSlot()).toBe(2);
    expect(slotCard(content, session.slotPeeks()[0]!)).toMatchObject({ status: 'active', slot: 1 });
  });

  it('deleting a slot empties only that slot and keeps a copy', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    startRun(session, 'keep');
    session.switchSlot(2);
    startRun(session, 'drop');
    const dropped = storage.get('pkr.s2.run');
    expect(session.deleteSlot(2)).toEqual({ ok: true });
    expect(session.canContinue).toBe(false);
    expect(storage.get('pkr.s2.deleted.run')).toBe(dropped);
    session.switchSlot(1);
    expect(session.continueRun().seed).toBe('keep');
    // Deleting a slot you are not in leaves the one in use alone.
    expect(session.deleteSlot(3)).toEqual({ ok: true });
    expect(session.canContinue).toBe(true);
  });

  it('a damaged slot is reported, not lost, and does not break the others', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    startRun(session, 'fine');
    storage.set('pkr.s3.profile', '{broken');
    const cards = session.slotPeeks().map((p) => slotCard(content, p));
    expect(cards.map((c) => c.status)).toEqual(['active', 'empty', 'damaged']);
    expect(storage.get('pkr.s3.profile')).toBe('{broken');
  });

  it('a write that did not stick is reported as a failed save', () => {
    const storage = new MemoryStorageProvider();
    const lossy: StorageProvider = { name: 'lossy', get: (k) => storage.get(k), set: (k, v) => storage.set(k, v.slice(0, 20)), remove: (k) => storage.remove(k) };
    const saves = new SaveManager(lossy, content);
    const result = saves.saveRun(chooseStarter(content, createRun(content, { runId: 'r', seed: 's', archetypeId: 'red' }), 0));
    expect(result.ok).toBe(false);
  });
});

describe('Weeks toggle', () => {
  const editions = () => activeGameEvents(content, new Date()).map((a) => a.edition);

  it('is on by default: the events on now apply and the choice is stored in the run', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    session.newRun('red', 'weeks-on');
    expect(session.run!.rules.weeks).toBe(true);
    expect(session.run!.gameEvents).toEqual(editions());
  });

  it('off: no event edition applies, the choice survives save and reload, and the run keeps going', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    startRun(session, 'weeks-off', { modeId: 'standard', difficultyId: 'standard', modifierIds: [], deathBlock: false, weeks: false });
    expect(session.run!.rules.weeks).toBe(false);
    expect(session.run!.gameEvents).toEqual([]);
    const resumed = new GameSession(content, storage).continueRun();
    expect(resumed.rules.weeks).toBe(false);
    expect(resumed.gameEvents).toEqual([]);
  });

  it('runs saved before the toggle load with Weeks on (migration v30)', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    session.newRun('red', 'old');
    const env = JSON.parse(storage.get('pkr.run')!);
    delete env.data.rules.weeks;
    env.schemaVersion = 29;
    storage.set('pkr.run', JSON.stringify(env));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.migratedFrom).toBe(29);
      expect(loaded.data.rules.weeks).toBe(true);
    }
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(30);
  });
});
