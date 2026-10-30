// Where minigame stops appear on stage maps (kept apart from the flow so run.ts can use it).

import { hashSeed, Rng } from '../rng';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';

/** A minigame stop on the stage map: a game this run has unlocked (badges and region), on a node with no other stop. */
export function placeMinigameStop(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::minigame-stop::${run.regionIndex}:${stage.index}`));
  if (!rng.chance(content.minigames.economy.stopChance)) return;
  const pool = content.minigames.games.filter((g) => g.unlockRequirements.badges <= run.badges.length && g.unlockRequirements.regionIndex <= run.regionIndex);
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && n.sides.length === 0);
  if (pool.length === 0 || candidates.length === 0) return;
  const node = rng.pick(candidates);
  node.sides.push({ id: `minigame-${stage.index}`, kind: 'minigame', minigameId: rng.pick(pool).id, used: false });
}
