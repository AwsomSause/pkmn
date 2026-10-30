// The last moves: weight moves, Beat Up, Hidden Power, berry moves, Mimic, Transform and Sky Drop.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { effectiveHeld } from '../../src/core/battle/held';
import { revertTransformations } from '../../src/core/battle/transform';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function duel(player: string, enemy: string, pMoves: string[], eMoves: string[] = ['splash'], bench = false) {
  const p = createPokemon(content, player, 50, 'p');
  const e = createPokemon(content, enemy, 50, 'e');
  const mv = (m: string) => ({ id: m, pp: content.moves.get(m)!.pp });
  p.moves = pMoves.map(mv);
  e.moves = eMoves.map(mv);
  const party = bench ? [p, createPokemon(content, 'pidgey', 50, 'b'), createPokemon(content, 'machop', 50, 'c')] : [p];
  const battle = createBattle('wild', [e], 0, p.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('m6')), captureRng: new Rng(hashSeed('m6c')), catchMultiplier: 1 };
  return { ctx, battle, p, e, go: (i = 0) => resolveTurn(ctx, { kind: 'move', index: i }) };
}
const dealt = (es: ReturnType<ReturnType<typeof duel>['go']>) => es.reduce((n, e) => (e.type === 'damage' && e.side === 'enemy' ? n + e.amount : n), 0);

describe('weight moves', () => {
  it('Low Kick hits a heavy target harder than a light one', () => {
    expect(dealt(duel('machop', 'snorlax', ['low-kick']).go())).toBeGreaterThan(dealt(duel('machop', 'pidgey', ['low-kick']).go()));
  });
  it('Heavy Slam is stronger for a heavy user', () => {
    expect(dealt(duel('snorlax', 'pidgey', ['heavy-slam']).go())).toBeGreaterThan(dealt(duel('pidgey', 'snorlax', ['heavy-slam']).go()));
  });
});

describe('Beat Up and Hidden Power', () => {
  it('Beat Up hits once for each healthy party member', () => {
    const d = duel('machop', 'snorlax', ['beat-up'], ['splash'], true);
    const es = d.go();
    const hits = es.find((e) => e.type === 'hits');
    expect(hits && hits.type === 'hits' && hits.count).toBe(3);
  });
  it('Hidden Power has the same type every time for one Pokémon', () => {
    const a = duel('machop', 'snorlax', ['hidden-power']);
    const b = duel('machop', 'snorlax', ['hidden-power']);
    expect(a.go().find((e) => e.type === 'damage')).toEqual(b.go().find((e) => e.type === 'damage'));
  });
});

describe('berry moves', () => {
  it('Stuff Cheeks eats the berry and raises Defense by 2', () => {
    const d = duel('machop', 'snorlax', ['stuff-cheeks']);
    d.p.held = { 'oran-berry': 1 };
    d.go();
    expect(d.battle.playerStages.def).toBe(2);
    expect(Object.keys(d.p.held ?? {})).toHaveLength(0);
  });
  it('Stuff Cheeks fails without a berry', () => {
    const d = duel('machop', 'snorlax', ['stuff-cheeks']);
    d.go();
    expect(d.battle.playerStages.def).toBe(0);
  });
  it('Natural Gift uses up the berry and takes its type', () => {
    const d = duel('machop', 'snorlax', ['natural-gift']);
    d.p.held = { 'cheri-berry': 1 };
    expect(dealt(d.go())).toBeGreaterThan(0);
    expect(Object.keys(effectiveHeld(d.ctx, d.p))).toHaveLength(0);
  });
});

