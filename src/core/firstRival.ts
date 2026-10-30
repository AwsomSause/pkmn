// The first rival (Kice): met on stage 2, and the Exp. Share (and the bench's share of EXP) only start after that fight.

import type { Content } from './contentSchema';
import type { RunState } from './state';

export const FIRST_RIVAL_FLAG = 'first-rival';

/**
 * True once the first rival has been fought. If a run somehow skipped every ordinary trainer of that stage,
 * it switches on a stage later, so the party is never left without it.
 */
export function expShareUnlocked(content: Content, run: Pick<RunState, 'story' | 'regionIndex' | 'stage' | 'campaignId'>): boolean {
  if (run.story.flags[FIRST_RIVAL_FLAG] === 'met') return true;
  if (run.regionIndex > 0) return true;
  return (run.stage?.index ?? 0) > content.balance.rival.stage + 1;
}
