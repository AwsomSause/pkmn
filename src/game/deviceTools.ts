// Browser-side parts of the W12 tools: things kept on this device (never in a save), the recent-error buffer,
// offline support and the update notice. All of it is optional; if storage or the service worker is missing the game
// carries on. No gameplay RNG, no effect on outcomes.

import { updateAvailable } from '../core/tools/updateCheck';
import type { PackStore } from '../core/tools/modPacks';
import { BUILD_ID } from './buildInfo';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the tool just forgets */
  }
};

export const device = {
  get: read,
  set: write,
  changelogSeen: () => read('pkr.changelogSeen'),
  setChangelogSeen: (id: string) => write('pkr.changelogSeen', id),
  lastExport: () => read('pkr.lastExport'),
  markExported: (now: string) => write('pkr.lastExport', now),
  lastReminded: () => read('pkr.lastReminded'),
  markReminded: (now: string) => write('pkr.lastReminded', now),
};

export const packStore: PackStore = {
  get() {
    try {
      const v: unknown = JSON.parse(read('pkr.packs') ?? '[]');
      return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
    } catch {
      return [];
    }
  },
  set: (texts) => write('pkr.packs', JSON.stringify(texts)),
};

// ---------- recent errors (for the bug report) ----------

const ERRORS: string[] = [];
const MAX_ERRORS = 30;
const note = (kind: string, text: string) => {
  ERRORS.push(`${kind}: ${text}`.slice(0, 300));
  if (ERRORS.length > MAX_ERRORS) ERRORS.shift();
};
export const recentErrors = (): string[] => [...ERRORS];

export function installErrorLog(): void {
  window.addEventListener('error', (e) => note('error', e.message));
  window.addEventListener('unhandledrejection', (e) => note('rejection', String(e.reason)));
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      note(level, args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : JSON.stringify(a))).join(' '));
      original(...args);
    };
  }
}

// ---------- offline support and update notice ----------

export function registerOffline(): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  void navigator.serviceWorker.register(`./sw.js?b=${encodeURIComponent(BUILD_ID)}`).catch((err) => console.warn('Offline support is off:', err));
}

function showNotice(text: string): void {
  if (document.getElementById('update-notice')) return;
  const bar = document.createElement('div');
  bar.id = 'update-notice';
  bar.setAttribute('role', 'status');
  bar.textContent = `${text} `;
  const reload = document.createElement('button');
  reload.textContent = 'Reload';
  reload.onclick = () => window.location.reload();
  const later = document.createElement('button');
  later.textContent = 'Later';
  later.onclick = () => bar.remove();
  bar.append(reload, later);
  document.body.append(bar);
}

/** Looks for a newer build now and every ten minutes. A running game is never reloaded without a click. */
export function watchForUpdates(): void {
  if (BUILD_ID === 'dev') return;
  const check = () =>
    void fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: unknown) => {
        if (updateAvailable(BUILD_ID, v)) showNotice('A new version of the game is online.');
      })
      .catch(() => undefined);
  check();
  window.setInterval(check, 10 * 60_000);
}

// ---------- frame rate (debug overlay) ----------

/** Frames per second over the last second, from requestAnimationFrame. Debug display only. */
export function startFpsMeter(onUpdate: (fps: number) => void): void {
  let frames = 0;
  let last = performance.now();
  const tick = (t: number) => {
    frames += 1;
    if (t - last >= 1000) {
      onUpdate(Math.round((frames * 1000) / (t - last)));
      frames = 0;
      last = t;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
