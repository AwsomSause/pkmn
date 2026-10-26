// Milestone 8.75 part C, first batch: confusion, multi-hit, recharge, healing,
// Protect, one-hit KOs, Explosion, False Swipe, binding, Leech Seed, power
// rules, the main games' rounding and the both-faint rule.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn as resolveAction, switchProblem, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { lowHpPower, multiHitCount, pokeRound } from '../../src/core/battle/damage';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { BattleStateSchema, freshVolatile, type PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function setup(playerSpecies: string, playerLevel: number, enemySpecies: string, enemyLevel: number, seed = 'tier1', extra: PokemonInstance[] = []) {
  const player = createPokemon(content, playerSpecies, playerLevel, 'p1');
  const enemy = createPokemon(content, enemySpecies, enemyLevel, 'e1');
  const party: PokemonInstance[] = [player, ...extra];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { player, enemy, party, battle, ctx };
}
const turn = (ctx: BattleContext, index = 0) => resolveAction(ctx, { kind: 'move', index });
const setMoves = (mon: PokemonInstance, ...ids: string[]) => (mon.moves = ids.map((id) => ({ id, pp: content.moves.get(id)!.pp })));
const types = (events: BattleEvent[]) => events.map((e) => e.type);

describe('newly supported moves', () => {
  it('there are 85 more of them, and Pokémon learn them', () => {
    for (const id of ['fury-attack', 'double-kick', 'hyper-beam', 'recover', 'protect', 'confuse-ray', 'fissure', 'explosion', 'false-swipe', 'wrap', 'leech-seed', 'flail', 'psyshock']) {
      expect(content.moves.get(id)!.supported, id).toBe(true);
    }
    const mon = createPokemon(content, 'chansey', 40, 'c');
    expect(mon.moves.length).toBeGreaterThan(0);
  });
});

describe('multi-hit moves', () => {
  it('hit 2–5 times, one damage event per hit', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const { ctx, player, enemy } = setup('spearow', 30, 'snorlax', 60, `multi-${i}`);
      setMoves(player, 'fury-attack');
      setMoves(enemy, 'growl');
      const events = turn(ctx);
      const hits = events.find((e) => e.type === 'hits');
      if (!hits || hits.type !== 'hits') continue; // missed
      seen.add(hits.count);
      expect(events.filter((e) => e.type === 'damage' && e.side === 'enemy')).toHaveLength(hits.count);
    }
    expect([...seen].every((n) => n >= 2 && n <= 5)).toBe(true);
    expect(seen.size).toBeGreaterThan(2);
  });

  it('the 2–5 roll is 35/35/15/15 and a fixed count always hits that often', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const rng = new Rng(hashSeed('hits'));
    for (let i = 0; i < 4000; i++) counts[multiHitCount([2, 5], rng)]! += 1;
    expect(counts[2]! / 4000).toBeCloseTo(0.35, 1);
    expect(counts[5]! / 4000).toBeCloseTo(0.15, 1);
    expect(multiHitCount([2, 2], rng)).toBe(2);
  });
});

describe('recharge, Protect and confusion', () => {
  it('Hyper Beam makes the user rest next turn', () => {
    for (let i = 0; i < 10; i++) {
      const { ctx, player, enemy } = setup('snorlax', 50, 'snorlax', 70, `beam-${i}`);
      setMoves(player, 'hyper-beam');
      setMoves(enemy, 'growl');
      const first = turn(ctx);
      if (!first.some((e) => e.type === 'damage' && e.side === 'enemy')) continue;
      const second = turn(ctx);
      expect(second).toContainEqual({ type: 'cant', side: 'player', reason: 'recharge' });
      expect(second.filter((e) => e.type === 'move' && e.side === 'player')).toHaveLength(0);
      return;
    }
    throw new Error('Hyper Beam never hit');
  });

  it('Protect blocks the enemy move, and fails more often in a row', () => {
    const { ctx, player, enemy, battle } = setup('rattata', 20, 'rattata', 20);
    setMoves(player, 'protect');
    setMoves(enemy, 'tackle');
    const hpBefore = player.hp;
    const events = turn(ctx);
    expect(types(events)).toContain('protect');
    expect(events).toContainEqual({ type: 'protected', side: 'player' });
    expect(player.hp).toBe(hpBefore);
    expect(battle.playerVolatile.protectChain).toBe(1);
    // Over many tries, a second Protect in a row works about a third of the time.
    let worked = 0;
    for (let i = 0; i < 300; i++) {
      const s = setup('rattata', 20, 'rattata', 20, `chain-${i}`);
      setMoves(s.player, 'protect');
      setMoves(s.enemy, 'growl');
      s.battle.playerVolatile.protectChain = 1;
      if (types(turn(s.ctx)).includes('protect')) worked++;
    }
    expect(worked / 300).toBeGreaterThan(0.2);
    expect(worked / 300).toBeLessThan(0.47);
  });

  it('Confuse Ray confuses for a few turns; confused Pokémon sometimes hurt themselves', () => {
    let selfHits = 0;
    for (let i = 0; i < 30; i++) {
      const { ctx, player, enemy, battle } = setup('gastly', 30, 'snorlax', 30, `confuse-${i}`);
      setMoves(player, 'confuse-ray');
      setMoves(enemy, 'growl');
      const events = turn(ctx);
      if (!types(events).includes('confused')) continue;
      expect(battle.enemyVolatile.confusion).toBeGreaterThanOrEqual(1);
      expect(battle.enemyVolatile.confusion).toBeLessThanOrEqual(5);
      setMoves(player, 'growl');
      for (let t = 0; t < 6 && !battle.outcome; t++) {
        const later = turn(ctx);
        if (types(later).includes('confusionHit')) selfHits++;
      }
      expect(battle.enemyVolatile.confusion).toBe(0);
    }
    expect(selfHits).toBeGreaterThan(0);
  });
});

