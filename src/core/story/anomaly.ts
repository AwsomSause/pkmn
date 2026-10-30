// Field anomalies (catalog 72): some stages carry a lasting battlefield condition (gravity, Trick Room, weather or
// terrain). Every one is a real battle mechanic the engine already runs, is described on the map before you choose
// a node, and comes with a plain counterplay hint. Chosen from the run seed and the stage, never from a gameplay stream.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { fnv1a } from './moments';
import type { FieldAnomaly } from './schema';

/** The anomaly of the run's current stage (null: this stage is ordinary). The first stage of a region is never one. */
export function stageAnomaly(content: Content, run: Pick<RunState, 'seed' | 'regionIndex' | 'stage'>): FieldAnomaly | null {
  const cfg = content.story.anomalies;
  const index = run.stage?.index ?? 0;
  if (run.regionIndex < cfg.minRegion || index < 1) return null;
  const h = fnv1a(`${run.seed}:anomaly:${run.regionIndex}.${index}`);
  if (h % 1000 >= cfg.chance * 1000) return null;
  return cfg.list[Math.floor(h / 1000) % cfg.list.length] ?? null;
}

/** The hover line for the map: what the anomaly is and how to counter it. */
export function anomalyLine(a: FieldAnomaly): string {
  return `\u26a0 ${a.name}: ${a.description} Counterplay: ${a.counterplay}`;
}

/** At the start of a battle (mutates `run.battle`): the stage's anomaly sets its field. Raids and Totems keep their own environments. */
export function applyAnomaly(content: Content, run: RunState): void {
  const battle = run.battle;
  if (!battle || battle.raid || battle.totem) return;
  const a = stageAnomaly(content, run);
  if (!a) return;
  if (a.field.gravity) battle.field.gravity = Math.max(battle.field.gravity, a.field.gravity);
  if (a.field.trickRoom) battle.field.trickRoom = Math.max(battle.field.trickRoom, a.field.trickRoom);
  if (a.field.weather && !battle.weather) battle.weather = { id: a.field.weather, turns: 5 };
  if (a.field.terrain && !battle.terrain) battle.terrain = { id: a.field.terrain, turns: 5 };
}
