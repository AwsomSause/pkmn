// Advanced AI port: finishing blows (KO and priority KO) and the danger switch of a smart trainer.

import { describe, expect, it } from 'vitest';
import { createBattle, estimateDamage, moveValue, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { freshStages } from '../../src/core/state';
import { content } from './helpers';

const withAi = (patch: Record<string, number>) => ({ ...content, balance: { ...content.balance, trainerAi: { ...content.balance.trainerAi, ...patch } } });

function setup(userSpecies: string, level: number, targetSpecies: string, targetLevel: number, moves: string[]) {
  const user = createPokemon(content, userSpecies, level, 'u');
  user.moves = moves.map((id) => ({ id, pp: 10 }));
  const target = createPokemon(content, targetSpecies, targetLevel, 't');
  return { user, target };
}

describe('finishing blows', () => {
  it('a move that should KO is worth koBonus times its plain score', () => {
    const { user, target } = setup('garchomp', 60, 'charmander', 5, ['earthquake', 'tackle']);
    target.hp = 3;
    const brain = (c: typeof content) => ({ content: c, ai: 1, target, stages: freshStages() });
    const plain = moveValue(brain(withAi({ koBonus: 1, priorityKoBonus: 1 })), user, 'earthquake');
    const boosted = moveValue(brain(withAi({ koBonus: 2, priorityKoBonus: 1 })), user, 'earthquake');
    expect(plain).toBeGreaterThan(0);
    expect(boosted).toBeCloseTo(plain * 2);
  });

  it('a move that cannot KO keeps its plain score', () => {
    const { user, target } = setup('rattata', 5, 'blissey', 60, ['tackle']);
    const plain = moveValue({ content: withAi({ koBonus: 1 }), ai: 1, target, stages: freshStages() }, user, 'tackle');
    expect(moveValue({ content, ai: 1, target, stages: freshStages() }, user, 'tackle')).toBeCloseTo(plain);
  });

  it('estimates damage for attacks only', () => {
    const { user, target } = setup('garchomp', 60, 'charmander', 20, ['earthquake', 'swords-dance']);
    const brain = { content, ai: 1, target, stages: freshStages() };
    expect(estimateDamage(brain, user, 'earthquake')).toBeGreaterThan(target.hp);
    expect(estimateDamage(brain, user, 'swords-dance')).toBe(0);
  });
});

describe('danger switch', () => {
  function trainerFight(dangerSwitch: number) {
    const player = createPokemon(content, 'garchomp', 60, 'p1');
    player.moves = [{ id: 'earthquake', pp: 10 }];
    const weak = createPokemon(content, 'charmander', 30, 'e1');
    const safe = createPokemon(content, 'pidgeot', 30, 'e2'); // Flying: Earthquake does nothing to it
    const battle = createBattle('trainer', [weak, safe], 0, player.uid);
    battle.ai = 1;
    battle.enemyVolatile.turnsOut = 2;
    const c = withAi({ dangerSwitch, switchRatio: 0.01 }); // the older "my moves are weak" swap stays out of the way
    const ctx: BattleContext = { content: c, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('ds')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    return { battle, ctx, weak, safe };
  }

  it('a smart trainer swaps a Pokémon the player would KO for one that takes the hit', () => {
    const { battle, ctx, safe } = trainerFight(0.5);
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.enemyTeam[battle.enemyIndex]!.uid).toBe(safe.uid);
    expect(battle.enemySwitches).toBe(1);
  });

  it('with dangerSwitch 0 it does not', () => {
    const { battle, ctx, weak } = trainerFight(0);
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.enemyTeam[0]!.uid === weak.uid || weak.hp > 0).toBe(true);
    expect(battle.enemySwitches).toBe(0);
  });
});
