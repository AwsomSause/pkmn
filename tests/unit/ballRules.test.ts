import { describe, expect, it } from 'vitest';
import { ballBonus, createBattle, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, getSpecies, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

/** The multiplier a ball gets against this foe (the player leads with a Pikachu). */
function bonus(ballId: string, foe: string, tweak?: (foe: ReturnType<typeof createPokemon>) => void): number {
  const player = createPokemon(content, 'pikachu', 20, 'p');
  const enemy = createPokemon(content, foe, 20, 'e');
  tweak?.(enemy);
  const battle = createBattle('wild', [enemy], 0, player.uid, null);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('ball')), captureRng: new Rng(hashSeed('ball-c')), catchMultiplier: 1 };
  const effect = content.items.get(ballId)!.effect;
  if (effect.kind !== 'catch') throw new Error('not a ball');
  return ballBonus(ctx, effect, enemy, getSpecies(content, foe));
}

describe('special Poké Ball rules', () => {
  it('Dream Ball needs a sleeping foe', () => {
    expect(bonus('dream-ball', 'rattata')).toBe(1);
    expect(bonus('dream-ball', 'rattata', (f) => { f.status = { id: 'slp', turns: 2 } as never; })).toBe(4);
  });
  it('Beast Ball loves legendary Pokémon and punishes the rest', () => {
    expect(bonus('beast-ball', 'mewtwo')).toBe(5);
    expect(bonus('beast-ball', 'rattata')).toBe(0.1);
  });
  it('Safari Ball needs a foe at full HP', () => {
    expect(bonus('safari-ball', 'rattata')).toBe(2);
    expect(bonus('safari-ball', 'rattata', (f) => { f.hp = maxHp(content, f) - 1; })).toBe(1);
  });
  it('Sport Ball favours Bug and Fighting types', () => {
    expect(bonus('sport-ball', 'caterpie')).toBe(3);
    expect(bonus('sport-ball', 'machop')).toBe(3);
    expect(bonus('sport-ball', 'rattata')).toBe(1);
  });
  it('Feather, Wing and Jet Balls only help against Flying types', () => {
    expect([bonus('feather-ball', 'pidgey'), bonus('wing-ball', 'pidgey'), bonus('jet-ball', 'pidgey')]).toEqual([2, 3, 4]);
    expect(bonus('jet-ball', 'rattata')).toBe(1);
  });
  it('Leaden and Gigaton Balls go by weight', () => {
    expect(bonus('leaden-ball', 'snorlax')).toBe(2.5);
    expect(bonus('leaden-ball', 'pidgey')).toBe(1);
    expect(bonus('gigaton-ball', 'snorlax')).toBe(5);
    expect(bonus('gigaton-ball', 'machop')).toBe(1);
  });
});
