// The one screen every minigame uses: a HUD, a prompt and a grid of choices drawn from the game's view (core/minigame).
// Timed games advance on a timer; "S" slows it and "T" pauses it (the accessibility options). Rewards are paid by the
// rules code the moment the game ends; this screen only shows the outcome.

import Phaser from 'phaser';
import { getMinigame, minigameView } from '../core/minigame/flow';
import { services } from '../game/services';
import { bounceIn, floatIdle } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { playSfx } from '../ui/audio';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, Menu } from '../ui/widgets';
import { sceneForRun } from './routing';

const MEDAL_SFX: Record<string, string> = { gold: 'se.shiny', silver: 'se.level_up', bronze: 'se.level_up', none: 'ui.error' };
const MEDAL_COLOR: Record<string, number> = { gold: 0xf5c842, silver: 0xd0d8e0, bronze: 0xd08848, none: 0x707080 };

export class MinigameScene extends Phaser.Scene {
  private menu!: Menu;
  private slow = false;
  private paused = false;

  constructor() {
    super('Minigame');
  }

  create(data?: { focus?: number; slow?: boolean; paused?: boolean }): void {
    const { session } = services();
    const run = session.run!;
    if (run.phase !== 'minigame' || !run.minigame) {
      this.scene.start(sceneForRun(run), { notice: '', focus: 0 });
      return;
    }
    this.slow = data?.slow ?? false;
    this.paused = data?.paused ?? false;
    const def = getMinigame(session.content, run.minigame.id);
    const view = minigameView(session.content, run);
    const outcome = run.minigame.outcome;
    const motion = session.settings.battleAnimations;
    this.add.text(GAME_WIDTH / 2, 22, `${def.name}  ·  ${def.difficultyTiers[run.minigame.tier]!.label}`, textStyle(30, COLORS.textLight)).setOrigin(0.5);
    drawPanel(this, 16, 48, GAME_WIDTH - 32, 96, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });
    this.add.text(28, 54, view.hud.join('   ·   '), textStyle(16, '#f0e0a0', { wordWrap: { width: GAME_WIDTH - 56 } }));
    this.add.text(28, 84, outcome ? outcome.lines.join(' ') : view.prompt, textStyle(17, outcome ? '#a0f0a0' : COLORS.textLight, { wordWrap: { width: GAME_WIDTH - 56 } }));

    if (outcome) this.showMedal(outcome.medal, motion);
    const options = outcome
      ? [{ label: 'Done', detail: 'back to the map', disabled: false }]
      : view.cells.map((c) => ({ label: c.label, detail: c.detail, disabled: c.disabled }));
    const cols = outcome ? 1 : Math.max(1, view.cols);
    const rows = Math.ceil(options.length / cols);
    const itemH = Math.min(52, Math.floor((GAME_HEIGHT - 190 - 30) / rows));
    this.menu = new Menu(this, {
      x: 24, y: 156, columns: cols, itemWidth: Math.floor((GAME_WIDTH - 48) / cols), itemHeight: itemH, fontSize: itemH < 40 ? 16 : 19, color: COLORS.textLight,
      options,
      onSelect: (i) => {
        if (outcome) {
          this.leave();
          return;
        }
        const cell = view.cells[i]!;
        if (cell.disabled) return;
        playSfx(this, 'ui.select');
        const after = session.minigameAct(cell.id);
        playSfx(this, MEDAL_SFX[after.minigame?.outcome?.medal ?? 'pending'] ?? 'se.exp', 0.7);
        this.scene.restart({ focus: i, slow: this.slow, paused: this.paused });
      },
      onBack: () => this.leave(),
    });
    if (data?.focus !== undefined && !outcome) this.menu.index = Math.min(data.focus, options.length - 1);

    const tickMs = def.uiConfiguration.tickMs;
    if (!outcome && tickMs > 0 && !view.done) {
      const delay = tickMs * (this.slow ? def.accessibilityOptions.slowFactor : 1);
      if (!this.paused) {
        this.time.delayedCall(delay, () => {
          session.minigameTick();
          this.scene.restart({ focus: this.menu.index, slow: this.slow, paused: this.paused });
        });
      }
    }
    const hints = ['Enter choose', 'Esc leave (forfeits)'];
    if (tickMs > 0) hints.push(this.slow ? 'S normal speed' : 'S slow down');
    if (tickMs > 0 && def.accessibilityOptions.noTimerOption) hints.push(this.paused ? 'T resume' : 'T pause');
    this.add.text(16, GAME_HEIGHT - 22, hints.join('  ·  '), textStyle(14, '#8a7f96'));
    this.input.keyboard?.on('keydown-S', () => this.scene.restart({ focus: this.menu.index, slow: !this.slow, paused: this.paused }));
    this.input.keyboard?.on('keydown-T', () => {
      if (def.accessibilityOptions.noTimerOption) this.scene.restart({ focus: this.menu.index, slow: this.slow, paused: !this.paused });
    });
    onInputAction(this, (a) => this.menu.handle(a));
  }

  /** A glossy medal that bounces in when the game ends (still when motion is off). */
  private showMedal(medal: string, motion: 'full' | 'reduced' | 'off'): void {
    const g = this.add.container(GAME_WIDTH - 70, 96);
    const disc = this.add.graphics();
    disc.fillStyle(MEDAL_COLOR[medal] ?? 0x707080, 1).fillCircle(0, 0, 30);
    disc.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, 30);
    disc.fillStyle(0xffffff, 0.35).fillEllipse(-8, -12, 24, 12);
    g.add([disc, this.add.text(0, 0, medal === 'none' ? '–' : '★', textStyle(28, '#ffffff')).setOrigin(0.5)]);
    bounceIn(this, g, motion);
    floatIdle(this, g, motion, 3);
  }

  private leave(): void {
    const { session } = services();
    const finished = session.run!.minigame?.outcome != null;
    const run = session.leaveMinigame();
    this.scene.start(sceneForRun(run), { notice: finished ? '' : 'You left the minigame.', focus: 0 });
  }
}
