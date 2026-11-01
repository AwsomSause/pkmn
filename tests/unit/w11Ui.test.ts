import { describe, expect, it } from 'vitest';
import { animSettingsFrom } from '../../src/core/accessibility';
import { getContent } from '../../src/data';
import {
  aeroMood, buttonGlyph, cameraFocus, capFlash, glyphFamily, hapticPattern, holdProgress, InteractionLog, loadingTip, LOADING_TIPS,
  padActions, padJustify, shareCardRows, TOOLTIP_DELAY_MS, tiltFor, UI_THEMES, UI_THEME_ORDER,
} from '../../src/core/presentation/uiPrefs';
import { changeSetting, settingsIn } from '../../src/core/settingsRegistry';
import { CURRENT_VERSIONS, DEFAULT_SETTINGS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SettingsSchema } from '../../src/core/state';

const content = getContent();

describe('W11 settings (v12)', () => {
  it('migrates settings v11 to v12 with every new key at the old behaviour', () => {
    expect(CURRENT_VERSIONS.settings).toBeGreaterThanOrEqual(12);
    const storage = new MemoryStorageProvider();
    const { uiTheme: _a, fontSize: _b, dyslexiaFont: _c, reducedFlash: _d, tooltipDelay: _e, popupScale: _f, transitionStyle: _g, cursorTrail: _h, holdToConfirm: _i, haptics: _j, oneHanded: _k, gamepadConfirm: _l, gamepadBack: _m, ...old } = DEFAULT_SETTINGS;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 11, savedAt: '', data: { ...old, sfxVolume: 0.21 } }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded.sfxVolume).toBe(0.21);
    expect(loaded).toMatchObject({ uiTheme: 'classic', fontSize: 'normal', dyslexiaFont: false, reducedFlash: false, tooltipDelay: 'normal', popupScale: 1, transitionStyle: 'fade', cursorTrail: false, holdToConfirm: false, haptics: false, oneHanded: 'off', gamepadConfirm: 0, gamepadBack: 1 });
  });
  it('defaults satisfy the schema and bad values are rejected', () => {
    expect(SettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, uiTheme: 'pink' }).success).toBe(false);
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, popupScale: 9 }).success).toBe(false);
  });
  it('every new setting cycles back to where it started', () => {
    for (const id of ['uiTheme', 'fontSize', 'dyslexiaFont', 'reducedFlash', 'tooltipDelay', 'popupScale', 'transitionStyle', 'cursorTrail', 'holdToConfirm', 'haptics', 'oneHanded', 'gamepadConfirm']) {
      let s = DEFAULT_SETTINGS;
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        s = changeSetting(s, id);
        seen.add(JSON.stringify((s as unknown as Record<string, unknown>)[id]));
      }
      expect(seen.size, id).toBeGreaterThan(1);
      expect(SettingsSchema.safeParse(s).success, id).toBe(true);
    }
  });
  it('the gamepad confirm and back buttons never collide', () => {
    let s = DEFAULT_SETTINGS;
    for (let i = 0; i < 9; i++) {
      s = changeSetting(s, 'gamepadConfirm');
      expect(s.gamepadConfirm).not.toBe(s.gamepadBack);
      s = changeSetting(s, 'gamepadBack');
      expect(s.gamepadConfirm).not.toBe(s.gamepadBack);
    }
  });
  it('the Controls category lists the controller and layout settings', () => {
    expect(settingsIn('controls').map((d) => d.id)).toEqual(expect.arrayContaining(['holdToConfirm', 'haptics', 'oneHanded', 'gamepadConfirm', 'gamepadBack']));
  });
});

describe('themes, flash, tooltips', () => {
  it('has five themes and classic matches the original colours', () => {
    expect(UI_THEME_ORDER).toHaveLength(5);
    expect(UI_THEMES.classic.panel).toBe(0x362d3e);
    for (const id of UI_THEME_ORDER) expect(UI_THEMES[id].label.length).toBeGreaterThan(2);
  });
  it('reduced flash caps flash and shake in the animation settings', () => {
    expect(capFlash(1, true)).toBe(0.2);
    expect(capFlash(0.1, true)).toBe(0.1);
    expect(capFlash(1, false)).toBe(1);
    const a = animSettingsFrom({ ...DEFAULT_SETTINGS, reducedFlash: true });
    expect(a.intensity).toBe(0.2);
    expect(a.shake).toBe(0.2);
    expect(animSettingsFrom(DEFAULT_SETTINGS).intensity).toBe(1);
  });
  it('tooltip delays grow and Off is null', () => {
    expect(TOOLTIP_DELAY_MS.off).toBeNull();
    expect(TOOLTIP_DELAY_MS.short!).toBeLessThan(TOOLTIP_DELAY_MS.normal!);
    expect(TOOLTIP_DELAY_MS.normal!).toBeLessThan(TOOLTIP_DELAY_MS.long!);
  });
});

