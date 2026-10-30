import { describe, expect, it } from 'vitest';
import { catchSummary } from '../../src/core/catchSummary';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

describe('catch summary', () => {
  it('shows all six stats, base stats with BST, ability, evolution and a comparison', () => {
    const a = createPokemon(content, 'bulbasaur', 10, 'a');
    const b = createPokemon(content, 'pikachu', 12, 'b');
    const lines = catchSummary(content, a, b);
    const text = lines.join('\n');
    expect(text).toContain('BST 318');
    expect(text).toMatch(/SpA \d+.*SpD \d+/);
    expect(text).toContain('Ivysaur (Lv16)');
    expect(text).toContain('vs Pikachu Lv12');
  });
  it('says so when a Pokémon does not evolve', () => {
    expect(catchSummary(content, createPokemon(content, 'tauros', 20, 'c')).join('\n')).toContain('Does not evolve');
  });
});
