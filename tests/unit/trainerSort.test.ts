// Trainer sorting: every key gives a stable, complete, repeatable order; game/region cover every trainer.

import { describe, expect, it } from 'vitest';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { createProfile } from '../../src/core/profile';
import { GAMES, REGIONS, sortTrainers, TRAINER_SORT_KEYS, trainerGame, trainerRegion } from '../../src/core/trainerSort';
import { content } from './helpers';

const all = [...content.archetypes.values()];
const byId = (id: string) => content.archetypes.get(id);
const profile = () => createProfile(content, 'sort-test');

describe('trainer sorting', () => {
  it('every key returns every trainer once, the same way each time', () => {
    for (const key of TRAINER_SORT_KEYS) {
      const a = sortTrainers(all, key, profile()).map((t) => t.id);
      expect(a).toHaveLength(all.length);
      expect(new Set(a).size).toBe(all.length);
      expect(sortTrainers(all, key, profile()).map((t) => t.id)).toEqual(a);
      expect(sortTrainers(all, key, profile(), true).map((t) => t.id)).toEqual([...a].reverse());
    }
  });

  it('default keeps data order', () => {
    expect(sortTrainers(all, 'default', profile()).map((t) => t.id)).toEqual(all.map((t) => t.id));
  });

  it('name is alphabetical', () => {
    const names = sortTrainers(all, 'name', profile()).map((t) => t.name);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)));
  });

  it('game and region group trainers in release order', () => {
    const games = sortTrainers(all, 'game', profile()).map((t) => GAMES.indexOf(trainerGame(t, byId)));
    expect(games).toEqual([...games].sort((x, y) => x - y));
    const regions = sortTrainers(all, 'region', profile()).map((t) => REGIONS.indexOf(trainerRegion(t, byId)));
    expect(regions).toEqual([...regions].sort((x, y) => x - y));
  });

  it('most trainers have a known game and region; evolutions follow their base', () => {
    const other = all.filter((t) => trainerGame(t, byId) === 'Other').map((t) => t.id);
    expect(other).toEqual([]);
    expect(trainerGame(byId('evolved-red')!, byId)).toBe(trainerGame(byId('red')!, byId));
    expect(trainerRegion(byId('cynthia')!, byId)).toBe('Sinnoh');
  });

  it('starting trainers come first by obtainment and tier; evolutions last by tier', () => {
    const first = sortTrainers(all, 'obtainment', profile())[0]!;
    expect(first.unlockedByDefault).toBe(true);
    const tiers = sortTrainers(all, 'tier', profile());
    expect(tiers[0]!.unlockedByDefault).toBe(true);
    const ids = tiers.map((t) => t.id);
    const lastTiered = Math.max(...tiers.filter((t) => t.unlockTier).map((t) => ids.indexOf(t.id)));
    expect(ids.indexOf('evolved-red')).toBeGreaterThan(lastTiered);
  });

  it('owned first puts unlocked trainers before locked ones; recent puts the latest claim first', () => {
    const p = profile();
    p.unlockedArchetypes = ['aaron', 'acerola'];
    const owned = sortTrainers(all, 'owned', p).map((t) => t.id);
    expect(owned.indexOf('aaron')).toBeLessThan(owned.indexOf('adaman'));
    const recent = sortTrainers(all, 'recent', p).map((t) => t.id);
    expect(recent.indexOf('acerola')).toBeLessThan(recent.indexOf('aaron'));
    expect(recent.indexOf('aaron')).toBeLessThan(recent.indexOf('adaman'));
  });

  it('migrates settings v5 to v6 with the default sort', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 5, savedAt: '', data: { musicVolume: 0.3, sfxVolume: 0.4, muted: false, battleAnimations: 'full', effectIntensity: 1, battleSpeed: 'normal', dialogueFrequency: 'normal', damageDetails: false, accessibilityProfile: 'custom' } }));
    expect(new SaveManager(storage, content).loadSettings()).toMatchObject({ trainerSort: 'default', trainerSortReverse: false, musicVolume: 0.3 });
  });
});
