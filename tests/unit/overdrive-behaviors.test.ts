// Spec 8: the new Overdrive behaviors (Defiance, Protective Instinct,
// Emotional Awakening). They are decided by the battle engine on the "hyper"
// stream; they cost something and never fire on their own.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import type { HyperContext } from '../../src/core/battle/hyper';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import type { Emotion, StoryTriggerKind } from '../../src/core/story/schema';
import { content } from './helpers';

const def = (trigger: StoryTriggerKind) => content.story.definitions.find((d) => d.triggerConditions.trigger === trigger)!;

function certain(triggers: StoryTriggerKind[], emotion: Emotion | null = null): HyperContext {
  return {
    rng: new Rng(hashSeed('overdrive-test')),
    eligibility: (trigger) => (triggers.includes(trigger) ? { def: def(trigger), chance: 1, variant: null } : null),
    attributeShare: () => 0,
    rivalBattles: () => 0,
    friendlyRivals: () => [],
    emotion: () => emotion,
  };
}

function ctxFor(party: PokemonInstance[], enemy: PokemonInstance, hyper: HyperContext): BattleContext {
  return {
    content,
    battle: createBattle('wild', [enemy], 0, party[0]!.uid),
    party,
    inventory: {},
    rng: new Rng(hashSeed('b')),
    captureRng: new Rng(hashSeed('b-c')),
    catchMultiplier: 1,
    hyper,
  };
}

const hypers = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'hyper' }> => e.type === 'hyper');

function pidgey(): PokemonInstance {
  const p = createPokemon(content, 'pidgey', 5, 'p1');
  p.moves = [{ id: 'tackle', pp: 35 }];
  return p;
}

function foe(moveId: string, level = 80): PokemonInstance {
  const e = createPokemon(content, 'machamp', level, 'e1');
  e.moves = [{ id: moveId, pp: 30 }];
  return e;
}

describe('Defiance', () => {
  it('needs the Pokémon to have been overwhelmed (hit enough times)', () => {
    const player = pidgey();
    const ctx = ctxFor([player], foe('cross-chop'), certain(['defiance']));
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(player.hp).toBe(0);
  });

  it('holds on at 1 HP, strikes back without knocking out, and costs stat stages', () => {
    const player = pidgey();
    const enemy = foe('cross-chop');
    const ctx = ctxFor([player], enemy, certain(['defiance']));
    ctx.battle.hyper.taken[player.uid] = 2;
    const before = enemy.hp;
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    const [e] = hypers(events);
    expect(e).toMatchObject({ defId: 'defiance', hpAfter: 1, uid: 'p1' });
    expect(player.hp).toBe(1);
    const expected = Math.max(1, before - Math.max(1, Math.floor(calcStats(content, enemy).hp * 0.25)));
    expect(e!.foeHpAfter).toBeLessThanOrEqual(before);
    expect(enemy.hp).toBeGreaterThanOrEqual(1);
    expect(enemy.hp).toBeLessThanOrEqual(expected + calcStats(content, enemy).hp); // it may also have been hit by tackle
    expect(ctx.battle.playerStages.spe).toBe(-1);
    expect(ctx.battle.playerStages.def).toBe(-1);
  });
});

describe('Protective Instinct', () => {
  it('a bonded teammate takes the hit, and is never knocked out by it', () => {
    const player = pidgey();
    const mate = createPokemon(content, 'snorlax', 100, 'p2');
    mate.friendship = 255;
    const mateHp = mate.hp;
    const ctx = ctxFor([player, mate], foe('cross-chop', 25), certain(['protectiveInstinct']));
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    const [e] = hypers(events);
    expect(e).toMatchObject({ defId: 'protective-instinct', uid: 'p1' });
    expect(e!.proxy?.uid).toBe('p2');
    expect(player.hp).toBeGreaterThanOrEqual(1);
    expect(mate.hp).toBeLessThan(mateHp);
    expect(mate.hp).toBeGreaterThanOrEqual(1);
    expect(e!.proxy?.hpAfter).toBe(mate.hp);
  });

  it('does not happen when the teammate could not bear it', () => {
    const player = pidgey();
    const mate = createPokemon(content, 'caterpie', 3, 'p2');
    mate.hp = 1;
    const ctx = ctxFor([player, mate], foe('cross-chop'), certain(['protectiveInstinct']));
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(hypers(resolveTurn(ctxFor([pidgey()], foe('cross-chop'), certain(['protectiveInstinct'])), { kind: 'move', index: 0 }))).toHaveLength(0);
    expect(mate.hp).toBe(1);
  });
});

