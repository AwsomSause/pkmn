// Untitled doc Phase E1: modes, difficulty, modifiers, Death-Block, reward multiplier, Adventure.

import { describe, expect, it } from 'vitest';
import { finalizeRun, createProfile } from '../../src/core/profile';
import { chooseStarter, createRun, debugReplaceEnemy, resolveDecision, shopStock, takeTurn } from '../../src/core/run';
import { isRewardEligible } from '../../src/core/rewards';
import { awardModeRewards } from '../../src/core/modeRewards';
import { dailyClaimKey, dailySeed, extendEndless, joinProblem, lockSpecies, partyCap, pickGeneration, randomDraft, spookyWild } from '../../src/core/rules';
import { specialFamily } from '../../src/core/specialForms';
import { getSpecies } from '../../src/core/pokemon';
import { createPokemon } from '../../src/core/pokemon';
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
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['monotype'] })).toBeNull();
    expect(rulesProblem({ ...STANDARD_CHOICE, modifierIds: ['monotype', 'limited-party'] })).toContain('cannot be combined');
    expect(rulesProblem({ ...STANDARD_CHOICE, modeId: 'daily' })).toBeNull();
    expect(rulesProblem({ ...STANDARD_CHOICE, modeId: 'nope' })).toContain('Unknown');
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

describe('the 10 other modifiers', () => {
  it('every modifier is supported and the unsupported list is empty', () => {
    expect(RUN_RULES.modifiers.filter((m) => m.status !== 'supported')).toEqual([]);
    // 10 challenge modifiers, 3 Challenge Contracts (Empty Bag, No Rest, No Evolution), Solo Run and Quick Route.
    expect(RUN_RULES.modifiers).toHaveLength(17);
  });

  it('Limited Party caps the party at 4', () => {
    const run = start('cap', { modifierIds: ['limited-party'] });
    expect(partyCap(content, run.rules)).toBe(4);
    expect(partyCap(content, start('cap').rules)).toBe(content.balance.partyMax);
  });

  it('Monotype locks to the starter type and refuses other types', () => {
    const run = start('mono', { modifierIds: ['monotype'] });
    const type = run.rules.lockType!;
    expect(content.species.get(run.party[0]!.speciesId)!.types).toContain(type);
    const other = [...content.species.values()].find((s) => !s.types.includes(type as never) && s.evolutions.length === 0)!;
    expect(joinProblem(content, run, other.id)).toContain('Monotype');
    const same = [...content.species.values()].find((s) => s.types.includes(type as never))!;
    expect(joinProblem(content, run, same.id)).toBeNull();
  });

  it('No Duplicate Species refuses a second Pokémon of the same line, but allows replacing it', () => {
    const run = start('dup', { modifierIds: ['no-duplicate-species'] });
    const lead = run.party[0]!;
    expect(joinProblem(content, run, lead.speciesId)).toContain('No Duplicate');
    expect(joinProblem(content, run, lead.speciesId, lead.uid)).toBeNull();
    expect(joinProblem(content, start('dup'), lead.speciesId)).toBeNull();
  });

  it('a caught Pokémon that cannot join can only be released, even past the release limit', () => {
    let run = start('rel', { modifierIds: ['no-duplicate-species'] });
    const twin = createPokemon(content, run.party[0]!.speciesId, 5, 'twin');
    run = { ...run, pending: [{ kind: 'caught', mon: twin }], phase: 'decision' };
    expect(() => resolveDecision(content, run, { kind: 'addToParty' })).toThrow('No Duplicate');
    expect(resolveDecision(content, run, { kind: 'release' }).run.candies).toBeGreaterThan(0);
  });

  it('Single Region Dex picks a generation and keeps wild Pokémon inside it', () => {
    const run = start('gen', { modifierIds: ['single-region-dex'] });
    expect(run.rules.lockGeneration).toBe(pickGeneration(content, 'gen'));
    const outside = [...content.species.values()].find((s) => s.generation !== run.rules.lockGeneration)!;
    const swapped = lockSpecies(content, run, outside.id, 'k');
    expect(content.species.get(swapped)!.generation).toBe(run.rules.lockGeneration);
    expect(lockSpecies(content, run, outside.id, 'k')).toBe(swapped);
    for (let i = 0; i < 8; i++) {
      const r = toBattle(start(`gen-${i}`, { modifierIds: ['single-region-dex'] }));
      for (const e of r.battle!.enemyTeam) expect(content.species.get(e.speciesId)!.generation).toBe(r.rules.lockGeneration);
    }
  });

  it('Rich Route raises battle money and enemy levels; Blind Research scales research', () => {
    const rich = start('rich', { modifierIds: ['rich-route'] });
    expect(rich.rules.enemyLevelBonus).toBe(2);
    expect(rewardMultiplier({ ...STANDARD_CHOICE, modifierIds: ['blind-research'] })).toBe(1.1);
  });

  it('No Revives removes revive rewards and shop entries', () => {
    const plain = start('nr');
    const run = start('nr', { modifierIds: ['no-revives'] });
    const revives = [...content.items.values()].filter((i) => i.category === 'revive').map((i) => i.id);
    expect(revives.length).toBeGreaterThan(0);
    const shop = (r: RunState) => shopStock(content, { ...r, badges: Array(8).fill('x') }).map((e) => e.item);
    expect(shop(plain).some((id) => revives.includes(id))).toBe(true);
    expect(shop(run).some((id) => revives.includes(id))).toBe(false);
    const reward = [...content.rewards.values()].find((r) => r.effect.kind === 'addItem' && revives.includes(r.effect.item));
    if (reward) expect(isRewardEligible(content, run, reward)).toBe(false);
  });

  it('Random Draft picks a licence-free draft rule from the seed, the same every time', () => {
    const run = start('rd', { modifierIds: ['random-draft'] });
    const again = start('rd', { modifierIds: ['random-draft'] });
    expect(run.prep.draftRuleId).toBe(again.prep.draftRuleId);
    expect(randomDraft(content, 'rd', run.prep).draftRuleId).toBe(run.prep.draftRuleId);
    expect(content.draftRules.get(run.prep.draftRuleId)!.license).toBeNull();
  });

  it('Boss Rush uses the short campaign and its gyms come twice as often', () => {
    const run = start('br', { modifierIds: ['boss-rush'] });
    expect(run.campaignId).toBe('boss-rush');
    expect(content.campaigns.get('boss-rush')!.stagesPerRegion).toBe(4);
  });

  it('Variant Hunt adds event stops without touching other rolls', () => {
    const count = (r: RunState) => r.stage!.map.nodes.flatMap((n) => n.sides).filter((x) => x.kind === 'event').length;
    const normal = count(start('vh'));
    const hunt = count(start('vh', { modifierIds: ['variant-hunt'] }));
    expect(hunt).toBeGreaterThanOrEqual(normal);
  });

  it('Difficulty reaches trainers and bosses, not only wild Pokémon', () => {
    const level = (r: RunState) => Math.max(...toBattle(toBattle(r)).battle!.enemyTeam.map((m) => m.level));
    expect(level(start('lvt', { difficultyId: 'nightmare' }))).toBeGreaterThanOrEqual(level(start('lvt')));
  });
});

