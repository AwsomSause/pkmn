// A Pokédex species page on the UIE Dex info art (Graphics/Custom UI/Dex/bg_info). A modal overlay the
// Research Room opens from a set's list; confirm or back closes it. Presentation only.

import type Phaser from 'phaser';
import type { Content } from '../core/contentSchema';
import { dexPage } from '../core/presentation/dexInfo';
import type { Profile } from '../core/state';
import { loadAssets } from './lazyAssets';
import { pokemonVisual } from './sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from './theme';

export const DEX_INFO_ASSET = 'ui.dex.bg_info';
const S = 1.2; // the art is 800×480; the screen is 960×540 (the art is stretched to fit)

export class DexInfo {
  private readonly root: Phaser.GameObjects.Container;
  private closed = false;

  constructor(private readonly scene: Phaser.Scene, content: Content, profile: Profile, speciesId: string, private readonly onClose: () => void) {
    const page = dexPage(content, profile, speciesId);
    this.root = scene.add.container(0, 0).setDepth(120).setName('dex-info');
    this.root.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive());
    const draw = (): void => {
      if (this.closed) return;
      this.root.add(scene.add.image(0, 0, DEX_INFO_ASSET).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
      this.root.add(scene.add.text(262 * S, 74 * S, page.title, textStyle(26, '#401010')).setOrigin(0, 0.5));
      this.root.add(scene.add.text(514 * S, 123 * S, page.types, textStyle(20, '#304050')).setOrigin(0.5));
      const sp = content.species.get(speciesId)!;
      if (page.state !== 'unknown') this.root.add(pokemonVisual(scene, sp, 'front', 160 * S, 168 * S, 2, false));
      this.root.add(scene.add.text(535 * S, 172 * S, page.note, textStyle(16, '#304050', { wordWrap: { width: 205 * S } })));
      page.stats.forEach((line, i) => this.root.add(scene.add.text(40 * S + (i % 4) * 170 * S, 350 * S + Math.floor(i / 4) * 34 * S, line, textStyle(22, '#503820'))));
      this.root.add(scene.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 14, 'Enter or Esc: back', textStyle(14, '#d8d8d8')).setOrigin(1, 1));
    };
    if (scene.textures.exists(DEX_INFO_ASSET)) draw();
    else void loadAssets(scene, [DEX_INFO_ASSET]).then(draw);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.root.destroy();
    this.onClose();
  }
}
