// The campaign briefing (GAME_DESIGN.md §14.7), shown once after the starter
// is chosen: region order, the first stage, starting resources, special rules
// and the seed (which can be copied to replay or share the run).

import Phaser from 'phaser';
import { directiveText } from '../core/directive';
import { licenseName } from '../core/license';
import { getArchetype } from '../core/archetypes';
import { attributesLine, effectiveAttributes } from '../core/attributes';
import { getCampaign, levelCap } from '../core/regions';
import { eventIdOf } from '../core/gameEvents';
import { questTrainer, runQuestOf, stepsDone } from '../core/quests';
import { itemsText } from '../core/runPrep';
import { getTheme } from '../core/themes';
import { services } from '../game/services';
import { onInputAction } from '../ui/input';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { Menu } from '../ui/widgets';
import { glassPanel as drawPanel, slideIn } from '../ui/aero';
import { sceneForRun } from './routing';

export class BriefingScene extends Phaser.Scene {
  private menu!: Menu;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('Briefing');
  }

  create(): void {
    const { session } = services();
    const { content } = session;
    const run = session.run!;
    const archetype = getArchetype(content, run.archetypeId);
    const campaign = getCampaign(content, run.campaignId);
    const pool = content.starterPools.get(run.prep.poolId);
    const rule = content.draftRules.get(run.prep.draftRuleId);
    const token = run.prep.tokenId ? content.prepTokens.get(run.prep.tokenId) : undefined;
    const lead = run.party[0]!;

    this.add.text(GAME_WIDTH / 2, 30, 'Campaign briefing', textStyle(40, COLORS.textLight)).setOrigin(0.5);
    slideIn(this, drawPanel(this, 24, 64, GAME_WIDTH - 48, 370, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true }), 0, 18, session.settings.battleAnimations);

    // The lines are collected first, then laid out in the largest font that fits the panel.
    const rows: [string, string][] = [];
    const line = (label: string, text: string) => void rows.push([label, text]);
    const regions = run.regionOrder.map((id) => content.regions.get(id)?.name ?? id);
    line('Trainer', `${archetype.name}${archetype.title ? `, ${archetype.title}` : ''} with ${content.species.get(lead.speciesId)?.name ?? lead.speciesId} (Lv${lead.level})`);
    line('Campaign', `${campaign.name}: ${regions.length} regions, ${campaign.stagesPerRegion} stages each, then the Pokémon League`);
    line('Region order', regions.join(' → '));
    if (run.stage) {
      const theme = getTheme(content, run.stage.themeId);
      line('First stage', `${theme.name} (${theme.types.map(capitalise).join(' / ')}), level cap ${levelCap(content, 0)}`);
    }
    line('Starting with', `₽${run.money}; ${itemsText(content, run.inventory) || 'an empty Bag'}`);
    line('Rules', `${pool?.name ?? run.prep.poolId} pool, ${rule?.name ?? run.prep.draftRuleId}${run.prep.typeFocus ? ` (${capitalise(run.prep.typeFocus)})` : ''}; preparation: ${token?.name ?? 'none'}`);
    line('Attributes', attributesLine(effectiveAttributes(content, run)));
    if (run.prep.directive) line('Directive', directiveText(content, run.prep.directive));
    if (run.prep.license) line('Field License', licenseName(run.prep.license));
    for (const edition of run.gameEvents) {
      const ge = content.gameEvents.get(eventIdOf(edition));
      if (ge) line(ge.name, ge.ruleText);
    }
    const quest = runQuestOf(content, run);
    if (quest) line('Run Quest', `${quest.text} (+${quest.researchPoints} Research Points)`);
    const questLine = content.questLines.get(questTrainer(content, run.archetypeId));
    const done = stepsDone(content, session.profile, questTrainer(content, run.archetypeId));
    if (questLine && done < questLine.steps.length) line('Trainer quest', `${questLine.name}, step ${done + 1}/5: ${questLine.steps[done]!.goal}`);
    line('Seed', `${run.seed}   (the same seed replays the same run)`);

    this.layoutRows(rows);

    this.status = this.add.text(GAME_WIDTH / 2, 444, '', textStyle(16, '#f0e0a0')).setOrigin(0.5, 0);
    this.menu = new Menu(this, {
      x: GAME_WIDTH / 2 - 200,
      y: 476,
      columns: 2,
      itemWidth: 240,
      options: [{ label: 'Begin the run' }, { label: 'Copy seed' }],
      fontSize: 24,
      color: COLORS.textLight,
      onSelect: (i) => (i === 0 ? this.scene.start(sceneForRun(session.run!)) : this.copySeed(run.seed)),
    });
    this.add.text(16, GAME_HEIGHT - 22, '←/→ choose  ·  Enter select', textStyle(14, '#8a7f96'));
    onInputAction(this, (a) => this.menu.handle(a));
  }

  /** Label/text rows inside the panel (y 76–426): the biggest font that fits, shrunk as a last resort. */
  private layoutRows(rows: [string, string][]): void {
    const TOP = 78;
    const ROOM = 344;
    for (const size of [18, 16, 15, 14, 13]) {
      const box = this.add.container(0, 0);
      const gap = size >= 16 ? 8 : 5;
      const labelW = size >= 16 ? 192 : 170;
      let y = TOP;
      for (const [label, text] of rows) {
        box.add(this.add.text(48, y, label, textStyle(size, '#f0e0a0')));
        const t = this.add.text(48 + labelW, y, text, textStyle(size, COLORS.textLight, { wordWrap: { width: GAME_WIDTH - 108 - labelW } }));
        box.add(t);
        y += Math.max(t.height, size + 4) + gap;
      }
      const used = y - gap - TOP;
      if (used <= ROOM) return;
      if (size === 13) {
        const k = ROOM / used;
        box.setScale(k).setPosition(48 * (1 - k), TOP * (1 - k));
        return;
      }
      box.destroy(true);
    }
  }

  private copySeed(seed: string): void {
    const done = () => this.status.setText(`Seed "${seed}" copied.`);
    const failed = () => this.status.setText(`Couldn't copy automatically. The seed is: ${seed}`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(seed).then(done, failed);
    else failed();
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