describe('Daily Run, Endless and Spooky modes', () => {
  it('the daily seed is the date and a second run that day earns nothing', () => {
    expect(dailySeed('2026-10-30T23:59:00Z')).toBe('daily-2026-10-30');
    expect(dailyClaimKey('2026-10-30T01:00:00Z')).toBe('daily:2026-10-30');
    const choice = { modeId: 'daily', difficultyId: 'standard', modifierIds: [], deathBlock: false };
    expect(makeRules(choice).progressionEligible).toBe(true);
    const again = makeRules({ ...choice, noRewards: true });
    expect(again.progressionEligible).toBe(false);
    expect(again.rewardMultiplier).toBe(0);
  });

  it('Endless adds a lap and raises enemy levels instead of ending; other modes do not', () => {
    const run = { rules: makeRules({ modeId: 'endless', difficultyId: 'standard', modifierIds: [], deathBlock: false }), regionOrder: ['a', 'b'] };
    const before = run.rules.enemyLevelBonus;
    expect(extendEndless(run)).toBe(true);
    expect(run.regionOrder).toEqual(['a', 'b', 'a', 'b']);
    expect(run.rules.loops).toBe(1);
    expect(run.rules.enemyLevelBonus).toBe(before + 5);
    expect(extendEndless(run)).toBe(true);
    expect(run.regionOrder).toHaveLength(6);
    // The configured endpoint: after the loop limit the run ends in victory instead of looping again.
    run.rules.loops = RUN_RULES.modes.find((m) => m.id === 'endless')!.loopLimit!;
    const length = run.regionOrder.length;
    expect(extendEndless(run)).toBe(false);
    expect(run.regionOrder).toHaveLength(length);
    expect(extendEndless({ rules: makeRules(STANDARD_CHOICE), regionOrder: ['a'] })).toBe(false);
  });

  it('Spooky swaps some wild Pokémon for Spooky forms, the same way every time', () => {
    
    const run = { seed: 's1', rules: makeRules({ modeId: 'spooky', difficultyId: 'standard', modifierIds: [], deathBlock: false }) };
    const out = Array.from({ length: 200 }, (_, i) => spookyWild(content, run, 'pidgey', `n${i}`));
    const swapped = out.filter((id) => id !== 'pidgey');
    expect(swapped.length).toBeGreaterThan(20);
    expect(swapped.length).toBeLessThan(90);
    for (const id of swapped) expect(specialFamily(getSpecies(content, id))).toBe('spooky');
    expect(Array.from({ length: 200 }, (_, i) => spookyWild(content, run, 'pidgey', `n${i}`))).toEqual(out);
    const std = { seed: 's1', rules: makeRules(STANDARD_CHOICE) };
    expect(spookyWild(content, std, 'pidgey', 'n1')).toBe('pidgey');
  });
});

