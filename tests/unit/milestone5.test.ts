// Milestone 5: Out-of-Run progression. Counters and discoveries during a run,
// the Bank payout, achievements, trainer unlocks and their passives, the Run
// History, save upgrades and export/import.

import { describe, expect, it } from 'vitest';
import { getArchetype, typeModifiers } from '../../src/core/archetypes';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { applyItemToPokemon, getItem } from '../../src/core/items';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { awardAchievements, claimProblem, claimTrainer, requirementProgress, runPayout, trainerStatus } from '../../src/core/progress';
import { hashSeed, Rng } from '../../src/core/rng';
import {
  buyItem,
  chooseReward,
  chooseStarter,
  createRun,
  debugReplaceEnemy,
  resolveDecision,
  shopPrice,
  shopStock,
  takeTurn,
  visitSide,
} from '../../src/core/run';
import type { Profile, RunState } from '../../src/core/state';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

function newRun(seed = 'm5', archetypeId = 'red', campaignId = 'full'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId, campaignId }), 0);
}

/** A lead strong enough to win any early battle. */
function powerUp(run: RunState): RunState {
  const mon = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  mon.moves = [{ id: 'flamethrower', pp: 64 }, { id: 'crunch', pp: 64 }];
  run.party[0] = mon;
  return run;
}

function win(run: RunState): RunState {
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 300) run = takeTurn(content, run, { kind: 'move', index: 0 }).run;
  while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
  return run;
}

/** Plays `battles` wild/trainer battles from the start of a run, taking the first reward each time. */
function play(run: RunState, battles: number): RunState {
  for (let i = 0; i < battles; i++) {
    run = win(toBattle(run));
    if (run.phase === 'reward') run = chooseReward(content, run, 0).run;
    while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
  }
  return run;
}

function profileWith(counters: Record<string, number>, extra: Partial<Profile> = {}): Profile {
  return { ...createProfile(content, 'p'), counters: { ...counters }, best: { ...counters }, ...extra };
}

describe('counting during a run', () => {
  it('counts wins, money and the species met', () => {
    const run = play(powerUp(newRun('count')), 3);
    expect(run.log.counters.battlesWon).toBe(3);
    expect((run.log.counters.wildDefeated ?? 0) + (run.log.counters.trainersDefeated ?? 0)).toBe(3);
    expect(run.log.counters.moneyEarned).toBeGreaterThan(0);
    expect(run.log.speciesSeen.length).toBeGreaterThan(0);
    expect(run.log.speciesCaught).toEqual([]);
  });

  it('counts a catch and remembers the species as caught', () => {
    let run = toBattle(newRun('catch'));
    run.inventory['ultra-ball'] = 50;
    const enemy = run.battle!.enemyTeam[0]!;
    enemy.hp = 1;
    enemy.status = { id: 'slp', turns: 99 };
    let guard = 0;
    while (run.phase === 'battle' && guard++ < 60) run = takeTurn(content, run, { kind: 'item', itemId: 'ultra-ball' }).run;
    expect(run.log.counters.pokemonCaught).toBe(1);
    expect(run.log.speciesCaught).toEqual([enemy.speciesId]);
    run = resolveDecision(content, run, { kind: 'release' }).run;
    expect(run.log.counters.candiesEarned).toBeGreaterThan(0);
  });

  it('records what ended a lost run', () => {
    let run = debugReplaceEnemy(content, toBattle(newRun('lose')), 'growlithe', 60);
    let guard = 0;
    while (run.phase === 'battle' && guard++ < 100) run = takeTurn(content, run, { kind: 'move', index: 0 }).run;
    expect(run.phase).toBe('over');
    expect(run.log.defeatedBy).toMatchObject({ speciesId: 'growlithe', level: 60, trainer: null });
  });
});

