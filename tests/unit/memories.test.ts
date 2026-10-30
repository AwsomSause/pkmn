// Memories: Silvally takes the type of the Memory it holds, and Multi-Attack uses it.

import { describe, expect, it } from 'vitest';
import { getCatalogEntry } from '../../src/core/catalog';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { battleTypes } from '../../src/core/battle/transform';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

const types = (species: string, held?: Record<string, number>) => {
  const p = createPokemon(content, species, 50, 'p1');
  if (held) p.held = held;
  const e = createPokemon(content, 'machop', 50, 'e1');
  return battleTypes(content, createBattle('wild', [e], 0, p.uid, null), p);
};

describe('Memories', () => {
  it('all 17 exist with art and a memory hook of their own type', () => {
    for (const ty of ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy']) {
      const e = getCatalogEntry(content, `${ty}-memory`);
      expect((e.effect as { hooks: unknown[] }).hooks).toEqual([{ hook: 'memory', type: ty }, { hook: 'formHeld', from: 'silvally', to: `silvally-${ty}` }]);
      expect(content.species.get(`silvally-${ty}`)?.types).toEqual([ty]);
    }
  });

  it('Silvally holding a Memory is that type; without one it is Normal; other species ignore it', () => {
    expect(types('silvally', { 'fire-memory': 1 })).toEqual(['fire']);
    expect(types('silvally')).toEqual(['normal']);
    expect(types('machop', { 'fire-memory': 1 })).toEqual(['fighting']);
  });

  it('Multi-Attack is typed by the Memory', () => {
    const fx = content.moves.get('multi-attack')!.effects as { itemMove?: string };
    expect(fx.itemMove).toBe('itemType');
  });
});

describe('Multi-Attack in battle', () => {
  it('hits a Grass foe super effectively with a Fire Memory, and neutrally without one', () => {
    const hit = (held?: Record<string, number>) => {
      const p = createPokemon(content, 'silvally', 50, 'p1');
      p.moves = [{ id: 'multi-attack', pp: 10 }];
      if (held) p.held = held;
      const e = createPokemon(content, 'bulbasaur', 50, 'e1');
      e.moves = [{ id: 'splash', pp: 40 }];
      const battle = createBattle('wild', [e], 0, p.uid, null);
      const ctx: BattleContext = { content, battle, party: [p], inventory: {}, rng: new Rng(hashSeed('m')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
      const ev = resolveTurn(ctx, { kind: 'move', index: 0 }).find((x) => x.type === 'damage' && x.side === 'enemy') as { effectiveness: number };
      return ev.effectiveness;
    };
    expect(hit({ 'fire-memory': 1 })).toBe(2);
    expect(hit()).toBe(1);
  });
});

describe('Silvally forms', () => {
  it('a held Memory turns Silvally into its type form in battle', () => {
    const p = createPokemon(content, 'silvally', 50, 'p1');
    p.moves = [{ id: 'multi-attack', pp: 10 }];
    p.held = { 'water-memory': 1 };
    const e = createPokemon(content, 'snorlax', 100, 'e1');
    e.moves = [{ id: 'splash', pp: 40 }];
    const battle = createBattle('wild', [e], 0, p.uid, null);
    const ctx: BattleContext = { content, battle, party: [p], inventory: {}, rng: new Rng(hashSeed('m')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(events.some((x) => x.type === 'transform' && x.to === 'silvally-water')).toBe(true);
  });
});
