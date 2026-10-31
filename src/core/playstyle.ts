// Playstyle run titles (catalog 155): at the end of a run the way it was played earns one title, picked from
// the run's own counters. Recognition only: nothing here changes a stat or a reward. No random numbers.

import type { RunState } from './state';

export interface Playstyle {
  id: string;
  title: string;
  /** The line shown in the Chronicle. */
  line: string;
  /** What the run's counters must show, as [counter, needed] pairs (all must be met). */
  needs: [string, number][];
  /** Optional ceilings (a counter at or under this), for styles like the Tactician. */
  atMost?: [string, number][];
}

export const PLAYSTYLES: Playstyle[] = [
  { id: 'collector', title: 'The Collector', line: 'You caught far more than you needed, because you could.', needs: [['pokemonCaught', 10]] },
  { id: 'raider', title: 'The Raider', line: 'Raid dens and Totems were where you felt at home.', needs: [['raidsWon', 2], ['totemsWon', 1]] },
  { id: 'rival-breaker', title: 'The Rival Breaker', line: 'Every rival who crossed your path went home thinking about it.', needs: [['rivalBattlesWon', 4]] },
  { id: 'evolutionist', title: 'The Evolutionist', line: 'Your team grew up on the road.', needs: [['evolutions', 8]] },
  { id: 'breeder', title: 'The Nurturer', line: 'Eggs hatched in your care, one after another.', needs: [['eggsHatched', 3]] },
  { id: 'wanderer', title: 'The Wanderer', line: 'You never passed a strange stop without a look.', needs: [['eventsCompleted', 12]] },
  { id: 'tycoon', title: 'The Tycoon', line: 'Money followed you everywhere, and so did the bills.', needs: [['moneyEarned', 30000]] },
  { id: 'tactician', title: 'The Tactician', line: 'Won plenty and rarely needed to rest.', needs: [['battlesWon', 20]], atMost: [['healStopsUsed', 2]] },
  { id: 'survivor', title: 'The Survivor', line: 'You went down more than once and got back up every time.', needs: [['wipes', 3], ['battlesWon', 10]] },
];

const counterOf = (run: RunState, key: string): number => (key === 'wipes' ? run.rules.wipes : (run.log.counters[key] ?? 0));

/** How far past its thresholds the run is (0 when a style isn't met); the biggest margin wins, ties go to the list order. */
function margin(run: RunState, p: Playstyle): number {
  if (p.atMost?.some(([k, max]) => counterOf(run, k) > max)) return 0;
  const ratios = p.needs.map(([k, need]) => counterOf(run, k) / need);
  return Math.min(...ratios) >= 1 ? Math.min(...ratios) : 0;
}

/** The title this run's playstyle earned, or null when no style stands out. */
export function playstyleOf(run: RunState): Playstyle | null {
  let best: { p: Playstyle; m: number } | null = null;
  for (const p of PLAYSTYLES) {
    const m = margin(run, p);
    if (m > 0 && (!best || m > best.m)) best = { p, m };
  }
  return best?.p ?? null;
}