describe('the Bank and achievements at the end of a run', () => {
  it('pays savings from leftover money plus a stipend, once', () => {
    const run = { ...play(powerUp(newRun('payout')), 2), phase: 'over' as const };
    run.money = 1000;
    const { savings, stipend } = runPayout(content, run);
    const bank = content.balance.bank;
    expect(savings).toBe(Math.floor(1000 * bank.moneyConversionRate));
    expect(stipend).toBe(bank.stipend.perRun + bank.stipend.perEncounter * run.encountersCompleted);

    const first = finalizeRun(content, createProfile(content, 'p'), run, '2026-10-25T00:00:00Z');
    expect(first.applied).toBe(true);
    const summary = first.summary!;
    const ids = summary.achievements.map((a) => a.id);
    expect(ids).toContain('first-steps');
    expect(ids).toContain('runs-1');
    const achievementCredits = summary.achievements.reduce((n, a) => n + a.reward.bankCredits, 0);
    expect(summary.payout).toEqual({ savings, stipend, achievements: achievementCredits, total: savings + stipend + achievementCredits });
    expect(first.profile.bankCredits).toBe(summary.payout.total);
    expect(first.profile.counters.battlesWon).toBe(2);
    expect(first.profile.counters.runsFinished).toBe(1);
    expect(first.profile.speciesSeen.length).toBeGreaterThan(0);
    expect(first.profile.researchPoints).toBe(summary.researchPoints);
    expect(first.profile.runHistory[0]).toMatchObject({ runId: run.runId, bankCredits: summary.payout.total, victory: false });

    // Refreshing and finishing again changes nothing.
    const second = finalizeRun(content, first.profile, run);
    expect(second.applied).toBe(false);
    expect(second.profile).toBe(first.profile);
  });

  it('awards an achievement once, with its reward, and only when the requirement is met', () => {
    const profile = profileWith({ battlesWon: 99 });
    expect(requirementProgress(profile, { kind: 'total', counter: 'battlesWon', atLeast: 100 })).toEqual({ current: 99, target: 100, met: false });
    const earned = awardAchievements(content, profile, 'now').map((a) => a.id);
    expect(earned).toContain('first-steps');
    expect(earned).not.toContain('battles-100');
    profile.counters.battlesWon = 100;
    expect(awardAchievements(content, profile, 'later').map((a) => a.id)).toEqual(['battles-100']);
    expect(awardAchievements(content, profile, 'again')).toEqual([]);
    expect(profile.achievements['first-steps']).toEqual({ earnedAt: 'now' });
  });

  it('a test campaign still pays but does not count toward achievements', () => {
    const run = { ...play(powerUp(newRun('dev-pay', 'red', 'dev')), 1), phase: 'over' as const };
    const { profile, summary } = finalizeRun(content, createProfile(content, 'p'), run);
    expect(summary!.payout.total).toBeGreaterThan(0);
    expect(summary!.achievements).toEqual([]);
    expect(profile.counters).toEqual({});
    expect(profile.runHistory).toHaveLength(1);
  });

  it('keeps only the most recent runs in the Run History', () => {
    let profile = createProfile(content, 'p');
    for (let i = 0; i < content.balance.runHistorySize + 3; i++) {
      profile = finalizeRun(content, profile, { ...newRun(`hist-${i}`), phase: 'over' }).profile;
    }
    expect(profile.runHistory).toHaveLength(content.balance.runHistorySize);
    expect(profile.runHistory[0]!.seed).toBe(`hist-${content.balance.runHistorySize + 2}`);
  });
});

describe('trainer unlocks', () => {
  it('a trainer is locked, then claimable once its requirement is met, then costs its Bank Credits', () => {
    const brock = getArchetype(content, 'brock');
    let profile = createProfile(content, 'p');
    expect(trainerStatus(profile, brock)).toBe('locked');
    expect(() => claimTrainer(content, profile, 'brock')).toThrow(/Not yet/);
    profile = profileWith({ regionsClearedNoCharm: 1 });
    expect(trainerStatus(profile, brock)).toBe('claimable');
    expect(claimProblem(profile, brock)).toMatch(/Bank Credits/);
    profile.bankCredits = brock.unlockCost + 5;
    profile = claimTrainer(content, profile, 'brock');
    expect(profile.bankCredits).toBe(5);
    expect(trainerStatus(profile, brock)).toBe('unlocked');
    expect(() => claimTrainer(content, profile, 'brock')).toThrow(/already/);
  });

  it('a trainer whose systems are not built yet cannot be claimed', () => {
    const cynthia = getArchetype(content, 'cynthia');
    const profile = profileWith({ championsDefeated: 5 }, { bankCredits: 10_000 });
    expect(trainerStatus(profile, cynthia)).toBe('comingLater');
    expect(() => claimTrainer(content, profile, 'cynthia')).toThrow(/later/);
  });

  it('Brock: starts with Potions, heals more, and pays more for Poké Balls', () => {
    const run = newRun('brock', 'brock');
    expect(run.inventory.potion).toBe((content.balance.startingItems.potion ?? 0) + 3);
    const mon = createPokemon(content, 'onix', 30, 'x');
    mon.hp = 1;
    applyItemToPokemon(content, getItem(content, 'potion'), mon, { healMultiplier: 1.5 });
    expect(mon.hp).toBe(Math.min(maxHp(content, mon), 1 + 30));
    const ball = content.shop.find((e) => e.item === 'poke-ball')!;
    expect(shopPrice(content, run, ball)).toBe(Math.round(ball.price * 1.5));
    expect(shopPrice(content, newRun('red'), ball)).toBe(ball.price);
  });

  it('Giovanni: shop stock unlocks two badges sooner and healing costs more', () => {
    let run = newRun('gio', 'giovanni');
    expect(shopStock(content, run).map((e) => e.item)).toContain('great-ball'); // normally 2 badges
    const potion = content.shop.find((e) => e.item === 'potion')!;
    expect(shopPrice(content, run, potion)).toBe(Math.round(potion.price * 1.25));
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 's', kind: 'shop', used: false });
    run.stage!.current = node.id;
    run.money = 1000;
    run = visitSide(content, run, 's').run;
    run = buyItem(content, run, 'great-ball').run;
    expect(run.money).toBe(1000 - content.shop.find((e) => e.item === 'great-ball')!.price);
  });

  it('Misty: Water-type Pokémon hit harder and take more super-effective damage', () => {
    const damage = (archetypeId: string | null, attacker: string, defender: string, playerAttacks: boolean) => {
      const a = createPokemon(content, attacker, 40, 'a');
      const d = createPokemon(content, defender, 40, 'd');
      const player = playerAttacks ? a : d;
      const enemy = playerAttacks ? d : a;
      player.moves = playerAttacks ? [{ id: 'water-gun', pp: 25 }] : [{ id: 'growl', pp: 40 }];
      enemy.moves = playerAttacks ? [{ id: 'growl', pp: 40 }] : [{ id: 'thunder-shock', pp: 30 }];
      const battle = createBattle('wild', [enemy], 0, player.uid);
      const ctx: BattleContext = {
        content,
        battle,
        party: [player],
        inventory: {},
        rng: new Rng(hashSeed('misty')),
        captureRng: new Rng(hashSeed('misty-c')),
        catchMultiplier: 1,
        typeModifiers: archetypeId ? typeModifiers(getArchetype(content, archetypeId)) : undefined,
      };
      const events = resolveTurn(ctx, { kind: 'move', index: 0 });
      const hit = events.find((e) => e.type === 'damage' && e.side === (playerAttacks ? 'enemy' : 'player'));
      return hit && hit.type === 'damage' ? hit.amount : 0;
    };
    const plain = damage(null, 'squirtle', 'rattata', true);
    expect(damage('misty', 'squirtle', 'rattata', true)).toBe(Math.floor(plain * 1.2));
    const shocked = damage(null, 'pikachu', 'squirtle', false);
    expect(damage('misty', 'pikachu', 'squirtle', false)).toBe(Math.floor(shocked * 1.25));
  });
});

