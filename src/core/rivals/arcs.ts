// Character arcs (Living Rivalry Engine Examples §7 A–D): a rival starts with a flaw or a wish, turns
// after you have met a few times, and ends well or badly depending on its own character.

import { hashSeed, Rng } from '../rng';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { Rival, Traits } from '../story/schema';
import { RIVAL_ARCS } from './schema';

export function arcOf(rival: Rival) {
  return rival.arc ? RIVAL_ARCS.arcs.find((a) => a.id === rival.arc!.id) : undefined;
}

/** The chance the arc ends well: empathetic, resilient rivals tend to grow. */
export function goodChance(rival: Rival): number {
  const t = rival.traits;
  return Math.max(0.15, Math.min(0.85, RIVAL_ARCS.goodBase + (t.empathy + t.resilience - 100) / 200));
}

function nudge(rival: Rival, delta: Record<string, number>): void {
  for (const [k, n] of Object.entries(delta)) rival.traits[k as keyof Traits] = Math.max(0, Math.min(100, rival.traits[k as keyof Traits] + n));
}

const nameOf = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;

/**
 * Moves the rival's arc along if it has earned it. Call after a fight with it or when a stage passes
 * (`tick` adds a stage lived through). Returns what happened, for tests.
 */
export function advanceArc(content: Content, run: RunState, rival: Rival, tick = false): 'turned' | 'resolved' | null {
  const arc = rival.arc;
  const def = arcOf(rival);
  if (!arc || !def || arc.resolution) return null;
  if (tick) arc.ticks += 1;
  const A = RIVAL_ARCS;
  if (arc.stage === 1 && (rival.encounters >= A.resolveEncounters || arc.ticks >= A.resolveTicks)) {
    const rng = new Rng(hashSeed(`${run.seed}::rival-arc::${rival.id}`));
    arc.resolution = rng.float() < goodChance(rival) ? 'good' : 'bad';
    arc.stage = 2;
    nudge(rival, arc.resolution === 'good' ? A.good : A.bad);
    emit(content, run, 'rivalryFormed', {
      data: { rival: rival.id, outcome: `arc-${arc.resolution}` },
      text: arc.resolution === 'good' ? `${nameOf(content, rival)} grew: ${def.resolution.replace(/\.$/, '').toLowerCase()}` : `${nameOf(content, rival)} could not break the pattern: ${def.beginning.replace(/\.$/, '').toLowerCase()}`,
    });
    return 'resolved';
  }
  if (arc.stage === 0 && (rival.encounters >= A.turnEncounters || arc.ticks >= A.turnTicks)) {
    arc.stage = 1;
    emit(content, run, 'rivalryFormed', { data: { rival: rival.id, outcome: 'arc-turn' }, text: `${nameOf(content, rival)} is at a turning point: ${def.beginning.replace(/\.$/, '').toLowerCase()}` });
    return 'turned';
  }
  return null;
}
