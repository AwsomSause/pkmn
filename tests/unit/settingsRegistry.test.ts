import { describe, expect, it } from 'vitest';
import { animationFlags } from '../../src/core/accessibility';
import { changeSetting, resetSettings, searchSettings, settingsIn, SETTING_CATEGORIES, SETTINGS } from '../../src/core/settingsRegistry';
import { SettingsSchema } from '../../src/core/state';
import { DEFAULT_SETTINGS } from '../../src/save/saveManager';

describe('settings registry', () => {
  it('every setting id is a real settings key, and ids are unique', () => {
    const keys = Object.keys(SettingsSchema.shape);
    for (const d of SETTINGS) expect(keys, d.id).toContain(d.id);
    expect(new Set(SETTINGS.map((d) => d.id)).size).toBe(SETTINGS.length);
  });

  it('pressing a setting for ever keeps cycling through valid values', () => {
    for (const d of SETTINGS) {
      let s = { ...DEFAULT_SETTINGS, autoAdvance: true };
      const seen = new Set<string>();
      for (let i = 0; i < 12 && !seen.has(d.show(s)); i++) {
        seen.add(d.show(s));
        s = changeSetting(s, d.id);
      }
      expect(seen.has(d.show(s)), `${d.id} loops`).toBe(true);
      expect(SettingsSchema.safeParse(s).success, d.id).toBe(true);
    }
  });

  it('lists every category, finds settings by words, and leaves disabled ones alone', () => {
    for (const c of SETTING_CATEGORIES.filter((c) => c.id !== 'data')) expect(settingsIn(c.id).length, c.id).toBeGreaterThan(0);
    expect(searchSettings('shake').map((d) => d.id)).toContain('shakeIntensity');
    expect(searchSettings('')).toEqual([]);
    const off = { ...DEFAULT_SETTINGS, disableAllAnimations: true };
    expect(changeSetting(off, 'rivalAnimations')).toBe(off);
  });

  it('disable-all keeps each individual choice for when it is turned back on', () => {
    let s = changeSetting(DEFAULT_SETTINGS, 'rivalAnimations');
    s = changeSetting(s, 'disableAllAnimations');
    expect(Object.values(animationFlags(s)).some(Boolean)).toBe(false);
    s = changeSetting(s, 'disableAllAnimations');
    expect(animationFlags(s)).toMatchObject({ rivalAnimations: false, abilityAnimations: true });
  });

  it('reset restores the defaults', () => {
    expect(resetSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});
