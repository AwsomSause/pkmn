// Transformation cinematics (Mega/Primal, Dynamax/Gigantamax, Tera, Z-Move):
// their pack art ships and is catalogued, the Primega crystal is cut whole,
// and the new form appears before each cinematic ends.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { animAssetIds } from '../../src/assets/catalog';
import { CINE_ASSETS, CINE_MS, CINE_SOUNDS, SWAP_AT } from '../../src/ui/battleFx/cineLook';
import shards from '../../src/ui/battleFx/primegaShards.json';

const assets = join(import.meta.dirname, '..', '..', 'public', 'assets');
const manifest = JSON.parse(readFileSync(join(assets, 'manifest.json'), 'utf8')) as { assets: { id: string; path: string; atlasPath?: string; lazy?: boolean }[] };
const byId = new Map(manifest.assets.map((a) => [a.id, a]));

describe('transformation cinematics', () => {
  it('every picture and sound is in the manifest, loaded on demand, and on disk', () => {
    for (const id of [...CINE_ASSETS, ...CINE_SOUNDS.map(animAssetIds.sound)]) {
      const entry = byId.get(id);
      expect(entry, id).toBeDefined();
      expect(entry!.lazy, id).toBe(true);
      expect(existsSync(join(assets, entry!.path)), entry!.path).toBe(true);
    }
  });

  it('cuts each crystal (Mega, Alpha, Omega) into the same shards, each with its crack layer', () => {
    expect(shards.centres.length).toBeGreaterThanOrEqual(20);
    const [w, h] = shards.size as [number, number];
    for (const [dx, dy] of shards.centres) expect(Math.hypot(dx!, dy!)).toBeLessThan(Math.min(w, h) / 2);
    for (const name of ['mega', 'alpha', 'omega']) {
      const atlas = JSON.parse(readFileSync(join(assets, 'images', 'packs', 'ebdx', 'primega', `${name}.json`), 'utf8')) as { frames: Record<string, unknown> };
      for (let i = 1; i <= shards.centres.length; i++) {
        const n = String(i).padStart(2, '0');
        expect(atlas.frames[`p${n}`], `${name} p${n}`).toBeDefined();
        expect(atlas.frames[`c${n}`], `${name} c${n}`).toBeDefined();
      }
    }
  });

  it('the new form appears within each cinematic (so a skip never loses it)', () => {
    for (const kind of Object.keys(CINE_MS) as (keyof typeof CINE_MS)[]) {
      expect(SWAP_AT[kind], kind).toBeGreaterThan(0);
      expect(SWAP_AT[kind], kind).toBeLessThanOrEqual(CINE_MS[kind]);
    }
  });
});
