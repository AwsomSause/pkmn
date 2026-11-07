// W3 rival choice scenes wired into the Story Run: offered at relationship and rest Stops, shown on the Story screen,
// the reply follows, consequences surface once at a later Stop, and everything survives save and load.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { SCENES } from '../../src/core/story2/dialogue';
import { finishRivalScene, offerRivalScene, offersRivalScene, rivalStoryScene, surfaceRivalConsequences } from '../../src/core/story2/rivalStory';
import { content } from './helpers';

const rival = (id: string, name: string) => ({ id, name, archetype: 'golden-retriever', voice: undefined, encounters: 1, setbacks: 0, state: 'active', adaptations: [], bonds: {}, cooldown: 0, traits: { ambition: 50, pride: 40, empathy: 50, adaptability: 40, vindictiveness: 30, resilience: 50 } }) as never;
/** A Story Run after the player has met two rivals (scenes need a rival the player knows). */
const storyRun = (seed = 'rs'): RunState => {
  const run = chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', campaignId: 'orrery-circuit' }), 0);
  run.story.rivals.push(rival('r1', 'Dara'), rival('r2', 'Hale'));
  return run;
};
const clearIntro = (run: RunState) => { run.story.v2!.module!.active = null; run.story.v2!.module!.queue = []; };

describe('rival scenes in a Story Run', () => {
  it('the blueprint has Stops that offer them', () => {
    const run = storyRun();
    expect(run.story.v2!.blueprint!.stops.filter(offersRivalScene).length).toBeGreaterThanOrEqual(3);
  });

  it('offers a scene, plays a choice, shows the reply, then nothing', () => {
    const run = storyRun();
    clearIntro(run);
    expect(rivalStoryScene(run)).toBeNull();
    expect(offerRivalScene(run, 'stop-a')).toBe(true);
    expect(offerRivalScene(run, 'stop-b')).toBe(false); // one waits at a time
    const scene = rivalStoryScene(run)!;
    expect(scene.kicker).toBe('A Rival');
    expect(scene.choices.length).toBeGreaterThanOrEqual(2);
    expect(finishRivalScene(run, 'not-a-choice')).toBe(false);
    const { rival } = run.story.v2!.rivalScene!;
    expect(finishRivalScene(run, scene.choices[0]!.id)).toBe(true);
    expect(run.story.v2!.rel[rival]).toBeTruthy();
    const reply = rivalStoryScene(run)!;
    expect(reply.choices).toEqual([]);
    expect(reply.lines[0]!.text.length).toBeGreaterThan(0);
    expect(finishRivalScene(run)).toBe(true);
    expect(rivalStoryScene(run)).toBeNull();
  });

  it('never repeats a scene with the same rival, and spreads scenes over the rivals', () => {
    const run = storyRun('rs-all');
    clearIntro(run);
    let n = 0;
    while (offerRivalScene(run, `k${n}`)) {
      const s = rivalStoryScene(run)!;
      finishRivalScene(run, s.choices[0]!.id);
      while (rivalStoryScene(run)) finishRivalScene(run);
      n += 1;
    }
    expect(n).toBe(SCENES.scenes.length * run.story.rivals.length);
    expect(new Set(run.story.v2!.scenesDone.filter((x) => x.includes(':'))).size).toBe(n);
  });

  it('a hidden consequence surfaces once, later, and a save and load in between keeps it once', () => {
    const run = storyRun('rs-cq');
    clearIntro(run);
    const withHidden = SCENES.scenes.flatMap((s) => s.choices.filter((c) => c.hidden && SCENES.consequences[c.hidden]).map((c) => ({ s, c })));
    expect(withHidden.length).toBeGreaterThan(0);
    const { s, c } = withHidden[0]!;
    run.story.v2!.rivalScene = { scene: s.id, rival: run.story.rivals[0]!.id };
    finishRivalScene(run, c.id);
    finishRivalScene(run); // the reply
    expect(run.story.v2!.queue.length).toBe(1);
    run.regionIndex += 1; // far past any delay
    const saved = JSON.parse(JSON.stringify(run)) as RunState;
    expect(surfaceRivalConsequences(saved)).toBe(1);
    expect(rivalStoryScene(saved)!.kicker).toBe('Word on the Road');
    expect(surfaceRivalConsequences(saved)).toBe(0);
  });

  it('no rival met yet: nothing is offered', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'n', seed: 'n', archetypeId: 'red', campaignId: 'orrery-circuit' }), 0);
    run.story.rivals = [];
    expect(offerRivalScene(run, 'x')).toBe(false);
  });

  it('Classic runs offer nothing', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'c', seed: 'c', archetypeId: 'red' }), 0);
    expect(offerRivalScene(run, 'x')).toBe(false);
    expect(rivalStoryScene(run)).toBeNull();
  });
});
