import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { bossInfo } from '../../src/core/regions';
import { bossVictory } from '../../src/ui/battleFx/victoryLook';
import { content } from './helpers';

describe('boss victory card (catalog 91)', () => {
  const brock = bossInfo(content, 'gym', 'brock');
  it('names the win, stamps the Chronicle line and lists the team', () => {
    const a = createPokemon(content, 'pikachu', 14, 'a');
    const b = createPokemon(content, 'pidgey', 12, 'b');
    b.hp = 0;
    const v = bossVictory(content, brock, [a, b], 7, a);
    expect(v.title).toBe('Gym Leader Brock defeated!');
    expect(v.stamp).toBe('Chronicle · Turn 7 · Pikachu landed the last hit · 1 fainted');
    expect(v.accentType).toBe(brock.types[0]);
    expect(v.lineup).toEqual([{ speciesId: 'pikachu', fainted: false }, { speciesId: 'pidgey', fainted: true }]);
  });
  it('says when nobody fainted', () => {
    const a = createPokemon(content, 'pikachu', 14, 'a');
    expect(bossVictory(content, brock, [a], 3, null).stamp).toBe('Chronicle · Turn 3 · no one fainted');
  });
});
