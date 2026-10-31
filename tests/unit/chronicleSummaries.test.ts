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

import { advanceChains, chainProgress } from '../../src/core/story/chains';

describe('rival chain steps 4 and 5 (2.3)', () => {
  it('the rival chain finishes only after the rivalry has grown and respect was earned', () => {
    const run = fresh();
    const chain = content.story.chains.find((c) => c.id === 'rival-wont-stay-down')!;
    expect(chain.steps).toHaveLength(5);
    const uid = run.party[0]!.uid;
    for (const step of chain.steps.slice(0, 4)) expect(advanceChains(content, run, step, uid)).toEqual([]);
    expect(chainProgress(run, chain.id)).toBe(4);
    expect(advanceChains(content, run, 'rival-respect', uid)).toEqual([chain.id]);
    expect(run.story.histories[uid]?.titles ?? []).toEqual(expect.arrayContaining([chain.title]));
  });
});

import { createPokemon } from '../../src/core/pokemon';
import { answerAskLead, planAskLead } from '../../src/core/story/askLead';
import { openHistory } from '../../src/core/story/record';

describe('Feels Left Out / Campfire: ask to lead (2.3)', () => {
  it('a benched Pokémon with hardly any fights asks once per stage; yes puts it first', () => {
    const run = fresh();
    const rookie = createPokemon(content, 'rattata', 8, 'rookie');
    run.party.push(rookie);
    openHistory(content, run, rookie.uid, rookie.speciesId, 'caught');
    run.encountersCompleted = 2;
    expect(planAskLead(content, run)).toBeNull();
    run.encountersCompleted = 6;
    const ask = planAskLead(content, run)!;
    expect(ask).toMatchObject({ uid: 'rookie', reason: 'leftOut' });
    const before = rookie.friendship;
    expect(answerAskLead(content, run, ask, true)).toContain('takes the lead');
    expect(run.party[0]!.uid).toBe('rookie');
    expect(rookie.friendship).toBeGreaterThan(before);
    expect(planAskLead(content, run)).toBeNull();
  });
  it('not now keeps the order and does not ask again this stage', () => {
    const run = fresh();
    const rookie = createPokemon(content, 'rattata', 8, 'rookie');
    run.party.push(rookie);
    openHistory(content, run, rookie.uid, rookie.speciesId, 'caught');
    run.encountersCompleted = 6;
    answerAskLead(content, run, planAskLead(content, run)!, false);
    expect(run.party[0]!.uid).not.toBe('rookie');
    expect(planAskLead(content, run)).toBeNull();
  });
});

import { conditionText, conditionMet } from '../../src/core/events';

describe('Kindness peaceful encounter (2.3)', () => {
  it('A Quiet Hello offers the gentle choice only to a party with a Kindness Pokémon', async () => {
    const ev = content.events.get('a-quiet-hello')!;
    expect(ev).toBeTruthy();
    const gentle = ev.choices.find((c) => c.requires?.some((r) => r.kind === 'emotion'))!;
    const cond = gentle.requires!.find((r) => r.kind === 'emotion')!;
    const run = fresh();
    expect(conditionMet(content, run, cond)).toBe(false);
    expect(conditionText(content, cond)).toBe('Needs a Kindness Pokémon in your party');
    const { emit } = await import('../../src/core/story/record');
    emit(content, run, 'storyMoment', { actors: [run.party[0]!.uid], data: { def: 'x', suppressed: false }, importance: 90, text: 'test', emotions: ['kindness'] });
    expect(conditionMet(content, run, cond)).toBe(true);
  });
});

import { finalRivalArenaTheme } from '../../src/core/story/highHype';

describe('Final Rival first-meeting arena (2.3)', () => {
  it('only the defining rival in the last region gets the arena of the stage where you first met', () => {
    const run = fresh();
    run.usedThemes = ['t0', 't1', 't2'];
    run.story.rivals.push({ id: 'r1', origin: { eventId: 'x', where: { region: 0, stage: 1, level: null, node: null, battle: null, turn: null }, path: 'p' } } as never);
    expect(finalRivalArenaTheme(content, run, 'r1', true)).toBeNull();
    run.regionIndex = run.regionOrder.length - 1;
    expect(finalRivalArenaTheme(content, run, 'r1', false)).toBeNull();
    expect(finalRivalArenaTheme(content, run, 'r1', true)).toBe('t1');
    expect(finalRivalArenaTheme(content, run, 'nobody', true)).toBeNull();
  });
});
