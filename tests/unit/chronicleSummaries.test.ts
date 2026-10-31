import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { chronicleStories } from '../../src/core/story/storybook';
import { content } from './helpers';

const fresh = () => structuredClone(chooseStarter(content, createRun(content, { runId: 'cs', seed: 'chron', archetypeId: 'red' }), 0));

describe('Chronicle summaries per region, raid and nemesis (2.3)', () => {
  it('tells a chapter for each cleared region and a raid log once raids were won', () => {
    const run = fresh();
    expect(chronicleStories(content, run).some((s) => s.kind === 'region' || s.kind === 'raid')).toBe(false);
    run.regionsCleared.push([...content.regions.keys()][0]!);
    run.log.counters.raidsWon = 2;
    run.log.counters.totemsWon = 1;
    const stories = chronicleStories(content, run);
    expect(stories.find((s) => s.kind === 'region')!.title).toMatch(/^Chapter: /);
    expect(stories.find((s) => s.kind === 'raid')!.body).toContain('2 raid dens, 1 Totem fight');
  });
  it('tells one account per nemesis', () => {
    const run = fresh();
    run.story.nemeses.push({
      id: 'n1', speciesId: 'rattata', level: 10, source: 'wild', trainer: null, archetype: 'survivor', cause: 'escaped', phase: 'reckoning',
      formedAt: { region: 0, stage: 0, battle: 1, turn: 1 }, lastMet: { region: 0, stage: 0 }, beat: [], foeTypes: [], wins: 1, changes: ['It came back stronger'], partner: null, settledAs: null,
    } as never);
    const story = chronicleStories(content, run).find((s) => s.kind === 'nemesis')!;
    expect(story.body).toContain('broke free of a ball');
    expect(story.body).toContain('Reckoning is still ahead');
  });
});
