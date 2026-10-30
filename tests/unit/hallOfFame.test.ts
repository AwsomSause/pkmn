// The Hall of Fame: built from the Run History, which now keeps epitaphs, Legacy Cards and shinies.

import { describe, expect, it } from 'vitest';
import { hallOfFame } from '../../src/core/hallOfFame';
import { createProfile } from '../../src/core/profile';
import type { RunRecord } from '../../src/core/state';
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
      record({ runId: 'b', victory: true, encounters: 55, badges: 8, party: [mon('a'), mon('b'), mon('c'), mon('d')], legacy: [{ speciesId: 'd', level: 50, shiny: false, titles: ['The Unbroken'], tags: ['Run Ace'], signature: 'Held on at 1 HP' }] }),
      record({ runId: 'c', victory: false, badges: 3, legacy: [{ speciesId: 'e', level: 20, shiny: false, titles: [], tags: [], signature: null }] }),
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

  it('an older (version 10) profile keeps its Run History, with no epitaphs, cards or shinies', () => {
    const storage = new MemoryStorageProvider();
    const old = createProfile(content, 'old') as Record<string, unknown>;
    const { epitaph: _e, legacy: _l, party: _p, ...run } = record({ runId: 'old-run', victory: true });
    old.runHistory = [{ ...run, party: [{ speciesId: 'pikachu', level: 40 }] }];
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 10, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.runHistory[0]).toMatchObject({ runId: 'old-run', epitaph: null, legacy: [], party: [{ speciesId: 'pikachu', level: 40, shiny: false }] });
    expect(CURRENT_VERSIONS.profile).toBeGreaterThanOrEqual(12);
  });
});
