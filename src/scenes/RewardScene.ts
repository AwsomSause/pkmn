// The five-choice reward draft. The player must take exactly one.

import Phaser from 'phaser';
import { calcStats, getSpecies } from '../core/pokemon';
import { services } from '../game/services';
import { playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { itemVisual, pokemonVisual } from '../ui/sprites';
import { COLORS, GAME_WIDTH, STATUS_LABELS, textStyle } from '../ui/theme';
import { drawPanel } from '../ui/widgets';

export class RewardScene extends Phaser.Scene {
  private index = 0;
  private cursors: Phaser.GameObjects.Graphics[] = [];
  private chosen = false;

  constructor() {
    super('Reward');
  }

  create(): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const draft = run.draft!;
    this.index = 0;
    this.cursors = [];
    this.chosen = false;

    this.add.text(GAME_WIDTH / 2, 34, 'Choose one reward', textStyle(44, COLORS.textLight)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 72, `Encounter ${run.encountersCompleted} cleared  ·  ₽${run.money}`, textStyle(20, '#8090a8'))
      .setOrigin(0.5);

    const cardW = 172;
    const gap = 12;
    const startX = (GAME_WIDTH - (cardW * draft.length + gap * (draft.length - 1))) / 2;
    draft.forEach((rewardId, i) => {
      const reward = content.rewards.get(rewardId)!;
      const x = startX + i * (cardW + gap);
      const y = 100;
      const rarityColor = COLORS.rarity[reward.rarity] ?? 0x808080;
      drawPanel(this, x, y, cardW, 280, { border: rarityColor });
      const highlight = this.add.graphics();
      highlight.lineStyle(6, COLORS.accent, 1);
      highlight.strokeRoundedRect(x - 5, y - 5, cardW + 10, 290, 12);
      this.cursors.push(highlight);
      itemVisual(this, reward.iconAssetId, x + cardW / 2, y + 50, 2.5);
      this.add.text(x + cardW / 2, y + 92, reward.name, textStyle(24, COLORS.text, { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 0);
      this.add
        .text(x + cardW / 2, y + 126, reward.rarity.toUpperCase(), textStyle(16, Phaser.Display.Color.IntegerToColor(rarityColor).rgba))
        .setOrigin(0.5, 0);
      this.add.text(x + 12, y + 152, reward.description, textStyle(17, COLORS.textMuted, { wordWrap: { width: cardW - 24 } }));

      const hit = this.add.zone(x, y, cardW, 280).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.focus(i));
      hit.on('pointerdown', () => {
        this.focus(i);
        this.choose(i);
      });
    });
    this.focus(0);

    // Lead Pokémon summary so the choice is informed.
    const lead = run.party[0]!;
    const species = getSpecies(content, lead.speciesId);
    const stats = calcStats(content, lead);
    drawPanel(this, 80, 400, GAME_WIDTH - 160, 104, { fill: COLORS.panelDark, border: 0x101420 });
    pokemonVisual(this, species, 'front', 150, 496, 2.2);
    const status = lead.status ? `  ${STATUS_LABELS[lead.status.id]!.label}` : '';
    const pp = lead.moves.map((m) => `${content.moves.get(m.id)!.name} ${m.pp}/${content.moves.get(m.id)!.pp}`).join('   ');
    this.add.text(220, 412, `${species.name}  Lv${lead.level}   HP ${lead.hp}/${stats.hp}${status}`, textStyle(24, COLORS.textLight));
    this.add.text(220, 446, pp, textStyle(17, '#c8d0e0', { wordWrap: { width: 640 } }));

    this.add.text(GAME_WIDTH / 2, 522, '←/→ choose  ·  Enter take reward', textStyle(16, '#8090a8')).setOrigin(0.5);

    onInputAction(this, (action) => {
      if (this.chosen) return;
      if (action === 'left') this.focus((this.index + draft.length - 1) % draft.length);
      if (action === 'right') this.focus((this.index + 1) % draft.length);
      if (action === 'confirm') this.choose(this.index);
    });
  }

  private focus(i: number): void {
    if (i !== this.index) playSfx(this, 'ui.select', 0.5);
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
  }

  private choose(i: number): void {
    if (this.chosen) return;
    this.chosen = true;
    const result = services().session.chooseReward(i);
    playSfx(this, 'se.level_up', 0.6);
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, 540, 0x000000, 0.7).setOrigin(0);
    const text = this.add.text(GAME_WIDTH / 2, 250, `${result.reward.message}\n\nOn to encounter ${result.run.encountersCompleted + 1}…`, textStyle(30, COLORS.textLight, { align: 'center' })).setOrigin(0.5);
    void overlay;
    void text;
    this.time.delayedCall(1300, () => this.scene.start('Battle'));
  }
}
