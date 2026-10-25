import type { RunState } from '../core/state';

/** Which screen shows a run in its current phase. */
export function sceneForRun(run: RunState): string {
  switch (run.phase) {
    case 'starter':
      return 'StarterSelect';
    case 'battle':
      return 'Battle';
    case 'decision':
      return 'Decision';
    case 'reward':
      return 'Reward';
    case 'over':
      return 'GameOver';
  }
}
