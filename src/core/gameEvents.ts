// Game events (Untitled doc §17, plan Part 4b): weekly events that rotate by ISO week, and holiday
// or themed events that come back every year between two dates.
//
// The date is the PC's clock in UTC (Kice's answer 9). It is read once, by the screens, and passed
// in: everything here is a pure function of (content, date) or (content, profile, run), so the
// rules never read the clock. A run remembers the editions that were on when it started
// (run.gameEvents): their rules apply to it, and its counters count for them when it ends, even if
// the week is over by then. Rewards go through the claim ledger:
//   event:<edition>:<objective>   each objective's milestone reward, once per edition
//   event:<id>:reward             the permanent reward, the first edition you finish every objective
//   event:<edition>:fallback      the fallback reward for finishing again in a later edition
// Limitation (no server): changing the PC's clock changes which events are on.

import type { ArchetypeModifier, Content, GameEvent, GameEventObjective, QuestReward } from './contentSchema';
import { claim, isClaimed } from './quests';
import type { Profile, RunState } from './state';

const DAY = 86_400_000;

/** The ISO week of a date (UTC): its year and week number, "2026-W44". */
export function isoWeek(date: Date): { year: number; week: number; label: string } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides its year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return { year, week, label: `${year}-W${String(week).padStart(2, '0')}` };
}

/** Weeks since the Monday of 1970-01-05 (a fixed, ever-increasing week number for the rotation). */
function weekIndex(date: Date): number {
  const monday = Date.UTC(1970, 0, 5);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - monday) / (7 * DAY));
}

const monthDay = (date: Date) => `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

function inYearlyWindow(md: string, start: string, end: string): boolean {
  return start <= end ? md >= start && md <= end : md >= start || md <= end;
}

/** The weekly events in rotation order. */
export function weeklyRotation(content: Content): GameEvent[] {
  return [...content.gameEvents.values()].filter((e) => e.schedule.kind === 'weeklyRotation');
}

/** The weekly event on in a given week (one at a time). */
export function weeklyEventOn(content: Content, date: Date): GameEvent | null {
  const rotation = weeklyRotation(content);
  return rotation.length > 0 ? rotation[weekIndex(date) % rotation.length]! : null;
}

/** The edition key of an event on a date: "rivalry-week@2026-W44", "spooky-season@2026". */
export function editionKey(event: GameEvent, date: Date): string {
  if (event.seedRule === 'isoWeek') return `${event.id}@${isoWeek(date).label}`;
  // A window that wraps the new year (Dec–Jan) belongs to the year it started in.
  const s = event.schedule;
  const year = date.getUTCFullYear();
  const wrapped = s.kind === 'yearly' && s.start > s.end && monthDay(date) <= s.end;
  return `${event.id}@${wrapped ? year - 1 : year}`;
}

export const eventIdOf = (edition: string) => edition.split('@')[0]!;

export interface ActiveGameEvent {
  event: GameEvent;
  edition: string;
  /** Milliseconds until it ends. */
  endsIn: number;
}

/** Every game event on at this date: this week's weekly event and any holiday/themed event in its window. */
export function activeGameEvents(content: Content, date: Date): ActiveGameEvent[] {
  const out: ActiveGameEvent[] = [];
  const weekly = weeklyEventOn(content, date);
  if (weekly) {
    const nextMonday = Date.UTC(1970, 0, 5) + (weekIndex(date) + 1) * 7 * DAY;
    out.push({ event: weekly, edition: editionKey(weekly, date), endsIn: nextMonday - date.getTime() });
  }
  const md = monthDay(date);
  for (const event of content.gameEvents.values()) {
    const s = event.schedule;
    if (s.kind !== 'yearly' || !inYearlyWindow(md, s.start, s.end)) continue;
    const [m, d] = s.end.split('-').map(Number) as [number, number];
    let end = Date.UTC(date.getUTCFullYear(), m - 1, d + 1);
    if (end <= date.getTime()) end = Date.UTC(date.getUTCFullYear() + 1, m - 1, d + 1);
    out.push({ event, edition: editionKey(event, date), endsIn: end - date.getTime() });
  }
  return out;
}

/** The weekly events of the next few weeks (the Event Hall's "coming up"). */
export function upcomingWeekly(content: Content, date: Date, weeks: number): { event: GameEvent; startsIn: number }[] {
  const out: { event: GameEvent; startsIn: number }[] = [];
  for (let i = 1; i <= weeks; i++) {
    const at = new Date(Date.UTC(1970, 0, 5) + (weekIndex(date) + i) * 7 * DAY);
    const event = weeklyEventOn(content, at);
    if (event) out.push({ event, startsIn: at.getTime() - date.getTime() });
  }
  return out;
}

/** "3 days 4 h", "5 h", "12 min". */
export function durationText(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours > 0 ? ` ${hours} h` : ''}`;
  if (hours > 0) return `${hours} h`;
  return `${min} min`;
}