describe('Mimic and Transform', () => {
  it('Mimic copies the foe\'s last move and gives it back after the battle', () => {
    const d = duel('machop', 'snorlax', ['mimic'], ['tackle']);
    d.battle.enemyVolatile.lastMove = 'tackle';
    d.go();
    expect(d.p.moves[0]!.id).toBe('tackle');
    revertTransformations(content, d.battle, d.ctx.party);
    expect(d.p.moves[0]!.id).toBe('mimic');
  });
  it('Transform copies the form and moves, and reverts afterwards', () => {
    const d = duel('machop', 'snorlax', ['transform'], ['tackle']);
    d.go();
    expect(d.p.speciesId).toBe('snorlax');
    expect(d.p.moves[0]!.id).toBe('tackle');
    expect(d.p.moves[0]!.pp).toBeLessThanOrEqual(5);
    revertTransformations(content, d.battle, d.ctx.party);
    expect(d.p.speciesId).toBe('machop');
    expect(d.p.moves[0]!.id).toBe('transform');
  });
  it('Imposter transforms on entry', () => {
    const p = createPokemon(content, 'machop', 50, 'p');
    p.moves = [{ id: 'splash', pp: 40 }];
    const e = createPokemon(content, 'snorlax', 50, 'e');
    e.moves = [{ id: 'splash', pp: 40 }];
    const battle = createBattle('wild', [e], 0, p.uid);
    battle.playerVolatile.abilityOverride = 'imposter';
    const ctx: BattleContext = { content, battle, party: [p], inventory: {}, rng: new Rng(hashSeed('imp')), captureRng: new Rng(hashSeed('impc')), catchMultiplier: 1 };
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(p.speciesId).toBe('snorlax');
  });
});

describe('Sky Drop and Springtide Storm', () => {
  it('Sky Drop takes a turn to lift, then hits', () => {
    const d = duel('machop', 'pikachu', ['sky-drop']);
    expect(dealt(d.go())).toBe(0);
    const second = d.go();
    expect(dealt(second)).toBeGreaterThan(0);
  });
  it('Sky Drop fails on a very heavy target', () => {
    expect(duel('machop', 'snorlax', ['sky-drop']).go().some((e) => e.type === 'fail')).toBe(true);
  });
  it('Sky Drop fails on a Flying type', () => {
    const d = duel('machop', 'pidgey', ['sky-drop']);
    expect(d.go().some((e) => e.type === 'fail')).toBe(true);
  });
  it('Springtide Storm is usable', () => {
    expect(content.moves.get('springtide-storm')!.supported).not.toBe(false);
  });
});

describe('limits removed', () => {
  it('Sky Drop keeps a slower target from acting while it is held', () => {
    const d = duel('pikachu', 'machop', ['sky-drop'], ['tackle']);
    const first = d.go();
    const hits = (es: typeof first) => es.filter((e) => e.type === 'damage' && e.side === 'player').length;
    expect(hits(first)).toBe(0);
    expect(d.battle.enemyVolatile.skyHeld).toBe(true);
    expect(hits(d.go())).toBe(0);
    expect(d.battle.enemyVolatile.skyHeld).toBe(false);
  });
  it('Mycelium Might lets a status move through Good as Gold', () => {
    const d = duel('machop', 'snorlax', ['growl']);
    d.battle.playerVolatile.abilityOverride = 'mycelium-might';
    d.battle.enemyVolatile.abilityOverride = 'good-as-gold';
    d.go();
    expect(d.battle.enemyStages.atk).toBe(-1);
  });
});

describe('Attract and held story items', () => {
  it('Attract makes the target miss turns now and then', () => {
    const d = duel('machop', 'snorlax', ['attract'], ['splash']);
    d.go();
    expect(d.battle.enemyVolatile.infatuated).toBe(true);
    let stuck = 0;
    for (let i = 0; i < 12; i++) if (d.go().some((e) => e.type === 'cant' && e.reason === 'infatuation')) stuck++;
    expect(stuck).toBeGreaterThan(0);
    expect(stuck).toBeLessThan(12);
  });
  it('Oblivious ignores Attract', () => {
    const d = duel('machop', 'snorlax', ['attract']);
    d.battle.enemyVolatile.abilityOverride = 'oblivious';
    d.go();
    expect(d.battle.enemyVolatile.infatuated).toBe(false);
  });
  it('Griseous Orb turns Giratina into Origin Forme in battle', () => {
    const d = duel('giratina', 'snorlax', ['splash']);
    d.p.held = { 'griseous-orb': 1 };
    d.go();
    expect(d.p.speciesId).toBe('giratina-origin');
  });
  it('Keldeo Resolution turns Keldeo into its Resolute form in battle', () => {
    const d = duel('keldeo', 'snorlax', ['splash']);
    d.p.held = { 'keldeo-resolution': 1 };
    d.go();
    expect(d.p.speciesId).toBe('keldeo-resolute');
  });
});
