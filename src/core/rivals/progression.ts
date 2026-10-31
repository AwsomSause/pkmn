// Rival world progression (M11, Expanded Systems §5.4-5.5): the one source of truth for where each rival
// stands in the world. Every change is a `rivalProgress` domain event (emitted through story/record.ts);
// `applyRivalProgress` is the only writer of `rival.world`. Readers (NPC lines, posters, sightings,
// narrative defeats, the False Protagonist) use `rivalStatus` / `rivalWorldView` and never write.
// No RNG here: the off-screen sim (rivals/world.ts) rolls on its own seeded streams.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { DomainEvent, Rival, RivalWorldRecord } from '../story/schema';
import { RIVAL_CONFIG } from './schema';

/**
 * What a rival can do in the world. Other systems emit these; nothing else changes `rival.world`.
 * - unseenWin / unseenLoss / sitOut: the off-screen stage result.
 * - badge: it beat this stage's Gym Leader off-screen. rank: it took a Gym, the finals or the Championship.
 * - beatPlayer / lostToPlayer: a battle with you. narrativeWin: a scripted story loss for you (M12).
 * - beatRival / lostToRival: a battle with another rival (data.other).
 * - setPace: put it at an exact place (data.lead, data.badges); for a replayed timeline (M13).
 */
export const RIVAL_PROGRESS_KINDS = ['unseenWin', 'unseenLoss', 'sitOut', 'badge', 'rank', 'beatPlayer', 'lostToPlayer', 'narrativeWin', 'beatRival', 'lostToRival', 'setPace'] as const;
export type RivalProgressKind = (typeof RIVAL_PROGRESS_KINDS)[number];

/** World status (spec §5.4), most specific first. */
export const RIVAL_STATUSES = ['traveling', 'ahead', 'equal', 'behind', 'gymChallenger', 'gymVictor', 'championCandidate', 'champion', 'missing', 'defeated'] as const;
export type RivalStatus = (typeof RIVAL_STATUSES)[number];

export const RIVAL_STATUS_NAMES: Record<RivalStatus, string> = {
  traveling: 'Traveling', ahead: 'Ahead', equal: 'Equal', behind: 'Behind', gymChallenger: 'Gym Challenger', gymVictor: 'Gym Victor',
  championCandidate: 'Champion Candidate', champion: 'Champion', missing: 'Missing', defeated: 'Defeated',
};

const cfg = () => RIVAL_CONFIG.progression;
export const stageKeyOf = (run: Pick<RunState, 'regionIndex' | 'stage'>) => `${run.regionIndex}.${run.stage?.index ?? 0}`;

function freshRecord(region: number): RivalWorldRecord {
  return { lead: 0, badges: 0, region, regionsDone: 0, wins: 0, defeats: 0, fame: 0, milestones: [] };
}

/** Records a rival's progress as a domain event and applies it. Returns the event. Mutates `run`. */
export function rivalProgress(content: Content, run: RunState, rival: Rival, kind: RivalProgressKind, extra: Record<string, string | number | boolean | null> = {}): DomainEvent {
  return emit(content, run, 'rivalProgress', { data: { ...extra, rival: rival.id, kind } });
}

