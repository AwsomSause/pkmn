// Text-fit helpers (spec §12): text never leaves its box. Wrap first, then step down to a smaller crisp size
// where the font has one, and only then cut with "...". Pass `newText` to set the string and fit it in one go.

import type Phaser from 'phaser';
import { pixelFont } from './theme';

const DOTS = '...';

/** Cuts `s` so `measure(s + "...")` fits; keeps whole words when the cut lands inside a long text. */
function cut(s: string, fits: (candidate: string) => boolean): string {
  if (fits(s)) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(s.slice(0, mid).trimEnd() + DOTS)) lo = mid;
    else hi = mid - 1;
  }
  const head = s.slice(0, lo);
  const space = head.lastIndexOf(' ');
  const trimmed = space > head.length * 0.6 ? head.slice(0, space) : head;
  return trimmed.trimEnd() + DOTS;
}

/** One line of text no wider than `maxW`: a smaller crisp size first, then "...". */
export function fitLine(text: Phaser.GameObjects.Text, maxW: number, minSize = 16, newText?: string): Phaser.GameObjects.Text {
  // The first call remembers the size the text was made with, so later (shorter) strings grow back to it.
  const base = (text.getData('fitSize') as number | undefined) ?? (parseInt(String(text.style.fontSize), 10) || 16);
  text.setData('fitSize', base);
  const full = newText ?? text.text;
  if (parseInt(String(text.style.fontSize), 10) !== base) text.setFontSize(base);
  if (full.includes('\n')) {
    // Several lines (a label with a detail line): each line is cut on its own, at the current size.
    text.setText(full.split('\n').map((line) => cut(line, (c) => (text.setText(c), text.width <= maxW))).join('\n'));
    return text;
  }
  text.setText(full);
  let size = base;
  while (text.width > maxW && size > minSize) {
    const next = pixelFont(Math.round((size - 8) / 0.75)).size;
    if (next >= size) break;
    size = next;
    text.setFontSize(size);
  }
  if (text.width > maxW) text.setText(cut(full, (c) => (text.setText(c), text.width <= maxW)));
  return text;
}

/** A wrapped block no wider than `maxW` and no taller than `maxH`: whole lines, last one ends with "...". */
export function fitBlock(text: Phaser.GameObjects.Text, maxW: number, maxH: number, newText?: string): Phaser.GameObjects.Text {
  const full = newText ?? text.text;
  text.setWordWrapWidth(maxW, true);
  text.setText(full);
  if (text.height <= maxH) return text;
  text.setText(cut(full, (c) => (text.setText(c), text.height <= maxH)));
  return text;
}

/**
 * Keeps every Text inside `box` within a w × h area (local coordinates, `pad` from the edges): single lines that run
 * past the right edge shrink or get "..."; wrapped blocks are re-wrapped to the room that is left and cut by height.
 * Texts anchored on their right edge are left to the caller (they grow leftwards, away from the edge).
 */
export function clampTexts(box: Phaser.GameObjects.Container, w: number, h: number, pad = 10): void {
  const texts = box.list.filter((o): o is Phaser.GameObjects.Text => o.type === 'Text' && (o as Phaser.GameObjects.Text).visible);
  const spanOf = (t: Phaser.GameObjects.Text) => {
    const left = t.x - t.width * t.originX;
    const top = t.y - t.height * t.originY;
    return { left, right: left + t.width, top, bottom: top + t.height };
  };
  for (const t of texts) {
    // A fixed width cuts the text hard at the edge: swap it for a measured fit (one line, "..." at the end).
    const fixed = t.style.fixedWidth;
    if (fixed > 0 && t.originX === 0 && !((t.style.wordWrapWidth ?? 0) > 0)) {
      t.setFixedSize(0, 0);
      fitLine(t, fixed);
    }
  }
  for (const t of texts) {
    if (t.originX > 0.5) continue;
    const me = spanOf(t);
    // Room to the right: the box edge, or the nearest text on the same line that starts to the right of this one.
    let rightEdge = w - pad;
    for (const o of texts) {
      if (o === t) continue;
      const s = spanOf(o);
      if (s.left > me.left + 4 && s.top < me.bottom - 2 && s.bottom > me.top + 2) rightEdge = Math.min(rightEdge, s.left - 8);
    }
    const room = t.originX === 0 ? rightEdge - t.x : 2 * Math.min(t.x - pad, rightEdge - t.x);
    const wrap = (t.style as unknown as { wordWrapWidth?: number }).wordWrapWidth;
    if (wrap && wrap > 0) {
      const maxW = Math.min(wrap, room);
      const top = me.top;
      if (maxW > 20 && (maxW < wrap || top + t.height > h - 4)) fitBlock(t, maxW, Math.max(16, h - 4 - top));
    } else if (t.width > room && room > 20) fitLine(t, room);
  }
}
