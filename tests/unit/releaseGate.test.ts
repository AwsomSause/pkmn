// Release gate (left-out 3.3): every save record can be upgraded from every old version, and bad saves never crash a load.
import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, MIGRATIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const envelope = (record: string, schemaVersion: number, data: unknown) => JSON.stringify({ format: 'pkmn-roguelike', record, schemaVersion, savedAt: '', data });
const V1_SETTINGS = { musicVolume: 0.3, sfxVolume: 0.4, muted: false };

describe('release gate: saves', () => {
  it('has a migration for every old version of every record', () => {
    for (const [record, current] of Object.entries(CURRENT_VERSIONS)) {
      for (let v = 1; v < current; v++) expect(MIGRATIONS[record as keyof typeof MIGRATIONS][v], `${record} v${v}`).toBeTypeOf('function');
    }
  });

  it('upgrades a settings save from every old version to the current one', () => {
    for (let v = 1; v < CURRENT_VERSIONS.settings; v++) {
      const storage = new MemoryStorageProvider();
      let data: unknown = V1_SETTINGS;
      for (let from = 1; from < v; from++) data = MIGRATIONS.settings[from]!(data);
      storage.set('pkr.settings', envelope('settings', v, data));
      const loaded = new SaveManager(storage, content).loadSettings();
      expect(loaded, `settings v${v}`).toMatchObject({ musicVolume: 0.3, shakeIntensity: 1, reduceParticles: false, battleUi: 'aero' });
    }
  });

  it('v7 settings keep their one strength for both shake and flashes', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 7, savedAt: '', data: { ...V1_SETTINGS, battleAnimations: 'full', effectIntensity: 0.25, battleSpeed: 'normal', dialogueFrequency: 'normal', damageDetails: false, accessibilityProfile: 'custom', trainerSort: 'default', trainerSortReverse: false, battleUi: 'aero' } }));
    expect(new SaveManager(storage, content).loadSettings()).toMatchObject({ effectIntensity: 0.25, shakeIntensity: 0.25 });
  });

  it('refuses a run from a newer game and survives garbage without throwing', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    storage.set('pkr.run', envelope('run', 999, {}));
    expect(saves.loadRun().status).toBe('incompatible');
    storage.set('pkr.run', '{not json');
    expect(saves.loadRun().status).toBe('corrupt');
    storage.set('pkr.settings', '{not json');
    expect(saves.loadSettings()).toMatchObject({ battleUi: 'aero' });
    storage.set('pkr.profile', '{not json');
    expect(saves.loadOrCreateProfile(() => 'p1').warning).toBeTruthy();
  });
});
