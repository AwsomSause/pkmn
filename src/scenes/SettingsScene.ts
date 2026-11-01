// The one Settings screen. The title screen and the Hub both open it, so they always show the same
// settings from the same registry (core/settingsRegistry.ts). It is never reachable from inside a battle.

import { fitLine } from '../ui/fitText';
import Phaser from 'phaser';
import { DEFAULT_SETTINGS } from '../save/saveManager';
import { changeSetting, resetSettings, searchSettings, settingsIn, SETTING_CATEGORIES, type SettingCategory, type SettingDef } from '../core/settingsRegistry';
import { services } from '../game/services';
import { refreshMusicVolume, stopMusic } from '../ui/audio';
import { downloadText, pickTextFile } from '../ui/files';
import { queueAssets } from '../ui/lazyAssets';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { holdToConfirm } from '../ui/pointerFx';
import { framedScreenshot, runShareCard } from '../ui/shareCard';
import { UI_THEMES, themeIsLight, FONT_SCALE } from '../core/presentation/uiPrefs';
import { drawBackdrop, drawPanel, Menu, type MenuOption } from '../ui/widgets';

type Page = 'home' | 'search' | 'confirmReset' | SettingCategory;
interface Row {
  option: MenuOption;
  hint: string;
  action: () => void;
}

const APPLIES_TAG = { now: '', nextBattle: '  · next battle', restart: '  · restart needed' } as const;

