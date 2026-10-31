// Display settings that act on the whole page rather than one scene: high contrast, interface size and
// whether sprites animate. Presentation only; no outcome depends on them.

import Phaser from 'phaser';
import type { Settings } from '../core/state';

const SCALE: Record<Settings['uiScale'], number> = { full: 1, medium: 0.9, small: 0.8 };
let animated = true;

/** Whether menu icons and idle Pokémon may animate (Settings > Sprite animations). */
export const spritesAnimate = (): boolean => animated;

/** Applies the display settings to the game canvas. Safe to call often. */
export function applyDisplaySettings(game: Phaser.Game, settings: Settings): void {
  animated = settings.spriteAnimations;
  const canvas = game.canvas;
  if (!canvas) return;
  canvas.style.filter = settings.highContrast ? 'contrast(1.3) saturate(1.15)' : '';
  const scale = SCALE[settings.uiScale];
  const parent = canvas.parentElement;
  if (parent) {
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.justifyContent = 'center';
  }
  canvas.style.transform = scale === 1 ? '' : `scale(${scale})`;
}
