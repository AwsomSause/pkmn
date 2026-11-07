import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { footprintCell } from '../../src/core/presentation/footprints';
import { buildContent } from '../../src/data';

describe('footprints', () => {
  it('the sheet ships and is in the catalog', () => {
    expect(existsSync('public/assets/images/ui/footprints.png')).toBe(true);
    expect(FIXED_ASSETS.some((a) => a.id === 'ui.footprints')).toBe(true);
  });
  it('base species have a print, forms fall back to their base, unknown ids have none', () => {
    expect(footprintCell('pikachu')).not.toBeNull();
    expect(footprintCell('nidoran-f')).not.toBeNull();
    expect(footprintCell('charizard-mega-x')).toBe(footprintCell('charizard'));
    expect(footprintCell('raichu-alola')).toBe(footprintCell('raichu'));
    expect(footprintCell('not-a-species')).toBeNull();
  });
  it('covers nearly every species in the game', () => {
    const { species } = buildContent();
    const all = [...species.values()];
    const missing = all.filter((s) => footprintCell(s.id) === null);
    expect(missing.length / all.length).toBeLessThan(0.1);
  });
});
