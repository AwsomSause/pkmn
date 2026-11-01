// Global presentation overlays (W11): a notification stack with swipe-away bubbles, the interaction log (L),
// idle hints, the hold-to-skip ring, touch swipes, shake-to-undo, the daily chest and the Hub resize bounce.
// Presentation only: none of it changes game state, and none uses gameplay randomness.

import Phaser from 'phaser';
import { chestReady, idleHintDue, interactionLog, isShake, loadingTip, NoticeStack, swipeDir } from '../core/presentation/uiPrefs';
import type { Settings } from '../core/state';
import { AERO } from './aero';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from './theme';

const stack = new NoticeStack();
let game: Phaser.Game | null = null;
let layer: Phaser.GameObjects.Container | null = null;
let layerScene: Phaser.Scene | null = null;

const activeScene = (): Phaser.Scene | null => game?.scene.getScenes(true)[0] ?? null;

/** Shows a notification bubble (top right). Tap or swipe it away; it also fades after a few seconds. */
export function notify(text: string): void {
  interactionLog.add(text);
  stack.push(text, performance.now());
  redraw();
  setTimeout(redraw, 6100);
}

function redraw(): void {
  const scene = activeScene();
  if (!scene) return;
  if (layerScene !== scene || !layer?.active) {
    layer?.destroy();
    layer = scene.add.container(0, 0).setDepth(26000).setScrollFactor(0).setData('noJuice', true).setName('notice-stack');
    layerScene = scene;
  }
  layer.removeAll(true);
  stack.visible(performance.now()).forEach((n, i) => {
    const label = scene.add.text(12, 8, n.text, textStyle(16, COLORS.text, { wordWrap: { width: 260 } }));
    const w = 284;
    const h = label.height + 16;
    const back = scene.add.rectangle(0, 0, w, h, AERO.glass, 0.92).setOrigin(0).setStrokeStyle(2, AERO.rim);
    const bubble = scene.add.container(GAME_WIDTH - w - 10, 10 + i * 62, [back, label]);
    bubble.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    scene.input.setDraggable(bubble);
    bubble.on('drag', (_p: Phaser.Input.Pointer, x: number) => (bubble.x = Math.max(GAME_WIDTH - w - 10, x)));
    bubble.on('dragend', () => {
      if (bubble.x > GAME_WIDTH - w + 30) {
        stack.dismiss(n.id);
        scene.tweens.add({ targets: bubble, x: GAME_WIDTH + 20, alpha: 0, duration: 200, onComplete: redraw });
      } else bubble.x = GAME_WIDTH - w - 10;
    });
    bubble.on('pointerdown', () => {
      if (!scene.input.activePointer.isDown) return;
    });
    layer!.add(bubble);
  });
}

// --- Captions -----------------------------------------------------------------------------------------------------

/** A lyric-style caption at the bottom of the screen for songs and jingles (I480). Fades itself. */
export function showCaption(text: string, ms = 2200): void {
  const scene = activeScene();
  if (!scene) return;
  const t = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 14, `♪ ${text} ♪`, textStyle(18, '#ffe9a8', { stroke: '#201020', strokeThickness: 4 })).setOrigin(0.5, 1).setDepth(26500).setScrollFactor(0).setData('noJuice', true).setName('caption');
  scene.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, y: GAME_HEIGHT - 20, duration: 240 });
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 360, onComplete: () => t.destroy() });
}

// --- Interaction log ----------------------------------------------------------------------------------------------

let logView: Phaser.GameObjects.Container | null = null;
function toggleLog(): void {
  if (logView?.active) {
    logView.destroy();
    logView = null;
    return;
  }
  const scene = activeScene();
  if (!scene) return;
  const rows = interactionLog.recent(14);
  const body = rows.length ? rows.map((r) => `• ${r.text}`).join('\n') : 'Nothing yet. Your recent choices and results show up here.';
  const title = scene.add.text(20, 14, 'Recent choices and results   (L closes)', textStyle(20, COLORS.gold));
  const text = scene.add.text(20, 48, body, textStyle(16, COLORS.text, { lineSpacing: 3, wordWrap: { width: 560 } }));
  const back = scene.add.rectangle(0, 0, 600, Math.min(GAME_HEIGHT - 40, text.height + 70), AERO.glass, 0.94).setOrigin(0).setStrokeStyle(3, AERO.rim);
  logView = scene.add.container(GAME_WIDTH / 2 - 300, 20, [back, title, text]).setDepth(27000).setScrollFactor(0).setData('noJuice', true).setName('interaction-log');
}

// --- Install ------------------------------------------------------------------------------------------------------

export function installOverlays(g: Phaser.Game, get: () => Settings): void {
  game = g;
  let lastInput = performance.now();
  let lastHint = performance.now();
  const touch = (): void => {
    lastInput = performance.now();
  };
  window.addEventListener('keydown', (e) => {
    touch();
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyL' && activeScene()?.scene.key !== 'Settings') toggleLog();
  });
  window.addEventListener('pointerdown', touch);
  // Idle hints (I479): a tip after a long quiet moment, never twice in a minute, never during a battle.
  setInterval(() => {
    const now = performance.now();
    const key = activeScene()?.scene.key;
    if (get().tooltipDelay === 'off' || key === 'Battle' || key === 'Boot') return;
    if (idleHintDue(now, lastInput, lastHint)) {
      lastHint = now;
      notify(`Tip: ${loadingTip(Math.floor(now / 1000))}`);
    }
  }, 5000);
  installSkipRing(g);
  installTouchGestures(g);
  installShake();
  installResizeBounce(g);
}

