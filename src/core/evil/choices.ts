// Permanent Run Choices (spec §17): the run keeps a history of its significant decisions. The first answer to a
// choice id stands for the rest of the run; later events read it (`choice` condition) to open or close follow-ups,
// and characters can bring it up again. Weight 1 is a small decision, 3 a run-defining one.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { ChoiceRecord } from './schema';

export const choicesOf = (run: RunState): ChoiceRecord[] => (run.story.choices ??= []);

/** Records a decision (once per id). Returns the change in words, or '' when it was already decided. */
export function recordChoice(content: Content, run: RunState, c: { id: string; pick: string; text: string; weight: number }): string {
  const list = choicesOf(run);
  if (list.some((x) => x.id === c.id)) return '';
  list.push({ id: c.id, pick: c.pick, text: c.text, weight: c.weight, region: run.regionIndex, stage: run.stage?.index ?? 0 });
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'choice', suppressed: false }, importance: c.weight >= 3 ? 85 : c.weight === 2 ? 65 : 45, text: c.text });
  return c.weight >= 3 ? 'a run-defining choice' : c.weight === 2 ? 'a lasting choice' : '';
}

/** Whether a choice was made (and, with `pick`, answered this way). */
export function choiceMade(run: RunState, id: string, pick?: string): boolean {
  const found = run.story.choices?.find((x) => x.id === id);
  return !!found && (pick === undefined || found.pick === pick);
}

/** The choice history, weightiest first then oldest first, for the Story screen. */
export function choiceHistory(run: RunState): ChoiceRecord[] {
  return [...choicesOf(run)].map((c, i) => ({ c, i })).sort((a, b) => b.c.weight - a.c.weight || a.i - b.i).map((x) => x.c);
}
