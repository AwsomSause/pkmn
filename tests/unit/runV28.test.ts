// Run save v27 -> v28 (day counter): an older run loads with day 1 on the clock.
import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

describe('run save v28', () => {
  it('a version 27 run loads with the clock at day 1', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'v28', seed: 'v28', archetypeId: 'red' }), 0));
    const { clock: _c, ...old } = run;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 27, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(27);
    expect(loaded.data.clock).toEqual({ day: 1, tick: 0, celebrated: [] });
  });
});
