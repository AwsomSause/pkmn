// Draws the environmental-storytelling hints (core/presentation/environmentStory.ts)
// behind the battlers, from simple shapes so no new art is needed: storm clouds
// with lightning, a crisis haze, a villain team's banners, broken pillars of old
// ruins, lab light panels, and a purple miasma. Presentation only; motion follows
// the battle animation setting (off: nothing drawn).

import type Phaser from 'phaser';
import type { EnvStory } from '../../core/presentation/environmentStory';
import type { MotionLevel } from '../aero';

export function addEnvironment(scene: Phaser.Scene, field: Phaser.GameObjects.Container, at: number, story: EnvStory, motion: MotionLevel): Phaser.GameObjects.GameObject[] {
  if (motion === 'off') return [];
  const W = scene.scale.width;
  const moving = motion === 'full';
  const objs: Phaser.GameObjects.GameObject[] = [];
  const put = <T extends Phaser.GameObjects.GameObject>(o: T, name: string): T => {
    o.setName(`env-${name}`);
    field.addAt(o, at + objs.length);
    objs.push(o);
    return o;
  };
  for (const hint of story.hints) {
    switch (hint) {
      case 'storm': {
        const g = put(scene.add.graphics(), 'storm');
        g.fillStyle(0x202838, 0.55);
        for (let i = 0; i < 7; i++) g.fillEllipse(70 + i * 140, 26 + (i % 2) * 18, 220, 70);
        const flash = put(scene.add.rectangle(0, 0, W, 200, 0xffffff, 0).setOrigin(0), 'storm-flash');
        if (moving) scene.tweens.add({ targets: flash, alpha: { from: 0.35, to: 0 }, duration: 140, repeat: -1, repeatDelay: 3400, delay: 900 });
        break;
      }
      case 'haze': {
        const haze = put(scene.add.rectangle(0, 0, W, 260, 0x8a7060, 0.18).setOrigin(0), 'haze');
        if (moving) scene.tweens.add({ targets: haze, alpha: 0.3, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'faction': {
        const c = story.factionColor ?? 0x606060;
        [60, W - 60].forEach((x, i) => {
          const g = put(scene.add.graphics({ x, y: 40 }), 'faction');
          g.fillStyle(0x303030, 0.9).fillRect(-3, 0, 6, 150);
          g.fillStyle(c, 0.85).fillTriangle(3, 6, 64 * (i ? -1 : 1) + 3, 30, 3, 58);
          if (moving) scene.tweens.add({ targets: g, scaleX: 0.9, duration: 900 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        break;
      }
      case 'ruins': {
        const g = put(scene.add.graphics(), 'ruins');
        g.fillStyle(0x6a6458, 0.5);
        [[110, 120, 26, 90], [170, 150, 22, 60], [W - 150, 110, 28, 100], [W - 96, 160, 20, 50]].forEach(([x, y, w, h]) => g.fillRect(x!, y!, w!, h!));
        g.fillStyle(0x6a6458, 0.5).fillRect(96, 112, 100, 10);
        break;
      }
      case 'lab': {
        const g = put(scene.add.graphics(), 'lab');
        for (let i = 0; i < 4; i++) {
          g.fillStyle(0x80f0ff, 0.12).fillRect(40 + i * 240, 30, 120, 44);
          g.lineStyle(1, 0x80f0ff, 0.35).strokeRect(40 + i * 240, 30, 120, 44);
        }
        if (moving) scene.tweens.add({ targets: g, alpha: 0.6, duration: 700, yoyo: true, repeat: -1, ease: 'Stepped' });
        break;
      }
      case 'corrupted': {
        const mist = put(scene.add.ellipse(W / 2, 260, W * 1.2, 220, 0x7030a0, 0.16), 'corrupted');
        if (moving) scene.tweens.add({ targets: mist, scaleX: 1.08, alpha: 0.26, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
    }
  }
  return objs;
}
