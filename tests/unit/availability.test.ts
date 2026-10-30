import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { content } from './helpers';

const Row = z.object({
  rarity: z.enum(['common', 'uncommon', 'rare', 'veryRare', 'legendary', 'mythical']),
  difficulty: z.number().int().min(1).max(10),
  minLevel: z.number().int().min(1).max(100),
  maxLevel: z.number().int().min(1).max(100),
  captureRate: z.number().int().min(0).max(255),
});
const File = z.object({ status: z.literal('suggested'), source: z.string(), species: z.record(z.string(), Row) });

describe('availability.json', () => {
  const file = File.parse(JSON.parse(readFileSync(new URL('../../src/data/availability.json', import.meta.url), 'utf8')));
  it('only names real species and has sane levels', () => {
    const ids = Object.keys(file.species);
    expect(ids.length).toBeGreaterThan(1000);
    for (const id of ids) {
      expect(content.species.has(id), id).toBe(true);
      expect(file.species[id]!.minLevel, id).toBeLessThanOrEqual(file.species[id]!.maxLevel);
    }
  });
});
