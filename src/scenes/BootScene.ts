// Loads the asset manifest, then every asset it lists except the lazy ones
// (Pokémon sprites, icons and cries, loaded by each screen as needed; see
// ui/lazyAssets.ts), with a progress bar. Assets that are missing or fail to
// load are recorded and replaced by placeholders.

import Phaser from 'phaser';
import { buildCatalog, type AssetManifest } from '../assets/catalog';
import { bossSpriteIds } from '../core/regions';
import { AssetRegistry, setServices } from '../game/services';
import type { GameSession } from '../game/GameSession';
import { queueAsset } from '../ui/lazyAssets';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('loaderror', () => console.warn('Asset manifest not found; using placeholders for every asset.'));
  }

  async create(): Promise<void> {
    const session = this.registry.get('session') as GameSession;
    const content = session.content;
    const manifest = (this.cache.json.get('manifest') as AssetManifest | undefined) ?? null;
    const catalog = buildCatalog({
      pokemon: [...content.species.values()].map((s) => s.assets),
      trainerAssetIds: [...content.archetypes.values(), ...content.trainers.values()].map((a) => a.spriteAssetId).concat(bossSpriteIds(content)),
      itemAssetIds: [...content.rewards.values(), ...content.items.values()].map((r) => r.iconAssetId),
      backgroundAssetIds: Object.values(content.arenas).filter((id): id is string => Boolean(id)),
    });
    const assets = new AssetRegistry(manifest, catalog);
    setServices({ session, assets });
    if (assets.missing.length > 0) {
      console.warn(`Missing assets (placeholders used): ${assets.missing.map((m) => m.id).join(', ')}`);
    }

    await this.loadFont(assets);
    this.loadAssets(assets);
  }

  private async loadFont(assets: AssetRegistry): Promise<void> {
    const entry = assets.entries().find((e) => e.id === 'font.main');
    if (!entry || typeof FontFace === 'undefined') return;
    try {
      const face = new FontFace('PokemonMain', `url(assets/${entry.path})`);
      await face.load();
      document.fonts.add(face);
    } catch {
      assets.markFailed('font.main');
    }
  }

  private loadAssets(assets: AssetRegistry): void {
    const bar = this.add.rectangle(GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2, 0, 16, COLORS.hpGreen).setOrigin(0, 0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 404, 20).setStrokeStyle(2, 0xffffff);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Loading…', textStyle(28, COLORS.textLight)).setOrigin(0.5);

    for (const entry of assets.entries()) {
      if (entry.lazy) continue;
      if (entry.kind === 'font') continue; // handled by loadFont
      queueAsset(this, entry);
    }
    this.load.on('progress', (p: number) => (bar.width = 400 * p));
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`Failed to load asset ${file.key} (${String(file.url)})`);
      assets.markFailed(file.key);
    });
    this.load.once('complete', () => this.scene.start('MainMenu'));
    this.load.start();
  }
}
