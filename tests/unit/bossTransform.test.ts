// Bosses use Z-Moves and Dynamax: an Elite Four ace unleashes a Z-Move once a battle,
// and the champion's ace Dynamaxes (3 turns, Max Moves, doubled HP).

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { bossMechanics } from '../../src/core/battle/transform';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function bossBattle(mechanic: 'zmove' | 'dynamax', seed = 'boss') {
  const player = createPokemon(content, 'snorlax', 80, 'p1');
  player.moves = [{ id: 'splash', pp: 40 }];
  const ace = createPokemon(content, 'charizard', 60, 'e1');
  ace.moves = [{ id: 'flamethrower', pp: 15 }, { id: 'growl', pp: 40 }];
  const party: PokemonInstance[] = [player];
  const battle = createBattle('trainer', [ace], 0, player.uid, { classId: 'elite-four', name: 'Test', leaderId: null });
  battle.transform.enemyMechanics = [mechanic];
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  return { ctx, battle, player, ace };
}
const turn = (ctx: BattleContext) => resolveTurn(ctx, { kind: 'move', index: 0 });

describe('boss mechanics list', () => {
  it('the Elite Four get Z-Moves and the champion gets Dynamax, on top of Mega and Tera; gym leaders get neither', () => {
    expect(bossMechanics(content, 'elite', 1, [])).toEqual(['mega', 'tera', 'zmove']);
    expect(bossMechanics(content, 'champion', 1, [])).toEqual(['mega', 'tera', 'dynamax']);
    expect(bossMechanics(content, 'gym', 9, [])).toEqual(['mega', 'tera']);
    expect(bossMechanics(content, 'elite', 1, ['zmove'])).toEqual(['mega', 'tera']);
    expect(bossMechanics(content, 'champion', 1, ['dynamax'])).toEqual(['mega', 'tera']);
  });
});

describe('boss Z-Move', () => {
  it("the ace's strongest damaging move becomes its Z-Move once, with a Z-Power event", () => {
    const { ctx, battle } = bossBattle('zmove');
    const first = turn(ctx);
    const z = first.find((e) => e.type === 'transform' && e.kind === 'zmove');
    expect(z).toMatchObject({ side: 'enemy', moveId: 'flamethrower' });
    expect(first.some((e) => e.type === 'move' && e.side === 'enemy' && e.moveId === content.zMoves.byType.fire)).toBe(true);
    expect(battle.transform.used.enemy).toContain('zmove');
    const second = turn(ctx);
    expect(second.some((e) => e.type === 'transform' && e.kind === 'zmove')).toBe(false);
    expect(second.some((e) => e.type === 'move' && e.side === 'enemy' && e.moveId === content.zMoves.byType.fire)).toBe(false);
  });

  it('is skipped when the run has Z-Moves switched off', () => {
    const { ctx } = bossBattle('zmove');
    ctx.disabledMechanics = ['zmove'];
    expect(turn(ctx).some((e) => e.type === 'transform' && e.kind === 'zmove')).toBe(false);
  });
});

describe('boss Dynamax', () => {
  it("the ace Dynamaxes: doubled HP, Max Moves for 3 turns, then back to normal size", () => {
    const { ctx, battle, ace } = bossBattle('dynamax');
    const normalHp = calcStats(content, ace).hp;
    const first = turn(ctx);
    expect(first.some((e) => e.type === 'transform' && e.side === 'enemy' && e.kind === 'dynamax')).toBe(true);
    expect(ace.dynamaxed).toBe(true);
    expect(calcStats(content, ace).hp).toBe(normalHp * 2);
    expect(first.some((e) => e.type === 'move' && e.side === 'enemy' && e.moveId.startsWith('max-'))).toBe(true);
    turn(ctx);
    const last = turn(ctx);
    expect(ace.dynamaxed).toBeUndefined();
    expect(last.some((e) => e.type === 'transform' && e.kind === 'dynamaxEnd')).toBe(true);
    expect(battle.transform.used.enemy).toContain('dynamax');
  });
});

describe('G-Max side effects', () => {
  function gmaxTurn(species: string, move: string, seed = 'gmax', prep?: (p: PokemonInstance) => void) {
    const player = createPokemon(content, species, 50, 'p1');
    prep?.(player);
    player.moves = [{ id: move, pp: 20 }];
    const enemy = createPokemon(content, 'machop', 90, 'e1');
    enemy.moves = [{ id: 'growl', pp: 40 }];
    const battle = createBattle('wild', [enemy], 0, player.uid);
    const ctx: BattleContext = { content, battle, party: [player], inventory: { 'dynamax-band': 1 }, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    const events = resolveTurn(ctx, { kind: 'move', index: 0, transform: { kind: 'dynamax' } });
    return { events, player, enemy };
  }

  it('G-Max Befuddle puts the target to sleep, poisons or paralyses it', () => {
    const { events, enemy } = gmaxTurn('butterfree', 'bug-bite');
    expect(events.some((e) => e.type === 'move' && e.moveId === 'g-max-befuddle')).toBe(true);
    expect(['par', 'psn', 'slp']).toContain(enemy.status?.id);
  });

  it('G-Max Finale heals the user, and G-Max Sweetness cures it', () => {
    const { events, player } = gmaxTurn('alcremie', 'dazzling-gleam', 'finale', (p) => (p.hp = 5));
    expect(events.some((e) => e.type === 'move' && e.moveId === 'g-max-finale')).toBe(true);
    expect(events.some((e) => e.type === 'heal' && e.side === 'player')).toBe(true);
    expect(player.hp).toBeGreaterThan(5);
    expect(content.maxMoves.gmax['g-max-finale']!.effects).toEqual({ heal: 0.1667 });
    expect(content.maxMoves.gmax['g-max-sweetness']!.effects).toEqual({ cureUser: true });
  });
});
