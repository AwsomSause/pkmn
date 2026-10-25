// Choose a trainer archetype (Red, Blue, Green, and any unlocked later).

import Phaser from 'phaser';
import { isArchetypeUnlocked } from '../core/archetypes';
import { services } from '../game/services';
import { onInputAction } from '../ui/input';
import { trainerVisual } from '../ui/sprites';
import { COLORS, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel } from '../ui/widgets';

export class TrainerSelectScene extends Phaser.Scene {
  private index = 0;
  private cursors: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('TrainerSelect');
  }

  create(): void {
    const { session } = services();
    const archetypes = [...session.content.archetypes.values()].filter((a) =>
      isArchetypeUnlocked(a, session.profile.unlockedArchetypes),
    );
    this.index = 0;
    this.cursors = [];

    this.add.text(GAME_WIDTH / 2, 40, 'Choose your trainer', textStyle(44, COLORS.textLight)).setOrigin(0.5);

    const cardW = 280;
    const gap = 24;
    const startX = (GAME_WIDTH - (cardW * archetypes.length + gap * (archetypes.length - 1))) / 2;
    archetypes.forEach((a, i) => {
      const x = startX + i * (cardW + gap);
      const y = 80;
      drawPanel(this, x, y, cardW, 420);
      const highlight = this.add.graphics();
      highlight.lineStyle(6, COLORS.accent, 1);
      highlight.strokeRoundedRect(x - 4, y - 4, cardW + 8, 428, 12);
      this.cursors.push(highlight);
      trainerVisual(this, a.spriteAssetId, a.name, x + cardW / 2, y + 190, 2);
      this.add.text(x + cardW / 2, y + 205, a.name, textStyle(36)).setOrigin(0.5, 0);
      this.add.text(x + 16, y + 250, a.description, textStyle(18, COLORS.textMuted, { wordWrap: { width: cardW - 32 } }));
      const pros = a.pros.map((p) => `+ ${p}`).join('\n');
      const cons = a.cons.map((c) => `− ${c}`).join('\n');
      const prosText = this.add.text(x + 16, y + 310, pros, textStyle(18, COLORS.good, { wordWrap: { width: cardW - 32 } }));
      this.add.text(x + 16, y + 316 + prosText.height, cons, textStyle(18, COLORS.bad, { wordWrap: { width: cardW - 32 } }));

      const hit = this.add.zone(x, y, cardW, 420).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.focus(i));
      hit.on('pointerdown', () => {
        this.focus(i);
        this.choose(archetypes[i]!.id);
      });
    });
    this.focus(0);

    this.add.text(GAME_WIDTH / 2, 516, '←/→ choose  ·  Enter confirm  ·  Esc back', textStyle(18, '#8090a8')).setOrigin(0.5);

    onInputAction(this, (action) => {
      if (action === 'left') this.focus((this.index + archetypes.length - 1) % archetypes.length);
      if (action === 'right') this.focus((this.index + 1) % archetypes.length);
      if (action === 'confirm') this.choose(archetypes[this.index]!.id);
      if (action === 'back') this.scene.start('MainMenu');
    });
  }

  private focus(i: number): void {
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
  }

  private choose(archetypeId: string): void {
    const params = new URLSearchParams(window.location.search);
    // ?seed=... repeats a run; ?campaign=dev plays the short developer campaign.
    const campaign = params.get('campaign') ?? undefined;
    services().session.newRun(archetypeId, params.get('seed') ?? undefined, campaign && services().session.content.campaigns.has(campaign) ? campaign : undefined);
    this.scene.start('StarterSelect');
  }
}
