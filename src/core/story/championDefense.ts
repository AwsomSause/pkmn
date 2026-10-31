// Champion defense (catalog 154): your newest Hall of Fame team comes back as an optional boss fight.
// The team is rebuilt from the run record (species and levels) and fought by the normal AI. It is a simulation of
// that team, not a replay of the inputs that won the run, and the event says so.

import type { RunRecord } from '../state';
import type { StoryState } from './schema';

const TEAM = 'champ:team';
const RETIRED = 'retired:team';

/** At the start of a run: the newest won run's (the profile lists newest first) team is remembered as a flag (species:level, comma-separated). */
export function withChampionTeam(story: StoryState, history: readonly RunRecord[]): StoryState {
  const win = history.find((r) => r.victory && r.party.length > 0);
  if (win) story.flags[TEAM] = win.party.slice(0, 6).map((m) => `${m.speciesId}:${m.level}`).join(',');
  // The newest run that did not win is a retired team: it fell short, and its Pokémon wait to try again.
  const lost = history.find((r) => !r.victory && r.party.length > 0);
  if (lost) story.flags[RETIRED] = lost.party.slice(0, 6).map((m) => `${m.speciesId}:${m.level}`).join(',');
  return story;
}

/** The remembered champion team as species and levels (empty when you have never won). */
export function championTeam(story: Pick<StoryState, 'flags'>): { speciesId: string; level: number }[] {
  return teamOf(story, TEAM);
}

/** The remembered retired team (the newest run that did not win), empty when there is none. */
export function retiredTeam(story: Pick<StoryState, 'flags'>): { speciesId: string; level: number }[] {
  return teamOf(story, RETIRED);
}

function teamOf(story: Pick<StoryState, 'flags'>, key: string): { speciesId: string; level: number }[] {
  const raw = story.flags[key];
  if (typeof raw !== 'string') return [];
  return raw.split(',').flatMap((part) => {
    const [speciesId, level] = part.split(':');
    const n = Number(level);
    return speciesId && Number.isFinite(n) ? [{ speciesId, level: n }] : [];
  });
}
