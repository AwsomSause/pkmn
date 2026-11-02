// Transformation cinematics (Mega/Primal, Dynamax/Gigantamax, Tera, Z-Move):
// their pack art ships and is catalogued, the Primega crystal is cut whole,
// and the new form appears before each cinematic ends.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { animAssetIds, Z_TITLE_MOVES, zTitleAssetId } from '../../src/assets/catalog';
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

describe('Z-Moves from the Pokémon Memories pack', () => {
  const moveAnims = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'moveAnims.json'), 'utf8')) as {
    moves: Record<string, { source: string; pack?: string; shake: number; telegraph: string }>;
    anims: Record<string, { graphics: string[]; sounds: string[] }>;
  };
  const zMoves = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'zMoves.json'), 'utf8')) as { byType: Record<string, string> };

  it('every type Z-Move plays its own animation, whose sheet and sounds ship', () => {
    for (const id of Object.values(zMoves.byType)) {
      const look = moveAnims.moves[id]!;
      expect(look.pack, id).toBe(`ess-${id}`);
      expect(look.telegraph, id).toBe('strong');
      expect(existsSync(join(assets, 'battle-anims', `${look.pack}.json`)), id).toBe(true);
      const files = moveAnims.anims[look.pack!]!;
      expect(files.graphics.length, id).toBe(1);
      for (const g of files.graphics) expect(existsSync(join(assets, 'images', 'battle_anims', `${g}.png`)), g).toBe(true);
      for (const s of files.sounds) expect(existsSync(join(assets, 'audio', 'battle_anims', `${s}.m4a`)), s).toBe(true);
    }
  });

  it('each Z-Move title card is a real move, in the manifest, loaded on demand, and on disk', () => {
    const moves = new Set((JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'moves.json'), 'utf8')) as { id: string }[]).map((m) => m.id));
    expect(Z_TITLE_MOVES.length).toBe(35);
    for (const id of Object.values(zMoves.byType)) expect(Z_TITLE_MOVES as readonly string[], id).toContain(id);
    for (const id of Z_TITLE_MOVES) {
      expect(moves.has(id), id).toBe(true);
      const entry = byId.get(zTitleAssetId(id));
      expect(entry, id).toBeDefined();
      expect(entry!.lazy, id).toBe(true);
      expect(existsSync(join(assets, entry!.path)), entry!.path).toBe(true);
    }
  });
});
