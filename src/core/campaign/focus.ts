// What each region is about (Campaign Director focus). Picked from the run's seed, never a gameplay random stream.
// Kept apart from director.ts so rules (rivals, events, dens) can read it without importing the director.

import type { RunState } from '../state';

export const FOCUSES = ['mystery', 'rivals', 'raids', 'exploration'] as const;
export type Focus = (typeof FOCUSES)[number];

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** What the region is about. Not every region has the same structure. */
export function regionFocus(run: Pick<RunState, 'seed' | 'regionOrder'>, regionIndex: number): Focus {
  return FOCUSES[hash(`${run.seed}:focus:${run.regionOrder[regionIndex] ?? regionIndex}`) % FOCUSES.length]!;
}

/** Mystery regions hold one more event stop per stage. */
export const MYSTERY_EXTRA_STOPS = 1;
/** Rival regions bring rivals back a stage sooner (never below one stage apart). */
export const RIVAL_FOCUS_GAP_CUT = 1;
