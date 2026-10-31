// Rival world progression (M11): the rivalProgress event, the record it writes, and the status it implies.

import { describe, expect, it } from 'vitest';
import { maybeSpark, type SparkInput } from '../../src/core/rivals/manager';
import { leadingRival, rivalProgress, rivalStatus, rivalWorldView } from '../../src/core/rivals/progression';
import { RIVAL_CONFIG } from '../../src/core/rivals/schema';
import { simulateRivalWorld } from '../../src/core/rivals/world';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { RivalSchema } from '../../src/core/story/schema';
import { content } from './helpers';

const where = { region: 0, stage: 1, level: 1, node: null, battle: 1, turn: null };
const NO = { sponsored: false, openDebt: false, leaguePatron: false, hostileFaction: false, hasAlly: false, hasRival: false, mentorRival: false, legacy: false, crisis: false, sharedSpecies: false, copiesYou: false, devotedBond: false, bosses: 0 };
const input = (id: string): SparkInput => ({
  where, classId: 'youngster', name: 'Joey', team: ['rattata'], ended: { id, seq: 9, type: 'battleEnded', where, actors: [], data: {} }, hpLeftShare: 0.2, turns: 6, flawless: true, ctx: NO,
});

function withRival(seed: string): { run: RunState; id: string } {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  for (let i = 0; i < 50; i++) {
    const r = maybeSpark(run, input(`${seed}#${i}`));
    if (r) return { run, id: r.id };
  }
  throw new Error('no rival sparked');
}
const rivalOf = (run: RunState, id: string) => run.story.rivals.find((r) => r.id === id)!;

describe('rival progression record', () => {
  it('starts traveling with no record', () => {
    const { run, id } = withRival('prog-a');
    expect(rivalOf(run, id).world).toBeUndefined();
    expect(rivalStatus(run, rivalOf(run, id))).toBe('traveling');
  });

  it('unseen wins move it ahead, badges make a Gym Victor, then a Champion Candidate', () => {
    const { run, id } = withRival('prog-b');
    const r = rivalOf(run, id);
    rivalProgress(content, run, r, 'unseenWin');
    expect(r.world).toMatchObject({ lead: 1, wins: 1, fame: RIVAL_CONFIG.progression.fame.unseenWin });
    expect(rivalStatus(run, r)).toBe('ahead');
    rivalProgress(content, run, r, 'badge');
    expect(rivalStatus(run, r)).toBe('gymVictor');
    for (let i = 1; i < RIVAL_CONFIG.progression.candidateBadges; i++) rivalProgress(content, run, r, 'badge');
    expect(rivalStatus(run, r)).toBe('championCandidate');
    r.rank = 'champion';
    expect(rivalStatus(run, r)).toBe('champion');
  });

  it('battles with you set the lead and mark it defeated this stage', () => {
    const { run, id } = withRival('prog-c');
    const r = rivalOf(run, id);
    for (let i = 0; i < 5; i++) rivalProgress(content, run, r, 'unseenWin');
    expect(r.world!.lead).toBe(RIVAL_CONFIG.progression.leadMax);
    rivalProgress(content, run, r, 'lostToPlayer');
    expect(r.world!.lead).toBe(-1);
    expect(rivalStatus(run, r)).toBe('defeated');
    rivalProgress(content, run, r, 'narrativeWin');
    expect(r.world!.lead).toBe(1);
    expect(r.world!.fame).toBeGreaterThanOrEqual(0);
  });

  it('boundaries: lead is clamped, fame never negative, milestones capped, unknown rivals ignored', () => {
    const { run, id } = withRival('prog-d');
    const r = rivalOf(run, id);
    for (let i = 0; i < 20; i++) rivalProgress(content, run, r, 'unseenLoss');
    expect(r.world!.lead).toBe(RIVAL_CONFIG.progression.leadMin);
    expect(r.world!.fame).toBe(0);
    expect(r.world!.milestones).toHaveLength(RIVAL_CONFIG.progression.milestonesKept);
    const before = structuredClone(run.story.rivals);
    rivalProgress(content, run, { ...r, id: 'nobody' }, 'unseenWin');
    expect(run.story.rivals).toEqual(before);
    expect(RivalSchema.parse(r)).toEqual(r);
  });

  it('setPace places a rival exactly (replayed timelines), and a new region resets badges', () => {
    const { run, id } = withRival('prog-e');
    const r = rivalOf(run, id);
    rivalProgress(content, run, r, 'setPace', { lead: 3, badges: RIVAL_CONFIG.progression.candidateBadges });
    expect(leadingRival(content, run)?.id).toBe(id);
    run.regionIndex += 1;
    rivalProgress(content, run, r, 'unseenWin');
    expect(r.world).toMatchObject({ badges: 0, regionsDone: 1, region: run.regionIndex });
  });

  it('missing while it sits out or after retiring', () => {
    const { run, id } = withRival('prog-f');
    const r = rivalOf(run, id);
    r.cooldown = 1;
    expect(rivalStatus(run, r)).toBe('missing');
  });

  it('the off-screen world feeds the record and replays identically', () => {
    const play = () => {
      const { run } = withRival('prog-g');
      for (let s = 0; s < 6; s++) {
        run.stage = { ...(run.stage ?? ({} as NonNullable<RunState['stage']>)), index: s } as NonNullable<RunState['stage']>;
        simulateRivalWorld(content, run);
      }
      return rivalWorldView(content, run);
    };
    const a = play();
    expect(a[0]!.wins + a[0]!.defeats).toBeGreaterThan(0);
    expect(play()).toEqual(a);
  });
});
