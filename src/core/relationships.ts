// Relationship counters for achievements (GAME_DESIGN §14.4): worked out from a finished run's final
// state, so no battle or event code has to count them as they happen. Nothing here rolls a random number.

import type { Content } from './contentSchema';
import { friendshipReady } from './friendship';
import { getSpecies } from './pokemon';
import type { RunState } from './state';

/** Party members whose friendship reached friendship-evolution level, mentorships begun and finished. */
export function relationshipCounters(content: Content, run: Pick<RunState, 'party' | 'story' | 'victory' | 'log' | 'rules'>): Record<string, number> {
  const mentorships = run.story.relationships.filter((r) => r.kind === 'mentorship').length;
  const graduated = Object.values(run.story.histories).filter((h) => h.titles.includes('Former Protégé')).length;
  return {
    bestFriends: run.party.filter((m) => friendshipReady(content, m)).length,
    mentorshipsStarted: mentorships,
    mentorshipsGraduated: graduated,
    ...wonRunCounters(content, run),
  };
}

/** Hidden-achievement counters: each is 1 only on a won run, so a lost run never earns them. */
function wonRunCounters(content: Content, run: Pick<RunState, 'party' | 'victory' | 'log' | 'rules'>): Record<string, number> {
  if (!run.victory) return {};
  const c = run.log.counters;
  const types = new Set(run.party.map((m) => getSpecies(content, m.speciesId).types[0]));
  return {
    frugalWins: (c.moneySpent ?? 0) <= content.balance.frugalRunMaxSpent ? 1 : 0,
    noHealWins: (c.healStopsUsed ?? 0) === 0 ? 1 : 0,
    rainbowWins: run.party.length >= 6 && types.size >= 6 ? 1 : 0,
    comebackWins: run.rules.wipes >= 1 ? 1 : 0,
  };
}
