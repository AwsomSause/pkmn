import { describe, expect, it } from 'vitest';
import { createBattle, itemProblem, switchProblem } from '../../src/core/battle/engine';
import { MUTATORS, applyMutator, mutatorDue, mutatorOffer, mutatorMoney } from '../../src/core/mutators';
import { buryFallen, claimArea, isHardcore, nuzlockeCatchProblem, nuzlockeLevel } from '../../src/core/nuzlocke';
import { runLevelCap } from '../../src/core/regions';
import { chooseStarter, createRun } from '../../src/core/run';
import { getMode, makeRules, rewardMultiplier, rulesProblem, STANDARD_CHOICE } from '../../src/core/rules';
import { content } from './helpers';

const choice = (modeId: string) => ({ ...STANDARD_CHOICE, modeId });
const start = (modeId: string, seed = 'nz-1') => {
  const run = chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', rules: choice(modeId) }), 0);
  run.party.push({ ...structuredClone(run.party[0]!), uid: 'p-extra' });
  return run;
};
const wild = (run: ReturnType<typeof start>) => {
  run.battle = createBattle('wild', [structuredClone(run.party[0]!)], 0, run.party[0]!.uid);
  claimArea(run);
  return run.battle;
};

describe('Nuzlocke and Hardcore Nuzlocke', () => {
  it('are playable, bundle No Revives, pay extra and refuse Death-Block', () => {
    for (const id of ['nuzlocke', 'hardcore-nuzlocke']) {
      expect(rulesProblem(choice(id))).toBeNull();
      expect(makeRules(choice(id)).modifierIds).toContain('no-revives');
      expect(getMode(id)!.checkpoints).toBe(false);
      expect(rulesProblem({ ...choice(id), deathBlock: true })).toContain('Death-Block');
    }
    expect(makeRules(choice('hardcore-nuzlocke')).modifierIds).toContain('no-battle-items');
    expect(rewardMultiplier(choice('nuzlocke'))).toBeGreaterThan(rewardMultiplier(choice('standard')));
    expect(rewardMultiplier(choice('hardcore-nuzlocke'))).toBeGreaterThan(rewardMultiplier(choice('nuzlocke')));
    expect(nuzlockeLevel(makeRules(choice('standard')))).toBeNull();
    expect(isHardcore(makeRules(choice('hardcore-nuzlocke')))).toBe(true);
  });
  it('only the first wild Pokémon of an area can be caught', () => {
    const run = start('nuzlocke');
    const first = wild(run);
    expect(first.nuzlockeNoCatch).toBeUndefined();
    const second = wild(run);
    expect(second.nuzlockeNoCatch).toBe(true);
    expect(nuzlockeCatchProblem(second)).toContain('Nuzlocke');
    const ball = [...content.items.values()].find((i) => i.effect.kind === 'catch' && i.usableInBattle)!;
    run.inventory[ball.id] = 3;
    expect(itemProblem({ content, battle: second, party: run.party, inventory: run.inventory, catchBlocked: nuzlockeCatchProblem(second) }, ball.id)).toContain('Nuzlocke');
    // a new stage is a new area
    run.stage = { ...run.stage!, index: run.stage!.index + 1 };
    expect(wild(run).nuzlockeNoCatch).toBeUndefined();
  });
  it('standard runs never block a catch', () => {
    const run = start('standard');
    wild(run);
    expect(wild(run).nuzlockeNoCatch).toBeUndefined();
    expect(run.nuzlocke).toBeUndefined();
  });
  it('fainted Pokémon are lost for good and listed on the memorial; a whole fainted party is left for the wipe', () => {
    const run = start('nuzlocke');
    run.party[1]!.hp = 0;
    expect(buryFallen(content, run, 'lost to Brock')).toHaveLength(1);
    expect(run.party).toHaveLength(1);
    expect(run.nuzlocke!.memorial[0]).toMatchObject({ uid: 'p-extra', cause: 'lost to Brock' });
    run.party[0]!.hp = 0;
    expect(buryFallen(content, run, 'x')).toEqual([]);
    expect(run.party).toHaveLength(1);
    const plain = start('standard');
    plain.party[1]!.hp = 0;
    expect(buryFallen(content, plain, 'x')).toEqual([]);
    expect(plain.party).toHaveLength(2);
  });
  it('Hardcore drops the level-cap margin and forbids switching in trainer battles', () => {
    const normal = start('nuzlocke');
    const hard = start('hardcore-nuzlocke');
    expect(runLevelCap(content, hard)).toBeLessThan(runLevelCap(content, normal));
    const trainer = createBattle('trainer', [structuredClone(hard.party[0]!)], 0, hard.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null });
    expect(switchProblem({ battle: trainer, party: hard.party, setStyle: true }, 1)).toContain('Set style');
    expect(switchProblem({ battle: trainer, party: hard.party }, 1)).toBeNull();
  });
});

