// Reads the game data files and lists the assets they refer to.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogInputs } from '../src/assets/catalog.ts';

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const readJson = (file: string): unknown => JSON.parse(readFileSync(join(dataDir, file), 'utf8'));

export function readCatalogInputs(): CatalogInputs {
  const species = readJson('species.json') as { dex: number }[];
  const archetypes = readJson('archetypes.json') as { spriteAssetId: string }[];
  const rewards = readJson('rewards.json') as { iconAssetId: string }[];
  const items = readJson('items.json') as { iconAssetId: string }[];
  const trainers = readJson('trainers.json') as { spriteAssetId: string }[];
  const bosses = readJson('bosses.json') as { sprites: Record<string, string> }[];
  const themes = readJson('themes.json') as { arenas: Record<string, string> };
  return {
    speciesDex: species.map((s) => s.dex),
    trainerAssetIds: [...archetypes, ...trainers].map((a) => a.spriteAssetId).concat(bosses.flatMap((b) => Object.values(b.sprites))),
    itemAssetIds: [...rewards, ...items].map((r) => r.iconAssetId),
    backgroundAssetIds: Object.values(themes.arenas),
  };
}
