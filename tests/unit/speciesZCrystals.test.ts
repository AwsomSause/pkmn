// Species Z-Crystals: a signature Z-Move for one species and one move, replacing the type Z-Move.
import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { speciesZ, transformProblem, zMoveFor, zMoveOptions, type TransformContext } from '../../src/core/battle/transform';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

const crystals = [...content.items.values()].filter((i) => i.effect.kind === 'speciesZCrystal');

function setup(inventory: Record<string, number>, speciesId: string, moves: string[]) {
  const player = createPokemon(content, speciesId, 60, 'p1');
  player.moves = moves.map((id) => ({ id, pp: 10 }));
  const foe = createPokemon(content, 'snorlax', 60, 'e1');
  const battle = createBattle('trainer', [foe], 0, player.uid, { classId: 'elite-four', name: 'T', leaderId: null });
  battle.turn = 6;
  const ctx: TransformContext = { content, battle, party: [player], inventory };
  return { ctx, player };
}

describe('species Z-Crystals', () => {
  it('has 17 crystals whose species, move and Z-Move all exist and whose Z-Move is a supported Z-flagged move', () => {
    expect(crystals).toHaveLength(17);
    for (const c of crystals) {
      if (c.effect.kind !== 'speciesZCrystal') continue;
      for (const s of c.effect.species) expect(content.species.has(s), `${c.id} ${s}`).toBe(true);
      expect(content.moves.get(c.effect.move)?.supported, c.id).toBe(true);
      const z = content.moves.get(c.effect.zMove)!;
      expect(z.supported && z.flags.includes('zmove'), c.id).toBe(true);
    }
  });

  it('Pikanium Z turns Pikachu\'s Volt Tackle into Catastropika, but not Thunderbolt or another species', () => {
    const inv = { 'z-ring': 1, 'pikanium-z': 1 };
    expect(speciesZ(content, inv, 'pikachu', 'volt-tackle')?.move.id).toBe('catastropika');
    expect(speciesZ(content, inv, 'pikachu', 'thunderbolt')).toBeNull();
    expect(speciesZ(content, inv, 'raichu', 'volt-tackle')).toBeNull();
    expect(speciesZ(content, {}, 'pikachu', 'volt-tackle')).toBeNull();
    const vt = content.moves.get('volt-tackle')!;
    expect(zMoveFor(content, vt, { speciesId: 'pikachu', inventory: inv })).toMatchObject({ id: 'catastropika', accuracy: null });
    expect(zMoveFor(content, vt)!.id).not.toBe('catastropika'); // without a user, the type Z-Move
  });

  it('works in the Z-Move options, and the type crystal still works for other moves', () => {
    const { ctx, player } = setup({ 'z-ring': 1, 'pikanium-z': 1, 'electrium-z': 1 }, 'pikachu', ['volt-tackle', 'thunderbolt']);
    ctx.gimmicks = undefined;
    const opts = zMoveOptions(ctx);
    expect(opts[0]?.id).toBe('catastropika');
    expect(opts[1]?.id).not.toBe('catastropika');
    expect(transformProblem(ctx, { kind: 'zmove' }, 0)).toBeNull();
    // With only the species crystal, Thunderbolt has no Z-Move crystal.
    const only = setup({ 'z-ring': 1, 'pikanium-z': 1 }, 'pikachu', ['thunderbolt']);
    expect(transformProblem(only.ctx, { kind: 'zmove' }, 0)).toMatch(/Z-Crystal/);
    expect(player.speciesId).toBe('pikachu');
  });
});
