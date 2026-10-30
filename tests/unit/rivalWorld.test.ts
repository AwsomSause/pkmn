// Rival world systems: sponsors, factions, debts and the 17 paths that depend on them.

import { describe, expect, it } from 'vitest';
import { RIVAL_PATHS, RIVAL_WORLD } from '../../src/core/rivals/schema';
import { maybeSpark, type SparkInput } from '../../src/core/rivals/manager';
import { factionStanding, hostileFactions, onBossBeaten, onRivalDefeated, owesPlayer, pathContext, playerDebts, rivalDebtLevels, type PathContext } from '../../src/core/rivals/standing';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { StoryStateSchema } from '../../src/core/story/schema';
import { content } from './helpers';

const where = { region: 1, stage: 1, level: 1, node: null, battle: 1, turn: null };
const baseRun = (seed: string): RunState => structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
const NO: PathContext = { sponsored: false, openDebt: false, leaguePatron: false, hostileFaction: false, hasAlly: false, hasRival: false, mentorRival: false, legacy: false, crisis: false, sharedSpecies: false, copiesYou: false, devotedBond: false, bosses: 0 };
const input = (ctx: PathContext, over: Partial<SparkInput> = {}): SparkInput => ({
  where, classId: 'youngster', name: 'J', team: ['rattata'], ended: { id: 'pw#9', seq: 9, type: 'battleEnded', where, actors: [], data: {} }, hpLeftShare: 0.2, turns: 6, flawless: true, ctx, ...over,
});
function seen(ctx: PathContext, over: Partial<SparkInput> = {}, second = false): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const run = baseRun(`pw-${i}`);
    if (second) run.story.rivals = [maybeSpark(baseRun(`first-${i}`), input(NO, { ended: { ...input(NO).ended, id: `f-${i}#1` } }))!];
    const rival = maybeSpark(run, input(ctx, { ended: { ...input(ctx).ended, id: `pw-${i}#9` }, ...over }));
    if (rival) out.add(rival.origin.path);
  }
  return out;
}

describe('the 17 world paths', () => {
  const cases: Array<[string, Partial<PathContext>, Partial<SparkInput>?, boolean?]> = [
    ['stolen-spotlight', { sponsored: true }],
    ['debt', { openDebt: true }],
    ['assigned-opponent', { leaguePatron: true }],
    ['pok-mon-league-prospect', { bosses: 2 }],
    ['chosen-successor', { bosses: 1 }, {}, true],
    ['mutual-enemy', { hostileFaction: true }],
    ['former-friend', { hasAlly: true }],
    ['rival-s-rival', { hasRival: true }],
    ['shared-mentor', { mentorRival: true }],
    ['inherited-conflict', { legacy: true }],
    ['shared-disaster', { crisis: true }],
    ['accidental-hero', { crisis: true }, { hpLeftShare: 0.95, turns: 3 }],
    ['pok-mon-who-remembers', { sharedSpecies: true }],
    ['rival-you-inspired', { copiesYou: true }],
    ['pok-mon-s-choice', { devotedBond: true }],
    ['regional-idealist', {}],
    ['disgraced-champion-candidate', {}],
  ];
  for (const [id, ctx, over, second] of cases) {
    it(`${id} is reachable from its world state`, () => {
      expect(seen({ ...NO, ...ctx }, over, second), id).toContain(id);
    });
  }
  it('every path is in the data and the world context alone never changes a quiet start', () => {
    for (const [id] of cases) expect(RIVAL_PATHS.paths.map((p) => p.id)).toContain(id);
    expect(seen(NO, { where: { ...where, region: 0 } }).has('stolen-spotlight')).toBe(false);
  });
});

describe('sponsors, factions and debts', () => {
  it('old saves without standing load with an empty one', () => {
    const story = StoryStateSchema.parse({ seq: 0, events: [], histories: {}, relationships: [], enemyProfiles: [], rivals: [], chronicle: [], appliedEffects: [], flags: {}, majorCuesThisBattle: 0 });
    expect(story.standing).toEqual({ sponsor: null, factions: {}, bosses: 0, debts: [] });
  });

  it('the first boss win signs a sponsor with an advance, later wins pay a stipend, and the advance is called in', () => {
    const run = baseRun('sponsor');
    const money = run.money;
    onBossBeaten(content, run, where, 'b1');
    const st = run.story.standing;
    const sponsor = RIVAL_WORLD.sponsors.find((s) => s.id === st.sponsor!.id)!;
    expect(run.money).toBe(money + sponsor.advance);
    expect(playerDebts(run)).toHaveLength(1);
    expect(factionStanding(run, 'league')).toBe(RIVAL_WORLD.standing.bossLeague);
    onBossBeaten(content, run, where, 'b1'); // the same battle never pays twice
    expect(st.bosses).toBe(1);
    onBossBeaten(content, run, where, 'b2');
    expect(run.money).toBe(money + sponsor.advance + sponsor.stipend);
    onBossBeaten(content, run, where, 'b3'); // the advance is due after 2 more boss wins
    expect(playerDebts(run)).toHaveLength(0);
    expect(run.money).toBe(money + sponsor.advance + sponsor.stipend * 2 - sponsor.advance);
  });

  it('the sponsor and the debt come from the seed only', () => {
    const a = baseRun('same');
    const b = baseRun('same');
    onBossBeaten(content, a, where, 'x');
    onBossBeaten(content, b, where, 'x');
    expect(a.story.standing).toEqual(b.story.standing);
  });

  it('fighting a syndicate-hostile world turns a faction hostile after enough boss wins', () => {
    const run = baseRun('hostile');
    for (let i = 0; i < 4; i++) onBossBeaten(content, run, where, `h${i}`);
    expect(hostileFactions(run)).toContain('syndicate');
  });

  it('a spared rival owes a favour, goes easy once, and the favour is closed after the next win', () => {
    const run = baseRun('favour');
    const rival = maybeSpark(run, input(NO, { hpLeftShare: 0.95, turns: 3 }))!;
    onRivalDefeated(content, run, rival, 'ally', where);
    expect(owesPlayer(run, rival)).toBe(true);
    expect(rivalDebtLevels(run, rival)).toBe(-RIVAL_WORLD.debts.owedToPlayerLevels);
    onRivalDefeated(content, run, rival, 'grew', where);
    expect(owesPlayer(run, rival)).toBe(false);
    rival.sponsor = 'silph-co';
    expect(rivalDebtLevels(run, rival)).toBe(RIVAL_WORLD.debts.sponsorRivalLevels);
  });

  it('pathContext reads the world', () => {
    const run = baseRun('ctx');
    onBossBeaten(content, run, where, 'c1');
    const ctx = pathContext(content, run, { where, team: ['rattata'], hpLeftShare: 0.5, turns: 5 });
    expect(ctx.sponsored).toBe(true);
    expect(ctx.openDebt).toBe(true);
    expect(ctx.bosses).toBe(1);
    expect(ctx.legacy).toBe(false);
  });
});
