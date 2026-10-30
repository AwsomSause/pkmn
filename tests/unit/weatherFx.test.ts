import { existsSync } from 'node:fs';
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
