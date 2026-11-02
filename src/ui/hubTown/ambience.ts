// Hub Town ambience (spec §9): glints that twinkle on the lake, ponds and canal, and petals drifting by the cherry
// trees. Presentation only, from a view RNG; full motion only (reduced and off keep the water still).

import Phaser from 'phaser';
import { HUB_TOWN } from '../../core/hubTown/schema';
import { viewRandom } from '../../core/legacyRuns';
import type { HubTownView } from './townView';

const T = HUB_TOWN.tile;

/** Draws the ambience into the town. Returns how many moving bits it made (0 when motion is not full). */
export function drawAmbience(town: HubTownView, scene: Phaser.Scene, motion: string): number {
  if (motion !== 'full') return 0;
  const roll = viewRandom('hubtown-ambience');
  let made = 0;
  town.world(() => {
    for (const [wx, wy, ww, wh] of HUB_TOWN.water) {
      const glints = Math.max(2, Math.round((ww * wh) / 6));
      for (let i = 0; i < glints; i++) {
        const x = (wx + 0.6 + roll() * (ww - 1.2)) * T;
        const y = (wy + 0.6 + roll() * (wh - 1.2)) * T;
        const g = scene.add.rectangle(x, y, 6, 2, 0xffffff, 0).setDepth(9);
        scene.tweens.add({ targets: g, alpha: { from: 0, to: 0.85 }, scaleX: { from: 0.4, to: 1.4 }, duration: 700 + roll() * 600, delay: roll() * 3000, yoyo: true, repeat: -1, repeatDelay: 1500 + roll() * 3000 });
        made++;
      }
    }
    // Petals: a few drift down-wind across the sanctuary and the plaza, then start again.
    const zones = ['sanctuary', 'plaza', 'flowers'].map((z) => HUB_TOWN.zones[z]).filter((z): z is [number, number, number, number] => Boolean(z));
    for (const [zx, zy, zw, zh] of zones) {
      for (let i = 0; i < 6; i++) {
        const x = (zx + roll() * zw) * T;
        const y = (zy + roll() * zh) * T;
        const petal = scene.add.ellipse(x, y, 5, 3, roll() < 0.5 ? 0xffc0d8 : 0xffffff, 0.9).setDepth(10 + (zy + zh) * T + 500);
        scene.tweens.add({ targets: petal, x: x + 90 + roll() * 60, y: y + 50 + roll() * 40, angle: 360, alpha: { from: 0.9, to: 0 }, duration: 5000 + roll() * 3000, delay: roll() * 4000, repeat: -1 });
        made++;
      }
    }
  });
  return made;
}
