// Duplicate compensation (Untitled doc §8.3): an unlock the account already owns pays Research Points.

import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/core/profile';
import { RUN_RULES } from '../../src/core/rules';
import { grantUnlocks } from '../../src/core/unlocks';
import { content } from './helpers';

describe('grantUnlocks', () => {
  it('adds new unlocks for free and pays Research Points for each one already owned', () => {
    const profile = createProfile(content, 'p1');
    const pts = RUN_RULES.duplicateCompensation.researchPoints;
    const before = profile.researchPoints;
    expect(grantUnlocks(profile, { pool: 'spooky', trainer: 'hex-maniac', title: 'Ghost Hunter' })).toBe(0);
    expect(profile.researchPoints).toBe(before);
    expect(profile.unlockedPools).toContain('spooky');
    expect(profile.titles).toContain('Ghost Hunter');
    expect(grantUnlocks(profile, { pool: 'spooky', trainer: 'hex-maniac', title: 'Ghost Hunter' })).toBe(3);
    expect(profile.researchPoints).toBe(before + 3 * pts);
    expect(profile.unlockedPools.filter((p) => p === 'spooky')).toHaveLength(1);
  });
  it('a reward with nothing to unlock pays nothing', () => {
    const profile = createProfile(content, 'p1');
    const before = profile.researchPoints;
    expect(grantUnlocks(profile, {})).toBe(0);
    expect(profile.researchPoints).toBe(before);
  });
});
