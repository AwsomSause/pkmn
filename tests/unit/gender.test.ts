// Genders: stable per Pokémon, match the species ratio, and drive Attract, Cute Charm, Rivalry, Captivate and Love Ball.

import { describe, expect, it } from 'vitest';
import { evolutionTarget, itemEvolutionTargets } from '../../src/core/evolution';
import { genderOf, oppositeGender, sameGender } from '../../src/core/gender';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

describe('genders', () => {
  it('follow the species ratio, never change, and respect fixed and missing genders', () => {
    expect(genderOf(content, { uid: 'x', speciesId: 'magnemite' })).toBeNull();
    expect(genderOf(content, { uid: 'x', speciesId: 'nidoqueen' })).toBe('female');
    expect(genderOf(content, { uid: 'x', speciesId: 'nidoking' })).toBe('male');
    const first = genderOf(content, { uid: 'p7', speciesId: 'pikachu' });
    expect(genderOf(content, { uid: 'p7', speciesId: 'pikachu' })).toBe(first);
    let females = 0;
    for (let i = 0; i < 2000; i++) if (genderOf(content, { uid: `u${i}`, speciesId: 'bulbasaur' }) === 'female') females++;
    expect(females / 2000).toBeGreaterThan(0.08);
    expect(females / 2000).toBeLessThan(0.17);
  });
  it('opposite and same gender need both to have one', () => {
    const a = { uid: 'a', speciesId: 'nidoqueen' };
    const b = { uid: 'b', speciesId: 'nidoking' };
    expect(oppositeGender(content, a, b)).toBe(true);
    expect(sameGender(content, a, b)).toBe(false);
    expect(oppositeGender(content, a, { uid: 'm', speciesId: 'magnemite' })).toBe(false);
    expect(sameGender(content, { uid: 'm', speciesId: 'magnemite' }, { uid: 'n', speciesId: 'magnemite' })).toBe(false);
  });
});

function duel(playerSpecies: string, enemySpecies: string, pMove: string, opts: { pAbility?: string; eAbility?: string } = {}) {
  const player = createPokemon(content, playerSpecies, 50, 'p');
  const enemy = createPokemon(content, enemySpecies, 50, 'e');
  player.moves = [{ id: pMove, pp: content.moves.get(pMove)!.pp }];
  enemy.moves = [{ id: 'splash', pp: 40 }];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  if (opts.pAbility) battle.playerVolatile.abilityOverride = opts.pAbility;
  if (opts.eAbility) battle.enemyVolatile.abilityOverride = opts.eAbility;
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('g')), captureRng: new Rng(hashSeed('gc')), catchMultiplier: 1 };
  return { ctx, battle, player, enemy, go: () => resolveTurn(ctx, { kind: 'move', index: 0 }) };
}

describe('gender mechanics', () => {
  it('Attract works on the opposite gender only', () => {
    const ok = duel('nidoking', 'nidoqueen', 'attract');
    ok.go();
    expect(ok.battle.enemyVolatile.infatuated).toBe(true);
    const same = duel('nidoking', 'nidorino', 'attract');
    same.go();
    expect(same.battle.enemyVolatile.infatuated).toBeFalsy();
    const none = duel('nidoking', 'magnemite', 'attract');
    none.go();
    expect(none.battle.enemyVolatile.infatuated).toBeFalsy();
  });
  it('Captivate fails on the same gender', () => {
    const same = duel('nidoking', 'nidorino', 'captivate');
    same.go();
    expect(same.battle.enemyStages.spa).toBe(0);
    const ok = duel('nidoking', 'nidoqueen', 'captivate');
    ok.go();
    expect(ok.battle.enemyStages.spa).toBe(-2);
  });
  it('Cute Charm can infatuate an opposite-gender attacker on contact', () => {
    let hit = 0;
    for (let i = 0; i < 40; i++) {
      const d = duel('nidoking', 'nidoqueen', 'tackle', { eAbility: 'cute-charm' });
      d.ctx.rng = new Rng(hashSeed(`cc${i}`));
      d.go();
      if (d.battle.playerVolatile.infatuated) hit++;
    }
    expect(hit).toBeGreaterThan(3);
    expect(hit).toBeLessThan(25);
    const same = duel('nidoking', 'nidorino', 'tackle', { eAbility: 'cute-charm' });
    same.go();
    expect(same.battle.playerVolatile.infatuated).toBeFalsy();
  });
  it('Rivalry adds damage against the same gender and removes it against the opposite one', () => {
    const dmg = (enemy: string) => {
      const d = duel('nidoking', enemy, 'tackle', { pAbility: 'rivalry' });
      const before = d.enemy.hp;
      d.go();
      return before - d.enemy.hp;
    };
    expect(dmg('nidorino')).toBeGreaterThan(dmg('nidoqueen'));
  });
  it('Love Ball is strong only against the opposite gender of the same species', () => {
    const catches = (enemyUid: string) => {
      const d = duel('pikachu', 'pikachu', 'splash');
      d.enemy.uid = enemyUid;
      d.player.uid = 'pl';
      return genderOf(content, d.enemy) !== genderOf(content, d.player);
    };
    let opposite = 0;
    for (let i = 0; i < 20; i++) if (catches(`x${i}`)) opposite++;
    expect(opposite).toBeGreaterThan(0);
    expect(opposite).toBeLessThan(20);
  });
});

describe('gender-bound evolutions and forms', () => {
  const evolveTarget = (speciesId: string, uid: string, level = 50) => {
    const mon = createPokemon(content, speciesId, level, uid);
    return { mon, to: evolutionTarget(content, mon) };
  };
  it('Espurr becomes the Meowstic of its own gender', () => {
    const results = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { mon, to } = evolveTarget('espurr', `esp${i}`);
      const g = genderOf(content, mon);
      expect(to).toBe(g === 'female' ? 'meowstic-female' : 'meowstic');
      results.add(to!);
    }
    expect(results.size).toBe(2);
    expect(genderOf(content, { uid: 'z', speciesId: 'meowstic-female' })).toBe('female');
    expect(genderOf(content, { uid: 'z', speciesId: 'meowstic' })).toBe('male');
  });
  it('Combee only becomes Vespiquen when female; Burmy is Mothim or Wormadam by gender', () => {
    for (let i = 0; i < 40; i++) {
      const combee = evolveTarget('combee', `c${i}`, 30);
      expect(combee.to).toBe(genderOf(content, combee.mon) === 'female' ? 'vespiquen' : null);
      const burmy = evolveTarget('burmy', `b${i}`, 30);
      if (genderOf(content, burmy.mon) === 'male') expect(burmy.to).toBe('mothim');
      else expect(burmy.to).toMatch(/^wormadam/);
    }
  });
  it('the Dawn Stone makes only male Kirlia into Gallade and only female Snorunt into Froslass', () => {
    for (let i = 0; i < 40; i++) {
      const k = createPokemon(content, 'kirlia', 30, `k${i}`);
      expect(itemEvolutionTargets(content, k, 'dawn-stone').includes('gallade')).toBe(genderOf(content, k) === 'male');
      const s = createPokemon(content, 'snorunt', 30, `s${i}`);
      expect(itemEvolutionTargets(content, s, 'dawn-stone').includes('froslass')).toBe(genderOf(content, s) === 'female');
    }
  });
});
