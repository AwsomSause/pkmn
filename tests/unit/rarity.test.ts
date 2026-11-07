import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { RARITY, RARITY_TIERS, RarityFileSchema, eggRarityWeight, pickEggSpecies, rarityOf, wildRarityWeight } from '../../src/core/rarity';
import { availabilityOf, gatePool } from '../../src/core/availability';
import { hashSeed, Rng } from '../../src/core/rng';
import { wildEligibleSpecies } from '../../src/core/themes';

describe('rarity overhaul', () => {
  it('has the 8 tiers in order, and no shiny tier', () => {
    expect(RARITY.tiers.map((t) => t.id)).toEqual([...RARITY_TIERS]);
    expect(RARITY_TIERS).toEqual(['common', 'uncommon', 'rare', 'veryRare', 'epic', 'legendary', 'mythical', 'special']);
    expect(RARITY_TIERS.includes('shiny' as never)).toBe(false);
  });

  it('rejects a bad config', () => {
    expect(RarityFileSchema.safeParse({ ...RARITY, speciesOverrides: { x: 'shiny' } }).success).toBe(false);
    expect(RarityFileSchema.safeParse({ ...RARITY, tiers: RARITY.tiers.slice(1) }).success).toBe(false);
  });

  it('overrides name real species', () => {
    for (const id of Object.keys(RARITY.speciesOverrides)) expect(content.species.has(id), id).toBe(true);
  });

  it('maps every sheet tier onto a tier and every species gets one', () => {
    for (const s of content.species.values()) expect(RARITY_TIERS, s.id).toContain(rarityOf(content, s.id));
    expect(rarityOf(content, 'garchomp')).toBe('epic');
    expect(rarityOf(content, 'nihilego')).toBe('epic');
    expect(rarityOf(content, 'mewtwo')).toBe('legendary');
    expect(rarityOf(content, 'mew')).toBe('mythical');
  });

  it('keeps the tier order for wild odds and keeps Mythical and Special out of ordinary encounters', () => {
    const w = content.balance.availability.rarityWeights;
    expect(w.common).toBeGreaterThan(w.uncommon);
    expect(w.uncommon).toBeGreaterThan(w.rare);
    expect(w.rare).toBeGreaterThan(w.veryRare);
    expect(w.veryRare).toBeGreaterThan(w.epic);
    expect(w.epic).toBeGreaterThan(w.legendary);
    expect(w.legendary).toBeGreaterThan(w.mythical);
    for (const s of content.species.values()) if (RARITY.wildBlocked.includes(rarityOf(content, s.id))) expect(wildRarityWeight(content, s.id), s.id).toBe(0);
  });

  it('a form can be rarer than its base, never rarer into Legendary', () => {
    const order = (id: string) => RARITY_TIERS.indexOf(rarityOf(content, id));
    for (const s of content.species.values()) {
      if (!s.form || RARITY.speciesOverrides[s.id] || s.tags.includes('legendary') || s.tags.includes('mythical')) continue;
      const base = content.species.get(s.form.base);
      if (base && availabilityOf(content, base.id)) expect(order(s.id), s.id).toBeLessThanOrEqual(RARITY_TIERS.indexOf('epic'));
    }
    expect(RARITY.formShift.gigantamax).toBeGreaterThanOrEqual(RARITY.formShift.regional);
  });

  it('gatePool scales weights by the new tiers', () => {
    const pool = [{ speciesId: 'rattata', weight: 1 }, { speciesId: 'garchomp', weight: 1 }];
    const { pool: out } = gatePool(content, pool, 100);
    const w = Object.fromEntries(out.map((p) => [p.speciesId, p.weight]));
    expect(w.garchomp).toBeLessThan(w.rattata!);
  });

  it('egg species never come out Legendary, Mythical or Special, and Epic is rarer than Common', () => {
    const list = wildEligibleSpecies(content).filter((s) => s.evolutionStage === 1);
    for (const s of list) if (RARITY.eggBlocked.includes(rarityOf(content, s.id))) expect(eggRarityWeight(content, s.id), s.id).toBe(0);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) { const t = rarityOf(content, pickEggSpecies(content, list, new Rng(hashSeed(`egg${i}`))).id); counts[t] = (counts[t] ?? 0) + 1; }
    expect(counts.legendary ?? 0).toBe(0);
    expect(counts.mythical ?? 0).toBe(0);
    expect(counts.special ?? 0).toBe(0);
    expect(counts.common ?? 0).toBeGreaterThan(counts.rare ?? 0);
    expect(pickEggSpecies(content, list, new Rng(hashSeed('same'))).id).toBe(pickEggSpecies(content, list, new Rng(hashSeed('same'))).id);
  });
});

describe('rarity caps and off-region rarity', () => {
  it('a regional form sits one tier rarer outside its home region, and not at home', async () => {
    const { rarityIn, rarityOf } = await import('../../src/core/rarity');
    const id = 'rattata-alola';
    const home = content.species.get(id)!.form!.region!;
    expect(rarityIn(content, id, home)).toBe(rarityOf(content, id));
    expect(rarityIn(content, id)).toBe(rarityOf(content, id));
    const other = [...content.regions.keys()].find((r) => r !== home)!;
    const away = rarityIn(content, id, other);
    expect(['common', 'uncommon', 'rare', 'veryRare', 'epic'].indexOf(away)).toBeGreaterThanOrEqual(['common', 'uncommon', 'rare', 'veryRare', 'epic'].indexOf(rarityOf(content, id)));
  });

  it('caps: no legendary trades, no epic shop stock or early epic rewards', async () => {
    const { tradeAllowed, shopTierAllowed, rewardTierAllowed, rewardTierCap } = await import('../../src/core/rarity');
    expect(tradeAllowed(content, 'mewtwo')).toBe(false);
    expect(tradeAllowed(content, 'pidgey')).toBe(true);
    expect(shopTierAllowed(content, 'rare')).toBe(true);
    expect(shopTierAllowed(content, 'epic')).toBe(false);
    expect(rewardTierCap(content, 0)).toBe('rare');
    expect(rewardTierCap(content, 1)).toBe('rare');
    expect(rewardTierCap(content, 2)).toBe('epic');
    expect(rewardTierAllowed(content, 'epic', 1)).toBe(false);
    expect(rewardTierAllowed(content, 'epic', 2)).toBe(true);
    expect(rewardTierAllowed(content, 'common', 0)).toBe(true);
  });
});
