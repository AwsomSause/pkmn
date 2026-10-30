// Milestone 8.75 part C, third batch: abilities. How each Pokémon gets its
// ability (random, hidden ones rare), and what the first set of abilities do
// in battle.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, startBattle, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { abilityStatus } from '../../src/core/battle/abilities';
import { abilityOf, calcStats, createPokemon, getSpecies, rollAbilitySlot } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { PokemonInstanceSchema, type PokemonInstance } from '../../src/core/state';
import { beginBattle, chooseStarter, createRun } from '../../src/core/run';
import { content, toBattle } from './helpers';

/** Gives a Pokémon one of its species' abilities. */
function give(mon: PokemonInstance, ability: string): PokemonInstance {
  const { normal, hidden } = getSpecies(content, mon.speciesId).abilities;
  if (hidden === ability) mon.abilitySlot = -1;
  else if (normal.includes(ability)) mon.abilitySlot = normal.indexOf(ability);
  else throw new Error(`${mon.speciesId} can't have ${ability}`);
  expect(abilityOf(content, mon)).toBe(ability);
  return mon;
}

function mon(species: string, level: number, uid: string, ability: string, ...moves: string[]): PokemonInstance {
  const m = give(createPokemon(content, species, level, uid), ability);
  if (moves.length) m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
}

function setup(player: PokemonInstance, enemy: PokemonInstance, seed = 'abilities', bench: PokemonInstance[] = []) {
  const party = [player, ...bench];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { ctx, battle, party };
}
const turn = (ctx: BattleContext, index = 0) => resolveTurn(ctx, { kind: 'move', index });
const hitsOn = (events: BattleEvent[], side: 'player' | 'enemy') => events.filter((e): e is Extract<BattleEvent, { type: 'damage' }> => e.type === 'damage' && e.side === side);
const announced = (events: BattleEvent[], ability: string) => events.some((e) => e.type === 'ability' && e.ability === ability);

describe('which ability a Pokémon has', () => {
  it('every species has at least one ability (custom forms and Bruticate use their base species)', () => {
    for (const s of content.species.values()) expect(s.abilities.normal.length + (s.abilities.hidden ? 1 : 0), s.id).toBeGreaterThan(0);
    expect(content.species.get('bruticate')!.abilities).toEqual(content.species.get('raticate')!.abilities);
    const delta = [...content.species.values()].find((s) => s.tags.includes('delta'))!;
    expect(delta.abilities).toEqual(content.species.get(delta.form!.base)!.abilities);
  });

  it('is rolled from the key, not from a random stream, and hidden abilities are rare', () => {
    const bulbasaur = getSpecies(content, 'bulbasaur');
    expect(rollAbilitySlot(content, bulbasaur, 'SEED:p1')).toBe(rollAbilitySlot(content, bulbasaur, 'SEED:p1'));
    let hidden = 0;
    const tries = 4000;
    for (let i = 0; i < tries; i++) if (rollAbilitySlot(content, bulbasaur, `k${i}`) === -1) hidden++;
    expect(hidden / tries).toBeGreaterThan(0.03);
    expect(hidden / tries).toBeLessThan(0.07);
    // Two normal abilities: both come up.
    const ekans = getSpecies(content, 'ekans');
    const slots = new Set(Array.from({ length: 200 }, (_, i) => rollAbilitySlot(content, ekans, `e${i}`)));
    expect(slots.has(0) && slots.has(1)).toBe(true);
  });

  it('a run gives the same starter the same ability for the same seed', () => {
    const start = () => chooseStarter(content, createRun(content, { runId: 'ab', seed: 'ABILITYSEED', archetypeId: 'red' }), 0);
    const a = start();
    expect(a.party[0]!.abilitySlot).toBe(start().party[0]!.abilitySlot);
    expect(abilityOf(content, a.party[0]!)).not.toBeNull();
    // Battle start plays the entry abilities once and saves that it did.
    const battle = toBattle(a);
    expect(battle.battle!.pendingEntry).toEqual(['player', 'enemy']);
    const begun = beginBattle(content, battle).run;
    expect(begun.battle!.pendingEntry).toEqual([]);
    expect(beginBattle(content, begun).events).toEqual([]);
  });

  it('keeps its slot when it evolves, and old saves get the first ability', () => {
    const charmander = createPokemon(content, 'charmander', 10, 'c1');
    charmander.abilitySlot = -1;
    expect(abilityOf(content, charmander)).toBe('solar-power');
    charmander.speciesId = 'charizard';
    expect(abilityOf(content, charmander)).toBe('solar-power');
    const { abilitySlot: _, ...old } = createPokemon(content, 'pidgey', 5, 'old');
    expect(PokemonInstanceSchema.parse(old).abilitySlot).toBe(0);
  });

  it('every ability has a support status', () => {
    const statuses = [...content.abilities.keys()].map(abilityStatus);
    expect(statuses.filter((s) => s === 'supported').length).toBeGreaterThan(140);
    expect(abilityStatus('intimidate')).toBe('supported');
    expect(abilityStatus('pickup')).toBe('noEffect');
    expect(abilityStatus('trace')).toBe('pending');
  });

  it('moves carry contact, punch, bite, pulse and sound flags', () => {
    expect(content.moves.get('tackle')!.flags).toContain('contact');
    expect(content.moves.get('thunder-punch')!.flags).toEqual(expect.arrayContaining(['contact', 'punch']));
    expect(content.moves.get('bite')!.flags).toContain('bite');
    expect(content.moves.get('ember')!.flags).not.toContain('contact');
  });
});

