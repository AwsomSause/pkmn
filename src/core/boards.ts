// Local Daily and Weekly scoreboards (ideas M108/F78/M109/F79). The game is a static site, so the boards live on this device only:
// your own best runs for each day or week. Pure: no RNG.

import { legacyOf, withLegacy } from './legacy';
import type { Profile, RunState } from './state';

export type BoardKind = 'daily' | 'weekly';
export const BOARD_SIZE = 10;

/** The board a run belongs to, from its seed ("daily-2026-11-01", "weekly-2026-W44"), or null for an ordinary run. */
export const boardKey = (seed: string): { kind: BoardKind; key: string } | null =>
  seed.startsWith('daily-') ? { kind: 'daily', key: seed } : seed.startsWith('weekly-') ? { kind: 'weekly', key: seed } : null;

/** 1000 for a victory, 300 per region cleared, 100 per badge, 5 per encounter. */
export const runScore = (run: Pick<RunState, 'victory' | 'regionsCleared' | 'badges' | 'encountersCompleted'>): number =>
  (run.victory ? 1000 : 0) + run.regionsCleared.length * 300 + run.badges.length * 100 + run.encountersCompleted * 5;

/** Adds a finished run to its board once (a run id already on it is ignored). Best score first, trimmed to BOARD_SIZE. */
export function recordBoardRun(profile: Profile, run: RunState, now: string): Profile {
  const board = boardKey(run.seed);
  if (!board) return profile;
  const entries = legacyOf(profile).boards[board.kind] ?? [];
  if (entries.some((e) => e.runId === run.runId)) return profile;
  const entry = { key: board.key, runId: run.runId, at: now, archetypeId: run.archetypeId, score: runScore(run), badges: run.badges.length, encounters: run.encountersCompleted, victory: !!run.victory };
  return withLegacy(profile, (l) => {
    l.boards = { ...l.boards, [board.kind]: [...entries, entry].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).slice(0, BOARD_SIZE) };
  });
}

/** Board lines for the Run Prep screen: this period's best, then the all-time top 3. */
export function boardLines(profile: Pick<Profile, 'legacy'>, kind: BoardKind, currentKey: string): string[] {
  const entries = legacyOf(profile).boards[kind] ?? [];
  const mine = entries.filter((e) => e.key === currentKey);
  const lines = [mine.length > 0 ? `Your best this ${kind === 'daily' ? 'day' : 'week'}: ${mine[0]!.score} pts (${mine[0]!.badges} badges${mine[0]!.victory ? ', won' : ''})` : `No ${kind} run on this device yet.`];
  entries.slice(0, 3).forEach((e, i) => lines.push(`${i + 1}. ${e.score} pts · ${e.key.replace(/^(daily|weekly)-/, '')} · ${e.badges} badges`));
  return lines;
}
