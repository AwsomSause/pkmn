// The title screen's Continue card: the UIE Load screen's photo card, filled in with the saved run
// (trainer, region and stage, party and money) and the lead Pokémon in the photo frame. Presentation only.

import type Phaser from 'phaser';
import { pokemonAssetIds } from '../assets/catalog';
import type { Content } from '../core/contentSchema';
import { continueLines } from '../core/presentation/continueLines';
import { lookSpecies } from '../core/pokemon';
import type { RunState } from '../core/state';
import { loadAssets } from './lazyAssets';
import { pokemonIcon } from './sprites';
import { textStyle } from './theme';

export const LOAD_CARD_ASSET = 'ui.load.card';

/** Draws the card with its top-left at x, y (the art is 480×320). Returns null when the art isn't loaded. */
export function continueCard(scene: Phaser.Scene, content: Content, run: RunState, x: number, y: number): Phaser.GameObjects.Container | null {
  if (!scene.textures.exists(LOAD_CARD_ASSET)) return null;
  const box = scene.add.container(x, y).setName('continue-card');
  box.add(scene.add.image(0, 0, LOAD_CARD_ASSET).setOrigin(0));
  continueLines(content, run).forEach((line, i) => box.add(scene.add.text(246, 62 + i * 36, line, textStyle(i === 0 ? 24 : 18, '#4a3a2a')).setOrigin(0, 0)));
  const lead = run.party[0];
  if (lead) {
    const species = lookSpecies(content, lead);
    const icon = pokemonAssetIds(species.assets).icon;
    const put = (): void => {
      if (box.active) box.add(pokemonIcon(scene, species, 118, 118, 2.4));
    };
    if (scene.textures.exists(icon)) put();
    else void loadAssets(scene, [icon]).then(() => scene.scene.isActive() && put());
  }
  return box;
}