// --- Hold to skip -------------------------------------------------------------------------------------------------

/** Holding Esc or X for 0.7 s in a battle skips the current animation or message, with a filling ring. */
function installSkipRing(g: Phaser.Game): void {
  let since = -1;
  let ring: Phaser.GameObjects.Graphics | null = null;
  const stop = (): void => {
    since = -1;
    ring?.destroy();
    ring = null;
  };
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Escape' || e.code === 'KeyX') && !e.repeat && since < 0) since = performance.now();
  });
  window.addEventListener('keyup', stop);
  setInterval(() => {
    if (since < 0) return;
    const scene = activeScene();
    if (!scene || scene.scene.key !== 'Battle') return stop();
    const p = Math.min(1, (performance.now() - since) / 700);
    if (p < 0.2) return;
    ring ??= scene.add.graphics().setDepth(28000);
    ring.clear().lineStyle(6, AERO.rim, 0.9).beginPath().arc(GAME_WIDTH - 40, GAME_HEIGHT - 40, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false).strokePath();
    if (p >= 1) {
      const b = scene as unknown as { fx?: { skip?: () => void }; advance?: (() => void) | null };
      b.fx?.skip?.();
      b.advance?.();
      stop();
    }
  }, 50);
  void g;
}

// --- Touch swipes, pull-down tip ----------------------------------------------------------------------------------

function press(code: string, keyCode: number): void {
  for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code, key: code, keyCode, which: keyCode, bubbles: true } as KeyboardEventInit));
}

/** Touch swipes: left and right change tabs, a swipe down goes back (in a battle: up opens the Bag tab). On the title screen a pull-down shows a hidden tip. */
function installTouchGestures(g: Phaser.Game): void {
  let start: { x: number; y: number } | null = null;
  g.canvas?.addEventListener('pointerdown', (e) => {
    start = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  });
  g.canvas?.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dir = swipeDir(e.clientX - start.x, e.clientY - start.y);
    start = null;
    const key = activeScene()?.scene.key;
    if (!dir) return;
    if (key === 'MainMenu' && dir === 'down') return notify(`Hidden tip: ${loadingTip(Math.floor(e.timeStamp))}`);
    if (dir === 'left') press('ArrowLeft', 37);
    else if (dir === 'right') press('ArrowRight', 39);
    else if (dir === 'down') press('Escape', 27);
    else if (key === 'Battle') press('ArrowDown', 40);
  });
}

// --- Shake to undo ------------------------------------------------------------------------------------------------

/** Shaking a phone presses U, which undoes the last party-order move in the Pokémon screen. */
function installShake(): void {
  const samples: number[] = [];
  let last = 0;
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    samples.push(Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0));
    if (samples.length > 8) samples.shift();
    const now = performance.now();
    if (isShake(samples) && now - last > 1500) {
      last = now;
      press('KeyU', 85);
    }
  });
}

// --- Resize bounce ------------------------------------------------------------------------------------------------

/** After the window is resized, the Hub gives a small bounce so the layout settles visibly. */
function installResizeBounce(g: Phaser.Game): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const scene = activeScene();
      if (scene?.scene.key !== 'Hub') return;
      scene.tweens.add({ targets: scene.cameras.main, zoom: { from: 0.96, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    }, 200);
  });
  void g;
}

// --- Daily chest --------------------------------------------------------------------------------------------------

const CHEST_KEY = 'pkr.chestDay';
const CHEST_LINES = [
  'A shiny pebble. Pure decoration.',
  'A note: "The rival practised last night."',
  'A tiny doodle of a smiling Magikarp.',
  'Warm berry smell. Nothing else.',
  'A pressed leaf from a faraway route.',
  'Someone left a high-five here.',
];

/** A small chest on the title screen: tap to shake it open once a day. Cosmetic only: it pays nothing. */
export function dailyChest(scene: Phaser.Scene, x: number, y: number, today: string): void {
  let opened: string | null = null;
  try {
    opened = localStorage.getItem(CHEST_KEY);
  } catch {
    /* storage unavailable */
  }
  const ready = chestReady(opened, today);
  const chest = scene.add.text(x, y, ready ? '🎁' : '📦', { fontSize: '34px' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setName('daily-chest');
  const hint = scene.add.text(x, y + 30, ready ? 'Daily chest: tap to shake' : 'Come back tomorrow', textStyle(13, COLORS.textMuted)).setOrigin(0.5);
  let shakes = 0;
  chest.on('pointerdown', () => {
    if (!chestReady(opened, today)) return notify('The chest is empty until tomorrow.');
    shakes += 1;
    scene.tweens.add({ targets: chest, angle: { from: -16, to: 0 }, duration: 160, ease: 'Back.easeOut' });
    if (shakes < 3) return void hint.setText(`${3 - shakes} more…`);
    opened = today;
    try {
      localStorage.setItem(CHEST_KEY, today);
    } catch {
      /* storage unavailable */
    }
    chest.setText('📦');
    hint.setText('Opened!');
    notify(CHEST_LINES[Math.abs([...today].reduce((n, c) => n + c.charCodeAt(0), 0)) % CHEST_LINES.length]!);
  });
}
