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
  /** Battle backgrounds ("bg.arena.<name>"), e.g. the arena for each stage theme's type. */
  backgroundAssetIds: string[];
}

const atlas = (id: string, category: AssetCategory, base: string): AssetEntry => ({
  id,
  kind: 'atlas',
  category,
  path: `${base}.png`,
  atlasPath: `${base}.json`,
});

/** Fixed UI/audio assets used by the screens. */
export const FIXED_ASSETS: AssetEntry[] = [
  { id: 'bg.battle', kind: 'image', category: 'background', path: 'images/arenas/grass_bg.png' },
  { id: 'bgm.menu', kind: 'audio', category: 'music', path: 'audio/bgm/menu.mp3' },
  { id: 'bgm.battle', kind: 'audio', category: 'music', path: 'audio/bgm/battle_wild.mp3' },
  { id: 'bgm.battle_trainer', kind: 'audio', category: 'music', path: 'audio/bgm/battle_trainer.mp3' },
  { id: 'se.ball_throw', kind: 'audio', category: 'sound', path: 'audio/se/pb_throw.wav' },
  { id: 'se.ball_shake', kind: 'audio', category: 'sound', path: 'audio/se/pb_move.wav' },
  { id: 'se.ball_catch', kind: 'audio', category: 'sound', path: 'audio/se/pb_catch.wav' },
  { id: 'se.ball_release', kind: 'audio', category: 'sound', path: 'audio/se/pb_rel.wav' },
  { id: 'se.shiny', kind: 'audio', category: 'sound', path: 'audio/se/sparkle.wav' },
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
  // "boss.cynthia-gen7" -> images/bosses/cynthia-gen7.png (a single picture from the director's boss pack)
  if (assetId.startsWith('boss.')) {
    return { id: assetId, kind: 'image', category: 'trainer', path: `images/bosses/${assetId.slice('boss.'.length)}.png` };
  }
  // "trainer.red" -> images/trainer/red
  return atlas(assetId, 'trainer', `images/trainer/${assetId.replace(/^trainer\./, '')}`);
}

export function itemEntry(assetId: string): AssetEntry {
  // "ball.pb" -> images/pokeball/pb.png (the Poké Ball pack)
  if (assetId.startsWith('ball.')) {
    return { id: assetId, kind: 'image', category: 'item', path: `images/pokeball/${assetId.slice('ball.'.length)}.png` };
  }
  // "item.super_potion" -> images/items/super_potion.png
  return { id: assetId, kind: 'image', category: 'item', path: `images/items/${assetId.replace(/^item\./, '')}.png` };
}

export function backgroundEntry(assetId: string): AssetEntry {
  // "bg.arena.volcano" -> images/arenas/volcano_bg.png
  return { id: assetId, kind: 'image', category: 'background', path: `images/arenas/${assetId.replace(/^bg\.arena\./, '')}_bg.png` };
}

/** Last National Dex number of each generation (the icon pack is split into folders by generation). */
const GENERATION_ENDS = [151, 251, 386, 493, 649, 721, 809, 905, 1025];

export function generationOf(dex: number): number {
  const index = GENERATION_ENDS.findIndex((end) => dex <= end);
  return index === -1 ? GENERATION_ENDS.length : index + 1;
}

/** Asset IDs for one Pokémon's art, derived from its National Dex number. */
export const pokemonAssetIds = (dex: number) => ({
  front: `pokemon.front.${dex}`,
  back: `pokemon.back.${dex}`,
  shinyFront: `pokemon.shiny.front.${dex}`,
  shinyBack: `pokemon.shiny.back.${dex}`,
  icon: `pokemon.icon.${dex}`,
  cry: `cry.${dex}`,
});

export function pokemonEntries(dex: number): AssetEntry[] {
  const ids = pokemonAssetIds(dex);
  return [
    atlas(ids.front, 'pokemon', `images/pokemon/${dex}`),
    atlas(ids.back, 'pokemon', `images/pokemon/back/${dex}`),
    atlas(ids.shinyFront, 'pokemon', `images/pokemon/shiny/${dex}`),
    atlas(ids.shinyBack, 'pokemon', `images/pokemon/back/shiny/${dex}`),
    { id: ids.icon, kind: 'image', category: 'pokemon', path: `images/pokemon/icons/${generationOf(dex)}/${dex}.png` },
    { id: ids.cry, kind: 'audio', category: 'sound', path: `audio/cry/${dex}.m4a` },
  ];
}

/** Every asset the current game data could ask for. */
export function buildCatalog(inputs: CatalogInputs): AssetEntry[] {
  const entries = [
    ...FIXED_ASSETS,
    ...inputs.speciesDex.flatMap(pokemonEntries),
    ...inputs.trainerAssetIds.map(trainerEntry),
    ...inputs.itemAssetIds.map(itemEntry),
    ...inputs.backgroundAssetIds.map(backgroundEntry),
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