describe('entry abilities', () => {
  it('Intimidate lowers the foe’s Attack at the start of the battle, once', () => {
    const { ctx, battle } = setup(mon('pikachu', 20, 'p1', 'static', 'growl'), mon('ekans', 20, 'e1', 'intimidate', 'leer'));
    const events = startBattle(ctx);
    expect(announced(events, 'intimidate')).toBe(true);
    expect(battle.playerStages.atk).toBe(-1);
    expect(startBattle(ctx)).toEqual([]);
    turn(ctx);
    expect(battle.playerStages.atk).toBe(-1);
  });

  it('Clear Body ignores Intimidate', () => {
    const { ctx, battle } = setup(mon('tentacool', 20, 'p1', 'clear-body', 'growl'), mon('ekans', 20, 'e1', 'intimidate', 'leer'));
    const events = startBattle(ctx);
    expect(announced(events, 'clear-body')).toBe(true);
    expect(battle.playerStages.atk).toBe(0);
  });

  it('the first turn plays entry abilities if the battle screen did not', () => {
    const { ctx, battle } = setup(mon('pelipper', 30, 'p1', 'drizzle', 'growl'), mon('pidgey', 10, 'e1', 'keen-eye', 'growl'));
    const events = turn(ctx);
    expect(events[0]).toEqual({ type: 'ability', side: 'player', ability: 'drizzle' });
    expect(battle.weather?.id).toBe('rain');
  });

  it('a Pokémon switched in uses its entry ability straight away', () => {
    const bench = mon('arbok', 30, 'p2', 'intimidate', 'leer');
    const { ctx, battle } = setup(mon('pikachu', 30, 'p1', 'static', 'growl'), mon('rattata', 30, 'e1', 'guts', 'tail-whip'), 'sw', [bench]);
    startBattle(ctx);
    const events = resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(announced(events, 'intimidate')).toBe(true);
    expect(battle.enemyStages.atk).toBe(-1);
  });
});

describe('abilities that stop moves', () => {
  it('Levitate dodges Ground moves; Mold Breaker ignores it', () => {
    const { ctx } = setup(mon('sandshrew', 30, 'p1', 'sand-veil', 'dig', 'mud-slap'), mon('gastly', 30, 'e1', 'levitate', 'lick'));
    const events = turn(ctx, 1);
    expect(announced(events, 'levitate')).toBe(true);
    expect(hitsOn(events, 'enemy')).toHaveLength(0);
    const broken = setup(mon('drilbur', 30, 'p1', 'mold-breaker', 'mud-slap'), mon('gastly', 30, 'e1', 'levitate', 'lick'));
    expect(hitsOn(turn(broken.ctx), 'enemy')).toHaveLength(1);
  });

  it('Volt Absorb heals from Electric moves, including Thunder Wave', () => {
    const jolteon = mon('jolteon', 40, 'e1', 'volt-absorb', 'growl');
    jolteon.hp = 10;
    const { ctx } = setup(mon('pikachu', 40, 'p1', 'static', 'thunder-shock', 'thunder-wave'), jolteon);
    const events = turn(ctx, 0);
    expect(announced(events, 'volt-absorb')).toBe(true);
    expect(jolteon.hp).toBeGreaterThan(10);
    turn(ctx, 1);
    expect(jolteon.status).toBeNull();
  });

  it('Flash Fire takes a Fire move and powers up its own', () => {
    const { ctx, battle } = setup(mon('charmander', 30, 'p1', 'blaze', 'ember'), mon('growlithe', 30, 'e1', 'flash-fire', 'ember'));
    const events = turn(ctx);
    expect(announced(events, 'flash-fire')).toBe(true);
    expect(battle.enemyVolatile.flashFire).toBe(true);
  });

  it('Wonder Guard is only hurt by super-effective moves', () => {
    const { ctx } = setup(mon('rattata', 30, 'p1', 'guts', 'tackle'), mon('shedinja', 30, 'e1', 'wonder-guard', 'scratch'));
    expect(announced(turn(ctx), 'wonder-guard')).toBe(true);
  });

  it('Limber stops paralysis', () => {
    const persian = mon('persian', 30, 'e1', 'limber', 'growl');
    const { ctx } = setup(mon('pikachu', 30, 'p1', 'static', 'thunder-wave'), persian);
    const events = turn(ctx);
    expect(announced(events, 'limber')).toBe(true);
    expect(persian.status).toBeNull();
  });
});

