// Header bars from the Pokémon Essentials 21.1 UIE pack (Graphics/Custom UI/Pause Menu).
// A tinted diamond-pattern strip behind a screen header; it drifts slowly with
// full motion and holds still with reduced or off. Presentation only.

import type Phaser from 'phaser';
import { FRAME_COLORS, frameColorFor, type FrameColor } from '../core/presentation/frameColor';
import type { MotionLevel } from './aero';

export const frameBarId = (color: FrameColor): string => `ui.bar.top.${color}`;
export const FRAME_ASSET_IDS = FRAME_COLORS.map(frameBarId);

/** Adds the strip over `x, y, w, h`; returns null when the art isn't loaded. */
export function headerBar(scene: Phaser.Scene, accent: number, motion: MotionLevel, x: number, y: number, w: number, h: number, depth = 0): Phaser.GameObjects.TileSprite | null {
  const key = frameBarId(frameColorFor(accent));
  if (!scene.textures.exists(key)) return null;
  const bar = scene.add.tileSprite(x, y, w, h, key).setOrigin(0).setDepth(depth).setAlpha(0.55).setName('frame-bar');
  if (motion === 'full') scene.tweens.add({ targets: bar, tilePositionX: 128, duration: 9000, repeat: -1 });
  return bar;
}