export class SettingsScene extends Phaser.Scene {
  private page: Page = 'home';
  /** True until the current page's menu has been built once (its options slide in only then). */
  private entering = true;
  private from: 'MainMenu' | 'Hub' = 'MainMenu';
  private query = '';
  private notice = '';
  private menu?: Menu;
  private ui?: Phaser.GameObjects.Container;
  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super('Settings');
  }

  preload(): void {
    queueAssets(this, ['ui.optionsbg']);
  }

  create(data?: { from?: 'MainMenu' | 'Hub'; page?: Page; focus?: number }): void {
    this.from = data?.from ?? 'MainMenu';
    this.page = data?.page ?? 'home';
    this.entering = true;
    this.query = '';
    this.notice = '';
    if (this.textures.exists('ui.optionsbg')) {
      this.add.image(0, 0, 'ui.optionsbg').setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.94).setName('options-bg');
    } else drawBackdrop(this);
    onInputAction(this, (a) => {
      if (this.page === 'search') return; // typing is handled by the key listener below
      if (a === 'back') this.back();
      else this.menu?.handle(a);
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.typed(e));
    this.render(data?.focus ?? 0);
  }

  private back(): void {
    if (this.page === 'home') this.scene.start(this.from);
    else if (this.page === 'confirmReset') this.go('home');
    else this.go('home');
  }

  private go(page: Page, focus = 0): void {
    this.entering = true;
    this.page = page;
    this.query = '';
    this.notice = '';
    this.render(focus);
  }

  /** Types into the search box while the search page is open. */
  private typed(e: KeyboardEvent): void {
    if (this.page !== 'search') return;
    if (e.code === 'Escape') return this.go('home', 7);
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') return this.menu?.handle(e.code === 'ArrowUp' ? 'up' : 'down');
    if (e.code === 'Enter' || e.code === 'NumpadEnter') return this.menu?.handle('confirm');
    if (e.code === 'Backspace') this.query = this.query.slice(0, -1);
    else if (e.key.length === 1 && this.query.length < 24) this.query += e.key;
    else return;
    this.render(0);
  }

  private rows(): Row[] {
    const { session } = services();
    const s = session.settings;
    const toggleRow = (d: SettingDef, withCategory = false): Row => {
      const cat = SETTING_CATEGORIES.find((c) => c.id === d.category)!.label;
      return {
        option: { label: `${d.label}: ${d.show(s)}${APPLIES_TAG[d.applies]}${d.advanced ? '  (advanced)' : ''}${withCategory ? `  [${cat}]` : ''}`, disabled: d.disabled?.(s) ?? false, tip: d.description },
        hint: d.description,
        action: () => this.change(d.id),
      };
    };
    const back: Row = { option: { label: 'Back' }, hint: '', action: () => this.back() };
    if (this.page === 'home') {
      return [
        ...SETTING_CATEGORIES.map((c): Row => ({ option: { label: c.label }, hint: c.blurb, action: () => this.go(c.id) })),
        { option: { label: 'Search settings…' }, hint: 'Type to find a setting by name.', action: () => this.go('search') },
        { option: { label: 'Reset to defaults' }, hint: 'Puts every setting back to how it started. Your saves are not touched.', action: () => this.go('confirmReset') },
        { option: { label: this.from === 'Hub' ? 'Back to the Hub' : 'Back to the title screen' }, hint: '', action: () => this.back() },
      ];
    }
    if (this.page === 'search') {
      const found = searchSettings(this.query).map((d) => toggleRow(d, true));
      return [...found, back];
    }
    if (this.page === 'confirmReset') {
      return [
        { option: { label: 'Yes, reset every setting' }, hint: 'Audio, display, animations and text all go back to their starting values.', action: () => holdToConfirm(this, services().session.settings, { title: 'Reset every setting?', onConfirm: () => this.reset() }) },
        { option: { label: 'No, keep my settings' }, hint: '', action: () => this.go('home') },
      ];
    }
    if (this.page === 'data') {
      return [
        { option: { label: 'Export save to a file' }, hint: 'Downloads your profile and settings as a .json file.', action: () => downloadText(`pkmn-save-${new Date().toISOString().slice(0, 10)}.json`, session.exportSave()) },
        { option: { label: 'Import save from a file' }, hint: 'Replaces your profile with one from a file. Your current profile is kept as a backup.', action: () => pickTextFile((t) => { this.notice = session.importSave(t); this.render(1); }) },
        { option: { label: 'Save a framed screenshot' }, hint: 'Saves the game screen as a PNG with a frame. Also F9 anywhere.', action: () => framedScreenshot(this.game) },
        { option: { label: 'Save a run share card' }, hint: 'Saves a PNG card with your current run’s trainer and team. Also F10.', action: () => { this.notice = runShareCard(session) ? 'Share card saved.' : 'Start a run first.'; this.render(this.menu?.index ?? 0); } },
        { option: { label: 'Reset settings to defaults' }, hint: 'Asks first. Run and profile data are not touched.', action: () => this.go('confirmReset') },
        back,
      ];
    }
    return [...settingsIn(this.page).map((d) => toggleRow(d)), back];
  }

  private change(id: string): void {
    const { session } = services();
    const before = session.settings;
    const after = changeSetting(before, id);
    if (after === before) return;
    session.saveSettings(after);
    this.sideEffects(before, after);
    this.render(this.menu?.index ?? 0);
  }

  private reset(): void {
    const { session } = services();
    const before = session.settings;
    const after = resetSettings(DEFAULT_SETTINGS);
    session.saveSettings(after);
    this.sideEffects(before, after);
    this.go('home', 0);
    this.notice = 'Settings reset to defaults.';
    this.render(0);
  }

  private sideEffects(before: typeof DEFAULT_SETTINGS, after: typeof DEFAULT_SETTINGS): void {
    if (before.musicVolume !== after.musicVolume) refreshMusicVolume();
    if (!before.muted && after.muted) stopMusic();
  }

  private render(focus: number): void {
    this.menu?.destroy();
    this.ui?.destroy(true);
    const ui = (this.ui = this.add.container(0, 0));
    const rows = this.rows();
    const cat = SETTING_CATEGORIES.find((c) => c.id === this.page)?.label;
    const title = this.page === 'home' ? 'Settings' : this.page === 'search' ? 'Search settings' : this.page === 'confirmReset' ? 'Reset to defaults?' : `Settings · ${cat}`;
    // The UIE Options backdrop already has the word "Options" in its corner: the home page leaves the title to the art,
    // and sub-pages put theirs beside it, so the two never print over each other.
    const art = this.textures.exists('ui.optionsbg');
    const heading = art ? (this.page === 'home' ? '' : title.replace(/^Settings · /, '')) : title;
    if (heading) ui.add(fitLine(this.add.text(art ? 150 : 48, 22, heading, textStyle(34)), 760 - (art ? 102 : 0)));
    if (this.page === 'search') ui.add(this.add.text(48, 70, `Find: ${this.query}▍`, textStyle(24, '#ffb745')));
    if (this.page === 'search' && this.query && rows.length === 1) ui.add(this.add.text(48, 110, 'No setting matches.', textStyle(20, COLORS.textMuted)));
    const top = this.page === 'search' ? 108 : 78;
    ui.add(drawPanel(this, 40, top - 8, 560, 400 - (top - 78), { alpha: 0.95 }));
    const rowH = Math.min(40, Math.floor((380 - (top - 78)) / Math.max(rows.length, 1)));
    this.hintText = this.add.text(48, 474, '', textStyle(18, COLORS.textLight, { wordWrap: { width: 800 } }));
    ui.add(this.hintText);
    ui.add(this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 12, this.page === 'search' ? 'Type to search  ·  Up/Down  ·  Enter: change  ·  Esc: back' : 'Arrows: move  ·  Enter: change  ·  Esc: back', textStyle(14, COLORS.textMuted)).setOrigin(1, 1));
    if (this.notice) ui.add(this.add.text(48, 508, this.notice, textStyle(16, COLORS.good)));
    this.menu = new Menu(this, {
      x: 60,
      y: top,
      options: rows.map((r) => r.option),
      itemWidth: 520,
      itemHeight: rowH,
      fontSize: rowH >= 36 ? 24 : rowH >= 30 ? 20 : 17,
      onSelect: (i) => rows[i]!.action(),
      onFocus: (i) => this.hintText?.setText(rows[i]?.hint ?? ''),
      // Options slide in on a new page only, not each time a setting changes.
      animateIn: this.entering,
    });
    this.entering = false;
    if (this.page === 'display' || this.page === 'text' || this.page === 'accessibility') this.preview(ui);
    this.menu.focus(Math.min(focus, rows.length - 1), false);
    this.hintText.setText(rows[this.menu.index]?.hint ?? '');
  }

  /** A live sample of the chosen theme, text size and popup size, drawn from the saved settings on the right. */
  private preview(ui: Phaser.GameObjects.Container): void {
    const { session } = services();
    const s = session.settings;
    const t = UI_THEMES[s.uiTheme];
    const light = themeIsLight(s.uiTheme);
    const ink = light ? '#2a2431' : '#f8f8f8';
    const x = 620;
    const y = 78;
    ui.add(this.add.rectangle(x, y, 300, 200, t.background).setOrigin(0).setStrokeStyle(2, t.borderMuted));
    ui.add(this.add.rectangle(x + 14, y + 14, 272, 120, t.panel).setOrigin(0).setStrokeStyle(4, t.border));
    ui.add(this.add.text(x + 26, y + 24, t.label, textStyle(Math.round(20 * FONT_SCALE[s.fontSize]), ink, { wordWrap: { width: 250 } })).setName('preview-label'));
    ui.add(this.add.text(x + 26, y + 64, 'Sample text 123', textStyle(Math.round(16 * FONT_SCALE[s.fontSize]), ink)));
    ui.add(this.add.rectangle(x + 26, y + 100, 80, 20, t.accent).setOrigin(0));
    ui.add(this.add.circle(x + 270, y + 70, 16, t.rim, 0.8));
    ui.add(this.add.text(x + 150, y + 150, '-42', textStyle(24, light ? '#b03020' : '#ffe9a8')).setOrigin(0.5).setScale(s.popupScale).setStroke('#201020', 4));
    ui.add(this.add.text(x, y + 210, 'Preview of the theme, text size\nand damage popup size.', textStyle(16, COLORS.textMuted)));
  }
}
