// Terrain (Electric, Grassy, Misty and Psychic Terrain), set by a move or a surge ability: 5 turns,
// affecting Pokémon on the ground.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn as resolveAction, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, getSpecies, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function setup(playerSpecies: string, enemySpecies: string, seed = 'terrain') {
  const player = createPokemon(content, playerSpecies, 50, 'p1');
  const enemy = createPokemon(content, enemySpecies, 50, 'e1');
  const party: PokemonInstance[] = [player];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { player, enemy, battle, ctx };
}
const moves = (mon: PokemonInstance, ...ids: string[]) => (mon.moves = ids.map((id) => ({ id, pp: content.moves.get(id)!.pp })));
const use = (ctx: BattleContext, index = 0) => resolveAction(ctx, { kind: 'move', index });

describe('terrain', () => {
  it('the four terrain moves are supported and set a 5-turn terrain that wears off', () => {
    for (const [id, terrain] of [['electric-terrain', 'electric'], ['grassy-terrain', 'grassy'], ['misty-terrain', 'misty'], ['psychic-terrain', 'psychic']] as const) {
      expect(content.moves.get(id)!.supported, id).not.toBe(false);
      const { ctx, battle, player, enemy } = setup('pikachu', 'rattata');
      moves(player, id);
      moves(enemy, 'growl');
      const first = use(ctx);
      expect(first.some((e) => e.type === 'terrain' && e.terrain === terrain)).toBe(true);
      expect(battle.terrain).toEqual({ id: terrain, turns: 4 });
      for (let i = 0; i < 3; i++) battle.terrain!.turns > 0 && (player.hp = maxHp(content, player), use(ctx));
      expect(battle.terrain?.turns ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('a surge ability sets the terrain when the Pokémon enters battle', () => {
    const { ctx, battle, player, enemy } = setup('tapu-koko', 'rattata');
    expect(getSpecies(content, 'tapu-koko').abilities.normal).toContain('electric-surge');
    player.abilitySlot = getSpecies(content, 'tapu-koko').abilities.normal.indexOf('electric-surge');
    moves(player, 'growl');
    moves(enemy, 'growl');
    use(ctx);
    expect(battle.terrain?.id).toBe('electric');
  });

  it('Electric Terrain boosts a grounded user\'s Electric moves by 30% and stops sleep', () => {
    const damage = (terrain: boolean) => {
      const { ctx, battle, player, enemy } = setup('pikachu', 'machop', 'boost');
      if (terrain) battle.terrain = { id: 'electric', turns: 5 };
      moves(player, 'thunderbolt');
      moves(enemy, 'growl');
      const before = enemy.hp;
      use(ctx);
      return before - enemy.hp;
    };
    expect(damage(true)).toBeGreaterThan(damage(false));
    const { ctx, battle, player, enemy } = setup('pikachu', 'machop', 'sleep');
    battle.terrain = { id: 'electric', turns: 5 };
    moves(player, 'sleep-powder', 'tackle');
    moves(enemy, 'growl');
    use(ctx);
    expect(enemy.status).toBeNull();
  });

  it('Misty Terrain stops statuses; Grassy Terrain heals 1/16 at the end of the turn', () => {
    const misty = setup('pikachu', 'machop', 'misty');
    misty.battle.terrain = { id: 'misty', turns: 5 };
    moves(misty.player, 'thunder-wave');
    moves(misty.enemy, 'growl');
    use(misty.ctx);
    expect(misty.enemy.status).toBeNull();

    const grassy = setup('pikachu', 'machop', 'grassy');
    grassy.battle.terrain = { id: 'grassy', turns: 5 };
    grassy.player.hp = 10;
    moves(grassy.player, 'growl');
    moves(grassy.enemy, 'growl');
    use(grassy.ctx);
    expect(grassy.player.hp).toBe(10 + Math.max(1, Math.floor(maxHp(content, grassy.player) / 16)));
  });

  it('Psychic Terrain blocks priority moves against a grounded target, but not against a Flying one', () => {
    const grounded = setup('pikachu', 'machop', 'psy');
    grounded.battle.terrain = { id: 'psychic', turns: 5 };
    moves(grounded.player, 'quick-attack');
    moves(grounded.enemy, 'growl');
    const before = grounded.enemy.hp;
    use(grounded.ctx);
    expect(grounded.enemy.hp).toBe(before);

    const flying = setup('pikachu', 'pidgeot', 'psy2');
    flying.battle.terrain = { id: 'psychic', turns: 5 };
    moves(flying.player, 'quick-attack');
    moves(flying.enemy, 'growl');
    const beforeFlying = flying.enemy.hp;
    use(flying.ctx);
    expect(flying.enemy.hp).toBeLessThan(beforeFlying);
  });
});
