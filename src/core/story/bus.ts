// The Story Bus (Design v2 Part XII, "Story Bus mapped onto what exists"). Every Bus message is a DomainEvent made by `emit`
// (core/story/record.ts); `emit` hands each one to the subscribers below, in this fixed order, so a replay is identical.
// Subscribers are pure, never roll, never decide a battle, and write only to `run.story.v2` (Story Runs) or `run.story.flags`.
// Producers: playStop (storyMoment with data.storyStop), module scenes (storyChoice, arcState), the unlock_lore effect
// (loreUnlocked) and the Director's replan (directorReplan).

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import type { DomainEvent } from './schema';

export type Subscriber = (content: Content, run: RunState, event: DomainEvent) => void;

const STORY_TYPES = new Set(['storyChoice', 'arcState', 'loreUnlocked', 'directorReplan']);

/** Tallies each story message in the run's facts (`bus.<type>`), and Story Stops reached (`bus.stops`): the Journal and Chronicle read these. */
const tallies: Subscriber = (_content, run, e) => {
  const v2 = run.story.v2;
  if (!v2) return;
  const key = STORY_TYPES.has(e.type) ? `bus.${e.type}` : e.type === 'storyMoment' && e.data.storyStop ? 'bus.stops' : null;
  if (key) v2.facts[key] = Number(v2.facts[key] ?? 0) + 1;
};

/** A finished arc or a Lore entry earns a line in the module's Chronicle (once each). */
const chronicle: Subscriber = (_content, run, e) => {
  const m = run.story.v2?.module;
  if (!m) return;
  const entry = e.type === 'arcState' && e.data.state === 'done' ? `arc:${String(e.data.arc)}` : e.type === 'loreUnlocked' ? `lore:${String(e.data.lore)}` : null;
  if (entry && !m.chronicle.includes(entry)) m.chronicle.push(entry);
};

/** The subscribers, in the order they run. Add new ones at the end so older ones keep their order. */
export const SUBSCRIBERS: readonly Subscriber[] = [tallies, chronicle];

export function publish(content: Content, run: RunState, event: DomainEvent): void {
  for (const s of SUBSCRIBERS) s(content, run, event);
}
