// Shown when a run ends, in defeat or in victory (the last champion beaten).
// The run's results were already applied to the permanent profile (once)
// before this screen appears; the right side shows what they paid out.

import { RANK_NAMES } from '../core/mastery';
import { gameRewardText } from '../core/gameEvents';
import { attributeChanges } from '../core/attributes';
import { topMoments } from '../core/story/record';
import { buildRecap } from '../core/recap';
import { encodeSeedCode } from '../core/seedCode';
import { getMode } from '../core/rules';
import Phaser from 'phaser';
import { services } from '../game/services';
import { stopMusic } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_WIDTH, textStyle } from '../ui/theme';
import { Menu } from '../ui/widgets';
import { glassPanel as drawPanel } from '../ui/aero';

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
    const recap = run ? buildRecap(session.content, run) : null;
    const recapLines = recap ? [recap.ending, ...(recap.legend ? [`Legend: ${recap.legend}`] : []), ...recap.rivals.slice(0, 1), ...(recap.tip ? [recap.tip] : [])] : [];
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
          `Seed code: ${encodeSeedCode({ seed: run.seed, archetypeId: run.archetypeId, rules: run.rules })}`,
          ...recapLines,
        ].join('\n'),
        textStyle(15, COLORS.text, { lineSpacing: 2, wordWrap: { width: 410 } }),
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
      if (summary.directive) lines.push(summary.directive.done ? `Research Directive done: ${summary.directive.target} ${summary.directive.type}-types (+${summary.directive.researchPoints} Research Points)` : `Research Directive: ${summary.directive.current}/${summary.directive.target} ${summary.directive.type}-types`);
      for (const q of summary.questSteps) lines.push(`Quest step ${q.index + 1}/5 done: ${q.step.goal}. "${q.step.story}"`);
      for (const g of summary.gameEvents ?? []) {
        for (const o of g.objectives) lines.push(`${g.event.name}: ${o.text} done (+${gameRewardText(session.content, o.reward)})`);
        if (g.final) lines.push(`${g.event.name} complete! ${g.final.fallback ? 'Repeat reward' : 'Reward'}: ${gameRewardText(session.content, g.final.reward)}`);
      }
      for (const m of summary.modeRewards ?? []) lines.push(`${m.first ? 'New reward' : 'Repeat reward'}: ${m.text}`);
      const ups = summary.masteryUps ?? [];
      if (ups.length > 0) lines.push(`Mastery: ${ups.slice(0, 6).map((u) => `${session.content.species.get(u.speciesId)?.name ?? u.speciesId} ${RANK_NAMES[u.rank]}`).join(', ')}${ups.length > 6 ? ` and ${ups.length - 6} more` : ''}`);
      if (summary.trainersReady.length) lines.push('', `Ready to claim in the Trainer Archive: ${summary.trainersReady.map((a) => a.name).join(', ')}`);
      if (run && !session.content.campaigns.get(run.campaignId)?.countsForProgress) lines.push('', 'Test campaign: achievements and unlocks were not counted.');
      if (run && !run.rules.progressionEligible) lines.push('', 'Adventure run: no Bank Credits, Research Points, candies, unlocks or achievements were earned.');
    } else {
      lines.push('This run was already added to your profile.');
    }
    this.add.text(500, 84, lines.join('\n'), textStyle(18, COLORS.textLight, { lineSpacing: 3, wordWrap: { width: GAME_WIDTH - 540 } }));
    const menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 120,
      y: 486,
      options: [{ label: 'Back to the Hub' }, ...(run ? [{ label: 'Retry this seed' }] : [])],
      itemHeight: 25,
      fontSize: 22,
      color: COLORS.textLight,
      onSelect: (i) => {
        if (i === 1 && run) {
          // Same seed, trainer, preparation and rules. Daily seeds pay their account rewards once, so a retry pays nothing.
          const { note: _note, ...prep } = run.prep;
          const rules = { modeId: run.rules.modeId, difficultyId: run.rules.difficultyId, modifierIds: run.rules.modifierIds, deathBlock: run.rules.deathBlock, ...(getMode(run.rules.modeId)?.dailySeed ? { noRewards: true } : {}) };
          session.newRun(run.archetypeId, run.seed, undefined, prep, rules);
          this.scene.start('StarterSelect');
          return;
        }
        this.scene.start('Hub');
      },
    });
    // Ignore keys mashed through the battle's last message so the summary
    // isn't skipped the moment it appears.
    let ready = false;
    this.time.delayedCall(450, () => (ready = true));
    onInputAction(this, (a) => {
      if (ready) menu.handle(a);
    });
  }
}
