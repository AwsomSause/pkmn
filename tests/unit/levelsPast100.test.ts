// Levels to 500 (left-out plan 1.6): party-strength correction, threat budgets past 100, custom regions.
import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { bossBand, strongestMoves } from '../../src/core/bossBands';
import { createPlannedPokemon, curveLevel, enemyLevel, levelScale, planChampion, withPartyStrength } from '../../src/core/encounters';
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

describe('boss teams past level 100 (bossBands)', () => {
  const plan = (level: number) => {
    const scale = { start: level - 5, end: level - 5, t: 1, cap: level };
    return planChampion(content, RED, 'lance', 9, scale, new Rng(hashSeed('band')));
  };

  it('leaves teams at 100 and below exactly as authored', () => {
    const p = plan(100);
    const authored = content.bosses.get('lance')!.teams.champion[9]!;
    expect(p.members.map((m) => m.speciesId)).toEqual(authored.members.map((m) => m.speciesId));
    expect(p.members.every((m) => !m.held)).toBe(true);
    expect(p.ai).toBe(authored.ai);
  });

  it('every band item is a real held item and bands rise with level', () => {
    const bands = content.balance.bossBands;
    for (let i = 1; i < bands.length; i++) expect(bands[i]!.minLevel).toBeGreaterThan(bands[i - 1]!.minLevel);
    for (const b of bands) for (const id of b.items) expect(content.catalog.get(id)?.effect?.kind, id).toBe('held');
  });

  it('later bands bring more training, items, sharper AI and only usable moves', () => {
    const low = plan(100);
    for (const level of [150, 250, 350, 450]) {
      const p = plan(level);
      const band = bossBand(content, Math.max(...p.members.map((m) => m.level)))!;
      expect(band).toBeDefined();
      expect(p.ai).toBeCloseTo(Math.min(1, low.ai + band.ai));
      for (const m of p.members) {
        expect(m.held && Object.keys(m.held).length).toBe(1);
        expect(m.moves!.length).toBeGreaterThan(0);
        for (const id of m.moves!) expect(content.moves.has(id), id).toBe(true);
        expect(Math.max(...Object.values(m.training ?? {}))).toBeGreaterThanOrEqual(band.training);
      }
      const mon = createPlannedPokemon(content, p.members.at(-1)!, 'ace');
      expect(Object.keys(mon.held ?? {})).toHaveLength(1);
    }
    expect(plan(450)).toEqual(plan(450));
  });

  it('strongest moves are damaging, one per type, best first', () => {
    const s = content.species.get('garchomp')!;
    const moves = strongestMoves(content, s, 100);
    expect(moves.length).toBeGreaterThan(2);
    const types = moves.map((id) => content.moves.get(id)!.type);
    expect(new Set(types).size).toBe(types.length);
    expect(moves.every((id) => content.moves.get(id)!.category !== 'status')).toBe(true);
  });
});