describe('abilities in the damage formula', () => {
  /** Damage of the player's first hit, with the same random rolls. */
  const firstHit = (player: PokemonInstance, enemy: PokemonInstance, prepare?: (p: PokemonInstance, e: PokemonInstance) => void) => {
    const { ctx } = setup(player, enemy, 'same-rolls');
    prepare?.(player, enemy);
    return hitsOn(turn(ctx), 'enemy')[0]!.amount;
  };

  it('Blaze makes Fire moves 1.5× as strong at a third of its HP or less', () => {
    const full = firstHit(mon('charmander', 40, 'p1', 'blaze', 'ember'), mon('snorlax', 60, 'e1', 'immunity', 'growl'));
    const low = firstHit(mon('charmander', 40, 'p1', 'blaze', 'ember'), mon('snorlax', 60, 'e1', 'immunity', 'growl'), (p) => (p.hp = 5));
    expect(low / full).toBeGreaterThan(1.3);
    expect(low / full).toBeLessThan(1.7);
  });

  it('Thick Fat halves Fire damage', () => {
    const normal = firstHit(mon('charmander', 50, 'p1', 'blaze', 'ember'), mon('snorlax', 60, 'e1', 'immunity', 'growl'));
    const fat = firstHit(mon('charmander', 50, 'p1', 'blaze', 'ember'), mon('snorlax', 60, 'e1', 'thick-fat', 'growl'));
    expect(fat / normal).toBeGreaterThan(0.35);
    expect(fat / normal).toBeLessThan(0.65);
  });

  it('Huge Power doubles physical damage', () => {
    const plain = firstHit(mon('marill', 90, 'p1', 'thick-fat', 'tackle'), mon('snorlax', 100, 'e1', 'immunity', 'growl'));
    const huge = firstHit(mon('marill', 90, 'p1', 'huge-power', 'tackle'), mon('snorlax', 100, 'e1', 'immunity', 'growl'));
    expect(huge / plain).toBeGreaterThan(1.7);
    expect(huge / plain).toBeLessThan(2.3);
  });

  it('Sturdy survives a knockout hit at full HP, and stops one-hit KO moves', () => {
    const geodude = mon('geodude', 5, 'e1', 'sturdy', 'defense-curl');
    const { ctx } = setup(mon('blastoise', 80, 'p1', 'torrent', 'hydro-pump', 'fissure'), geodude, 'sturdy');
    const events = turn(ctx, 0);
    expect(announced(events, 'sturdy')).toBe(true);
    expect(geodude.hp).toBe(1);
    const fresh = mon('geodude', 5, 'e1', 'sturdy', 'defense-curl');
    const again = setup(mon('blastoise', 80, 'p1', 'torrent', 'fissure'), fresh, 'sturdy2');
    turn(again.ctx);
    expect(fresh.hp).toBe(calcStats(content, fresh).hp);
  });
});

describe('abilities after a hit', () => {
  it('Static can paralyze a Pokémon that touches it, never one that does not', () => {
    let paralyzed = 0;
    for (let i = 0; i < 30; i++) {
      const attacker = mon('rattata', 30, 'p1', 'guts', 'tackle');
      const { ctx } = setup(attacker, mon('pikachu', 60, 'e1', 'static', 'growl'), `static${i}`);
      turn(ctx);
      if (attacker.status?.id === 'par') paralyzed++;
    }
    expect(paralyzed).toBeGreaterThan(2);
    expect(paralyzed).toBeLessThan(20);
    for (let i = 0; i < 10; i++) {
      const attacker = mon('charmander', 30, 'p1', 'blaze', 'ember');
      const { ctx } = setup(attacker, mon('pikachu', 60, 'e1', 'static', 'growl'), `nostatic${i}`);
      turn(ctx);
      expect(attacker.status).toBeNull();
    }
  });

  it('Rough Skin hurts a Pokémon that touches it', () => {
    const attacker = mon('rattata', 30, 'p1', 'guts', 'tackle');
    const { ctx } = setup(attacker, mon('sharpedo', 60, 'e1', 'rough-skin', 'leer'));
    const events = turn(ctx);
    expect(announced(events, 'rough-skin')).toBe(true);
    expect(hitsOn(events, 'player').length).toBeGreaterThan(0);
  });
});

