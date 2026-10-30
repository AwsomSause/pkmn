// Arena life: slow drifting layers over the battle background (clouds and
// light rays in the open, bubbles by the sea, snow on ice, embers on a
// volcano, stars and mist in dark places). Art from the EBDX battle scenery.
//
// Presentation only, and only with full battle animations: reduced motion
// shows a still layer, "off" shows nothing. Layouts are fixed (no random
// numbers at all), so nothing here touches gameplay rolls.

import type Phaser from 'phaser';
import type { MotionLevel } from '../aero';

export type AmbienceKind = 'open' | 'water' | 'snow' | 'ember' | 'dark' | 'sparkle';

/** Picks the ambience for an arena background id ("bg.arena.sea" → water). */
export function ambienceFor(arenaId: string): AmbienceKind {
  const name = arenaId.replace(/^bg\.arena\./, '');
  if (/sea|swamp/.test(name)) return 'water';
  if (/ice/.test(name)) return 'snow';
  if (/volcano|wasteland/.test(name)) return 'ember';
  if (/abyss|cave|graveyard|ruins|space/.test(name)) return 'dark';
  if (/fairy|power|factory/.test(name)) return 'sparkle';
  return 'open';
}

/** Fixed pseudo-random sequence (no gameplay RNG): golden-ratio steps. */
const spread = (i: number) => (i * 0.6180339887) % 1;

/**
 * Adds the ambience layers to the field container just above the background
 * (at index `at`). Returns the objects so the scene can clear them.
 */
export function addAmbience(scene: Phaser.Scene, field: Phaser.GameObjects.Container, at: number, kind: AmbienceKind, motion: MotionLevel): Phaser.GameObjects.GameObject[] {
  if (motion === 'off') return [];
  const W = scene.scale.width;
  const moving = motion === 'full';
  const objs: Phaser.GameObjects.GameObject[] = [];
  const has = (key: string) => scene.textures.exists(key);
  const put = (o: Phaser.GameObjects.GameObject) => {
    field.addAt(o, at + objs.length);
    objs.push(o);
    return o;
  };

  // Soft clouds drifting across the sky band (open and sparkle arenas).
  if ((kind === 'open' || kind === 'sparkle') && has('pack.ebdx.cloud1')) {
    ['pack.ebdx.cloud1', 'pack.ebdx.cloud2'].forEach((key, i) => {
      const y = 40 + i * 34;
      const a = scene.add.tileSprite(0, y, W, 18, key).setOrigin(0).setScale(1, 2).setAlpha(0.55 - i * 0.15);
      put(a);
      if (moving) scene.tweens.add({ targets: a, tilePositionX: 384, duration: 60_000 + i * 25_000, repeat: -1 });
    });
  }
  // Light rays that slowly breathe (Aero glow).
  if ((kind === 'open' || kind === 'sparkle' || kind === 'water') && has('pack.ebdx.lightA')) {
    [0.18, 0.55, 0.82].forEach((fx, i) => {
      const ray = scene.add.image(W * fx, -10, i % 2 ? 'pack.ebdx.lightB' : 'pack.ebdx.lightA').setOrigin(0.5, 0).setScale(2, 2.2).setAlpha(0.25).setBlendMode('ADD');
      put(ray);
      if (moving) scene.tweens.add({ targets: ray, alpha: 0.5, duration: 2600 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }
  // Rising bubbles, falling snow, rising embers, twinkling stars or sparkles.
  const particle = { water: 'pack.ebdx.bubble', snow: 'pack.ebdx.snow', ember: 'pack.dbk.particle', dark: 'pack.ebdx.star', sparkle: 'pack.ebdx.star', open: 'pack.dbk.particle' }[kind];
  if (has(particle)) {
    const count = kind === 'open' ? 6 : 14;
    for (let i = 0; i < count; i++) {
      const x = 20 + spread(i + 1) * (W - 40);
      const y = 30 + spread(i * 3 + 2) * 300;
      const p = scene.add.image(x, y, particle).setAlpha(0.7).setBlendMode(kind === 'snow' || kind === 'water' ? 'NORMAL' : 'ADD');
      const s = kind === 'ember' || kind === 'open' ? 0.18 + spread(i + 7) * 0.12 : kind === 'dark' || kind === 'sparkle' ? 2 + spread(i) * 2 : 1.5 + spread(i + 4);
      p.setScale(s);
      if (kind === 'ember') p.setTint(0xffa040);
      if (kind === 'open') p.setTint(0xfff6c0);
      put(p);
      if (!moving) continue;
      const dur = 5000 + spread(i + 11) * 5000;
      if (kind === 'dark' || kind === 'sparkle') {
        scene.tweens.add({ targets: p, alpha: 0.1, duration: dur / 4, yoyo: true, repeat: -1, delay: spread(i + 5) * 2000, ease: 'Sine.easeInOut' });
      } else {
        const rise = kind === 'snow' ? 1 : -1;
        const fromY = rise > 0 ? -10 : 380;
        const toY = rise > 0 ? 380 : -10;
        p.y = fromY + (toY - fromY) * spread(i + 3);
        // Drift across the whole height once, then loop from the start edge.
        scene.tweens.add({
          targets: p,
          y: toY,
          x: x + (rise > 0 ? 40 : 20) * (i % 2 ? 1 : -1),
          duration: dur * Math.abs(toY - p.y) / 390,
          ease: 'Linear',
          onComplete: () => {
            p.y = fromY;
            p.x = x;
            scene.tweens.add({ targets: p, y: toY, x: x + 30 * (i % 2 ? 1 : -1), duration: dur, repeat: -1, ease: 'Linear' });
          },
        });
      }
    }
  }
  // A low mist in dark places.
  if (kind === 'dark' && has('pack.ebdx.fog')) {
    const fog = scene.add.tileSprite(0, 160, W, 120, 'pack.ebdx.fog').setOrigin(0).setAlpha(0.35);
    put(fog);
    if (moving) scene.tweens.add({ targets: fog, tilePositionX: 708, duration: 90_000, repeat: -1 });
  }
  return objs;
}
