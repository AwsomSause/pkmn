// Run save v25 -> v26 (party personality & chemistry): an older run loads with an empty partyLife.
import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { createPartyLife } from '../../src/core/partyLife';

describe('run save v26', () => {
  it('a version 25 run loads with no pair chemistry, grudges or scrapbook', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'v26', seed: 'v26', archetypeId: 'red' }), 0));
    const { partyLife: _p, ...old } = run;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 25, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(25);
    expect(loaded.data.partyLife).toEqual(createPartyLife());
  });
});