describe('content checks', () => {
  it('rejects an achievement that requires an unknown achievement', () => {
    const raw = structuredClone(RAW_CONTENT) as typeof RAW_CONTENT & { achievements: { requirement: unknown }[] };
    raw.achievements[0]!.requirement = { kind: 'achievement', id: 'nope' };
    expect(() => buildContent(raw)).toThrow(/unknown achievement "nope"/);
  });

  it('rejects an unknown counter name', () => {
    const raw = structuredClone(RAW_CONTENT) as typeof RAW_CONTENT & { achievements: { requirement: unknown }[] };
    raw.achievements[0]!.requirement = { kind: 'total', counter: 'hugs', atLeast: 1 };
    expect(() => buildContent(raw)).toThrow(/unknown counter/);
  });
});

describe('saves (profile v3, run v5) and export/import', () => {
  it('upgrades a Milestone 4 profile: bank currency becomes Bank Credits', () => {
    const storage = new MemoryStorageProvider();
    const { bankCredits, researchPoints, counters, best, speciesSeen, speciesCaught, achievements, titles, activeTitle, lifetimeBankCredits, runHistory, lastPayout, ...v2 } = createProfile(content, 'old');
    void [bankCredits, researchPoints, counters, best, speciesSeen, speciesCaught, achievements, titles, activeTitle, lifetimeBankCredits, runHistory, lastPayout];
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 2, savedAt: '', data: { ...v2, bankCurrency: 42, candies: 9 } }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile).toMatchObject({ profileId: 'old', bankCredits: 42, candies: 9, researchPoints: 0, achievements: {}, runHistory: [] });
  });

  it('upgrades a Milestone 4 run: it starts counting from now', () => {
    const storage = new MemoryStorageProvider();
    const run = newRun('m4-run');
    const { counters, speciesSeen, speciesCaught, charmUsedInRegion, defeatedBy, ...logV4 } = run.log;
    void [counters, speciesSeen, speciesCaught, charmUsedInRegion, defeatedBy];
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 4, savedAt: '', data: { ...run, log: logV4 } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded).toMatchObject({ status: 'ok', migratedFrom: 4 });
    if (loaded.status === 'ok') expect(loaded.data.log).toEqual(run.log);
  });

  it('exports and imports the profile; a bad file changes nothing', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const profile = { ...createProfile(content, 'mine'), bankCredits: 777 };
    saves.saveProfile(profile);
    const file = saves.exportSave();

    const other = new SaveManager(new MemoryStorageProvider(), content);
    other.saveProfile(createProfile(content, 'theirs'));
    expect(other.importSave('{"nope": 1}')).toMatchObject({ ok: false });
    expect(other.loadOrCreateProfile(() => 'x').profile.profileId).toBe('theirs');
    const result = other.importSave(file);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.backup).toMatch(/before-import/);
    expect(other.loadOrCreateProfile(() => 'x').profile).toMatchObject({ profileId: 'mine', bankCredits: 777 });
  });
});
