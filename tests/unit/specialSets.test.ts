// The Delta Set and the Z-Form Set (Untitled doc §8): earned special-form starter sets.

import { describe, expect, it } from 'vitest';
import { claim } from '../../src/core/quests';
import { createProfile } from '../../src/core/profile';
import { eligibleSpecies, poolStatus } from '../../src/core/runPrep';
import { specialFamily } from '../../src/core/specialForms';
import { content } from './helpers';

describe.each([
  ['delta-set', 'delta', 'event:delta-research-week:reward'],
  ['z-set', 'zform', 'event:champions-gauntlet:reward'],
])('%s', (poolId, family, key) => {
  it('is locked until its event reward is claimed, then can be bought', () => {
    const profile = createProfile(content, 'p');
    const pool = content.starterPools.get(poolId)!;
    expect(poolStatus(content, profile, pool)).toBe('locked');
    claim(profile, key, '2026-10-30T00:00:00Z');
    expect(poolStatus(content, profile, pool)).toBe('buyable');
  });
  it('offers seven first-stage forms of the right family', () => {
    const ids = eligibleSpecies(content, content.starterPools.get(poolId)!);
    expect(ids).toHaveLength(7);
    for (const id of ids) {
      expect(specialFamily(content.species.get(id)!), id).toBe(family);
      expect(content.species.get(id)!.evolutionStage).toBe(1);
    }
  });
});
