// Loads the asset manifest, then every asset it lists except the lazy ones
// (Pokémon sprites, icons and cries, loaded by each screen as needed; see
// ui/lazyAssets.ts), with a progress bar. Assets that are missing or fail to
// load are recorded and replaced by placeholders.

import { OVERWORLD } from '../core/hubTown/schema';
import { PreloadTracker } from '../core/tools/preload';
import Phaser from 'phaser';
import { buildCatalog, type AssetManifest } from '../assets/catalog';
import { bossSpriteIds } from '../core/regions';
import { animCatalogInputs } from '../core/presentation/moveAnims';
import { scriptAssets } from '../core/presentation/scriptAnim';
import { ebdxAnims, moveAnims } from '../data/presentation';
import { AssetRegistry, setServices } from '../game/services';
import type { GameSession } from '../game/GameSession';
import { queueAsset } from '../ui/lazyAssets';
import { loadingTip } from '../core/presentation/uiPrefs';
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
      battleAnims: animCatalogInputs(moveAnims()),
      ebdxAnims: scriptAssets(ebdxAnims()),
      overworld: OVERWORLD,
    });
    const assets = new AssetRegistry(manifest, catalog);
    setServices({ session, assets });
    if (assets.missing.length > 0) {
      console.warn(`Missing assets (placeholders used): ${assets.missing.map((m) => m.id).join(', ')}`);
    }

    await this.loadFont(assets);
    this.loadAssets(assets);
  }

  /** Loads the pixel fonts; a font that fails falls back to the next one in FONT_FAMILY. */
  private async loadFont(assets: AssetRegistry): Promise<void> {
    if (typeof FontFace === 'undefined') return;
    const families: Record<string, string> = { 'font.main': 'PokemonMain', 'font.bold': 'PokemonBold' };
    await Promise.all(
      assets
        .entries()
        .filter((e) => e.kind === 'font' && families[e.id])
        .map(async (entry) => {
          try {
            const face = new FontFace(families[entry.id]!, `url(assets/${entry.path})`);
            await face.load();
            document.fonts.add(face);
          } catch {
            assets.markFailed(entry.id);
          }
        }),
    );
  }

  private loadAssets(assets: AssetRegistry): void {
    const bar = this.add.rectangle(GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2, 0, 16, COLORS.hpGreen).setOrigin(0, 0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 404, 20).setStrokeStyle(2, 0xffffff);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Loading…', textStyle(28, COLORS.textLight)).setOrigin(0.5);
    this.loadingExtras();

    const tracker = new PreloadTracker();
    const packText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, '', textStyle(13, COLORS.textMuted)).setOrigin(0.5);
    for (const entry of assets.entries()) {
      if (entry.lazy) continue;
      if (entry.kind === 'font') continue; // handled by loadFont
      tracker.add(entry.id, entry.path);
      queueAsset(this, entry);
    }
    this.load.on('filecomplete', (key: string) => {
      tracker.complete(key);
      packText.setText(tracker.line());
    });
    this.load.on('progress', (p: number) => (bar.width = 400 * p));
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`Failed to load asset ${file.key} (${String(file.url)})`);
      assets.markFailed(file.key);
    });
    this.load.once('complete', () => this.scene.start('MainMenu'));
    this.load.start();
  }

  /** A tip (F196) and a tiny catch-the-Magikarp game (I481) while assets load. Presentation only; no gameplay RNG. */
  private loadingExtras(): void {
    let n = 0;
    try {
      n = Number(localStorage.getItem('pkr.tipCounter') ?? '0') + 1;
      localStorage.setItem('pkr.tipCounter', String(n));
    } catch {
      /* storage unavailable: always the first tip */
    }
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 56, `Tip: ${loadingTip(n)}`, textStyle(16, COLORS.textMuted, { align: 'center', wordWrap: { width: 700 } })).setOrigin(0.5, 0);
    let caught = 0;
    const score = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 28, 'Tap the Magikarp while you wait!', textStyle(16, COLORS.textMuted)).setOrigin(0.5);
    const fish = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 110, '🐟', { fontSize: '40px' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: fish, y: GAME_HEIGHT - 150, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    fish.on('pointerdown', () => {
      caught += 1;
      score.setText(`Magikarp caught: ${caught}`);
      fish.x = 160 + ((caught * 197) % 640);
      this.tweens.add({ targets: fish, scale: { from: 1.5, to: 1 }, duration: 200 });
    });
  }
}
