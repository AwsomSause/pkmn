// Trainer identity (plans/starter-sets-quests-mastery-plan.md, Part 2a):
// signature types and Pokémon, and the passives of Cynthia, Oak and N.

import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { createProfile } from '../../src/core/profile';
import { applyRunToProfile } from '../../src/core/progress';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, mapPreviews } from '../../src/core/run';
import { buildSummary, defaultPrep, draftStarters, eligibleSpecies, firstStage, withSignatureStarter } from '../../src/core/runPrep';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { content } from './helpers';

const prep = (poolId = 'classic') => ({ ...defaultPrep(content), poolId });

describe('trainer identity', () => {
  it('every trainer has a signature set in the Starter Laboratory and known signature species', () => {
    for (const a of content.archetypes.values()) {
      expect(a.signaturePool, a.id).not.toBeNull();
      expect(content.starterPools.has(a.signaturePool!), a.id).toBe(true);
      for (const id of a.signatureSpecies) expect(content.species.has(id), `${a.id}: ${id}`).toBe(true);
      expect(a.available, a.id).toBe(true);
    }
  });

  it('a signature Pokémon may take the last slot, never forced, on its own stream', () => {
    const oak = getArchetype(content, 'oak');
    let joined = 0;
    for (let i = 0; i < 400; i++) {
      const drawn = draftStarters(content, new Rng(hashSeed(`d${i}`)), prep()).choices;
      const out = withSignatureStarter(content, new Rng(hashSeed(`s${i}`)), oak, prep(), drawn);
      expect(out.slice(0, 2)).toEqual(drawn.slice(0, 2));
      if (out[2] !== drawn[2]) joined++;
    }
    expect(joined).toBeGreaterThan(40);
    expect(joined).toBeLessThan(360);
  });

  it('the draft rolls the same for every trainer; only the signature slot differs', () => {
    const red = createRun(content, { runId: 'r', seed: 'same', archetypeId: 'red', prep: prep() });
    const misty = createRun(content, { runId: 'r', seed: 'same', archetypeId: 'misty', prep: prep() });
    expect(misty.starterChoices.slice(0, 2)).toEqual(red.starterChoices.slice(0, 2));
    expect(misty.rng).toEqual(red.rng);
  });

  it('a signature species outside the pool or the Type Focus is never offered', () => {
    const misty = getArchetype(content, 'misty');
    const fire = { ...prep(), draftRuleId: 'type-focus', typeFocus: 'fire' as const };
    for (let i = 0; i < 50; i++) {
      const drawn = ['charmander', 'vulpix', 'growlithe'];
      expect(withSignatureStarter(content, new Rng(hashSeed(`f${i}`)), misty, fire, drawn)).toEqual(drawn);
    }
    const pool = new Set(eligibleSpecies(content, content.starterPools.get('classic')!));
    expect(['staryu', 'horsea'].some((id) => pool.has(firstStage(content, id)!.id))).toBe(false);
  });

  it('Oak earns 50% more Research Points; N’s Pokémon gain more friendship', () => {
    const payFor = (archetypeId: string) => {
      const run = createRun(content, { runId: 'r', seed: 'rp', archetypeId, prep: prep() });
      run.log.speciesSeen = ['pidgey', 'rattata', 'spearow', 'zubat'];
      run.log.speciesCaught = ['pidgey'];
      return applyRunToProfile(content, createProfile(content, 'p'), run, '2026-10-30').researchPoints;
    };
    expect(payFor('oak')).toBe(Math.round(payFor('red') * 1.5));
  });

  it('Cynthia sees the gym leader’s whole team and Oak the wild Pokémon, without any item', () => {
    for (const id of ['cynthia', 'oak']) {
      const started = chooseStarter(content, createRun(content, { runId: 'r', seed: 'pv', archetypeId: id, prep: prep() }), 0);
      const previews = Object.values(mapPreviews(content, started));
      expect(previews.length, id).toBeGreaterThan(0);
      expect(previews.every((p) => p.itemId === null && p.source === getArchetype(content, id).name)).toBe(true);
      const red = chooseStarter(content, createRun(content, { runId: 'r', seed: 'pv', archetypeId: 'red', prep: prep() }), 0);
      expect(Object.keys(mapPreviews(content, red))).toHaveLength(0);
    }
  });

  it('the Run Build Summary names the signature', () => {
    expect(buildSummary(content, 'misty', prep()).join('\n')).toMatch(/Signature: Water · Staryu/);
    expect(buildSummary(content, 'red', prep()).join('\n')).toMatch(/Signature: Pikachu/);
  });

  it('rejects an unknown signature species or pool', () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    raw.archetypes[0].signatureSpecies = ['missingno'];
    raw.archetypes[0].signaturePool = 'nowhere';
    expect(() => buildContent(raw)).toThrow(/missingno[\s\S]*nowhere/);
  });
});
