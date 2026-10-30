import { describe, expect, it } from 'vitest';
import { teamSize } from '../../src/core/encounters';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

describe('early trainer bands', () => {
  const cfg = content.balance.trainerTeam;
  it('stage 1 trainers have exactly 1 Pokémon and the next stages stay within 2–4', () => {
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(hashSeed(`band-${i}`));
      expect(teamSize(cfg, 0, rng)).toBe(1);
      for (let stage = 1; stage <= 5; stage++) {
        const n = teamSize(cfg, stage, rng);
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(4);
      }
    }
  });
  it('later stages are limited only by maxSize', () => {
    expect(teamSize(cfg, 20, new Rng(hashSeed('late')))).toBe(cfg.maxSize);
  });
});
