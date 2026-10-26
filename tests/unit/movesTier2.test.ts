// Milestone 8.75 part C, second batch: two-turn moves, hiding (Fly, Dig),
// Thrash, weather, Weather Ball, weather healing and accuracy, and Fake Out.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn as resolveAction, switchProblem, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { calcDamage, pokeRound } from '../../src/core/battle/damage';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function setup(playerSpecies: string, playerLevel: number, enemySpecies: string, enemyLevel: number, seed = 'tier2', extra: PokemonInstance[] = []) {
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
const enemyHits = (events: BattleEvent[]) => events.filter((e) => e.type === 'damage' && e.side === 'enemy');

describe('two-turn moves', () => {
  it('Solar Beam charges, then attacks next turn whatever move is picked, using PP once', () => {
    const { ctx, player, enemy, battle } = setup('venusaur', 50, 'snorlax', 60);
    setMoves(player, 'solar-beam', 'tackle');
    setMoves(enemy, 'growl');
    const pp = player.moves[0]!.pp;
    const first = turn(ctx, 0);
    expect(first).toContainEqual({ type: 'charge', side: 'player', moveId: 'solar-beam', semi: null });
    expect(enemyHits(first)).toHaveLength(0);
    expect(battle.playerVolatile.charging).toBe('solar-beam');
    expect(switchProblem(ctx, 0)).not.toBeNull();
    const second = turn(ctx, 1); // picks Tackle, but must finish Solar Beam
    expect(second).toContainEqual({ type: 'move', side: 'player', moveId: 'solar-beam' });
    expect(enemyHits(second)).toHaveLength(1);
    expect(player.moves[0]!.pp).toBe(pp - 1);
    expect(player.moves[1]!.pp).toBe(content.moves.get('tackle')!.pp);
    expect(battle.playerVolatile.charging).toBeNull();
  });

  it('a Pokémon in the middle of a move cannot switch or use items', () => {
    const bench = createPokemon(content, 'pidgey', 10, 'p2');
    const { ctx, player, enemy } = setup('venusaur', 50, 'snorlax', 60, 'stuck', [bench]);
    setMoves(player, 'solar-beam');
    setMoves(enemy, 'growl');
    turn(ctx);
    expect(() => resolveAction(ctx, { kind: 'switch', partyIndex: 1 })).toThrow(/middle of a move/);
  });

  it('Solar Beam needs no charging in sun', () => {
    const { ctx, player, enemy, battle } = setup('venusaur', 50, 'snorlax', 60);
    setMoves(player, 'solar-beam');
    setMoves(enemy, 'growl');
    battle.weather = { id: 'sun', turns: 5 };
    const events = turn(ctx);
    expect(types(events)).not.toContain('charge');
    expect(enemyHits(events)).toHaveLength(1);
  });

  it('being unable to move cancels the second turn', () => {
    const { ctx, player, enemy, battle } = setup('venusaur', 50, 'snorlax', 60);
    setMoves(player, 'solar-beam');
    setMoves(enemy, 'growl');
    turn(ctx);
    player.status = { id: 'slp', turns: 2 };
    turn(ctx);
    expect(battle.playerVolatile.charging).toBeNull();
  });

  it('Fly hides the user in the air, where most moves miss it', () => {
    const { ctx, player, enemy, battle } = setup('pidgeot', 60, 'pidgey', 20);
    setMoves(player, 'fly');
    setMoves(enemy, 'tackle');
    const events = turn(ctx);
    expect(events).toContainEqual({ type: 'charge', side: 'player', moveId: 'fly', semi: 'air' });
    expect(events).toContainEqual({ type: 'avoided', side: 'player' });
    expect(battle.playerVolatile.semi).toBe('air');
    turn(ctx);
    expect(battle.playerVolatile.semi).toBeNull();
  });

  it('Earthquake reaches a Pokémon that dug underground', () => {
    for (let i = 0; i < 10; i++) {
      const { ctx, player, enemy } = setup('sandslash', 60, 'golem', 40, `dig-${i}`);
      setMoves(player, 'dig');
      setMoves(enemy, 'earthquake');
      const events = turn(ctx);
      if (types(events).includes('charge')) {
        expect(events.some((e) => e.type === 'damage' && e.side === 'player')).toBe(true);
        return;
      }
    }
    throw new Error('Dig never charged');
  });

  it('an enemy charging a move finishes it next turn, using PP once', () => {
    const { ctx, player, enemy, battle } = setup('snorlax', 80, 'pidgeot', 40);
    setMoves(player, 'growl');
    setMoves(enemy, 'fly');
    const first = turn(ctx);
    expect(first).toContainEqual({ type: 'charge', side: 'enemy', moveId: 'fly', semi: 'air' });
    expect(battle.enemyVolatile.charging).toBe('fly');
    turn(ctx);
    expect(battle.enemyVolatile.charging).toBeNull();
    expect(enemy.moves[0]!.pp).toBe(content.moves.get('fly')!.pp - 1);
  });
});

