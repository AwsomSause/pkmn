// Features catch-up, everything-left PR: moves with fixed damage, half-HP damage and power rules.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function run(move: string, opts: { enemyStatus?: 'psn' | 'par'; enemyHp?: number; userHp?: number; seed?: string } = {}) {
  const player = createPokemon(content, 'rattata', 50, 'p');
  player.moves = [{ id: move, pp: content.moves.get(move)!.pp }];
  if (opts.userHp) player.hp = opts.userHp;
  const enemy = createPokemon(content, 'snorlax', 50, 'e');
  if (opts.enemyStatus) enemy.status = { id: opts.enemyStatus, turns: 0 } as never;
  if (opts.enemyHp) enemy.hp = opts.enemyHp;
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed(opts.seed ?? 'm3')), captureRng: new Rng(hashSeed('m3c')), catchMultiplier: 1 };
  const events = resolveTurn(ctx, { kind: 'move', index: 0 });
  const lost = events.reduce((n, e) => (e.type === 'damage' && e.side === 'enemy' ? n + e.amount : n), 0);
  return { battle, lost, events, player };
}

describe('power rules, fixed damage and half-HP moves', () => {
  it('Sonic Boom always does 20', () => {
    expect(run('sonic-boom').lost).toBe(20);
  });
  it('Super Fang takes off half of the current HP', () => {
    const r = run('super-fang', { enemyHp: 100 });
    expect(r.lost).toBe(50);
  });
  it('Venoshock hits about twice as hard against a poisoned target', () => {
    const plain = run('venoshock').lost;
    const poisoned = run('venoshock', { enemyStatus: 'psn' }).lost;
    expect(poisoned / plain).toBeGreaterThan(1.7);
    expect(poisoned / plain).toBeLessThan(2.3);
  });
  it('Smelling Salts cures the paralysis it punishes', () => {
    const r = run('smelling-salts', { enemyStatus: 'par' });
    expect(r.battle.enemyTeam[0]!.status).toBeNull();
  });
  it('Steel Roller fails with no terrain', () => {
    const r = run('steel-roller');
    expect(r.lost).toBe(0);
    expect(r.events.some((e) => e.type === 'fail')).toBe(true);
  });
  it('Eruption is weaker when the user is hurt', () => {
    const full = run('eruption').lost;
    const hurt = run('eruption', { userHp: 5 }).lost;
    expect(hurt).toBeLessThan(full);
  });
});

describe('screens, hazards and side moves', () => {
  function two(playerMove: string, enemyMove = 'tackle', enemySpecies = 'snorlax') {
    const player = createPokemon(content, 'rattata', 50, 'p');
    player.moves = [{ id: playerMove, pp: content.moves.get(playerMove)!.pp }];
    const enemy = createPokemon(content, enemySpecies, 50, 'e');
    enemy.moves = [{ id: enemyMove, pp: content.moves.get(enemyMove)!.pp }];
    const battle = createBattle('wild', [enemy], 0, player.uid);
    const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m3s')), captureRng: new Rng(hashSeed('m3sc')), catchMultiplier: 1 };
    return { ctx, battle, player, enemy };
  }

  it('Reflect halves physical damage for five turns', () => {
    const a = two('reflect');
    const withReflect = resolveTurn(a.ctx, { kind: 'move', index: 0 }).filter((e) => e.type === 'damage' && e.side === 'player');
    const b = two('splash');
    const without = resolveTurn(b.ctx, { kind: 'move', index: 0 }).filter((e) => e.type === 'damage' && e.side === 'player');
    expect(a.battle.sideEffects.player.reflect).toBe(4);
    const amount = (es: typeof withReflect) => es.reduce((n, e) => (e.type === 'damage' ? n + e.amount : n), 0);
    expect(amount(withReflect)).toBeLessThan(amount(without));
  });

  it('Stealth Rock hurts what comes in; Spikes stack to three', () => {
    const { ctx, battle } = two('stealth-rock');
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.sideEffects.enemy.stealthRock).toBe(true);
    const sp = two('spikes');
    for (let i = 0; i < 4; i++) {
      sp.player.hp = 9999;
      resolveTurn(sp.ctx, { kind: 'move', index: 0 });
    }
    expect(sp.battle.sideEffects.enemy.spikes).toBe(3);
  });

  it('Rapid Spin clears the user\'s hazards', () => {
    const { ctx, battle } = two('rapid-spin');
    battle.sideEffects.player.stealthRock = true;
    battle.sideEffects.player.spikes = 2;
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.sideEffects.player.stealthRock).toBe(false);
    expect(battle.sideEffects.player.spikes).toBe(0);
  });

  it('Tailwind lasts four turns and Safeguard stops status', () => {
    const { ctx, battle } = two('tailwind', 'thunder-wave');
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.sideEffects.player.tailwind).toBe(3);
    const g = two('safeguard', 'thunder-wave');
    resolveTurn(g.ctx, { kind: 'move', index: 0 });
    expect(g.player.status).toBeNull();
  });
});