describe('abilities over turns', () => {
  it('Speed Boost raises Speed at the end of each turn', () => {
    const { ctx, battle } = setup(mon('ninjask', 30, 'p1', 'speed-boost', 'harden'), mon('snorlax', 30, 'e1', 'immunity', 'growl'));
    turn(ctx);
    turn(ctx);
    expect(battle.playerStages.spe).toBe(2);
  });

  it('Swift Swim lets a slow Pokémon move first in rain', () => {
    const golduck = mon('golduck', 20, 'p1', 'swift-swim', 'water-gun');
    const { ctx, battle } = setup(golduck, mon('jolteon', 20, 'e1', 'volt-absorb', 'growl'));
    battle.weather = { id: 'rain', turns: 5 };
    battle.pendingEntry = [];
    const events = turn(ctx);
    expect(events.find((e) => e.type === 'move')).toMatchObject({ side: 'player' });
  });

  it('Truant loafs around every other turn', () => {
    const { ctx } = setup(mon('slakoth', 30, 'p1', 'truant', 'scratch'), mon('snorlax', 60, 'e1', 'immunity', 'growl'));
    const moves = [turn(ctx), turn(ctx), turn(ctx)].map((events) => events.some((e) => e.type === 'move' && e.side === 'player'));
    expect(moves).toEqual([true, false, true]);
  });

  it('Poison Heal heals from poison; Magic Guard takes no burn damage', () => {
    const breloom = mon('breloom', 40, 'p1', 'poison-heal', 'growl');
    breloom.status = { id: 'psn' };
    breloom.hp = 20;
    const one = setup(breloom, mon('snorlax', 30, 'e1', 'immunity', 'growl'));
    turn(one.ctx);
    expect(breloom.hp).toBeGreaterThan(20);
    const clefable = mon('clefable', 40, 'p1', 'magic-guard', 'growl');
    clefable.status = { id: 'brn' };
    const two = setup(clefable, mon('snorlax', 30, 'e1', 'immunity', 'growl'));
    turn(two.ctx);
    expect(clefable.hp).toBe(calcStats(content, clefable).hp);
  });

  it('Regenerator heals and Natural Cure cures when switched out', () => {
    const slowpoke = mon('slowpoke', 30, 'p1', 'regenerator', 'growl');
    slowpoke.hp = 10;
    const starmie = mon('staryu', 30, 'p2', 'natural-cure', 'tackle');
    starmie.status = { id: 'par' };
    const { ctx } = setup(slowpoke, mon('snorlax', 30, 'e1', 'immunity', 'growl'), 'switch', [starmie]);
    resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(slowpoke.hp).toBe(10 + Math.floor(calcStats(content, slowpoke).hp / 3));
    resolveTurn(ctx, { kind: 'switch', partyIndex: 0 });
    expect(starmie.status).toBeNull();
  });

  it('Contrary reverses stat changes and Simple doubles them', () => {
    const contrary = setup(mon('snivy', 30, 'p1', 'contrary', 'growl'), mon('rattata', 30, 'e1', 'guts', 'growl'));
    turn(contrary.ctx);
    expect(contrary.battle.playerStages.atk).toBe(1);
    const simple = setup(mon('bidoof', 30, 'p1', 'simple', 'growl'), mon('rattata', 30, 'e1', 'guts', 'growl'));
    turn(simple.ctx);
    expect(simple.battle.playerStages.atk).toBe(-2);
  });

  it('the same seed and choices give the same battle', () => {
    const run = () => {
      const { ctx } = setup(mon('pikachu', 30, 'p1', 'static', 'thunder-shock', 'quick-attack'), mon('ekans', 30, 'e1', 'intimidate', 'bite', 'poison-sting'), 'replay');
      return [startBattle(ctx), turn(ctx, 0), turn(ctx, 1), turn(ctx, 0)];
    };
    expect(run()).toEqual(run());
  });
});
