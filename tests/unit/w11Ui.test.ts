import { describe, expect, it } from 'vitest';
import { animSettingsFrom } from '../../src/core/accessibility';
import { getContent } from '../../src/data';
import {
  aeroMood, buttonGlyph, cameraFocus, capFlash, glyphFamily, hapticPattern, holdProgress, InteractionLog, loadingTip, LOADING_TIPS,
  autoInterruption, chestReady, GLOSSARY, glossaryLinks, hotkeyIndex, idleHintDue, isShake, lyricAt, MoveUndo, NoticeStack, rowAt, swipeDir,
  DEFAULT_PAD_MAP, jingleCaption, JINGLE_IDS, PAD_ACTIONS, remapPad,
  padActions, padJustify, shareCardRows, TOOLTIP_DELAY_MS, tiltFor, UI_THEMES, UI_THEME_ORDER,
} from '../../src/core/presentation/uiPrefs';
import { chamferPoints, cornerRadius, feelTween, scanlineYs, SKINS } from '../../src/core/presentation/skins';
import { uiTween, springTuning } from '../../src/core/presentation/uiMotion';
import { changeSetting, settingsIn } from '../../src/core/settingsRegistry';
import { CURRENT_VERSIONS, DEFAULT_SETTINGS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SettingsSchema } from '../../src/core/state';

const content = getContent();

