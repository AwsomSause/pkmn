// Shown when a run ends, in defeat or in victory (the last champion beaten).
// The run's results were already applied to the permanent profile (once)
// before this screen appears.

import Phaser from 'phaser';
import { services } from '../game/services';
import { stopMusic } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, Menu } from '../ui/widgets';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    stopMusic();
    const { session } = services();
    const run = session.run;
    const won = run?.victory ?? false;
    this.add.text(GAME_WIDTH / 2, 80, won ? 'You conquered every region!' : 'Your run has ended', textStyle(won ? 44 : 52, won ? '#f0d060' : COLORS.textLight)).setOrigin(0.5);
    drawPanel(this, GAME_WIDTH / 2 - 260, 130, 520, 256);
    if (run) {
      const archetype = session.content.archetypes.get(run.archetypeId)?.name ?? run.archetypeId;
      const lead = run.party[0];
      const leadName = lead ? `${session.content.species.get(lead.speciesId)?.name} (Lv${lead.level})` : '—';
      this.add.text(
        GAME_WIDTH / 2 - 230,
        146,
        [
          `Trainer: ${archetype}`,
          `Starter: ${leadName}`,
          `Regions cleared: ${run.regionsCleared.length} of ${run.regionOrder.length}`,
          `Encounters cleared: ${run.encountersCompleted}`,
          `Rewards taken: ${run.log.rewardsTaken.length}`,
          `Money earned: ₽${run.money}`,
          `Candies earned: ${run.candies} (kept)`,
          `Seed: ${run.seed}`,
        ].join('\n'),
        textStyle(24, COLORS.text, { lineSpacing: 5 }),
      );
    }
    this.add
      .text(GAME_WIDTH / 2, 392, 'Candies go to your profile. Spending them arrives in a later milestone.\nYour profile statistics were saved.', textStyle(18, '#8090a8', { align: 'center' }))
      .setOrigin(0.5, 0);
    const menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 120,
      y: 460,
      options: [{ label: 'Return to menu' }],
      fontSize: 32,
      color: COLORS.textLight,
      onSelect: () => this.scene.start('MainMenu'),
    });
    onInputAction(this, (a) => menu.handle(a));
  }
}
