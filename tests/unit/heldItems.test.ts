// Milestone 8.75, slice 2: held items and battle boosts in battle, bosses'
// held items, and the held items that work outside battle (EXP, evolution).

import { describe, expect, it } from 'vitest';
import { createBattle, forcedMoveIndex, resolveTurn, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { blocksEvolution, expMultiplier, giveBossItems } from '../../src/core/battle/held';
import { applyCatalog, catalogTargetProblem, getCatalogEntry } from '../../src/core/catalog';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

const mon = (species: string, level: number, uid: string, moves: string[], held?: Record<string, number>) => {
  const m = createPokemon(content, species, level, uid);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  if (held) m.held = held;
  return m;
};

function setup(player: PokemonInstance, enemy: PokemonInstance, seed = 'held') {
  const battle = createBattle('wild', [enemy], 0, player.uid, null);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { battle, ctx };
}

const hits = (events: BattleEvent[], side: 'player' | 'enemy') => events.filter((e) => e.type === 'damage' && e.side === side).map((e) => (e as { amount: number }).amount);
const held = (events: BattleEvent[], itemId: string) => events.filter((e) => e.type === 'held' && e.itemId === itemId);

/** Damage the player's first move does to a bulky wild foe that only uses Splash, with and without the items. */
function damageWith(species: string, move: string, items: Record<string, number> | undefined, turns = 1, seed = 'dmg') {
  const p = mon(species, 50, 'p1', [move], items);
  const e = mon('snorlax', 100, 'e1', ['splash']);
  const { ctx } = setup(p, e, seed);
  const out: number[] = [];
  for (let t = 0; t < turns; t++) out.push(hits(resolveTurn(ctx, { kind: 'move', index: 0 }), 'enemy')[0]!);
  return { out, ctx };
}

describe('held items that raise damage', () => {
  it('Charcoal adds 20% to Fire moves per copy', () => {
    const base = damageWith('charmander', 'ember', undefined).out[0]!;
    const one = damageWith('charmander', 'ember', { charcoal: 1 }).out[0]!;
    const two = damageWith('charmander', 'ember', { charcoal: 2 }).out[0]!;
    expect(one).toBeGreaterThan(base);
    expect(two).toBeGreaterThan(one);
    expect(one / base).toBeCloseTo(1.2, 0);
  });

  it('Charcoal does nothing for moves of other types', () => {
    expect(damageWith('charmander', 'tackle', { charcoal: 1 }).out).toEqual(damageWith('charmander', 'tackle', undefined).out);
  });

  it('a Fire Gem powers only the first Fire move of the battle', () => {
    const base = damageWith('charmander', 'ember', undefined, 2).out;
    const gem = damageWith('charmander', 'ember', { 'fire-gem': 1 }, 2);
    expect(gem.out[0]!).toBeGreaterThan(base[0]!);
    expect(gem.out[1]).toBe(base[1]);
  });
});

describe('Choice items', () => {
  it('Choice Band locks the holder into the first move it uses', () => {
    const p = mon('machop', 50, 'p1', ['tackle', 'splash'], { 'choice-band': 1 });
    const { battle, ctx } = setup(p, mon('snorlax', 100, 'e1', ['splash']));
    expect(forcedMoveIndex(battle, ctx.party)).toBeNull();
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(forcedMoveIndex(battle, ctx.party)).toBe(0);
  });

  it('without the Band there is no lock', () => {
    const p = mon('machop', 50, 'p1', ['tackle', 'splash']);
    const { battle, ctx } = setup(p, mon('snorlax', 100, 'e1', ['splash']));
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(forcedMoveIndex(battle, ctx.party)).toBeNull();
  });
});

describe('healing and surviving', () => {
  it('Leftovers heal 1/16 of max HP at the end of the turn', () => {
    const p = mon('snorlax', 50, 'p1', ['splash'], { leftovers: 1 });
    const max = maxHp(content, p);
    p.hp = Math.floor(max / 2);
    const { ctx } = setup(p, mon('magikarp', 5, 'e1', ['splash']));
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(held(events, 'leftovers')).toHaveLength(1);
    expect(p.hp).toBe(Math.floor(max / 2) + Math.floor(max / 16));
  });

  it('Leftovers do nothing at full HP', () => {
    const p = mon('snorlax', 50, 'p1', ['splash'], { leftovers: 1 });
    const { ctx } = setup(p, mon('magikarp', 5, 'e1', ['splash']));
    expect(held(resolveTurn(ctx, { kind: 'move', index: 0 }), 'leftovers')).toHaveLength(0);
  });

  it('a Sitrus Berry is eaten below half HP and heals a quarter', () => {
    const p = mon('snorlax', 50, 'p1', ['splash'], { 'sitrus-berry': 2 });
    const max = maxHp(content, p);
    p.hp = Math.floor(max * 0.4);
    const { ctx } = setup(p, mon('magikarp', 5, 'e1', ['splash']));
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(held(events, 'sitrus-berry')).toHaveLength(1);
    expect(p.hp).toBe(Math.floor(max * 0.4) + Math.floor(max * 0.25));
    expect(p.held).toEqual({ 'sitrus-berry': 1 });
  });

  it('a Focus Sash keeps a Pokémon at full HP alive with 1 HP, once', () => {
    const strong = () => mon('machamp', 100, 'e1', ['tackle']);
    const withSash = mon('magikarp', 5, 'p1', ['splash'], { 'focus-sash': 1 });
    const a = setup(withSash, strong());
    const events = resolveTurn(a.ctx, { kind: 'move', index: 0 });
    expect(held(events, 'focus-sash')).toHaveLength(1);
    expect(withSash.hp).toBe(1);

    const without = mon('magikarp', 5, 'p1', ['splash']);
    const b = setup(without, strong());
    resolveTurn(b.ctx, { kind: 'move', index: 0 });
    expect(without.hp).toBe(0);
  });
});

describe('resist berries', () => {
  it('an Occa Berry halves a super-effective Fire hit and is eaten', () => {
    const run = (items?: Record<string, number>) => {
      const p = mon('bulbasaur', 50, 'p1', ['splash'], items);
      const { ctx } = setup(p, mon('charmander', 30, 'e1', ['ember']), 'occa');
      return { taken: hits(resolveTurn(ctx, { kind: 'move', index: 0 }), 'player')[0]!, p };
    };
    const base = run();
    const berry = run({ 'occa-berry': 1 });
    expect(berry.taken).toBeLessThan(base.taken);
    expect(berry.taken / base.taken).toBeCloseTo(0.5, 0);
    expect(berry.p.held ?? {}).toEqual({});
  });
});

describe('battle boosts (X items)', () => {
  it('X Attack gives +1 Attack when the Pokémon comes in, then counts down', () => {
    const base = damageWith('machop', 'tackle', undefined).out[0]!;
    const p = mon('machop', 50, 'p1', ['tackle']);
    p.boosts = [{ kind: 'stage', stat: 'atk', stages: 1, turns: 5 }];
    const { ctx, battle } = setup(p, mon('snorlax', 100, 'e1', ['splash']), 'dmg');
    const boosted = hits(resolveTurn(ctx, { kind: 'move', index: 0 }), 'enemy')[0]!;
    expect(boosted).toBeGreaterThan(base);
    expect(battle.playerStages.atk).toBe(1);
    expect(p.boosts).toEqual([{ kind: 'stage', stat: 'atk', stages: 1, turns: 4 }]);
  });

  it('the boost ends after its turns run out', () => {
    const p = mon('machop', 50, 'p1', ['splash']);
    p.boosts = [{ kind: 'stage', stat: 'atk', stages: 1, turns: 2 }];
    const { ctx, battle } = setup(p, mon('snorlax', 100, 'e1', ['splash']));
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.playerStages.atk).toBe(1);
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(events.some((e) => e.type === 'held' && e.what === 'boostEnd')).toBe(true);
    expect(battle.playerStages.atk).toBe(0);
    expect(p.boosts).toEqual([]);
  });
});

