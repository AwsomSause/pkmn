// Milestone 8: the director's custom Pokémon and forms (Insurgence Deltas,
// Z-Forms, Spooky forms, new Megas), their evolutions, learnsets and art.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pokemonEntries } from '../../src/assets/catalog';
import type { Species } from '../../src/core/contentSchema';
import { evolutionTarget } from '../../src/core/evolution';
import { createPokemon } from '../../src/core/pokemon';
import { wildEligibleSpecies } from '../../src/core/themes';
import customSpecies from '../../src/data/customSpecies.json';
import { mergeSpecies } from '../../src/data/index';
import { content } from './helpers';

const custom = (customSpecies as Species[]).map((s) => content.species.get(s.id)!);
const get = (id: string) => content.species.get(id)!;
const assetsDir = join(import.meta.dirname, '..', '..', 'public', 'assets');

describe('custom species and forms', () => {
  it('are all in the game data, tagged by where they come from', () => {
    expect(custom.length).toBeGreaterThan(300);
    for (const s of custom) expect(s.tags.some((t) => t === 'delta' || t === 'zform' || t === 'spooky')).toBe(true);
    expect(get('bulbasaur-delta').types).toEqual(['fairy', 'psychic']);
    expect(get('venusaur-delta-mega').form).toEqual({ kind: 'mega', base: 'venusaur-delta' });
    expect(get('litwick-spooky').types).toEqual(['ghost', 'grass']);
    expect(get('bruticate').form).toBeUndefined();
  });

  it('evolve along their own lines', () => {
    expect(get('bulbasaur-delta').evolutions).toEqual([{ to: 'ivysaur-delta', level: 16 }]);
    expect(get('ivysaur-delta').evolvesFrom).toBe('bulbasaur-delta');
    expect(get('lampent-spooky').evolutions).toEqual([{ to: 'chandelure-spooky', item: 'dusk-stone' }]);
    const rat = createPokemon(content, 'raticate', 38, 'r1');
    expect(evolutionTarget(content, rat)).toBe('bruticate');
    expect(get('raticate').evolutions.map((e) => e.to)).toContain('bruticate');
    // A form without its own pre-evolution is a branch of the normal one, with the same method.
    expect(get('electabuzz').evolutions).toContainEqual({ to: 'electivire-z', item: 'electirizer' });
    expect(get('grimer-delta').evolutions.map((e) => e.to)).toContain('muk-delta-fire');
    expect(get('pikachu-delta').evolutionStage).toBe(1); // babies don't count
  });

  it('new evolutions of existing species survive a re-import (kept in customEvolutions.json)', () => {
    const merged = mergeSpecies([{ id: 'raticate', evolutions: [] }], [], [{ from: 'raticate', to: 'bruticate', level: 38 } as never]) as { evolutions: unknown[] }[];
    expect(merged[0]!.evolutions).toEqual([{ to: 'bruticate', level: 38 }]);
  });

  it('every one has at least one attack the battle engine can use, of one of its types', () => {
    for (const s of custom) {
      const stab = s.learnset.filter((e) => {
        const m = content.moves.get(e.move)!;
        return m.supported && m.category !== 'status' && s.types.includes(m.type);
      });
      expect(stab.length, s.id).toBeGreaterThan(0);
    }
  });

  it('Deltas, Z-Forms and Spooky forms are event-only: not in the wild pool, like Megas and battle forms', () => {
    const wild = new Set(wildEligibleSpecies(content).map((s) => s.id));
    expect(wild.has('bulbasaur-delta')).toBe(false);
    expect(wild.has('abra-z')).toBe(false);
    expect(wild.has('litwick-spooky')).toBe(false);
    expect(wild.has('bulbasaur')).toBe(true);
    expect(wild.has('venusaur-delta-mega')).toBe(false);
    expect(wild.has('excadrill-z-mega')).toBe(false);
    expect(wild.has('typhlosion-delta-mega-active')).toBe(false);
  });

  it('have their sprites on disk; forms without an icon use Minior’s', () => {
    for (const s of custom) {
      for (const entry of pokemonEntries(s.assets)) {
        for (const file of [entry.path, entry.atlasPath].filter(Boolean) as string[]) expect(existsSync(join(assetsDir, file)), `${s.id}: ${file}`).toBe(true);
      }
    }
    expect(get('bulbasaur-delta').assets.icon).toBe(get('minior').assets.icon);
    expect(get('litwick-spooky').assets.icon).toBe('custom/litwick-spooky');
    const atlas = JSON.parse(readFileSync(join(assetsDir, 'images/pokemon/custom/bulbasaur-delta.json'), 'utf8'));
    expect(atlas.textures[0].frames).toHaveLength(1);
  });
});
