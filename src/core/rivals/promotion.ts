// The Rival Who Wins Without You (left-out plan 5.5, Living Rivalry Engine §8 "Rival promotions" and §15).
// A contender that keeps winning off-screen climbs past "contender": it takes over a Gym, reaches the
// regional finals (an Elite Four seat), and finally becomes Champion. Each rank shows up once, at the
// next boss of that kind in a later stage: the boss fight keeps its badge and rewards, but the rival
// stands in its place with its own team, at that boss's levels. Promotions roll on a seed of their own,
// so no other roll changes.

import type { Content } from '../contentSchema';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import type { Rival } from '../story/schema';
import { RIVAL_CONFIG } from './schema';

export const RIVAL_RANKS = ['gymLeader', 'finalist', 'champion'] as const;
export type RivalRank = (typeof RIVAL_RANKS)[number];
const NODE_FOR: Record<RivalRank, 'gym' | 'elite' | 'champion'> = { gymLeader: 'gym', finalist: 'elite', champion: 'champion' };
const RANK_NAME: Record<RivalRank, string> = { gymLeader: 'took over a Gym', finalist: 'reached the regional finals', champion: 'became Champion' };

export const takeoverFlag = (rival: Pick<Rival, 'id' | 'rank'>) => `takeover:${rival.id}:${rival.rank}`;

/**
 * After an unseen win (rivals/world.ts): an active rival, nemesis or contender (or a rival already ranked) may climb one rank when
 * its progress allows. Returns the rumour, or null. Only one rival may become Champion per run.
 */
export function promoteRival(content: Content, run: RunState, rival: Rival, stageKey: string): string | null {
  const cfg = RIVAL_CONFIG.promotion;
  const at = rival.rank ? RIVAL_RANKS.indexOf(rival.rank) + 1 : 0;
  const next = RIVAL_RANKS[at];
  if (!next || (!cfg.states.includes(rival.state) && !rival.rank) || rival.progress < cfg.progress[at]!) return null;
  // A ranked rival waits until it has shown up in its new role before it climbs again.
  if (rival.rank && run.story.flags[takeoverFlag(rival)] !== 'done') return null;
  if (next === 'champion' && run.story.rivals.some((r) => r.rank === 'champion')) return null;
  if (!new Rng(hashSeed(`${run.seed}::rival-promotion::${stageKey}::${rival.id}`)).chance(cfg.chance)) return null;
  rival.rank = next;
  run.story.flags[takeoverFlag(rival)] = stageKey;
  return `${content.trainers.get(rival.classId)?.name ?? 'Trainer'} ${rival.name} ${RANK_NAME[next]} while you were away!`;
}

/** The ranked rival waiting to stand in for this kind of boss (promoted in an earlier stage), if any. */
export function takeoverRival(run: RunState, nodeKind: string): Rival | null {
  const stageKey = `${run.regionIndex}.${run.stage?.index ?? 0}`;
  return (
    run.story.rivals.find((r) => {
      if (!r.rank || NODE_FOR[r.rank] !== nodeKind || r.state === 'retired' || r.state === 'ally') return false;
      const when = run.story.flags[takeoverFlag(r)];
      return typeof when === 'string' && when !== 'done' && when !== stageKey;
    }) ?? null
  );
}

export function markTakeover(run: RunState, rival: Rival): void {
  run.story.flags[takeoverFlag(rival)] = 'done';
}

export function takeoverNote(content: Content, rival: Rival): string {
  const who = `${content.trainers.get(rival.classId)?.name ?? 'Trainer'} ${rival.name}`;
  return rival.rank === 'champion' ? `${who} became Champion while you were away, and defends the title!` : rival.rank === 'finalist' ? `${who} fought through to the regional finals and holds this seat now!` : `${who} won this Gym while you were away, and leads it now!`;
}
