// Title screen: Continue, the Hub (start a run, Bank, trainers, achievements), sound toggle, and any save warnings.

import Phaser from 'phaser';
import { services } from '../game/services';
import { playMusic, stopMusic } from '../ui/audio';
import { applyProfile, nextProfile, PROFILE_INFO } from '../core/accessibility';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';
import { drawPanel, Menu, type MenuOption } from '../ui/widgets';
import { ArenaBackdrop, drawLogo, ShowcaseMon } from '../ui/showcase';
import { loadAssets } from '../ui/lazyAssets';
import { pokemonAssetIds } from '../assets/catalog';
import { sceneForRun } from './routing';

export class MainMenuScene extends Phaser.Scene {
  private menu!: Menu;

  constructor() {
    super('MainMenu');
  }

  create(data?: { focus?: number }): void {
    const { session } = services();
    session.closeRun();
    playMusic(this, 'bgm.menu');

    // A battlefield that cycles through the arenas, with a Pokémon on show.
    new ArenaBackdrop(this, { platformAt: { x: 740, y: 330 } });
    const shade = this.add.graphics().setDepth(-20);
    for (let i = 0; i < 20; i++) {
      shade.fillStyle(0x0e0b12, 0.6 * (1 - i / 20));
      shade.fillRect(i * 24, 0, 24, GAME_HEIGHT);
    }
    const species = [...session.content.species.values()].filter((sp) => !sp.id.includes('-'));
    const mon = new ShowcaseMon(this, 740, 336, PIXEL_SCALE, 230);
    const pick = () => {
      const sp = Phaser.Utils.Array.GetRandom(species);
      if (sp) void loadAssets(this, [pokemonAssetIds(sp.assets).front]).then(() => this.scene.isActive() && mon.show(sp));
    };
    pick();
    this.time.addEvent({ delay: 6500, loop: true, callback: pick });

    drawLogo(this, 60, 24, 64);
    this.add.text(64, 158, 'Milestone 5 prototype', textStyle(16, COLORS.textMuted));

    drawPanel(this, 48, 186, 400, 300, { alpha: 0.95 });

    const saved = session.savedRun;
    const damaged = saved.status === 'corrupt' || saved.status === 'incompatible';
    const options: { option: MenuOption; action: () => void }[] = [];
    if (saved.status === 'ok') {
      options.push({ option: { label: 'Continue' }, action: () => this.continueRun() });
    } else if (damaged) {
      options.push({ option: { label: 'Discard damaged save' }, action: () => this.discardDamaged() });
    } else {
      options.push({ option: { label: 'Continue', disabled: true }, action: () => undefined });
    }
    options.push({ option: { label: 'Enter the Hub', disabled: damaged }, action: () => this.scene.start('Hub') });
    options.push({
      option: { label: session.settings.muted ? 'Sound: Off' : 'Sound: On' },
      action: () => this.toggleSound(),
    });
    const animLabels = { full: 'Full', reduced: 'Reduced motion', off: 'Off' } as const;
    options.push({
      option: { label: `Animations: ${animLabels[session.settings.battleAnimations]}` },
      action: () => this.cycleAnimations(),
    });
    options.push({
      option: { label: `Effects: ${Math.round(session.settings.effectIntensity * 100)}%`, disabled: session.settings.battleAnimations !== 'full' },
      action: () => this.cycleIntensity(),
    });

    const speedLabels = { normal: 'Normal', fast: 'Fast', quick: 'Quick' } as const;
    options.push({
      option: { label: `Battle speed: ${speedLabels[session.settings.battleSpeed]}` },
      action: () => this.cycleSpeed(),
    });

    const talkLabels = { off: 'Off', low: 'Low', normal: 'Normal', high: 'High' } as const;
    options.push({
      option: { label: `Trainer talk: ${talkLabels[session.settings.dialogueFrequency]}` },
      action: () => this.cycleTalk(),
    });

    options.push({
      option: { label: `Accessibility: ${PROFILE_INFO[session.settings.accessibilityProfile].label}` },
      action: () => this.cycleProfile(),
    });
    options.push({
      option: { label: `Damage details: ${session.settings.damageDetails ? 'On' : 'Off'}` },
      action: () => this.toggleDetails(),
    });

    this.menu = new Menu(this, {
      x: 78,
      y: 206,
      options: options.map((o) => o.option),
      itemHeight: options.length > 8 ? 30 : 46,
      fontSize: options.length > 8 ? 20 : 28,
      onSelect: (i) => options[i]!.action(),
    });
    if (data?.focus) this.menu.focus(data.focus, false);
    onInputAction(this, (a) => this.menu.handle(a));

    // Messages: damaged saves, storage problems, save failures.
    const notes: string[] = [...session.warnings];
    if (damaged) notes.push(`Your saved run could not be loaded: ${saved.reason} Choose "Discard damaged save" to keep a backup copy and start fresh.`);
    if (saved.status === 'unavailable') notes.push(saved.reason);
    if (session.lastSaveError) notes.push(`Last save failed: ${session.lastSaveError}`);
    if (notes.length > 0) {
      this.add
        .text(48, 482, notes.join('\n'), textStyle(16, COLORS.bad, { wordWrap: { width: 560 } }));
    }

    const s = session.profile.stats;
    this.add
      .text(GAME_WIDTH - 16, GAME_HEIGHT - 16, `Runs ${s.runsEnded}  ·  Battles won ${s.battlesWon}  ·  Bank Credits ${session.profile.bankCredits}  ·  Research ${session.profile.researchPoints}  ·  Candies ${session.profile.candies}`, textStyle(16, COLORS.textMuted))
      .setOrigin(1, 1);
    this.add.text(16, GAME_HEIGHT - 16, 'Arrows: move  ·  Enter: select  ·  Esc: back', textStyle(14, COLORS.textMuted)).setOrigin(0, 1);
  }

