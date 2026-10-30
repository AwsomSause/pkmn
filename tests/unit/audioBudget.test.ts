import { describe, expect, it } from 'vitest';
import { sfxAllowed, SFX_MAX_IN_WINDOW } from '../../src/core/audioBudget';

describe('audio de-duplication (catalog #132)', () => {
  it('skips an immediate repeat but allows it a moment later', () => {
    expect(sfxAllowed([{ id: 'hit', at: 100 }], 'hit', 120)).toBe(false);
    expect(sfxAllowed([{ id: 'hit', at: 100 }], 'hit', 160)).toBe(true);
    expect(sfxAllowed([{ id: 'hit', at: 100 }], 'miss', 110)).toBe(true);
  });
  it('caps how many sounds play at once and forgets old ones', () => {
    const many = Array.from({ length: SFX_MAX_IN_WINDOW }, (_, i) => ({ id: `s${i}`, at: 100 + i }));
    expect(sfxAllowed(many, 'new', 110)).toBe(false);
    expect(sfxAllowed(many, 'new', 400)).toBe(true);
  });
});
