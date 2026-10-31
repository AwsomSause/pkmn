// Transitions (left-out 3.1): the level-up banner, the champion's arena glow and the screen-change sheen.
// Presentation only: nothing here touches battle state or gameplay RNG, and every piece respects the motion setting.

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { burstReveal } from './spectacle';
import type { MotionLevel } from '../aero';

/** "LEVEL UP! Lv N" pops up over a Pokémon's box with a burst, then floats away. Reduced motion: a still label. */
export function levelUpBanner(scene: Phaser.Scene, x: number, y: number, level: number, motion: MotionLevel, intensity = 1): void {
  if (motion === 'off' || intensity <= 0) return;
  const label = scene.add.text(x, y, `LEVEL UP!  Lv ${level}`, { ...textStyle(26, '#fff6b0'), stroke: '#1a3a7a', strokeThickness: 5 }).setOrigin(0.5).setDepth(950);
  if (motion === 'reduced') {
    scene.tweens.add({ targets: label, alpha: 0, delay: 900, duration: 300, onComplete: () => label.destroy() });
    return;
  }
  void burstReveal(scene, x, y, 0xffe070, motion, 940);
  label.setScale(0.4).setAlpha(0);
  scene.tweens.add({ targets: label, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: label, y: y - 46, alpha: 0, delay: 1000, duration: 520, ease: 'Sine.easeIn', onComplete: () => label.destroy() });
}

/**
 * The champion's own arena: a pale-gold wash, slow turning light beams and a glowing floor line over whatever
 * field is drawn. Added to `field` so it is cleaned up with it.
 */
export function championGlow(scene: Phaser.Scene, field: Phaser.GameObjects.Container, motion: MotionLevel): void {
  const wash = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf8e080, 0.14).setOrigin(0).setBlendMode('ADD');
  field.add(wash);
  const floor = scene.add.rectangle(0, GAME_HEIGHT * 0.62, GAME_WIDTH, 6, 0xfff0a0, 0.55).setOrigin(0).setBlendMode('ADD');
  field.add(floor);
  if (motion === 'off') return;
  const beams = scene.add.graphics().setBlendMode('ADD').setPosition(GAME_WIDTH / 2, GAME_HEIGHT * 0.34);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    beams.fillStyle(0xfff0a0, 0.1);
    beams.fillTriangle(0, 0, Math.cos(a - 0.07) * 900, Math.sin(a - 0.07) * 900, Math.cos(a + 0.07) * 900, Math.sin(a + 0.07) * 900);
  }
  field.add(beams);
  if (motion === 'full') {
    scene.tweens.add({ targets: wash, alpha: 0.05, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: floor, alpha: 0.25, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: beams, rotation: Math.PI * 2, duration: 60_000, repeat: -1 });
  }
}

/** A glossy light sweep across the screen when a scene opens (the loading transition). Full motion only. */
export function sheenSweep(scene: Phaser.Scene, motion: MotionLevel): void {
  if (motion !== 'full') return;
  const bar = scene.add.rectangle(-200, GAME_HEIGHT / 2, 140, GAME_HEIGHT * 1.6, 0xffffff, 0.16).setAngle(18).setBlendMode('ADD').setDepth(10_000).setScrollFactor(0);
  scene.tweens.add({ targets: bar, x: GAME_WIDTH + 200, duration: 520, ease: 'Sine.easeInOut', onComplete: () => bar.destroy() });
}

/** Mixes a region's sky colour into a dim colour so each region's map reads in its own palette. */
export function regionDim(sky: number, base = 0x06152a, amount = 0.45): number {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return (mix((base >> 16) & 255, (sky >> 16) & 255) << 16) | (mix((base >> 8) & 255, (sky >> 8) & 255) << 8) | mix(base & 255, sky & 255);
}

/** Soft rim lights on a platform: a pulsing coloured ring and a bright core under a Pokémon's spot. */
export function platformEdgeLight(scene: Phaser.Scene, field: Phaser.GameObjects.Container, x: number, y: number, tint: number, motion: MotionLevel): void {
  const ring = scene.add.ellipse(x, y, 190, 44).setStrokeStyle(3, tint, 0.55).setBlendMode('ADD');
  const core = scene.add.ellipse(x, y, 120, 26, tint, 0.12).setBlendMode('ADD');
  field.add([core, ring]);
  if (motion === 'full') scene.tweens.add({ targets: [ring, core], alpha: 0.4, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}
