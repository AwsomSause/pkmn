// Untitled doc Phase E1: modes, difficulty, modifiers, Death-Block, reward multiplier, Adventure.

import { describe, expect, it } from 'vitest';
import { finalizeRun, createProfile } from '../../src/core/profile';
import { chooseStarter, createRun, debugReplaceEnemy, takeTurn } from '../../src/core/run';
import { makeRules, rewardMultiplier, rulesLines, rulesProblem, RUN_RULES, STANDARD_CHOICE, type RulesChoice } from '../../src/core/rules';
import type { RunState } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

const start = (seed: string, rules: Partial<RulesChoice> = {}): RunState => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', rules: { ...STANDARD_CHOICE, ...rules } }), 0);
const lose = (run: RunState) => {
  let r = debugReplaceEnemy(content, toBattle(run), 'growlithe', 60);
  let wiped = false;
  let guard = 0;
  while (r.phase === 'battle' && guard++ < 100) {
    const res = takeTurn(content, r, { kind: 'move', index: 0 });
    r = res.run;
    wiped ||= res.wiped === true;
  }
  return { run: r, wiped };
};

describe('rules data and multiplier', () => {
  it('standard is x1, the cap holds, planned things cannot start', () => {
    expect(rewardMultiplier(STANDARD_CHOICE)).toBe(1);
    expect(rewardMultiplier({ ...STANDARD_CHOICE, difficultyId: 'nightmare', modifierIds: ['no-transformations', 'scarce-supplies'] })).toBe(Math.min(RUN_RULES.multiplierCap, 1.7 * 1.3));
    expect(rewardMultiplier({ ...STANDARD_CHOICE, deathBlock: true })).toBe(0.9);
    expect(rewardMultiplier({ ...STANDARD_CHOICE, modeId: 'adventure' })).toBe(0);
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['monotype'] })).toContain('not available');
    expect(rulesProblem({ ...STANDARD_CHOICE, modeId: 'daily' })).toContain('not available');
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['scarce-supplies', 'scarce-supplies'] })).toContain('twice');
    expect(() => makeRules({ ...STANDARD_CHOICE, difficultyId: 'nope' })).toThrow();
  });

  it('the multiplier never exceeds the cap whatever the modifiers', () => {
    const all = RUN_RULES.modifiers.map((m) => m.id);
    expect(rewardMultiplier({ ...STANDARD_CHOICE, difficultyId: 'nightmare', modifierIds: all })).toBeLessThanOrEqual(RUN_RULES.multiplierCap);
  });

  it('the preview says the multiplier or the Adventure warning', () => {
    expect(rulesLines({ ...STANDARD_CHOICE, difficultyId: 'veteran' }).join('\n')).toContain('x1.20');
    expect(rulesLines({ ...STANDARD_CHOICE, modeId: 'adventure' }).join('\n')).toContain('No Bank Credits');
  });
});

describe('a run keeps the rules it started with', () => {
  it('snapshots rules, applies difficulty to enemy levels, and Scarce Supplies halves the start', () => {
    const plain = start('lv');
    const hard = start('lv', { difficultyId: 'nightmare' });
    expect(hard.rules.enemyLevelBonus).toBe(7);
    const level = (r: RunState) => toBattle(r).battle!.enemyTeam[0]!.level;
    expect(level(hard)).toBe(level(plain) + 7);
    const scarce = start('lv', { modifierIds: ['scarce-supplies'] });
    expect(scarce.money).toBe(Math.floor(plain.money / 2));
    expect(start('lv', { modifierIds: ['no-transformations'] }).disabledMechanics.sort()).toEqual(['dynamax', 'mega', 'tera', 'zmove']);
  });

  it('saves from before rules load as standard (migration v14)', () => {
    const storage = new MemoryStorageProvider();
    const { rules: _r, ...old } = start('mig');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 16, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(16);
    expect(loaded.data.rules).toMatchObject({ modeId: 'standard', rewardMultiplier: 1, progressionEligible: true });
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(17);
  });
});

describe('Death-Block and Adventure', () => {
  it('Death-Block returns a wiped party to the stage start once, then the next wipe ends the run', () => {
    const first = lose(start('db', { deathBlock: true }));
    expect(first.wiped).toBe(true);
    expect(first.run.phase).toBe('map');
    expect(first.run.rules.deathBlockUsed).toBe(true);
    expect(first.run.party.every((m) => m.hp > 0)).toBe(true);
    const second = lose(first.run);
    expect(second.wiped).toBe(false);
    expect(second.run.phase).toBe('over');
  });

  it('without Death-Block a wipe ends the run', () => {
    expect(lose(start('nodb')).run.phase).toBe('over');
  });

  it('Adventure never ends on a wipe, costs a little money, and pays the account nothing', () => {
    const adv = start('adv', { modeId: 'adventure' });
    const money = adv.money;
    const a = lose(adv);
    expect(a.wiped).toBe(true);
    expect(a.run.rules.wipes).toBe(1);
    expect(a.run.money).toBe(Math.floor(money * 0.9));
    const b = lose(a.run);
    expect(b.run.phase).toBe('map');
    expect(b.run.rules.wipes).toBe(2);
    const profile = createProfile(content, 'p');
    const done = { ...b.run, candies: 50, phase: 'over' as const };
    const out = finalizeRun(content, profile, done);
    expect(out.profile.candies).toBe(profile.candies);
    expect(out.profile.bankCredits).toBe(profile.bankCredits);
    expect(out.profile.researchPoints).toBe(profile.researchPoints);
    expect(out.summary?.achievements).toEqual([]);
  });

  it('the reward multiplier is fixed by the snapshot, not by anything chosen later', () => {
    const run = { ...start('mult', { difficultyId: 'veteran' }), money: 1000, phase: 'over' as const };
    const base = { ...run, rules: { ...run.rules, rewardMultiplier: 1 } };
    const a = finalizeRun(content, createProfile(content, 'p'), base).profile.bankCredits;
    const b = finalizeRun(content, createProfile(content, 'p'), run).profile.bankCredits;
    expect(b).toBeGreaterThan(a);
  });
});
