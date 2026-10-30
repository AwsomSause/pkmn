// Milestone 6: the full Pokédex (species, forms, moves), unsupported moves,
// evolution rules (branches, regional evolutions, evolution items), region
// eligibility, and the lazily loaded Pokémon art.

import { describe, expect, it } from 'vitest';
import { buildCatalog, pokemonAssetIds } from '../../src/assets/catalog';
import { evolutionTarget, itemEvolutionTargets } from '../../src/core/evolution';
import { evolvedFormAt } from '../../src/core/encounters';
import { getItem, itemUseProblem } from '../../src/core/items';
import { createPokemon, gainXp, isUsableMove, xpForLevel } from '../../src/core/pokemon';
import { isRewardEligible } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, shopStock, useItemOutsideBattle } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { isNative, themePool, wildEligibleSpecies } from '../../src/core/themes';
import { content } from './helpers';

function newRun(seed = 'm6'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId: 'red' }), 0);
}

/** A run whose party is one Pokémon of `speciesId`, in region `regionId`. */
function runWith(speciesId: string, level: number, regionId = 'kanto'): RunState {
  const run = newRun(`with-${speciesId}`);
  run.party = [createPokemon(content, speciesId, level, 'p1')];
  run.regionOrder[run.regionIndex] = regionId;
  return run;
}

describe('the full Pokédex', () => {
  it('has every National Dex species, 1 to 1025, with the old ids unchanged', () => {
    const dex = new Set([...content.species.values()].filter((s) => !s.form).map((s) => s.dex));
    for (let n = 1; n <= 1025; n++) expect(dex.has(n), `dex ${n}`).toBe(true);
    for (const id of ['bulbasaur', 'pikachu', 'mr-mime', 'farfetchd', 'nidoran-f', 'giratina', 'urshifu']) expect(content.species.has(id), id).toBe(true);
  });

  it('has regional and alternate forms with their own types, stats and art', () => {
    const raichu = content.species.get('raichu-alola')!;
    expect(raichu.types).toEqual(['electric', 'psychic']);
    expect(raichu.form).toEqual({ kind: 'regional', base: 'raichu', region: 'alola' });
    expect(raichu.assets.sprite).toBe('2026');
    expect(content.species.get('rotom-wash')!.types).toEqual(['electric', 'water']);
    expect(content.species.get('arcanine-hisui')!.form?.region).toBe('sinnoh');
    expect(content.species.get('charizard-mega-x')!.form?.kind).toBe('mega');
    expect(content.species.get('tauros-paldea-aqua-breed')!.assets.sprite).toBe('8128-aqua');
  });

  it('marks legendary, mythical and baby Pokémon, and keeps babies out of the stage count', () => {
    expect(content.species.get('mewtwo')!.tags).toContain('legendary');
    expect(content.species.get('mew')!.tags).toContain('mythical');
    expect(content.species.get('pichu')!.tags).toContain('baby');
    expect(content.species.get('pikachu')!).toMatchObject({ evolutionStage: 1, evolvesFrom: 'pichu' });
    expect(content.species.get('raichu')!.evolutionStage).toBe(2);
    expect(content.species.get('dragonite')!.evolutionStage).toBe(3);
  });

  it('uses the erratic and fluctuating growth rates', () => {
    expect(content.species.get('volbeat')!.growthRate).toBe('erratic');
    expect(xpForLevel('erratic', 100)).toBe(600_000);
    expect(xpForLevel('fluctuating', 100)).toBe(1_640_000);
  });
});

