// The Rival Who Wins Without You (left-out plan 5.5): contenders climb to Gym Leader, finalist and
// Champion off-screen, then stand in for that boss once in a later stage.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun, startEncounter } from '../../src/core/run';
import { markTakeover, promoteRival, takeoverRival } from '../../src/core/rivals/promotion';
import type { Rival } from '../../src/core/story/schema';
import { content } from './helpers';

const rival = (over: Partial<Rival> = {}): Rival =>
  ({
    id: 'r1', classId: 'youngster', name: 'Joey', archetype: 'x', style: 'y', rivalPotential: 90, state: 'contender', encounters: 3, setbacks: 0, away: 0, cooldown: 0, progress: 3, bonds: {}, offscreen: [], adaptations: [],
    arc: null, origin: { eventId: 'e', where: { region: 0, stage: 1, turn: 0 }, path: 'p' },
    traits: { empathy: 50, vindictiveness: 30, resilience: 50, pride: 40, ambition: 80, adaptability: 50 },
    memory: { lastBattle: { eventId: 'e', result: 'win', hpLeftShare: 0.5, turns: 6, team: ['rattata', 'pidgey'] } },
    ...over,
  }) as unknown as Rival;

const newRun = () => chooseStarter(content, createRun(content, { runId: 'rp', seed: 'rp', archetypeId: 'red' }), 0);

/** Promotes `r` at the first stage key whose seeded roll passes. */
function promote(run: ReturnType<typeof newRun>, r: Rival): string {
  for (let i = 0; i < 40; i++) {
    const rumour = promoteRival(content, run, r, `0.${i}`);
    if (rumour) return rumour;
  }
  throw new Error('never promoted');
}

describe('The Rival Who Wins Without You', () => {
  it('a contender with enough progress climbs to Gym Leader, then waits until it has shown up before climbing again', () => {
    const run = newRun();
    const r = rival();
    run.story.rivals = [r];
    expect(promote(run, r)).toContain('took over a Gym');
    expect(r.rank).toBe('gymLeader');
    for (let i = 0; i < 40; i++) promoteRival(content, run, r, `1.${i}`);
    expect(r.rank).toBe('gymLeader'); // not yet seen in its new role
    markTakeover(run, r);
    expect(promote(run, r)).toContain('regional finals');
    markTakeover(run, r);
    expect(promote(run, r)).toContain('became Champion');
  });

  it('needs to be a contender with the progress for the next rank; only one rival Champion per run', () => {
    const run = newRun();
    const low = rival({ state: 'recurring' });
    const slow = rival({ id: 'r2', progress: 0 });
    run.story.rivals = [low, slow, rival({ id: 'champ', rank: 'champion' }), rival({ id: 'r4', rank: 'finalist' })];
    for (let i = 0; i < 40; i++) {
      promoteRival(content, run, low, `0.${i}`);
      promoteRival(content, run, slow, `0.${i}`);
    }
    expect(low.rank).toBeUndefined();
    expect(slow.rank).toBeUndefined();
    const finalist = run.story.rivals[3]!;
    run.story.flags['takeover:r4:finalist'] = 'done';
    for (let i = 0; i < 40; i++) promoteRival(content, run, finalist, `0.${i}`);
    expect(finalist.rank).toBe('finalist');
  });

  it('active rivals and nemeses may climb too, not only contenders', () => {
    for (const state of ['active', 'nemesis'] as const) {
      const run = newRun();
      const r = rival({ state });
      run.story.rivals = [r];
      expect(promote(run, r)).toContain('took over a Gym');
    }
  });

  it('stands in for the next boss of its rank in a later stage, keeping the boss role', () => {
    const run = structuredClone(newRun());
    const r = rival();
    run.story.rivals = [r];
    promote(run, r);
    run.story.flags['takeover:r1:gymLeader'] = '9.9'; // promoted in another stage
    expect(takeoverRival(run, 'elite')).toBeNull();
    expect(takeoverRival(run, 'gym')?.id).toBe('r1');
    const node = { ...run.stage!.map.nodes.find((n) => n.column === 1)!, kind: 'gym' as const };
    startEncounter(content, run, node);
    expect(run.battle?.rivalId).toBe('r1');
    expect(run.battle?.trainer).toMatchObject({ name: 'Joey' });
    expect(run.battle?.trainer?.leaderId).toBeTruthy();
    expect(run.battle?.rivalNote).toContain('leads it now');
    expect(takeoverRival(run, 'gym')).toBeNull(); // once
  });
});
