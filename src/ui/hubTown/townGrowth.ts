// The growing Hub (left-out 1.5) in Hub Town: the props the profile earned (core/legacy.ts hubProps: Bank tier,
// Prestige, the Research Tree, the Item Museum, achievements) now appear around the Trainer Plaza.
// Presentation only; motion follows the animation setting (still when reduced or off).

import Phaser from 'phaser';
import { overworldAssetIds } from '../../assets/catalog';
import { hubProps } from '../../core/legacy';
import { HUB_TOWN } from '../../core/hubTown/schema';
import type { Profile } from '../../core/state';
import type { HubTownView } from './townView';

const T = HUB_TOWN.tile;
/** The plaza square (tiles), from tools/hubtown/layout.py. */
const PLAZA = { x: 45, y: 33, w: 24, h: 16 };
/** The grand fountain's spout (px). */
const SPOUT = { x: 55.6 * T, y: 37.2 * T };

/** Draws the earned props into the town. Returns how many were drawn. */
export function drawTownGrowth(town: HubTownView, scene: Phaser.Scene, profile: Profile, motion: string): number {
  const props = hubProps(profile);
  const live = motion === 'full';
  const left = PLAZA.x * T;
  const right = (PLAZA.x + PLAZA.w) * T;
  const top = PLAZA.y * T;
  const bottom = (PLAZA.y + PLAZA.h) * T;
  town.world(() => {
    for (const prop of props) {
      switch (prop.id) {
        case 'lamps': {
          // A string of lanterns across the top and bottom of the plaza.
          for (const y of [top + 10, bottom - 22]) {
            const g = scene.add.graphics().setDepth(10 + y + 200);
            g.lineStyle(2, 0x3a3048, 0.85).beginPath();
            const pts: [number, number][] = [];
            for (let x = left; x <= right; x += 16) pts.push([x, y + Math.sin(((x - left) / (right - left)) * Math.PI * 3) * 10]);
            g.moveTo(pts[0]![0], pts[0]![1]);
            for (const [x, py] of pts) g.lineTo(x, py);
            g.strokePath();
            pts.forEach(([x, py], i) => {
              if (i % 3) return;
              const bulb = scene.add.circle(x, py + 6, 5, [0xffe08a, 0xff9fc4, 0x9fe0ff][i % 9 / 3]!, 0.95).setDepth(10 + y + 201);
              if (live) scene.tweens.add({ targets: bulb, alpha: 0.45, duration: 900 + (i % 7) * 130, yoyo: true, repeat: -1 });
            });
          }
          break;
        }
        case 'plants':
          for (const [x, y] of [[left + 2, top + 76], [right - 34, top + 76], [left + 2, bottom - 100], [right - 34, bottom - 100]] as const)
            scene.add.image(x, y, overworldAssetIds.props, 'flowerbox').setOrigin(0, 0).setDepth(10 + y + 60);
          break;
        case 'banner':
          for (const x of [left + 3 * T, right - 4 * T]) scene.add.image(x, bottom - 4 * T, overworldAssetIds.props, 'banner').setOrigin(0, 0).setDepth(10 + bottom);
          break;
        case 'trophy':
          // Two more statues in front of the Achievement Hall.
          for (const x of [33 * T, 40 * T]) scene.add.image(x, 15.4 * T, overworldAssetIds.props, 'statue').setOrigin(0, 0).setDepth(10 + 20 * T);
          break;
        case 'fountain': {
          // The fountain sprays: little arcs of water drops.
          for (let i = 0; i < 10; i++) {
            const drop = scene.add.circle(SPOUT.x, SPOUT.y, 3, 0xcfefff, 0.9).setDepth(10 + 46 * T);
            if (!live) {
              drop.setPosition(SPOUT.x + (i - 5) * 6, SPOUT.y - 18 + Math.abs(i - 5) * 3);
              continue;
            }
            const dx = (i % 2 ? 1 : -1) * (20 + (i % 5) * 9);
            scene.tweens.add({ targets: drop, x: SPOUT.x + dx, duration: 900, delay: i * 90, repeat: -1 });
            scene.tweens.add({ targets: drop, y: { from: SPOUT.y, to: SPOUT.y - 40 }, duration: 450, delay: i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
          }
          break;
        }
        case 'stars':
          // Sparkles drift over the plaza.
          for (let i = 0; i < 18; i++) {
            const x = left + ((i * 137) % (right - left));
            const y = top + ((i * 89) % (bottom - top));
            const star = scene.add.star(x, y, 4, 2, 6, 0xffffff, 0.9).setDepth(10 + bottom + 300);
            if (live) scene.tweens.add({ targets: star, alpha: 0.1, scale: 0.6, angle: 90, duration: 1100 + (i % 5) * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
          break;
      }
    }
  });
  return props.length;
}
