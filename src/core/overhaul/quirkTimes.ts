// Quirks at camp: a Pokémon's quirk (by its category) reacts to the hour and to festival days (a new season, a milestone
// day, a real-world date the camp celebrates). Text only, save-free, and it uses a hash of the camp key, never a gameplay RNG.

import quirkTimes from '../../data/quirkTimes.json';
import { milestoneToday, periodOf, seasonStartToday, specialDateToday } from '../clock';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { quirkOfMon } from './personality';

type Named = Pick<RunState['party'][number], 'uid' | 'nature' | 'speciesId'>;
export type CampMoment = 'morning' | 'evening' | 'night' | 'festival';

const fnv = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** What the camp is right now: a festival day, the hour (morning, evening, night), or null in the afternoon. */
export function campMoment(content: Content, run: RunState): CampMoment | null {
  if (seasonStartToday(content, run) || milestoneToday(content, run) || specialDateToday(content, run)) return 'festival';
  const p = periodOf(run);
  return p === 'afternoon' ? null : p;
}

/** The quirk line for this moment from one Pokémon of the party (picked by a hash), or null. Fires on half of the camps so other lines still show. */
export function campQuirkLine(party: readonly Named[], moment: CampMoment | null, key: string, nameOf: (m: Named) => string): string | null {
  if (!moment || !party.length || fnv(`${key}:campq`) % 2 !== 0) return null;
  const table = quirkTimes.lines as Record<string, Partial<Record<CampMoment, string>>>;
  const hits = party.flatMap((mon) => {
    const line = table[quirkOfMon(mon).category]?.[moment];
    return line ? [{ mon, line }] : [];
  });
  if (!hits.length) return null;
  const pick = hits[fnv(`${key}:${moment}:pick`) % hits.length]!;
  return pick.line.replaceAll('{Name}', nameOf(pick.mon));
}
