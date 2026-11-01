// The run clock (spec §28) and Camp's time-of-day choices (spec §22).

import { describe, expect, it } from 'vitest';
import { advanceClock, celebrateToday, freshClock, milestoneToday, periodOf, restUntilMorning } from '../../src/core/clock';
import { chooseEvent, conditionMet, eventView } from '../../src/core/events';
import { nextChoices } from '../../src/core/map';
import { chooseNode, chooseStarter, createRun } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { SaveManager, MIGRATIONS, CURRENT_VERSIONS } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const newRun = (): RunState => chooseStarter(content, createRun(content, { runId: 'r', seed: 'clock', archetypeId: 'red' }), 0);

/** Stands the run on a node with this event beside it. */
function atEvent(run: RunState, eventId: string): RunState {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  node.sides.push({ id: 'test-event', kind: 'event', used: false, eventId });
  return run;
}

describe('run clock', () => {
  it('starts on day 1, morning', () => {
    expect(newRun().clock).toEqual({ day: 1, tick: 0, celebrated: [] });
  });

  it('rolls over to a new day after four parts', () => {
    const run = newRun();
    advanceClock(run, 3);
    expect([run.clock.day, periodOf(run)]).toEqual([1, 'night']);
    advanceClock(run, 1);
    expect([run.clock.day, periodOf(run)]).toEqual([2, 'morning']);
    advanceClock(run, 9);
    expect([run.clock.day, run.clock.tick]).toEqual([4, 1]);
  });

  it('moves one part per step on the map, and never with the real clock', () => {
    const run = newRun();
    const before = structuredClone(run.clock);
    const node = nextChoices(run.stage!)[0]!;
    const after = chooseNode(content, run, node.id);
    expect(after.clock.tick).toBe(before.tick + content.balance.clock.ticksPerStep);
    expect(run.clock).toEqual(before); // the old state is untouched
  });

  it('a night of rest begins the next day', () => {
    const run = newRun();
    advanceClock(run, 2);
    restUntilMorning(run);
    expect([run.clock.day, run.clock.tick]).toEqual([2, 0]);
  });

  it('milestone days pay once', () => {
    const run = newRun();
    expect(milestoneToday(content, run)).toBe(false);
    run.clock.day = content.balance.clock.milestoneDays[0]!;
    expect(milestoneToday(content, run)).toBe(true);
    celebrateToday(run);
    celebrateToday(run);
    expect(run.clock.celebrated).toHaveLength(1);
    expect(milestoneToday(content, run)).toBe(false);
  });
});

describe('camp by the hour', () => {
  it('time-of-day choices open and close with the period', () => {
    const run = atEvent(newRun(), 'camp-party');
    const view = (r: RunState) => eventView(content, r, 'test-event').choices.map((c) => !c.locked);
    expect(view(run)).toEqual([true, false, false, true]); // morning play and a talk
    run.clock.tick = 3;
    expect(view(run)).toEqual([false, false, true, true]); // stories by the fire at night
    expect(conditionMet(content, run, { kind: 'period', in: ['night'] })).toBe(true);
  });

  it('the milestone celebration needs a milestone day, and is held once', () => {
    const run = atEvent(newRun(), 'camp-prepare');
    expect(() => chooseEvent(content, run, 'test-event', 3)).toThrow();
    run.clock.day = 7;
    const done = chooseEvent(content, run, 'test-event', 3).run;
    expect(done.clock.celebrated).toEqual([7]);
    const again = atEvent(structuredClone(done), 'camp-prepare');
    expect(() => chooseEvent(content, again, 'test-event', 3)).toThrow();
  });
});

describe('saves', () => {
  it('round-trips the clock', () => {
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    const run = newRun();
    advanceClock(run, 6);
    run.clock.celebrated.push(7);
    expect(saves.saveRun(run)).toEqual({ ok: true });
    expect(saves.loadRun()).toEqual({ status: 'ok', data: run });
  });

  it('a version 27 run opens at day 1', () => {
    const { clock: _c, ...old } = newRun();
    const migrated = MIGRATIONS.run[27]!(old as never);
    expect(RunStateSchema.parse(migrated).clock).toEqual(freshClock());
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(28);
  });
});