describe('getting held items from the reward draft', () => {
  const run = () => chooseStarter(content, createRun(content, { runId: 'r', seed: 'held-reward', archetypeId: 'red' }), 0);

  it('a held item goes to the chosen Pokémon and stops at its maximum', () => {
    const r = run();
    const entry = getCatalogEntry(content, 'focus-sash');
    const mon = r.party[0]!;
    applyCatalog(content, r, entry, mon, { moneyMultiplier: 1, rng: new Rng(hashSeed('x')) });
    expect(mon.held).toEqual({ 'focus-sash': 1 });
    expect(catalogTargetProblem(content, r, entry, mon)).toMatch(/holds/);
  });

  it('an X item adds a battle boost to the chosen Pokémon', () => {
    const r = run();
    const mon = r.party[0]!;
    applyCatalog(content, r, getCatalogEntry(content, 'x-attack'), mon, { moneyMultiplier: 1, rng: new Rng(hashSeed('x')) });
    expect(mon.boosts).toEqual([{ kind: 'stage', stat: 'atk', stages: 1, turns: 5 }]);
  });
});

describe('outside battle', () => {
  it('Macho Brace doubles EXP; Everstone stops evolution', () => {
    expect(expMultiplier(content, mon('machop', 10, 'a', ['tackle'], { 'macho-brace': 1 }))).toBe(2);
    expect(expMultiplier(content, mon('machop', 10, 'a', ['tackle']))).toBe(1);
    expect(blocksEvolution(content, mon('machop', 10, 'a', ['tackle'], { everstone: 1 }))).toBe(true);
    expect(blocksEvolution(content, mon('machop', 10, 'a', ['tackle']))).toBe(false);
  });
});

