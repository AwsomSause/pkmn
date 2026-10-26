import { buildContent } from '../../src/data';
import type { Content } from '../../src/core/contentSchema';

export const content: Content = buildContent();

import { levelScale, type LevelScale } from '../../src/core/encounters';
import { nextChoices } from '../../src/core/map';
import { chooseNode, chooseReward } from '../../src/core/run';
import type { RunState } from '../../src/core/state';

/** The difficulty curve at a point of the full campaign (region, stage and column count from 0, 0, 1). */
export function scaleAt(stageIndex: number, column: number, regionIndex = 0, c: Content = content): LevelScale {
  return levelScale(c, c.campaigns.get('full')!, regionIndex, stageIndex, column);
}

/** On the map, walks into the first normal (not harder) next node; otherwise returns the run unchanged. */
export function toBattle(run: RunState, c: Content = content): RunState {
  if (run.phase !== 'map') return run;
  const choices = nextChoices(run.stage!);
  const node = choices.find((n) => !n.harder) ?? choices[0]!;
  return chooseNode(c, run, node.id);
}

import { rewardTargetProblem } from '../../src/core/rewards';

/**
 * Takes the first reward in the draft that some party member can receive,
 * repeating after a free re-roll, the way a player who just clicks through would.
 */
export function takeAnyReward(run: RunState, c: Content = content): RunState {
  let guard = 0;
  while (run.phase === 'reward' && guard++ < 20) {
    let picked: RunState | null = null;
    for (let i = 0; i < run.draft!.length && !picked; i++) {
      const reward = c.rewards.get(run.draft![i]!)!;
      const target = run.party.findIndex((_, t) => rewardTargetProblem(c, run, reward, t) === null);
      if (target >= 0) picked = chooseReward(c, run, i, target).run;
    }
    if (!picked) throw new Error('No reward in the draft can be taken');
    run = picked;
  }
  return run;
}
