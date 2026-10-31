// The Ultimate Rival (Living Rivalry Engine §7): not the strongest, but the rival whose history,
// stakes and standing make the most compelling central conflict. Evaluated at milestones, never
// locked at the start, and it can change when the story does.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { applyStoryEffect } from '../story/effects';
import type { Rival } from '../story/schema';
import { isHostile } from './outcome';
import { RIVAL_CONFIG } from './schema';

export const ULTIMATE_FLAG = 'ultimateRival';
/** Set once a rival has ever been the run's Ultimate Rival (it stays in the archive even if the story moves on). */
export const everUltimateFlag = (id: string) => `ultimate:ever:${id}`;
/** Set once the Ultimate Rival quest chain for this rival is complete and rewarded. */
export const ultimateDoneFlag = (id: string) => `ultimate:done:${id}`;
/** The emblem shown beside the Ultimate Rival's name. */
export const ULTIMATE_EMBLEM = '★★';

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
  run.story.flags[everUltimateFlag(best.r.id)] = true;
  return best.r;
}

/** The current battle is against the Ultimate Rival. */
export function isUltimateBattle(run: RunState): boolean {
  const id = run.battle?.rivalId;
  return Boolean(id) && ultimateRival(run)?.id === id;
}

export interface UltimateQuestStep {
  text: string;
  done: boolean;
}

const rivalWins = (run: RunState, id: string) => Number(run.story.flags[`rivalW:${id}`] ?? 0);

/** The Ultimate Rival quest chain (Rivalry Engine §14): chosen, beaten once, then settled. */
export function ultimateQuest(run: RunState, rival: Rival): UltimateQuestStep[] {
  const q = RIVAL_CONFIG.ultimate.quest;
  const wins = rivalWins(run, rival.id);
  // A settled quest stays settled, even if the rivalry later turns hostile again.
  const settled = Boolean(run.story.flags[ultimateDoneFlag(rival.id)]);
  return [
    { text: 'Become each other\'s Ultimate Rival', done: settled || Boolean(run.story.flags[everUltimateFlag(rival.id)]) },
    { text: 'Beat them in a rival battle', done: settled || wins >= 1 },
    { text: `Settle it: win ${q.settleWins} times, or end the rivalry for good`, done: settled || wins >= q.settleWins || !isHostile(rival) || rival.arc?.resolution != null },
  ];
}

/**
 * After a battle against `rival`: if it is (or was) the Ultimate Rival and every quest step is done, pays the
 * one-time reward and returns true. Mutates `run`.
 */
export function settleUltimateQuest(content: Content, run: RunState, rival: Rival): boolean {
  if (!run.story.flags[everUltimateFlag(rival.id)] || run.story.flags[ultimateDoneFlag(rival.id)]) return false;
  if (!ultimateQuest(run, rival).every((s) => s.done)) return false;
  const q = RIVAL_CONFIG.ultimate.quest;
  applyStoryEffect(content, run, `ultimate:${rival.id}:money`, { kind: 'money', amount: q.money });
  applyStoryEffect(content, run, `ultimate:${rival.id}:item`, { kind: 'item', itemId: q.itemId, quantity: q.quantity });
  run.story.flags[ultimateDoneFlag(rival.id)] = true;
  return true;
}
