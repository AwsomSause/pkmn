// Run save v31 -> v31 (real-date celebrations): an older run knows no real-world date yet.
import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

describe('run save v31', () => {
  it('a version 30 run loads with no calendar date', () => {
    const storage = new MemoryStorageProvider();
    const { calendar: _c, ...old } = structuredClone(chooseStarter(content, createRun(content, { runId: 'v31', seed: 'v31', archetypeId: 'red' }), 0));
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 30, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(30);
    expect(loaded.data.calendar).toEqual({ today: null, startedOn: null });
  });
});
