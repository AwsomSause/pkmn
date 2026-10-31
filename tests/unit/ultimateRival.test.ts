// The Ultimate Rival presentation (left-out 5.6): emblem and battle intro, quest chain, Previous Ultimate Rivals.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { rivalChronicle } from '../../src/core/rivals/chronicle';
import { pastUltimateRivals } from '../../src/core/rivals/legacy';
import { RIVAL_CONFIG } from '../../src/core/rivals/schema';
import { evaluateUltimate, everUltimateFlag, isUltimateBattle, settleUltimateQuest, ultimateDoneFlag, ultimateQuest } from '../../src/core/rivals/ultimate';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { ArchivedRivalSchema, type Rival } from '../../src/core/story/schema';
import { content } from './helpers';

const traits = { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 };
function rival(id: string, over: Partial<Rival> = {}): Rival {
  return {
    id, classId: 'youngster', name: id, archetype: 'proud', style: 'rush', traits: { ...traits }, rivalPotential: 10, state: 'recurring', arc: null, away: 0, cooldown: 0, progress: 0,
    encounters: 3, setbacks: 0, adaptations: [], bonds: {}, offscreen: [], origin: { eventId: `e-${id}`, where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'spark' },
    memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 0.8, turns: 5, team: ['rattata'] } }, ...over,
  } as Rival;
}
function runWith(rivals: Rival[]): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ult', seed: 'ult', archetypeId: 'red' }), 0));
  run.story.rivals = rivals;
  return run;
}

describe('Ultimate Rival presentation', () => {
  it('marks the rival battle against the Ultimate Rival, not other rivals', () => {
    const run = runWith([rival('u'), rival('other', { encounters: 0 })]);
    expect(evaluateUltimate(run)?.id).toBe('u');
    expect(run.story.flags[everUltimateFlag('u')]).toBe(true);
    run.battle = createBattle('trainer', [createPokemon(content, 'rattata', 5, 'e1')], 0, run.party[0]!.uid, { classId: 'youngster', name: 'u', leaderId: null });
    expect(isUltimateBattle(run)).toBe(false);
    run.battle.rivalId = 'other';
    expect(isUltimateBattle(run)).toBe(false);
    run.battle.rivalId = 'u';
    expect(isUltimateBattle(run)).toBe(true);
  });

  it('walks the quest chain and pays its reward exactly once', () => {
    const run = runWith([rival('u')]);
    evaluateUltimate(run);
    const r = run.story.rivals[0]!;
    expect(ultimateQuest(run, r).map((s) => s.done)).toEqual([true, false, false]);
    expect(settleUltimateQuest(content, run, r)).toBe(false);
    run.story.flags['rivalW:u'] = 1;
    expect(ultimateQuest(run, r).map((s) => s.done)).toEqual([true, true, false]);
    run.story.flags['rivalW:u'] = RIVAL_CONFIG.ultimate.quest.settleWins;
    const money = run.money;
    expect(settleUltimateQuest(content, run, r)).toBe(true);
    expect(run.money).toBe(money + RIVAL_CONFIG.ultimate.quest.money);
    expect(run.story.flags[ultimateDoneFlag('u')]).toBe(true);
    expect(settleUltimateQuest(content, run, r)).toBe(false);
    expect(run.money).toBe(money + RIVAL_CONFIG.ultimate.quest.money);
  });

  it('ending the rivalry (an ally) also settles the quest, and a never-chosen rival has none', () => {
    const run = runWith([rival('u'), rival('x', { encounters: 0 })]);
    evaluateUltimate(run);
    run.story.flags['rivalW:u'] = 1;
    run.story.rivals[0]!.state = 'ally';
    expect(settleUltimateQuest(content, run, run.story.rivals[0]!)).toBe(true);
    expect(settleUltimateQuest(content, run, run.story.rivals[1]!)).toBe(false);
    const lines = rivalChronicle(content, run);
    expect(lines[0]!.quest.every((s) => s.done)).toBe(true);
    expect(lines[1]!.quest).toEqual([]);
  });

  it('archives the Ultimate Rival as a Previous Ultimate Rival on the account', () => {
    const run = runWith([rival('u'), rival('plain', { encounters: 3, rivalPotential: 0, state: 'ally' })]);
    evaluateUltimate(run);
    run.phase = 'over';
    const { profile } = finalizeRun(content, createProfile(content, 'p1'), run);
    const archived = profile.rivalArchive.find((a) => a.name === 'u')!;
    expect(archived.ultimate).toBe(true);
    expect(ArchivedRivalSchema.parse(archived)).toEqual(archived);
    expect(profile.rivalArchive.find((a) => a.name === 'plain')?.ultimate).toBeUndefined();
    expect(pastUltimateRivals(profile).map((a) => a.name)).toEqual(['u']);
  });

  it('older archive entries without the flag still load and are not listed', () => {
    const old = { runId: 'r0', name: 'Old', classId: 'youngster', archetype: 'proud', style: 'rush', traits, state: 'nemesis', encounters: 2, resolution: null };
    expect(ArchivedRivalSchema.safeParse(old).success).toBe(true);
    expect(pastUltimateRivals({ rivalArchive: [ArchivedRivalSchema.parse(old)] })).toEqual([]);
  });
});
