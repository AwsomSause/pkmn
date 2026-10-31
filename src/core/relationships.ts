// Relationship counters for achievements (GAME_DESIGN §14.4): worked out from a finished run's final
// state, so no battle or event code has to count them as they happen. Nothing here rolls a random number.

import type { Content } from './contentSchema';
import { friendshipReady } from './friendship';
import type { RunState } from './state';

/** Party members whose friendship reached friendship-evolution level, mentorships begun and finished. */
export function relationshipCounters(content: Content, run: Pick<RunState, 'party' | 'story'>): Record<string, number> {
  const mentorships = run.story.relationships.filter((r) => r.kind === 'mentorship').length;
  const graduated = Object.values(run.story.histories).filter((h) => h.titles.includes('Former Protégé')).length;
  return {
    bestFriends: run.party.filter((m) => friendshipReady(content, m)).length,
    mentorshipsStarted: mentorships,
    mentorshipsGraduated: graduated,
  };
}
