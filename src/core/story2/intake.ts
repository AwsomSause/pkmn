// Prologue Beats 5-8 and the Short Intake: the quiz questions, the three picks, and the backstory and Starter line the next
// Story Run starts with. Pure: no Phaser, no gameplay RNG (pickThree uses its own named stream from the answers).

import type { ProfileStory, StoryData } from './schema';
import { answerHash, pickThree, scoreQuiz, type QuizAnswers } from './quiz';

type Remembrance = StoryData['remembrances'][number];
type Question = StoryData['quiz'][number];

/** Full prologue: the 12 main questions. Quick Start and the Intake Interview: the quick set (design Q.1, Part I). */
export function quizQuestions(data: Pick<StoryData, 'quiz'>, quick: boolean): Question[] {
  return data.quiz.filter((q) => q.quick === quick);
}

/** Lines the quiz may offer: quiz-unlocked lines plus any line the profile has unlocked in the Archive. Disabled lines never. */
export function quizPool(data: Pick<StoryData, 'remembrances'>, story: Pick<ProfileStory, 'remembrance'>): Remembrance[] {
  return data.remembrances.filter((r) => r.status !== 'disabled' && (r.unlock.kind === 'quiz' || r.unlock.kind === 'start' || story.remembrance[r.id]?.state === 'unlocked'));
}

/**
 * Scores the answers and drafts the three picks (Match, Complement, Surprise). Quick sets weigh double (design Q.1), which
 * scoreQuiz gets by counting each quick answer twice. The seed covers the answers and the unlocked set (design Part I, determinism).
 */
export function revealPicks(data: Pick<StoryData, 'quiz' | 'remembrances'>, story: Pick<ProfileStory, 'remembrance'>, answers: QuizAnswers, quick: boolean): { traitVector: Record<string, number>; picks: Remembrance[] } {
  const qs = quizQuestions(data, quick);
  const asked = quick ? [...qs, ...qs.map((q) => ({ ...q, id: `${q.id}#2` }))] : qs;
  const doubled: QuizAnswers = quick ? Object.fromEntries(Object.entries(answers).flatMap(([q, a]) => [[q, a], [`${q}#2`, a]])) : answers;
  const { scores } = scoreQuiz(asked, doubled);
  const pool = quizPool(data, story);
  const unlockedSet = pool.map((r) => r.id).sort().join(',');
  return { traitVector: scores, picks: pickThree(pool, scores, `${answerHash(answers)}::${unlockedSet}`) };
}

/** Saves the quiz result (trait vector and the three line ids) on the profile. */
export function saveQuizResult(story: ProfileStory, traitVector: Record<string, number>, picks: readonly Remembrance[]): ProfileStory {
  return { ...story, quiz: { ...story.quiz, lastResult: { traitVector, picks: picks.map((p) => p.id) } } };
}

/** Lines the Short Intake lets the player pick from: the last quiz's three, then every other line unlocked in the Archive. */
export function intakeChoices(data: Pick<StoryData, 'remembrances'>, story: Pick<ProfileStory, 'quiz' | 'remembrance'>): Remembrance[] {
  const ids = [...(story.quiz.lastResult?.picks ?? [])];
  for (const r of data.remembrances) if (story.remembrance[r.id]?.state === 'unlocked' && !ids.includes(r.id)) ids.push(r.id);
  return ids.map((id) => data.remembrances.find((r) => r.id === id)).filter((r): r is Remembrance => !!r && r.status !== 'disabled');
}

export const chooseNextBackstory = (story: ProfileStory, backstory: string): ProfileStory => ({ ...story, nextRun: { ...story.nextRun, backstory } });
export const chooseNextLine = (story: ProfileStory, line: string): ProfileStory => ({ ...story, nextRun: { ...story.nextRun, line } });
export const clearNextRun = (story: ProfileStory): ProfileStory => ({ ...story, nextRun: {} });

/** What a new Story Run takes from the profile: the Starter species (first stage of the chosen line) and the backstory. */
export function nextRunStart(data: Pick<StoryData, 'remembrances'>, story: Pick<ProfileStory, 'nextRun'>): { starter?: string; backstory?: string } {
  const line = story.nextRun.line ? data.remembrances.find((r) => r.id === story.nextRun.line) : undefined;
  return { ...(line ? { starter: line.line[0]! } : {}), ...(story.nextRun.backstory ? { backstory: story.nextRun.backstory } : {}) };
}
