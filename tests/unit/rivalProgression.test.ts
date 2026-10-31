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

describe('world recognition (§5.1-5.3), signature aces (§8.3), rivalries (§8.4), titles (§8.5)', () => {
  it('NPC lines follow the rival status and are stable for the same key', async () => {
    const { npcSituation, npcWorldLine, RECOGNITION } = await import('../../src/core/rivals/recognition');
    const { run, id } = withRival('rec-a');
    expect(npcSituation(content, run)).toBeNull();
    const r = rivalOf(run, id);
    rivalProgress(content, run, r, 'unseenWin');
    rivalProgress(content, run, r, 'badge');
    expect(npcSituation(content, run)?.situation).toBe('gymWin');
    rivalProgress(content, run, r, 'lostToPlayer');
    expect(npcSituation(content, run)?.situation).toBe('playerBeatRival');
    let said = 0;
    for (let i = 0; i < 200; i++) {
      const line = npcWorldLine(content, run, `k${i}`);
      expect(npcWorldLine(content, run, `k${i}`)).toBe(line);
      if (line) said += 1;
    }
    // Rare but present (npcChance).
    expect(said).toBeGreaterThan(0);
    expect(said).toBeLessThan(200 * (RECOGNITION.npcChance + 0.15));
  });

  it('headlines, posters and the Champion board follow the record', async () => {
    const { worldBoards, topHeadline } = await import('../../src/core/rivals/recognition');
    const { run, id } = withRival('rec-b');
    expect(topHeadline(content, run)).toBeNull();
    const r = rivalOf(run, id);
    rivalProgress(content, run, r, 'unseenWin');
    rivalProgress(content, run, r, 'badge');
    expect(topHeadline(content, run)).toMatch(/badge/);
    r.rank = 'champion';
    const kinds = worldBoards(content, run).map((b) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['poster', 'championBoard', 'headline', 'leaderboard']));
  });

  it('sightings happen at most once per stage, replay identically, and give the found item once', async () => {
    const { rivalSighting } = await import('../../src/core/rivals/recognition');
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const { run, id } = withRival(`rec-s${i}`);
      rivalProgress(content, run, rivalOf(run, id), 'unseenWin');
      // The stage start already asked (before any rival existed).
      delete run.story.flags['rivalSighting:0.0'];
      const twin = structuredClone(run);
      const a = rivalSighting(content, run);
      expect(rivalSighting(content, twin)).toBe(a);
      expect(rivalSighting(content, run)).toBeNull();
      expect(run.inventory).toEqual(twin.inventory);
      if (a) seen += 1;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('the ace is the first Pokémon and is sent out last', async () => {
    const { ensureAce, withSignatureAce } = await import('../../src/core/rivals/signatureTeam');
    const { run, id } = withRival('sig-a');
    const r = rivalOf(run, id);
    r.memory.lastBattle.team = ['pidgey', 'rattata'];
    expect(ensureAce(content, r)).toBe('pidgey');
    const info = { base: 1, progress: 0, variance: 0, archetypeOffset: 0, bonus: 0, unclamped: 1, level: 1 };
    const plan = { classId: 'youngster', name: 'Joey', leaderId: null, ai: 0, members: [{ speciesId: 'pidgeotto', level: 20 }, { speciesId: 'raticate', level: 21 }], levelInfo: [{ ...info, level: 20 }, { ...info, level: 21 }] };
    const out = withSignatureAce(content, r, plan);
    expect(out.members.map((m) => m.speciesId)).toEqual(['raticate', 'pidgeotto']);
    expect(out.levelInfo.map((l) => l.level)).toEqual([21, 20]);
    expect(withSignatureAce(content, { ...r, ace: 'zubat' }, plan)).toBe(plan);
  });

  it('enemies duel off-screen through the record; a far-ahead rival brings a team-up once', async () => {
    const { rivalRivalries, rivalTeamUp } = await import('../../src/core/rivals/rivalries');
    let duels = 0;
    for (let i = 0; i < 30; i++) {
      const { run, id } = withRival(`riv-${i}`);
      const other = maybeSpark(run, input(`riv-${i}#other`)) ?? maybeSpark(run, input(`riv-${i}#other2`));
      if (!other) continue;
      run.story.rivalGraph.push({ a: id, b: other.id, kind: 'enemies' });
      rivalRivalries(content, run);
      expect(rivalRivalries(content, run)).toBeNull();
      const a = rivalOf(run, id).world;
      const b = other.world;
      if (a || b) {
        duels += 1;
        expect((a?.wins ?? 0) + (b?.wins ?? 0)).toBe(1);
      }
      rivalProgress(content, run, rivalOf(run, id), 'setPace', { lead: 3 });
      expect(rivalTeamUp(content, run, rivalOf(run, id))).toMatch(/joins forces/);
      expect(rivalTeamUp(content, run, rivalOf(run, id))).toBeNull();
    }
    expect(duels).toBeGreaterThan(0);
  });

  it('Protagonist titles rise with your record and are announced once', async () => {
    const { noteProtagonistTitle, protagonistTitle, FALSE_PROTAGONIST_FLAG } = await import('../../src/core/rivals/recognition');
    const { run, id } = withRival('title-a');
    expect(protagonistTitle(run).id).toBe('nobody');
    run.badges = ['a', 'b', 'c'];
    expect(protagonistTitle(run).id).toBe('risingStar');
    run.badges.push('d');
    expect(protagonistTitle(run).id).toBe('regionalChallenger');
    run.story.flags[`rivalW:${id}`] = 4;
    expect(protagonistTitle(run).id).toBe('rivalsNightmare');
    const before = run.story.chronicle.length;
    noteProtagonistTitle(content, run);
    noteProtagonistTitle(content, run);
    expect(run.story.chronicle.length).toBe(before + 1);
    run.regionsCleared = [...run.regionOrder];
    expect(protagonistTitle(run).id).toBe('unwrittenLegend');
    run.story.flags[FALSE_PROTAGONIST_FLAG] = true;
    expect(protagonistTitle(run).name).toBe('The False Protagonist');
  });
});
