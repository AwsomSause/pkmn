// Reads the game data files and lists the assets they refer to.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogInputs, PokemonArt } from '../src/assets/catalog.ts';

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const readJson = (file: string): unknown => JSON.parse(readFileSync(join(dataDir, file), 'utf8'));

export function readCatalogInputs(): CatalogInputs {
  const species = readJson('species.json') as { assets: PokemonArt }[];
  const archetypes = readJson('archetypes.json') as { spriteAssetId: string }[];
  const rewards = readJson('rewards.json') as { iconAssetId: string }[];
  const items = readJson('items.json') as { iconAssetId: string }[];
  const trainers = readJson('trainers.json') as { spriteAssetId: string }[];
  const gymLeaders = readJson('gymLeaders.json') as { spriteAssetId: string }[];
  const league = readJson('league.json') as Record<'eliteFour' | 'champions', { spriteAssetId: string }[]>;
  const themes = readJson('themes.json') as { arenas: Record<string, string> };
  return {
    pokemon: species.map((s) => s.assets),
    trainerAssetIds: [...archetypes, ...trainers, ...gymLeaders, ...league.eliteFour, ...league.champions].map((a) => a.spriteAssetId),
    itemAssetIds: [...rewards, ...items].map((r) => r.iconAssetId),
    backgroundAssetIds: Object.values(themes.arenas),
  };
}
