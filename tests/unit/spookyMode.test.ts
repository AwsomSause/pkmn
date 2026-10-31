import { describe, expect, it } from 'vitest';
import { eligibleEvents } from '../../src/core/events';
import { modeBattleLine, modeObjectives, objectivesLine } from '../../src/core/modeObjectives';
import { createRun, chooseStarter, shopStock } from '../../src/core/run';
import { makeRules, STANDARD_CHOICE } from '../../src/core/rules';
import { content } from './helpers';

const spooky = (seed = 'sp') => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', rules: makeRules({ ...STANDARD_CHOICE, modeId: 'spooky' }) }), 0);
const standard = (seed = 'st') => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0);

describe('Spooky Mode content', () => {
  it('its events only appear in Spooky Mode, and the boss and finale wait for clues', () => {
    const ids = (r: ReturnType<typeof spooky>) => eligibleEvents(content, { ...r, stage: r.stage } as never).map((e) => e.id);
    const run = spooky();
    run.stage!.index = 5;
    expect(ids(run)).toContain('spooky-hollow-lantern');
    expect(ids(run)).not.toContain('spooky-hexed-keeper');
    run.story.flags['ev:spooky-clue'] = 2;
    expect(ids(run)).toContain('spooky-hexed-keeper');
    expect(ids(run)).not.toContain('spooky-hollow-mirror');
    run.story.flags['ev:spooky-clue'] = 3;
    run.story.flags['ev:spooky-keeper'] = 1;
    expect(ids(run)).toContain('spooky-hollow-mirror');
    const other = standard();
    other.stage!.index = 5;
    expect(ids(other).filter((id) => content.events.get(id)!.mode === 'spooky')).toEqual([]);
  });
  it('the mode shop carries its extra stock only in Spooky Mode', () => {
    const extra = content.balance.modeShops.spooky!.map((e) => e.item);
    const have = (r: ReturnType<typeof spooky>) => shopStock(content, { ...r, badges: Array.from({ length: 8 }, (_, i) => `b${i}`) } as never).map((e) => e.item);
    for (const item of extra) expect(have(spooky()), item).toContain(item);
    expect(have(standard()).filter((i) => extra.includes(i) && !content.shop.some((e) => e.item === i))).toEqual([]);
  });
  it('objectives come from the run counters and only exist in the mode', () => {
    expect(modeObjectives(standard())).toEqual([]);
    const run = spooky();
    expect(modeObjectives(run).every((o) => !o.done)).toBe(true);
    run.log.counters.eventClues = 5;
    run.log.counters.eventBossesWon = 1;
    const list = modeObjectives(run);
    expect(list[1]).toMatchObject({ current: 3, target: 3, done: true });
    expect(list[2]!.done).toBe(true);
    expect(objectivesLine(list)).toContain('✓ Collect three clues');
  });
  it('battle lines exist for the mode only', () => {
    expect(modeBattleLine('spooky', false)).toBeTruthy();
    expect(modeBattleLine('spooky', true)).not.toBe(modeBattleLine('spooky', false));
    expect(modeBattleLine('standard', false)).toBeNull();
  });
});
