// The single place where asset file names and folders are defined.
//
// Every asset has a logical ID (e.g. "pokemon.front.1") that game data and
// screens refer to. This catalog maps IDs to file paths under public/assets/.
// Nothing here guarantees a file exists: tools/build-asset-manifest.ts checks
// which files are really present and writes public/assets/manifest.json, and
// the game uses placeholders for anything missing.
//
// This file must stay free of runtime imports so the Node tools can use it.

export type AssetKind = 'image' | 'atlas' | 'audio' | 'font';
export type AssetCategory = 'pokemon' | 'trainer' | 'item' | 'background' | 'music' | 'sound' | 'font';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  category: AssetCategory;
  /** Path relative to public/assets/ (for atlases, the image). */
  path: string;
  /** Atlas JSON path (TexturePacker multi-atlas format, as in the supplied packs). */
  atlasPath?: string;
}

/** What the catalog needs to know about the game data. */
export interface CatalogInputs {
  speciesDex: number[];
  trainerAssetIds: string[];
  itemAssetIds: string[];
}

const atlas = (id: string, category: AssetCategory, base: string): AssetEntry => ({
  id,
  kind: 'atlas',
  category,
  path: `${base}.png`,
  atlasPath: `${base}.json`,
});

/** Fixed UI/audio assets used by Milestone 1 screens. */
export const FIXED_ASSETS: AssetEntry[] = [
  { id: 'bg.battle', kind: 'image', category: 'background', path: 'images/arenas/grass_bg.png' },
  { id: 'bgm.menu', kind: 'audio', category: 'music', path: 'audio/bgm/menu.mp3' },
  { id: 'bgm.battle', kind: 'audio', category: 'music', path: 'audio/bgm/battle_wild.mp3' },
  { id: 'se.hit', kind: 'audio', category: 'sound', path: 'audio/se/hit.wav' },
  { id: 'se.hit_strong', kind: 'audio', category: 'sound', path: 'audio/se/hit_strong.wav' },
  { id: 'se.hit_weak', kind: 'audio', category: 'sound', path: 'audio/se/hit_weak.wav' },
  { id: 'se.faint', kind: 'audio', category: 'sound', path: 'audio/se/faint.wav' },
  { id: 'se.level_up', kind: 'audio', category: 'sound', path: 'audio/se/level_up.wav' },
  { id: 'se.exp', kind: 'audio', category: 'sound', path: 'audio/se/exp.wav' },
  { id: 'ui.select', kind: 'audio', category: 'sound', path: 'audio/ui/select.wav' },
  { id: 'ui.error', kind: 'audio', category: 'sound', path: 'audio/ui/error.wav' },
  { id: 'font.main', kind: 'font', category: 'font', path: 'fonts/pokemon-emerald-pro.ttf' },
];

export function trainerEntry(assetId: string): AssetEntry {
  // "trainer.red" -> images/trainer/red
  return atlas(assetId, 'trainer', `images/trainer/${assetId.replace(/^trainer\./, '')}`);
}

export function itemEntry(assetId: string): AssetEntry {
  // "item.super_potion" -> images/items/super_potion.png
  return { id: assetId, kind: 'image', category: 'item', path: `images/items/${assetId.replace(/^item\./, '')}.png` };
}

export function pokemonEntries(dex: number): AssetEntry[] {
  return [
    atlas(`pokemon.front.${dex}`, 'pokemon', `images/pokemon/${dex}`),
    atlas(`pokemon.back.${dex}`, 'pokemon', `images/pokemon/back/${dex}`),
    { id: `cry.${dex}`, kind: 'audio', category: 'sound', path: `audio/cry/${dex}.m4a` },
  ];
}

/** Every asset the current game data could ask for. */
export function buildCatalog(inputs: CatalogInputs): AssetEntry[] {
  const entries = [
    ...FIXED_ASSETS,
    ...inputs.speciesDex.flatMap(pokemonEntries),
    ...inputs.trainerAssetIds.map(trainerEntry),
    ...inputs.itemAssetIds.map(itemEntry),
  ];
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** Files each entry needs (an atlas needs both its image and its JSON). */
export function filesOf(entry: AssetEntry): string[] {
  return entry.atlasPath ? [entry.path, entry.atlasPath] : [entry.path];
}

export interface AssetManifest {
  generatedAt: string;
  /** Entries whose files all exist. */
  assets: AssetEntry[];
  /** Catalog IDs whose files were not found (placeholders are used). */
  missing: { id: string; files: string[] }[];
}
