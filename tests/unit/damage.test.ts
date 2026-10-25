import { describe, expect, it } from 'vitest';
import {
  accuracyStageMultiplier,
  calcDamage,
  compareTurnOrder,
  critChance,
  effectiveSpeed,
  hitChance,
  isStatusImmune,
  statStageMultiplier,
  typeEffectiveness,
  type DamageInput,
} from '../../src/core/battle/damage';
import { content } from './helpers';

const rules = content.ruleset;
const base: DamageInput = {
  level: 10, power: 40, attack: 20, defense: 20, attackStage: 0, defenseStage: 0,
  stab: false, effectiveness: 1, crit: false, randomFactor: 100, burned: false, physical: true,
};

describe('type effectiveness', () => {
  it('handles single, dual, and immune matchups', () => {
    expect(typeEffectiveness(content.typeChart, 'water', ['fire'])).toBe(2);
    expect(typeEffectiveness(content.typeChart, 'grass', ['fire'])).toBe(0.5);
    expect(typeEffectiveness(content.typeChart, 'water', ['rock', 'ground'])).toBe(4);
    expect(typeEffectiveness(content.typeChart, 'normal', ['ghost', 'poison'])).toBe(0);
    expect(typeEffectiveness(content.typeChart, 'normal', ['normal'])).toBe(1);
  });
});

describe('damage formula', () => {
  it('matches a hand-calculated value', () => {
    // floor(floor(floor(2*10/5+2)*40*20/20)/50)+2 = floor(240/50)+2 = 6
    expect(calcDamage(rules, base)).toBe(6);
  });

  it('applies STAB, type, crit, random and burn in order', () => {
    expect(calcDamage(rules, { ...base, stab: true })).toBe(9);
    expect(calcDamage(rules, { ...base, effectiveness: 2 })).toBe(12);
    expect(calcDamage(rules, { ...base, crit: true })).toBe(9);
    expect(calcDamage(rules, { ...base, randomFactor: 85 })).toBe(5);
    expect(calcDamage(rules, { ...base, burned: true })).toBe(3);
    expect(calcDamage(rules, { ...base, burned: true, physical: false })).toBe(6);
  });

  it('immunity deals 0 and everything else deals at least 1', () => {
    expect(calcDamage(rules, { ...base, effectiveness: 0 })).toBe(0);
    expect(calcDamage(rules, { ...base, power: 1, attack: 1, defense: 500, effectiveness: 0.25 })).toBe(1);
  });

  it('critical hits ignore bad attack stages and good defense stages', () => {
    const debuffed = { ...base, attackStage: -2, defenseStage: 2 };
    expect(calcDamage(rules, { ...debuffed, crit: true })).toBe(calcDamage(rules, { ...base, crit: true }));
  });
});

describe('stages, accuracy, crits, speed', () => {
  it('stat stage multipliers', () => {
    expect(statStageMultiplier(0)).toBe(1);
    expect(statStageMultiplier(2)).toBe(2);
    expect(statStageMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(statStageMultiplier(9)).toBe(4);
    expect(accuracyStageMultiplier(-1)).toBe(0.75);
  });

  it('hit chance stays within 0..1', () => {
    expect(hitChance(null, -6, 6)).toBe(1);
    expect(hitChance(100, 6, -6)).toBe(1);
    expect(hitChance(100, -1, 0)).toBe(0.75);
    expect(hitChance(75, -6, 6)).toBeGreaterThanOrEqual(0);
  });

  it('crit chance by stage', () => {
    expect(critChance(rules, 0)).toBeCloseTo(1 / 24);
    expect(critChance(rules, 1)).toBe(0.125);
    expect(critChance(rules, 9)).toBe(1);
  });

  it('paralysis halves speed', () => {
    expect(effectiveSpeed(rules, 100, 0, true)).toBe(50);
    expect(effectiveSpeed(rules, 100, 1, false)).toBe(150);
  });

  it('priority beats speed, then speed decides, ties reported', () => {
    expect(compareTurnOrder({ priority: 1, speed: 10 }, { priority: 0, speed: 999 })).toBe('a');
    expect(compareTurnOrder({ priority: 0, speed: 10 }, { priority: 0, speed: 20 })).toBe('b');
    expect(compareTurnOrder({ priority: 0, speed: 10 }, { priority: 0, speed: 10 })).toBe('tie');
  });

  it('status immunities by type and powder', () => {
    expect(isStatusImmune('brn', ['fire'])).toBe(true);
    expect(isStatusImmune('par', ['electric', 'steel'])).toBe(true);
    expect(isStatusImmune('psn', ['steel'])).toBe(true);
    expect(isStatusImmune('slp', ['grass'], content.moves.get('sleep-powder'))).toBe(true);
    expect(isStatusImmune('slp', ['normal'], content.moves.get('sleep-powder'))).toBe(false);
  });
});
