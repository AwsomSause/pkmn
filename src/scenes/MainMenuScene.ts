// Title screen: Continue, the Hub (start a run, Bank, trainers, achievements), sound toggle, and any save warnings.

import Phaser from 'phaser';
import { services } from '../game/services';
import { playMusic, stopMusic } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, Menu, type MenuOption } from '../ui/widgets';
import { sceneForRun } from './routing';

export class MainMenuScene extends Phaser.Scene {
  private menu!: Menu;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { session } = services();
    session.closeRun();
    playMusic(this, 'bgm.menu');

    this.add.text(GAME_WIDTH / 2, 90, 'Pokémon Roguelike', textStyle(64, COLORS.textLight, { stroke: '#e05038', strokeThickness: 6 })).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 150, 'Milestone 5 prototype', textStyle(24, '#aab4c8')).setOrigin(0.5);

    drawPanel(this, GAME_WIDTH / 2 - 180, 190, 360, 220);

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

    this.menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 130,
      y: 220,
      options: options.map((o) => o.option),
      itemHeight: 60,
      fontSize: 34,
      onSelect: (i) => options[i]!.action(),
    });
    onInputAction(this, (a) => this.menu.handle(a));

    // Messages: damaged saves, storage problems, save failures.
    const notes: string[] = [...session.warnings];
    if (damaged) notes.push(`Your saved run could not be loaded: ${saved.reason} Choose "Discard damaged save" to keep a backup copy and start fresh.`);
    if (saved.status === 'unavailable') notes.push(saved.reason);
    if (session.lastSaveError) notes.push(`Last save failed: ${session.lastSaveError}`);
    if (notes.length > 0) {
      this.add
        .text(GAME_WIDTH / 2, 430, notes.join('\n'), textStyle(18, '#ffb4a8', { align: 'center', wordWrap: { width: 860 } }))
        .setOrigin(0.5, 0);
    }

    const s = session.profile.stats;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, `Runs ${s.runsEnded}  ·  Battles won ${s.battlesWon}  ·  Bank Credits ${session.profile.bankCredits}  ·  Research ${session.profile.researchPoints}  ·  Candies ${session.profile.candies}`, textStyle(18, '#8090a8'))
      .setOrigin(0.5);
    this.add.text(16, GAME_HEIGHT - 28, 'Arrows: move  ·  Enter: select  ·  Esc: back', textStyle(16, '#5a6680'));
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

  private toggleSound(): void {
    const { session } = services();
    session.saveSettings({ ...session.settings, muted: !session.settings.muted });
    if (session.settings.muted) stopMusic();
    this.scene.restart();
  }
}
