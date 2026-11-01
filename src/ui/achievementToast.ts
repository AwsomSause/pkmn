// A glass banner that drops from the top when an achievement is earned mid-run. Presentation only:
// the reward was already paid (core/progress.ts awardLiveAchievements).

import Phaser from 'phaser';
import { interactionLog } from '../core/presentation/uiPrefs';
import type { Achievement } from '../core/contentSchema';
import type { MotionLevel } from './aero';
import { COLORS, GAME_WIDTH, textStyle } from './theme';
import { drawPanel } from './widgets';

export function showAchievementToasts(scene: Phaser.Scene, list: readonly Achievement[], motion: MotionLevel): void {
  list.forEach((a) => interactionLog.add(`Achievement: ${a.name}`));
  list.slice(0, 3).forEach((a, i) => {
    const box = scene.add.container(GAME_WIDTH / 2, -60).setDepth(1000);
    const panel = drawPanel(scene, -230, 0, 460, 52, { fill: COLORS.panelDark, border: 0xf8d048 });
    const title = scene.add.text(-214, 6, `Achievement: ${a.name}`, textStyle(17, '#f8d048'));
    const reward = a.reward.bankCredits ? `+${a.reward.bankCredits} credits${a.reward.title ? ` · title ${a.reward.title}` : ''}` : a.reward.title ? `Title ${a.reward.title}` : '';
    const sub = scene.add.text(-214, 28, `${a.description}${reward ? `  ${reward}` : ''}`, textStyle(13, COLORS.textMuted, { wordWrap: { width: 430 } }));
    box.add([panel, title, sub]);
    const y = 8 + i * 58;
    if (motion === 'off') {
      box.setY(y);
      scene.time.delayedCall(3500, () => box.destroy());
      return;
    }
    scene.tweens.add({ targets: box, y, duration: motion === 'full' ? 420 : 1, ease: 'Back.easeOut', delay: i * 350 });
    scene.tweens.add({ targets: box, y: -70, alpha: 0, duration: 300, delay: 3800 + i * 350, onComplete: () => box.destroy() });
  });
}
