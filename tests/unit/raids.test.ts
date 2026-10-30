// Raids (Blueprint section 1): shields, phases, telegraph, extra actions, timer, entry, rewards, failure, saves.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { applyBossHp, freshRaidBattle, getRaid, absorbHit, chargedDamage, placeRaidDens } from '../../src/core/raid/raid';
import { RaidFileSchema } from '../../src/core/raid/schema';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, enterRaid, raidPreview, takeTurn, visitSide } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import raidsJson from '../../src/data/raids.json';
import { content } from './helpers';

function fight(raidId: string, playerSpecies = 'pikachu') {
  const def = getRaid(content, raidId);
  const player = createPokemon(content, playerSpecies, 60, 'p1');
  const boss = createPokemon(content, def.species[0]!, 50, 'e1');
  applyBossHp(def, boss);
  boss.hp = maxHp(content, boss);
  const battle = createBattle('wild', [boss], 0, player.uid);
  battle.raid = freshRaidBattle(def);
  const party: PokemonInstance[] = [player];
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(raidId)), captureRng: new Rng(hashSeed("c")), catchMultiplier: 1 };
  return { def, player, boss, battle, ctx, party };
}
const use = (ctx: BattleContext) => resolveTurn(ctx, { kind: 'move', index: 0 });

function mapRun(seed: string): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'rd', seed, archetypeId: 'red' }), 0));
  // Put a den on the first reachable node and stand on it.
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides.push({ id: 'raid-test', kind: 'raid', raidId: 'sleeping-snorlax', used: false });
  run.stage!.current = node.id;
  return run;
}

describe('raid data', () => {
  it('validates, covers tiers 1 to 6 and keeps every mechanic optional', () => {
    expect(RaidFileSchema.safeParse(raidsJson).success).toBe(true);
    const tiers = new Set(content.raids.raids.map((r) => r.tier));
    expect([...tiers].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(content.raids.raids.some((r) => r.shield === null)).toBe(true);
  });

  it('places at most one den per stage, only before the gym, stable for a seed', () => {
    let dens = 0;
    for (let i = 0; i < 40; i++) {
      const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'pl', seed: `den-${i}`, archetypeId: 'red' }), 0));
      const raidSides = run.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.kind === 'raid').map(() => n));
      expect(raidSides.length).toBeLessThanOrEqual(1);
      for (const n of raidSides) expect(n.column).toBeLessThan(run.stage!.map.columns);
      dens += raidSides.length;
      const again = structuredClone(run);
      for (const n of again.stage!.map.nodes) n.sides = n.sides.filter((s) => s.kind !== 'raid');
      placeRaidDens(content, again);
      expect(JSON.stringify(again.stage!.map)).toBe(JSON.stringify(run.stage!.map));
    }
    expect(dens).toBeGreaterThan(5);
  });
});

describe('raid mechanics', () => {
  it('a shield stops the boss at its threshold, soaks damage, then breaks', () => {
    const { boss, battle } = fight('storm-gyarados');
    const max = maxHp(content, boss);
    const passed = absorbHit(content, battle, boss, max); // would kill it outright
    expect(boss.hp - passed).toBe(Math.ceil(max * 0.5));
    expect(battle.raid!.shieldHp).toBeGreaterThan(0);
    boss.hp -= passed;
    expect(absorbHit(content, battle, boss, 10)).toBe(0);
    expect(battle.raid!.shieldHp).toBe(battle.raid!.shieldMax - 10);
    absorbHit(content, battle, boss, 1e9);
    expect(battle.raid!.shieldHp).toBe(0);
    expect(battle.raid!.notes.some((n) => n.text.includes('shattered'))).toBe(true);
    expect(absorbHit(content, battle, boss, 5)).toBe(5); // no more shields: damage goes through
  });

  it('a phase starts once at its HP line with its text and boosts', () => {
    const { boss, battle, ctx, player } = fight('sleeping-snorlax');
    boss.moves = [{ id: 'splash', pp: 40 }];
    player.moves = [{ id: 'tackle', pp: 35 }];
    boss.hp = Math.floor(maxHp(content, boss) * 0.4);
    const events = use(ctx);
    expect(events.filter((e) => e.type === 'raid' && e.tone === 'phase')).toHaveLength(1);
    expect(battle.enemyStages.atk).toBe(1);
    expect(use(ctx).filter((e) => e.type === 'raid' && e.tone === 'phase')).toHaveLength(0);
    expect(battle.enemyStages.atk).toBe(1);
  });

  it('the telegraph charges every N turns and the charged hit is boosted once', () => {
    const { battle, ctx, player, boss } = fight('storm-gyarados');
    player.hp = player.hp; // keep alive
    boss.moves = [{ id: 'splash', pp: 40 }];
    player.moves = [{ id: 'growl', pp: 40 }];
    const warned: number[] = [];
    for (let t = 1; t <= 9; t++) {
      if (use(ctx).some((e) => e.type === 'raid' && e.tone === 'warn')) warned.push(t);
    }
    expect(warned).toEqual([4, 9]);
    expect(battle.raid!.charging).toBe(true);
  });

  it('a charged attack is interrupted by sleep, paralysis or freeze, and burn does not stop it', () => {
    const { battle, boss } = fight('storm-gyarados');
    const boost = getRaid(content, 'storm-gyarados').telegraph!.boost;
    battle.raid!.charging = true;
    boss.status = { id: 'brn' };
    expect(chargedDamage(content, battle, 100)).toBe(Math.floor(100 * boost));
    battle.raid!.charging = true;
    boss.status = { id: 'par' };
    expect(chargedDamage(content, battle, 100)).toBe(100);
    expect(battle.raid!.charging).toBe(false);
    expect(battle.raid!.nextCharge).toBe(getRaid(content, 'storm-gyarados').telegraph!.everyTurns);
    expect(battle.raid!.notes.at(-1)!.text).toContain('interrupted');
  });

  it('extra actions only fire under the HP line and never more than max', () => {
    const { battle, ctx, player, boss } = fight('dragon-ascent');
    boss.moves = [{ id: 'splash', pp: 40 }];
    player.moves = [{ id: 'growl', pp: 40 }];
    use(ctx);
    expect(battle.raid!.extraUsed).toBe(0);
    boss.hp = Math.floor(maxHp(content, boss) * 0.3);
    battle.raid!.pendingShields = [];
    for (let i = 0; i < 6; i++) use(ctx);
    expect(battle.raid!.extraUsed).toBe(3);
  });

  it('the timer ends the raid as a loss', () => {
    const { battle, ctx, player, boss } = fight('steel-mind');
    boss.moves = [{ id: 'splash', pp: 40 }];
    player.moves = [{ id: 'growl', pp: 40 }];
    battle.raid!.timerLeft = 2;
    use(ctx);
    expect(battle.outcome).toBeNull();
    use(ctx);
    expect(battle.outcome).toBe('lose');
  });

  it('a raid boss cannot be caught mid-fight', () => {
    const { ctx } = fight('sleeping-snorlax');
    ctx.inventory['poke-ball'] = 3;
    expect(() => resolveTurn(ctx, { kind: 'item', itemId: 'poke-ball' })).toThrow();
  });
});