describe('Modifier Run', () => {
  it('asks every 5 completed encounters, with 3 different picks incl. a blessing and a curse', () => {
    expect(getMode('modifier-run')!.mutatorEvery).toBe(5);
    expect([4, 5, 9, 10].map((n) => mutatorDue(5, n))).toEqual([false, true, false, true]);
    expect(mutatorDue(undefined, 5)).toBe(false);
    const run = start('modifier-run');
    const offer = mutatorOffer(run, 0);
    expect(new Set(offer).size).toBe(3);
    const kinds = offer.map((id) => MUTATORS.mutators.find((m) => m.id === id)!.kind);
    expect(kinds).toContain('blessing');
    expect(kinds).toContain('curse');
    expect(mutatorOffer(run, 0)).toEqual(offer);
  });
  it('picks stack: levels, prize money and end rewards change', () => {
    const run = start('modifier-run');
    const lv = run.rules.enemyLevelBonus;
    const mult = run.rules.rewardMultiplier;
    applyMutator(run, 'hard-hitters');
    applyMutator(run, 'lean-wallet');
    expect(run.rules.enemyLevelBonus).toBe(lv + 3);
    expect(run.rules.rewardMultiplier).toBeCloseTo(mult + 0.3, 5);
    expect(mutatorMoney(run)).toBeCloseTo(0.7, 5);
    expect(() => applyMutator(run, 'nope')).toThrow();
  });
});

describe('Auto-Battle', () => {
  it('pays 35% of normal', () => {
    expect(content.balance.difficulty.autoBattleXp).toBe(0.35);
  });
});

import { boardKey, boardLines, recordBoardRun, runScore } from '../../src/core/boards';
import { decodeGhostCode, encodeGhostCode, ghostLines, keepGhost, ghostFor } from '../../src/core/ghost';
import { createProfile } from '../../src/core/profile';
import { isoWeek, weeklySeed, weeklySetup, weeklyTheme, WEEKLY_THEMES } from '../../src/core/weekly';
import { defaultPrep } from '../../src/core/runPrep';

describe('Weekly Gauntlet', () => {
  it('uses the ISO week, is the same all week, and every theme is a playable ruleset', () => {
    expect(isoWeek('2026-11-01')).toBe('2026-W44');
    expect(isoWeek('2026-11-02')).toBe('2026-W45');
    expect(weeklySeed('2026-10-26')).toBe(weeklySeed('2026-11-01'));
    expect(weeklySeed('2026-11-02')).not.toBe(weeklySeed('2026-11-01'));
    for (const t of WEEKLY_THEMES) expect(rulesProblem({ ...STANDARD_CHOICE, modeId: t.modeId, modifierIds: t.modifierIds }), t.id).toBeNull();
    expect(weeklyTheme('2026-11-01')).toEqual(weeklyTheme('2026-10-27'));
    const a = weeklySetup(content, '2026-11-01', defaultPrep(content), STANDARD_CHOICE);
    expect(a.starters).toHaveLength(content.balance.starterChoices);
    expect(a.starters).toEqual(weeklySetup(content, '2026-10-28', defaultPrep(content), STANDARD_CHOICE).starters);
  });
});

describe('local boards and ghosts', () => {
  const finished = (seed: string, runId: string, badges: number) => {
    const run = start('standard', seed);
    return { ...run, runId, badges: Array.from({ length: badges }, (_, i) => `b${i}`) };
  };
  it('record daily and weekly runs once, best first; ordinary seeds are ignored', () => {
    let p = createProfile(content, 'p1');
    expect(boardKey('abc')).toBeNull();
    p = recordBoardRun(p, finished('daily-2026-11-01', 'r1', 1), 'now');
    p = recordBoardRun(p, finished('daily-2026-11-01', 'r2', 3), 'now');
    p = recordBoardRun(p, finished('daily-2026-11-01', 'r2', 3), 'now');
    p = recordBoardRun(p, finished('plain', 'r3', 8), 'now');
    const lines = boardLines(p, 'daily', 'daily-2026-11-01');
    expect(lines[0]).toContain(String(runScore(finished('x', 'r2', 3))));
    expect(lines).toHaveLength(3);
    expect(boardLines(p, 'weekly', 'weekly-2026-W44')[0]).toContain('No weekly run');
  });
  it('a ghost code round-trips, keeps the seed code and survives damage', () => {
    const parts = { seed: 'friend-seed', archetypeId: 'red', rules: { ...STANDARD_CHOICE, modeId: 'nuzlocke' } };
    const ghost = { from: 'Sam', victory: false, badges: 3, regionReached: 1, encounters: 40, team: ['pikachu'], actions: ['Lost the starter ✓', 'Béla joined'] };
    const code = encodeGhostCode(parts, ghost);
    const back = decodeGhostCode(code);
    expect(back.ok && back.parts).toEqual(parts);
    expect(back.ok && back.ghost).toEqual(ghost);
    expect(decodeGhostCode('GH1.x.y').ok).toBe(false);
    expect(decodeGhostCode('nope').ok).toBe(false);
    const p = keepGhost(createProfile(content, 'p1'), 'friend-seed', ghost);
    expect(ghostFor(p, 'friend-seed')).toEqual(ghost);
    expect(ghostLines(ghost, { victory: false, badges: 5, encounters: 50 }, (id) => id).join('\n')).toContain('You got further');
  });
});

import { autoplay } from './autoplay';

describe('full runs in the new modes', () => {
  it.each(['nuzlocke', 'hardcore-nuzlocke', 'modifier-run'])('%s plays without getting stuck or breaking numbers', (modeId) => {
    for (const seed of ['cm-1', 'cm-2', 'cm-3']) {
      const run = autoplay({ seed, rules: choice(modeId), steps: 1500, smart: true });
      expect(run.party.every((m) => m.hp >= 0 && Number.isFinite(m.level)), seed).toBe(true);
      if (modeId !== 'modifier-run') expect(run.party.every((m) => m.hp > 0 || run.phase === 'over'), seed).toBe(true);
      if (modeId === 'modifier-run' && run.encountersCompleted >= 5) expect(run.mutators?.length ?? 0, seed).toBeGreaterThan(0);
    }
  }, 120000);
});
