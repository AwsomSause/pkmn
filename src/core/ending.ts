// The ending (M9): what the finale says about this run. Pure: reads a finished run, changes nothing, draws no random numbers.

import type { Content } from './contentSchema';
import type { RunState } from './state';
import { runStamps } from './recap';

export type EndingId = 'storm' | 'untouched' | 'rivals' | 'champion';

/** Which ending a won run earns: the first that applies, from the rarest. */
export function endingFor(run: RunState): EndingId {
  if (run.story.flags['ge:won']) return 'storm';
  if (runStamps(run).includes('Untouched')) return 'untouched';
  if (run.story.rivals.some((r) => r.state === 'ally' || r.state === 'contender')) return 'rivals';
  return 'champion';
}

/** The epilogue lines for the victory screen and the credits (empty for a run that was not won). */
export function buildEpilogue(content: Content, run: RunState): string[] {
  if (!run.victory) return [];
  const grand = content.regions.get('grand')?.name ?? 'the Grand Region';
  const storm = content.story.grandEnemy.name;
  const lines: Record<EndingId, string> = {
    storm: `${storm} was turned back for good, and the skies over ${grand} cleared.`,
    untouched: `Not one of your Pokémon fell on the road to the top of ${grand}. Legends will say it could not be done.`,
    rivals: `Your rivals were there at the end of ${grand}, and for once nobody wanted to fight.`,
    champion: `You stand at the top of ${grand}: the last champion, and the first of a new age.`,
  };
  return [lines[endingFor(run)]];
}
