// Creates Pokémon, trainer and item visuals. Uses the real art when it was
// loaded, otherwise a clearly-labelled placeholder (never a broken image).

import Phaser from 'phaser';
import { pokemonAssetIds } from '../assets/catalog';
import type { Species } from '../core/contentSchema';
import { services } from '../game/services';
import { COLORS, PIXEL_SCALE, TYPE_COLORS, textStyle } from './theme';

/** Builds a looping animation from every frame of a loaded atlas (once per atlas). */
export function ensureAtlasAnimation(scene: Phaser.Scene, key: string): string | null {
  const animKey = `${key}.anim`;
  if (scene.anims.exists(animKey)) return animKey;
  if (!scene.textures.exists(key)) return null;
  const frames = scene.textures
    .get(key)
    .getFrameNames()
    .sort()
    .map((frame) => ({ key, frame }));
  if (frames.length === 0) return null;
  scene.anims.create({ key: animKey, frames, frameRate: 12, repeat: -1 });
  return animKey;
}

function atlasSprite(scene: Phaser.Scene, key: string, x: number, y: number, scale: number): Phaser.GameObjects.Sprite | null {
  if (!services().assets.has(key) || !scene.textures.exists(key)) return null;
  // Atlases have named frames; a single picture (e.g. a boss portrait) has none.
  const frames = scene.textures.get(key).getFrameNames().sort();
  const sprite = scene.add.sprite(x, y, key, frames[0]).setOrigin(0.5, 1).setScale(scale);
  const anim = ensureAtlasAnimation(scene, key);
  if (anim) sprite.play(anim);
  return sprite;
}

function placeholder(scene: Phaser.Scene, x: number, y: number, size: number, color: number, label: string): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillCircle(0, -size / 2, size / 2);
  g.lineStyle(4, 0x202020, 0.6);
  g.strokeCircle(0, -size / 2, size / 2);
  const text = scene.add
    .text(0, -size / 2, label, textStyle(Math.round(size / 5), '#ffffff', { align: 'center', stroke: '#202020', strokeThickness: 4 }))
    .setOrigin(0.5);
  return scene.add.container(x, y, [g, text]);
}

export type Visual = Phaser.GameObjects.Sprite | Phaser.GameObjects.Container;

/** A Pokémon's battle sprite. Shiny Pokémon use the shiny art when it was loaded, otherwise the normal art. */
export function pokemonVisual(scene: Phaser.Scene, species: Species, side: 'front' | 'back', x: number, y: number, scale = PIXEL_SCALE, shiny = false): Visual {
  const key = side === 'front' ? species.assets.front : species.assets.back;
  const ids = pokemonAssetIds(species.dex);
  const shinyKey = side === 'front' ? ids.shinyFront : ids.shinyBack;
  return (
    (shiny ? atlasSprite(scene, shinyKey, x, y, scale) : null) ??
    atlasSprite(scene, key, x, y, scale) ??
    placeholder(scene, x, y, 40 * scale, TYPE_COLORS[species.types[0] ?? 'normal'] ?? 0x888888, species.name)
  );
}

export function trainerVisual(scene: Phaser.Scene, assetId: string, name: string, x: number, y: number, scale = 2): Visual {
  return atlasSprite(scene, assetId, x, y, scale) ?? placeholder(scene, x, y, 70 * scale, COLORS.panelDark, `${name}\n(art missing)`);
}

export function itemVisual(scene: Phaser.Scene, assetId: string, x: number, y: number, scale = 2): Phaser.GameObjects.GameObject {
  if (services().assets.has(assetId) && scene.textures.exists(assetId)) {
    return scene.add.image(x, y, assetId).setScale(scale);
  }
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0xc0c8d0, 1);
  g.fillRoundedRect(-16 * scale / 2, -16 * scale / 2, 16 * scale, 16 * scale, 6);
  return g;
}

/** The small menu icon for a Pokémon (centred on x, y), or a coloured dot when the icon is missing. */
export function pokemonIcon(scene: Phaser.Scene, species: Species, x: number, y: number, scale = 1): Phaser.GameObjects.GameObject {
  const key = pokemonAssetIds(species.dex).icon;
  if (services().assets.has(key) && scene.textures.exists(key)) return scene.add.image(x, y, key).setScale(scale);
  const g = scene.add.graphics({ x, y });
  g.fillStyle(TYPE_COLORS[species.types[0] ?? 'normal'] ?? 0x888888, 1);
  g.fillCircle(0, 0, 14 * scale);
  return g;
}
