// Story Bus (Design v2 Part XII): emit hands every DomainEvent to the fixed subscriber list; story scenes, arcs and Lore publish.
import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { SUBSCRIBERS } from '../../src/core/story/bus';
import { emit } from '../../src/core/story/record';
import { activeScene, applyEffects, chooseBackstory, finishScene, queueStopScene } from '../../src/core/story2/module';
import { content } from './helpers';

const storyRun = (seed: string) => {
  const run = chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', campaignId: 'orrery-circuit' }), 0);
  chooseBackstory(content, run, 'bs_viridian');
  return run;
};

describe('Story Bus', () => {
  it('has a fixed subscriber order', () => {
    expect(SUBSCRIBERS.length).toBeGreaterThanOrEqual(2);
  });

  it('scenes, arcs and Lore publish messages, and subscribers tally them in the run', () => {
    const run = storyRun('bus-1');
    const v2 = run.story.v2!;
    for (const [i, stop] of v2.blueprint!.stops.entries()) {
      v2.stops.done.push(stop.id);
      v2.stops.index = i + 1;
      queueStopScene(content, run, stop.id);
      for (let g = 0; g < 4 && v2.module!.active; g++) finishScene(content, run, activeScene(content, run)!.choices[0]?.id);
    }
    const types = run.story.events.map((e) => e.type);
    expect(types).toContain('storyChoice');
    expect(Number(v2.facts['bus.storyChoice'])).toBe(v2.module!.played.length);
    const before = Number(v2.facts['bus.loreUnlocked'] ?? 0);
    applyEffects(content, run, [{ id: 'l1', kind: 'unlock_lore', lore: 'test_lore', state: 'known' }] as never);
    expect(v2.module!.chronicle).toContain('lore:test_lore');
    expect(v2.facts['bus.loreUnlocked']).toBe(before + 1);
  });

  it('a Classic run is untouched by the story subscribers', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'c', seed: 'c', archetypeId: 'red' }), 0);
    emit(content, run, 'storyChoice', { data: { event: 'x' } });
    expect(run.story.v2).toBeUndefined();
  });

  it('same seed, same messages', () => {
    const ids = (seed: string) => {
      const run = storyRun(seed);
      const v2 = run.story.v2!;
      for (const [i, stop] of v2.blueprint!.stops.entries()) {
        v2.stops.index = i + 1;
        queueStopScene(content, run, stop.id);
        for (let g = 0; g < 4 && v2.module!.active; g++) finishScene(content, run, activeScene(content, run)!.choices[0]?.id);
      }
      return run.story.events.map((e) => `${e.id}:${e.type}`);
    };
    expect(ids('bus-2')).toEqual(ids('bus-2'));
  });
});

describe('asset credits page (Design v2 Part AF)', () => {
  it('follows the planned section order and is part of the end credits', async () => {
    const { assetCreditLines } = await import('../../src/core/credits');
    expect(content.assetCredits.sections.map((s) => s.id)).toEqual(['direction', 'art', 'packs', 'fonts', 'code', 'thanks']);
    const lines = assetCreditLines(content);
    expect(lines.filter((l) => l.kind === 'heading').map((l) => l.text)).toEqual(content.assetCredits.sections.map((s) => s.title));
    expect(lines.some((l) => l.text.includes('Nintendo'))).toBe(true);
    expect(content.assetCredits.sections.flatMap((s) => s.entries).some((e) => e.generated)).toBe(true);
  });
});
