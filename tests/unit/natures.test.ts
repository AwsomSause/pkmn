import { describe, expect, it } from 'vitest';
import { applyCatalog, catalogTargetProblem, getCatalogEntry } from '../../src/core/catalog';
import { NATURES, NATURE_IDS, natureMultiplier, rollNature } from '../../src/core/natures';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

describe('natures', () => {
  it('has 25 natures; five neutral, twenty shifting one stat up and one down', () => {
    expect(NATURE_IDS).toHaveLength(25);
    expect(NATURE_IDS.filter((n) => NATURES[n][0] === NATURES[n][1])).toHaveLength(5);
  });

  it('a new Pokémon gets the same nature every time (no gameplay roll)', () => {
    expect(createPokemon(content, 'pikachu', 20, 'u1').nature).toBe(rollNature('u1'));
    expect(createPokemon(content, 'pikachu', 20, 'u1').nature).toBe(createPokemon(content, 'pikachu', 20, 'u1').nature);
    expect(new Set(Array.from({ length: 200 }, (_, i) => rollNature(`k${i}`))).size).toBeGreaterThan(20);
  });

  it('raises one stat 10%, lowers another 10%, never touches HP', () => {
    const base = createPokemon(content, 'machamp', 50, 'u');
    base.nature = 'hardy';
    const adamant = { ...base, nature: 'adamant' as const };
    const a = calcStats(content, base);
    const b = calcStats(content, adamant);
    expect(b.atk).toBe(Math.floor((a.atk * 110) / 100));
    expect(b.spa).toBe(Math.floor((a.spa * 90) / 100));
    expect(b.hp).toBe(a.hp);
    expect(b.def).toBe(a.def);
    expect(natureMultiplier(undefined, 'atk')).toBe(1);
  });

  it('a save from before natures counts as neutral', () => {
    const mon = createPokemon(content, 'machamp', 50, 'u');
    delete mon.nature;
    expect(calcStats(content, mon)).toEqual(calcStats(content, { ...mon, nature: 'serious' }));
  });
});

describe('Mints', () => {
  const take = (id: string) => {
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'mint', archetypeId: 'red' }), 0);
    const mon = run.party[0]!;
    const entry = getCatalogEntry(content, id);
    return { run, mon, entry, apply: () => applyCatalog(content, run, entry, mon, { moneyMultiplier: 1, rng: new Rng(hashSeed('m')) }) };
  };

  it('there are 21 Mints, one per nature that has a Mint icon', () => {
    const mints = [...content.catalog.values()].filter((e) => e.effect?.kind === 'nature');
    expect(mints).toHaveLength(21);
  });

  it('a Mint changes the nature and the stats follow', () => {
    const { mon, apply } = take('adamant-mint');
    mon.nature = 'timid';
    const before = calcStats(content, mon).atk;
    apply();
    expect(mon.nature).toBe('adamant');
    expect(calcStats(content, mon).atk).toBeGreaterThan(before);
  });

  it('refuses when the Pokémon already has that nature', () => {
    const { run, mon, entry } = take('jolly-mint');
    mon.nature = 'jolly';
    expect(catalogTargetProblem(content, run, entry, mon)).toMatch(/already/);
  });
});
