// Raid field rules and cheers (Raid Battles pack): surge, rotating weakness, healing restriction, cheers, extra moves, capture jingle.

import { describe, expect, it } from 'vitest';
import { createBattle, itemProblem, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { applyBossHp, cheerProblem, freshRaidBattle, getRaid, raidFieldMultiplier, rotatingWeakness } from '../../src/core/raid/raid';
import { raidCaptureTrack } from '../../src/core/presentation/battleMusic';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, enterRaid } from '../../src/core/run';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function fight(raidId: string) {
  const def = getRaid(content, raidId);
  const player = createPokemon(content, 'blissey', 100, 'p1');
  player.hp = Math.floor(maxHp(content, player) / 2);
  const boss = createPokemon(content, def.species[0]!, 10, 'e1');
  applyBossHp(def, boss);
  boss.hp = maxHp(content, boss);
  const battle = createBattle('wild', [boss], 0, player.uid);
  battle.raid = freshRaidBattle(def);
  const party: PokemonInstance[] = [player];
  const ctx: BattleContext = { content, battle, party, inventory: { potion: 3 }, rng: new Rng(hashSeed(raidId)), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  return { def, player, boss, battle, ctx };
}

describe('raid field rules', () => {
  it('the elemental surge boosts only the boss and only its type', () => {
    const { battle } = fight('storm-gyarados');
    expect(raidFieldMultiplier(content, battle, 'enemy', 'water')).toBe(1.25);
    expect(raidFieldMultiplier(content, battle, 'enemy', 'fire')).toBe(1);
    expect(raidFieldMultiplier(content, battle, 'player', 'water')).toBe(1);
  });

  it('the weakness rotates with the turn number and boosts your hits of that type', () => {
    const { battle } = fight('crystal-golem');
    expect(rotatingWeakness(content, battle)!.type).toBe('water');
    expect(raidFieldMultiplier(content, battle, 'player', 'water')).toBe(1.5);
    expect(raidFieldMultiplier(content, battle, 'player', 'grass')).toBe(1);
    battle.turn = 3;
    expect(rotatingWeakness(content, battle)!.type).toBe('grass');
    battle.turn = 9;
    expect(rotatingWeakness(content, battle)!.type).toBe('water');
  });

  it('a raid with no rules changes nothing', () => {
    const { battle } = fight('sleeping-snorlax');
    expect(raidFieldMultiplier(content, battle, 'enemy', 'normal')).toBe(1);
    expect(rotatingWeakness(content, battle)).toBeNull();
  });

  it('healing restriction blocks healing items and the Healing cheer', () => {
    const { ctx, battle } = fight('sandstorm-tyranitar');
    expect(itemProblem(ctx, 'potion', 0)).toMatch(/restricted/);
    expect(cheerProblem(content, battle, 'healing')).toMatch(/restricted/);
    expect(cheerProblem(content, battle, 'offense')).toBeNull();
    const free = fight('sleeping-snorlax');
    expect(itemProblem(free.ctx, 'potion', 0)).toBeNull();
  });

  it('bosses can know more than four moves', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'xm', seed: 'xm', archetypeId: 'red' }), 0);
    const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
    node.sides.push({ id: 'raid-x', kind: 'raid', raidId: 'sky-pillar-apex', used: false });
    run.stage!.current = node.id;
    run.money = 99999;
    const started = enterRaid(content, run, 'raid-x');
    const boss = started.battle!.enemyTeam[0]!;
    expect(boss.moves.length).toBeGreaterThan(4);
    expect(boss.moves.length).toBeLessThanOrEqual(6);
  });
});

describe('cheers', () => {
  it('Offense lasts a few turns, costs one cheer and the turn', () => {
    const { ctx, battle } = fight('sleeping-snorlax');
    resolveTurn(ctx, { kind: 'cheer', cheer: 'offense' });
    expect(battle.raid!.cheersLeft).toBe(2);
    expect(raidFieldMultiplier(content, battle, 'player', 'normal')).toBeCloseTo(battle.raid!.cheerOffense > 0 ? 1.3 : 1);
    expect(battle.raid!.cheerOffense).toBeGreaterThan(0);
    resolveTurn(ctx, { kind: 'idle' });
    resolveTurn(ctx, { kind: 'idle' });
    resolveTurn(ctx, { kind: 'idle' });
    expect(battle.raid!.cheerOffense).toBe(0);
  });

  it('Healing restores HP and cures status; three cheers at most', () => {
    const { ctx, player, battle } = fight('sleeping-snorlax');
    player.status = { id: 'par' } as never;
    const before = player.hp;
    resolveTurn(ctx, { kind: 'cheer', cheer: 'healing' });
    expect(player.status).toBeNull();
    expect(player.hp).toBeGreaterThan(before - 1);
    resolveTurn(ctx, { kind: 'cheer', cheer: 'defense' });
    resolveTurn(ctx, { kind: 'cheer', cheer: 'defense' });
    expect(battle.raid!.cheersLeft).toBe(0);
    expect(() => resolveTurn(ctx, { kind: 'cheer', cheer: 'offense' })).toThrow(/No cheers/);
  });

  it('cheers only exist in raids', () => {
    const { ctx, battle } = fight('sleeping-snorlax');
    delete battle.raid;
    expect(() => resolveTurn(ctx, { kind: 'cheer', cheer: 'offense' })).toThrow();
  });
});

describe('raid capture jingle', () => {
  it('picks a jingle by tier', () => {
    expect(raidCaptureTrack(1)).toBe('bgm.raid.capture.basic');
    expect(raidCaptureTrack(3)).toBe('bgm.raid.capture.ultra');
    expect(raidCaptureTrack(4)).toBe('bgm.raid.capture.max');
    expect(raidCaptureTrack(6)).toBe('bgm.raid.capture.tera');
  });
});
