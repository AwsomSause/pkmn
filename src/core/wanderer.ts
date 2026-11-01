// Ideas W4: the wandering trainer (M93) and travelling companions (F92).
// A trainer you meet at a map event can start tailing you: after a few nodes they step out and challenge you
// (an event stop opens beside the node you reach). Beat them and they may travel with you: for the next few
// stages they catch up once per stage (a stop near the middle of the map) with help for the road.
// State lives in run.itemCounters (numbers only), so it survives stage changes and reloads; nothing here rolls.

import type { RunState } from './state';

export const WANDERER_CHALLENGE = 'w4-wanderer-challenge';
export const WANDERER_VISIT = 'w4-wanderer-visit';
const LEFT = 'wanderer-left';
const FRIEND = 'wanderer-friend';

/** A trainer starts tailing you: they challenge you after `nodes` more nodes (mutates `run`). */
export function startWanderer(run: RunState, nodes: number): void {
  run.itemCounters = { ...run.itemCounters, [LEFT]: nodes };
}

/** The trainer becomes a travelling companion for the next `stages` stages (mutates `run`). */
export function befriendWanderer(run: RunState, stages: number): void {
  run.itemCounters = { ...run.itemCounters, [LEFT]: 0, [FRIEND]: stages };
}

/** Nodes until the tailing trainer steps out (0 = nobody is following). */
export const wandererLeft = (run: Pick<RunState, 'itemCounters'>): number => run.itemCounters?.[LEFT] ?? 0;
/** Stages the travelling companion still has with you. */
export const companionLeft = (run: Pick<RunState, 'itemCounters'>): number => run.itemCounters?.[FRIEND] ?? 0;

/** One node walked (mutates `run`): the tailing trainer gets closer, and steps out beside the node at 0. */
export function wandererStep(_content: unknown, run: RunState): void {
  const left = wandererLeft(run);
  const stage = run.stage;
  if (left <= 0 || !stage || stage.kind !== 'stage' || stage.current === null) return;
  run.itemCounters = { ...run.itemCounters, [LEFT]: left - 1 };
  if (left - 1 > 0) return;
  const here = stage.map.nodes.find((n) => n.id === stage.current)!;
  here.sides.push({ id: `wanderer-${here.id}-${here.sides.length + 1}`, kind: 'event', used: false, eventId: WANDERER_CHALLENGE });
  if (run.itemCounters) delete run.itemCounters[`event-seen:${WANDERER_CHALLENGE}`];
}

/** A new stage (mutates `run`): a travelling companion catches up once, beside a node near the middle. */
export function wandererStageStart(run: RunState): void {
  const left = companionLeft(run);
  const stage = run.stage;
  if (left <= 0 || !stage || stage.kind !== 'stage') return;
  run.itemCounters = { ...run.itemCounters, [FRIEND]: left - 1 };
  const column = Math.max(2, Math.min(stage.map.columns - 2, Math.floor(stage.map.columns / 2) - 2));
  const node = stage.map.nodes.filter((n) => n.column === column).sort((a, b) => a.row - b.row)[0];
  if (!node) return;
  node.sides.push({ id: `companion-${node.id}`, kind: 'event', used: false, eventId: WANDERER_VISIT });
  if (run.itemCounters) delete run.itemCounters[`event-seen:${WANDERER_VISIT}`];
}
