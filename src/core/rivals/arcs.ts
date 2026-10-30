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

type Arc = (typeof RIVAL_ARCS.arcs)[number];
const inRange = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;

/** Does this arc's trigger fit the rival's Pokémon bonds and character right now? */
export function triggerFits(rival: Rival, arc: Arc): boolean {
  const t = arc.trigger;
  if (!t) return false;
  const bonds = Object.values(rival.bonds);
  if (bonds.length === 0) return false;
  if (t.minProgress !== undefined && rival.progress < t.minProgress) return false;
  if (t.minSetbacks !== undefined && rival.setbacks < t.minSetbacks) return false;
  for (const [k, range] of Object.entries(t.rival ?? {})) if (!inRange(rival.traits[k as keyof Traits], range)) return false;
  if (t.gap) {
    const values = bonds.map((b) => (b as unknown as Record<string, number>)[t.gap!.dim]!);
    if (Math.max(...values) - Math.min(...values) < t.gap.min) return false;
  }
  if (!t.bond) return true;
  return bonds.some((b) => (!t.traits || t.traits.includes(b.trait)) && Object.entries(t.bond!).every(([k, range]) => inRange((b as unknown as Record<string, number>)[k]!, range)));
}

/** The first bond or Overdrive arc whose trigger fits and that this rival has not lived yet. */
export function triggeredArc(rival: Rival): Arc | undefined {
  const done = new Set([...(rival.arcsDone ?? []), ...(rival.arc ? [rival.arc.id] : [])]);
  return RIVAL_ARCS.arcs.find((a) => a.trigger && !done.has(a.id) && triggerFits(rival, a));
}

/** When a rival has no arc (or has finished one) and its bonds fit a bond or Overdrive arc, that arc begins. */
export function startTriggeredArc(content: Content, run: RunState, rival: Rival): Arc | null {
  if (rival.arc && !rival.arc.resolution) return null;
  const arc = triggeredArc(rival);
  if (!arc) return null;
  if (rival.arc) rival.arcsDone = [...(rival.arcsDone ?? []), rival.arc.id];
  rival.arc = { id: arc.id, stage: 0, ticks: 0, resolution: null };
  emit(content, run, 'rivalryFormed', { data: { rival: rival.id, outcome: 'arc-start' }, text: `${nameOf(content, rival)} ${arc.beginning.replace(/\.$/, '').replace(/^[A-Z]/, (c) => c.toLowerCase())}` });
  return arc;
}
