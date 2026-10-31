// Playstyle run titles (catalog 155): picked from the run's own counters, never random, never a stat.

import { describe, expect, it } from 'vitest';
import { PLAYSTYLES, playstyleOf } from '../../src/core/playstyle';
import { chooseStarter, createRun } from '../../src/core/run';
import { recordEpitaph } from '../../src/core/story/legacy';
import { content } from './helpers';

const fresh = () => structuredClone(chooseStarter(content, createRun(content, { runId: 'ps', seed: 'playstyle', archetypeId: 'red' }), 0));

describe('playstyle titles', () => {
  it('gives nothing to a run that stands out in no way', () => {
    expect(playstyleOf(fresh())).toBeNull();
  });
  it('picks the style the counters show, and the biggest margin wins', () => {
    const run = fresh();
    run.log.counters.pokemonCaught = 10;
    expect(playstyleOf(run)?.id).toBe('collector');
    run.log.counters.eggsHatched = 9;
    expect(playstyleOf(run)?.id).toBe('breeder');
  });
  it('the Tactician needs few heal stops', () => {
    const run = fresh();
    run.log.counters.battlesWon = 25;
    run.log.counters.healStopsUsed = 5;
    expect(playstyleOf(run)).toBeNull();
    run.log.counters.healStopsUsed = 1;
    expect(playstyleOf(run)?.id).toBe('tactician');
  });
  it('writes the title into the Chronicle when the run ends, and every style has its own id', () => {
    expect(new Set(PLAYSTYLES.map((p) => p.id)).size).toBe(PLAYSTYLES.length);
    const run = fresh();
    run.log.counters.pokemonCaught = 12;
    recordEpitaph(content, run);
    expect(JSON.stringify(run.story.chronicle ?? run.story)).toContain('Playstyle: The Collector');
  });
});