// ---------- runs ----------

/** The rules a run started during these editions plays by: every event's modifiers. */
export function gameEventModifiers(content: Content, editions: readonly string[]): ArchetypeModifier[] {
  return editions.flatMap((ed) => content.gameEvents.get(eventIdOf(ed))?.modifiers ?? []);
}

/** The map events these editions feature (more likely) or own (only then). */
export function featuredMapEvents(content: Content, run: Pick<RunState, 'gameEvents'>): Set<string> {
  return new Set((run.gameEvents ?? []).flatMap((ed) => content.gameEvents.get(eventIdOf(ed))?.mapEvents ?? []));
}

export const runGameEventIds = (run: Pick<RunState, 'gameEvents'>) => (run.gameEvents ?? []).map(eventIdOf);

// ---------- progress and rewards ----------

export interface ObjectiveView {
  objective: GameEventObjective;
  current: number;
  done: boolean;
  claimed: boolean;
}

export function objectiveViews(profile: Profile, event: GameEvent, edition: string): ObjectiveView[] {
  const counters = profile.gameEvents?.[edition] ?? {};
  return event.objectives.map((objective) => {
    const current = counters[objective.counter] ?? 0;
    return { objective, current: Math.min(current, objective.atLeast), done: current >= objective.atLeast, claimed: isClaimed(profile, `event:${edition}:${objective.id}`) };
  });
}

/** Whether the event's permanent reward has been earned (in any edition). */
export const rewardEarned = (profile: Profile, eventId: string) => isClaimed(profile, `event:${eventId}:reward`);

function pay(profile: Profile, reward: QuestReward): void {
  profile.bankCredits += reward.bankCredits;
  profile.lifetimeBankCredits += reward.bankCredits;
  profile.researchPoints += reward.researchPoints;
  profile.candies += reward.candies;
  if (reward.title && !profile.titles.includes(reward.title)) profile.titles.push(reward.title);
  if (reward.pool && !profile.unlockedPools.includes(reward.pool)) profile.unlockedPools.push(reward.pool);
}

export interface GameEventPayout {
  event: GameEvent;
  edition: string;
  /** Objectives finished by this run. */
  objectives: GameEventObjective[];
  /** The permanent reward (first time) or the fallback (later editions), when this run finished the last objective. */
  final: { reward: QuestReward; fallback: boolean } | null;
}

/**
 * Adds a finished run's counters to each edition it belongs to and pays whatever is newly done
 * (mutates `profile`). Every payment is a claim, so finalizing twice never pays twice.
 */
export function awardGameEvents(content: Content, profile: Profile, run: RunState, runCounters: Record<string, number>, now: string): GameEventPayout[] {
  profile.gameEvents ??= {};
  const out: GameEventPayout[] = [];
  for (const edition of run.gameEvents ?? []) {
    const event = content.gameEvents.get(eventIdOf(edition));
    if (!event) continue;
    if (profile.stats.runsEnded < event.eligibility.minRunsFinished) continue;
    const totals = { ...profile.gameEvents[edition] };
    for (const counter of new Set(event.objectives.map((o) => o.counter))) totals[counter] = (totals[counter] ?? 0) + (runCounters[counter] ?? 0);
    profile.gameEvents[edition] = totals;
    const payout: GameEventPayout = { event, edition, objectives: [], final: null };
    const views = objectiveViews(profile, event, edition);
    for (const v of views) {
      if (!v.done || !claim(profile, `event:${edition}:${v.objective.id}`, now)) continue;
      pay(profile, v.objective.reward);
      payout.objectives.push(v.objective);
    }
    if (views.every((v) => v.done)) {
      const once = event.repeatPolicy === 'oncePerEvent' ? `event:${event.id}:reward` : `event:${edition}:reward`;
      if (claim(profile, once, now)) {
        pay(profile, event.reward);
        payout.final = { reward: event.reward, fallback: false };
      } else if (claim(profile, `event:${edition}:fallback`, now)) {
        pay(profile, event.fallbackReward);
        payout.final = { reward: event.fallbackReward, fallback: true };
      }
    }
    if (payout.objectives.length > 0 || payout.final) out.push(payout);
  }
  return out;
}

/** A reward in words, for screens. */
export function gameRewardText(content: Content, r: QuestReward): string {
  const parts: string[] = [];
  if (r.researchPoints) parts.push(`${r.researchPoints} Research Points`);
  if (r.bankCredits) parts.push(`${r.bankCredits} Bank Credits`);
  if (r.candies) parts.push(`${r.candies} candies`);
  if (r.title) parts.push(`title "${r.title}"`);
  if (r.pool) parts.push(`the ${content.starterPools.get(r.pool)?.name ?? r.pool} starter set`);
  return parts.join(', ') || 'nothing';
}