describe('moves the battle engine does not support yet', () => {
  it('are in the data, flagged, with what they still need', () => {
    expect(content.moves.size).toBeGreaterThan(900);
    const maxGuard = content.moves.get('max-guard')!;
    expect(maxGuard.supported).toBe(false);
    expect(maxGuard.needs).toBeTruthy();
    expect(content.moves.get('protect')!.priority).toBe(4);
    expect(content.moves.get('tackle')!.supported).toBe(true);
  });

  it('stay in learnsets but are never learned', () => {
    // Max moves are only reached through Dynamax, so a learnset entry for one is never learned.
    const c = structuredClone(content);
    c.species.get('pikachu')!.learnset.push({ level: 1, move: 'max-guard' });
    expect(c.species.get('pikachu')!.learnset.some((e) => !isUsableMove(c, e.move))).toBe(true);
    const mon = createPokemon(c, 'pikachu', 1, 'p1');
    for (const m of mon.moves) expect(isUsableMove(c, m.id), m.id).toBe(true);
    gainXp(c, mon, 1_000_000);
    for (const m of mon.moves) expect(isUsableMove(c, m.id), m.id).toBe(true);
  });

  it('a Pokémon with no supported moves at all only has Struggle', () => {
    const c = structuredClone(content);
    c.species.get('ditto')!.learnset = [{ level: 1, move: 'max-guard' }];
    expect(createPokemon(c, 'ditto', 10, 'd').moves.map((m) => m.id)).toEqual(['struggle']);
  });
});

describe('evolution rules', () => {
  it('level evolutions pick a branch that stays the same for each Pokémon', () => {
    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const mon = createPokemon(content, 'wurmple', 7, `w${i}`);
      const first = evolutionTarget(content, mon);
      expect(evolutionTarget(content, mon)).toBe(first);
      results.add(first!);
    }
    expect(results).toEqual(new Set(['silcoon', 'cascoon']));
  });

  it("Tyrogue follows its Attack and Defense", () => {
    const mon = createPokemon(content, 'tyrogue', 20, 't');
    mon.vitamins.atk = 3;
    expect(evolutionTarget(content, mon)).toBe('hitmonlee');
    mon.vitamins.atk = 0;
    mon.vitamins.def = 3;
    expect(evolutionTarget(content, mon)).toBe('hitmonchan');
  });

  it('regional evolutions happen in their region (Hisuian Typhlosion in Sinnoh)', () => {
    const mon = createPokemon(content, 'quilava', 36, 'q');
    expect(evolutionTarget(content, mon, 'johto')).toBe('typhlosion');
    expect(evolutionTarget(content, mon, 'sinnoh')).toBe('typhlosion-hisui');
    const pikachu = createPokemon(content, 'pikachu', 20, 'pk');
    expect(itemEvolutionTargets(content, pikachu, 'thunder-stone', 'kanto')).toEqual(['raichu']);
    expect(itemEvolutionTargets(content, pikachu, 'thunder-stone', 'alola')).toEqual(['raichu-alola']);
  });

  it('stones, trades and friendship use items from the Bag', () => {
    const evolvesWith = (id: string) => content.species.get(id)!.evolutions.map((e) => e.item ?? `level ${e.level}`);
    expect(evolvesWith('vulpix')).toEqual(['fire-stone']);
    expect(evolvesWith('kadabra')).toEqual(['linking-cord']);
    expect(evolvesWith('onix')).toEqual(['metal-coat']);
    expect(evolvesWith('golbat')).toEqual(['soothe-bell']);
    expect(evolvesWith('magneton')).toEqual(['thunder-stone']);
  });

  it('using a Fire Stone evolves Vulpix; it does nothing for Charmander', () => {
    let run = runWith('vulpix', 12);
    run.inventory['fire-stone'] = 1;
    const stone = getItem(content, 'fire-stone');
    expect(itemUseProblem(content, stone, createPokemon(content, 'charmander', 12, 'c'))).toMatch(/won't have any effect/);
    const result = useItemOutsideBattle(content, run, 'fire-stone', 0);
    run = result.run;
    expect(run.party[0]!.speciesId).toBe('ninetales');
    expect(result.message).toMatch(/evolved into Ninetales/);
    expect(run.inventory['fire-stone']).toBeUndefined();
  });

  it('when an item has several results (Eevee and a Soothe Bell), the player chooses', () => {
    const run = runWith('eevee', 20);
    run.inventory['soothe-bell'] = 1;
    expect(itemEvolutionTargets(content, run.party[0]!, 'soothe-bell')).toEqual(['espeon', 'umbreon', 'sylveon']);
    expect(() => useItemOutsideBattle(content, run, 'soothe-bell', 0)).toThrow(/Choose/);
    expect(useItemOutsideBattle(content, run, 'soothe-bell', 0, 'umbreon').run.party[0]!.speciesId).toBe('umbreon');
  });

  it("evolution items are only offered when someone in the party can use them, and shops sell stones", () => {
    const reward = content.rewards.get('evo-fire-stone')!;
    expect(isRewardEligible(content, runWith('vulpix', 10), reward)).toBe(true);
    expect(isRewardEligible(content, runWith('charmander', 10), reward)).toBe(false);
    const run = newRun('stones');
    run.badges = ['a', 'b', 'c'];
    expect(shopStock(content, run).map((e) => e.item)).toEqual(expect.arrayContaining(['fire-stone', 'linking-cord', 'soothe-bell']));
  });

  it("trainers' Pokémon arrive evolved by item at their levels", () => {
    expect(evolvedFormAt(content, 'growlithe', 29)).toBe('growlithe');
    expect(evolvedFormAt(content, 'growlithe', 30)).toBe('arcanine');
    expect(evolvedFormAt(content, 'pichu', 14)).toBe('pichu');
    expect(evolvedFormAt(content, 'pichu', 15)).toBe('pikachu');
    expect(evolvedFormAt(content, 'pichu', 30)).toBe('raichu');
    const eevees = new Set(Array.from({ length: 40 }, (_, i) => evolvedFormAt(content, 'eevee', 40, new Rng(hashSeed(`e${i}`)))));
    expect(eevees.size).toBeGreaterThan(3);
  });
});

