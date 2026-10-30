import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { pickWipe, WIPE_ASSET_IDS, WIPE_MASKS } from '../../src/ui/battleFx/ruleWipe';

describe('rule-mask wipes', () => {
  it('every mask is in the catalog and on disk', () => {
    for (const id of WIPE_ASSET_IDS) {
      const entry = FIXED_ASSETS.find((a) => a.id === id);
      expect(entry, id).toBeTruthy();
      expect(existsSync(`public/assets/${entry!.path}`), entry!.path).toBe(true);
    }
  });

  it('the pick is stable per battle, varies across battles, and sometimes keeps the glass shutters', () => {
    expect(pickWipe('seed:uid-1')).toBe(pickWipe('seed:uid-1'));
    const picks = Array.from({ length: 200 }, (_, i) => pickWipe(`s:${i}`));
    expect(new Set(picks).size).toBeGreaterThan(6);
    expect(picks).toContain(null);
    for (const p of picks) if (p) expect(WIPE_MASKS).toContain(p);
  });
});
