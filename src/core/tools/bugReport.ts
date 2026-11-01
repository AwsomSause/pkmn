// F212: the bug-report bundle: version, seed, a short log and a digest, as plain text the player can copy or save.
// Never includes the save file or anything personal. Pure.

import { runDigest } from './replay';
import { isAssisted } from './assisted';
import type { RunState, Settings } from '../state';

export interface BugReportInput {
  version: string;
  build: string;
  now: string;
  userAgent: string;
  scene: string;
  run: RunState | null;
  settings: Settings;
  /** Recent console errors and warnings, oldest first. */
  errors: string[];
  note: string;
}

export interface BugReport {
  format: 1;
  version: string;
  build: string;
  at: string;
  userAgent: string;
  scene: string;
  note: string;
  run: null | { seed: string; trainer: string; phase: string; region: number; encounters: number; party: string[]; rulesVersion: string; assisted: boolean; digest: string; log: string[] };
  settings: Record<string, unknown>;
  errors: string[];
}

const SETTING_KEYS: (keyof Settings)[] = ['battleAnimations', 'battleSpeed', 'performancePreset', 'uiScale', 'uiTheme', 'reduceParticles', 'disableAllAnimations', 'fontSize', 'highContrast'];

export function buildBugReport(i: BugReportInput): BugReport {
  const run = i.run;
  return {
    format: 1,
    version: i.version,
    build: i.build,
    at: i.now,
    userAgent: i.userAgent.slice(0, 200),
    scene: i.scene,
    note: i.note.slice(0, 500),
    run: run
      ? {
          seed: run.seed,
          trainer: run.archetypeId,
          phase: run.phase,
          region: run.regionIndex,
          encounters: run.encountersCompleted,
          party: run.party.map((p) => `${p.speciesId} L${p.level}`),
          rulesVersion: String(run.rules.ruleVersion ?? '?'),
          assisted: isAssisted(run),
          digest: runDigest(run),
          log: run.story.events.slice(-30).map((e) => `#${e.seq} ${e.type}`),
        }
      : null,
    settings: Object.fromEntries(SETTING_KEYS.map((k) => [k, i.settings[k]])),
    errors: i.errors.slice(-20),
  };
}

/** One line a player can paste into a chat. */
export const bugReportHeadline = (r: BugReport): string => `v${r.version} (${r.build})${r.run ? ` seed ${r.run.seed}` : ' no run'}${r.run?.assisted ? ' [assisted]' : ''}${r.errors.length ? ` · ${r.errors.length} errors` : ''}`;
