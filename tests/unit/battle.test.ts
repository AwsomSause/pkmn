import { describe, expect, it } from 'vitest';
import { createWildBattle, resolveTurn, type BattleEvent } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function setup(playerSpecies: string, playerLevel: number, enemySpecies: string, enemyLevel: number, seed = 'battle') {
  const player = createPokemon(content, playerSpecies, playerLevel, 'p1');
  const enemy = createPokemon(content, enemySpecies, enemyLevel, 'e1');
  const party: PokemonInstance[] = [player];
  const battle = createWildBattle(enemy, 0, player.uid);
  const rng = new Rng(hashSeed(seed));
  return { player, enemy, party, battle, ctx: { content, battle, party, rng } };
}

function setMoves(mon: PokemonInstance, ...ids: string[]) {
  mon.moves = ids.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
}

describe('battle engine', () => {
  it('a full battle ends in a win or a loss with HP never negative', () => {
    for (let s = 0; s < 30; s++) {
      const { battle, ctx, player, enemy } = setup('charmander', 8, 'rattata', 6, `full-${s}`);
      let guard = 0;
      while (!battle.outcome && guard++ < 200) {
        const move = player.moves.findIndex((m) => m.pp > 0);
        resolveTurn(ctx, move);
        expect(player.hp).toBeGreaterThanOrEqual(0);
        expect(enemy.hp).toBeGreaterThanOrEqual(0);
      }
      expect(battle.outcome === 'win' || battle.outcome === 'lose').toBe(true);
    }
  });

  it('the same seed and choices produce the same events', () => {
    const a = setup('squirtle', 7, 'pidgey', 7, 'same');
    const b = setup('squirtle', 7, 'pidgey', 7, 'same');
    for (let i = 0; i < 3 && !a.battle.outcome; i++) {
      expect(resolveTurn(a.ctx, 0)).toEqual(resolveTurn(b.ctx, 0));
    }
  });

  it('priority moves go first even against a faster Pokémon', () => {
    const { ctx, player, enemy } = setup('rattata', 5, 'diglett', 30);
    setMoves(player, 'quick-attack');
    setMoves(enemy, 'scratch');
    const events = resolveTurn(ctx, 0);
    const firstMove = events.find((e) => e.type === 'move');
    expect(firstMove).toMatchObject({ side: 'player', moveId: 'quick-attack' });
  });

  it('the faster Pokémon moves first at equal priority', () => {
    const { ctx, player, enemy } = setup('caterpie', 5, 'diglett', 20);
    setMoves(player, 'tackle');
    setMoves(enemy, 'growl');
    const events = resolveTurn(ctx, 0);
    expect(events.find((e) => e.type === 'move')).toMatchObject({ side: 'enemy' });
  });

  it('immune targets take no damage', () => {
    const { ctx, player, enemy } = setup('rattata', 10, 'gastly', 10);
    setMoves(player, 'tackle');
    setMoves(enemy, 'night-shade');
    const before = enemy.hp;
    const events = resolveTurn(ctx, 0);
    expect(events.some((e) => e.type === 'noEffect' && e.side === 'enemy')).toBe(true);
    expect(enemy.hp).toBe(before);
  });

  it('night shade deals damage equal to the user level', () => {
    const { ctx, player, enemy } = setup('gastly', 12, 'pidgey', 50);
    setMoves(player, 'night-shade');
    setMoves(enemy, 'sand-attack');
    const before = enemy.hp;
    const events = resolveTurn(ctx, 0);
    const dmg = events.find((e): e is Extract<BattleEvent, { type: 'damage' }> => e.type === 'damage' && e.side === 'enemy');
    if (dmg) expect(before - enemy.hp).toBe(12);
  });

  it('PP goes down by one per use and an empty move cannot be chosen', () => {
    const { ctx, player } = setup('bulbasaur', 5, 'caterpie', 2);
    const before = player.moves[0]!.pp;
    resolveTurn(ctx, 0);
    expect(player.moves[0]!.pp).toBe(before - 1);
    player.moves[0]!.pp = 0;
    expect(() => resolveTurn(ctx, 0)).toThrow(/no PP/);
  });

  it('Struggle is only allowed when every move is out of PP, and causes recoil', () => {
    const { ctx, player, enemy } = setup('machop', 20, 'geodude', 20);
    expect(() => resolveTurn(ctx, -1)).toThrow(/Struggle/);
    for (const m of player.moves) m.pp = 0;
    setMoves(enemy, 'defense-curl');
    const events = resolveTurn(ctx, -1);
    expect(events.some((e) => e.type === 'recoil' && e.side === 'player')).toBe(true);
  });

  it('status moves inflict status, and a second status fails', () => {
    const { ctx, player, enemy } = setup('magnemite', 20, 'rattata', 20, 'twave');
    setMoves(player, 'thunder-wave');
    setMoves(enemy, 'tail-whip');
    let tries = 0;
    while (!enemy.status && tries++ < 10) resolveTurn(ctx, 0);
    expect(enemy.status?.id).toBe('par');
    const events = resolveTurn(ctx, 0);
    if (events.some((e) => e.type === 'move' && e.side === 'player')) {
      expect(events.some((e) => e.type === 'fail' || e.type === 'miss')).toBe(true);
    }
  });

  it('grass types are immune to powder moves', () => {
    const { ctx, player, enemy } = setup('bulbasaur', 20, 'oddish', 20);
    setMoves(player, 'sleep-powder');
    setMoves(enemy, 'growth');
    for (let i = 0; i < 8; i++) resolveTurn(ctx, 0);
    expect(enemy.status).toBeNull();
  });

  it('poison deals 1/8 max HP at the end of the turn', () => {
    const { ctx, player, enemy } = setup('bulbasaur', 20, 'rattata', 20);
    setMoves(player, 'growl');
    setMoves(enemy, 'tail-whip');
    enemy.status = { id: 'psn' };
    const max = enemy.hp;
    const events = resolveTurn(ctx, 0);
    const residual = events.find((e) => e.type === 'residual' && e.side === 'enemy');
    expect(residual).toMatchObject({ amount: Math.floor(max / 8) });
  });

  it('sleeping Pokémon skip turns and then wake up', () => {
    const { ctx, player, enemy } = setup('bulbasaur', 20, 'rattata', 20);
    setMoves(player, 'growl');
    setMoves(enemy, 'tail-whip');
    enemy.status = { id: 'slp', turns: 2 };
    const t1 = resolveTurn(ctx, 0);
    const t2 = resolveTurn(ctx, 0);
    const t3 = resolveTurn(ctx, 0);
    expect(t1.some((e) => e.type === 'cant' && e.side === 'enemy')).toBe(true);
    expect(t2.some((e) => e.type === 'cant' && e.side === 'enemy')).toBe(true);
    expect(t3.some((e) => e.type === 'wake' && e.side === 'enemy')).toBe(true);
    expect(enemy.status).toBeNull();
  });

  it('stat stages stop at +6/-6', () => {
    const { ctx, player, enemy, battle } = setup('geodude', 30, 'caterpie', 30);
    setMoves(player, 'defense-curl');
    setMoves(enemy, 'string-shot');
    for (let i = 0; i < 8; i++) resolveTurn(ctx, 0);
    expect(battle.playerStages.def).toBe(6);
    const events = resolveTurn(ctx, 0);
    expect(events.some((e) => e.type === 'statLimit' && e.side === 'player')).toBe(true);
  });

  it('cannot act after the battle is over', () => {
    const { ctx, battle } = setup('bulbasaur', 5, 'caterpie', 2);
    battle.outcome = 'win';
    expect(() => resolveTurn(ctx, 0)).toThrow(/over/);
  });
});
