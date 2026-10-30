import { describe, expect, it } from 'vitest';
import { claimCollectionMilestones, collectionSets, MILESTONE_PAY, researchTotals, setProgress } from '../../src/core/collection';
import { createProfile } from '../../src/core/profile';
import { content } from './helpers';

describe('collection sets (catalog #105, #112)', () => {
  const sets = collectionSets(content);
  it('builds generation and form sets with no empty or overlapping members', () => {
    expect(sets.length).toBeGreaterThanOrEqual(9);
    const seen = new Set<string>();
    for (const s of sets) {
      expect(s.members.length, s.id).toBeGreaterThan(0);
      for (const m of s.members) { expect(seen.has(m), m).toBe(false); seen.add(m); }
    }
  });
  it('pays each milestone once', () => {
    const p = createProfile(content, 'p');
    const gen1 = sets.find((s) => s.id === 'gen:1')!;
    p.speciesCaught = gen1.members.slice(0, Math.ceil(gen1.members.length * 0.3));
    const before = p.researchPoints;
    const first = claimCollectionMilestones(content, p, '2026-10-30T00:00:00Z');
    expect(first.some((x) => x.pct === 25)).toBe(true);
    expect(p.researchPoints - before).toBe(first.reduce((n, x) => n + x.researchPoints, 0));
    expect(first[0]!.researchPoints).toBe(MILESTONE_PAY[0]);
    expect(claimCollectionMilestones(content, p, '2026-10-30T00:00:00Z')).toEqual([]);
    expect(setProgress(gen1, p).caught).toBe(p.speciesCaught.length);
  });
  it('a finished set earns a title once', () => {
    const p = createProfile(content, 'p');
    const set = sets[0]!;
    p.speciesCaught = [...set.members];
    claimCollectionMilestones(content, p, '2026-10-30T00:00:00Z');
    claimCollectionMilestones(content, p, '2026-10-30T00:00:00Z');
    expect(p.titles.filter((t) => t === `Complete: ${set.name}`)).toHaveLength(1);
  });
  it('totals start at zero', () => {
    expect(researchTotals(content, createProfile(content, 'p'))).toMatchObject({ met: 0, caught: 0, evolved: 0, shinies: 0, shinySpecies: 0 });
  });
});

describe('Research Room shiny count', () => {
  it('records shiny species in the run and adds them to the profile once', async () => {
    const { chooseStarter, createRun } = await import('../../src/core/run');
    const { countShiny } = await import('../../src/core/progress');
    const { finalizeRun } = await import('../../src/core/profile');
    const run = chooseStarter(content, createRun(content, { runId: 'sr', seed: 'sr', archetypeId: 'red' }), 0);
    countShiny(run, 'pidgey');
    countShiny(run, 'pidgey');
    expect(run.log.counters.shiniesFound).toBe(2);
    const out = finalizeRun(content, createProfile(content, 'p'), { ...run, phase: 'over' as const });
    expect(out.profile.speciesShiny).toEqual(['pidgey']);
    expect(researchTotals(content, out.profile)).toMatchObject({ shinies: 2, shinySpecies: 1 });
  });
});
