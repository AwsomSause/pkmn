import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { WEATHER_ASSET_IDS } from '../../src/ui/battleFx/weather';

describe('battle weather art', () => {
  it('every weather particle is in the catalog (lazy) and on disk', () => {
    for (const id of WEATHER_ASSET_IDS) {
      const entry = FIXED_ASSETS.find((a) => a.id === id);
      expect(entry, id).toBeTruthy();
      expect(entry!.lazy).toBe(true);
      expect(existsSync(`public/assets/${entry!.path}`), entry!.path).toBe(true);
    }
  });
});

describe('asset manifest', () => {
  it('lists every fixed catalog asset (run `npm run assets:manifest` after adding art or music)', () => {
    const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as { assets: { id: string }[] };
    const listed = new Set(manifest.assets.map((a) => a.id));
    expect(FIXED_ASSETS.filter((a) => !listed.has(a.id)).map((a) => a.id)).toEqual([]);
  });
});
