// Shown when a run ends, in defeat or in victory (the last champion beaten).
// The run's results were already applied to the permanent profile (once)
// before this screen appears; the right side shows what they paid out.
// The last party stands either side of the title (Visual Bible: "one memorable
// composition centered on the last party"): in victory they hop in and gold
// confetti falls; in defeat they settle in quietly, a little dimmed.

import { RANK_NAMES } from '../core/mastery';
import { contractRewardText } from '../core/contracts';
import { gameRewardText } from '../core/gameEvents';
import { attributeChanges } from '../core/attributes';
import { topMoments } from '../core/story/record';
import { buildRecap } from '../core/recap';
import { encodeSeedCode } from '../core/seedCode';
import { campaignCounts, getMode } from '../core/rules';
import Phaser from 'phaser';
import { timelineOutcome, TIMELINE } from '../core/timeline/frontRunner';
import type { Species } from '../core/contentSchema';
import { services } from '../game/services';
import { stopMusic } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_WIDTH, textStyle } from '../ui/theme';
import { Menu } from '../ui/widgets';
import { glassPanel as drawPanel, slideIn } from '../ui/aero';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';
import { pokemonIcon } from '../ui/sprites';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  preload(): void {
    preloadPokemon(this, partySpecies(), { icon: true });
  }

  create(): void {
    stopMusic();
    const { session } = services();
    const run = session.run;
    const won = run?.victory ?? false;
    const title = this.add.text(GAME_WIDTH / 2, 38, won ? 'You conquered every region!' : 'Your run has ended', textStyle(won ? 40 : 44, won ? '#f0d060' : COLORS.textLight)).setOrigin(0.5);
    this.lineup(partySpecies(), title.width, won, session.settings.battleAnimations);
    // Left: the run. Right: what it earned for the permanent profile.
    slideIn(this, drawPanel(this, 24, 72, 440, 286), -30, 0, services().session.settings.battleAnimations);
    slideIn(this, drawPanel(this, 480, 72, GAME_WIDTH - 504, 286, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true }), 30, 0, services().session.settings.battleAnimations);
    const recap = run ? buildRecap(session.content, run) : null;
    const recapLines = recap ? [recap.ending, ...(recap.legend ? [`Legend: ${recap.legend}`] : []), ...(recap.stamps.length ? [`Stamps: ${recap.stamps.join(' · ')}`] : []), ...recap.rivals.slice(0, 1), ...(recap.tip ? [recap.tip] : [])] : [];
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
          `Day ${run.clock.day}  ·  Badges: ${run.badges.length}  ·  Encounters: ${run.encountersCompleted}`,
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
    if (run?.timeline) {
      const end = timelineOutcome(session.content, run);
      lines.push(`${TIMELINE.title}: ${end.name}`, `   ${end.text}`, `Revisited timeline (attempt ${run.timeline.attempt}): kept apart from your profile. The original run is untouched.`);
    }
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
      for (const c of summary.contracts ?? []) lines.push(`Contract done: ${c.contract.text} (+${contractRewardText(c.contract.reward)})`);
      for (const m of summary.modeRewards ?? []) lines.push(`${m.first ? 'New reward' : 'Repeat reward'}: ${m.text}`);
      const ups = summary.masteryUps ?? [];
      if (ups.length > 0) lines.push(`Mastery: ${ups.slice(0, 6).map((u) => `${session.content.species.get(u.speciesId)?.name ?? u.speciesId} ${RANK_NAMES[u.rank]}`).join(', ')}${ups.length > 6 ? ` and ${ups.length - 6} more` : ''}`);
      if (summary.trainersReady.length) lines.push('', `Ready to claim in the Trainer Archive: ${summary.trainersReady.map((a) => a.name).join(', ')}`);
      if (run && !campaignCounts(session.content.campaigns.get(run.campaignId)!, run.rules.modeId)) lines.push('', 'Test campaign: achievements and unlocks were not counted.');
      if (run && !run.rules.progressionEligible) lines.push('', 'Adventure run: no Bank Credits, Research Points, candies, unlocks or achievements were earned.');
    } else {
      lines.push('This run was already added to your profile.');
    }
    this.add.text(500, 84, lines.join('\n'), textStyle(18, COLORS.textLight, { lineSpacing: 3, wordWrap: { width: GAME_WIDTH - 540 } }));
    const menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 120,
      y: 486,
      options: [{ label: 'Back to the Hub' }, ...(run ? [{ label: 'Retry this seed' }] : []), ...(won ? [{ label: 'Roll the credits' }] : [])],
      itemHeight: 25,
      fontSize: 22,
      color: COLORS.textLight,
      onSelect: (i) => {
        if (won && i === (run ? 2 : 1)) {
          this.scene.start('Credits');
          return;
        }
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
    if (won && session.settings.battleAnimations === 'full') this.confetti();
    // Ignore keys mashed through the battle's last message so the summary
    // isn't skipped the moment it appears.
    let ready = false;
    this.time.delayedCall(450, () => (ready = true));
    onInputAction(this, (a) => {
      if (ready) menu.handle(a);
    });
  }

  /** The last party, split either side of the title. */
  private lineup(species: Species[], titleWidth: number, won: boolean, motion: string): void {
    const half = Math.ceil(species.length / 2);
    species.forEach((sp, i) => {
      const left = i < half;
      const k = left ? half - 1 - i : i - half;
      const x = GAME_WIDTH / 2 + (left ? -1 : 1) * (titleWidth / 2 + 34 + k * 50);
      const icon = pokemonIcon(this, sp, x, 36, 1.4) as Phaser.GameObjects.Image;
      icon.setName('runend-party');
      if (!won) icon.setTint(0xa8b4c8);
      if (motion === 'off') return;
      icon.setY(won ? -30 : 52).setAlpha(0);
      this.tweens.add({ targets: icon, y: 36, alpha: 1, duration: motion === 'full' ? 600 : 200, delay: motion === 'full' ? 200 + i * 120 : 0, ease: won ? 'Bounce.easeOut' : 'Sine.easeOut' });
      if (won && motion === 'full') this.tweens.add({ targets: icon, y: 28, duration: 360, yoyo: true, repeat: -1, repeatDelay: 900 + i * 90, delay: 1200 + i * 120, ease: 'Quad.easeOut' });
    });
  }

  /** Gold and white confetti drifting down behind the panels (presentation only). */
  private confetti(): void {
    let n = 0;
    this.time.addEvent({
      delay: 70,
      repeat: 80,
      callback: () => {
        n++;
        const x = (n * 197) % GAME_WIDTH;
        const piece = this.add.rectangle(x, -10, 6, 10, n % 3 === 0 ? 0xffffff : n % 3 === 1 ? 0xf0d060 : 0x7fd8ff, 0.9).setDepth(-1);
        this.tweens.add({ targets: piece, y: 560, angle: 360 * (n % 2 ? 1 : -1), x: x + ((n * 37) % 80) - 40, duration: 2600 + (n % 5) * 300, ease: 'Sine.easeIn', onComplete: () => piece.destroy() });
      },
    });
  }
}
