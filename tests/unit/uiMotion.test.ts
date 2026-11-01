import { describe, expect, it } from 'vitest';
import { createSpring, staggerDelay, stepSpring, uiMotionLevel, uiTween, UI_TIMING } from '../../src/core/presentation/uiMotion';
import { animsIn } from '../../src/core/presentation/animRegistry';
import { animSettingsFrom } from '../../src/core/accessibility';
import { CURRENT_VERSIONS, DEFAULT_SETTINGS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SETTINGS } from '../../src/core/settingsRegistry';
import { content } from './helpers';

describe('Wii-style menu motion (spec §24)', () => {
  it('follows Disable all, Menu animations and the motion level', () => {
    expect(uiMotionLevel(DEFAULT_SETTINGS)).toBe('full');
    expect(uiMotionLevel({ ...DEFAULT_SETTINGS, battleAnimations: 'reduced' })).toBe('reduced');
    expect(uiMotionLevel({ ...DEFAULT_SETTINGS, menuAnimations: false })).toBe('off');
    expect(uiMotionLevel({ ...DEFAULT_SETTINGS, disableAllAnimations: true })).toBe('off');
    expect(animSettingsFrom({ ...DEFAULT_SETTINGS, menuAnimations: false }).enabled?.ui).toBe(false);
  });

  it('keeps every timing short so input never waits, and reduced motion has no bounce', () => {
    for (const ms of Object.values(UI_TIMING)) expect(ms).toBeLessThanOrEqual(420);
    expect(uiTween('cursor', 'full')).toMatchObject({ ms: UI_TIMING.cursor, travel: 1, bounce: true });
    const reduced = uiTween('popupOpen', 'reduced');
    expect(reduced.bounce).toBe(false);
    expect(reduced.travel).toBe(0.25);
    expect(reduced.ms).toBeLessThanOrEqual(120);
    expect(uiTween('page', 'off').ms).toBe(0);
    expect(uiTween('cursor', 'full', 1.5).ms).toBe(Math.round(UI_TIMING.cursor * 1.5));
  });

  it('staggers list entrances only with full motion, capped for long lists', () => {
    expect(staggerDelay(3, 'full')).toBe(3 * UI_TIMING.stagger);
    expect(staggerDelay(40, 'full')).toBe(8 * UI_TIMING.stagger);
    expect(staggerDelay(3, 'reduced')).toBe(0);
  });

  it('springs the cursor with a small overshoot (full) and none when reduced', () => {
    const run = (level: 'full' | 'reduced') => {
      const s = createSpring([0]);
      let max = 0;
      let settledAt = -1;
      for (let t = 0; t < 1500; t += 16) {
        if (stepSpring(s, [100], 16, level) && settledAt < 0) settledAt = t;
        max = Math.max(max, s.value[0]!);
      }
      return { max, settledAt, end: s.value[0] };
    };
    const full = run('full');
    const reduced = run('reduced');
    expect(full.max).toBeGreaterThan(100);
    expect(full.max).toBeLessThan(112);
    expect(reduced.max).toBeLessThanOrEqual(100.01);
    expect(full.end).toBe(100);
    expect(reduced.end).toBe(100);
    expect(full.settledAt).toBeGreaterThan(0);
    expect(full.settledAt).toBeLessThan(800);
  });

  it('gives the same path at any frame rate, snaps when off and can be retargeted mid-way', () => {
    const a = createSpring([0, 0]);
    const b = createSpring([0, 0]);
    for (let i = 0; i < 10; i++) stepSpring(a, [50, -20], 8, 'full');
    for (let i = 0; i < 5; i++) stepSpring(b, [50, -20], 16, 'full');
    expect(a.value[0]).toBeCloseTo(b.value[0]!, 6);
    const off = createSpring([0]);
    expect(stepSpring(off, [30], 16, 'off')).toBe(true);
    expect(off.value[0]).toBe(30);
    // Interrupting: a new target mid-glide still settles on it.
    const c = createSpring([0]);
    for (let i = 0; i < 4; i++) stepSpring(c, [100], 16, 'full');
    for (let i = 0; i < 80; i++) stepSpring(c, [-40], 16, 'full');
    expect(c.value[0]).toBe(-40);
  });

  it('registers the menu animations and a settings switch for them', () => {
    expect(animsIn('ui').map((d) => d.id)).toEqual(expect.arrayContaining(['ui.cursor', 'ui.press', 'ui.popup', 'ui.page', 'ui.reward']));
    const def = SETTINGS.find((d) => d.id === 'menuAnimations')!;
    expect(def.category).toBe('animations');
    expect(def.next(DEFAULT_SETTINGS).menuAnimations).toBe(false);
  });

  it('a settings v9 save gets Auto-Battle off and menu animations on', () => {
    const storage = new MemoryStorageProvider();
    const { menuAnimations: _m, autoBattle: _a, autoExplain: _e, ...old } = DEFAULT_SETTINGS;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 9, savedAt: '', data: { ...old, sfxVolume: 0.321 } }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded).toMatchObject({ sfxVolume: 0.321, autoBattle: false, autoExplain: true, menuAnimations: true });
  });

  it('migrates settings v10 to v11 with menu animations on', () => {
    expect(CURRENT_VERSIONS.settings).toBeGreaterThanOrEqual(11);
    const storage = new MemoryStorageProvider();
    const { menuAnimations: _drop, ...old } = DEFAULT_SETTINGS;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 10, savedAt: '', data: { ...old, musicVolume: 0.123 } }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded.musicVolume).toBe(0.123);
    expect(loaded.menuAnimations).toBe(true);
  });
});
