// Trainer tiers (M10 §2): tier by progress, class identity, held items/moves/training, memory, determinism.
import { describe, expect, it } from 'vitest';
import { content, scaleAt } from './helpers';
import { getArchetype } from '../../src/core/archetypes';
import { createPlannedPokemon, planTrainer } from '../../src/core/encounters';
import { applyTrainerTier, trainerTierIndex, trainerTierScore, tierClass, tierRung, type TierInput } from '../../src/core/trainerTiers';
import { hashSeed, Rng } from '../../src/core/rng';
import { getSpecies } from '../../src/core/pokemon';

const input = (stageNumber: number, extra: Partial<TierInput> = {}): TierInput => ({ stageNumber, partyBonus: 0, classWins: 0, rematch: false, important: false, ...extra });
const planFor = (classId: string, stage: number) => {
  const scale = scaleAt(Math.min(7, stage), 5, Math.floor(stage / 8));
  const arch = getArchetype(content, [...content.archetypes.keys()][0]!);
  for (const theme of content.themes.values()) {
    for (let i = 0; i < 60; i++) {
      const p = planTrainer(content, arch, theme, stage, scale, new Rng(hashSeed(`t${i}`)), undefined);
      if (p.classId === classId) return { plan: p, scale };
    }
  }
  throw new Error(`no ${classId} plan found`);
};

describe('trainer tier score and index', () => {
  it('rises with stage, party strength, repeat wins and importance, and stops at the ordinary cap', () => {
    expect(trainerTierIndex(content, trainerTierScore(content, input(0)))).toBe(0);
    expect(trainerTierIndex(content, trainerTierScore(content, input(30)))).toBeGreaterThan(trainerTierIndex(content, trainerTierScore(content, input(5))));
    expect(trainerTierScore(content, input(5, { classWins: 4, important: true, rematch: true }))).toBeGreaterThan(trainerTierScore(content, input(5)));
    const max = content.trainerTiers.tiers.findIndex((t) => t.id === content.trainerTiers.maxOrdinaryTier);
    expect(trainerTierIndex(content, 1e6)).toBe(max);
  });
});

describe('trainer identity', () => {
  it('every ladder rung keeps the class on theme (some member shares a type with the class)', () => {
    for (const cls of content.trainers.values()) {
      const tc = tierClass(content, cls.id);
      for (const [tier, list] of Object.entries(tc.ladder)) {
        const ok = list.some((id) => getSpecies(content, id).types.some((t) => cls.types.includes(t)) || cls.id === 'youngster');
        expect(ok, `${cls.id}/${tier}`).toBe(true);
      }
    }
  });
  it('a Bug Catcher goes from larvae to a coordinated team', () => {
    const cls = tierClass(content, 'bug-catcher');
    expect(tierRung(content, cls, 0)).toContain('caterpie');
    expect(tierRung(content, cls, 3)).toContain('heracross');
    expect(cls.leadMoves).toContain('sticky-web');
  });
});

describe('applying a tier', () => {
  it('is a no-op for an Early trainer without memory', () => {
    const got = planFor('bug-catcher', 0);
    expect(applyTrainerTier(content, got.plan, input(0), got.scale.cap, 's')).toEqual(got.plan);
  });
  it('late trainers hold items, are trained and think harder, deterministically', () => {
    const got = planFor('dragon-tamer', 20);
    const a = applyTrainerTier(content, got.plan, input(60), got.scale.cap, 'seed-1');
    const b = applyTrainerTier(content, got.plan, input(60), got.scale.cap, 'seed-1');
    expect(a).toEqual(b);
    expect(a.ai).toBeGreaterThan(0.5);
    expect(a.members.some((m) => m.held)).toBe(true);
    expect(a.members[a.members.length - 1]!.training).toBeDefined();
    for (const m of a.members) {
      const mon = createPlannedPokemon(content, m, 'x');
      expect(mon.moves.length).toBeGreaterThan(0);
      expect(mon.moves.length).toBeLessThanOrEqual(4);
    }
    expect(a.members.length).toBe(got.plan.members.length);
  });
  it('a trainer that remembers brings back the evolved Pokémon you beat', () => {
    const got = planFor('fisherman', 12);
    let evolved = 0;
    for (let i = 0; i < 40; i++) {
      const out = applyTrainerTier(content, got.plan, input(12), got.scale.cap, `m${i}`, { species: 'poliwag', type: null });
      if (out.members.some((m) => m.speciesId === 'poliwhirl' || m.speciesId === 'poliwrath' || m.speciesId === 'politoed')) evolved++;
    }
    expect(evolved).toBeGreaterThan(0);
  });
  it('a static class (Youngster) ignores memory', () => {
    const got = planFor('youngster', 12);
    const without = applyTrainerTier(content, got.plan, input(12), got.scale.cap, 'k');
    const withMemory = applyTrainerTier(content, got.plan, input(12), got.scale.cap, 'k', { species: 'rattata', type: 'water' });
    expect(withMemory).toEqual(without);
  });
  it('bosses keep their authored teams', () => {
    const got = planFor('bug-catcher', 20);
    expect(applyTrainerTier(content, { ...got.plan, leaderId: 'brock' }, input(60), got.scale.cap, 's')).toEqual({ ...got.plan, leaderId: 'brock' });
  });
});
