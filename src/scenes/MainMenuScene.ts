// Title screen: Continue, the Hub (start a run, Bank, trainers, achievements), sound toggle, and any save warnings.

import Phaser from 'phaser';
import { services } from '../game/services';
import { playMusic, stopMusic } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';
import { drawPanel, Menu, type MenuOption } from '../ui/widgets';
import { ArenaBackdrop, drawLogo, ShowcaseMon } from '../ui/showcase';
import { loadAssets, queueAssets } from '../ui/lazyAssets';
import { continueCard } from '../ui/loadCard';
import { pokemonAssetIds } from '../assets/catalog';
import { sceneForRun } from './routing';

export class MainMenuScene extends Phaser.Scene {
  private menu!: Menu;

  constructor() {
    super('MainMenu');
  }

  preload(): void {
    queueAssets(this, ['ui.load.card']);
  }

  create(data?: { focus?: number }): void {
    const { session } = services();
    session.closeRun();
    playMusic(this, 'bgm.menu');

    // A battlefield that cycles through the arenas, with a Pokémon on show.
    new ArenaBackdrop(this, { platformAt: { x: 740, y: 330 }, only: session.profile.menuArena });
    const shade = this.add.graphics().setDepth(-20);
    for (let i = 0; i < 20; i++) {
      shade.fillStyle(0x0e0b12, 0.6 * (1 - i / 20));
      shade.fillRect(i * 24, 0, 24, GAME_HEIGHT);
    }
    // With a saved run, the UIE Load card shows it (trainer, stage, party) where the random Pokémon would stand.
    // Continue picks the slot saved most recently (this one, unless another slot has a newer run).
    const latest = session.latestRunSlot();
    const latestPeek = latest ? session.slotPeeks().find((p) => p.slot === latest) : undefined;
    const card = latestPeek?.run.status === 'ok' ? continueCard(this, session.content, latestPeek.run.data, 470, 130) : null;
    const species = [...session.content.species.values()].filter((sp) => !sp.id.includes('-'));
    const mon = new ShowcaseMon(this, 740, 336, PIXEL_SCALE, 230);
    const pick = () => {
      const sp = Phaser.Utils.Array.GetRandom(species);
      if (sp) void loadAssets(this, [pokemonAssetIds(sp.assets).front]).then(() => this.scene.isActive() && mon.show(sp));
    };
    if (!card) {
      pick();
      this.time.addEvent({ delay: 6500, loop: true, callback: pick });
    }

    drawLogo(this, 48, 18, 60, 0, session.settings.battleAnimations);
    this.add.text(64, 158, 'Raid. Collect. Rise.', textStyle(16, COLORS.textMuted));

    drawPanel(this, 48, 186, 400, 300, { alpha: 0.95 });

    const saved = session.savedRun;
    const damaged = saved.status === 'corrupt' || saved.status === 'incompatible';
    const options: { option: MenuOption; action: () => void }[] = [];
    if (latest !== null && !damaged) {
      options.push({ option: { label: `Continue (Slot ${latest})` }, action: () => this.continueRun() });
    } else if (damaged) {
      options.push({ option: { label: 'Discard damaged save' }, action: () => this.discardDamaged() });
    } else {
      options.push({ option: { label: 'Continue', disabled: true }, action: () => undefined });
    }
    options.push({ option: { label: 'Enter the Hub', disabled: damaged }, action: () => this.scene.start('Hub') });
    options.push({ option: { label: 'New Run', disabled: damaged }, action: () => this.newRun() });
    options.push({ option: { label: 'Save Slots' }, action: () => this.scene.start('SaveSlots') });
    options.push({ option: { label: 'Settings' }, action: () => this.scene.start('Settings', { from: 'MainMenu' }) });

    const rowH = Math.min(46, Math.floor(272 / options.length));
    this.menu = new Menu(this, {
      x: 78,
      y: 206,
      options: options.map((o) => o.option),
      // Fit every option inside the panel (186–486), however many settings there are.
      itemHeight: rowH,
      fontSize: rowH >= 40 ? 28 : rowH >= 34 ? 24 : 20,
      onSelect: (i) => options[i]!.action(),
    });
    if (data?.focus) this.menu.focus(data.focus, false);
    onInputAction(this, (a) => {
      this.menu.handle(a);
    });

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
    const { session } = services();
    const latest = session.latestRunSlot();
    if (latest !== null && latest !== session.slot) session.switchSlot(latest);
    const run = session.continueRun();
    stopMusic();
    this.scene.start(sceneForRun(run));
  }

  /** Straight to choosing a trainer; a run in progress in this slot is only replaced after a yes. */
  private newRun(): void {
    const { session } = services();
    if (session.canContinue && !window.confirm(`Slot ${session.slot} has a run in progress. Starting a new run replaces it. Start anyway?`)) return;
    this.scene.start('TrainerSelect');
  }

  private discardDamaged(): void {
    services().session.discardDamagedRun();
    this.scene.restart({});
  }
}
