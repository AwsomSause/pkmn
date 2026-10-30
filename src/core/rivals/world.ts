// The rivals' world moves while you play (Living Rivalry Engine §8, Examples §8): each new stage every
// rival may win or lose off-screen, chase a private goal, or sit out; rivals form feelings about each
// other; the player hears rumours, some of them wrong. Seeded per stage and rival, so it replays
// identically and never touches the gameplay streams.

import { hashSeed, Rng } from '../rng';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { Rival } from '../story/schema';
import { advanceArc } from './arcs';
import { simulateOffscreen } from './bonds';
import { isHostile, stateFor } from './outcome';
import { RIVAL_CONFIG } from './schema';

type Edge = RunState['story']['rivalGraph'][number];

const title = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;

/** How two rivals feel about each other, from their characters. */
export function edgeKind(a: Rival, b: Rival): Edge['kind'] {
  const w = RIVAL_CONFIG.world;
  if (a.traits.empathy >= w.friendMinEmpathy && b.traits.empathy >= w.friendMinEmpathy) return 'friends';
  if (a.traits.ambition >= w.rivalMinAmbition && b.traits.ambition >= w.rivalMinAmbition) return 'enemies';
  return 'partners';
}

/** One stage of the world. Safe to call once per stage (it remembers); mutates `run`. */
export function simulateRivalWorld(content: Content, run: RunState): void {
  const story = run.story;
  const stage = run.stage?.index ?? 0;
  const key = `rivalWorld:${run.regionIndex}.${stage}`;
  if (story.rivals.length === 0 || story.flags[key] !== undefined) return;
  story.flags[key] = true;
  const w = RIVAL_CONFIG.world;
  let rumor: string | null = null;
  for (const r of story.rivals) {
    const rng = new Rng(hashSeed(`${run.seed}::rival-world::${run.regionIndex}.${stage}::${r.id}`));
    r.away += 1;
    advanceArc(content, run, r, true);
    if (r.cooldown > 0) r.cooldown -= 1;
    if (r.state !== 'retired') {
      // Background simulation: one bond event per stage, with its cause on record.
      const ev = simulateOffscreen(content, run, r, `${run.regionIndex}.${stage}`);
      if (ev?.visibility === 'rumor') rumor ??= `${title(content, r)}: ${ev.text}`;
    }
    if (!isHostile(r)) continue;
    const who = title(content, r);
    if (rng.float() < w.privateGoalChance && r.traits.ambition >= w.privateGoalMinAmbition) {
      // A private goal that comes before any battle invitation.
      r.cooldown = Math.max(r.cooldown, 1);
      rumor ??= `${who} is chasing a goal that has nothing to do with you`;
      continue;
    }
    const winChance = w.unseenWinBase + (r.traits.ambition - 50) / 200 + (r.traits.resilience - 50) / 400;
    if (rng.float() < winChance) {
      // Unseen victory: more ambition and a level's worth of progress.
      r.progress = Math.min(w.progressCap, r.progress + 1);
      r.rivalPotential += w.unseenWinPotential;
      r.state = stateFor(r);
      rumor ??= `${who} won a big battle while you were away`;
    } else if (r.traits.resilience < w.fragileResilience) {
      // Unseen defeat that shakes it: it sits out a stage to recover.
      r.cooldown = Math.max(r.cooldown, 1);
      rumor ??= `${who} lost to a stranger and is taking time to recover`;
    } else {
      r.progress = Math.min(w.progressCap, r.progress + (r.traits.resilience >= w.toughResilience ? 1 : 0));
      rumor ??= `${who} lost to a stranger and is retraining`;
    }
  }
  // Independent rivalries: rivals form feelings about each other without you.
  const graph = story.rivalGraph;
  for (let i = 0; i < story.rivals.length; i++) {
    for (let j = i + 1; j < story.rivals.length; j++) {
      const a = story.rivals[i]!;
      const b = story.rivals[j]!;
      if (graph.some((e) => (e.a === a.id && e.b === b.id) || (e.a === b.id && e.b === a.id))) continue;
      const rng = new Rng(hashSeed(`${run.seed}::rival-edge::${a.id}::${b.id}::${run.regionIndex}.${stage}`));
      if (rng.float() >= w.edgeChance) continue;
      const kind = edgeKind(a, b);
      graph.push({ a: a.id, b: b.id, kind });
      rumor ??= `${title(content, a)} and ${title(content, b)} have become ${kind === 'friends' ? 'friends' : kind === 'enemies' ? 'bitter enemies' : 'training partners'}`;
    }
  }
  if (rumor) {
    // Some rumours are only partly true; the player cannot tell which.
    const rng = new Rng(hashSeed(`${run.seed}::rival-rumor::${run.regionIndex}.${stage}`));
    const accurate = rng.float() >= w.distortedRumorChance;
    emit(content, run, 'rivalryFormed', { data: { outcome: 'rumor', accurate }, text: accurate ? `Word is that ${rumor}` : `You heard a rumour that ${rumor}, though the story seems incomplete` });
  }
}