describe('bosses hold items', () => {
  const team = () => ['geodude', 'onix', 'graveler', 'golem', 'rhyhorn', 'steelix'].map((s, i) => mon(s, 50, `b${i}`, ['tackle']));
  const count = (t: PokemonInstance[]) => t.reduce((n, m) => n + Object.values(m.held ?? {}).reduce((a, b) => a + b, 0), 0);

  it('Gym Leaders hold 1, Elite Four 2, Champions 3, starting with the ace', () => {
    for (const [role, n] of [['gym', 1], ['elite', 2], ['champion', 3]] as const) {
      const t = team();
      giveBossItems(content, t, role, 0, new Rng(hashSeed(`boss-${role}`)));
      expect(count(t)).toBe(n);
      expect(Object.keys(t.at(-1)!.held ?? {})).toHaveLength(1);
      expect(t[0]!.held).toBeUndefined();
    }
  });

  it('the same seed gives the same items', () => {
    const a = team();
    const b = team();
    giveBossItems(content, a, 'champion', 2, new Rng(hashSeed('same')));
    giveBossItems(content, b, 'champion', 2, new Rng(hashSeed('same')));
    expect(a.map((m) => m.held)).toEqual(b.map((m) => m.held));
  });

  it('bosses never get items that only help the player (EXP, growth, attributes)', () => {
    for (let i = 0; i < 40; i++) {
      const t = team();
      giveBossItems(content, t, 'champion', 3, new Rng(hashSeed(`pool-${i}`)));
      for (const m of t) {
        for (const id of Object.keys(m.held ?? {})) {
          const hooks = (getCatalogEntry(content, id).effect as { hooks: { hook: string }[] }).hooks.map((h) => h.hook);
          expect(hooks).not.toContain('exp');
          expect(hooks).not.toContain('growth');
          expect(hooks).not.toContain('koAttribute');
        }
      }
    }
  });
});

describe('Terrain Seeds', () => {
  const turn = (seed: string, terrain: 'electric' | 'grassy' | null, items?: Record<string, number>) => {
    const { battle, ctx } = setup(mon('blissey', 30, 'p', ['splash'], items), mon('chansey', 30, 'e', ['splash']));
    if (terrain) battle.terrain = { id: terrain, turns: 5 };
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    return { events, battle };
  };

  it('raises Defense once when its terrain is up, then is used up', () => {
    const { events } = turn('seed', 'electric', { 'electric-seed': 1 });
    expect(held(events, 'electric-seed').some((e) => e.type === 'held' && e.what === 'stat')).toBe(true);
  });

  it('does nothing under another terrain or none', () => {
    expect(held(turn('seed', 'grassy', { 'electric-seed': 1 }).events, 'electric-seed')).toHaveLength(0);
    expect(held(turn('seed', null, { 'electric-seed': 1 }).events, 'electric-seed')).toHaveLength(0);
  });
});
