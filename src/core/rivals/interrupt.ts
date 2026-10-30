// Unscheduled challenge (Examples section 8): a rival who is due, driven and angry enough cuts in on a stop
// (an event, a healing spot, a service) before you use it. The scheduler's rules still apply (waitingRival),
// it happens at most once per stage, never in the League or on a boss node, and the stop is still there
// afterwards. Chance is seeded per stop, so previews and reloads agree.

import type { Content } from '../contentSchema';
import { hashSeed, Rng } from '../rng';
import type { RunState, SideStop } from '../state';
import { findNode } from '../map';
import type { Rival } from '../story/schema';
import { waitingRival } from './adapt';
import { RIVAL_WORLD } from './schema';

export const interruptFlag = (run: Pick<RunState, 'regionIndex' | 'stage'>): string => `interrupt:${run.regionIndex}.${run.stage?.index ?? 0}`;

/** The rival that would cut in on this stop, or null. Pure: does not change the run. */
export function interruptingRival(_content: Content, run: RunState, side: SideStop): Rival | null {
  const cfg = RIVAL_WORLD.interrupt;
  const stage = run.stage;
  if (!stage || stage.current === null || stage.kind === 'league') return null;
  if (!cfg.sideKinds.includes(side.kind) || side.used) return null;
  if (run.story.flags[interruptFlag(run)] !== undefined) return null;
  const node = findNode(stage.map, stage.current);
  if (node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion') return null;
  if (run.party.every((m) => m.hp <= 0)) return null;
  const rival = waitingRival(run);
  if (!rival || !cfg.states.includes(rival.state)) return null;
  if (rival.traits.vindictiveness < cfg.minVindictiveness && rival.state === 'active') return null;
  const rng = new Rng(hashSeed(`${run.seed}::interrupt::${run.regionIndex}.${stage.index}::${side.id}`));
  return rng.float() < cfg.chance ? rival : null;
}
