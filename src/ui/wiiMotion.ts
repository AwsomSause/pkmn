// Wii-style menu motion (spec §24): the gliding selection cursor, hover/press/
// release bounces for every clickable thing, popup and screen entrances.
// Timings and the spring live in core/presentation/uiMotion.ts; this file only
// draws. Presentation only: every tween can be cut short and none blocks input.

import Phaser from 'phaser';
import { createSpring, stepSpring, uiTween, UI_SCALE, type Spring, type UiMotionLevel, type UiTimingKey } from '../core/presentation/uiMotion';

let current: { level: UiMotionLevel; timeScale: number } = { level: 'full', timeScale: 1 };

/** Called by main.ts whenever settings change. */
export function setUiMotion(m: { level: UiMotionLevel; timeScale: number }): void {
  current = m;
}
export const uiMotion = (): { level: UiMotionLevel; timeScale: number } => current;
export const uiTiming = (key: UiTimingKey) => uiTween(key, current.level, current.timeScale);

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

/** The soft blue-white glow colour of the cursor (an original take on a console-menu pointer). */
const GLOW = 0x9fe4ff;

/**
 * A rounded, glowing frame that springs between options like a small physical
 * object: it stretches on the way, overshoots a little and settles; it shrinks
 * away when hidden and pops back in when shown. Lives inside a container and
 * takes targets in that container's coordinates.
 */
