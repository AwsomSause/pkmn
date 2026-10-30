// The Protégé system (Techno blueprint §4): offers, accepting or declining, graduating.

import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun, resolveDecision } from '../../src/core/run';
import { answerMentorship, graduateMentorships, mentorshipOf, planMentorship } from '../../src/core/story/mentorship';
import { openHistory } from '../../src/core/story/record';
import { content } from './helpers';

function team(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  const mentor = run.party[0]!;
  mentor.level = 40;
  const rookie = createPokemon(content, 'rattata', 20, 'rookie');
  run.party.push(rookie);
  openHistory(content, run, rookie.uid, rookie.speciesId, 'caught');
  const h = run.story.histories[mentor.uid]!;
  h.battles = 12;
  h.bossesBeaten = 2;
  return { run, mentor, rookie };
}

describe('Protégé system', () => {
  it('a veteran who beat a boss offers to mentor a much lower-level teammate, with a path from its history', () => {
    const { run, mentor, rookie } = team('mentor-offer');
    const offer = planMentorship(content, run)!;
    expect(offer).toMatchObject({ mentorUid: mentor.uid, proteUid: rookie.uid, path: 'challenger' });
    run.story.histories[mentor.uid]!.survivedFatal = 5;
    expect(planMentorship(content, run)!.path).toBe('survivor');
  });

  it('no offer without a boss win, enough battles or a level gap', () => {
    const a = team('mentor-none-a');
    a.run.story.histories[a.mentor.uid]!.bossesBeaten = 0;
    expect(planMentorship(content, a.run)).toBeNull();
    const b = team('mentor-none-b');
    b.rookie.level = 38;
    expect(planMentorship(content, b.run)).toBeNull();
  });

  it('declining is remembered; accepting opens a mentorship that blocks a second offer for the pair', () => {
    const { run, mentor, rookie } = team('mentor-answer');
    const offer = planMentorship(content, run)!;
    run.pending.push({ kind: 'mentorship', ...offer });
    run.phase = 'decision';
    const declined = resolveDecision(content, run, { kind: 'mentor', accept: false }).run;
    expect(planMentorship(content, declined)).toBeNull();
    run.pending = [];
    answerMentorship(content, run, offer, true);
    expect(mentorshipOf(run, rookie.uid)?.a.id).toBe(mentor.uid);
    expect(planMentorship(content, run)).toBeNull();
  });

  it('graduates when the protégé evolves or catches up, earning a title and freeing both', () => {
    const { run, mentor, rookie } = team('mentor-grad');
    answerMentorship(content, run, planMentorship(content, run)!, true);
    expect(graduateMentorships(content, run)).toEqual([]);
    rookie.level = mentor.level;
    expect(graduateMentorships(content, run)).toEqual([rookie.uid]);
    expect(mentorshipOf(run, rookie.uid)).toBeUndefined();
    expect(run.story.histories[rookie.uid]!.titles).toContain('Former Protégé');
  });
});