describe('Emotional Awakening', () => {
  function hurt(): { player: PokemonInstance; ctx: (e: Emotion | null) => BattleContext } {
    const player = createPokemon(content, 'snorlax', 50, 'p1');
    player.moves = [{ id: 'tackle', pp: 35 }];
    player.hp = Math.floor(calcStats(content, player).hp * 0.2);
    return { player, ctx: (emotion) => ctxFor([player], foe('splash'), certain(['emotionalAwakening'], emotion)) };
  }

  it('a badly hurt Pokémon takes the ability of its emotion and pays a stat', () => {
    const { ctx } = hurt();
    const c = ctx('kindness');
    const [e] = hypers(resolveTurn(c, { kind: 'move', index: 0 }));
    expect(e).toMatchObject({ defId: 'emotional-awakening', ability: 'regenerator' });
    expect(c.battle.playerVolatile.abilityOverride).toBe('regenerator');
    expect(c.battle.playerStages.atk).toBe(-1);
  });

  it('uses the fallback without an emotion, and not from healthy HP', () => {
    const { ctx } = hurt();
    const [e] = hypers(resolveTurn(ctx(null), { kind: 'move', index: 0 }));
    expect(e!.ability).toBe('guts');
    const healthy = createPokemon(content, 'snorlax', 50, 'p1');
    healthy.moves = [{ id: 'tackle', pp: 35 }];
    const c = ctxFor([healthy], foe('splash'), certain(['emotionalAwakening']));
    expect(hypers(resolveTurn(c, { kind: 'move', index: 0 }))).toHaveLength(0);
  });
});

describe('Pushed Beyond Its Limits', () => {
  const setup = (hpShare: number) => {
    const player = createPokemon(content, 'snorlax', 50, 'p1');
    player.moves = [{ id: 'tackle', pp: 35 }];
    const max = calcStats(content, player).hp;
    player.hp = Math.floor(max * hpShare);
    return { player, max, ctx: ctxFor([player], foe('splash', 30), certain(['limitBreak'])) };
  };

  it('a badly hurt Pokémon pays HP strain (never to 0) and its move cannot miss', () => {
    const { player, max, ctx } = setup(0.4);
    const before = player.hp;
    const [e] = hypers(resolveTurn(ctx, { kind: 'move', index: 0 }));
    expect(e).toMatchObject({ defId: 'pushed-beyond-limits', uid: 'p1' });
    expect(player.hp).toBe(before - Math.floor(max * 0.15));
    expect(player.hp).toBeGreaterThanOrEqual(1);
  });

  it('does not happen from healthy HP', () => {
    const { ctx } = setup(0.9);
    expect(hypers(resolveTurn(ctx, { kind: 'move', index: 0 }))).toHaveLength(0);
  });
});

describe('Guard Formation', () => {
  it('Protective Instinct guards the protected Pokémon for the next turns', () => {
    const player = pidgey();
    const mate = createPokemon(content, 'snorlax', 100, 'p2');
    const ctx = ctxFor([player, mate], foe('cross-chop', 25), certain(['protectiveInstinct']));
    resolveTurn(ctx, { kind: 'move', index: 0 });
    // Created this turn, one turn used up at its end.
    expect(ctx.battle.hyper.guard[player.uid]).toBe(2);
  });
});
