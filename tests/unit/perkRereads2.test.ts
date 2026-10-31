import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { statusChancePerk, shopEarlyRareStockPerk } from '../../src/core/trainerPerks';
import { getArchetype } from '../../src/core/archetypes';

const perks = (id: string) => getArchetype(content, id).modifiers;

describe('perk re-reads (2.8, second batch)', () => {
  it('Giacomo and Ilima raise status-effect chances', () => {
    expect(statusChancePerk(perks('giacomo'), [], 'brn')).toBeCloseTo(1.15);
    expect(statusChancePerk(perks('ilima'), [], 'par')).toBeCloseTo(1.1);
    expect(statusChancePerk(perks('red'), [], 'par')).toBe(1);
  });
  it('Ginter puts rare shop items on sale early', () => {
    expect(shopEarlyRareStockPerk(perks('ginter'))).toBe(2);
  });
});
