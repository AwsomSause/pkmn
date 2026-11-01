// The interaction prompt widget (ideas W0): shows one data-driven prompt (core/interaction/prompt.ts) and
// resolves with a PromptResult. It only collects timestamps and positions; every grade comes from the pure
// judges, so what you see never decides an outcome. Controls: pointer or Space/Enter (tap, hold, timing,
// rhythm) and pointer drag (drag, where Space/Enter can't aim, so the assist skip is offered instead).
// Esc skips (counted as a skipped 'ok'). Reduced/Off motion draws the same prompt without the bounce.

import Phaser from 'phaser';
import { resolveAnim } from '../core/presentation/animRegistry';
import '../core/interaction/reactions';
import { animSettingsFrom } from '../core/accessibility';
import type { Settings } from '../core/state';
import {
  judgeDrag, judgeHold, judgeRhythm, judgeTap, judgeTiming, promptLengthMs, skippedResult,
  type PromptAssist, type PromptDef, type PromptResult,
} from '../core/interaction/prompt';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from './theme';

const BOX = { w: 360, h: 220 };
const GRADE_COLOR: Record<string, string> = { miss: '#ff6a6a', ok: '#ffe08a', good: '#8affc0', perfect: '#9fe8ff' };

export interface PromptOptions {
  assist?: PromptAssist;
  /** Where the panel centres; defaults to the screen centre. */
  at?: { x: number; y: number };
  /** Full / reduced / off motion (from the player's settings). */
  motion?: 'full' | 'reduced' | 'off';
}

