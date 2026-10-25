import { buildContent } from '../../src/data';
import type { Content } from '../../src/core/contentSchema';

export const content: Content = buildContent();

import { levelScale, type LevelScale } from '../../src/core/encounters';
import { nextChoices } from '../../src/core/map';
import { chooseNode } from '../../src/core/run';
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
