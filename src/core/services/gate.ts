// Where service stops appear on stage maps (kept apart from the flow so run.ts can use it).

import { hashSeed, Rng } from '../rng';
import { isHostile } from '../rivals/outcome';
import type { RunState } from '../state';
import { SERVICES } from './schema';

/** One service stop on a stage map: a supported service this run has unlocked, on a node with no other stop. */
export function placeServiceStop(run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::service-stop::${run.regionIndex}:${stage.index}`));
  if (!rng.chance(SERVICES.stopChance)) return;
  const pool = SERVICES.services.filter((s) => s.status !== 'planned' && s.weight > 0 && s.minBadges <= run.badges.length && (s.requires !== 'rival' || run.story.rivals.some((r) => isHostile(r))));
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && n.sides.length === 0);
  if (pool.length === 0 || candidates.length === 0) return;
  const node = rng.pick(candidates);
  const service = rng.weighted(pool.map((s) => ({ item: s, weight: s.weight })));
  node.sides.push({ id: `service-${stage.index}`, kind: 'service', serviceId: service.id, used: false });
}
