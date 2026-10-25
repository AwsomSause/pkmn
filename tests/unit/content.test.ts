import { describe, expect, it } from 'vitest';
import { buildContent, ContentError, RAW_CONTENT } from '../../src/data';
import { content } from './helpers';

describe('game data', () => {
  it('all data files pass validation', () => {
    expect(content.species.size).toBeGreaterThanOrEqual(20);
    expect(content.moves.size).toBeGreaterThanOrEqual(25);
  });

  it('reports a learnset that names a missing move', () => {
    const species = structuredClone(RAW_CONTENT.species) as { learnset: { level: number; move: string }[] }[];
    species[0]!.learnset.push({ level: 5, move: 'not-a-move' });
    expect(() => buildContent({ ...RAW_CONTENT, species })).toThrow(ContentError);
  });

  it('reports an evolved species in the starter pool', () => {
    const species = structuredClone(RAW_CONTENT.species) as { id: string; evolutionStage: number }[];
    species.find((s) => s.id === 'bulbasaur')!.evolutionStage = 2;
    expect(() => buildContent({ ...RAW_CONTENT, species })).toThrow(/not a first-stage/);
  });

  it('every species knows at least one move at level 1', () => {
    for (const s of content.species.values()) {
      expect(s.learnset.some((e) => e.level === 1)).toBe(true);
    }
  });

  it('type chart covers known matchups', () => {
    expect(content.typeChart.water?.fire).toBe(2);
    expect(content.typeChart.normal?.ghost).toBe(0);
    expect(content.typeChart.electric?.ground).toBe(0);
  });
});

describe('architecture', () => {
  it('core rules never import Phaser', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    for (const file of walk('src/core')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]phaser['"]/);
    }
  });
});
