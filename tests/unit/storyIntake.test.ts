// Prologue Beats 5-8 and the Short Intake: quiz sets, the three picks, the Story Run's next backstory and Starter.

import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/core/profile';
import { chooseNextBackstory, chooseNextLine, clearNextRun, intakeChoices, nextRunStart, quizPool, quizQuestions, revealPicks, saveQuizResult } from '../../src/core/story2/intake';
import { ProfileStorySchema } from '../../src/core/story2/schema';
import { GameSession } from '../../src/game/GameSession';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const data = content.storyData;
const answer = (quick: boolean, pos: number) => Object.fromEntries(quizQuestions(data, quick).map((q) => [q.id, q.answers[pos % q.answers.length]!.id]));

describe('Story intake', () => {
  it('full quiz is the 12 main questions, the quick set is the 6 alternates', () => {
    expect(quizQuestions(data, false)).toHaveLength(12);
    expect(quizQuestions(data, true)).toHaveLength(6);
  });
  it('the pool holds quiz lines, never event-locked ones until the Archive unlocks them', () => {
    const story = createProfile(content, 'p').story;
    const locked = data.remembrances.find((r) => r.unlock.kind === 'event')!;
    expect(quizPool(data, story).some((r) => r.id === locked.id)).toBe(false);
    story.remembrance[locked.id] = { state: 'unlocked', firstSeenRun: null, runs: 0, mastery: 0 };
    expect(quizPool(data, story).some((r) => r.id === locked.id)).toBe(true);
  });
  it('gives three distinct picks, the same for the same answers, in both sets', () => {
    const story = createProfile(content, 'p').story;
    for (const quick of [false, true]) {
      for (let pos = 0; pos < 5; pos++) {
        const a = revealPicks(data, story, answer(quick, pos), quick);
        expect(new Set(a.picks.map((p) => p.id)).size).toBe(3);
        expect(revealPicks(data, story, answer(quick, pos), quick).picks.map((p) => p.id)).toEqual(a.picks.map((p) => p.id));
      }
    }
  });
  it('saves the result and offers it (plus unlocked lines) at the Short Intake', () => {
    let story = createProfile(content, 'p').story;
    const r = revealPicks(data, story, answer(false, 1), false);
    story = saveQuizResult(story, r.traitVector, r.picks);
    story.remembrance['rm_vulpix'] = { state: 'unlocked', firstSeenRun: null, runs: 1, mastery: 1 };
    const ids = intakeChoices(data, story).map((x) => x.id);
    expect(ids.slice(0, 3)).toEqual(r.picks.map((p) => p.id));
    expect(ids).toContain('rm_vulpix');
  });
  it('the next run takes the chosen line and backstory once, and old profiles load with none', () => {
    let story = createProfile(content, 'p').story;
    expect(nextRunStart(data, story)).toEqual({});
    story = chooseNextLine(chooseNextBackstory(story, 'bs_viridian'), 'rm_charmander');
    expect(nextRunStart(data, story)).toEqual({ starter: 'charmander', backstory: 'bs_viridian' });
    expect(nextRunStart(data, clearNextRun(story))).toEqual({});
    const old = ProfileStorySchema.parse({ prologue: { done: true } });
    expect(old.nextRun).toEqual({});
  });
  it('a new Story Run starts with the chosen Starter, backstory and name, then clears the choice; Classic ignores it', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    session.changeProfile((p) => ({ ...p, story: chooseNextLine(chooseNextBackstory({ ...p.story, protagonist: { ...p.story.protagonist, name: 'Kay', nameSet: true, pronouns: 'she' } }, 'bs_viridian'), 'rm_charmander') }));
    const classic = session.newRun('red', 'cl-seed');
    expect(classic.story.v2).toBeUndefined();
    expect(session.profile.story.nextRun.line).toBe('rm_charmander');
    const run = session.newRun('red', 'st-seed', 'orrery-circuit');
    expect(run.starterChoices).toEqual(['charmander']);
    expect(run.story.v2?.protagonist).toMatchObject({ name: 'Kay', pronouns: 'she', backstory: 'bs_viridian' });
    expect(session.profile.story.nextRun).toEqual({});
  });
});
