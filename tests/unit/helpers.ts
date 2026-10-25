import { buildContent } from '../../src/data';
import type { Content } from '../../src/core/contentSchema';

export const content: Content = buildContent();

import { nextChoices } from '../../src/core/map';
import { chooseNode } from '../../src/core/run';
import type { RunState } from '../../src/core/state';

/** On the map, walks into the first normal (not harder) next node; otherwise returns the run unchanged. */
export function toBattle(run: RunState, c: Content = content): RunState {
  if (run.phase !== 'map') return run;
  const choices = nextChoices(run.stage!);
  const node = choices.find((n) => !n.harder) ?? choices[0]!;
  return chooseNode(c, run, node.id);
}
