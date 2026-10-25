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
  /**
   * Loaded when a screen first needs it instead of at start-up. Every Pokémon's
   * sprites, icon and cry are lazy: there are over a thousand of them.
   */
  lazy?: boolean;
}

/** A species' file names in the asset pack (species.json `assets`). */
export interface PokemonArt {
  /** "25" → images/pokemon/25.png (+ back/, shiny/, back/shiny/). Regional forms use PokeRogue's numbers (Alolan Rattata is 2019). */
  sprite: string;
  /** "<generation folder>/<name>" → images/pokemon/icons/7/2019.png. */
  icon: string;
  /** "25" → audio/cry/25.m4a. */
  cry: string;
}

/** What the catalog needs to know about the game data. */
export interface CatalogInputs {
  pokemon: PokemonArt[];
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

/** Asset IDs for one Pokémon's art. */
export const pokemonAssetIds = (art: PokemonArt) => ({
  front: `pokemon.front.${art.sprite}`,
  back: `pokemon.back.${art.sprite}`,
  shinyFront: `pokemon.shiny.front.${art.sprite}`,
  shinyBack: `pokemon.shiny.back.${art.sprite}`,
  icon: `pokemon.icon.${art.icon.slice(art.icon.indexOf('/') + 1)}`,
  cry: `cry.${art.cry}`,
});

export function pokemonEntries(art: PokemonArt): AssetEntry[] {
  const ids = pokemonAssetIds(art);
  const lazy = (e: AssetEntry): AssetEntry => ({ ...e, lazy: true });
  const entries: AssetEntry[] = [
    atlas(ids.front, 'pokemon', `images/pokemon/${art.sprite}`),
    atlas(ids.back, 'pokemon', `images/pokemon/back/${art.sprite}`),
    atlas(ids.shinyFront, 'pokemon', `images/pokemon/shiny/${art.sprite}`),
    atlas(ids.shinyBack, 'pokemon', `images/pokemon/back/shiny/${art.sprite}`),
    { id: ids.icon, kind: 'image', category: 'pokemon', path: `images/pokemon/icons/${art.icon}.png` },
    { id: ids.cry, kind: 'audio', category: 'sound', path: `audio/cry/${art.cry}.m4a` },
  ];
  return entries.map(lazy);
}

/** Every asset the current game data could ask for. */
export function buildCatalog(inputs: CatalogInputs): AssetEntry[] {
  const entries = [
    ...FIXED_ASSETS,
    ...inputs.pokemon.flatMap(pokemonEntries),
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
