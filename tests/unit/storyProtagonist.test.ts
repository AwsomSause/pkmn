// Story Run: the prologue's name, pronouns and Look ride into the run, and story scenes fill {player} and the pronoun tokens.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { renderTemplate } from '../../src/core/story2/templates';
import { RunStateSchema } from '../../src/core/state';
import { content } from './helpers';

const start = (protagonist?: { look: string; name: string; pronouns: string | { subj: string; obj: string; poss: string; reflexive: string } }) =>
  chooseStarter(content, createRun(content, { runId: 'pr', seed: 'pr', archetypeId: 'red', campaignId: 'orrery-circuit', ...(protagonist ? { protagonist } : {}) }), 0);

describe('Story Run protagonist', () => {
  it('copies name, pronouns and Look into the run and keeps them through the backstory and a reload', () => {
    const run = start({ look: 'look_a', name: 'Kay', pronouns: 'she' });
    expect(run.story.v2?.protagonist).toMatchObject({ look: 'look_a', name: 'Kay', pronouns: 'she' });
    expect(run.story.v2?.protagonist?.backstory).toBeTruthy();
    const back = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(back.story.v2?.protagonist?.name).toBe('Kay');
  });
  it('keeps custom pronouns', () => {
    const set = { subj: 'xe', obj: 'xem', poss: 'xyr', reflexive: 'xemself' };
    expect(start({ look: 'look_a', name: 'Rin', pronouns: set }).story.v2?.protagonist?.pronouns).toEqual(set);
  });
  it('a Story Run without a name set still starts (they/them, "you")', () => {
    const run = start();
    expect(run.story.v2?.protagonist?.name ?? '').toBe('');
  });
  it('Classic runs ignore the protagonist', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'c', seed: 'c', archetypeId: 'red', protagonist: { look: 'look_a', name: 'Kay', pronouns: 'she' } }), 0);
    expect(run.story.v2).toBeUndefined();
  });
  it('pronoun tokens render in story templates', () => {
    expect(renderTemplate('{They_are} ready. {player} checks {their} bag.', { They_are: 'She is', player: 'Kay', their: 'her' })).toBe('She is ready. Kay checks her bag.');
  });
});