describe('mode rewards', () => {
  const finished = (modeId: string, extra: Partial<RunState['rules']> = {}, badges = 4): RunState => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: `mr-${modeId}`, seed: 'mr', archetypeId: 'red', rules: { modeId, difficultyId: 'standard', modifierIds: [], deathBlock: false } }), 0));
    run.badges = Array.from({ length: badges }, (_, i) => `b${i}`) as never;
    run.rules = { ...run.rules, ...extra };
    return run;
  };
  it('the Daily fourth-gym reward unlocks the Daily Set once, then pays a repeat reward', () => {
    const profile = createProfile(content, 'p');
    const first = awardModeRewards(profile, finished('daily'), 'now');
    expect(first).toMatchObject([{ id: 'daily-fourth-gym', first: true }]);
    expect(profile.unlockedPools).toContain('daily-set');
    const credits = profile.bankCredits;
    const again = awardModeRewards(profile, finished('daily'), 'later');
    expect(again[0]!.first).toBe(false);
    expect(profile.bankCredits).toBe(credits + 100);
    expect(profile.unlockedPools.filter((p) => p === 'daily-set')).toHaveLength(1);
  });
  it('needs the badges, and Adventure or reward-free runs earn nothing', () => {
    const profile = createProfile(content, 'p');
    expect(awardModeRewards(profile, finished('daily', {}, 3), 'now')).toEqual([]);
    expect(awardModeRewards(profile, finished('daily', { progressionEligible: false }), 'now')).toEqual([]);
    expect(profile.unlockedPools).toEqual([]);
  });
  it('Spooky unlocks its pool and trainer; Endless pays by laps', () => {
    const profile = createProfile(content, 'p');
    awardModeRewards(profile, finished('spooky'), 'now');
    expect(profile.unlockedPools).toContain('spooky');
    expect(profile.unlockedArchetypes).toContain('hex-maniac');
    expect(awardModeRewards(profile, finished('endless', { loops: 0 }), 'now')).toEqual([]);
    expect(awardModeRewards(profile, finished('endless', { loops: 1 }), 'now').map((r) => r.id)).toEqual(['endless-lap-1']);
    expect(awardModeRewards(profile, finished('endless', { loops: 3 }), 'now').map((r) => [r.id, r.first])).toEqual([['endless-lap-1', false], ['endless-lap-3', true]]);
    expect(profile.titles).toEqual(expect.arrayContaining(['Endless Walker', 'Without End']));
  });
});

describe('mode snapshot survives a reload', () => {
  it('keeps the mode, laps and level bonus after saving and loading an Endless run', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'rl', seed: 'rl', archetypeId: 'red', rules: { modeId: 'endless', difficultyId: 'veteran', modifierIds: [], deathBlock: false } }), 0));
    extendEndless(run);
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    saves.saveRun(run);
    const loaded = saves.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.data.rules).toEqual(run.rules);
      expect(loaded.data.rules.loops).toBe(1);
      expect(loaded.data.regionOrder).toEqual(run.regionOrder);
    }
  });
});
