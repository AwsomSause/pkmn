import { describe, expect, it } from 'vitest';
import { introForBattle, introText, trainerIntro } from '../../src/core/story2/cutscene';
import text from '../../src/data/story/text/en.json';

const t = (k: string): string | undefined => (text as Record<string, string>)[k];
const trainer = (classId: string) => ({ classId });

describe('Story Run trainer introductions', () => {
  it('picks the intro by who the trainer is', () => {
    expect(introForBattle({ trainer: trainer('gym-leader') })?.id).toBe('leader_pose');
    expect(introForBattle({ trainer: trainer('elite-four') })?.title).toBe('Elite Four');
    expect(introForBattle({ trainer: trainer('champion') })?.id).toBe('champion_entry');
    expect(introForBattle({ trainer: trainer('youngster'), rivalId: 'rex' })?.id).toBe('rival_challenge');
  });

  it('gives ordinary trainers and wild battles no intro', () => {
    expect(introForBattle({ trainer: trainer('youngster') })).toBeNull();
    expect(introForBattle({ trainer: null })).toBeNull();
  });

  it('fills the tokens and every intro has its text', () => {
    const out = introText(trainerIntro('leader_pose')!, t, { title: 'Gym Leader', speaker: 'Brook', pokemon: 'Pikachu' });
    expect(out.title).toBe('Gym Leader Brook');
    expect(out.lines[0]).toContain('Pikachu');
    for (const id of ['rival_challenge', 'leader_pose', 'champion_entry']) {
      const intro = trainerIntro(id)!;
      for (const k of intro.lineKeys) expect(t(k), k).toBeTruthy();
    }
  });

  it('skips a line whose text is missing', () => {
    expect(introText({ id: 'x', lineKeys: ['nope'], pose: 'hop', emote: 'spark', sting: 's', ms: 1 } as never, t, {}).lines).toEqual([]);
  });
});
