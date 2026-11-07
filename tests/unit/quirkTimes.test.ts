// Quirks at camp: lines for the hour and for festival days, by quirk category.
import { describe, expect, it } from 'vitest';
import quirkTimes from '../../src/data/quirkTimes.json';
import { campMoment, campQuirkLine } from '../../src/core/overhaul/quirkTimes';
import { overhaulCatalogs } from '../../src/core/overhaul/catalogs';
import { createRun } from '../../src/core/run';
import { content } from './helpers';

describe('camp quirk lines', () => {
  it('cover every quirk category for morning, evening, night and festival, with a name placeholder', () => {
    const cats = new Set(overhaulCatalogs().quirks.entries.map((q) => q.category));
    for (const c of cats) for (const m of ['morning', 'evening', 'night', 'festival']) {
      const line = (quirkTimes.lines as Record<string, Record<string, string>>)[c]?.[m];
      expect(line, `${c}/${m}`).toBeTruthy();
      expect(line).toContain('{Name}');
    }
  });

  it('picks the moment from the clock (festival on a new season, none in the afternoon) and is repeatable', () => {
    const run = createRun(content, { runId: 'qt', seed: 'qt', archetypeId: 'red' });
    run.clock.day = 2; run.clock.tick = 0;
    expect(campMoment(content, run)).toBe('morning');
    run.clock.tick = 1;
    expect(campMoment(content, run)).toBeNull();
    run.clock.day = 1 + content.balance.clock.seasonLength; run.clock.tick = 1;
    expect(campMoment(content, run)).toBe('festival');
    const name = (m: { speciesId: string }) => m.speciesId;
    const party = Array.from({ length: 6 }, (_, i) => ({ uid: `u${i}`, nature: 'hardy' as const, speciesId: 'pikachu' }));
    const lines = Array.from({ length: 20 }, (_, i) => campQuirkLine(party, 'night', `k${i}`, name));
    expect(lines.some(Boolean)).toBe(true);
    expect(lines).toEqual(Array.from({ length: 20 }, (_, i) => campQuirkLine(party, 'night', `k${i}`, name)));
    for (const l of lines) if (l) expect(l).not.toMatch(/[{}]/);
    expect(campQuirkLine(party, null, 'k', name)).toBeNull();
  });
});
