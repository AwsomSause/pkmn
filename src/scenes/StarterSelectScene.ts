// Choose one of three random first-stage starters.

import Phaser from 'phaser';
import { createPokemon, getSpecies } from '../core/pokemon';
import { services } from '../game/services';
import { onInputAction } from '../ui/input';
import { pokemonVisual } from '../ui/sprites';
import { COLORS, GAME_WIDTH, TYPE_COLORS, textStyle } from '../ui/theme';
import { badge, drawPanel } from '../ui/widgets';
import { sceneForRun } from './routing';

export class StarterSelectScene extends Phaser.Scene {
  private index = 0;
  private cursors: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('StarterSelect');
  }

  create(): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const archetype = content.archetypes.get(run.archetypeId)!;
    this.index = 0;
    this.cursors = [];

    this.add.text(GAME_WIDTH / 2, 36, 'Choose your starter', textStyle(44, COLORS.textLight)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 74, `Trainer: ${archetype.name}  ·  Seed: ${run.seed}`, textStyle(20, '#8090a8')).setOrigin(0.5);

    const cardW = 280;
    const gap = 24;
    const startX = (GAME_WIDTH - (cardW * 3 + gap * 2)) / 2;
    run.starterChoices.forEach((speciesId, i) => {
      const species = getSpecies(content, speciesId);
      const preview = createPokemon(content, speciesId, content.balance.starterLevel, 'preview');
      const x = startX + i * (cardW + gap);
      const y = 100;
      drawPanel(this, x, y, cardW, 400);
      const highlight = this.add.graphics();
      highlight.lineStyle(6, COLORS.accent, 1);
      highlight.strokeRoundedRect(x - 4, y - 4, cardW + 8, 408, 12);
      this.cursors.push(highlight);

      pokemonVisual(this, species, 'front', x + cardW / 2, y + 160, 3.5);
      this.add.text(x + cardW / 2, y + 170, species.name, textStyle(34)).setOrigin(0.5, 0);
      let bx = x + cardW / 2 - (species.types.length * 68) / 2;
      for (const t of species.types) {
        badge(this, bx, y + 212, t, TYPE_COLORS[t] ?? 0x888888);
        bx += 72;
      }
      const b = species.baseStats;
      this.add.text(
        x + 18,
        y + 250,
        `HP ${b.hp}  Atk ${b.atk}  Def ${b.def}\nSpA ${b.spa}  SpD ${b.spd}  Spe ${b.spe}`,
        textStyle(18, COLORS.textMuted),
      );
      const moves = preview.moves.map((m) => content.moves.get(m.id)!.name).join(', ');
      this.add.text(x + 18, y + 310, `Lv ${preview.level} moves:\n${moves}`, textStyle(18, COLORS.text, { wordWrap: { width: cardW - 36 } }));

      const hit = this.add.zone(x, y, cardW, 400).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.focus(i));
      hit.on('pointerdown', () => {
        this.focus(i);
        this.choose(i);
      });
    });
    this.focus(0);

    this.add.text(GAME_WIDTH / 2, 516, '←/→ choose  ·  Enter confirm  ·  Esc menu (run is saved)', textStyle(18, '#8090a8')).setOrigin(0.5);

    onInputAction(this, (action) => {
      if (action === 'left') this.focus((this.index + 2) % 3);
      if (action === 'right') this.focus((this.index + 1) % 3);
      if (action === 'confirm') this.choose(this.index);
      if (action === 'back') this.scene.start('MainMenu');
    });
  }

  private focus(i: number): void {
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
  }

  private choose(i: number): void {
    const run = services().session.chooseStarter(i);
    this.scene.start(sceneForRun(run));
  }
}
