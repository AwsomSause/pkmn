import { describe, expect, it } from 'vitest';
import { createStreams, hashSeed, Rng, withStream } from '../../src/core/rng';

describe('seeded RNG', () => {
  it('same seed gives the same sequence', () => {
    const a = new Rng(hashSeed('abc'));
    const b = new Rng(hashSeed('abc'));
    const seqA = Array.from({ length: 20 }, () => a.nextUint32());
    const seqB = Array.from({ length: 20 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds give different sequences', () => {
    const a = new Rng(hashSeed('abc'));
    const b = new Rng(hashSeed('abd'));
    expect(a.nextUint32()).not.toEqual(b.nextUint32());
  });

  it('int stays inside its bounds and covers them', () => {
    const r = new Rng(hashSeed('bounds'));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('state can be saved and restored mid-sequence', () => {
    const r = new Rng(hashSeed('resume'));
    r.nextUint32();
    const saved = JSON.parse(JSON.stringify(r.state));
    const expected = r.nextUint32();
    expect(new Rng(saved).nextUint32()).toBe(expected);
  });

  it('streams are independent: using one does not change another', () => {
    const s1 = createStreams('seed');
    const s2 = createStreams('seed');
    withStream(s1, 'reward', (r) => { for (let i = 0; i < 50; i++) r.float(); });
    const a = withStream(s1, 'encounter', (r) => r.nextUint32());
    const b = withStream(s2, 'encounter', (r) => r.nextUint32());
    expect(a).toBe(b);
  });

  it('chance clamps probabilities to 0..1', () => {
    const r = new Rng(hashSeed('chance'));
    for (let i = 0; i < 100; i++) {
      expect(r.chance(2)).toBe(true);
      expect(r.chance(-1)).toBe(false);
    }
  });
});
