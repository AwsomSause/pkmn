// Shown when a run ends in defeat. The run's results were already applied to
// the permanent profile (once) before this screen appears.

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
    this.add.text(GAME_WIDTH / 2, 80, 'Your run has ended', textStyle(52, COLORS.textLight)).setOrigin(0.5);
    drawPanel(this, GAME_WIDTH / 2 - 260, 140, 520, 230);
    if (run) {
      const archetype = session.content.archetypes.get(run.archetypeId)?.name ?? run.archetypeId;
      const lead = run.party[0];
      const leadName = lead ? `${session.content.species.get(lead.speciesId)?.name} (Lv${lead.level})` : '—';
      this.add.text(
        GAME_WIDTH / 2 - 230,
        160,
        [
          `Trainer: ${archetype}`,
          `Starter: ${leadName}`,
          `Encounters cleared: ${run.encountersCompleted}`,
          `Rewards taken: ${run.log.rewardsTaken.length}`,
          `Money earned: ₽${run.money}`,
          `Seed: ${run.seed}`,
        ].join('\n'),
        textStyle(26, COLORS.text, { lineSpacing: 6 }),
      );
    }
    this.add
      .text(GAME_WIDTH / 2, 392, 'Permanent rewards for runs arrive in a later milestone.\nYour profile statistics were saved.', textStyle(18, '#8090a8', { align: 'center' }))
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
