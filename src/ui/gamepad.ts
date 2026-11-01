// Gamepad support (F187): the d-pad / left stick and two face buttons send the same key events as the keyboard and the
// on-screen pad, so every screen works with a controller. Which buttons confirm and go back is set in Settings > Controls.

import { buttonGlyph, glyphFamily, PAD_KEY, padActions, type PadAction } from '../core/presentation/uiPrefs';
import { notify } from './overlays';
import type { Settings } from '../core/state';

const REPEAT_MS = 220;

function press(action: PadAction): void {
  const k = PAD_KEY[action];
  for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: k.code, key: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true } as KeyboardEventInit));
}

export function installGamepad(get: () => Settings): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.getGamepads) return;
  // Controller glyph hints (F186): say which buttons confirm and go back, in the controller's own symbols.
  window.addEventListener('gamepadconnected', (e) => {
    const family = glyphFamily(e.gamepad.id);
    const s = get();
    notify(`Controller connected: ${buttonGlyph(family, s.gamepadMap.confirm)} confirms, ${buttonGlyph(family, s.gamepadMap.back)} goes back.`);
  });
  const held = new Map<PadAction, number>();
  const loop = (): void => {
    const now = performance.now();
    const pad = [...(navigator.getGamepads() ?? [])].find((p) => p?.connected);
    if (pad) {
      const s = get();
      const down = padActions({ buttons: pad.buttons.map((b) => b.pressed), axes: [...pad.axes] }, s.gamepadMap);
      for (const a of down) {
        const next = held.get(a);
        const moving = a !== 'confirm' && a !== 'back';
        if (next === undefined) {
          press(a);
          held.set(a, now + 350);
        } else if (moving && now >= next) {
          press(a);
          held.set(a, now + REPEAT_MS);
        }
      }
      for (const a of [...held.keys()]) if (!down.has(a)) held.delete(a);
    } else held.clear();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** The first connected controller's id string (for glyph hints), or null. */
export function connectedPadId(): string | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  return [...(navigator.getGamepads() ?? [])].find((p) => p?.connected)?.id ?? null;
}

/**
 * Waits for the next button press on any controller (buttons already held are ignored) and calls back with its number.
 * Returns a cancel function. Used by Settings > Controls > "Remap by pressing buttons".
 */
export function listenForButton(onButton: (n: number) => void): () => void {
  let stopped = false;
  const held = new Set<number>();
  const poll = (): void => {
    if (stopped) return;
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    if (pad) {
      const now = pad.buttons.map((b, i) => (b.pressed ? i : -1)).filter((i) => i >= 0);
      for (const i of now) {
        if (!held.has(i)) {
          stopped = true;
          return onButton(i);
        }
      }
      held.clear();
      now.forEach((i) => held.add(i));
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  return () => {
    stopped = true;
  };
}