describe('Thrash', () => {
  it('locks the user in for 2–3 turns, then confuses it', () => {
    const s = setup('tauros', 30, 'snorlax', 80, 'thrash-2');
    setMoves(s.player, 'thrash');
    setMoves(s.enemy, 'growl');
    let thrashes = 0;
    let tired = false;
    for (let t = 0; t < 4 && !tired; t++) {
      const events = turn(s.ctx, 0);
      thrashes += events.filter((e) => e.type === 'move' && e.side === 'player').length;
      tired = types(events).includes('fatigue');
    }
    expect(tired).toBe(true);
    expect(thrashes === 2 || thrashes === 3).toBe(true);
    expect(s.battle.playerVolatile.confusion).toBeGreaterThan(0);
    expect(s.player.moves[0]!.pp).toBe(content.moves.get('thrash')!.pp - 1);
  });
});

describe('weather', () => {
  it('Rain Dance makes it rain for 5 turns', () => {
    const { ctx, player, enemy, battle } = setup('golduck', 40, 'snorlax', 80);
    setMoves(player, 'rain-dance');
    setMoves(enemy, 'growl');
    const events = turn(ctx);
    expect(events).toContainEqual({ type: 'weather', weather: 'rain' });
    expect(battle.weather).toEqual({ id: 'rain', turns: 4 });
    setMoves(player, 'growl');
    let ended = false;
    for (let t = 0; t < 4; t++) ended = types(turn(ctx)).includes('weatherEnd') || ended;
    expect(ended).toBe(true);
    expect(battle.weather).toBeNull();
  });

  it('rain and sun power Water and Fire moves up or down', () => {
    const base = { level: 50, power: 80, attack: 100, defense: 100, attackStage: 0, defenseStage: 0, stab: false, effectiveness: 1, crit: false, randomFactor: 100, burned: false, physical: false };
    const plain = calcDamage(content.ruleset, base);
    expect(calcDamage(content.ruleset, { ...base, weather: 1.5 })).toBeGreaterThan(plain);
    expect(calcDamage(content.ruleset, { ...base, weather: 0.5 })).toBeLessThan(plain);
    expect(pokeRound(37, 1.5)).toBe(55);
  });

  it('a sandstorm hurts Pokémon that are not Rock, Ground or Steel', () => {
    const { ctx, player, enemy } = setup('rattata', 30, 'geodude', 30);
    setMoves(player, 'sandstorm');
    setMoves(enemy, 'defense-curl');
    const events = turn(ctx);
    const hurt = events.filter((e) => e.type === 'weatherDamage');
    expect(hurt.map((e) => e.type === 'weatherDamage' && e.side)).toEqual(['player']);
  });

  it('Weather Ball turns into a Fire move in sun', () => {
    for (let i = 0; i < 10; i++) {
      const { ctx, player, enemy, battle } = setup('castform', 40, 'oddish', 40, `ball-${i}`);
      setMoves(player, 'weather-ball');
      setMoves(enemy, 'growl');
      battle.weather = { id: 'sun', turns: 5 };
      const hit = enemyHits(turn(ctx))[0];
      if (!hit || hit.type !== 'damage') continue;
      expect(hit.effectiveness).toBe(2);
      return;
    }
    throw new Error('Weather Ball never hit');
  });

  it('Synthesis heals two thirds in sun and a quarter in rain', () => {
    for (const [weather, fraction] of [['sun', 2 / 3], ['rain', 1 / 4]] as const) {
      const { ctx, player, enemy, battle } = setup('venusaur', 50, 'rattata', 5);
      setMoves(player, 'synthesis');
      setMoves(enemy, 'growl');
      battle.weather = { id: weather, turns: 5 };
      player.hp = 1;
      const max = calcStats(content, player).hp;
      expect(turn(ctx)).toContainEqual(expect.objectContaining({ type: 'heal', amount: Math.floor(max * fraction) }));
    }
  });

  it('Thunder never misses in rain', () => {
    for (let i = 0; i < 30; i++) {
      const { ctx, player, enemy, battle } = setup('raichu', 50, 'snorlax', 90, `thunder-${i}`);
      setMoves(player, 'thunder');
      setMoves(enemy, 'growl');
      battle.weather = { id: 'rain', turns: 5 };
      expect(types(turn(ctx))).not.toContain('miss');
    }
  });
});

describe('first-turn moves', () => {
  it('Fake Out flinches on the first turn and fails after', () => {
    const { ctx, player, enemy } = setup('meowth', 30, 'snorlax', 30);
    setMoves(player, 'fake-out');
    setMoves(enemy, 'tackle');
    const first = turn(ctx);
    expect(first).toContainEqual({ type: 'cant', side: 'enemy', reason: 'flinch' });
    const second = turn(ctx);
    expect(types(second)).toContain('fail');
  });
});