describe('who appears in the wild', () => {
  it('only first-stage Pokémon that are not legendary, mythical or special forms', () => {
    const wild = wildEligibleSpecies(content);
    expect(wild.length).toBeGreaterThan(400);
    for (const s of wild) {
      expect(s.evolutionStage, s.id).toBe(1);
      expect(s.tags.includes('legendary') || s.tags.includes('mythical'), s.id).toBe(false);
      expect(['mega', 'gigantamax', 'primal', 'battle']).not.toContain(s.form?.kind);
    }
    const ids = new Set(wild.map((s) => s.id));
    // Regional forms are event-only (Untitled doc §8): the base species stay.
    for (const id of ['pikachu', 'rattata', 'growlithe', 'wooper']) expect(ids.has(id), id).toBe(true);
    for (const id of ['rattata-alola', 'growlithe-hisui', 'wooper-paldea']) expect(ids.has(id), id).toBe(false);
    for (const id of ['nihilego', 'iron-valiant', 'raichu']) expect(ids.has(id), id).toBe(false);
  });

  it("prefers the region's own Pokémon (region eligibility)", () => {
    const theme = content.themes.get([...content.themes.keys()].find((id) => id.includes('fire'))!)!;
    const pool = themePool(content, theme, 'kanto');
    const weightOf = (id: string) => pool.find((p) => p.speciesId === id)?.weight ?? 0;
    const charmander = weightOf('charmander');
    const fuecoco = weightOf('fuecoco');
    expect(charmander).toBe(fuecoco * content.balance.nativeWeight);
    expect(isNative(content, content.species.get('vulpix-alola')!, 'alola')).toBe(true);
    expect(isNative(content, content.species.get('vulpix-alola')!, 'kanto')).toBe(false);
  });
});

describe('Pokémon art at scale', () => {
  it('every Pokémon asset is lazy and uses the form-aware file names', () => {
    const species = [...content.species.values()];
    const catalog = buildCatalog({ pokemon: species.map((s) => s.assets), trainerAssetIds: [], itemAssetIds: [], backgroundAssetIds: [] });
    const ids = pokemonAssetIds(content.species.get('rattata-alola')!.assets);
    const front = catalog.find((e) => e.id === ids.front)!;
    expect(front).toMatchObject({ path: 'images/pokemon/2019.png', lazy: true });
    expect(catalog.find((e) => e.id === ids.icon)!.path).toBe('images/pokemon/icons/7/2019.png');
    expect(catalog.find((e) => e.id === ids.cry)!.path).toBe('audio/cry/19.m4a');
    expect(catalog.filter((e) => e.category === 'pokemon' && !e.lazy)).toEqual([]);
  });
});
