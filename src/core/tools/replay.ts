// F216: replay validator. A run is deterministic (same state + seed + actions = same result), so playing a seed twice
// must give the same digest. `runDigest` is a stable fingerprint of the parts of a run that matter. Pure.

import { hashSeed } from '../rng';
import type { RunState } from '../state';

/** The fields that must match between two plays of the same seed. */
export function digestFields(run: RunState): unknown[] {
  return [run.seed, run.phase, run.encountersCompleted, run.money, run.badges, run.regionIndex, run.party.map((p) => [p.speciesId, p.level, p.hp, p.xp]), run.inventory, run.rng];
}

export function runDigest(run: RunState): string {
  const h = hashSeed(JSON.stringify(digestFields(run)));
  return [h.a, h.b, h.c, h.d].map((n) => n.toString(16).padStart(8, '0')).join('');
}

export interface ReplayVerdict {
  seed: string;
  ok: boolean;
  first: string;
  second: string;
}

/** Plays the same seed twice with `play` and compares digests. */
export function validateReplay(seed: string, play: (seed: string) => RunState): ReplayVerdict {
  const first = runDigest(play(seed));
  const second = runDigest(play(seed));
  return { seed, ok: first === second, first, second };
}
