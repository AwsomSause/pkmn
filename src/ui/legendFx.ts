// Legendary world event visuals: a colour wash and drifting particles in the event's own look, plus title cards.
// Presentation only (never touches battle or route state); honours the motion level and the reduce-particles setting.

import Phaser from 'phaser';
import type { LegendKit } from '../core/legendary/visuals';
import { services } from '../game/services';
import type { MotionLevel } from './aero';

interface Style { w: number; h: number; vx: number; vy: number; shape: 'line' | 'dot' | 'blob' }
const STYLE: Record<LegendKit['particle'], Style> = {
  rain: { w: 2, h: 14, vx: -40, vy: 420, shape: 'line' },
  embers: { w: 5, h: 5, vx: 20, vy: -70, shape: 'dot' },
  snow: { w: 5, h: 5, vx: -25, vy: 70, shape: 'dot' },
  sand: { w: 10, h: 2, vx: 260, vy: 20, shape: 'line' },
  sparks: { w: 3, h: 10, vx: 0, vy: 0, shape: 'line' },
  mist: { w: 120, h: 40, vx: 30, vy: 0, shape: 'blob' },
  wind: { w: 90, h: 2, vx: 340, vy: -20, shape: 'line' },
  motes: { w: 6, h: 6, vx: 10, vy: -30, shape: 'dot' },
};

/** Golden-ratio steps: a fixed spread that never touches the gameplay RNG. */
const spread = (i: number): number => (i * 0.6180339887) % 1;

/**
 * Adds the wash and particles to the scene (or into `into`). Returns the objects so the caller can destroy them.
 * Depth is kept low so menus and text stay readable.
 */
export function addLegendLook(scene: Phaser.Scene, kit: LegendKit, motion: MotionLevel, depth = -1, into?: Phaser.GameObjects.Container): Phaser.GameObjects.GameObject[] {
  const s = services().session.settings;
  if (motion === 'off' || s.disableAllAnimations) return [];
  const W = scene.scale.width;
  const H = scene.scale.height;
  const out: Phaser.GameObjects.GameObject[] = [];
  const put = <T extends Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }>(o: T): T => {
    o.setDepth(depth);
    if (into) into.add(o);
    out.push(o);
    return o;
  };
  const wash = put(scene.add.rectangle(W / 2, H / 2, W, H, kit.tint, kit.wash));
  if (motion === 'full') scene.tweens.add({ targets: wash, alpha: kit.wash * 0.6, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  if (s.reduceParticles) return out;
  const st = STYLE[kit.particle];
  const count = motion === 'full' ? kit.count : Math.ceil(kit.count / 3);
  for (let i = 0; i < count; i++) {
    const x = spread(i + 1) * W;
    const y = spread(i * 3 + 2) * H;
    const color = i % 3 === 0 ? kit.accent : 0xffffff;
    const p = put(st.shape === 'blob' ? scene.add.ellipse(x, y, st.w, st.h, kit.accent, 0.12) : scene.add.rectangle(x, y, st.w, st.h, color, 0.6));
    if (kit.particle === 'sparks') p.setAngle(spread(i + 9) * 60 - 30);
    if (motion !== 'full') continue;
    if (kit.particle === 'sparks' || kit.particle === 'motes') {
      scene.tweens.add({ targets: p, alpha: 0.05, duration: 600 + spread(i + 5) * 1200, yoyo: true, repeat: -1, delay: spread(i + 7) * 1500 });
      continue;
    }
    // Drift along the style's direction, wrap around the screen.
    const dist = Math.max(60, Math.abs(st.vx) + Math.abs(st.vy)) * (2 + spread(i + 3) * 3);
    const dur = (dist / Math.max(1, Math.hypot(st.vx, st.vy))) * 1000;
    scene.tweens.add({ targets: p, x: x + st.vx * (dur / 1000), y: y + st.vy * (dur / 1000), duration: dur, repeat: -1, delay: spread(i + 11) * 800 });
  }
  return out;
}
