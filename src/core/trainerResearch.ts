// Trainer Research (GAME_DESIGN §14.3: "using a trainer reveals their background, dialogue and special
// events"): the more runs you finish as a trainer, the more the Trainer Archive tells you about them.
// Display only; it changes no rule or roll.

import type { Archetype, Content } from './contentSchema';
import { questLineView } from './quests';
import type { Profile } from './state';

/** Finished runs needed for research levels 1, 2 and 3. */
export const RESEARCH_RUNS = [1, 3, 6] as const;

export function researchLevel(profile: Pick<Profile, 'trainerCounters'>, trainerId: string): number {
  const runs = profile.trainerCounters?.[trainerId]?.runsFinished ?? 0;
  return RESEARCH_RUNS.filter((n) => runs >= n).length;
}

/** What the archive shows for a trainer: what is known so far and what the next level needs. */
export function researchLines(content: Content, profile: Profile, a: Pick<Archetype, 'id' | 'name' | 'description' | 'signatureTypes' | 'signatureSpecies' | 'eventTags' | 'title'>): string[] {
  const level = researchLevel(profile, a.id);
  const runs = profile.trainerCounters?.[a.id]?.runsFinished ?? 0;
  const lines: string[] = [];
  if (level >= 1) lines.push(`Background: ${a.title ? `${a.title}. ` : ''}${a.description}`);
  if (level >= 2) {
    const likes = [...a.signatureTypes.map((t) => t.toUpperCase()), ...a.signatureSpecies.map((id) => content.species.get(id)?.name ?? id)];
    lines.push(likes.length > 0 ? `Habits: favours ${likes.join(', ')}.` : 'Habits: no favourites; takes what comes.');
  }
  if (level >= 3) {
    const view = questLineView(content, profile, a.id);
    const goals = view ? view.steps.map((s) => s.step.goal) : [];
    const opening = view ? ` "${view.steps[0]!.step.story}"` : '';
    const tags = a.eventTags.length > 0 ? ` Meets events tagged ${a.eventTags.join(', ')}.` : '';
    lines.push(`Story: ${goals.length > 0 ? `${view!.line.name}: ${goals.join(' → ')}.${opening}` : 'no quest line yet.'}${tags}`);
  }
  const next = RESEARCH_RUNS[level];
  lines.push(next ? `Research ${level}/${RESEARCH_RUNS.length}: ${runs}/${next} finished runs as ${a.name} for the next level.` : `Research complete (${runs} runs).`);
  return lines;
}
