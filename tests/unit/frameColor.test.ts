import { describe, expect, it } from 'vitest';
import { FRAME_COLORS, frameColorFor } from '../../src/core/presentation/frameColor';
import { REGION_IDENTITY_IDS, regionIdentity } from '../../src/core/presentation/regionIdentity';

describe('header bar colours', () => {
  it('maps swatch-like accents to their own colour', () => {
    expect(frameColorFor(0xd03030)).toBe('red');
    expect(frameColorFor(0x30b050)).toBe('green');
    expect(frameColorFor(0xf080b0)).toBe('pink');
  });
  it('gives every region a valid colour', () => {
    for (const id of REGION_IDENTITY_IDS) {
      expect(FRAME_COLORS).toContain(frameColorFor(regionIdentity(id).accent));
    }
  });
});
