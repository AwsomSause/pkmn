// Levels to 500 (left-out plan 1.6): party-strength correction, threat budgets past 100, custom regions.
import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { curveLevel, enemyLevel, levelScale, withPartyStrength } from '../../src/core/encounters';
import { getCampaign, levelCap } from '../../src/core/regions';
import { hashSeed, Rng } from '../../src/core/rng';
import { threatBudget } from '../../src/core/threat';
import { regionSpecialWilds, typesPool } from '../../src/core/themes';
import { content } from './helpers';

const FULL = getCampaign(content, 'full');
const RED = getArchetype(content, 'red');

describe('party-strength correction (GAME_DESIGN C7)', () => {
  const scale = levelScale(content, FULL, 3, 4, 10);
  const curve = curveLevel(content, scale);
  const cfg = content.balance.difficulty.partyStrength;

  it('does nothing for a party at or below the curve (plus grace)', () => {
    expect(withPartyStrength(content, scale, [curve + cfg.grace, curve, 5]).party).toBeUndefined();
    expect(withPartyStrength(content, scale, [5, 4]).party).toBeUndefined();
    expect(withPartyStrength(content, scale, []).party).toBeUndefined();
  });

  it('adds part of the excess, capped at maxBonus, and uses the top three levels', () => {
    expect(withPartyStrength(content, scale, [curve + cfg.grace + 4, curve + cfg.grace + 4, curve + cfg.grace + 4, 1]).party).toBe(Math.round(4 * cfg.factor));
    expect(withPartyStrength(content, scale, [curve + 200, curve + 200, curve + 200]).party).toBe(cfg.maxBonus);
  });

  it('raises the enemy level before clamping to the cap, and is off when disabled', () => {
    const strong = withPartyStrength(content, scale, [curve + 50, curve + 50, curve + 50]);
    const a = enemyLevel(content, RED, scale, 0, new Rng(hashSeed('p')));
    const b = enemyLevel(content, RED, strong, 0, new Rng(hashSeed('p')));
    expect(b.level - a.level).toBe(cfg.maxBonus);
    expect(b.party).toBe(cfg.maxBonus);
    const top = enemyLevel(content, RED, { ...strong, t: 1, party: 99 }, 99, new Rng(hashSeed('p')));
    expect(top.level).toBe(scale.cap);
    const off = { ...content, balance: { ...content.balance, difficulty: { ...content.balance.difficulty, partyStrength: { ...cfg, enabled: false } } } };
    expect(withPartyStrength(off, scale, [curve + 50, curve + 50]).party).toBeUndefined();
  });
});

describe('levels past 100', () => {
  it('threat budgets keep rising past level 100 and stay put below it', () => {
    for (const tier of ['easy', 'standard', 'challenging', 'elite'] as const) {
      const b = content.balance.threat.budgets[tier];
      expect(threatBudget(content, tier, 100)).toBe(Math.min(b.max, b.base + b.perLevel * 100));
      expect(threatBudget(content, tier, 500)).toBeGreaterThan(threatBudget(content, tier, 100));
    }
  });

  it('the Grand Region cap is the max level, and every region stays under it', () => {
    const regions = FULL.regularRegions + 1;
    expect(levelCap(content, regions - 1)).toBe(content.balance.difficulty.maxLevel);
    for (let r = 1; r < regions; r++) expect(levelCap(content, r)).toBeGreaterThan(levelCap(content, r - 1));
  });

  it('custom regions exist, use unique bosses, and have a starter pool and a regional item', () => {
    const custom = [...content.regions.values()].filter((r) => r.custom);
    expect(custom.map((r) => r.id).sort()).toEqual(['frontier-isles', 'torren', 'trial-archipelago']);
    const seen = new Set([...content.regions.values()].filter((r) => !r.custom).flatMap((r) => [...r.gymLeaders, ...r.eliteFour, ...r.champions]));
    for (const r of custom)
      for (const id of [...r.gymLeaders, ...r.eliteFour, ...r.champions]) {
        expect(content.bosses.has(id), id).toBe(true);
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    for (const r of custom) {
      expect(r.gymLeaders).toHaveLength(8);
      expect(content.balance.bank.regional[r.id], r.id).toBeDefined();
    }
  });

  it('Torren lets first-stage Delta Pokémon roam its routes; other regions do not', () => {
    const deltas = regionSpecialWilds(content, 'torren');
    expect(deltas.length).toBeGreaterThan(30);
    for (const s of deltas) {
      expect(s.id.endsWith('-delta')).toBe(true);
      expect(s.evolutionStage).toBe(1);
      expect(s.tags.includes('legendary') || s.tags.includes('mythical')).toBe(false);
    }
    const ghost = typesPool(content, ['ghost'], 'torren', 30).map((p) => p.speciesId);
    expect(ghost).toContain('charmander-delta');
    expect(typesPool(content, ['ghost'], 'kanto', 30).map((p) => p.speciesId)).not.toContain('charmander-delta');
    expect(regionSpecialWilds(content, 'kanto')).toEqual([]);
  });
});