export class WiiCursor {
  readonly g: Phaser.GameObjects.Graphics;
  private readonly spring: Spring;
  private target: number[];
  private settled = true;
  private time = 0;
  private drawn = '';
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, w: number, h: number, private readonly radius = 16) {
    this.g = scene.add.graphics();
    if (parent) parent.add(this.g);
    this.target = [x + w / 2, y + h / 2, w, h];
    this.spring = createSpring(this.target);
    this.onUpdate = (_t, delta) => this.tick(delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.g.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
    this.draw();
  }

  /** Glides to a new box (snaps when `snap` or motion is off). */
  moveTo(x: number, y: number, w: number, h: number, snap = false): void {
    const next = [x + w / 2, y + h / 2, w, h];
    if (next.every((v, i) => v === this.target[i])) return;
    this.target = next;
    if (snap || current.level === 'off') {
      stepSpring(this.spring, next, 0, 'off');
      this.draw();
      return;
    }
    this.settled = false;
  }

  /** Leaving: a quick shrink and fade. */
  hide(): void {
    const t = uiTiming('popupClose');
    this.scene.tweens.killTweensOf(this.g);
    if (!t.ms) {
      this.g.setVisible(false);
      return;
    }
    this.scene.tweens.add({ targets: this.g, alpha: 0, scale: t.bounce ? 0.9 : 1, duration: t.ms, ease: t.ease, onComplete: () => this.g.setVisible(false) });
  }

  /** Entering: pops in with a small overshoot. */
  show(): void {
    const t = uiTiming('popupOpen');
    this.scene.tweens.killTweensOf(this.g);
    this.g.setVisible(true).setAlpha(1).setScale(1);
    if (!t.ms) return;
    this.g.setAlpha(0).setScale(t.bounce ? UI_SCALE.popupFrom : 1);
    this.scene.tweens.add({ targets: this.g, alpha: 1, scale: 1, duration: t.ms, ease: t.ease });
  }

  /** A press: the frame squashes and springs back. */
  press(): void {
    const t = uiTiming('release');
    if (!t.bounce || !this.g.visible) return;
    this.scene.tweens.killTweensOf(this.g);
    this.g.setScale(UI_SCALE.press).setAlpha(1);
    this.scene.tweens.add({ targets: this.g, scale: 1, duration: t.ms, ease: 'Back.easeOut' });
  }

  private tick(delta: number): void {
    if (!this.g.active) return;
    this.time += delta;
    if (!this.settled) {
      this.settled = stepSpring(this.spring, this.target, delta, current.level, current.timeScale);
    }
    this.draw();
  }

  private draw(): void {
    const [cx, cy, w, h] = this.spring.value as [number, number, number, number];
    // A slow breathing glow while it rests (full motion only).
    const glow = current.level === 'full' ? 0.22 + 0.1 * Math.sin(this.time / 380) : 0.25;
    const key = `${cx.toFixed(1)}|${cy.toFixed(1)}|${w.toFixed(1)}|${h.toFixed(1)}|${glow.toFixed(2)}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const g = this.g;
    g.setPosition(cx, cy);
    g.clear();
    const r = Math.min(this.radius, h / 2, w / 2);
    g.fillStyle(0xffffff, 0.1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(10, GLOW, glow);
    g.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, r + 3);
    g.lineStyle(3, 0xffffff, 0.95);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    // A short glossy highlight along the top edge.
    g.lineStyle(2, GLOW, 0.9);
    g.beginPath();
    g.arc(-w / 2 + r, -h / 2 + r, r - 3, Math.PI * 1.1, Math.PI * 1.5);
    g.lineTo(Math.min(w / 2 - r, -w / 2 + r + w * 0.35), -h / 2 + 3);
    g.strokePath();
  }

  destroy(): void {
    this.g.destroy();
  }
}

/** Pops an object in (scale up from a little smaller, fade in). Works on objects drawn around their own origin. */
export function popIn(scene: Phaser.Scene, target: Obj, delay = 0, key: UiTimingKey = 'popupOpen'): void {
  const t = uiTween(key, current.level, current.timeScale);
  if (!t.ms) return;
  const o = target as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
  const sx = o.scaleX;
  const sy = o.scaleY;
  const alpha = o.alpha;
  if (t.bounce) o.setScale(sx * UI_SCALE.popupFrom, sy * UI_SCALE.popupFrom);
  o.setAlpha(0);
  scene.tweens.add({ targets: target, scaleX: sx, scaleY: sy, alpha, duration: t.ms, delay, ease: t.ease });
}

/** Slides an object in from an offset (reduced: a quarter of the way), fading in. */
export function glideIn(scene: Phaser.Scene, target: Obj, dx: number, dy: number, delay = 0, key: UiTimingKey = 'tab'): void {
  const t = uiTween(key, current.level, current.timeScale);
  if (!t.ms) return;
  const o = target as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
  const { x, y, alpha } = o;
  o.setPosition(x + dx * t.travel, y + dy * t.travel).setAlpha(0);
  scene.tweens.add({ targets: target, x, y, alpha, duration: t.ms, delay, ease: t.ease });
}

/** A short side-to-side wobble: "can't pick that" (disabled options). */
export function nudge(scene: Phaser.Scene, target: Obj): void {
  const t = uiTiming('nudge');
  if (!t.ms || !t.bounce) return;
  const x = target.x;
  scene.tweens.add({ targets: target, x: x + 5, duration: t.ms / 6, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => target.setX(x) });
}

/** A reward or item reveal: pops in with an overshoot and a single gentle spin wobble. */
export function revealPop(scene: Phaser.Scene, target: Obj, delay = 0): void {
  popIn(scene, target, delay, 'reward');
  const t = uiTiming('reward');
  if (!t.bounce) return;
  const o = target as unknown as Phaser.GameObjects.Components.Transform;
  const angle = o.angle;
  o.setAngle(angle - 8);
  scene.tweens.add({ targets: target, angle, duration: t.ms * 1.4, delay, ease: 'Elastic.easeOut', easeParams: [1, 0.5] });
}

/**
 * An icon reacts to being selected: a little hop with a tilt, then it settles.
 * Takes the icon itself, or a row container (its first centred image is used).
 * Only on selection, never constantly (spec §24: motion should mean something).
 */
export function iconHop(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void {
  const t = uiTiming('release');
  if (!t.bounce) return;
  const icon = (target instanceof Phaser.GameObjects.Container
    ? target.list.find((c) => c instanceof Phaser.GameObjects.Image && Math.abs(c.originX - 0.5) < 0.01)
    : target) as Phaser.GameObjects.Image | undefined;
  if (!icon || !('y' in icon) || scene.tweens.getTweensOf(icon).length) return;
  const { y, angle } = icon;
  scene.tweens.add({ targets: icon, y: y - 6, angle: angle - 6, duration: t.ms / 2, yoyo: true, ease: 'Quad.easeOut', onComplete: () => icon.setY(y).setAngle(angle) });
}

/** Screen entrance: the camera settles in from a tiny zoom (full motion only; the fade-in plays for every level). */
export function pageEnter(scene: Phaser.Scene): void {
  const t = uiTiming('page');
  if (!t.bounce) return;
  const cam = scene.cameras.main;
  cam.setZoom(UI_SCALE.pageZoom);
  cam.zoomTo(1, t.ms, 'Cubic.easeOut', true);
}

// ---- Hover / press / release for every clickable object ----

interface Rest {
  sx: number;
  sy: number;
  y: number;
  mode: 'scale' | 'lift';
  tween?: Phaser.Tweens.Tween;
}
const rest = new WeakMap<Phaser.GameObjects.GameObject, Rest>();

/** Objects that animate themselves (menu labels, the cursor) opt out with `setData('noJuice', true)`. */
const optedOut = (o: Phaser.GameObjects.GameObject) => !!(o.getData && o.getData('noJuice'));

/** What actually moves when an object is hovered: a hit zone moves its container. */
function juiceTarget(o: Phaser.GameObjects.GameObject): Obj | null {
  if (optedOut(o)) return null;
  const target = (o instanceof Phaser.GameObjects.Zone ? o.parentContainer : o) as Obj | null;
  if (!target || optedOut(target) || !('scaleX' in target)) return null;
  // Full-screen blockers and big panels stay put: only button-sized things bounce.
  const b = (target as unknown as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds?.();
  if (!b || b.width > 420 || b.height > 300) return null;
  return target;
}

/** Centred objects grow; top-left-anchored ones (containers, most text) lift a few pixels instead. */
function modeFor(t: Obj): 'scale' | 'lift' {
  const o = t as unknown as { originX?: number; originY?: number };
  if (t instanceof Phaser.GameObjects.Container) return 'lift';
  return o.originX !== undefined && Math.abs(o.originX - 0.5) < 0.01 && Math.abs((o.originY ?? 0) - 0.5) < 0.01 ? 'scale' : 'lift';
}

function busyElsewhere(scene: Phaser.Scene, t: Obj, own?: Phaser.Tweens.Tween): boolean {
  return scene.tweens.getTweensOf(t).some((tw) => tw !== own);
}

function to(scene: Phaser.Scene, t: Obj, r: Rest, scale: number, lift: number, key: UiTimingKey, ease?: string): void {
  const tm = uiTiming(key);
  r.tween?.stop();
  const props = r.mode === 'scale' ? { scaleX: r.sx * scale, scaleY: r.sy * scale } : { y: r.y - lift };
  if (!tm.ms) {
    r.tween = undefined;
    if (r.mode === 'scale') t.setScale(props.scaleX!, props.scaleY!);
    else t.setY(props.y!);
    return;
  }
  r.tween = scene.tweens.add({ targets: t, ...props, duration: tm.ms, ease: ease ?? tm.ease });
}

function over(scene: Phaser.Scene, o: Phaser.GameObjects.GameObject): void {
  const t = juiceTarget(o);
  if (!t || current.level !== 'full') return;
  let r = rest.get(t);
  if (!r) {
    if (busyElsewhere(scene, t)) return;
    r = { sx: t.scaleX, sy: t.scaleY, y: t.y, mode: modeFor(t) };
    rest.set(t, r);
  }
  to(scene, t, r, UI_SCALE.hover, 3, 'hover');
}

function out(scene: Phaser.Scene, o: Phaser.GameObjects.GameObject): void {
  const t = juiceTarget(o);
  const r = t && rest.get(t);
  if (!t || !r) return;
  const tm = uiTiming('hover');
  r.tween?.stop();
  const done = () => rest.delete(t);
  const props = r.mode === 'scale' ? { scaleX: r.sx, scaleY: r.sy } : { y: r.y };
  if (!tm.ms) {
    if (r.mode === 'scale') t.setScale(r.sx, r.sy);
    else t.setY(r.y);
    done();
    return;
  }
  r.tween = scene.tweens.add({ targets: t, ...props, duration: tm.ms, ease: tm.ease, onComplete: done });
}

function down(scene: Phaser.Scene, o: Phaser.GameObjects.GameObject): void {
  const t = juiceTarget(o);
  const r = t && rest.get(t);
  if (t && r) to(scene, t, r, UI_SCALE.press, -1, 'press');
}

function up(scene: Phaser.Scene, o: Phaser.GameObjects.GameObject): void {
  const t = juiceTarget(o);
  const r = t && rest.get(t);
  if (t && r) to(scene, t, r, UI_SCALE.hover, 3, 'release', 'Back.easeOut');
}

/** Gives every interactive object in a scene hover, press and release motion. Call once per scene create. */
export function installUiJuice(scene: Phaser.Scene): void {
  const input = scene.input;
  if (!input) return;
  const handlers: [string, (p: unknown, o: Phaser.GameObjects.GameObject) => void][] = [
    [Phaser.Input.Events.GAMEOBJECT_OVER, (_p, o) => over(scene, o)],
    [Phaser.Input.Events.GAMEOBJECT_OUT, (_p, o) => out(scene, o)],
    [Phaser.Input.Events.GAMEOBJECT_DOWN, (_p, o) => down(scene, o)],
    [Phaser.Input.Events.GAMEOBJECT_UP, (_p, o) => up(scene, o)],
  ];
  for (const [ev, fn] of handlers) input.on(ev, fn);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    for (const [ev, fn] of handlers) input.off(ev, fn);
  });
}
