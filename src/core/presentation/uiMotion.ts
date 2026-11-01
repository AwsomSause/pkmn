// Wii-style menu motion (spec §24): one set of timings and easings for every
// cursor, button, icon, popup and screen change, plus the spring that moves
// the selection cursor like a small physical object.
//
// Pure: no Phaser, no random numbers. Presentation only; nothing here can
// change an outcome, and every animation can be cut short by the next input.

import { feelTween, SKINS, type MotionFeel } from './skins';
import type { Settings } from '../state';
import { animationFlags, animationTimeScale } from '../accessibility';
import { registerAnims } from './animRegistry';

export type UiMotionLevel = 'full' | 'reduced' | 'off';

/** How much menu motion the player allows: Disable All or Menu animations off → none; otherwise the Battle motion level (which the Reduced Motion preset lowers). */
export function uiMotionLevel(s: Settings): UiMotionLevel {
  if (!animationFlags(s).menuAnimations) return 'off';
  return s.battleAnimations;
}

/** Full-motion lengths in ms. Kept short so no animation ever makes input wait. */
export const UI_TIMING = {
  hover: 140,
  press: 70,
  release: 240,
  cursor: 200,
  popupOpen: 280,
  popupClose: 160,
  tab: 220,
  page: 300,
  stagger: 32,
  nudge: 180,
  reward: 420,
} as const;
export type UiTimingKey = keyof typeof UI_TIMING;

/** Scale changes for hover/press/release, relative to an object's rest scale. */
export const UI_SCALE = { hover: 1.06, press: 0.93, overshoot: 1.1, popupFrom: 0.82, pageZoom: 1.035 } as const;

export interface UiTween {
  /** 0 = snap straight to the end state. */
  ms: number;
  ease: string;
  /** How far movement goes, 0–1 (reduced motion keeps a quarter). */
  travel: number;
  /** Scale pops (hover, overshoot) play only with full motion. */
  bounce: boolean;
}

/** Timing for one kind of UI motion under a motion level and the Animation speed setting. */
export function uiTween(key: UiTimingKey, level: UiMotionLevel, timeScale = 1, feel: MotionFeel = 'default'): UiTween {
  if (level === 'off') return { ms: 0, ease: 'Linear', travel: 0, bounce: false };
  const base = UI_TIMING[key] * timeScale;
  if (level === 'reduced') return { ms: Math.round(Math.min(base, 160) * 0.75), ease: 'Sine.easeOut', travel: 0.25, bounce: false };
  const ease = key === 'press' || key === 'popupClose' ? 'Quad.easeOut' : key === 'hover' || key === 'cursor' ? 'Cubic.easeOut' : 'Back.easeOut';
  const f = feelTween(feel);
  const keepEase = key === 'press' || key === 'popupClose' || key === 'hover' || key === 'cursor';
  return { ms: Math.round(base * f.msScale), ease: f.ease && !keepEase ? f.ease : ease, travel: 1, bounce: f.pops };
}

/** Everything the UI layer needs from the settings, read one way. */
export function uiMotionFrom(s: Settings): { level: UiMotionLevel; timeScale: number; feel: MotionFeel } {
  return { level: uiMotionLevel(s), timeScale: animationTimeScale(s), feel: SKINS[s.uiTheme].feel };
}

/** Delay before item `i` of a list pops in (capped so long lists don't drag). */
export function staggerDelay(i: number, level: UiMotionLevel, timeScale = 1): number {
  if (level !== 'full') return 0;
  return Math.round(Math.min(i, 8) * UI_TIMING.stagger * timeScale);
}

/** A damped spring on several numbers at once (x, y, width, height of the cursor). */
export interface Spring {
  value: number[];
  velocity: number[];
}

export interface SpringTuning {
  /** Pull towards the target (per second²). */
  stiffness: number;
  /** Friction (per second). Below 2·√stiffness it overshoots a little: the "bounce". */
  damping: number;
}

/** Full motion: a soft overshoot. Reduced: critically damped (no overshoot). */
export function springTuning(level: UiMotionLevel, timeScale = 1, feel: MotionFeel = 'default'): SpringTuning {
  const f = feelTween(feel);
  const k = (420 * f.stiffness) / (timeScale * timeScale);
  const critical = 2 * Math.sqrt(k);
  return { stiffness: k, damping: level === 'full' ? critical * f.dampingScale : critical };
}

export const createSpring = (value: readonly number[]): Spring => ({ value: [...value], velocity: value.map(() => 0) });

/**
 * Moves a spring towards `target` by `dtMs`, in fixed 4 ms substeps so the
 * path is the same at any frame rate. `off` snaps. Returns true when it has settled.
 */
export function stepSpring(spring: Spring, target: readonly number[], dtMs: number, level: UiMotionLevel, timeScale = 1, feel: MotionFeel = 'default'): boolean {
  if (level === 'off') {
    target.forEach((t, i) => {
      spring.value[i] = t;
      spring.velocity[i] = 0;
    });
    return true;
  }
  const { stiffness, damping } = springTuning(level, timeScale, feel);
  const SUB = 4;
  let left = Math.min(dtMs, 100);
  while (left > 0) {
    const h = Math.min(SUB, left) / 1000;
    left -= SUB;
    target.forEach((t, i) => {
      const a = stiffness * (t - spring.value[i]!) - damping * spring.velocity[i]!;
      spring.velocity[i] = spring.velocity[i]! + a * h;
      spring.value[i] = spring.value[i]! + spring.velocity[i]! * h;
    });
  }
  const settled = target.every((t, i) => Math.abs(t - spring.value[i]!) < 0.25 && Math.abs(spring.velocity[i]!) < 4);
  if (settled) target.forEach((t, i) => {
    spring.value[i] = t;
    spring.velocity[i] = 0;
  });
  return settled;
}

// Registry entries so the menu motion shows up beside every other animation (category 'ui').
registerAnims([
  { id: 'ui.cursor', category: 'ui', ms: UI_TIMING.cursor, color: '#9fe4ff', trigger: 'selection change', sound: 'ui.cursor' },
  { id: 'ui.press', category: 'ui', ms: UI_TIMING.press + UI_TIMING.release, color: '#ffffff', trigger: 'button press', sound: 'ui.select' },
  { id: 'ui.popup', category: 'ui', ms: UI_TIMING.popupOpen, color: '#ffffff', trigger: 'popup or menu opens' },
  { id: 'ui.page', category: 'ui', ms: UI_TIMING.page, color: '#0e0b12', trigger: 'screen change' },
  { id: 'ui.reward', category: 'ui', ms: UI_TIMING.reward, color: '#f8d030', trigger: 'item or reward shown', particles: true },
]);
