// Choose a trainer archetype (Red, Blue, Green, and any unlocked in the Trainer Archive).
// More than three trainers scroll sideways.

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
  private strip!: Phaser.GameObjects.Container;
  private cardX: number[] = [];

  constructor() {
    super('TrainerSelect');
  }

  create(): void {
    const { session } = services();
    const archetypes = [...session.content.archetypes.values()].filter(
      (a) => a.available && isArchetypeUnlocked(a, session.profile.unlockedArchetypes),
    );
    this.index = 0;
    this.cursors = [];
    this.cardX = [];
    this.strip = this.add.container(0, 0);

    this.add.text(GAME_WIDTH / 2, 40, 'Choose your trainer', textStyle(44, COLORS.textLight)).setOrigin(0.5);

    const cardW = 280;
    const gap = 24;
    const shown = Math.min(3, archetypes.length);
    const startX = (GAME_WIDTH - (cardW * shown + gap * (shown - 1))) / 2;
    archetypes.forEach((a, i) => {
      const x = startX + i * (cardW + gap);
      const y = 80;
      this.cardX.push(x);
      const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
        this.strip.add(o);
        return o;
      };
      add(drawPanel(this, x, y, cardW, 420));
      const highlight = add(this.add.graphics());
      highlight.lineStyle(6, COLORS.accent, 1);
      highlight.strokeRoundedRect(x - 4, y - 4, cardW + 8, 428, 12);
      this.cursors.push(highlight);
      add(trainerVisual(this, a.spriteAssetId, a.name, x + cardW / 2, y + 190, 2) as Phaser.GameObjects.GameObject);
      add(this.add.text(x + cardW / 2, y + 205, a.name, textStyle(36)).setOrigin(0.5, 0));
      add(this.add.text(x + 16, y + 250, a.description, textStyle(18, COLORS.textMuted, { wordWrap: { width: cardW - 32 } })));
      const pros = a.pros.map((p) => `+ ${p}`).join('\n');
      const cons = a.cons.map((c) => `− ${c}`).join('\n');
      const prosText = add(this.add.text(x + 16, y + 310, pros, textStyle(18, COLORS.good, { wordWrap: { width: cardW - 32 } })));
      add(this.add.text(x + 16, y + 316 + prosText.height, cons, textStyle(18, COLORS.bad, { wordWrap: { width: cardW - 32 } })));

      const hit = add(this.add.zone(x, y, cardW, 420).setOrigin(0).setInteractive({ useHandCursor: true }));
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
      if (action === 'back') this.scene.start('Hub');
    });
  }

  private focus(i: number): void {
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
    // Keep the focused card inside the screen when there are more than three.
    const x = this.cardX[i]! + this.strip.x;
    if (x < 40) this.strip.x += 40 - x;
    if (x + 280 > GAME_WIDTH - 40) this.strip.x -= x + 280 - (GAME_WIDTH - 40);
  }

  private choose(archetypeId: string): void {
    const params = new URLSearchParams(window.location.search);
    // ?seed=... repeats a run; ?campaign=dev plays the short developer campaign.
    const campaign = params.get('campaign') ?? undefined;
    services().session.newRun(archetypeId, params.get('seed') ?? undefined, campaign && services().session.content.campaigns.has(campaign) ? campaign : undefined);
    this.scene.start('StarterSelect');
  }
}
