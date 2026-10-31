// Arena life: slow drifting layers over the battle background, one preset
// per type (Visual Bible §4.3): leaves and sun for Grass, embers for Fire,
// bubbles for Water, sparks for Electric, snow for Ice, wisps for Ghost…
// A two-type stage keeps its first type's preset and adds a few accent
// particles of the second. Art from the EBDX battle scenery and the Deluxe
// Battle Kit.
//
// Presentation only, and only with full battle animations: reduced motion
// shows a still layer, "off" shows nothing. Layouts are fixed (no random
// numbers at all), so nothing here touches gameplay rolls.

import type Phaser from 'phaser';
import { services } from '../../game/services';
import type { MotionLevel } from '../aero';

type Flow = 'rise' | 'fall' | 'drift' | 'twinkle';

interface Preset {
  /** Particle texture. */
  particle: string;
  tint?: number;
  flow: Flow;
  count: number;
  /** Particle size multiplier. */
  size: number;
  additive?: boolean;
  clouds?: boolean;
  rays?: boolean;
  fog?: 'light' | 'dark';
}

const P = 'pack.dbk.particle';
const STAR = 'pack.ebdx.star';

export const AMBIENCE: Record<string, Preset> = {
  normal: { particle: P, tint: 0xfff6c0, flow: 'drift', count: 6, size: 0.2, additive: true, clouds: true, rays: true },
  grass: { particle: P, tint: 0xb8f080, flow: 'drift', count: 10, size: 0.22, additive: true, clouds: true, rays: true },
  bug: { particle: P, tint: 0xf0f070, flow: 'twinkle', count: 12, size: 0.14, additive: true, rays: true },
  fire: { particle: P, tint: 0xffa040, flow: 'rise', count: 14, size: 0.22, additive: true },
  water: { particle: 'pack.ebdx.bubble', flow: 'rise', count: 12, size: 1.6, rays: true },
  electric: { particle: STAR, tint: 0xfff070, flow: 'twinkle', count: 12, size: 3, additive: true },
  ice: { particle: 'pack.ebdx.snow', flow: 'fall', count: 16, size: 1.6, fog: 'light' },
  fighting: { particle: P, tint: 0xd8c8a8, flow: 'drift', count: 6, size: 0.2 },
  poison: { particle: 'pack.ebdx.bubbleDark', tint: 0xd080ff, flow: 'rise', count: 10, size: 1.6 },
  ground: { particle: P, tint: 0xe0c068, flow: 'drift', count: 10, size: 0.16 },
  rock: { particle: P, tint: 0xc0a060, flow: 'fall', count: 6, size: 0.18 },
  flying: { particle: P, tint: 0xffffff, flow: 'drift', count: 8, size: 0.18, additive: true, clouds: true },
  psychic: { particle: STAR, tint: 0xff80c0, flow: 'twinkle', count: 12, size: 3, additive: true },
  ghost: { particle: STAR, tint: 0xb090ff, flow: 'twinkle', count: 8, size: 3, additive: true, fog: 'dark' },
  dragon: { particle: STAR, tint: 0x9070ff, flow: 'twinkle', count: 8, size: 3, additive: true, rays: true },
  dark: { particle: STAR, tint: 0xc0b0d0, flow: 'twinkle', count: 6, size: 2, fog: 'dark' },
  steel: { particle: STAR, tint: 0xe0e8ff, flow: 'twinkle', count: 8, size: 2.5, additive: true },
  fairy: { particle: STAR, tint: 0xffb0e0, flow: 'twinkle', count: 14, size: 3, additive: true, rays: true },
};

/** The type an arena background stands for, when the stage's types aren't known ("bg.arena.sea" → water). */
export function arenaType(arenaId: string): string {
  const name = arenaId.replace(/^bg\.arena\./, '');
  const table: [RegExp, string][] = [
    [/sea/, 'water'], [/swamp/, 'poison'], [/ice/, 'ice'], [/volcano/, 'fire'], [/graveyard/, 'ghost'], [/abyss/, 'dark'],
    [/cave/, 'rock'], [/fairy/, 'fairy'], [/power/, 'electric'], [/factory/, 'steel'], [/desert/, 'ground'], [/dojo/, 'fighting'],
    [/mountain/, 'flying'], [/forest/, 'bug'], [/ruins/, 'psychic'], [/wasteland/, 'dragon'], [/grass|tall/, 'grass'],
  ];
  return table.find(([re]) => re.test(name))?.[1] ?? 'normal';
}

/** Fixed pseudo-random sequence (no gameplay RNG): golden-ratio steps. */
const spread = (i: number) => (i * 0.6180339887) % 1;

