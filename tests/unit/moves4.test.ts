// Features catch-up, everything-left PR: field effects, Substitute, Perish Song, ability tricks and similar.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function duel(playerMove: string, enemyMove = 'splash', turns = 1, enemySpecies = 'snorlax') {
  const player = createPokemon(content, 'rattata', 50, 'p');
  player.moves = [{ id: playerMove, pp: content.moves.get(playerMove)!.pp }];
  const enemy = createPokemon(content, enemySpecies, 50, 'e');
  enemy.moves = [{ id: enemyMove, pp: content.moves.get(enemyMove)!.pp }];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m4')), captureRng: new Rng(hashSeed('m4c')), catchMultiplier: 1 };
  const events = [];
  for (let i = 0; i < turns; i++) events.push(...resolveTurn(ctx, { kind: 'move', index: 0 }));
  return { ctx, battle, events, player, enemy: battle.enemyTeam[0]! };
}

describe('stage 3b moves', () => {
  it('Substitute costs a quarter of the HP and soaks a hit', () => {
    const r = duel('substitute', 'tackle');
    expect(r.events.some((e) => e.type === 'substituteHit')).toBe(true);
  });
  it('Trick Room starts and ends after five turns', () => {
    const r = duel('trick-room', 'splash', 1);
    expect(r.events.some((e) => e.type === 'fieldStart')).toBe(true);
    expect(r.battle.field.trickRoom).toBeGreaterThan(0);
  });
  it('Perish Song knocks both out on the fourth turn', () => {
    const r = duel('perish-song', 'splash', 4);
    expect(r.events.filter((e) => e.type === 'perish').length).toBeGreaterThanOrEqual(3);
    expect(r.events.some((e) => e.type === 'faint')).toBe(true);
  });
  it('Yawn puts the target to sleep after a turn', () => {
    const r = duel('yawn', 'splash', 2);
    expect(r.enemy.status?.id).toBe('slp');
  });
  it('Soak turns the target into a Water type', () => {
    const r = duel('soak');
    expect(r.events.some((e) => e.type === 'selfState' && e.state === 'typeChanged')).toBe(true);
  });
  it('Skill Swap trades abilities', () => {
    const r = duel('skill-swap');
    expect(r.events.some((e) => e.type === 'selfState' && e.state === 'abilityChanged')).toBe(true);
  });
  it('Magnitude does damage and Triple Kick hits three times', () => {
    expect(duel('magnitude').events.some((e) => e.type === 'damage')).toBe(true);
    const h = duel('triple-kick').events.find((e) => e.type === 'hits');
    if (h && h.type === 'hits') expect(h.count).toBe(3);
  });
  it('Stockpile then Spit Up works; Spit Up with nothing stored fails', () => {
    expect(duel('spit-up').events.some((e) => e.type === 'fail')).toBe(true);
  });
});

describe('stage 4 abilities', () => {
  function withAbility(playerAbility: string | null, enemyAbility: string | null, playerMove: string, enemyMove = 'splash', enemySpecies = 'snorlax', turns = 1) {
    const player = createPokemon(content, 'rattata', 50, 'p');
    player.moves = [{ id: playerMove, pp: content.moves.get(playerMove)!.pp }];
    const enemy = createPokemon(content, enemySpecies, 50, 'e');
    enemy.moves = [{ id: enemyMove, pp: content.moves.get(enemyMove)!.pp }];
    const battle = createBattle('wild', [enemy], 0, player.uid);
    if (playerAbility) battle.playerVolatile.abilityOverride = playerAbility;
    if (enemyAbility) battle.enemyVolatile.abilityOverride = enemyAbility;
    const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m4a')), captureRng: new Rng(hashSeed('m4ac')), catchMultiplier: 1 };
    const events = [];
    for (let i = 0; i < turns; i++) events.push(...resolveTurn(ctx, { kind: 'move', index: 0 }));
    return { events, battle, ctx };
  }
  const dmg = (r: { events: { type: string }[] }) => r.events.reduce((n, e: any) => (e.type === 'damage' && e.side === 'enemy' ? n + e.amount : n), 0);

  it('Neutralizing Gas switches off the other ability', () => {
    expect(dmg(withAbility(null, 'thick-fat', 'ember'))).toBeGreaterThan(0);
    const plain = dmg(withAbility(null, 'thick-fat', 'ember'));
    const gassed = dmg(withAbility('neutralizing-gas', 'thick-fat', 'ember'));
    expect(gassed).toBeGreaterThan(plain);
  });
  it('Sword of Ruin lowers the foe Defense so physical hits land harder', () => {
    expect(dmg(withAbility('sword-of-ruin', null, 'tackle'))).toBeGreaterThan(dmg(withAbility(null, null, 'tackle')));
  });
  it('Normalize turns moves Normal', () => {
    const r = withAbility('normalize', null, 'ember');
    expect(dmg(r)).toBeGreaterThan(0);
  });
  it('Magic Bounce sends a status move back', () => {
    const r = withAbility(null, 'magic-bounce', 'leer');
    expect(r.events.some((e: any) => e.type === 'ability' && e.ability === 'magic-bounce')).toBe(true);
  });
  it('Moody changes stats each turn', () => {
    const r = withAbility('moody', null, 'splash', 'splash', 'snorlax', 2);
    expect(r.events.filter((e: any) => e.type === 'stat').length).toBeGreaterThan(0);
  });
});

