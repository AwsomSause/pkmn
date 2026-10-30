// The ending credits after a won run. Enter, Esc or a click leaves; the roll
// is only decoration, so Reduced motion / Off shows it all at once.

import Phaser from 'phaser';
import { buildCredits } from '../core/credits';
import { services } from '../game/services';
import { onInputAction } from '../ui/input';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create(): void {
    const { session } = services();
    const run = session.run;
    const lines = run ? buildCredits(session.content, run) : [];
    const roll = session.settings.battleAnimations === 'full';
    const style: Record<string, [number, string]> = { title: [40, '#f0d060'], heading: [26, '#7ff3ff'], text: [20, '#ffffff'], gap: [20, '#ffffff'] };
    let y = roll ? GAME_HEIGHT + 20 : 24;
    const step = roll ? 34 : 17;
    const items: Phaser.GameObjects.Text[] = [];
    for (const l of lines) {
      if (l.kind !== 'gap') {
        const [size, color] = style[l.kind]!;
        items.push(this.add.text(GAME_WIDTH / 2, y, l.text, textStyle(roll ? size : Math.min(size, 15), color, { align: 'center', wordWrap: { width: GAME_WIDTH - 80 } })).setOrigin(0.5, 0));
      }
      y += l.kind === 'gap' ? step : step + (l.kind === 'title' ? 14 : 0);
    }
    if (roll) {
      const last = items[items.length - 1];
      const distance = y + 40;
      this.tweens.add({ targets: items, y: `-=${distance}`, duration: distance * 28, ease: 'Linear', onComplete: () => last && this.leave() });
    }
    this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 8, 'Enter: skip', textStyle(14, '#a8c8e8')).setOrigin(1, 1).setDepth(10);
    let ready = false;
    this.time.delayedCall(400, () => (ready = true));
    onInputAction(this, (a) => {
      if (ready && (a === 'confirm' || a === 'back')) this.leave();
    });
    this.input.on('pointerdown', () => ready && this.leave());
  }

  private leave(): void {
    this.scene.start('GameOver', { afterCredits: true });
  }
}