type Put = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

/**
 * Adds the ambience for a stage's types to the field container just above
 * the background (at index `at`). Returns the objects it added.
 */
export function addAmbience(scene: Phaser.Scene, field: Phaser.GameObjects.Container, at: number, types: readonly string[], motion: MotionLevel): Phaser.GameObjects.GameObject[] {
  if (motion === 'off') return [];
  const main = AMBIENCE[types[0] ?? 'normal'] ?? AMBIENCE.normal!;
  const accent = types[1] && types[1] !== types[0] ? AMBIENCE[types[1]] : undefined;
  const W = scene.scale.width;
  const moving = motion === 'full';
  const objs: Phaser.GameObjects.GameObject[] = [];
  const has = (key: string) => scene.textures.exists(key);
  const put: Put = (o) => {
    field.addAt(o, at + objs.length);
    objs.push(o);
    return o;
  };

  if (main.clouds && has('pack.ebdx.cloud1')) {
    ['pack.ebdx.cloud1', 'pack.ebdx.cloud2'].forEach((key, i) => {
      const cloud = put(scene.add.tileSprite(0, 40 + i * 34, W, 18, key).setOrigin(0).setScale(1, 2).setAlpha(0.55 - i * 0.15));
      if (moving) scene.tweens.add({ targets: cloud, tilePositionX: 384, duration: 60_000 + i * 25_000, repeat: -1 });
    });
  }
  if (main.rays && has('pack.ebdx.lightA')) {
    [0.18, 0.55, 0.82].forEach((fx, i) => {
      const ray = put(scene.add.image(W * fx, -10, i % 2 ? 'pack.ebdx.lightB' : 'pack.ebdx.lightA').setOrigin(0.5, 0).setScale(2, 2.2).setAlpha(0.25).setBlendMode('ADD'));
      if (moving) scene.tweens.add({ targets: ray, alpha: 0.5, duration: 2600 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }
  if (main.fog && has('pack.ebdx.fog')) {
    const fog = put(scene.add.tileSprite(0, 160, W, 120, 'pack.ebdx.fog').setOrigin(0).setAlpha(main.fog === 'dark' ? 0.35 : 0.25));
    if (main.fog === 'dark') fog.setTint(0x6050a0);
    if (moving) scene.tweens.add({ targets: fog, tilePositionX: 708, duration: 90_000, repeat: -1 });
  }
  if (!services().session.settings.reduceParticles) {
    particles(scene, put, main, main.count, 0, moving);
    if (accent) particles(scene, put, accent, 4, 50, moving);
  }
  return objs;
}

function particles(scene: Phaser.Scene, put: Put, preset: Preset, count: number, seed: number, moving: boolean): void {
  if (!scene.textures.exists(preset.particle)) return;
  const W = scene.scale.width;
  for (let n = 0; n < count; n++) {
    const i = n + seed;
    const x = 20 + spread(i + 1) * (W - 40);
    const y = 30 + spread(i * 3 + 2) * 300;
    const p = put(scene.add.image(x, y, preset.particle).setAlpha(0.7).setScale(preset.size * (0.7 + spread(i + 7) * 0.6)));
    if (preset.tint !== undefined) p.setTint(preset.tint);
    if (preset.additive) p.setBlendMode('ADD');
    if (!moving) continue;
    const dur = 5000 + spread(i + 11) * 5000;
    if (preset.flow === 'twinkle') {
      scene.tweens.add({ targets: p, alpha: 0.1, duration: dur / 4, yoyo: true, repeat: -1, delay: spread(i + 5) * 2000, ease: 'Sine.easeInOut' });
      continue;
    }
    if (preset.flow === 'drift') {
      scene.tweens.add({ targets: p, x: x + 60 + spread(i) * 60, y: y - 20, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      continue;
    }
    const down = preset.flow === 'fall';
    const fromY = down ? -10 : 380;
    const toY = down ? 380 : -10;
    p.y = fromY + (toY - fromY) * spread(i + 3);
    const sway = (down ? 40 : 20) * (i % 2 ? 1 : -1);
    // Cross the rest of the screen once, then loop edge to edge.
    scene.tweens.add({
      targets: p,
      y: toY,
      x: x + sway,
      duration: (dur * Math.abs(toY - p.y)) / 390,
      ease: 'Linear',
      onComplete: () => {
        p.setPosition(x, fromY);
        scene.tweens.add({ targets: p, y: toY, x: x + sway, duration: dur, repeat: -1, ease: 'Linear' });
      },
    });
  }
}
