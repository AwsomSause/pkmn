// Overdrive chains (blueprint §6): one moment leading to another. A chain is an
// ordered list of steps (story event ids, or a few named milestones); it moves
// forward only when its next step happens, so the chain is never guaranteed: it
// emerges from what the run does. Finishing a chain earns the Pokémon involved
// a title and a memory. Progress is a run flag, so it saves and reloads.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from './record';

/** The flag that holds how many steps of a chain are done. */
export const chainFlag = (id: string) => `chain:${id}`;

/** How far a chain has got (0 = not started). */
export function chainProgress(run: RunState, id: string): number {
  const v = run.story.flags[chainFlag(id)];
  return typeof v === 'number' ? v : 0;
}

/**
 * Tells the chains that `stepId` happened (to `uid`, when it happened to one Pokémon).
 * Returns the ids of the chains it completed.
 */
export function advanceChains(content: Content, run: RunState, stepId: string, uid?: string): string[] {
  const done: string[] = [];
  for (const chain of content.story.chains) {
    const at = chainProgress(run, chain.id);
    if (at >= chain.steps.length || chain.steps[at] !== stepId) continue;
    run.story.flags[chainFlag(chain.id)] = at + 1;
    if (at + 1 < chain.steps.length) continue;
    done.push(chain.id);
    const history = uid ? run.story.histories[uid] : undefined;
    if (history && !history.titles.includes(chain.title)) history.titles.push(chain.title);
    emit(content, run, 'storyMoment', {
      actors: uid ? [uid] : [],
      data: { def: `chain:${chain.id}`, suppressed: false },
      importance: chain.importance,
      text: `${chain.title}: ${chain.text}`,
      emotions: chain.emotions,
    });
  }
  return done;
}
