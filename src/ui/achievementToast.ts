// A glass banner that drops from the top when an achievement is earned mid-run. Presentation only:
// the reward was already paid (core/progress.ts awardLiveAchievements).

import Phaser from 'phaser';
import { interactionLog } from '../core/presentation/uiPrefs';
import type { Achievement } from '../core/contentSchema';
import type { MotionLevel } from './aero';
import { COLORS, GAME_WIDTH, textStyle } from './theme';
import { drawPanel } from './widgets';

/** One warm line per achievement category for the tap-open story (presentation only). */
const CATEGORY_STORY: Record<string, string> = {
  campaign: 'You went further than you did before.',
  collection: 'Each Pokémon you meet becomes part of the world you are mapping.',
  battle: "Every win on the road is one more chapter in your team's story.",
  exploration: 'The map has a few more names on it now, thanks to you.',
  economy: 'Coins come and go. This one counts.',
  roguelike: 'Not many choose the hard way. You did.',
  relationship: 'Friends make the road shorter.',
  secret: 'Some things only show themselves to the curious.',
  endgame: 'You stood at the top and looked down the road behind you.',
};
/** Rarity tiers (F104): the achievement's tier sets the trim color and a label (Common, Uncommon, Rare, Epic, Legendary). */
export const RARITY = [
  { name: 'Common', border: 0xf8d048, text: '#f8d048' },
  { name: 'Uncommon', border: 0x78e080, text: '#78e080' },
  { name: 'Rare', border: 0x5ac8fa, text: '#5ac8fa' },
  { name: 'Epic', border: 0xa78bfa, text: '#a78bfa' },
  { name: 'Legendary', border: 0xff7ad9, text: '#ff7ad9' },
] as const;
export const rarityOf = (a: Pick<Achievement, 'tier'>): (typeof RARITY)[number] => RARITY[Math.max(0, Math.min(RARITY.length - 1, (a.tier ?? 1) - 1))]!;

export function showAchievementToasts(scene: Phaser.Scene, list: readonly Achievement[], motion: MotionLevel): void {
  list.forEach((a) => interactionLog.add(`Achievement: ${a.name}`));
  list.slice(0, 3).forEach((a, i) => {
    const box = scene.add.container(GAME_WIDTH / 2, -60).setDepth(1000);
    const panel = drawPanel(scene, -230, 0, 460, 52, { fill: COLORS.panelDark, border: rarityOf(a).border });
    const title = scene.add.text(-214, 6, `${rarityOf(a).name} achievement: ${a.name}`, textStyle(17, rarityOf(a).text));
    const reward = a.reward.bankCredits ? `+${a.reward.bankCredits} credits${a.reward.title ? ` · title ${a.reward.title}` : ''}` : a.reward.title ? `Title ${a.reward.title}` : '';
    const sub = scene.add.text(-214, 28, `${a.description}${reward ? `  ${reward}` : ''}`, textStyle(13, COLORS.textMuted, { wordWrap: { width: 430 } }));
    box.add([panel, title, sub]);
    // W10 (I407): tapping a toast opens the story behind it and keeps it up until tapped again.
    let open = false;
    const story = scene.add.text(-214, 56, `${CATEGORY_STORY[a.category] ?? 'A milestone on your road.'}  Tap to close.`, textStyle(12, '#c8e0ff', { wordWrap: { width: 430 } })).setVisible(false);
    box.add(story);
    box.setSize(460, 52).setInteractive(new Phaser.Geom.Rectangle(-230, 0, 460, 52), Phaser.Geom.Rectangle.Contains);
    box.on('pointerdown', () => {
      open = !open;
      story.setVisible(open);
      if (open) scene.tweens.killTweensOf(box);
      else box.destroy();
    });
    const y = 8 + i * 58;
    if (motion === 'off') {
      box.setY(y);
      scene.time.delayedCall(3500, () => { if (!open) box.destroy(); });
      return;
    }
    scene.tweens.add({ targets: box, y, duration: motion === 'full' ? 420 : 1, ease: 'Back.easeOut', delay: i * 350 });
    scene.tweens.add({ targets: box, y: -70, alpha: 0, duration: 300, delay: 3800 + i * 350, onComplete: () => { if (!open) box.destroy(); } });
  });
}
