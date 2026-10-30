import type { RunState } from '../core/state';

/** Which screen shows a run in its current phase. */
export function sceneForRun(run: RunState): string {
  switch (run.phase) {
    case 'starter':
      return 'StarterSelect';
    case 'map':
      return 'Map';
    case 'shop':
      return 'Shop';
    case 'battle':
      return 'Battle';
    case 'decision':
      return 'Decision';
    case 'reward':
      return 'Reward';
    case 'expedition':
      return 'Expedition';
    case 'over':
      return 'GameOver';
  }
}