describe('gamepad, haptics, hold, tilt, tips, log, share', () => {
  const idle = { buttons: Array<boolean>(16).fill(false), axes: [0, 0] };
  it('maps the d-pad, stick and the chosen face buttons', () => {
    expect([...padActions(idle, 0, 1)]).toEqual([]);
    const press = (i: number) => ({ ...idle, buttons: idle.buttons.map((_, j) => j === i) });
    expect(padActions(press(12), 0, 1).has('up')).toBe(true);
    expect(padActions(press(0), 0, 1).has('confirm')).toBe(true);
    expect(padActions(press(0), 2, 0).has('back')).toBe(true);
    expect(padActions({ ...idle, axes: [0.9, 0] }, 0, 1).has('right')).toBe(true);
    expect(padActions({ ...idle, axes: [0, -0.9] }, 0, 1).has('up')).toBe(true);
  });
  it('picks glyphs by controller family', () => {
    expect(glyphFamily('Xbox 360 Controller (STANDARD GAMEPAD)')).toBe('xbox');
    expect(glyphFamily('054c-0ce6 DualSense')).toBe('playstation');
    expect(glyphFamily('Pro Controller (Vendor: 057e)')).toBe('switch');
    expect(glyphFamily('mystery pad')).toBe('generic');
    expect(buttonGlyph('playstation', 0)).toBe('✕');
    expect(buttonGlyph('switch', 0)).toBe('B');
    expect(buttonGlyph('generic', 9)).toBe('10');
  });
  it('haptics repeat for super effective hits and every type has a pattern', () => {
    expect(hapticPattern('fire').length).toBeGreaterThan(0);
    expect(hapticPattern('fire', true).length).toBeGreaterThan(hapticPattern('fire').length);
    expect(hapticPattern('nonsense')).toEqual(hapticPattern('normal'));
  });
  it('hold progress is clamped 0 to 1', () => {
    expect(holdProgress(-5)).toBe(0);
    expect(holdProgress(350)).toBeCloseTo(0.5);
    expect(holdProgress(5000)).toBe(1);
  });
  it('tilt stays small and centred is flat', () => {
    expect(tiltFor(0, 0)).toEqual({ rotation: 0, scaleX: 1 });
    expect(Math.abs(tiltFor(5, 5).rotation)).toBeLessThan(0.1);
  });
  it('loading tips cycle deterministically, even for negative counters', () => {
    expect(loadingTip(0)).toBe(LOADING_TIPS[0]);
    expect(loadingTip(LOADING_TIPS.length)).toBe(LOADING_TIPS[0]);
    expect(loadingTip(-1)).toBe(LOADING_TIPS[LOADING_TIPS.length - 1]);
  });
  it('the interaction log keeps the newest entries only', () => {
    const log = new InteractionLog(3);
    ['a', 'b', 'c', 'd'].forEach((t, i) => log.add(t, i));
    expect(log.recent().map((e) => e.text)).toEqual(['d', 'c', 'b']);
    log.clear();
    expect(log.recent()).toEqual([]);
  });
  it('share card rows pair the team two per line', () => {
    const rows = shareCardRows({ title: 'T', lines: ['x'], team: [{ name: 'A', level: 5 }, { name: 'B', level: 6 }, { name: 'C', level: 7 }], seed: 's1' });
    expect(rows).toEqual(['T', 'x', '', 'A Lv5   ·   B Lv6', 'C Lv7', '', 'Seed s1']);
  });
  it('one-handed layout and camera focus', () => {
    expect(padJustify('left')).toBe('flex-start');
    expect(padJustify('right')).toBe('flex-end');
    expect(padJustify('off')).toBe('space-between');
    expect(cameraFocus('phase', 1).zoom).toBeGreaterThan(cameraFocus('ko', 1).zoom);
    expect(cameraFocus('ko', 0).zoom).toBe(0);
    expect(aeroMood('rain', 0).strength).toBeGreaterThan(0);
    expect(aeroMood(null, 0).strength).toBe(0);
  });
});
