// Framed screenshots (F9) and run share cards (F10), saved as PNG files. Presentation only: nothing is uploaded.

import type Phaser from 'phaser';
import { continueLines } from '../core/presentation/continueLines';
import { shareCardRows, shotFileName } from '../core/presentation/uiPrefs';
import { lookSpecies } from '../core/pokemon';
import type { GameSession } from '../game/GameSession';

function save(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/** The game screen inside a rounded white frame with a small watermark. */
export function framedScreenshot(game: Phaser.Game, watermark = true): void {
  game.renderer.snapshot((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    const pad = 28;
    const out = document.createElement('canvas');
    out.width = img.width + pad * 2;
    out.height = img.height + pad * 2 + (watermark ? 22 : 0);
    const g = out.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, out.width, out.height);
    grad.addColorStop(0, '#7ff3ff');
    grad.addColorStop(1, '#ff4fd8');
    g.fillStyle = grad;
    g.fillRect(0, 0, out.width, out.height);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(pad - 6, pad - 6, img.width + 12, img.height + 12, 14);
    g.fill();
    g.drawImage(img, pad, pad);
    if (watermark) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = '14px system-ui, sans-serif';
      g.textAlign = 'right';
      g.fillText('Pocket Raiders', out.width - pad, out.height - 10);
    }
    save(out, shotFileName('screenshot', new Date()));
  });
}

/** A card with the current run's trainer, progress and team. Returns false when there is no run. */
export function runShareCard(session: GameSession): boolean {
  const run = session.run;
  if (!run) return false;
  const rows = shareCardRows({
    title: 'Pocket Raiders',
    lines: continueLines(session.content, run),
    team: run.party.map((m) => ({ name: lookSpecies(session.content, m).name, level: m.level })),
    seed: String((run as { seed?: unknown }).seed ?? ''),
  });
  const w = 720;
  const h = 120 + rows.length * 34;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0b2a4a');
  grad.addColorStop(1, '#3a1860');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#7ff3ff';
  g.lineWidth = 6;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#ffffff';
  rows.forEach((r, i) => {
    g.font = i === 0 ? 'bold 34px system-ui, sans-serif' : '22px system-ui, sans-serif';
    g.fillText(r, 40, 62 + i * 34);
  });
  save(c, shotFileName('card', new Date()));
  return true;
}

export function installShareTools(game: Phaser.Game, session: GameSession): void {
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'F9') {
      e.preventDefault();
      framedScreenshot(game);
    } else if (e.code === 'F10') {
      e.preventDefault();
      runShareCard(session);
    }
  });
}
