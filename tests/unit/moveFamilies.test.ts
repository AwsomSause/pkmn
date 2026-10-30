// Visual Bible §4.4: every move belongs to one of 26 animation families, and
// the battle tries the pack animation, then PokeRogue's, then the family effect.

import { describe, expect, it } from 'vitest';
import { FAMILY_IDS, FAMILY_RECIPES, familyOf, moveFamily } from '../../src/core/presentation/families';
import { presentationFor } from '../../src/core/presentation/moveAnims';
import { moveAnims } from '../../src/data/presentation';
import { content } from './helpers';

const data = moveAnims();
const fam = (id: string) => moveFamily(content.moves.get(id)!, presentationFor(data, id));

describe('animation families', () => {
  it('has a recipe for each of the 26 families', () => {
    expect(FAMILY_IDS).toHaveLength(26);
    for (const f of FAMILY_IDS) expect(FAMILY_RECIPES[f].ms).toBeGreaterThan(0);
  });

  it('sorts moves by what they look like', () => {
    expect(fam('tackle')).toBe('contact');
    expect(fam('thunderbolt')).toBe('electric');
    expect(fam('flamethrower')).toBe('flame');
    expect(fam('earthquake')).toBe('rock-ground');
    expect(fam('bite')).toBe('bite-slash');
    expect(fam('protect')).toBe('barrier');
    expect(fam('rain-dance')).toBe('field');
    expect(fam('giga-drain')).toBe('drain');
    expect(fam('recover')).toBe('healing');
    expect(fam('double-kick')).toBe('multi-hit');
    expect(fam('solar-beam')).toBe('two-turn');
    expect(fam('explosion')).toBe('burst');
  });

  it('gives Z-Moves and Max Moves the signature treatment', () => {
    expect(fam('acid-downpour')).toBe('signature');
    expect(fam('g-max-befuddle')).toBe('signature');
    expect(familyOf({ type: 'fire', category: 'special', power: 100, flags: ['zmove'], target: 'enemy', effects: {} })).toBe('signature');
  });

  it('every move has a family, and all 26 are used', () => {
    const used = new Set([...content.moves.keys()].map(fam));
    for (const f of used) expect(FAMILY_IDS).toContain(f);
    expect(used.size).toBe(26);
  });

  it('a boundary: contact moves turn heavy at 90 power', () => {
    const base = { type: 'normal', category: 'physical', target: 'enemy', effects: {}, flags: ['contact'] } as const;
    expect(familyOf({ ...base, flags: [...base.flags], power: 89 })).toBe('contact');
    expect(familyOf({ ...base, flags: [...base.flags], power: 90 })).toBe('heavy-contact');
  });
});
