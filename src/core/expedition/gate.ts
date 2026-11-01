// Where expedition gates appear on stage maps (kept apart from the flow so run.ts can use it).

import { focusDenBonus } from '../campaign/director';
import { hashSeed, Rng } from '../rng';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';

/** An expedition gate on the stage map (an unlocked or region-tier expedition that is not finished yet). */
export function placeExpeditionGate(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::expedition-gate::${run.regionIndex}:${stage.index}`));
  if (!rng.chance(content.expeditions.denChance + focusDenBonus(run, 'exploration'))) return;
  const tiers = content.expeditions.tierByRegion;
  const tier = tiers[Math.min(run.regionIndex, tiers.length - 1)]!;
  const pool = content.expeditions.expeditions.filter((e) => !e.legendary && !run.expeditions.completed.includes(e.id) && (e.tier === tier || run.expeditions.unlocked.includes(e.id)));
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && n.sides.length === 0);
  if (pool.length === 0 || candidates.length === 0) return;
  const node = rng.pick(candidates);
  node.sides.push({ id: `expedition-${stage.index}`, kind: 'expedition', expeditionId: rng.pick(pool).id, used: false });
}