/** Runs one prompt and resolves with its result. Cleans up all its objects and listeners. */
export function runInteractionPrompt(scene: Phaser.Scene, def: PromptDef, opts: PromptOptions = {}): Promise<PromptResult> {
  return new Promise((resolve) => {
    const assist = opts.assist ?? {};
    const motion = opts.motion ?? 'full';
    const cx = opts.at?.x ?? GAME_WIDTH / 2;
    const cy = opts.at?.y ?? GAME_HEIGHT / 2;
    const left = cx - BOX.w / 2;
    const top = cy - BOX.h / 2;
    const root = scene.add.container(0, 0).setDepth(1000);
    const gfx = scene.add.graphics();
    const title = scene.add.text(cx, top - 26, def.label, textStyle(22, COLORS.text)).setOrigin(0.5);
    const hint = scene.add.text(cx, top + BOX.h + 16, `${def.hint}  (Esc skips)`, textStyle(14, '#c8c0d8')).setOrigin(0.5);
    const verdict = scene.add.text(cx, cy, '', textStyle(34, '#ffffff')).setOrigin(0.5).setAlpha(0);
    root.add([gfx, title, hint, verdict]);
    if (motion === 'full') {
      root.setScale(0.9).setAlpha(0);
      scene.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    }

    const t0 = scene.time.now;
    const now = () => scene.time.now - t0;
    let pressAt: number | null = null; // first press (tap/timing) or hold start
    let heldMs: number | null = null;
    let dragEnd: [number, number] | null = null;
    let dragStartMs = 0;
    let dragging = false;
    const presses: number[] = [];
    let finished = false;
    const toBox = (p: Phaser.Input.Pointer): [number, number] => [((p.x - left) / BOX.w) * 100, ((p.y - top) / BOX.h) * 100];
    const px = (v: [number, number]) => ({ x: left + (v[0] / 100) * BOX.w, y: top + (v[1] / 100) * BOX.h });

    const finish = (result: PromptResult) => {
      if (finished) return;
      finished = true;
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointermove', onMove);
      scene.input.keyboard?.off('keydown', onKeyDown);
      scene.input.keyboard?.off('keyup', onKeyUp);
      tick.destroy();
      verdict.setText(result.skipped ? 'Skipped' : result.grade.toUpperCase()).setColor(GRADE_COLOR[result.grade] ?? '#ffffff').setAlpha(1);
      if (motion === 'full') scene.tweens.add({ targets: verdict, scale: { from: 0.6, to: 1.1 }, duration: 260, ease: 'Back.easeOut' });
      window.setTimeout(() => { try { root.destroy(true); } catch { /* scene already gone */ } resolve(result); }, motion === 'off' ? 250 : 650);
    };

    const judge = (): PromptResult => {
      switch (def.kind) {
        case 'tap': return judgeTap(def, pressAt, assist);
        case 'hold': return judgeHold(def, heldMs ?? (pressAt !== null ? now() - pressAt : null), assist);
        case 'drag': return judgeDrag(def, dragEnd, dragEnd ? now() - dragStartMs : 0, assist);
        case 'timing': return judgeTiming(def, pressAt, assist);
        case 'rhythm': return judgeRhythm(def, presses, assist);
      }
    };

    const press = () => {
      const t = now();
      if (assist.skip) return finish(skippedResult(assist));
      if (def.kind === 'rhythm') {
        presses.push(t);
        pulse();
      } else if (def.kind === 'hold') {
        if (pressAt === null) pressAt = t;
      } else if (def.kind === 'tap' || def.kind === 'timing') {
        if (pressAt === null) { pressAt = t; finish(judge()); }
      }
    };
    const release = () => {
      if (def.kind === 'hold' && pressAt !== null && heldMs === null) { heldMs = now() - pressAt; finish(judge()); }
    };
    const onDown = (p: Phaser.Input.Pointer) => {
      if (def.kind === 'drag') {
        if (!assist.skip) { dragging = true; dragStartMs = now(); dragEnd = toBox(p); }
        else finish(skippedResult(assist));
      } else press();
    };
    const onMove = (p: Phaser.Input.Pointer) => { if (dragging) dragEnd = toBox(p); };
    const onUp = (p: Phaser.Input.Pointer) => {
      if (def.kind === 'drag' && dragging) { dragging = false; dragEnd = toBox(p); finish(judge()); } else release();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') return finish(skippedResult({ skipGrade: 'ok' }));
      if (e.key === ' ' || e.key === 'Enter') press();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') release(); };
    scene.input.on('pointerdown', onDown);
    scene.input.on('pointerup', onUp);
    scene.input.on('pointermove', onMove);
    scene.input.keyboard?.on('keydown', onKeyDown);
    scene.input.keyboard?.on('keyup', onKeyUp);

    let pulseUntil = 0;
    function pulse() { pulseUntil = now() + 120; }

    const draw = () => {
      const t = now();
      gfx.clear();
      gfx.fillStyle(0x10121c, 0.88).fillRoundedRect(left, top, BOX.w, BOX.h, 16);
      gfx.lineStyle(3, 0x9fe8ff, 0.9).strokeRoundedRect(left, top, BOX.w, BOX.h, 16);
      const mid = { x: cx, y: cy };
      switch (def.kind) {
        case 'tap': {
          if (t < 400) break; // the mark appears after a short beat
          gfx.fillStyle(0xffe060, 1).fillCircle(mid.x, mid.y, 34);
          gfx.lineStyle(4, 0xffffff, 0.9).strokeCircle(mid.x, mid.y, 34);
          break;
        }
        case 'timing': {
          const k = Math.min(1, t / def.landMs);
          gfx.lineStyle(4, 0xffffff, 0.8).strokeCircle(mid.x, mid.y, 30);
          gfx.lineStyle(5, 0x9fe8ff, 1).strokeCircle(mid.x, mid.y, 30 + (1 - k) * 90);
          break;
        }
        case 'hold': {
          const k = Math.min(1, pressAt === null ? 0 : (t - pressAt) / def.targetMs);
          gfx.lineStyle(4, 0xffffff, 0.8).strokeCircle(mid.x, mid.y, 44);
          gfx.fillStyle(0x78f090, 0.85).fillCircle(mid.x, mid.y, 44 * k);
          break;
        }
        case 'drag': {
          const a = px(def.from);
          const b = px(def.to);
          gfx.fillStyle(0xffffff, 0.9).fillCircle(a.x, a.y, 10);
          gfx.lineStyle(3, 0xffe060, 0.6).strokeCircle(b.x, b.y, 22).strokeCircle(b.x, b.y, 8);
          if (dragging && dragEnd) { const p = px(dragEnd); gfx.lineStyle(3, 0x9fe8ff, 0.9).lineBetween(a.x, a.y, p.x, p.y); gfx.fillStyle(0x9fe8ff, 1).fillCircle(p.x, p.y, 8); }
          break;
        }
        case 'rhythm': {
          const y = cy;
          const span = BOX.w - 60;
          const last = Math.max(...def.beatsMs) + 400;
          gfx.lineStyle(2, 0xffffff, 0.4).lineBetween(left + 30, y, left + 30 + span, y);
          for (const b of def.beatsMs) gfx.fillStyle(0xffe060, 1).fillCircle(left + 30 + (b / last) * span, y, 8);
          const headX = left + 30 + Math.min(1, t / last) * span;
          gfx.fillStyle(t < pulseUntil ? 0x78f090 : 0x9fe8ff, 1).fillCircle(headX, y, 12);
          break;
        }
      }
    };

    const tick = scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        if (finished) return;
        draw();
        // Don't hang: end at the latest when the prompt's length is up.
        if (now() > promptLengthMs(def) + 300 && !(def.kind === 'drag' && dragging)) finish(judge());
      },
    });
  });
}

/** Plays a tiny reaction cue (core/interaction/reactions.ts) above (x, y). Decoration only; resolves when done. */
export function playReaction(scene: Phaser.Scene, settings: Settings, id: string, x: number, y: number): Promise<void> {
  const plan = resolveAnim(id, animSettingsFrom(settings));
  if (!plan || !plan.play) return Promise.resolve();
  return new Promise((resolve) => {
    const label = scene.add.text(x, y, plan.glyph, textStyle(30, plan.color)).setOrigin(0.5).setDepth(1001);
    if (plan.reduced) {
      scene.tweens.add({ targets: label, alpha: 0, duration: plan.ms, onComplete: () => { label.destroy(); resolve(); } });
      return;
    }
    label.setScale(0.4);
    scene.tweens.add({
      targets: label, y: y - 26, scale: 1.15, duration: plan.ms * 0.45, ease: 'Back.easeOut',
      onComplete: () => scene.tweens.add({ targets: label, y: y - 40, alpha: 0, duration: plan.ms * 0.55, ease: 'Sine.easeIn', onComplete: () => { label.destroy(); resolve(); } }),
    });
  });
}
