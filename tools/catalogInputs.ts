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
  return {
    speciesDex: species.map((s) => s.dex),
    trainerAssetIds: archetypes.map((a) => a.spriteAssetId),
    itemAssetIds: rewards.map((r) => r.iconAssetId),
  };
}
