// Ideas W1 play rules: skill inputs, surrender deal, mind-read, grudge, spectator, arena hazards.
import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { aimAccuracy, arenaFor, dealOffer, shoutDamage, throwCatch } from '../../src/core/battle/w1Play';
import { createPokemon } from '../../src/core/pokemon';
import { Rng, hashSeed } from '../../src/core/rng';
import { content } from './helpers';

const mon = (species: string, level: number, moves: string[], uid = species) => {
  const m = createPokemon(content, species, level, uid);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
};
function setup(party: ReturnType<typeof mon>[], foes: ReturnType<typeof mon>[], kind: 'wild' | 'trainer' = 'wild') {
  const battle = kind === 'trainer' ? createBattle('trainer', foes, 0, party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null }) : createBattle('wild', foes, 0, party[0]!.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('p')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  return { ctx, battle, run: (a: Parameters<typeof resolveTurn>[1]) => resolveTurn(ctx, a) };
}
const kinds = (ev: ReturnType<typeof resolveTurn>) => ev.filter((e) => e.type === 'spectacle').map((e) => (e as { kind: string }).kind);

describe('skill grades', () => {
  it('aim only helps listed moves; shout only a signature; throw only a weakened foe', () => {
    expect(aimAccuracy(content, { kind: 'aim', grade: 'perfect' }, 'thunder')).toBeGreaterThan(1);
    expect(aimAccuracy(content, { kind: 'aim', grade: 'perfect' }, 'tackle')).toBe(1);
    expect(aimAccuracy(content, undefined, 'thunder')).toBe(1);
    expect(shoutDamage(content, { kind: 'shout', grade: 'perfect' }, true)).toBeGreaterThan(1);
    expect(shoutDamage(content, { kind: 'shout', grade: 'perfect' }, false)).toBe(1);
    expect(throwCatch(content, { kind: 'throw', grade: 'perfect' }, 0.3, false)).toBeGreaterThan(1);
    expect(throwCatch(content, { kind: 'throw', grade: 'perfect' }, 0.9, false)).toBe(1);
    expect(throwCatch(content, { kind: 'throw', grade: 'perfect' }, 0.9, true)).toBeGreaterThan(1);
  });
  it('a signature shout announces itself and hits harder than the same move without it', () => {
    const mk = () => {
      const me = mon('charizard', 50, ['flamethrower'], 'me');
      me.awakened = ['flamethrower'];
      return setup([me], [mon('snorlax', 80, ['splash'], 'foe')]);
    };
    const plain = mk();
    const shout = mk();
    const a = plain.run({ kind: 'move', index: 0 });
    const b = shout.run({ kind: 'move', index: 0, skill: { kind: 'shout', grade: 'perfect' } });
    expect(kinds(b)).toContain('shout');
    const dmg = (ev: ReturnType<typeof resolveTurn>) => ev.filter((e) => e.type === 'damage' && e.side === 'enemy').reduce((n, e) => n + (e as { amount: number }).amount, 0);
    expect(dmg(b)).toBeGreaterThan(dmg(a));
  });
});

describe('surrender deal', () => {
  it('is offered to ordinary trainers on their last Pokémon at low HP; accepting wins with no faint, refusing keeps fighting', () => {
    const f = setup([mon('charizard', 50, ['flamethrower'], 'me')], [mon('rattata', 10, ['tackle'], 'foe')], 'trainer');
    expect(dealOffer(content, f.battle, 20, 20)).toBeNull();
    f.battle.enemyTeam[0]!.hp = 1;
    expect(dealOffer(content, f.battle, 1, 20)).not.toBeNull();
    f.run({ kind: 'deal', accept: false });
    expect(f.battle.dealRefused).toBe(true);
    expect(dealOffer(content, f.battle, 1, 20)).toBeNull();
    const g = setup([mon('charizard', 50, ['flamethrower'], 'me')], [mon('rattata', 10, ['tackle'], 'foe')], 'trainer');
    g.battle.enemyTeam[0]!.hp = 1;
    g.run({ kind: 'deal', accept: true });
    expect(g.battle.outcome).toBe('win');
    expect(g.battle.deal).toBe(true);
    expect(() => setup([mon('charizard', 50, ['flamethrower'], 'me')], [mon('rattata', 10, ['tackle'], 'foe')]).run({ kind: 'deal', accept: true })).toThrow();
  });
});

describe('mind-read, grudge, spectator', () => {
  it('a Psychic ally reads one foe move, once', () => {
    const f = setup([mon('alakazam', 50, ['psychic'], 'me')], [mon('snorlax', 80, ['body-slam', 'splash'], 'foe')]);
    const first = f.run({ kind: 'move', index: 0 });
    expect(kinds(first)).toContain('mindRead');
    expect(kinds(f.run({ kind: 'move', index: 0 }))).not.toContain('mindRead');
  });
  it('a grudge and a spectator each boost once', () => {
    const f = setup([mon('machamp', 50, ['tackle'], 'me')], [mon('snorlax', 80, ['splash'], 'foe')], 'trainer');
    f.battle.grudgeMons = ['me'];
    f.battle.spectator = { name: 'A passing hiker', used: false };
    const ev = f.run({ kind: 'move', index: 0 });
    expect(kinds(ev)).toEqual(expect.arrayContaining(['grudge', 'spectator']));
    expect(f.battle.playerStages.atk).toBeGreaterThanOrEqual(2);
    const again = f.run({ kind: 'move', index: 0 });
    expect(kinds(again)).not.toContain('grudge');
  });
});

describe('arena hazards', () => {
  it('rock/fire/water stages get an arena; it hits both sides every few turns until smashed; smashing hurts the foe once', () => {
    expect(arenaFor(content, 'rock-fire')).toBe('rocks');
    expect(arenaFor(content, 'normal-grass')).toBeNull();
    const f = setup([mon('machamp', 60, ['splash'], 'me')], [mon('snorlax', 80, ['splash'], 'foe')]);
    f.battle.arena = { kind: 'lava', spent: false };
    const hp0 = f.battle.enemyTeam[0]!.hp;
    let sawArena = false;
    for (let i = 0; i < 4 && !sawArena; i++) sawArena = kinds(f.run({ kind: 'move', index: 0 })).includes('arena');
    expect(sawArena).toBe(true);
    expect(f.battle.enemyTeam[0]!.hp).toBeLessThan(hp0);
    const before = f.battle.enemyTeam[0]!.hp;
    f.run({ kind: 'arena' });
    expect(f.battle.arena!.spent).toBe(true);
    expect(f.battle.enemyTeam[0]!.hp).toBeLessThan(before);
    expect(() => f.run({ kind: 'arena' })).toThrow();
  });
});
