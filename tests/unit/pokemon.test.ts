import { describe, expect, it } from 'vitest';
import { addLevels, calcStats, createPokemon, gainXp, levelFromXp, xpForDefeat, xpForLevel } from '../../src/core/pokemon';
import { content } from './helpers';

describe('Pokémon stats and experience', () => {
  it('computes stats with the no-IV/EV formula', () => {
    const mon = createPokemon(content, 'bulbasaur', 5, 'p1');
    // HP = floor(2*45*5/100) + 5 + 10 = 4 + 15 = 19; Atk = floor(2*49*5/100)+5 = 4+5 = 9
    expect(calcStats(content, mon)).toEqual({ hp: 19, atk: 9, def: 9, spa: 11, spd: 11, spe: 9 });
    expect(mon.hp).toBe(19);
  });

  it('vitamins multiply the stat by 10% per stack', () => {
    const mon = createPokemon(content, 'machop', 50, 'p1');
    const before = calcStats(content, mon).atk;
    mon.vitamins.atk = 2;
    expect(calcStats(content, mon).atk).toBe(Math.floor(before * 1.2));
  });

  it('growth rate formulas match known values', () => {
    expect(xpForLevel('medium-fast', 10)).toBe(1000);
    expect(xpForLevel('medium-slow', 5)).toBe(135);
    expect(xpForLevel('slow', 10)).toBe(1250);
    expect(xpForLevel('fast', 10)).toBe(800);
    expect(levelFromXp('medium-fast', 999)).toBe(9);
    expect(levelFromXp('medium-fast', 1000)).toBe(10);
  });

  it('starts with the last four moves learned by its level', () => {
    const mon = createPokemon(content, 'bulbasaur', 15, 'p1');
    expect(mon.moves.map((m) => m.id)).toEqual(['growth', 'razor-leaf', 'poison-powder', 'sleep-powder']);
  });

  it('defeat XP uses the scaled formula and multiplier', () => {
    // b=50, Lf=5, Lp=5: (50*5/5) * (20/20)^2.5 = 50 → +1 = 51
    expect(xpForDefeat(50, 5, 5, 1)).toBe(51);
    expect(xpForDefeat(50, 5, 5, 1.25)).toBe(63);
  });

  it('level-ups add HP and learn new moves while slots are free', () => {
    const mon = createPokemon(content, 'bulbasaur', 5, 'p1'); // tackle, growl, vine-whip
    mon.hp = 10;
    const result = gainXp(content, mon, xpForLevel('medium-slow', 6) - mon.xp);
    expect(result.newLevel).toBe(6);
    expect(result.learnedMoves).toEqual(['growth']);
    expect(mon.hp).toBe(10 + (calcStats(content, mon).hp - 19));
  });

  it('reports moves it could not learn when four are known', () => {
    const mon = createPokemon(content, 'bulbasaur', 11, 'p1');
    expect(mon.moves).toHaveLength(4);
    const result = addLevels(content, mon, 1);
    expect(result.skippedMoves).toEqual(['razor-leaf']);
  });

  it('a fainted Pokémon stays fainted after levelling', () => {
    const mon = createPokemon(content, 'bulbasaur', 5, 'p1');
    mon.hp = 0;
    addLevels(content, mon, 1);
    expect(mon.hp).toBe(0);
  });
});
