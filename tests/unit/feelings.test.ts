// Grudge & Respect (Techno §6.2) and the Chronicle stories (§6.3).

import { describe, expect, it } from 'vitest';
import { FEELINGS, openingFor, rivalFeeling } from '../../src/core/rivals/feelings';
import { chooseStarter, createRun } from '../../src/core/run';
import { chronicleStories } from '../../src/core/story/storybook';
import type { Rival } from '../../src/core/story/schema';
import { content } from './helpers';

const rival = (over: Partial<Rival> & { hp?: number; empathy?: number; vindictive?: number; resilience?: number } = {}): Rival =>
  ({
    id: 'r1', classId: 'youngster', name: 'Joey', archetype: 'x', style: 'y', rivalPotential: 10, state: 'active', encounters: 3, setbacks: 0, away: 0, cooldown: 0, progress: 0, bonds: {}, offscreen: [], adaptations: [],
    arc: null, origin: { eventId: 'e', where: { region: 0, stage: 1, turn: 0 }, path: 'p' },
    traits: { empathy: over.empathy ?? 50, vindictiveness: over.vindictive ?? 30, resilience: over.resilience ?? 50, pride: 40, ambition: 50 },
    memory: { lastBattle: { eventId: 'e', result: 'lose', hpLeftShare: over.hp ?? 0.5, turns: 6, team: [] } },
    ...over,
  }) as unknown as Rival;

describe('Grudge & Respect', () => {
  it('feelings come from character and history', () => {
    expect(rivalFeeling(rival({ state: 'ally' })).feeling).toBe('gratitude');
    expect(rivalFeeling(rival({ encounters: 1 })).feeling).toBe('unresolved');
    expect(rivalFeeling(rival({ hp: 0.1, empathy: 60 })).feeling).toBe('respect');
    expect(rivalFeeling(rival({ hp: 0.95, vindictive: 70 })).feeling).toBe('resentment');
    expect(rivalFeeling(rival({ hp: 0.95, resilience: 20 })).feeling).toBe('fear');
    expect(rivalFeeling(rival({ hp: 0.5 })).feeling).toBe('rivalry');
    for (const f of FEELINGS) expect(typeof f).toBe('string');
  });

  it('only resentment, fear and respect change the opening', () => {
    expect(openingFor('resentment')).toBe('rivalResentment');
    expect(openingFor('fear')).toBe('rivalFear');
    expect(openingFor('respect')).toBe('rivalRespect');
    expect(openingFor('rivalry')).toBeNull();
  });
});

describe('Chronicle stories', () => {
  it('a rival met several times becomes "The Rival Who Wouldn\'t Give Up"', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'cs', seed: 'cs', archetypeId: 'red' }), 0));
    expect(chronicleStories(content, run).filter((s) => s.kind === 'rivalry')).toEqual([]);
    run.story.rivals.push(rival({ hp: 0.1, empathy: 60 }));
    const story = chronicleStories(content, run).find((s) => s.kind === 'rivalry')!;
    expect(story.title).toBe("The Rival Who Wouldn't Give Up");
    expect(story.body).toContain('close one');
    expect(story.tags).toContain('Rivalry open');
  });
});
