// The run clock (spec §28): a persistent day counter and four times of day.
//
// Time passes only when the player acts (a step on the map, a night's rest), never with the real
// clock, so closing, pausing or reloading a run cannot change it. No randomness: previews and
// scenery read the clock but never change it.

import type { Content } from './contentSchema';
import type { RunState } from './state';

export const PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type Period = (typeof PERIODS)[number];

export interface RunClock {
  day: number;
  /** 0 morning, 1 afternoon, 2 evening, 3 night. */
  tick: number;
  /** Milestone days already celebrated at camp. */
  celebrated: number[];
}

export const freshClock = (): RunClock => ({ day: 1, tick: 0, celebrated: [] });

export const periodOf = (run: Pick<RunState, 'clock'>): Period => PERIODS[run.clock.tick] ?? 'morning';

export const PERIOD_LABEL: Record<Period, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };

/** "Day 3 · Evening". */
export const clockLabel = (run: Pick<RunState, 'clock'>): string => `Day ${run.clock.day} · ${PERIOD_LABEL[periodOf(run)]}`;

/** Time passes by this many parts of the day (mutates `run`). */
export function advanceClock(run: RunState, ticks: number): void {
  const total = run.clock.tick + Math.max(0, Math.floor(ticks));
  run.clock.day += Math.floor(total / PERIODS.length);
  run.clock.tick = total % PERIODS.length;
}

/** Wild weight for a species at this hour: its types that suit the time turn up more often (1 when none do). */
export function periodWildWeight(content: Content, run: Pick<RunState, 'clock'>, speciesId: string): number {
  const types = content.species.get(speciesId)?.types ?? [];
  const liked = content.balance.clock.periodTypes[periodOf(run)];
  return types.some((t) => liked.includes(t)) ? content.balance.clock.periodWildFactor : 1;
}

/** Merchants keep hours: cheaper early in the day, dearer after dark. */
export const shopHoursMultiplier = (content: Content, run: Pick<RunState, 'clock'>): number => content.balance.clock.shopHours[periodOf(run)];

/** One step on the map (mutates `run`). */
export function stepClock(content: Content, run: RunState): void {
  advanceClock(run, content.balance.clock.ticksPerStep);
}

/** Sleep until the next morning: a new day begins (mutates `run`). Resting in the morning also takes a day. */
export function restUntilMorning(run: RunState): void {
  run.clock.day += 1;
  run.clock.tick = 0;
}

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

/** The run's calendar: a season is `seasonLength` days. */
export const seasonOf = (content: Content, run: Pick<RunState, 'clock'>): (typeof SEASONS)[number] =>
  SEASONS[Math.floor((run.clock.day - 1) / content.balance.clock.seasonLength) % SEASONS.length]!;

/** The first day of a new season (a recurring seasonal festival; never day 1). */
export const seasonStartToday = (content: Content, run: Pick<RunState, 'clock'>): boolean =>
  run.clock.day > 1 && (run.clock.day - 1) % content.balance.clock.seasonLength === 0;

/** Today is a milestone day (7th day, 14th, 30th... or a new season) that has not been celebrated yet. */
export function milestoneToday(content: Content, run: RunState): boolean {
  const special = content.balance.clock.milestoneDays.includes(run.clock.day) || seasonStartToday(content, run);
  return special && !run.clock.celebrated.includes(run.clock.day);
}

export function celebrateToday(run: RunState): void {
  if (!run.clock.celebrated.includes(run.clock.day)) run.clock.celebrated.push(run.clock.day);
}

/** Scenery for a time of day: a tint laid over the backdrop and how strongly. Presentation only. */
export const PERIOD_LOOK: Record<Period, { tint: number; alpha: number; ambient: string }> = {
  morning: { tint: 0xffe0a8, alpha: 0.1, ambient: 'Birdsong and mist' },
  afternoon: { tint: 0xffffff, alpha: 0, ambient: 'Warm wind' },
  evening: { tint: 0xff8a50, alpha: 0.18, ambient: 'Crickets begin' },
  night: { tint: 0x0a1030, alpha: 0.45, ambient: 'Owls and a crackling fire' },
};
