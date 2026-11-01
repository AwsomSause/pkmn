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
// The Event Archive brings one resting holiday event back each week ("<id>@archive-<week>"), so a
// missed reward can still be earned; a repeat pays the fallback (duplicate compensation).
// Limitation (no server): changing the PC's clock changes which events are on.

import { grantUnlocks } from './unlocks';
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
  if (event.seedRule === 'day') return `${event.id}@${ymd(date)}`;
  // A window that wraps the new year (Dec–Jan) belongs to the year it started in.
  const s = event.schedule;
  const year = date.getUTCFullYear();
  const wrapped = s.kind === 'yearly' && s.start > s.end && monthDay(date) <= s.end;
  return `${event.id}@${wrapped ? year - 1 : year}`;
}

const ymd = (date: Date) => `${date.getUTCFullYear()}-${monthDay(date)}`;

/** The moon's age as a share of its 29.53-day cycle at noon UTC of a date (0 = new moon, 0.5 = full). */
export function moonPhase(date: Date): number {
  const noon = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  const days = noon / DAY + 2440587.5 - 2451550.1; // since the new moon of 2000-01-06
  return (((days / 29.530588853) % 1) + 1) % 1;
}
const nearPhase = (date: Date, at: number) => {
  const d = Math.abs(moonPhase(date) - at);
  return Math.min(d, 1 - d) * 29.530588853 < 0.5;
};

/** Day rules for `daily` schedules: pure functions of the UTC date. */
export const DAILY_RULES: Record<string, (date: Date) => boolean> = {
  friday13: (d) => d.getUTCDay() === 5 && d.getUTCDate() === 13,
  newMoon: (d) => nearPhase(d, 0),
  fullMoon: (d) => nearPhase(d, 0.5),
  friday: (d) => d.getUTCDay() === 5,
  tuesday: (d) => d.getUTCDay() === 2,
  // MM/DD reads the same backwards: 01/10, 02/20, 03/30, 10/01, 11/11, 12/21.
  palindrome: (d) => {
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return String(d.getUTCDate()).padStart(2, '0') === m[1]! + m[0]!;
  },
};

export const eventIdOf = (edition: string) => edition.split('@')[0]!;

export interface ActiveGameEvent {
  event: GameEvent;
  edition: string;
  /** Milliseconds until it ends. */
  endsIn: number;
  /** Back from the Event Archive this week (outside its own dates). */
  archive?: boolean;
}

const yearlyEvents = (content: Content) => [...content.gameEvents.values()].filter((e) => e.schedule.kind === 'yearly');
const calendarEvents = (content: Content) => [...content.gameEvents.values()].filter((e) => e.schedule.kind === 'yearly' || e.schedule.kind === 'daily');
const dayStart = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** The window of a calendar event in words: "01-25 to 02-12", "every Friday", "new moon". */
export function scheduleText(event: GameEvent): string {
  const s = event.schedule;
  if (s.kind === 'yearly') return s.start === s.end ? s.start : `${s.start} to ${s.end}`;
  if (s.kind === 'daily') return { friday13: 'every Friday the 13th', newMoon: 'every new moon', fullMoon: 'every full moon', friday: 'every Friday', tuesday: 'every Tuesday', palindrome: 'palindrome dates (11/11...)' }[s.rule];
  return 'weekly';
}

/**
 * The Event Archive (plan Part 4b): every week one holiday or themed event that is outside its dates
 * comes back for the week, in turn, so a missed reward (the Spooky Set, the Hex Maniac...) is never
 * gone for good. Its edition is "<id>@archive-<ISO week>"; the permanent reward is still paid once.
 */
export function archiveEventOn(content: Content, date: Date): GameEvent | null {
  // Resting = not on for any day of this week (Monday to Sunday), so the pick holds all week.
  const monday = Date.UTC(1970, 0, 5) + weekIndex(date) * 7 * DAY;
  const days = Array.from({ length: 7 }, (_, i) => monthDay(new Date(monday + i * DAY)));
  const resting = yearlyEvents(content).filter((e) => {
    const s = e.schedule;
    return s.kind === 'yearly' && !days.some((md) => inYearlyWindow(md, s.start, s.end));
  });
  return resting.length > 0 ? resting[weekIndex(date) % resting.length]! : null;
}

/** Every game event on at this date: this week's weekly event, any holiday/themed event in its window, and the Archive's pick. */
export function activeGameEvents(content: Content, date: Date): ActiveGameEvent[] {
  const out: ActiveGameEvent[] = [];
  const weekly = weeklyEventOn(content, date);
  const nextMonday = Date.UTC(1970, 0, 5) + (weekIndex(date) + 1) * 7 * DAY;
  if (weekly) out.push({ event: weekly, edition: editionKey(weekly, date), endsIn: nextMonday - date.getTime() });
  const md = monthDay(date);
  for (const event of content.gameEvents.values()) {
    const s = event.schedule;
    if (s.kind === 'daily') {
      if (DAILY_RULES[s.rule]!(date)) out.push({ event, edition: editionKey(event, date), endsIn: dayStart(date) + DAY - date.getTime() });
      continue;
    }
    if (s.kind !== 'yearly' || !inYearlyWindow(md, s.start, s.end)) continue;
    const [m, d] = s.end.split('-').map(Number) as [number, number];
    let end = Date.UTC(date.getUTCFullYear(), m - 1, d + 1);
    if (end <= date.getTime()) end = Date.UTC(date.getUTCFullYear() + 1, m - 1, d + 1);
    out.push({ event, edition: editionKey(event, date), endsIn: end - date.getTime() });
  }
  const archived = archiveEventOn(content, date);
  if (archived) out.push({ event: archived, edition: `${archived.id}@archive-${isoWeek(date).label}`, endsIn: nextMonday - date.getTime(), archive: true });
  return out;
}

/** Milliseconds until a yearly event's next window opens (0 while it is on). */
export function nextWindowIn(event: GameEvent, date: Date): number {
  const s = event.schedule;
  if (s.kind === 'daily') {
    for (let i = 0; i <= 400; i++) {
      const day = new Date(dayStart(date) + i * DAY);
      if (DAILY_RULES[s.rule]!(day)) return i === 0 ? 0 : day.getTime() - date.getTime();
    }
    return Number.MAX_SAFE_INTEGER;
  }
  if (s.kind !== 'yearly') return 0;
  if (inYearlyWindow(monthDay(date), s.start, s.end)) return 0;
  const [m, d] = s.start.split('-').map(Number) as [number, number];
  let start = Date.UTC(date.getUTCFullYear(), m - 1, d);
  if (start <= date.getTime()) start = Date.UTC(date.getUTCFullYear() + 1, m - 1, d);
  return start - date.getTime();
}

/** The holiday calendar for the Event Hall: every holiday/themed event, soonest first. */
export function holidayCalendar(content: Content, date: Date): { event: GameEvent; startsIn: number }[] {
  return calendarEvents(content).map((event) => ({ event, startsIn: nextWindowIn(event, date) })).sort((a, b) => a.startsIn - b.startsIn);
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
  grantUnlocks(profile, { pool: reward.pool, trainer: reward.trainer, title: reward.title });
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
  if (r.trainer) parts.push(`the trainer ${content.archetypes.get(r.trainer)?.name ?? r.trainer}`);
  return parts.join(', ') || 'nothing';
}
