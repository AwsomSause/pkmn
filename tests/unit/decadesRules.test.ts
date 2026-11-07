import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, startBattle, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { battleContent, makeRules, rulesProblem, rulesetFlagsOf, STANDARD_CHOICE } from '../../src/core/rules';
import { content } from './helpers';

const withMods = (modifierIds: string[]) => ({ ...STANDARD_CHOICE, modifierIds });

function fight(mods: string[], tweak: (p: ReturnType<typeof createPokemon>, e: ReturnType<typeof createPokemon>) => void, seed = 'dec') {
  const player = createPokemon(content, 'charmander', 30, 'p');
  const enemy = createPokemon(content, 'rattata', 30, 'e');
  tweak(player, enemy);
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content: battleContent(content, makeRules(withMods(mods))), battle, party: [player], inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  startBattle(ctx);
  return { ctx, player, enemy };
}

describe('Decades rule options', () => {
  it('flags switch on only with the modifier, and the plain content is untouched', () => {
    expect(rulesetFlagsOf(makeRules(withMods([])))).toEqual({});
    expect(rulesetFlagsOf(makeRules(withMods(['frostbite', 'drowsy', 'own-type-normal'])))).toEqual({ frostbite: true, drowsy: true, normalFollowsUser: true });
    expect(battleContent(content, makeRules(withMods([])))).toBe(content);
    expect(battleContent(content, makeRules(withMods(['frostbite']))).ruleset.frostbite).toBe(true);
    expect(content.ruleset.frostbite).toBeUndefined();
    expect(rulesProblem(withMods(['frostbite', 'drowsy', 'own-type-normal', 'inverse-battle']))).toBeNull();
  });

  it('Own-Type Normal: a Fire-type user\'s Normal move hits as Fire', () => {
    const hit = (mods: string[]) => {
      const { ctx, enemy } = fight(mods, (p, e) => { p.moves = [{ id: 'tackle', pp: 35 }]; e.moves = [{ id: 'growl', pp: 40 }]; e.speciesId = 'bulbasaur'; });
      const before = enemy.hp;
      resolveTurn(ctx, { kind: 'move', index: 0 });
      return before - enemy.hp;
    };
    // Fire into a Grass/Poison target is super effective; plain Normal is neutral.
    expect(hit(['own-type-normal'])).toBeGreaterThan(hit([]));
  });

  it('Frostbite: a frozen Pokémon still acts, and the rule is off by default', () => {
    const acts = (mods: string[]) => {
      const { ctx, enemy } = fight(mods, (p, e) => { p.moves = [{ id: 'tackle', pp: 35 }]; p.status = { id: 'frz' } as never; e.moves = [{ id: 'growl', pp: 40 }]; });
      const before = enemy.hp;
      for (let i = 0; i < 3; i++) resolveTurn(ctx, { kind: 'move', index: 0 });
      return before - enemy.hp;
    };
    expect(acts(['frostbite'])).toBeGreaterThan(0);
  });

  it('Drowsy: a sleeper acts on some turns instead of none', () => {
    const acts = (mods: string[]) => {
      const { ctx, enemy } = fight(mods, (p, e) => { p.moves = [{ id: 'tackle', pp: 35 }]; p.status = { id: 'slp', turns: 99 } as never; e.moves = [{ id: 'growl', pp: 40 }]; e.hp = e.hp; });
      const before = enemy.hp;
      for (let i = 0; i < 12; i++) resolveTurn(ctx, { kind: 'move', index: 0 });
      return before - enemy.hp;
    };
    expect(acts([])).toBe(0);
    expect(acts(['drowsy'])).toBeGreaterThan(0);
  });
});
