// The Pokémon summary (Visual Bible V4 party/detail): what each page shows.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { openHistory } from '../../src/core/story/record';
import { STAT_LABELS, summaryInfo } from '../../src/ui/summaryLook';
import { content } from './helpers';

const newRun = () => structuredClone(chooseStarter(content, createRun(content, { runId: 'sum', seed: 'summary-screen', archetypeId: 'red' }), 0));

describe('Pokémon summary', () => {
  it('shows types, ability, all six stats and every move with its type, category and PP', () => {
    const run = newRun();
    const mon = run.party[0]!;
    const info = summaryInfo(content, run, mon);
    expect(info.types.length).toBeGreaterThanOrEqual(1);
    expect(info.ability?.name).toBeTruthy();
    expect(info.stats.map((s) => s.label)).toEqual(Object.values(STAT_LABELS));
    for (const s of info.stats) expect(s.value).toBeGreaterThan(0);
    expect(info.moves).toHaveLength(mon.moves.length);
    for (const m of info.moves) {
      expect(content.moves.get(m.id)!.type).toBe(m.type);
      expect(m.pp).toMatch(/^\d+\/\d+$/);
    }
  });

  it('lists held items and marks stats raised by vitamins', () => {
    const run = newRun();
    const mon = run.party[0]!;
    const itemId = [...content.items.keys()][0]!;
    mon.held = { [itemId]: 2 };
    mon.vitamins = { ...mon.vitamins, atk: 1 };
    const info = summaryInfo(content, run, mon);
    expect(info.held).toEqual([expect.objectContaining({ id: itemId, count: 2 })]);
    expect(info.stats.find((s) => s.key === 'atk')!.boosted).toBe(true);
    expect(info.stats.find((s) => s.key === 'def')!.boosted).toBe(false);
  });

  it('tells its story this run: record and its most memorable moments first', () => {
    const run = newRun();
    const mon = run.party[0]!;
    const h = openHistory(content, run, mon.uid, mon.speciesId, 'starter');
    h.battles = 3;
    h.knockoutsDealt = 1;
    const where = h.joinedAt;
    h.memories = [
      { eventId: 'a', seq: 1, type: h.memories[0]?.type ?? ('battleWon' as never), importance: 10, text: 'small', where, emotions: [] },
      { eventId: 'b', seq: 2, type: h.memories[0]?.type ?? ('battleWon' as never), importance: 90, text: 'big', where, emotions: [] },
    ];
    const info = summaryInfo(content, run, mon);
    expect(info.record).toBe('3 battles · 1 KO');
    expect(info.memories[0]).toBe('big');
    // Outside a run there is no story to show.
    expect(summaryInfo(content, null, mon).record).toBeNull();
  });
});
