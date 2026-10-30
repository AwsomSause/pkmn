// Pinned objective (catalog #121): the one goal worth showing in the map's corner. Pure; changes nothing.

import type { Content } from './contentSchema';
import { directiveProgress } from './directive';
import { runQuestOf, runQuestProgress } from './quests';
import type { RunState } from './state';

export interface PinnedObjective {
  kind: 'runQuest' | 'directive';
  text: string;
  current: number;
  target: number;
}

/** The first unfinished goal: the Run Quest, then the Research Directive; null when everything is done or none was set. */
export function pinnedObjective(content: Content, run: RunState): PinnedObjective | null {
  const quest = runQuestOf(content, run);
  const qp = runQuestProgress(content, run);
  if (quest && qp && !qp.met) return { kind: 'runQuest', text: quest.text, current: qp.current, target: qp.target };
  const d = directiveProgress(content, run);
  if (d && !d.done) return { kind: 'directive', text: `Study ${d.type}-types`, current: d.current, target: d.target };
  return null;
}
