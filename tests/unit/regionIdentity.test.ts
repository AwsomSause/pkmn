import { describe, expect, it } from 'vitest';
import { REGION_IDENTITY_IDS, regionIdentity } from '../../src/core/presentation/regionIdentity';
import { content } from './helpers';

describe('regional identity packs (catalog 62, look and sound)', () => {
  it('every region has its own sky, accent, motif and key', () => {
    const ids = [...content.regions.keys()];
    for (const id of ids) expect(REGION_IDENTITY_IDS, id).toContain(id);
    const looks = ids.map((id) => regionIdentity(id));
    expect(new Set(looks.map((l) => l.accent)).size).toBe(ids.length);
    expect(new Set(looks.map((l) => l.motif)).size).toBe(ids.length);
    expect(new Set(looks.map((l) => l.key)).size).toBe(ids.length);
  });
  it('an unknown region falls back to a fixed identity', () => {
    expect(regionIdentity('nowhere')).toEqual(regionIdentity('kanto'));
    expect(regionIdentity(undefined)).toEqual(regionIdentity('kanto'));
  });
});
