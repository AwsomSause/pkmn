// Legendary world event visuals: a colour wash and drifting particles in the event's own look, plus title cards.
// Presentation only (never touches battle or route state); honours the motion level and the reduce-particles setting.

import Phaser from 'phaser';
import type { LegendKit } from '../core/legendary/visuals';
import { services } from '../game/services';
import type { AnimPlan } from '../core/presentation/animRegistry';
import type { LegendShape } from '../core/presentation/legendAnims';
import '../core/presentation/legendAnims';
import { beat, noBeat, type Beat } from './battleFx/spectacle';
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

const colorOf = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

/**
 * An event's signature flourish: a short procedural effect in the shape's own language (waves, flames, a bolt, frost,
 * rings of warped space...). Fixed positions, no random numbers; the registry plan already folds in motion, intensity,
 * shake and Reduced Particles. A reduced plan is a soft colour fade only. Any key skips (via the Beat).
 */
export function playSignature(scene: Phaser.Scene, shape: LegendShape, plan: AnimPlan | null): Beat {
  if (!plan || !plan.play) return noBeat();
  const W = scene.scale.width;
  const H = scene.scale.height;
  const c = colorOf(plan.color);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }>(o: T): T => {
    o.setDepth(940);
    objs.push(o);
    return o;
  };
  const tween = (config: Phaser.Types.Tweens.TweenBuilderConfig) => scene.tweens.add(config);
  if (plan.reduced) {
    const veil = add(scene.add.rectangle(W / 2, H / 2, W, H, c, 0));
    tween({ targets: veil, alpha: 0.25, duration: plan.ms / 3, yoyo: true });
    return beat(scene, objs, plan.ms);
  }
  const ms = plan.ms;
  const up = (n: number, make: (i: number) => Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }) => Array.from({ length: n }, (_, i) => add(make(i)));
  const n = plan.particles ? 14 : 6;
  switch (shape) {
    case 'wave':
      for (const o of up(4, (i) => scene.add.ellipse(-W / 2, H - 30 - i * 26, W * 1.4, 22, c, 0.35 - i * 0.05))) tween({ targets: o, x: W * 1.2, duration: ms, ease: 'Sine.easeInOut', delay: objs.indexOf(o) * 120 });
      break;
    case 'flame':
      for (const o of up(n, (i) => scene.add.ellipse(30 + spread(i + 1) * (W - 60), H + 20, 22, 44, i % 2 ? 0xffd060 : c, 0.7))) tween({ targets: o, y: H * (0.25 + spread(objs.indexOf(o)) * 0.3), alpha: 0, scaleY: 1.6, duration: ms * 0.8, delay: objs.indexOf(o) * 40, ease: 'Cubic.easeOut' });
      break;
    case 'bolt': {
      const g = add(scene.add.graphics());
      const pts = [W * 0.5, 0, W * 0.44, H * 0.22, W * 0.56, H * 0.3, W * 0.47, H * 0.55, W * 0.58, H * 0.62, W * 0.5, H];
      g.lineStyle(7, 0xffffff, 1).beginPath().moveTo(pts[0]!, pts[1]!);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
      g.strokePath();
      g.lineStyle(14, c, 0.5).beginPath().moveTo(pts[0]!, pts[1]!);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
      g.strokePath();
      tween({ targets: g, alpha: { from: 1, to: 0 }, duration: ms * 0.5, yoyo: false, repeat: 1 });
      break;
    }
    case 'frost':
      for (const o of up(n, (i) => scene.add.star(30 + spread(i + 1) * (W - 60), -10, 6, 4, 12, c, 0.85))) tween({ targets: o, y: H * 0.8, angle: 180, alpha: 0, duration: ms * 0.9, delay: objs.indexOf(o) * 60, ease: 'Sine.easeIn' });
      break;
    case 'shadow': {
      const v = add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0618, 0));
      tween({ targets: v, alpha: 0.7, duration: ms / 2, yoyo: true });
      for (const o of up(2, (i) => scene.add.ellipse(W * (0.4 + i * 0.2), H * 0.42, 34, 14, c, 0))) tween({ targets: o, alpha: 0.95, duration: ms / 3, yoyo: true, delay: 250 });
      break;
    }
    case 'warp':
      for (const o of up(5, (i) => scene.add.circle(W / 2, H / 2, 20 + i * 8).setStrokeStyle(4, c, 0.8))) tween({ targets: o, radius: W * 0.55, alpha: 0, angle: 90, duration: ms, delay: objs.indexOf(o) * 140, ease: 'Sine.easeOut' });
      break;
    case 'leaf':
      for (const o of up(n, (i) => scene.add.ellipse(spread(i + 2) * W, -10, 16, 8, c, 0.85))) tween({ targets: o, y: H * 0.85, x: '+=80', angle: 300, alpha: 0, duration: ms * 0.9, delay: objs.indexOf(o) * 70, ease: 'Sine.easeInOut' });
      break;
    case 'stone':
      for (const o of up(Math.min(n, 9), (i) => scene.add.rectangle(40 + spread(i + 1) * (W - 80), -20, 22, 22, c, 0.9))) tween({ targets: o, y: H * 0.78, angle: 45, duration: ms * 0.45, delay: objs.indexOf(o) * 80, ease: 'Bounce.easeOut', onComplete: () => tween({ targets: o, alpha: 0, duration: 300 }) });
      break;
    case 'steel': {
      const gear = add(scene.add.star(W / 2, H / 2, 10, 70, 90, c, 0.55).setStrokeStyle(4, 0xffffff, 0.8));
      tween({ targets: gear, angle: 180, scale: { from: 0.3, to: 1.6 }, alpha: { from: 0.9, to: 0 }, duration: ms, ease: 'Sine.easeOut' });
      break;
    }
    case 'dream':
      for (const o of up(6, (i) => scene.add.circle(W * (0.2 + spread(i + 1) * 0.6), H * (0.3 + spread(i * 2 + 1) * 0.4), 10, c, 0.5))) tween({ targets: o, radius: 70, alpha: 0, duration: ms, delay: objs.indexOf(o) * 150, ease: 'Sine.easeOut' });
      break;
    case 'gale':
      for (const o of up(n, (i) => scene.add.rectangle(-60, H * (0.1 + spread(i + 1) * 0.8), 90, 3, c, 0.7))) tween({ targets: o, x: W + 60, duration: ms * 0.6, delay: objs.indexOf(o) * 60, ease: 'Cubic.easeIn' });
      break;
    case 'light':
    default:
      for (const o of up(8, (i) => scene.add.rectangle(W / 2, H / 2, 6, H, c, 0.45).setAngle(i * 22.5))) tween({ targets: o, scaleX: { from: 0.2, to: 3 }, alpha: 0, duration: ms, ease: 'Sine.easeOut' });
      break;
  }
  return beat(scene, objs, ms);
}