  private continueRun(): void {
    const run = services().session.continueRun();
    stopMusic();
    this.scene.start(sceneForRun(run));
  }

  private discardDamaged(): void {
    services().session.discardDamagedRun();
    this.scene.restart();
  }

  /** Battle animations: full → reduced motion (no flashing or shaking) → off (skipped). */
  private cycleAnimations(): void {
    const { session } = services();
    const order = ['full', 'reduced', 'off'] as const;
    const next = order[(order.indexOf(session.settings.battleAnimations) + 1) % order.length]!;
    session.saveSettings({ ...session.settings, battleAnimations: next , accessibilityProfile: 'custom' });
    this.scene.restart({ focus: this.menu.index });
  }

  /** Trainer dialogue: normal → high → off → low. */
  private cycleTalk(): void {
    const { session } = services();
    const order = ['normal', 'high', 'off', 'low'] as const;
    const next = order[(order.indexOf(session.settings.dialogueFrequency) + 1) % order.length]!;
    session.saveSettings({ ...session.settings, dialogueFrequency: next , accessibilityProfile: 'custom' });
    this.scene.restart({ focus: this.menu.index });
  }

  /** Accessibility presets: custom → Reduced Motion → Low Flash → More Combat Detail → Fast Battles. */
  private cycleProfile(): void {
    const { session } = services();
    session.saveSettings(applyProfile(session.settings, nextProfile(session.settings.accessibilityProfile)));
    this.scene.restart({ focus: this.menu.index });
  }

  private toggleDetails(): void {
    const { session } = services();
    session.saveSettings({ ...session.settings, damageDetails: !session.settings.damageDetails, accessibilityProfile: 'custom' });
    this.scene.restart({ focus: this.menu.index });
  }

  /** Battle speed: normal → fast → quick. */
  private cycleSpeed(): void {
    const { session } = services();
    const order = ['normal', 'fast', 'quick'] as const;
    const next = order[(order.indexOf(session.settings.battleSpeed) + 1) % order.length]!;
    session.saveSettings({ ...session.settings, battleSpeed: next , accessibilityProfile: 'custom' });
    this.scene.restart({ focus: this.menu.index });
  }

  /** Strength of screen shake and flashes: 100% → 50% → 25%. */
  private cycleIntensity(): void {
    const { session } = services();
    const order = [1, 0.5, 0.25];
    const i = order.findIndex((v) => Math.abs(v - session.settings.effectIntensity) < 0.01);
    session.saveSettings({ ...session.settings, effectIntensity: order[(i + 1) % order.length]! , accessibilityProfile: 'custom' });
    this.scene.restart({ focus: this.menu.index });
  }

  private toggleSound(): void {
    const { session } = services();
    session.saveSettings({ ...session.settings, muted: !session.settings.muted });
    if (session.settings.muted) stopMusic();
    this.scene.restart();
  }
}
