// The growing Hub (left-out 1.5): props appear behind the rooms as Bank tier, Prestige, the Research Tree,
// the Item Museum and achievements grow (core/legacy.ts hubProps). Procedural shapes, presentation only;
// motion follows the battle-animation setting (still when reduced or off).

import Phaser from 'phaser';
import { hubProps } from '../core/legacy';
import type { Profile } from '../core/state';
import { GAME_WIDTH } from './theme';

type Motion = 'full' | 'reduced' | 'off' | string;

/** Draws the props the profile has earned (depth below the UI, above the arena). Returns how many were drawn. */
export function drawHubProps(scene: Phaser.Scene, profile: Profile, motion: Motion): number {
  const props = hubProps(profile);
  const live = motion === 'full';
  const g = scene.add.graphics().setDepth(-15);
  const bob = (obj: Phaser.GameObjects.GameObject, dy: number, ms: number) => {
    if (live) scene.tweens.add({ targets: obj, y: `+=${dy}`, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  };
  for (const prop of props) {
    switch (prop.id) {
      case 'lamps': {
        g.lineStyle(2, 0x2a2438, 0.9);
        g.beginPath();
        g.moveTo(0, 74);
        for (let x = 0; x <= GAME_WIDTH; x += 40) g.lineTo(x, 74 + Math.sin((x / GAME_WIDTH) * Math.PI * 4) * 6);
        g.strokePath();
        for (let x = 40; x < GAME_WIDTH; x += 80) {
          const y = 74 + Math.sin((x / GAME_WIDTH) * Math.PI * 4) * 6;
          const bulb = scene.add.circle(x, y + 6, 5, 0xffe08a, 0.95).setDepth(-14);
          if (live) scene.tweens.add({ targets: bulb, alpha: 0.45, duration: 900 + (x % 7) * 120, yoyo: true, repeat: -1 });
        }
        break;
      }
      case 'plants':
        for (const x of [70, GAME_WIDTH - 70]) {
          g.fillStyle(0x7a4a2a, 1).fillRect(x - 14, 400, 28, 26);
          for (let i = -2; i <= 2; i++) g.fillStyle(0x3f9d4f, 1).fillEllipse(x + i * 10, 384 - Math.abs(i) * 6, 12, 40);
        }
        break;
      case 'banner': {
        const flag = scene.add.graphics().setDepth(-14);
        flag.fillStyle(0xc0392b, 0.95).fillRect(-22, 0, 44, 90).fillStyle(0xf4d35e, 1).fillTriangle(-22, 90, 22, 90, 0, 112).fillCircle(0, 40, 11);
        flag.setPosition(GAME_WIDTH - 60, 100);
        bob(flag, 4, 1600);
        break;
      }
      case 'trophy':
        g.fillStyle(0x2d2540, 0.95).fillRect(GAME_WIDTH - 230, 262, 150, 10);
        for (let i = 0; i < 3; i++) {
          const x = GAME_WIDTH - 205 + i * 50;
          g.fillStyle(0xf4d35e, 1).fillRect(x - 3, 244, 6, 18).fillTriangle(x - 12, 224, x + 12, 224, x, 246).fillRect(x - 9, 258, 18, 4);
        }
        break;
      case 'fountain': {
        const x = 150;
        g.fillStyle(0x8fa6c4, 0.9).fillEllipse(x, 340, 110, 26).fillStyle(0x6ec6ff, 0.85).fillEllipse(x, 336, 90, 16).fillStyle(0xb9d4ee, 1).fillRect(x - 5, 308, 10, 28);
        for (const dx of [-14, 0, 14]) {
          const drop = scene.add.circle(x + dx, 306, 3, 0xcfeaff, 0.9).setDepth(-14);
          if (live) scene.tweens.add({ targets: drop, y: 332, alpha: 0, duration: 800 + (dx + 14) * 20, repeat: -1 });
        }
        break;
      }
      case 'stars':
        for (let i = 0; i < 24; i++) {
          const star = scene.add.circle(20 + ((i * 197) % (GAME_WIDTH - 40)), 90 + ((i * 53) % 120), 1.6, 0xffffff, 0.8).setDepth(-16);
          if (live) scene.tweens.add({ targets: star, alpha: 0.15, duration: 700 + (i % 5) * 300, yoyo: true, repeat: -1 });
        }
        break;
    }
  }
  return props.length;
}
