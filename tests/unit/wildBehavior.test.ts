import { describe, expect, it } from 'vitest';
import { CATCH_MULTIPLIER, WILD_BEHAVIORS, wildCatchMultiplier } from '../../src/core/wildBehavior';

describe('wild behaviour catch effect', () => {
  it('has a positive multiplier for every behaviour', () => {
    for (const b of WILD_BEHAVIORS) expect(CATCH_MULTIPLIER[b.id]).toBeGreaterThan(0);
  });
  it('is 1 outside wild battles', () => {
    expect(wildCatchMultiplier({} as never, { seed: 's', encountersCompleted: 0, battle: null } as never)).toBe(1);
  });
});
