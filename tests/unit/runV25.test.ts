// Run save v24 -> v25 (Nemesis): an older run loads with an empty nemesis list.
import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';

describe('run save v25', () => {
  it('a version 24 run loads with no nemeses', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'v25', seed: 'v25', archetypeId: 'red' }), 0));
    const { nemeses: _n, ...story } = run.story as typeof run.story & { nemeses?: unknown };
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 24, savedAt: '', data: { ...run, story } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(24);
    expect((loaded.data.story as { nemeses?: unknown[] }).nemeses).toEqual([]);
  });
});
