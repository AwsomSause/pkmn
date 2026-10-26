// Title screen: Continue, the Hub (start a run, Bank, trainers, achievements), sound toggle, and any save warnings.

import Phaser from 'phaser';
import { services } from '../game/services';
import { playMusic, stopMusic } from '../ui/audio';
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

  create(): void {
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

    drawLogo(this, 60, 40, 64);
    this.add.text(64, 176, 'Milestone 5 prototype', textStyle(16, COLORS.textMuted));

    drawPanel(this, 48, 214, 360, 220, { alpha: 0.95 });

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
      x: 78,
      y: 240,
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
        .text(48, 446, notes.join('\n'), textStyle(16, COLORS.bad, { wordWrap: { width: 520 } }));
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

  private toggleSound(): void {
    const { session } = services();
    session.saveSettings({ ...session.settings, muted: !session.settings.muted });
    if (session.settings.muted) stopMusic();
    this.scene.restart();
  }
}
