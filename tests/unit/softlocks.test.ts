// Softlock scan: no Pokémon may enter a fight, at any level it can show up at, without a move that deals damage.

import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

function hurts(moveId: string): boolean {
  const m = content.moves.get(moveId);
  if (!m) return false;
  const fx = m.effects as { fixedDamage?: unknown; ohko?: unknown } | undefined;
  return (m.power ?? 0) > 0 || Boolean(fx?.fixedDamage) || Boolean(fx?.ohko);
}

describe('no attack-less Pokémon', () => {
  it('every species has a damaging move from its first usable level', () => {
    const bad: string[] = [];
    for (const s of content.species.values()) {
      if (s.id === 'ditto') continue; // Transform copies the foe's moves
      for (const level of [2, 5, 10, 20, 40]) {
        const mon = createPokemon(content, s.id, level, 'x');
        if (!mon.moves.some((mv) => hurts(mv.id))) bad.push(`${s.id}@${level}`);
      }
    }
    expect(bad.slice(0, 60)).toEqual([]);
  });
});
