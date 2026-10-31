import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { content, scaleAt } from './helpers';
import { AvailabilityFileSchema, availabilityOf, gatePool, isUnlockedAt, unlockLevel } from '../../src/core/availability';
import { getArchetype } from '../../src/core/archetypes';
import { curveLevel, planTrainer, planWild } from '../../src/core/encounters';
import { pickRaidFor, raidLevel } from '../../src/core/raid/raid';
import { levelCap } from '../../src/core/regions';
import { hashSeed, Rng } from '../../src/core/rng';
import { themePool, wildEligibleSpecies } from '../../src/core/themes';

describe('availability.json', () => {
  const file = AvailabilityFileSchema.parse(JSON.parse(readFileSync(new URL('../../src/data/availability.json', import.meta.url), 'utf8')));
  it('only names real species and has sane levels', () => {
    const ids = Object.keys(file.species);
    expect(ids.length).toBeGreaterThan(1000);
    for (const id of ids) {
      expect(content.species.has(id), id).toBe(true);
      expect(file.species[id]!.minLevel, id).toBeLessThanOrEqual(file.species[id]!.maxLevel);
    }
  });

  it('every wild-eligible species has a row (forms use their base species)', () => {
    const missing = wildEligibleSpecies(content).filter((s) => !availabilityOf(content, s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
  });
});

describe('availability gating', () => {
  const slack = content.balance.availability.levelSlack;

  it('unlocks a species at its sheet minimum level minus the slack', () => {
    const min = availabilityOf(content, 'dratini')!.minLevel;
    expect(unlockLevel(content, 'dratini')).toBe(min - slack);
    expect(isUnlockedAt(content, 'dratini', min - slack - 1)).toBe(false);
    expect(isUnlockedAt(content, 'dratini', min - slack)).toBe(true);
  });

  it('a locked species has zero odds; unlocked ones are scaled by rarity', () => {
    const pool = [{ speciesId: 'caterpie', weight: 1 }, { speciesId: 'dratini', weight: 1 }, { speciesId: 'magikarp', weight: 1 }, { speciesId: 'weedle', weight: 1 }];
    const { pool: gated, fallbacks } = gatePool(content, pool, 3);
    expect(gated.map((p) => p.speciesId)).not.toContain('dratini');
    expect(fallbacks).toEqual([]);
    const late = gatePool(content, pool, 40).pool;
    expect(late.find((p) => p.speciesId === 'dratini')!.weight).toBe(content.balance.availability.rarityWeights.veryRare);
    expect(late.find((p) => p.speciesId === 'caterpie')!.weight).toBe(content.balance.availability.rarityWeights.common);
  });

  it('falls back to the earliest-unlocking species so a pool is never empty', () => {
    const pool = [{ speciesId: 'dratini', weight: 1 }, { speciesId: 'larvitar', weight: 1 }, { speciesId: 'beldum', weight: 1 }, { speciesId: 'gible', weight: 1 }];
    const { pool: gated, fallbacks } = gatePool(content, pool, 1);
    expect(gated.length).toBe(content.balance.minThemePool);
    expect(fallbacks.length).toBe(content.balance.minThemePool);
  });

  it('every theme has a pool at level 2', () => {
    for (const theme of content.themes.values()) expect(themePool(content, theme, undefined, 2).length, theme.id).toBeGreaterThan(0);
  });

  it('early wild and trainer Pokémon are all unlocked (or fallbacks)', () => {
    const archetype = getArchetype(content, 'red');
    const scale = scaleAt(0, 1);
    const late: string[] = [];
    for (const theme of content.themes.values()) {
      for (let i = 0; i < 20; i++) {
        const rng = new Rng(hashSeed(`${theme.id}:${i}`));
        const wild = planWild(content, archetype, theme, scale, 0, rng);
        // Pools are gated at the stage's curve level (bonuses such as the Flutes move the level, not the pool).
        const gate = curveLevel(content, scale);
        const fallbacks = gatePool(content, themePool(content, theme, undefined), gate).fallbacks;
        if (!isUnlockedAt(content, wild.speciesId, gate) && !fallbacks.includes(wild.speciesId)) late.push(`${theme.id}:${wild.speciesId}@${gate}`);
      }
      const trainer = planTrainer(content, archetype, theme, 0, scale, new Rng(hashSeed(theme.id)));
      expect(trainer.members.length).toBeGreaterThan(0);
    }
    expect(late).toEqual([]);
  });

  it('raid dens only offer bosses unlocked at their level', () => {
    for (let region = 0; region < 9; region++) {
      for (let i = 0; i < 20; i++) {
        const def = pickRaidFor(content, { seed: `s${i}`, regionIndex: region }, `${region}:${i}`);
        const cap = levelCap(content, region);
        const level = raidLevel(def, Math.max(1, cap - content.balance.difficulty.capMargin), cap);
        const anyUnlocked = content.raids.raids.some((r) => !r.grand && r.species.every((id) => isUnlockedAt(content, id, raidLevel(r, cap - content.balance.difficulty.capMargin, cap))));
        if (anyUnlocked) expect(def.species.every((id) => isUnlockedAt(content, id, level)), `${region}:${def.id}`).toBe(true);
      }
    }
  });
});
