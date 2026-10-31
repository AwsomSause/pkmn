// Starter Sets (plans/starter-sets-quests-mastery-plan.md, Part 1): the
// Starter Laboratory's pools by category, with pools built from evolved
// species, bosses' signature Pokémon and type/region filters.

import { describe, expect, it } from 'vitest';
import { STARTER_POOL_CATEGORIES } from '../../src/core/contentSchema';
import { createProfile } from '../../src/core/profile';
import { hashSeed, Rng } from '../../src/core/rng';
import { defaultPrep, draftStarters, eligibleSpecies, firstStage, poolStatus } from '../../src/core/runPrep';
import { isWildEligible } from '../../src/core/themes';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { content } from './helpers';

const pools = [...content.starterPools.values()];
const pool = (id: string) => content.starterPools.get(id)!;

describe('starter sets', () => {
  it('covers every category, every type, every region and every villainous team', () => {
    for (const c of STARTER_POOL_CATEGORIES) expect(pools.some((p) => p.category === c), c).toBe(true);
    expect(pools.filter((p) => p.category === 'type')).toHaveLength(18);
    for (const r of content.regions.values()) if (!r.grand) expect(pools.some((p) => p.filter?.region === r.id || p.id === r.id), r.id).toBe(true);
    expect(pools.filter((p) => p.category === 'league')).toHaveLength(9);
    expect(pools.filter((p) => p.category === 'evilTeam').length).toBeGreaterThanOrEqual(10);
  });

  it('every pool can draw three starters, and every starter is a legal first stage with a usable move', () => {
    for (const p of pools.filter((x) => !x.mastered)) {
      const ids = eligibleSpecies(content, p);
      expect(ids.length, p.id).toBeGreaterThanOrEqual(content.balance.starterChoices);
      for (const id of ids) {
        const s = content.species.get(id)!;
        expect(s.evolutionStage, `${p.id}: ${id}`).toBe(1);
        // An earned special-form set (Spooky Set) offers forms the wild never does.
        if (!p.specialForms && !p.specimens) expect(isWildEligible(content, s), `${p.id}: ${id}`).toBe(true);
      }
    }
  });

  it('an evolved species stands for its first stage; legendaries are left out', () => {
    expect(firstStage(content, 'charizard')?.id).toBe('charmander');
    expect(firstStage(content, 'pikachu')?.id).toBe('pikachu');
    const unite = eligibleSpecies(content, pool('spin-unite'));
    expect(unite).toContain('scorbunny');
    expect(unite).not.toContain('cinderace');
    const aether = eligibleSpecies(content, pool('team-aether'));
    expect(aether).not.toContain('cosmog');
  });

  it('builds pools from bosses and from filters', () => {
    expect(eligibleSpecies(content, pool('trainer-misty')).every((id) => content.species.get(id)!.types.length > 0)).toBe(true);
    expect(eligibleSpecies(content, pool('trainer-misty'))).toContain('staryu');
    const fire = eligibleSpecies(content, pool('type-fire'));
    expect(fire.every((id) => content.species.get(id)!.types.includes('fire'))).toBe(true);
    expect(fire).toContain('charmander');
    expect(eligibleSpecies(content, pool('paldea'))).toContain('sprigatito');
  });

  it('new sets start locked or buyable, never free', () => {
    const p = createProfile(content, 'p');
    for (const pl of pools) if (!pl.unlockedByDefault) expect(poolStatus(content, p, pl), pl.id).not.toBe('unlocked');
    expect(poolStatus(content, p, pool('type-water'))).toBe('locked');
    const earned = { ...p, counters: { ...p.counters, 'bossWinsLead.water': 2 } };
    expect(poolStatus(content, earned, pool('type-water'))).toBe('buyable');
  });

  it('draws the same three starters from a big filtered pool for the same seed', () => {
    const prep = { ...defaultPrep(content), poolId: 'type-dragon' };
    const a = draftStarters(content, new Rng(hashSeed('sets')), prep).choices;
    const b = draftStarters(content, new Rng(hashSeed('sets')), prep).choices;
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    for (const id of a) expect(content.species.get(id)!.types).toContain('dragon');
  });

  it('rejects a pool with nothing in it, an unknown boss or an unknown region', () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    raw.runPrep.starterPools.push({ id: 'empty', name: 'Empty', description: '' });
    expect(() => buildContent(raw)).toThrow(/needs species, bosses, a filter/);
    const raw2 = structuredClone(RAW_CONTENT) as any;
    raw2.runPrep.starterPools.push({ id: 'x', name: 'X', description: '', bosses: ['nobody'], filter: { region: 'atlantis' } });
    expect(() => buildContent(raw2)).toThrow(/unknown boss "nobody"[\s\S]*atlantis|atlantis[\s\S]*nobody/);
  });
});

import { resolvePrep } from '../../src/core/runPrep';
import { chooseStarter, createRun } from '../../src/core/run';
import { RANK_BADGES } from '../../src/core/mastery';

describe('challenge sets, Special Specimens and mastery frames', () => {
  const pool = (id: string) => content.starterPools.get(id)!;
  it('challenge sets are filled and Special Specimens offer only legendary or mythical Pokémon', () => {
    expect(eligibleSpecies(content, pool('challenge-underdogs')).length).toBeGreaterThanOrEqual(3);
    expect(eligibleSpecies(content, pool('challenge-singles')).length).toBeGreaterThanOrEqual(3);
    const ids = eligibleSpecies(content, pool('special-specimen'));
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(content.species.get(id)!.tags.some((t) => t === 'legendary' || t === 'mythical'), id).toBe(true);
    for (const p of content.starterPools.values()) if (!p.specimens) for (const id of eligibleSpecies(content, p)) expect(content.species.get(id)!.tags.includes('legendary'), `${p.id} ${id}`).toBe(false);
  });
  it('a Special Specimen run is limited to the Standard draft rule and starts lower', () => {
    const profile = createProfile(content, 'p');
    const wanted = { ...defaultPrep(content), poolId: 'special-specimen', draftRuleId: 'expanded-research' };
    // Not unlocked yet: falls back to the default pool, so unlock it directly for the rule check.
    profile.unlockedPools.push('special-specimen');
    const resolved = resolvePrep(content, profile, 'red', wanted);
    expect(resolved.prep.draftRuleId).toBe(defaultPrep(content).draftRuleId);
    const draft = draftStarters(content, new Rng(hashSeed('sp')), { ...defaultPrep(content), poolId: 'special-specimen' });
    const run = createRun(content, { runId: 'sp', seed: 'sp', archetypeId: 'red', prep: { ...defaultPrep(content), poolId: 'special-specimen' } });
    run.starterChoices = draft.choices;
    const started = chooseStarter(content, run, 0);
    expect(started.party[0]!.level).toBe(content.balance.starterLevel - content.balance.specialSpecimen.levelPenalty);
  });
  it('Silver and above earn a frame', () => {
    expect(RANK_BADGES.caught.frame).toBeNull();
    for (const r of ['bronze', 'silver', 'gold', 'master'] as const) expect(RANK_BADGES[r].frame).not.toBeNull();
  });
});
