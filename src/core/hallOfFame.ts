// The Hall of Fame (Electric plan §5): champion teams, unusual wins, rare
// forms and records, read from the profile's Run History. Each run keeps its
// epitaph and Legacy Cards (core/story/legacy.ts). Runs holding a Legacy Record
// are never trimmed from the history, so those entries are permanent. Read-only.

import type { Profile, RunRecord } from './state';

export interface HallOfFame {
  records: { label: string; value: string }[];
  /** Won runs, newest first. */
  champions: RunRecord[];
  /** Won runs that stand out, with why. */
  unusual: { run: RunRecord; why: string }[];
  /** Shiny Pokémon that finished a run. */
  rareForms: { speciesId: string; level: number; run: RunRecord }[];
  /** Pokémon whose Legacy Card earned a title or tag, newest run first. */
  legends: { run: RunRecord; card: RunRecord['legacy'][number] }[];
  /** Permanent Legacy Records (Hall of Fame chains such as The Long Gauntlet), newest run first. */
  legacyRecords: { run: RunRecord; card: RunRecord['legacy'][number]; record: string }[];
}

/** How small a winning team counts as unusual. */
export const SMALL_TEAM = 3;

export function hallOfFame(profile: Profile): HallOfFame {
  const runs = profile.runHistory;
  const wins = runs.filter((r) => r.victory);
  const fastest = wins.length > 0 ? Math.min(...wins.map((r) => r.encounters)) : null;
  const unusual: HallOfFame['unusual'] = [];
  for (const run of wins) {
    const why: string[] = [];
    if (run.party.length <= SMALL_TEAM) why.push(`won with only ${run.party.length} Pokémon`);
    if (wins.length > 1 && run.encounters === fastest) why.push(`fastest win (${run.encounters} encounters)`);
    if (run.party.some((m) => m.shiny)) why.push('a shiny on the team');
    if (why.length > 0) unusual.push({ run, why: why.join(', ') });
  }
  const records = [
    { label: 'Runs finished', value: String(profile.stats.runsEnded) },
    { label: 'Champion runs', value: String(wins.length) },
    { label: 'Battles won', value: String(profile.stats.battlesWon) },
    { label: 'Species caught', value: String(profile.speciesCaught.length) },
    { label: 'Most badges in a run', value: String(runs.reduce((m, r) => Math.max(m, r.badges), 0)) },
    { label: 'Fastest win', value: fastest === null ? '—' : `${fastest} encounters` },
  ];
  return {
    records,
    champions: wins,
    unusual,
    rareForms: runs.flatMap((run) => run.party.filter((m) => m.shiny).map((m) => ({ speciesId: m.speciesId, level: m.level, run }))),
    legends: runs.flatMap((run) => run.legacy.filter((c) => c.titles.length > 0 || c.tags.length > 0 || c.mentor != null).map((card) => ({ run, card }))),
    // Cards from before mentors and records may lack both (saves fill them in; raw data may not).
    legacyRecords: runs.flatMap((run) => run.legacy.flatMap((card) => (card.records ?? []).map((record) => ({ run, card, record })))),
  };
}
