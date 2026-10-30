import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { enemyIntent } from '../../src/core/battle/intent';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

const mon = (species: string, moves: string[]) => {
  const m = createPokemon(content, species, 40, species);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
};

describe('boss intent (catalog #117)', () => {
  const me = mon('charizard', ['flamethrower']);
  it('a gym leader telegraphs its best attack, with no RNG', () => {
    const foe = mon('onix', ['growl', 'rock-slide', 'tackle']);
    const battle = createBattle('trainer', [foe, foe], 0, me.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
    const a = enemyIntent(content, battle, me);
    expect(a?.moveId).toBe('rock-slide');
    expect(a?.attack).toBe(true);
    expect(enemyIntent(content, battle, me)).toEqual(a);
  });
  it('ordinary trainers and wild foes stay hidden', () => {
    const foe = mon('onix', ['rock-slide']);
    expect(enemyIntent(content, createBattle('trainer', [foe, foe], 0, me.uid, { classId: 'youngster', name: 'Joey', leaderId: null }), me)).toBeNull();
    expect(enemyIntent(content, createBattle('wild', [foe], 0, me.uid, null), me)).toBeNull();
  });
});