describe('raid runs', () => {
  it('previews, charges the entry cost once, and uses the den up', () => {
    const run = mapRun('rd-1');
    const pv = raidPreview(content, run, 'raid-test');
    expect(pv.tier).toBe(1);
    expect(pv.mechanics.length).toBeGreaterThan(0);
    expect(() => visitSide(content, run, 'raid-test')).toThrow();
    const before = run.money;
    const inRaid = enterRaid(content, run, 'raid-test');
    expect(inRaid.phase).toBe('battle');
    expect(inRaid.money).toBe(before - getRaid(content, 'sleeping-snorlax').entryCost);
    expect(inRaid.battle!.raid!.id).toBe('sleeping-snorlax');
    expect(inRaid.raids.entered).toBe(1);
    // The den is used up in the saved state, so a reload can't charge or enter twice.
    expect(inRaid.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'raid-test')!.used).toBe(true);
    expect(() => enterRaid(content, { ...inRaid, phase: 'map', battle: null }, 'raid-test')).toThrow();
  });

  it('refuses entry without the money', () => {
    const run = mapRun('rd-2');
    run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'raid-test')!.raidId = 'sky-pillar-apex';
    run.money = 0;
    expect(() => enterRaid(content, run, 'raid-test')).toThrow(/₽/);
  });

  it('boss level never exceeds the region level cap', () => {
    for (const raid of content.raids.raids) {
      const run = mapRun(`cap-${raid.id}`);
      run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'raid-test')!.raidId = raid.id;
      run.money = 99999;
      const cap = content.balance.difficulty.levelCapStep; // region 0 cap
      expect(raidPreview(content, run, 'raid-test').level).toBeLessThanOrEqual(cap);
    }
  });

  it('winning pays once, a lost or timed-out raid heals and goes back to the map', () => {
    const run = enterRaid(content, mapRun('rd-3'), 'raid-test');
    // Lose: the timer runs out.
    const lost = structuredClone(run);
    lost.battle!.raid!.timerLeft = 1;
    lost.party[0]!.moves = [{ id: 'growl', pp: 40 }];
    const result = takeTurn(content, lost, { kind: 'move', index: 0 });
    expect(result.raidFailed).toBe(true);
    expect(result.run.phase).toBe('map');
    expect(result.run.battle).toBeNull();
    expect(result.run.raids.lost).toBe(1);
    expect(result.run.party.every((m) => m.hp > 0)).toBe(true);
    // Win: knock the boss out.
    const won = structuredClone(run);
    const boss = won.battle!.enemyTeam[0]!;
    boss.hp = 1;
    won.battle!.raid!.pendingShields = [];
    won.party[0]!.moves = [{ id: 'tackle', pp: 35 }];
    won.party[0]!.level = 60;
    const moneyBefore = won.money;
    const res = takeTurn(content, won, { kind: 'move', index: 0 });
    expect(res.end?.outcome).toBe('win');
    expect(res.run.raids.won).toBe(1);
    expect(res.run.money).toBeGreaterThan(moneyBefore);
    expect(res.run.battle).toBeNull();
  });

  it('survives a save and reload mid-raid', () => {
    const run = enterRaid(content, mapRun('rd-4'), 'raid-test');
    run.battle!.raid!.shieldHp = 7;
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    saves.saveRun(run);
    const loaded = saves.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.data.battle!.raid!.shieldHp).toBe(7);
  });

  it('a version 12 run loads with an empty raid record', () => {
    const storage = new MemoryStorageProvider();
    const { raids: _r, ...old } = mapRun('rd-5');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 12, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.data.raids).toEqual({ entered: 0, won: 0, lost: 0, bestTier: 0, done: [] });
  });
});
