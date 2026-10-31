import { describe, expect, it } from 'vitest';
import { addLevels, calcStats, createPokemon, gainXp, levelFromXp, xpForDefeat, xpForLevel } from '../../src/core/pokemon';
import { content } from './helpers';

describe('Pokémon stats and experience', () => {
  it('computes stats with the no-IV/EV formula', () => {
    const mon = createPokemon(content, 'bulbasaur', 5, 'p1');
    mon.nature = 'serious';
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

  it('levels above 100 cost more EXP each level and stay continuous at 100 (D14)', () => {
    for (const rate of ['fast', 'medium-fast', 'medium-slow', 'slow', 'erratic', 'fluctuating'] as const) {
      let prevStep = 0;
      for (let n = 2; n <= 1000; n++) {
        const step = xpForLevel(rate, n) - xpForLevel(rate, n - 1);
        expect(step).toBeGreaterThan(0);
        if (n > 101) expect(step).toBeGreaterThanOrEqual(prevStep);
        prevStep = step;
      }
      expect(levelFromXp(rate, xpForLevel(rate, 437), 1000)).toBe(437);
      expect(levelFromXp(rate, xpForLevel(rate, 437) - 1, 1000)).toBe(436);
      expect(levelFromXp(rate, Number.MAX_SAFE_INTEGER, 1000)).toBe(1000);
    }
    // Level 101 costs 0.4 × level 100's cost × 1.01.
    expect(xpForLevel('medium-fast', 101) - xpForLevel('medium-fast', 100)).toBe(Math.floor((0.4 * 29_701 * 101) / 100));
    // Without a higher max level, the old cap of 100 holds.
    expect(levelFromXp('medium-fast', xpForLevel('medium-fast', 300))).toBe(100);
  });

  it('a Pokémon above 100 has stats from the same formula and gains levels up to the cap', () => {
    const big = { ...content, balance: { ...content.balance, difficulty: { ...content.balance.difficulty, maxLevel: 1000 } } };
    const mon = createPokemon(big, 'machop', 100, 'p1');
    const hp100 = calcStats(big, mon).hp;
    const res = gainXp(big, mon, xpForLevel('medium-slow', 250) - mon.xp, 200);
    expect(res.newLevel).toBe(200);
    expect(calcStats(big, mon).hp).toBeGreaterThan(hp100 * 1.9);
    expect(Number.isFinite(calcStats(big, mon).atk)).toBe(true);
    // The live data still stops at its maxLevel.
    const capped = createPokemon(content, 'machop', 100, 'p2');
    expect(gainXp(content, capped, 1e9, 500).newLevel).toBe(content.balance.difficulty.maxLevel);
  });

  it('starts with the last four moves learned by its level', () => {
    // Bulbasaur learns tackle 1, growl 2, vine-whip 8, poison-powder 14, sleep-powder 16, take-down 17.
    const mon = createPokemon(content, 'bulbasaur', 17, 'p1');
    expect(mon.moves.map((m) => m.id)).toEqual(['vine-whip', 'poison-powder', 'sleep-powder', 'take-down']);
  });

  it('defeat XP uses the scaled formula and multiplier', () => {
    // b=50, Lf=5, Lp=5: (50*5/5) * (20/20)^2.5 = 50 → +1 = 51
    expect(xpForDefeat(50, 5, 5, 1)).toBe(51);
    expect(xpForDefeat(50, 5, 5, 1.25)).toBe(63);
  });

  it('level-ups add HP and learn new moves while slots are free', () => {
    const mon = createPokemon(content, 'bulbasaur', 6, 'p1'); // tackle, growl, plus an early vine-whip so it is not Normal-only
    const hpBefore = calcStats(content, mon).hp;
    mon.hp = 10;
    const result = gainXp(content, mon, xpForLevel('medium-slow', 7) - mon.xp);
    expect(result.newLevel).toBe(7);
    expect(result.learnedMoves).toEqual(['leech-seed']);
    expect(mon.hp).toBe(10 + (calcStats(content, mon).hp - hpBefore));
  });

  it('reports moves it could not learn when four are known', () => {
    const mon = createPokemon(content, 'bulbasaur', 16, 'p1');
    expect(mon.moves).toHaveLength(4);
    const result = addLevels(content, mon, 1);
    expect(result.skippedMoves).toEqual(['take-down']);
  });

  it('a fainted Pokémon stays fainted after levelling', () => {
    const mon = createPokemon(content, 'bulbasaur', 5, 'p1');
    mon.hp = 0;
    addLevels(content, mon, 1);
    expect(mon.hp).toBe(0);
  });
});
