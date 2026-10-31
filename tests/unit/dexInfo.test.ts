import { describe, expect, it } from 'vitest';
import { dexPage, dexState } from '../../src/core/presentation/dexInfo';
import { content } from './helpers';

const profile = { speciesSeen: ['pikachu', 'bulbasaur'], speciesCaught: ['bulbasaur'] };

describe('Pokédex species page', () => {
  it('knows unknown, seen and caught species', () => {
    expect(dexState(profile, 'charmander')).toBe('unknown');
    expect(dexState(profile, 'pikachu')).toBe('seen');
    expect(dexState(profile, 'bulbasaur')).toBe('caught');
  });
  it('hides what is not met, and shows types and stats once met', () => {
    const hidden = dexPage(content, profile, 'charmander');
    expect(hidden.title).toContain('???');
    expect(hidden.stats).toEqual([]);
    const page = dexPage(content, profile, 'bulbasaur');
    expect(page.title).toContain('Bulbasaur');
    expect(page.types).toBe('Grass / Poison');
    expect(page.stats).toHaveLength(7);
    expect(page.note).toContain('caught');
  });
  it('rejects an unknown species id', () => {
    expect(() => dexPage(content, profile, 'nope')).toThrow(/Unknown species/);
  });
});
