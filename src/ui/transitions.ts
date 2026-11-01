// Screen-entry transition pack (F197): fade, bounce, wipe or ripple. Presentation only; input is never blocked.

import Phaser from 'phaser';
import { animationTimeScale } from '../core/accessibility';
import { TRANSITION_INFO } from '../core/presentation/uiPrefs';
import type { Settings } from '../core/state';
import { AERO } from './aero';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

type S = Pick<Settings, 'transitionStyle' | 'disableAllAnimations' | 'menuAnimations' | 'battleAnimations' | 'animationSpeed'>;

export function enterTransition(scene: Phaser.Scene, s: S): void {
  const cam = scene.cameras.main;
  const still = s.disableAllAnimations || !s.menuAnimations || s.battleAnimations === 'off';
  const style = still ? 'fade' : s.transitionStyle;
  const ms = Math.round(TRANSITION_INFO[style].ms * animationTimeScale(s as Settings));
  if (style === 'fade' || scene.scene.key === 'Battle') {
    cam.fadeIn(still ? 120 : 220, 14, 11, 18);
    return;
  }
  const reduced = s.battleAnimations === 'reduced';
  if (style === 'bounce') {
    cam.fadeIn(Math.round(ms * 0.6), 14, 11, 18);
    if (reduced) return;
    cam.setZoom(0.9);
    scene.tweens.add({ targets: cam, zoom: 1, duration: ms, ease: 'Back.easeOut' });
  } else if (style === 'wipe') {
    const cover = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0e0b12).setOrigin(0).setDepth(9999).setScrollFactor(0);
    const edge = scene.add.rectangle(0, 0, 14, GAME_HEIGHT, AERO.rim, 0.8).setOrigin(0).setDepth(10000).setScrollFactor(0);
    scene.tweens.add({ targets: [cover, edge], x: GAME_WIDTH, duration: ms, ease: 'Cubic.easeInOut', onComplete: () => { cover.destroy(); edge.destroy(); } });
  } else {
    cam.fadeIn(Math.round(ms * 0.5), 14, 11, 18);
    const ring = scene.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 20).setStrokeStyle(6, AERO.rim, 0.9).setDepth(9999).setScrollFactor(0);
    scene.tweens.add({ targets: ring, scale: 30, alpha: 0, duration: ms, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  }
}
