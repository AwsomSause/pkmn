import { describe, expect, it } from 'vitest';
import { ambienceFor } from '../../src/ui/battleFx/ambience';
import { CATEGORY_ROWS, STATUS_ROWS, TYPE_ROWS } from '../../src/ui/aero';
import typeChart from '../../src/data/typeChart.json';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { existsSync } from 'node:fs';

// M10 visual slice 1: the pack art the battle screen uses, and arena ambience.
describe('visual slice 1 (Aero battle)', () => {
  it('maps every arena to an ambience', () => {
    expect(ambienceFor('bg.arena.sea')).toBe('water');
    expect(ambienceFor('bg.arena.ice_cave')).toBe('snow');
    expect(ambienceFor('bg.arena.volcano')).toBe('ember');
    expect(ambienceFor('bg.arena.graveyard')).toBe('dark');
    expect(ambienceFor('bg.arena.fairy')).toBe('sparkle');
    expect(ambienceFor('bg.arena.plains')).toBe('open');
    expect(ambienceFor('bg.battle')).toBe('open');
  });

  it('has a type-label row for all 18 types and rows for every category and status', () => {
    const types = Object.keys((typeChart as { chart?: Record<string, unknown> }).chart ?? typeChart);
    for (const t of types.filter((t) => t !== 'stellar')) expect(TYPE_ROWS[t], t).toBeTypeOf('number');
    expect(new Set(Object.values(TYPE_ROWS)).size).toBe(Object.keys(TYPE_ROWS).length);
    expect(Object.keys(CATEGORY_ROWS).sort()).toEqual(['physical', 'special', 'status']);
    expect(Object.keys(STATUS_ROWS).sort()).toEqual(['brn', 'frz', 'par', 'psn', 'slp']);
  });

  it('ships every pack file it catalogs', () => {
    const pack = FIXED_ASSETS.filter((a) => a.id.startsWith('pack.'));
    expect(pack.length).toBe(16);
    for (const a of pack) expect(existsSync(`public/assets/${a.path}`), a.path).toBe(true);
  });
});
