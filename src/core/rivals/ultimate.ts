// The Ultimate Rival (Living Rivalry Engine §7): not the strongest, but the rival whose history,
// stakes and standing make the most compelling central conflict. Evaluated at milestones, never
// locked at the start, and it can change when the story does.

import type { RunState } from '../state';
import type { Rival } from '../story/schema';
import { isHostile } from './outcome';
import { RIVAL_CONFIG } from './schema';

export const ULTIMATE_FLAG = 'ultimateRival';

const cap = (n: number) => Math.max(0, Math.min(100, n));

/** 0–100: a weighted blend of intensity, shared history, threat, stakes, relevance, progression and open conflict. */
export function ultimateScore(rival: Rival, regionIndex: number): number {
  const w = RIVAL_CONFIG.ultimate.weights;
  const f = {
    intensity: cap(rival.rivalPotential * 2),
    history: cap(rival.encounters * 30 + rival.adaptations.length * 10),
    threat: cap(rival.memory.lastBattle.team.length * 12 + rival.traits.resilience * 0.4),
    stakes: cap((rival.traits.vindictiveness + rival.traits.pride) / 2),
    relevance: rival.origin.where.region === regionIndex ? 100 : 50,
    progression: rival.traits.ambition,
    unresolved: isHostile(rival) ? 100 : 0,
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return (Object.keys(w) as (keyof typeof w)[]).reduce((sum, k) => sum + f[k] * w[k], 0) / total;
}

/** Eligible: a real history with you and a rivalry that has not ended. */
export function isCandidate(rival: Rival): boolean {
  return rival.encounters >= RIVAL_CONFIG.ultimate.minEncounters && isHostile(rival);
}

/** The Ultimate Rival now, if the run has chosen one. */
export function ultimateRival(run: RunState): Rival | null {
  const id = run.story.flags[ULTIMATE_FLAG];
  return typeof id === 'string' ? (run.story.rivals.find((r) => r.id === id) ?? null) : null;
}

/** Re-evaluates the designation. Returns the rival newly chosen, or null if nothing changed. */
export function evaluateUltimate(run: RunState): Rival | null {
  const current = ultimateRival(run);
  const keep = current && isCandidate(current) ? current : null;
  const ranked = run.story.rivals.filter(isCandidate).map((r) => ({ r, score: ultimateScore(r, run.regionIndex) })).sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
  const best = ranked[0];
  if (!best) {
    if (current && !keep) delete run.story.flags[ULTIMATE_FLAG];
    return null;
  }
  // A new rival must clearly beat the one the story already follows.
  if (keep && best.r.id !== keep.id && best.score < ultimateScore(keep, run.regionIndex) + RIVAL_CONFIG.ultimate.switchMargin) return null;
  if (keep && best.r.id === keep.id) return null;
  run.story.flags[ULTIMATE_FLAG] = best.r.id;
  return best.r;
}
