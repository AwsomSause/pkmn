// Title screen: Continue, the Hub (start a run, Bank, trainers, achievements), sound toggle, and any save warnings.

import Phaser from 'phaser';
import { services } from '../game/services';
import { playMusic, stopMusic } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';
import { drawPanel, Menu, type MenuOption } from '../ui/widgets';
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

    // A dimmed battle field behind the title, as on PokeRogue's title screen.
    if (this.textures.exists('bg.battle')) {
      this.add.image(0, 0, 'bg.battle').setOrigin(0).setScale(PIXEL_SCALE);
      for (const side of ['bg.battle.enemy', 'bg.battle.player']) {
        if (this.textures.exists(side)) this.add.image(0, 0, side).setOrigin(0).setScale(PIXEL_SCALE);
      }
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.background, 0.62).setOrigin(0);
    }
    this.add
      .text(GAME_WIDTH / 2, 92, 'Pokémon Roguelike', textStyle(72, COLORS.gold, {
        stroke: '#c73625',
        strokeThickness: 10,
        shadow: { offsetX: 0, offsetY: 6, color: '#181818', fill: true, stroke: true, blur: 0 },
      }))
      .setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 152, 'Milestone 5 prototype', textStyle(24, COLORS.textMuted)).setOrigin(0.5);

    drawPanel(this, GAME_WIDTH / 2 - 200, 186, 400, 290);

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

    this.menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 170,
      y: 206,
      options: options.map((o) => o.option),
      itemHeight: 52,
      fontSize: 30,
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
        .text(GAME_WIDTH / 2, 484, notes.join('\n'), textStyle(18, COLORS.bad, { align: 'center', wordWrap: { width: 860 } }))
        .setOrigin(0.5, 0);
    }

    const s = session.profile.stats;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, `Runs ${s.runsEnded}  ·  Battles won ${s.battlesWon}  ·  Bank Credits ${session.profile.bankCredits}  ·  Research ${session.profile.researchPoints}  ·  Candies ${session.profile.candies}`, textStyle(18, COLORS.textMuted))
      .setOrigin(0.5);
    this.add.text(16, GAME_HEIGHT - 28, 'Arrows: move  ·  Enter: select  ·  Esc: back', textStyle(16, COLORS.textMuted));
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
    session.saveSettings({ ...session.settings, battleAnimations: next });
    this.scene.restart({ focus: this.menu.index });
  }

  /** Strength of screen shake and flashes: 100% → 50% → 25%. */
  private cycleIntensity(): void {
    const { session } = services();
    const order = [1, 0.5, 0.25];
    const i = order.findIndex((v) => Math.abs(v - session.settings.effectIntensity) < 0.01);
    session.saveSettings({ ...session.settings, effectIntensity: order[(i + 1) % order.length]! });
    this.scene.restart({ focus: this.menu.index });
  }

  private toggleSound(): void {
    const { session } = services();
    session.saveSettings({ ...session.settings, muted: !session.settings.muted });
    if (session.settings.muted) stopMusic();
    this.scene.restart();
  }
}
