// Milestone 7: attributes and luck. Growth from lifetime counters, the meters,
// each attribute's effect, run modifiers from rewards, Luck in the draft and
// the shiny roll, and save upgrades.

import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import {
  attributeEffects,
  effectiveAttributes,
  luckWeights,
  permanentAttributes,
  zeroAttributes,
  type Attributes,
} from '../../src/core/attributes';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { rollShiny } from '../../src/core/encounters';
import { createPokemon } from '../../src/core/pokemon';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { applyReward } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, shopPrice } from '../../src/core/run';
import type { Profile, RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const attrs = (a: Partial<Attributes>): Attributes => ({ ...zeroAttributes(), ...a });
const fx = (a: Partial<Attributes>) => attributeEffects(content, attrs(a));
const newRun = (seed: string, attributes?: Partial<Attributes>): RunState =>
  chooseStarter(content, createRun(content, { runId: `r-${seed}`, seed, archetypeId: 'red', attributes: attributes && attrs(attributes) }), 0);

describe('permanent attributes grow from lifetime counters', () => {
  it('follows the growth rules in balance.json', () => {
    const p: Profile = {
      ...createProfile(content, 'p'),
      counters: { battlesWon: 45, pokemonCaught: 31, shiniesFound: 2, wildDefeated: 25, healStopsUsed: 4, caughtKept: 3, caughtToCandies: 5, evolutions: 2 },
      speciesSeen: Array.from({ length: 12 }, (_, i) => `s${i}`),
    };
    const a = permanentAttributes(content, p);
    expect(a.strength).toBe(2); // 45 / 20
    expect(a.intelligence).toBe(2); // 12 seen / 5
    expect(a.luck).toBe(3 + 10); // 31 caught / 10, plus 5 per shiny
    expect(a.ragePeace).toBe(2 - 10 - 4); // wild 25/10 toward Rage; 31/3 caught and 4 heal stops toward Peace
    expect(a.goodEvil).toBe(3 - 5);
    expect(a.love).toBe(2);
  });

  it('clamps to the range: 0–100, and −100–100 for meters', () => {
    const p: Profile = { ...createProfile(content, 'p'), counters: { battlesWon: 99999, caughtToCandies: 500 } };
    const a = permanentAttributes(content, p);
    expect(a.strength).toBe(100);
    expect(a.goodEvil).toBe(-100);
  });

  it('is worked out when a run that counts ends, and shown on the run-end summary', () => {
    let profile: Profile = { ...createProfile(content, 'p'), counters: { battlesWon: 19 } };
    const run = { ...newRun('grow'), phase: 'over' as const };
    run.log.counters.battlesWon = 1;
    const result = finalizeRun(content, profile, run);
    profile = result.profile;
    expect(profile.attributes.strength).toBe(1);
    expect(result.summary!.attributesAfter.strength - result.summary!.attributesBefore.strength).toBe(1);
  });

  it('a new run starts from the profile’s attributes, plus the run’s own modifiers', () => {
    const run = newRun('base', { luck: 40 });
    expect(effectiveAttributes(content, run).luck).toBe(40);
    applyReward(content, run, getArchetype(content, 'red'), 'lucky-charm');
    expect(effectiveAttributes(content, run).luck).toBe(55);
    applyReward(content, run, getArchetype(content, 'red'), 'shiny-charm');
    applyReward(content, run, getArchetype(content, 'red'), 'shiny-charm');
    expect(effectiveAttributes(content, run).luck).toBe(100);
  });
});

describe('effects at the maximum match the proposal', () => {
  it('plain attributes', () => {
    expect(fx({ strength: 100 }).physicalDamage).toBeCloseTo(1.1);
    expect(fx({ intelligence: 50 }).specialDamage).toBeCloseTo(1.05);
    expect(fx({ speed: 100 }).speed).toBeCloseTo(1.1);
    expect(fx({ charisma: 100 }).price).toBeCloseTo(0.9);
    expect(fx({ love: 100 }).endureChance).toBeCloseTo(0.1);
  });

  it('meters: one end or the other, never both', () => {
    const rage = fx({ ragePeace: 100 });
    expect(rage.damageDealt).toBeCloseTo(1.1);
    expect(rage.damageTaken).toBeCloseTo(1.05);
    expect(rage.healing).toBe(1);
    const peace = fx({ ragePeace: -100 });
    expect(peace.healing).toBeCloseTo(1.2);
    expect(peace.damageTaken).toBeCloseTo(0.95);
    expect(peace.damageDealt).toBe(1);
    expect(fx({ goodEvil: 100 }).catchRate).toBeCloseTo(1.1);
    expect(fx({ goodEvil: -100 }).money).toBeCloseTo(1.1);
  });

  it('zero attributes change nothing', () => {
    const none = fx({});
    for (const key of ['physicalDamage', 'specialDamage', 'speed', 'price', 'damageDealt', 'damageTaken', 'healing', 'catchRate', 'money', 'uncommonWeight', 'rareWeight', 'shinyChance'] as const) {
      expect(none[key]).toBe(1);
    }
    expect(none.endureChance).toBe(0);
  });
});

describe('Luck', () => {
  it('tilts the draft weights (rare 10% → 16% at Luck 100) and leaves common alone', () => {
    const w = luckWeights(content.balance.rarityWeights, fx({ luck: 100 }));
    const total = w.common! + w.uncommon! + w.rare!;
    expect(w.common).toBe(content.balance.rarityWeights.common);
    expect(w.rare! / total).toBeCloseTo(0.16, 2);
  });

  it('doubles the shiny chance at Luck 100 (1/2000 → 1/1000)', () => {
    const count = (multiplier: number) => {
      const rng = new Rng(hashSeed('shiny'));
      let n = 0;
      for (let i = 0; i < 200_000; i++) if (rollShiny(content, rng, multiplier)) n++;
      return n;
    };
    const base = count(1);
    const lucky = count(fx({ luck: 100 }).shinyChance);
    expect(base / 200_000).toBeCloseTo(1 / 2000, 3);
    expect(lucky / base).toBeGreaterThan(1.7);
  });
});

describe('effects in the game', () => {
  it('Charisma lowers shop prices', () => {
    const entry = content.shop.find((e) => e.item === 'poke-ball')!;
    expect(shopPrice(content, newRun('c0'), entry)).toBe(entry.price);
    expect(shopPrice(content, newRun('c1', { charisma: 100 }), entry)).toBe(Math.round(entry.price * 0.9));
  });

  function battleDamage(attributes: Partial<Attributes>, seed: string) {
    const player = createPokemon(content, 'machamp', 50, 'p1');
    player.moves = [{ id: 'tackle', pp: 35 }];
    const enemy = createPokemon(content, 'snorlax', 50, 'e1');
    enemy.moves = [{ id: 'tackle', pp: 35 }];
    const ctx: BattleContext = {
      content,
      battle: createBattle('wild', [enemy], 0, player.uid),
      party: [player],
      inventory: {},
      rng: new Rng(hashSeed(seed)),
      captureRng: new Rng(hashSeed(`${seed}-c`)),
      catchMultiplier: 1,
      attributes: fx(attributes),
    };
    const before = { player: player.hp, enemy: enemy.hp };
    resolveTurn(ctx, { kind: 'move', index: 0 });
    return { dealt: before.enemy - enemy.hp, taken: before.player - player.hp };
  }

  it('Strength and Rage raise physical damage, capped at +25%', () => {
    const plain = battleDamage({}, 'dmg');
    const strong = battleDamage({ strength: 100 }, 'dmg');
    const furious = battleDamage({ strength: 100, ragePeace: 100 }, 'dmg');
    expect(strong.dealt).toBeGreaterThan(plain.dealt);
    expect(furious.dealt).toBeGreaterThan(strong.dealt);
    expect(furious.dealt).toBeLessThanOrEqual(Math.floor(plain.dealt * 1.25) + 1);
  });

  it('Peace lowers damage taken', () => {
    expect(battleDamage({ ragePeace: -100 }, 'dmg').taken).toBeLessThan(battleDamage({}, 'dmg').taken);
  });

  it('Love lets a Pokémon hang on at 1 HP once per battle', () => {
    let endured = 0;
    for (let i = 0; i < 200; i++) {
      const player = createPokemon(content, 'pidgey', 5, 'p1');
      player.moves = [{ id: 'tackle', pp: 35 }];
      const enemy = createPokemon(content, 'machamp', 80, 'e1');
      enemy.moves = [{ id: 'cross-chop', pp: 5 }];
      const ctx: BattleContext = {
        content,
        battle: createBattle('wild', [enemy], 0, player.uid),
        party: [player],
        inventory: {},
        rng: new Rng(hashSeed(`love-${i}`)),
        captureRng: new Rng(hashSeed(`love-c-${i}`)),
        catchMultiplier: 1,
        attributes: fx({ love: 100 }),
      };
      const events = resolveTurn(ctx, { kind: 'move', index: 0 });
      if (events.some((e) => e.type === 'endure')) {
        endured++;
        expect(player.hp).toBe(1);
        expect(ctx.battle.enduredUids).toEqual(['p1']);
      }
    }
    expect(endured).toBeGreaterThan(5);
    expect(endured).toBeLessThan(45);
  });
});

describe('save upgrades', () => {
  it('upgrades a v4 profile and a v6 run to the new attribute keys', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const old = { ...createProfile(content, 'old'), attributes: { strength: 0, rage: 0, peace: 0, good: 0, evil: 0 } };
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 4, savedAt: '', data: old }));
    const loaded = saves.loadOrCreateProfile(() => 'new').profile;
    expect(Object.keys(loaded.attributes).sort()).toEqual(Object.keys(zeroAttributes()).sort());

    const run = newRun('old-run');
    const { baseAttributes: _b, ...rest } = run;
    const oldRun = { ...rest, attributeModifiers: { rage: 0 }, log: { ...run.log, starterUid: undefined } };
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 6, savedAt: '', data: oldRun }));
    const result = saves.loadRun();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.baseAttributes.luck).toBe(0);
      expect(result.data.log.starterUid).toBe(run.party[0]!.uid);
    }
  });
});
