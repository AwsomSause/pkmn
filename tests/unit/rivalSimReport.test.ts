// Rival simulation report (left-out 5.7): the per-run stats, its contradiction checks, and a few autoplayed runs
// that must break none of the rival rules.

import { describe, expect, it } from 'vitest';
import { rivalRunStats } from '../../src/core/rivals/simReport';
import { ULTIMATE_FLAG, ultimateDoneFlag } from '../../src/core/rivals/ultimate';
import { chooseStarter, createRun } from '../../src/core/run';
import type { Rival } from '../../src/core/story/schema';
import { autoplay } from './autoplay';
import { content } from './helpers';

const traits = { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 };
const rival = (id: string, over: Partial<Rival> = {}): Rival => ({
  id, classId: 'youngster', name: id, archetype: 'proud', style: 'rush', traits: { ...traits }, rivalPotential: 10, state: 'recurring', arc: null, away: 0, cooldown: 0, progress: 0,
  encounters: 2, setbacks: 0, adaptations: [], bonds: {}, offscreen: [], origin: { eventId: `e-${id}`, where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'spark' },
  memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 0.8, turns: 5, team: [] } }, ...over,
}) as Rival;
const runWith = (rivals: Rival[]) => {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'sim', seed: 'sim', archetypeId: 'red' }), 0));
  run.story.rivals = rivals;
  return run;
};

describe('rival simulation report', () => {
  it('counts rivals, states, resolutions, ranks and repeats', () => {
    const run = runWith([rival('a', { rank: 'gymLeader' }), rival('b', { state: 'ally', arc: { id: 'x', stage: 2, ticks: 3, resolution: 'good' } }), { ...rival('c'), name: 'a' }]);
    const s = rivalRunStats(run);
    expect(s).toMatchObject({ rivals: 3, encounters: 6, states: { recurring: 2, ally: 1 }, resolutions: { good: 1, bad: 0, open: 2 }, ranks: { gymLeader: 1 }, repeats: 2, contradictions: [] });
  });

  it('flags broken rival state', () => {
    const run = runWith([rival('a', { rank: 'champion' }), rival('a', { rank: 'champion', state: 'ally' })]);
    run.story.flags[ULTIMATE_FLAG] = 'ghost';
    run.story.flags[ultimateDoneFlag('a')] = true;
    const c = rivalRunStats(run).contradictions.join('\n');
    expect(c).toContain('duplicate rival id a');
    expect(c).toContain('Ultimate Rival ghost is not a rival');
    expect(c).toContain('2 rivals hold the Champion rank');
    expect(c).toContain('without being chosen');
    run.story.flags[ULTIMATE_FLAG] = 'a';
    run.story.rivals = [rival('a', { state: 'retired' })];
    expect(rivalRunStats(run).contradictions.join('\n')).toContain('the rivalry has ended');
  });

  it('autoplayed runs never break a rival rule', () => {
    for (const seed of ['rival-qa-1', 'rival-qa-2']) {
      const run = autoplay({ seed, steps: 20000, healOnMap: true, smart: true, starterLevel: 40, rules: { modeId: 'standard', difficultyId: 'story', modifierIds: [], deathBlock: true } });
      const s = rivalRunStats(run);
      expect(s.contradictions, seed).toEqual([]);
      expect(s.rivals, seed).toBeGreaterThan(0);
    }
  }, 60_000);
});
