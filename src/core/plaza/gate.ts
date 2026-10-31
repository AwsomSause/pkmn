// Where the Trainer Plaza stands on a stage map (kept apart from the flow so run.ts can use it).

import type { RunState } from '../state';

/**
 * The plaza is the guaranteed middle of every stage. Each route passes through every column once, so the
 * plaza stop hangs on every node of the middle column: whichever way the player went, the route meets it.
 * They share one plaza (one reputation, one stock). No random numbers are used.
 */
export function placePlaza(run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const middle = Math.ceil(stage.map.columns / 2);
  for (const node of stage.map.nodes) {
    if (node.column !== middle || node.sides.some((s) => s.kind === 'plaza')) continue;
    node.sides.push({ id: `plaza-${stage.index}`, kind: 'plaza', used: false });
  }
}