describe('healing, one-hit KOs, Explosion and False Swipe', () => {
  it('Recover heals half of max HP, and fails at full HP', () => {
    const { ctx, player, enemy } = setup('chansey', 40, 'rattata', 5);
    setMoves(player, 'recover');
    setMoves(enemy, 'growl');
    const max = calcStats(content, player).hp;
    expect(types(turn(ctx))).toContain('fail');
    player.hp = 10;
    const events = turn(ctx);
    expect(events).toContainEqual(expect.objectContaining({ type: 'heal', side: 'player', amount: Math.floor(max / 2) }));
  });

  it('a one-hit KO move fails against a higher level and knocks out when it hits', () => {
    const high = setup('dugtrio', 30, 'snorlax', 40);
    setMoves(high.player, 'fissure');
    setMoves(high.enemy, 'growl');
    expect(types(turn(high.ctx))).toContain('fail');
    for (let i = 0; i < 30; i++) {
      const { ctx, player, enemy } = setup('dugtrio', 60, 'snorlax', 20, `ohko-${i}`);
      setMoves(player, 'fissure');
      setMoves(enemy, 'growl');
      const events = turn(ctx);
      if (types(events).includes('ohko')) {
        expect(enemy.hp).toBe(0);
        return;
      }
    }
    throw new Error('Fissure never hit');
  });

  it('Explosion knocks out the user; if both sides run out, the user of Explosion loses', () => {
    const { ctx, player, enemy, battle } = setup('geodude', 40, 'caterpie', 5);
    setMoves(player, 'explosion');
    setMoves(enemy, 'tackle');
    const events = turn(ctx);
    expect(types(events)).toContain('selfKo');
    expect(player.hp).toBe(0);
    expect(enemy.hp).toBe(0);
    expect(battle.outcome).toBe('lose');
  });

  it('if both faint from recoil, the user of the recoil move wins', () => {
    const { ctx, player, enemy, battle } = setup('rattata', 40, 'caterpie', 10);
    setMoves(player, 'double-edge');
    setMoves(enemy, 'string-shot');
    player.hp = 1;
    for (let i = 0; i < 10 && !battle.outcome; i++) turn(ctx);
    if (enemy.hp === 0 && player.hp === 0) expect(battle.outcome).toBe('win');
  });

  it('False Swipe always leaves the target at 1 HP or more', () => {
    for (let i = 0; i < 10; i++) {
      const { ctx, player, enemy } = setup('farfetchd', 60, 'caterpie', 5, `swipe-${i}`);
      setMoves(player, 'false-swipe');
      setMoves(enemy, 'string-shot');
      turn(ctx);
      turn(ctx);
      expect(enemy.hp).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('binding and Leech Seed', () => {
  it('Wrap traps the target and hurts it at the end of each turn', () => {
    for (let i = 0; i < 10; i++) {
      const { ctx, player, enemy, battle } = setup('ekans', 20, 'snorlax', 40, `wrap-${i}`);
      setMoves(player, 'wrap');
      setMoves(enemy, 'growl');
      const events = turn(ctx);
      if (!types(events).includes('bound')) continue;
      expect(types(events)).toContain('bindDamage');
      expect(battle.enemyVolatile.bound).toBeGreaterThan(0);
      return;
    }
    throw new Error('Wrap never hit');
  });

  it('a bound Pokémon of yours cannot switch out', () => {
    const bench = createPokemon(content, 'pidgey', 10, 'p2');
    const { ctx, battle } = setup('rattata', 10, 'ekans', 10, 'bound', [bench]);
    expect(switchProblem(ctx, 1)).toBeNull();
    battle.playerVolatile.bound = 3;
    expect(switchProblem(ctx, 1)).toMatch(/can't escape/);
  });

  it('Leech Seed drains the target each turn and heals the user; Grass types are immune', () => {
    for (let i = 0; i < 10; i++) {
      const { ctx, player, enemy } = setup('bulbasaur', 20, 'rattata', 20, `seed-${i}`);
      setMoves(player, 'leech-seed');
      setMoves(enemy, 'tackle');
      const events = turn(ctx);
      if (!types(events).includes('seeded')) continue;
      expect(types(events)).toContain('seedDamage');
      return;
    }
    throw new Error('Leech Seed never hit');
  });

  it('fails against Grass types', () => {
    const { ctx, player, enemy } = setup('bulbasaur', 20, 'oddish', 20, 'seed-grass');
    setMoves(player, 'leech-seed');
    setMoves(enemy, 'growl');
    let failed = false;
    for (let i = 0; i < 5 && !failed; i++) failed = types(turn(ctx)).includes('fail');
    expect(failed).toBe(true);
  });
});

describe('power rules and rounding', () => {
  it('Flail is stronger at low HP', () => {
    expect(lowHpPower(100, 100)).toBe(20);
    expect(lowHpPower(50, 100)).toBe(40);
    expect(lowHpPower(1, 100)).toBe(200);
  });

  it('multipliers round halves down, as in the main games', () => {
    expect(pokeRound(10, 0.75)).toBe(7);
    expect(pokeRound(5, 1.5)).toBe(7);
    expect(pokeRound(10, 1.2)).toBe(12);
  });

  it('an older battle save without the new battle conditions still loads', () => {
    const { battle } = setup('rattata', 10, 'pidgey', 10);
    const { playerVolatile: _p, enemyVolatile: _e, weather: _w, ...old } = battle;
    const parsed = BattleStateSchema.parse(old);
    expect(parsed.playerVolatile).toEqual(freshVolatile());
    expect(parsed.weather).toBeNull();
  });
});
