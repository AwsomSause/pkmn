// Ideas W1: arena, deals and skill prompts in double battles.
import { describe, expect, it } from 'vitest';
import { createBattle, type BattleContext, type SlotCommand } from '../../src/core/battle/engine';
import { makeDoubles, resolveDoublesTurn } from '../../src/core/battle/doubles';
import { dealOffer, foeStake } from '../../src/core/battle/w1Play';
import { createPokemon } from '../../src/core/pokemon';
import { Rng, hashSeed } from '../../src/core/rng';
import { content } from './helpers';

const mk = (species: string, uid: string, level: number, move: string) => {
  const mon = createPokemon(content, species, level, uid);
  mon.moves = [{ id: move, pp: content.moves.get(move)!.pp }];
  return mon;
};

function setup(foeMove = 'splash') {
  const party = [mk('machamp', 'p0', 60, 'splash'), mk('machamp', 'p1', 60, 'splash')];
  const team = [mk('snorlax', 'e0', 80, foeMove), mk('snorlax', 'e1', 80, foeMove)];
  const battle = createBattle('trainer', team, 0, party[0]!.uid, { classId: 'youngster', name: 'Pat', leaderId: null });
  makeDoubles(battle, party);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('dbl')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  const move = (skill?: { kind: 'aim' | 'shout' | 'throw'; grade: 'miss' | 'ok' | 'good' | 'perfect' }): SlotCommand => ({ action: { kind: 'move', index: 0, ...(skill ? { skill } : {}) }, target: { side: 'enemy', spot: 0 } });
  return { ctx, battle, party, team, move, run: (a: Parameters<typeof resolveDoublesTurn>[1]) => resolveDoublesTurn(ctx, a) };
}

describe('doubles arena', () => {
  it('hits everyone on the field every few turns, and one ally can smash it for a big hit on both foes', () => {
    const f = setup();
    f.battle.arena = { kind: 'lava', spent: false };
    const before = f.team.map((m) => m.hp);
    let hurt = false;
    for (let i = 0; i < 4 && !hurt; i++) {
      const ev = f.run({ kind: 'double', commands: [{ action: { kind: 'idle' } }, { action: { kind: 'idle' } }] });
      hurt = ev.some((e) => e.type === 'spectacle' && e.kind === 'arena');
    }
    expect(hurt).toBe(true);
    expect(f.team.every((m, i) => m.hp < before[i]!)).toBe(true);
    const mid = f.team.map((m) => m.hp);
    f.run({ kind: 'double', commands: [{ action: { kind: 'arena' } }, { action: { kind: 'idle' } }] });
    expect(f.battle.arena!.spent).toBe(true);
    expect(f.team.every((m, i) => m.hp < mid[i]!)).toBe(true);
    expect(() => f.run({ kind: 'double', commands: [{ action: { kind: 'arena' } }, { action: { kind: 'idle' } }] })).toThrow();
  });
  it('only one Pokémon may smash per turn', () => {
    const f = setup();
    f.battle.arena = { kind: 'rocks', spent: false };
    expect(() => f.run({ kind: 'double', commands: [{ action: { kind: 'arena' } }, { action: { kind: 'arena' } }] })).toThrow();
  });
});

describe('doubles deal', () => {
  it('is offered when the whole foe team is nearly beaten; accepting ends the fight', () => {
    const f = setup();
    expect(foeStake(content, f.battle).hp).toBeGreaterThan(0);
    const s0 = foeStake(content, f.battle);
    expect(dealOffer(content, f.battle, s0.hp, s0.max)).toBeNull();
    for (const m of f.team) m.hp = 1;
    const s = foeStake(content, f.battle);
    expect(dealOffer(content, f.battle, s.hp, s.max)).not.toBeNull();
    f.run({ kind: 'deal', accept: false });
    expect(f.battle.dealRefused).toBe(true);
    const g = setup();
    for (const m of g.team) m.hp = 1;
    g.run({ kind: 'deal', accept: true });
    expect(g.battle.outcome).toBe('win');
    expect(g.battle.deal).toBe(true);
  });
});

describe('doubles skill prompts', () => {
  it('each Pokémon uses its own grade: a perfect shout on a signature hits harder than a miss', () => {
    const dmg = (grade: 'miss' | 'perfect') => {
      const f = setup();
      f.party[0]!.moves = [{ id: 'flamethrower', pp: 15 }];
      f.party[0]!.awakened = ['flamethrower'];
      const e0 = f.team[0]!;
      const start = e0.hp;
      const ev = f.run({ kind: 'double', commands: [f.move({ kind: 'shout', grade }), { action: { kind: 'idle' } }] });
      if (grade === 'perfect') expect(ev.some((e) => e.type === 'spectacle' && e.kind === 'shout')).toBe(true);
      return start - e0.hp;
    };
    expect(dmg('perfect')).toBeGreaterThan(dmg('miss'));
  });
});
