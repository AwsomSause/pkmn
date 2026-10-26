// Reads the game data files and lists the assets they refer to.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogInputs, PokemonArt } from '../src/assets/catalog.ts';

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const readJson = (file: string): unknown => JSON.parse(readFileSync(join(dataDir, file), 'utf8'));

export function readCatalogInputs(): CatalogInputs {
  const species = [...(readJson('species.json') as { assets: PokemonArt }[]), ...(readJson('customSpecies.json') as { assets: PokemonArt }[])];
  const archetypes = readJson('archetypes.json') as { spriteAssetId: string }[];
  const rewards = readJson('rewards.json') as { iconAssetId: string }[];
  const items = readJson('items.json') as { iconAssetId: string }[];
  // Catalog items use the director's icon pack (same rule as catalogIconAssetId in src/data/index.ts).
  const catalogIcons = (readJson('itemCatalog.json') as { icon: string | null }[]).map((e) => `item.gen5/${e.icon ?? '0'}`);
  const trainers = readJson('trainers.json') as { spriteAssetId: string }[];
  const bosses = readJson('bosses.json') as { sprites: Record<string, string> }[];
  const themes = readJson('themes.json') as { arenas: Record<string, string> };
  return {
    pokemon: species.map((s) => s.assets),
    trainerAssetIds: [...archetypes, ...trainers].map((a) => a.spriteAssetId).concat(bosses.flatMap((b) => Object.values(b.sprites))),
    itemAssetIds: [...new Set([...rewards, ...items].map((r) => r.iconAssetId).concat(catalogIcons))],
    backgroundAssetIds: Object.values(themes.arenas),
  };
}
