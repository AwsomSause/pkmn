// Objectives of a themed mode (Untitled doc §16.4): shown on the map and counted from the run's own counters,
// so a reload or a replay changes nothing. Spooky Mode: clear stages, collect clues, beat the keeper, finish the finale.

import type { RunState } from './state';

export interface ModeObjective {
  text: string;
  current: number;
  target: number;
  done: boolean;
}

const objective = (text: string, current: number, target: number): ModeObjective => ({ text, current: Math.min(current, target), target, done: current >= target });

/** The run's mode objectives (none outside Spooky Mode). */
export function modeObjectives(run: Pick<RunState, 'rules' | 'badges' | 'log'>): ModeObjective[] {
  if (run.rules.modeId !== 'spooky') return [];
  const c = run.log.counters;
  return [
    objective('Win four gym badges', run.badges.length, 4),
    objective('Collect three clues', c.eventClues ?? 0, 3),
    objective('Beat the Hexed Keeper', c.eventBossesWon ?? 0, 1),
    objective('Finish the Hollow Mirror', c.eventFinalesWon ?? 0, 1),
  ];
}

export function objectivesLine(list: readonly ModeObjective[]): string {
  return list.map((o) => `${o.done ? '✓' : '○'} ${o.text}${o.target > 1 && !o.done ? ` (${o.current}/${o.target})` : ''}`).join('   ');
}

/** The line a battle in the mode opens with, or null. */
export function modeBattleLine(modeId: string, isBoss: boolean): string | null {
  if (modeId !== 'spooky') return null;
  return isBoss ? 'The air goes cold. Something old is watching...' : 'A chill runs down your spine...';
}
