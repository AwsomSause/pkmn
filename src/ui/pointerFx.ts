// Pointer-driven presentation (W11): tooltips after a hover delay, tilting hover cards, the cursor sparkle trail and
// the hold-to-confirm ring. Presentation only; none of it reads or changes game state.

import Phaser from 'phaser';
import { GLOSSARY, glossaryLinks, holdProgress, TOOLTIP_DELAY_MS, tiltFor } from '../core/presentation/uiPrefs';
import type { Settings } from '../core/state';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from './theme';

type Get = () => Settings;

/** Marks an object so the global tooltip layer shows `text` after the player's hover delay. */
export const setTooltip = <T extends Phaser.GameObjects.GameObject>(obj: T, text: string): T => obj.setData('tooltip', text);
/** Marks an object so it tilts toward the mouse while hovered. */
export const setTilt = <T extends Phaser.GameObjects.GameObject>(obj: T): T => obj.setData('tilt', true);

const motionOn = (s: Settings): boolean => !s.disableAllAnimations && s.battleAnimations !== 'off';

export function installPointerFx(game: Phaser.Game, get: Get, sky: () => number): void {
  for (const scene of game.scene.getScenes(false)) scene.events.on(Phaser.Scenes.Events.CREATE, () => hookScene(scene, get));
  installTrail(game, get, sky);
}

function hookScene(scene: Phaser.Scene, get: Get): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tip: Phaser.GameObjects.Container | null = null;
  const hide = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    tip?.destroy();
    tip = null;
  };
  scene.input.on('gameobjectover', (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
    const text = obj.getData?.('tooltip') as string | undefined;
    const delay = TOOLTIP_DELAY_MS[get().tooltipDelay];
    if (text && delay !== null) {
      hide();
      timer = setTimeout(() => {
        if (!scene.sys.isActive()) return;
        const links = glossaryLinks(text);
        tip = drawTooltip(scene, links.keys.length ? `${links.clean}\n▸ click to read: ${links.keys.join(', ')}` : text, pointer.x, pointer.y);
      }, delay);
    }
    if (obj.getData?.('tilt') && motionOn(get())) tiltStart(scene, obj as Phaser.GameObjects.Image);
  });
  scene.input.on('gameobjectout', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
    hide();
    if (obj.getData?.('tilt')) tiltEnd(scene, obj as Phaser.GameObjects.Image);
  });
  // Tooltip chains (I462): clicking a tooltip's object while it shows steps through the [[keywords]] in its text.
  let chain: { keys: string[]; at: number } | null = null;
  scene.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
    const raw = obj.getData?.('tooltip') as string | undefined;
    const links = raw ? glossaryLinks(raw) : null;
    if (links && links.keys.length > 0 && tip) {
      chain = chain && chain.keys.join() === links.keys.join() ? { keys: chain.keys, at: (chain.at + 1) % links.keys.length } : { keys: links.keys, at: 0 };
      tip.destroy();
      tip = drawTooltip(scene, GLOSSARY[chain.keys[chain.at]!]!, pointer.x, pointer.y);
      return;
    }
    hide();
  });
  scene.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: unknown[]) => {
    if (over.length === 0) hide();
  });
  scene.events.once('shutdown', hide);
}

export function drawTooltip(scene: Phaser.Scene, text: string, px: number, py: number): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 0, text, textStyle(16, COLORS.text, { wordWrap: { width: 300 } })).setOrigin(0);
  const w = label.width + 16;
  const h = label.height + 12;
  const x = Math.max(4, Math.min(GAME_WIDTH - w - 4, px + 14));
  const y = Math.max(4, Math.min(GAME_HEIGHT - h - 4, py + 18));
  const back = scene.add.rectangle(0, 0, w, h, COLORS.panelDark, 0.96).setOrigin(0).setStrokeStyle(2, COLORS.accent, 0.9);
  label.setPosition(8, 6);
  return scene.add.container(x, y, [back, label]).setDepth(20000).setScrollFactor(0).setData('noJuice', true).setName('tooltip');
}

// --- Tilt ---------------------------------------------------------------------------------------------------------

const tilting = new WeakMap<Phaser.GameObjects.GameObject, (p: Phaser.Input.Pointer) => void>();
function tiltStart(scene: Phaser.Scene, obj: Phaser.GameObjects.Image): void {
  const move = (p: Phaser.Input.Pointer): void => {
    const b = obj.getBounds();
    const t = tiltFor((p.x - b.centerX) / (b.width / 2 || 1), (p.y - b.centerY) / (b.height / 2 || 1));
    scene.tweens.killTweensOf(obj);
    scene.tweens.add({ targets: obj, rotation: t.rotation, duration: 90, ease: 'Sine.easeOut' });
  };
  tilting.set(obj, move);
  scene.input.on('pointermove', move);
}
function tiltEnd(scene: Phaser.Scene, obj: Phaser.GameObjects.Image): void {
  const move = tilting.get(obj);
  if (move) scene.input.off('pointermove', move);
  tilting.delete(obj);
  if (obj.active) scene.tweens.add({ targets: obj, rotation: 0, duration: 180, ease: 'Back.easeOut' });
}