/** Applies one rivalProgress event to its rival's record (called by `emit`). Ignores other events and unknown rivals. */
export function applyRivalProgress(run: RunState, e: DomainEvent): void {
  if (e.type !== 'rivalProgress') return;
  const rival = run.story.rivals.find((r) => r.id === e.data.rival);
  const kind = e.data.kind as RivalProgressKind;
  if (!rival || !RIVAL_PROGRESS_KINDS.includes(kind)) return;
  const c = cfg();
  const w = (rival.world ??= freshRecord(e.where.region));
  if (e.where.region !== w.region) {
    // It moved on with you: a finished set of badges counts as a region done.
    if (w.badges >= c.candidateBadges) w.regionsDone += 1;
    w.region = e.where.region;
    w.badges = 0;
  }
  if (kind === 'setPace') {
    if (typeof e.data.lead === 'number') w.lead = e.data.lead;
    if (typeof e.data.badges === 'number') w.badges = Math.max(0, e.data.badges);
  } else if (kind === 'beatPlayer' || kind === 'narrativeWin') w.lead = Math.max(w.lead, 1);
  else if (kind === 'lostToPlayer') w.lead = Math.min(w.lead, -1);
  else w.lead += c.lead[kind] ?? 0;
  w.lead = Math.max(c.leadMin, Math.min(c.leadMax, w.lead));
  if (kind === 'badge') w.badges += 1;
  if (kind === 'unseenWin' || kind === 'beatPlayer' || kind === 'narrativeWin' || kind === 'beatRival') w.wins += 1;
  if (kind === 'unseenLoss' || kind === 'lostToPlayer' || kind === 'lostToRival') w.defeats += 1;
  w.fame = Math.max(0, w.fame + (c.fame[kind] ?? 0));
  w.milestones.push({ kind, at: `${e.where.region}.${e.where.stage ?? 0}`, seq: e.seq });
  if (w.milestones.length > c.milestonesKept) w.milestones.splice(0, w.milestones.length - c.milestonesKept);
}

/** The rival's world status right now (pure). */
export function rivalStatus(run: Pick<RunState, 'regionIndex' | 'stage'>, rival: Rival): RivalStatus {
  if (rival.state === 'retired' || rival.cooldown > 0) return 'missing';
  if (rival.rank === 'champion') return 'champion';
  const w = rival.world;
  if (rival.rank === 'finalist' || (w && w.region === run.regionIndex && w.badges >= cfg().candidateBadges)) return 'championCandidate';
  if (!w || w.milestones.length === 0) return 'traveling';
  const here = stageKeyOf(run);
  const recent = w.milestones.filter((m) => m.at === here).map((m) => m.kind);
  if (recent.at(-1) === 'lostToPlayer') return 'defeated';
  if (recent.includes('badge')) return 'gymVictor';
  if (recent.includes('unseenLoss')) return 'gymChallenger';
  return w.lead > 0 ? 'ahead' : w.lead < 0 ? 'behind' : 'equal';
}

export interface RivalWorldView {
  id: string;
  /** "Youngster Joey". */
  title: string;
  status: RivalStatus;
  lead: number;
  badges: number;
  fame: number;
  wins: number;
  defeats: number;
  rank: Rival['rank'] | null;
  /** The newest milestone kind, if any. */
  last: string | null;
}

/** Every rival's place in the world, best known first (fame, then lead). Pure. */
export function rivalWorldView(content: Content, run: RunState): RivalWorldView[] {
  return run.story.rivals
    .map((r) => {
      const w = r.world ?? freshRecord(run.regionIndex);
      return {
        id: r.id,
        title: `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`,
        status: rivalStatus(run, r),
        lead: w.lead,
        badges: w.badges,
        fame: w.fame,
        wins: w.wins,
        defeats: w.defeats,
        rank: r.rank ?? null,
        last: w.milestones.at(-1)?.kind ?? null,
      };
    })
    .sort((a, b) => b.fame - a.fame || b.lead - a.lead || a.id.localeCompare(b.id));
}

/** The rival furthest ahead of you (ties: most famous), or null when none is ahead. */
export function leadingRival(content: Content, run: RunState): RivalWorldView | null {
  const ahead = rivalWorldView(content, run).filter((v) => v.lead > 0 && v.status !== 'missing');
  return ahead.sort((a, b) => b.lead - a.lead || b.fame - a.fame)[0] ?? null;
}

/** One line for the Story screen: "Ahead · 3 badges · fame 12". */
export function rivalStatusLine(view: RivalWorldView): string {
  return [RIVAL_STATUS_NAMES[view.status], `${view.badges} badge${view.badges === 1 ? '' : 's'}`, `fame ${view.fame}`].join(' · ');
}
