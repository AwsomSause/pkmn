import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import overworld from '../../src/data/overworld.json';
import { PLAZA_LIFE } from '../../src/core/plaza/life';
import {
  DISTRICT_SPOTS, PLAZA_ENTRY, PLAZA_FLOOR, PLAZA_KEEPERS, PLAZA_MAP, PLAZA_OW_SHEETS, PLAZA_STYLE_IDS, PLAZA_WALKERS,
  nextPlazaStyle, plazaSeason, plazaSheetId, plazaStyleOf, walkerSheet, type PlazaStyleId,
} from '../../src/core/presentation/plazaStyles';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

describe('plaza styles setting', () => {
  it('cycles through all four styles and falls back to Aero Bubbles', () => {
    expect(plazaStyleOf(undefined)).toBe('aero');
    expect(plazaStyleOf('nonsense')).toBe('aero');
    let at: PlazaStyleId = PLAZA_STYLE_IDS[0];
    const seen = new Set<string>();
    for (let i = 0; i < PLAZA_STYLE_IDS.length; i++) (seen.add(at), (at = nextPlazaStyle(at)));
    expect([...seen].sort()).toEqual([...PLAZA_STYLE_IDS].sort());
    expect(at).toBe(PLAZA_STYLE_IDS[0]);
  });

  it('old settings saves load with Aero Bubbles (settings v16 -> v17)', () => {
    const storage = new MemoryStorageProvider();
    const current = new SaveManager(storage, content).loadSettings();
    const { plazaStyle: _p, ...old } = current;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 16, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded.plazaStyle).toBe('aero');
    expect(loaded.eventStyle).toBe(current.eventStyle);
  });

  it('a chosen style survives a save and reload', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    saves.saveSettings({ ...saves.loadSettings(), plazaStyle: 'diorama' });
    expect(new SaveManager(storage, content).loadSettings().plazaStyle).toBe('diorama');
  });
});

describe('plaza map layout', () => {
  const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < PLAZA_MAP.cols && y < PLAZA_MAP.rows;
  it('every district has a label and a standing spot on the map', () => {
    for (const d of PLAZA_LIFE.districts) {
      const s = DISTRICT_SPOTS[d.id];
      expect(s, d.id).toBeDefined();
      expect(inMap(s.label.x, s.label.y) && inMap(s.stand.x, s.stand.y), d.id).toBe(true);
    }
    expect(inMap(PLAZA_ENTRY.x, PLAZA_ENTRY.y)).toBe(true);
    expect(PLAZA_FLOOR.x + PLAZA_FLOOR.w).toBeLessThanOrEqual(PLAZA_MAP.cols);
    expect(PLAZA_FLOOR.y + PLAZA_FLOOR.h).toBeLessThanOrEqual(PLAZA_MAP.rows);
  });

  it('every walk sheet in use is in the catalog and on disk', () => {
    const hubSheets = new Set(overworld.trainers);
    const used = [...PLAZA_WALKERS, ...PLAZA_KEEPERS.map((k) => k.sheet), 'boy_run', 'nemona', 'hood_man'];
    for (const sheet of used) {
      expect(PLAZA_OW_SHEETS.includes(sheet), sheet).toBe(true);
      expect(hubSheets.has(sheet), sheet).toBe(true);
      expect(plazaSheetId(sheet)).toBe(`ow.trainer.${sheet}`);
      expect(existsSync(`public/assets/images/overworld/trainers/${sheet}.png`), sheet).toBe(true);
    }
    expect(FIXED_ASSETS.some((e) => e.id === 'pack.memories.plaza.map')).toBe(true);
    expect(existsSync('public/assets/images/packs/memories/plaza/map.png')).toBe(true);
  });

  it('walkers: rivals and foes have their own look, others are stable per id', () => {
    expect(walkerSheet('anyone', 'rival')).toBe('nemona');
    expect(walkerSheet('anyone', 'foe')).toBe('hood_man');
    expect(walkerSheet('regular-3', 'regular')).toBe(walkerSheet('regular-3', 'regular'));
    expect(PLAZA_WALKERS).toContain(walkerSheet('traveler-1', 'traveler'));
  });
});

describe('regional looks', () => {
  it('two stages per season, in order, and warm regions never snow', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => plazaSeason(i, 'kanto'))).toEqual(['spring', 'spring', 'autumn', 'autumn', 'snow', 'snow', 'dusk', 'dusk']);
    expect(plazaSeason(4, 'alola')).toBe('dusk');
    expect(plazaSeason(-1, undefined)).toBe('spring');
  });
});