describe('W11 settings (v12)', () => {
  it('migrates settings v11 to v12 with every new key at the old behaviour', () => {
    expect(CURRENT_VERSIONS.settings).toBeGreaterThanOrEqual(12);
    const storage = new MemoryStorageProvider();
    const { uiTheme: _a, fontSize: _b, dyslexiaFont: _c, reducedFlash: _d, tooltipDelay: _e, popupScale: _f, transitionStyle: _g, cursorTrail: _h, holdToConfirm: _i, haptics: _j, oneHanded: _k, gamepadMap: _l, victoryJingle: _n, ...old } = DEFAULT_SETTINGS;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 11, savedAt: '', data: { ...old, sfxVolume: 0.21 } }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded.sfxVolume).toBe(0.21);
    expect(loaded).toMatchObject({ uiTheme: 'classic', fontSize: 'normal', dyslexiaFont: false, reducedFlash: false, tooltipDelay: 'normal', popupScale: 1, transitionStyle: 'fade', cursorTrail: false, holdToConfirm: false, haptics: false, oneHanded: 'off', gamepadMap: { up: 12, down: 13, left: 14, right: 15, confirm: 0, back: 1 }, victoryJingle: 'badge' });
  });
  it('defaults satisfy the schema and bad values are rejected', () => {
    expect(SettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, uiTheme: 'pink' }).success).toBe(false);
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, popupScale: 9 }).success).toBe(false);
  });
  it('every new setting cycles back to where it started', () => {
    for (const id of ['uiTheme', 'fontSize', 'dyslexiaFont', 'reducedFlash', 'tooltipDelay', 'popupScale', 'transitionStyle', 'cursorTrail', 'holdToConfirm', 'haptics', 'oneHanded', 'victoryJingle']) {
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
  it('every gamepad action is remappable and a taken button swaps instead of doubling up', () => {
    let s = DEFAULT_SETTINGS;
    for (const a of PAD_ACTIONS) for (let i = 0; i < 20; i++) {
      s = changeSetting(s, `pad_${a}`);
      expect(new Set(Object.values(s.gamepadMap)).size).toBe(6);
    }
    expect(remapPad(DEFAULT_PAD_MAP, 'confirm', 1)).toMatchObject({ confirm: 1, back: 0 });
    expect(remapPad(DEFAULT_PAD_MAP, 'up', 7)).toMatchObject({ up: 7, down: 13 });
  });
  it('migrates settings v12 to v13 keeping the old confirm and back buttons', () => {
    const storage = new MemoryStorageProvider();
    const { gamepadMap: _m, ...rest } = DEFAULT_SETTINGS;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 12, savedAt: '', data: { ...rest, gamepadConfirm: 2, gamepadBack: 3 } }));
    const loaded = new SaveManager(storage, content).loadSettings();
    expect(loaded.gamepadMap).toEqual({ up: 12, down: 13, left: 14, right: 15, confirm: 2, back: 3 });
    expect((loaded as Record<string, unknown>).gamepadConfirm).toBeUndefined();
  });
  it('the Controls category lists the controller and layout settings', () => {
    expect(settingsIn('controls').map((d) => d.id)).toEqual(expect.arrayContaining(['holdToConfirm', 'haptics', 'oneHanded', 'pad_confirm', 'pad_back']));
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
    expect([...padActions(idle, DEFAULT_PAD_MAP)]).toEqual([]);
    const press = (i: number) => ({ ...idle, buttons: idle.buttons.map((_, j) => j === i) });
    expect(padActions(press(12), DEFAULT_PAD_MAP).has('up')).toBe(true);
    expect(padActions(press(0), DEFAULT_PAD_MAP).has('confirm')).toBe(true);
    expect(padActions(press(0), { ...DEFAULT_PAD_MAP, back: 0, confirm: 2 }).has('back')).toBe(true);
    expect(padActions({ ...idle, axes: [0.9, 0] }, DEFAULT_PAD_MAP).has('right')).toBe(true);
    expect(padActions({ ...idle, axes: [0, -0.9] }, DEFAULT_PAD_MAP).has('up')).toBe(true);
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

describe('W11 batch 2 rules', () => {
  it('maps pointer y to party rows and hotkeys to party slots', () => {
    expect(rowAt(100, 90, 50, 6, 6)).toBe(0);
    expect(rowAt(150, 90, 50, 6, 6)).toBe(1);
    expect(rowAt(9999, 90, 50, 6, 6)).toBe(5);
    expect(rowAt(-5, 90, 50, 6, 6)).toBe(0);
    expect(hotkeyIndex('Digit3', 6)).toBe(2);
    expect(hotkeyIndex('Digit6', 4)).toBeNull();
    expect(hotkeyIndex('KeyA', 6)).toBeNull();
  });
  it('undo reverses reorders newest first', () => {
    const u = new MoveUndo();
    u.push(0, 2);
    u.push(2, 1);
    expect(u.pop()).toEqual({ from: 1, to: 2 });
    expect(u.pop()).toEqual({ from: 2, to: 0 });
    expect(u.pop()).toBeNull();
  });
  it('the notice stack keeps the newest, drops dismissed and expired bubbles', () => {
    const s = new NoticeStack(2, 1000);
    const a = s.push('a', 0);
    s.push('b', 10);
    s.push('c', 20);
    expect(s.visible(30).map((n) => n.text)).toEqual(['c', 'b']);
    s.dismiss(a.id);
    s.dismiss(s.visible(30)[0]!.id);
    expect(s.visible(30).map((n) => n.text)).toEqual(['b']);
    expect(s.visible(5000)).toEqual([]);
  });
  it('idle hints wait for quiet and never repeat inside a minute', () => {
    expect(idleHintDue(10_000, 0, -100_000)).toBe(false);
    expect(idleHintDue(30_000, 0, -100_000)).toBe(true);
    expect(idleHintDue(30_000, 0, 20_000)).toBe(false);
  });
  it('glossary links are stripped from text and only known ones kept', () => {
    expect(glossaryLinks('A [[STAB]] hit and [[nope]].')).toEqual({ clean: 'A STAB hit and nope.', keys: ['stab'] });
    expect(GLOSSARY.crit).toBeTruthy();
  });
  it('lyric cues, swipes, shakes and the daily chest', () => {
    const cues: [number, string][] = [[0, 'one'], [1000, 'two']];
    expect(lyricAt(cues, 500)).toBe('one');
    expect(lyricAt(cues, 1500)).toBe('two');
    expect(lyricAt(cues, -1)).toBe('');
    expect(swipeDir(80, 10)).toBe('right');
    expect(swipeDir(-80, 10)).toBe('left');
    expect(swipeDir(5, 90)).toBe('down');
    expect(swipeDir(5, -90)).toBe('up');
    expect(swipeDir(20, 20)).toBeNull();
    expect(isShake([10, 40, 5, 45, 2])).toBe(true);
    expect(isShake([10, 11, 10, 11])).toBe(false);
    expect(chestReady(null, '2026-11-01')).toBe(true);
    expect(chestReady('2026-11-01', '2026-11-01')).toBe(false);
  });
  it('auto-battle pauses on low HP, raids and bosses', () => {
    expect(autoInterruption(10, 100, false, false)).toMatch(/danger/);
    expect(autoInterruption(80, 100, false, true)).toMatch(/raid/);
    expect(autoInterruption(80, 100, true, false)).toMatch(/boss/);
    expect(autoInterruption(80, 100, false, false)).toBeNull();
  });
});

describe('skins and captions', () => {
  it('every theme has a skin and DS, Wii and Cyber build their own panel shapes', () => {
    for (const id of UI_THEME_ORDER) expect(SKINS[id]).toBeDefined();
    expect(new Set([SKINS.ds.shape, SKINS.wii.shape, SKINS.cyber.shape, SKINS.aero.shape, SKINS.classic.shape]).size).toBe(5);
    expect(SKINS.cyber.scanlines).toBe(true);
    expect(SKINS.ds.shadow).toBeGreaterThan(0);
    expect(SKINS.classic.feel).toBe('default');
  });
  it('geometry helpers stay inside the panel', () => {
    expect(cornerRadius(SKINS.wii, 100, 30)).toBe(15);
    expect(cornerRadius(SKINS.classic, 100, 30)).toBe(0);
    const pts = chamferPoints(10, 20, 100, 50, 12);
    expect(pts).toHaveLength(8);
    expect(Math.min(...pts.map((p) => p.x))).toBe(10);
    expect(Math.max(...pts.map((p) => p.y))).toBe(70);
    expect(chamferPoints(0, 0, 10, 10, 99)[0]).toEqual({ x: 5, y: 0 });
    const lines = scanlineYs(0, 40);
    expect(lines[0]).toBe(4);
    expect(Math.max(...lines)).toBeLessThan(36);
  });
  it('motion feel differs per skin but reduced and off stay calm', () => {
    const wii = uiTween('popupOpen', 'full', 1, 'bouncy');
    const ds = uiTween('popupOpen', 'full', 1, 'snappy');
    const cy = uiTween('popupOpen', 'full', 1, 'glitch');
    const base = uiTween('popupOpen', 'full', 1);
    expect(wii.ms).toBeGreaterThan(base.ms);
    expect(ds.ms).toBeLessThan(base.ms);
    expect(cy.ms).toBeLessThan(base.ms);
    expect(wii.ease).toBe('Elastic.easeOut');
    expect(ds.bounce).toBe(false);
    expect(uiTween('popupOpen', 'reduced', 1, 'bouncy').bounce).toBe(false);
    expect(uiTween('popupOpen', 'off', 1, 'bouncy').ms).toBe(0);
    expect(springTuning('full', 1, 'bouncy').damping).toBeLessThan(springTuning('full', 1).damping);
    expect(feelTween('default').ease).toBeNull();
  });
  it('every jingle and fanfare has a caption', () => {
    for (const id of ['me.item_get', 'me.key_item', 'me.badge', 'me.pkmn_get', 'me.evo_start', 'me.evo_success', 'me.heal', 'me.save', 'me.tm_get', 'me.berry', 'me.forget_move', 'bgm.victory_wild', 'bgm.victory_trainer', 'bgm.victory_leader', 'bgm.victory_elite', 'bgm.raid.capture.basic', 'bgm.raid.capture.ultra', 'bgm.raid.capture.max', 'bgm.raid.capture.tera']) {
      expect(jingleCaption(id), id).toBeTruthy();
      expect(JINGLE_IDS).toContain(id);
    }
    expect(jingleCaption('bgm.menu')).toBeNull();
  });
});
