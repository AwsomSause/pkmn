// Shown when a run ends, in defeat or in victory (the last champion beaten).
// The run's results were already applied to the permanent profile (once)
// before this screen appears; the right side shows what they paid out.

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
    this.add.text(GAME_WIDTH / 2, 50, won ? 'You conquered every region!' : 'Your run has ended', textStyle(won ? 44 : 50, won ? '#f0d060' : COLORS.textLight)).setOrigin(0.5);
    // Left: the run. Right: what it earned for the permanent profile.
    drawPanel(this, 24, 96, 440, 330);
    drawPanel(this, 480, 96, GAME_WIDTH - 504, 330, { fill: COLORS.panelDark, border: 0x101420 });
    if (run) {
      const archetype = session.content.archetypes.get(run.archetypeId)?.name ?? run.archetypeId;
      const lead = run.party[0];
      const leadName = lead ? `${session.content.species.get(lead.speciesId)?.name} (Lv${lead.level})` : '—';
      const by = run.log.defeatedBy;
      const byName = by ? `${by.trainer ? `${by.trainer}'s ` : ''}${session.content.species.get(by.speciesId)?.name ?? by.speciesId} (Lv${by.level})` : null;
      this.add.text(
        44,
        110,
        [
          `Trainer: ${archetype}`,
          `Lead: ${leadName}`,
          `Regions cleared: ${run.regionsCleared.length} of ${run.regionOrder.length}`,
          `Badges: ${run.badges.length}  ·  Encounters: ${run.encountersCompleted}`,
          `Rewards taken: ${run.log.rewardsTaken.length}`,
          `Money left: ₽${run.money}`,
          `Candies earned: ${run.candies}`,
          ...(byName ? [`Defeated by ${byName}`] : []),
          `Seed: ${run.seed}`,
        ].join('\n'),
        textStyle(21, COLORS.text, { lineSpacing: 4, wordWrap: { width: 400 } }),
      );
    }
    const summary = session.lastRunSummary;
    const lines: string[] = [];
    if (summary) {
      const p = summary.payout;
      lines.push(`+${p.total} Bank Credits`, `   savings ${p.savings} · stipend ${p.stipend} · achievements ${p.achievements}`);
      const research = summary.researchPoints + summary.achievements.reduce((n, a) => n + a.reward.researchPoints, 0);
      if (research > 0) lines.push(`+${research} Research Points`);
      if (summary.newSpeciesCaught.length || summary.newSpeciesSeen.length) lines.push(`New species: ${summary.newSpeciesSeen.length} met, ${summary.newSpeciesCaught.length} caught`);
      if (summary.achievements.length) lines.push('', 'Achievements earned:', ...summary.achievements.slice(0, 5).map((a) => `  ★ ${a.name}`));
      if (summary.achievements.length > 5) lines.push(`  …and ${summary.achievements.length - 5} more`);
      if (summary.trainersReady.length) lines.push('', `Ready to claim in the Trainer Archive: ${summary.trainersReady.map((a) => a.name).join(', ')}`);
      if (run && !session.content.campaigns.get(run.campaignId)?.countsForProgress) lines.push('', 'Test campaign: achievements and unlocks were not counted.');
    } else {
      lines.push('This run was already added to your profile.');
    }
    this.add.text(500, 110, lines.join('\n'), textStyle(19, COLORS.textLight, { lineSpacing: 3, wordWrap: { width: GAME_WIDTH - 540 } }));
    const menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 120,
      y: 446,
      options: [{ label: 'Back to the Hub' }],
      fontSize: 32,
      color: COLORS.textLight,
      onSelect: () => this.scene.start('Hub'),
    });
    onInputAction(this, (a) => menu.handle(a));
  }
}
