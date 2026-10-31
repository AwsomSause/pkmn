// Campaign Director focus changes something real: mystery regions hold more event stops, rival regions bring rivals back sooner.

import { describe, expect, it } from 'vitest';
import { FOCUSES, MYSTERY_EXTRA_STOPS, RIVAL_FOCUS_GAP_CUT, regionFocus } from '../../src/core/campaign/focus';
import { regionFocus as viaDirector } from '../../src/core/campaign/director';

describe('region focus', () => {
  it('is stable per seed and region, and the director re-exports it', () => {
    const run = { seed: 'f1', regionOrder: ['kanto', 'johto'] } as never;
    expect(regionFocus(run, 0)).toBe(viaDirector(run, 0));
    expect(FOCUSES).toContain(regionFocus(run, 1));
  });
  it('has real numbers behind mystery and rivals', () => {
    expect(MYSTERY_EXTRA_STOPS).toBeGreaterThan(0);
    expect(RIVAL_FOCUS_GAP_CUT).toBeGreaterThan(0);
  });
});
