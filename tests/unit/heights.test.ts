// Hub height scaling (W13): canon Pokémon heights, estimated trainer heights, and the shared scale.
import { describe, expect, it } from 'vitest';
import { pokemonHeightM, sizePair, SPECIES_HEIGHTS, trainerHeightM, TRAINER_HEIGHTS } from '../../src/core/heights';
import { content } from './helpers';

describe('heights', () => {
  it('known Pokémon use their canon height; forms fall back to their base; later generations are estimated', () => {
    const get = (id: string) => pokemonHeightM(content.species.get(id)!);
    expect(get('pikachu')).toBe(0.4);
    expect(get('onix')).toBe(8.8);
    expect(get('wailord')).toBe(14.5);
    expect(get('charizard-mega-x')).toBeGreaterThan(1);
    for (const s of content.species.values()) {
      const h = pokemonHeightM(s);
      expect(h, s.id).toBeGreaterThanOrEqual(0.1);
      expect(h, s.id).toBeLessThanOrEqual(20);
    }
    // Most species come straight from the data, not the estimate.
    expect(Object.keys(SPECIES_HEIGHTS).length).toBeGreaterThan(850);
  });

  it('every trainer has a sensible height, and version tags resolve to the base character', () => {
    for (const id of content.archetypes.keys()) {
      const m = trainerHeightM(id);
      expect(m, id).toBeGreaterThanOrEqual(1.1);
      expect(m, id).toBeLessThanOrEqual(2.2);
    }
    expect(trainerHeightM('hala')).toBeGreaterThan(trainerHeightM('lana'));
    expect(trainerHeightM('blue-classic')).toBe(trainerHeightM('blue'));
    expect(trainerHeightM('npc-twins-nia-and-mia')).toBeLessThan(1.4);
    expect(trainerHeightM('nobody-at-all')).toBe(TRAINER_HEIGHTS.default);
    for (const id of Object.keys(TRAINER_HEIGHTS.byId)) expect(content.archetypes.has(id), `byId ${id} is a real trainer`).toBe(true);
  });

  it('a pair shares one scale: a Wailord towers over a trainer, a Joltik stays readable, and the pair fits', () => {
    const big = sizePair(1.7, 14.5);
    expect(big.monPx).toBeGreaterThan(big.trainerPx * 4);
    expect(big.monPx).toBeLessThanOrEqual(250);
    const small = sizePair(1.7, 0.1);
    expect(small.monPx).toBeGreaterThanOrEqual(44);
    expect(small.trainerPx).toBe(170);
    const even = sizePair(1.7, 1.7);
    expect(even.monPx).toBe(even.trainerPx);
  });
});