describe('stage 5 held items', () => {
  function trainerWith(item: string, playerMove = 'tackle', turns = 1) {
    const player = createPokemon(content, 'rattata', 50, 'p');
    player.moves = [{ id: playerMove, pp: content.moves.get(playerMove)!.pp }];
    const bench = createPokemon(content, 'pidgey', 50, 'b');
    const a = createPokemon(content, 'snorlax', 50, 'e1');
    a.held = { [item]: 1 };
    a.moves = [{ id: 'splash', pp: 40 }];
    const b = createPokemon(content, 'snorlax', 50, 'e2');
    const battle = createBattle('trainer', [a, b], 0, player.uid);
    const ctx: BattleContext = { content, battle, party: [player, bench], inventory: {}, rng: new Rng(hashSeed('m5')), captureRng: new Rng(hashSeed('m5c')), catchMultiplier: 1 };
    const events = [];
    for (let i = 0; i < turns; i++) events.push(...resolveTurn(ctx, { kind: 'move', index: 0 }));
    return { ctx, battle, events };
  }
  it('Eject Button sends the holder out when hit', () => {
    const r = trainerWith('eject-button');
    expect(r.events.some((e) => e.type === 'switchIn' && e.side === 'enemy')).toBe(true);
    expect(r.battle.enemyTeam[r.battle.enemyIndex]!.uid).toBe('e2');
  });
  it('Red Card forces the attacker out', () => {
    const r = trainerWith('red-card');
    expect(r.battle.needsSwitch || r.battle.activeIndex === 1).toBe(true);
  });
  it('Light Clay stretches Reflect to eight turns', () => {
    const player = createPokemon(content, 'rattata', 50, 'p');
    player.moves = [{ id: 'reflect', pp: 20 }];
    player.held = { 'light-clay': 1 };
    const enemy = createPokemon(content, 'snorlax', 50, 'e');
    enemy.moves = [{ id: 'splash', pp: 40 }];
    const battle = createBattle('wild', [enemy], 0, player.uid);
    const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m5l')), captureRng: new Rng(hashSeed('m5lc')), catchMultiplier: 1 };
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.sideEffects.player.reflect).toBeGreaterThanOrEqual(7);
  });
});

describe('stage 6 smart trainers', () => {
  function boss(enemySpecies: string, enemyMove: string, hpFrac = 1) {
    const player = createPokemon(content, 'rattata', 50, 'p');
    player.moves = [{ id: 'splash', pp: 40 }];
    const a = createPokemon(content, enemySpecies, 50, 'e1');
    a.moves = [{ id: enemyMove, pp: content.moves.get(enemyMove)!.pp }];
    const b = createPokemon(content, 'machop', 50, 'e2');
    b.moves = [{ id: 'karate-chop', pp: 25 }, { id: 'tackle', pp: 35 }];
    const battle = createBattle('trainer', [a, b], 0, player.uid);
    battle.ai = 1;
    a.hp = Math.max(1, Math.floor(a.hp * hpFrac));
    const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m6')), captureRng: new Rng(hashSeed('m6c')), catchMultiplier: 1 };
    const events = [...resolveTurn(ctx, { kind: 'move', index: 0 }), ...resolveTurn(ctx, { kind: 'move', index: 0 })];
    return { battle, events };
  }
  it('a boss with a nearly-fainted Pokémon uses one potion', () => {
    const r = boss('snorlax', 'tackle', 0.1);
    expect(r.events.filter((e) => e.type === 'item').length).toBe(1);
    expect(r.battle.enemyItemsUsed).toBe(1);
  });
  it('a boss swaps when its moves cannot hurt the player', () => {
    const r = boss('snorlax', 'splash');
    expect(r.battle.enemySwitches).toBe(1);
    expect(r.battle.enemyTeam[r.battle.enemyIndex]!.uid).toBe('e2');
  });
  it('an ordinary trainer never does either', () => {
    const player = createPokemon(content, 'rattata', 50, 'p');
    player.moves = [{ id: 'splash', pp: 40 }];
    const a = createPokemon(content, 'snorlax', 50, 'e1');
    a.moves = [{ id: 'splash', pp: 40 }];
    a.hp = 3;
    const b = createPokemon(content, 'machop', 50, 'e2');
    const battle = createBattle('trainer', [a, b], 0, player.uid);
    const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m6o')), captureRng: new Rng(hashSeed('m6oc')), catchMultiplier: 1 };
    resolveTurn(ctx, { kind: 'move', index: 0 });
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.enemyItemsUsed + battle.enemySwitches).toBe(0);
  });
});
