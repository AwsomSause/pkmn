// Shown when a run ends, in defeat or in victory (the last champion beaten).
// The run's results were already applied to the permanent profile (once)
// before this screen appears; the right side shows what they paid out.

import { attributeChanges } from '../core/attributes';
import { topMoments } from '../core/story/record';
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
    this.add.text(GAME_WIDTH / 2, 38, won ? 'You conquered every region!' : 'Your run has ended', textStyle(won ? 44 : 50, won ? '#f0d060' : COLORS.textLight)).setOrigin(0.5);
    // Left: the run. Right: what it earned for the permanent profile.
    drawPanel(this, 24, 72, 440, 286);
    drawPanel(this, 480, 72, GAME_WIDTH - 504, 286, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });
    if (run) {
      const archetype = session.content.archetypes.get(run.archetypeId)?.name ?? run.archetypeId;
      const lead = run.party[0];
      const leadName = lead ? `${session.content.species.get(lead.speciesId)?.name} (Lv${lead.level})` : '—';
      const by = run.log.defeatedBy;
      const byName = by ? `${by.trainer ? `${by.trainer}'s ` : ''}${session.content.species.get(by.speciesId)?.name ?? by.speciesId} (Lv${by.level})` : null;
      this.add.text(
        44,
        84,
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
        textStyle(19, COLORS.text, { lineSpacing: 3, wordWrap: { width: 400 } }),
      );
      // The run's story: the chronicle's five most memorable moments.
      const moments = topMoments(run.story);
      if (moments.length > 0) {
        const name = (uid: string | undefined) => {
          const species = uid ? run.story.histories[uid]?.speciesId : undefined;
          return species ? `${session.content.species.get(species)?.name ?? species}: ` : '';
        };
        const lines = moments.map((m) => `★ ${m.type === 'runEnded' || m.actors.length !== 1 ? '' : name(m.actors[0])}${m.text}`);
        drawPanel(this, 24, 366, GAME_WIDTH - 48, 118, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });
        this.add.text(44, 374, 'Moments of this run', textStyle(17, '#f0d060'));
        this.add.text(44, 394, lines.join('\n'), textStyle(16, COLORS.textLight, { lineSpacing: 1, wordWrap: { width: GAME_WIDTH - 88 } }));
      }
    }
    const summary = session.lastRunSummary;
    const lines: string[] = [];
    if (summary) {
      const p = summary.payout;
      lines.push(`+${p.total} Bank Credits`, `   savings ${p.savings} · stipend ${p.stipend} · achievements ${p.achievements}`);
      const research = summary.researchPoints + summary.achievements.reduce((n, a) => n + a.reward.researchPoints, 0);
      if (research > 0) lines.push(`+${research} Research Points`);
      if (summary.newSpeciesCaught.length || summary.newSpeciesSeen.length) lines.push(`New species: ${summary.newSpeciesSeen.length} met, ${summary.newSpeciesCaught.length} caught`);
      const grew = attributeChanges(summary.attributesBefore, summary.attributesAfter);
      if (grew) lines.push(`Attributes: ${grew}`);
      if (summary.achievements.length) lines.push('', 'Achievements earned:', ...summary.achievements.slice(0, 5).map((a) => `  ★ ${a.name}`));
      if (summary.achievements.length > 5) lines.push(`  …and ${summary.achievements.length - 5} more`);
      if (summary.runQuestDone) lines.push('', `Run Quest done: ${summary.runQuestDone.text} (+${summary.runQuestDone.researchPoints} Research Points)`);
      for (const q of summary.questSteps) lines.push(`Quest step ${q.index + 1}/5 done: ${q.step.goal}. "${q.step.story}"`);
      if (summary.trainersReady.length) lines.push('', `Ready to claim in the Trainer Archive: ${summary.trainersReady.map((a) => a.name).join(', ')}`);
      if (run && !session.content.campaigns.get(run.campaignId)?.countsForProgress) lines.push('', 'Test campaign: achievements and unlocks were not counted.');
      if (run && !run.rules.progressionEligible) lines.push('', 'Adventure run: no Bank Credits, Research Points, candies, unlocks or achievements were earned.');
    } else {
      lines.push('This run was already added to your profile.');
    }
    this.add.text(500, 84, lines.join('\n'), textStyle(18, COLORS.textLight, { lineSpacing: 3, wordWrap: { width: GAME_WIDTH - 540 } }));
    const menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 120,
      y: 492,
      options: [{ label: 'Back to the Hub' }],
      fontSize: 28,
      color: COLORS.textLight,
      onSelect: () => this.scene.start('Hub'),
    });
    onInputAction(this, (a) => menu.handle(a));
  }
}