// --- Cursor sparkle trail -----------------------------------------------------------------------------------------

function installTrail(game: Phaser.Game, get: Get, sky: () => number): void {
  let last = 0;
  const onMove = (e: PointerEvent): void => {
    const s = get();
    if (!s.cursorTrail || !motionOn(s) || e.pointerType === 'touch') return;
    const now = performance.now();
    if (now - last < 45) return;
    last = now;
    const scene = game.scene.getScenes(true)[0];
    if (!scene || !game.canvas) return;
    const r = game.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * GAME_WIDTH;
    const y = ((e.clientY - r.top) / r.height) * GAME_HEIGHT;
    const spark = scene.add.star(x, y, 4, 2, 6, sky(), 0.9).setDepth(30000).setScrollFactor(0).setData('noJuice', true);
    scene.tweens.add({ targets: spark, alpha: 0, scale: 0.2, y: y + 10, angle: 90, duration: 480, onComplete: () => spark.destroy() });
  };
  game.canvas?.addEventListener('pointermove', onMove);
}

// --- Hold to confirm ----------------------------------------------------------------------------------------------

export interface HoldOpts {
  title: string;
  detail?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const CONFIRM_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyZ']);

/**
 * A risky action's gate: with "Hold to confirm" on, shows a ring that fills while the player holds the button (or Enter).
 * Releasing early or pressing Esc cancels. With the setting off the action simply runs.
 */
export function holdToConfirm(scene: Phaser.Scene, settings: Settings, opts: HoldOpts): void {
  if (!settings.holdToConfirm) return opts.onConfirm();
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
  const panel = scene.add.rectangle(cx, cy, 420, 240, COLORS.panel, 0.98).setStrokeStyle(3, COLORS.accent);
  const title = scene.add.text(cx, cy - 90, opts.title, textStyle(24, COLORS.text, { align: 'center', wordWrap: { width: 380 } })).setOrigin(0.5);
  const detail = scene.add.text(cx, cy + 86, opts.detail ?? 'Hold the button (or Enter) to confirm. Esc cancels.', textStyle(16, COLORS.textMuted, { align: 'center', wordWrap: { width: 380 } })).setOrigin(0.5);
  const ring = scene.add.graphics();
  const button = scene.add.circle(cx, cy, 34, COLORS.accent, 1).setInteractive({ useHandCursor: true });
  const stack = scene.add.container(0, 0, [shade, panel, title, detail, ring, button]).setDepth(25000).setData('noJuice', true).setName('hold-confirm');
  stack.each((o: Phaser.GameObjects.GameObject) => o.setData('noJuice', true));
  let held = -1;
  const armedAt = scene.time.now + 250;
  let done = false;
  const draw = (p: number): void => {
    ring.clear();
    ring.lineStyle(10, COLORS.borderMuted, 0.6).strokeCircle(cx, cy, 52);
    if (p > 0) ring.lineStyle(10, 0x78e080, 1).beginPath().arc(cx, cy, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false).strokePath();
  };
  draw(0);
  const close = (): void => {
    scene.events.off('update', tick);
    scene.input.keyboard?.off('keydown', down);
    scene.input.keyboard?.off('keyup', up);
    stack.destroy(true);
  };
  const finish = (): void => {
    if (done) return;
    done = true;
    close();
    opts.onConfirm();
  };
  const cancel = (): void => {
    if (done) return;
    done = true;
    close();
    opts.onCancel?.();
  };
  function tick(): void {
    if (held < 0 || done) return;
    const p = holdProgress(scene.time.now - held);
    draw(p);
    if (p >= 1) finish();
  }
  function down(e: KeyboardEvent): void {
    if (e.code === 'Escape' || e.code === 'KeyX' || e.code === 'Backspace') return cancel();
    if (CONFIRM_KEYS.has(e.code) && !e.repeat && scene.time.now >= armedAt && held < 0) held = scene.time.now;
  }
  function up(e: KeyboardEvent): void {
    if (CONFIRM_KEYS.has(e.code)) {
      held = -1;
      draw(0);
    }
  }
  button.on('pointerdown', () => { held = scene.time.now; });
  button.on('pointerup', () => { held = -1; draw(0); });
  button.on('pointerout', () => { held = -1; draw(0); });
  shade.on('pointerdown', () => { if (held < 0) cancel(); });
  scene.events.on('update', tick);
  scene.input.keyboard?.on('keydown', down);
  scene.input.keyboard?.on('keyup', up);
  scene.events.once('shutdown', () => { if (!done) { done = true; close(); } });
}
