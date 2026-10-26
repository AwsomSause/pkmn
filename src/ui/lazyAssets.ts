// Loading assets on demand. There are over a thousand Pokémon, each with six
// files (sprites, shiny sprites, icon, cry), so they are not loaded at start-up.
// A screen queues the Pokémon it is about to show in its preload() (Phaser
// waits for them before create()); anything else is loaded the first time it
// is drawn, showing a placeholder until it arrives.

import Phaser from 'phaser';
import { pokemonAssetIds, type AssetEntry } from '../assets/catalog';
import type { Species } from '../core/contentSchema';
import { services } from '../game/services';

/** Whether an asset is already in Phaser's caches. */
export function isLoaded(scene: Phaser.Scene, entry: AssetEntry): boolean {
  if (entry.kind === 'audio') return scene.cache.audio.exists(entry.id);
  if (entry.kind === 'json') return scene.cache.json.exists(entry.id);
  return scene.textures.exists(entry.id);
}

/** Adds one asset to the scene's loader (does not start it). */
export function queueAsset(scene: Phaser.Scene, entry: AssetEntry): void {
  switch (entry.kind) {
    case 'atlas': {
      const dir = entry.atlasPath!.slice(0, entry.atlasPath!.lastIndexOf('/') + 1);
      scene.load.multiatlas(entry.id, `assets/${entry.atlasPath}`, `assets/${dir}`);
      break;
    }
    case 'image':
      scene.load.image(entry.id, `assets/${entry.path}`);
      break;
    case 'audio':
      scene.load.audio(entry.id, `assets/${entry.path}`);
      break;
    case 'spritesheet':
      scene.load.spritesheet(entry.id, `assets/${entry.path}`, { frameWidth: entry.frameSize ?? 96, frameHeight: entry.frameSize ?? 96 });
      break;
    case 'json':
      scene.load.json(entry.id, `assets/${entry.path}`);
      break;
    case 'font':
      break;
  }
}

/** Ids each scene's loader has been given and not finished yet (so nothing is queued twice). */
const queuedBy = new WeakMap<Phaser.Loader.LoaderPlugin, Set<string>>();

function queuedSet(scene: Phaser.Scene): Set<string> {
  let set = queuedBy.get(scene.load);
  if (!set) {
    const ids = new Set<string>();
    set = ids;
    queuedBy.set(scene.load, ids);
    const { assets } = services();
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`Failed to load asset ${file.key} (${String(file.url)})`);
      assets.markFailed(file.key);
    });
    // The loader forgets its queue when it finishes or the scene stops.
    scene.load.on(Phaser.Loader.Events.COMPLETE, () => ids.clear());
    scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => ids.clear());
  }
  return set;
}

/** Queues the assets (by id) that exist but aren't loaded yet. Returns how many were queued. */
export function queueAssets(scene: Phaser.Scene, ids: readonly string[]): number {
  const { assets } = services();
  const queued = queuedSet(scene);
  let count = 0;
  for (const id of new Set(ids)) {
    const entry = assets.get(id);
    if (!entry || !assets.has(id) || isLoaded(scene, entry) || queued.has(id)) continue;
    queueAsset(scene, entry);
    queued.add(id);
    count++;
  }
  return count;
}

/** Loads assets now (outside preload) and resolves when they are ready or have failed. */
export function loadAssets(scene: Phaser.Scene, ids: readonly string[]): Promise<void> {
  if (queueAssets(scene, ids) === 0 && !scene.load.isLoading()) return Promise.resolve();
  return new Promise((resolve) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    if (!scene.load.isLoading()) scene.load.start();
  });
}

export interface ArtParts {
  front?: boolean;
  back?: boolean;
  shiny?: boolean;
  icon?: boolean;
  cry?: boolean;
}

/** The asset ids for the chosen parts of each species' art. */
export function pokemonArtIds(species: readonly Species[], parts: ArtParts): string[] {
  return species.flatMap((s) => {
    const ids = pokemonAssetIds(s.assets);
    const out: string[] = [];
    if (parts.front) out.push(ids.front, ...(parts.shiny ? [ids.shinyFront] : []));
    if (parts.back) out.push(ids.back, ...(parts.shiny ? [ids.shinyBack] : []));
    if (parts.icon) out.push(ids.icon);
    if (parts.cry) out.push(ids.cry);
    return out;
  });
}

/** For a scene's preload(): queue these Pokémon's art so it is ready before the screen is drawn. */
export function preloadPokemon(scene: Phaser.Scene, species: readonly Species[], parts: ArtParts): void {
  queueAssets(scene, pokemonArtIds(species, parts));
}

/** Species of the current run's party (for preloading their icons and sprites). */
export function partySpecies(): Species[] {
  const { session } = services();
  return (session.run?.party ?? []).flatMap((m) => session.content.species.get(m.speciesId) ?? []);
}
