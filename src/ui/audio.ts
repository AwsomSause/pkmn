// Music and sound effects. Only plays assets that exist in the manifest,
// and respects the player's volume/mute settings.

import type Phaser from 'phaser';
import { pokemonAssetIds } from '../assets/catalog';
import type { Species } from '../core/contentSchema';
import { sfxAllowed, SFX_WINDOW_MS, type SfxPlay } from '../core/audioBudget';
import { services } from '../game/services';
import { loadAssets } from './lazyAssets';

let recentSfx: SfxPlay[] = [];

export function playSfx(scene: Phaser.Scene, id: string, volumeScale = 1): void {
  const { session, assets } = services();
  if (!assets.has(id) || session.settings.muted) return;
  // Many hits in a row: cap how many play at once and skip an immediate repeat.
  const now = performance.now();
  recentSfx = recentSfx.filter((p) => now - p.at < SFX_WINDOW_MS);
  if (!sfxAllowed(recentSfx, id, now)) return;
  recentSfx.push({ id, at: now });
  try {
    scene.sound.play(id, { volume: session.settings.sfxVolume * volumeScale });
  } catch {
    // Audio can fail before the first user interaction; it's never critical.
  }
}

/** Plays a Pokémon's cry, loading it first if this screen didn't preload it. */
export function playCry(scene: Phaser.Scene, species: Species): void {
  const id = pokemonAssetIds(species.assets).cry;
  if (!services().assets.has(id) || services().session.settings.muted) return;
  if (scene.cache.audio.exists(id)) playSfx(scene, id, 0.6);
  else void loadAssets(scene, [id]).then(() => scene.sys.isActive() && playSfx(scene, id, 0.6));
}

let currentMusic: { id: string; sound: Phaser.Sound.BaseSound } | null = null;

export function playMusic(scene: Phaser.Scene, id: string): void {
  const { session, assets } = services();
  if (currentMusic?.id === id && currentMusic.sound.isPlaying) return;
  stopMusic();
  if (!assets.has(id) || session.settings.muted) return;
  try {
    const sound = scene.sound.add(id, { loop: true, volume: session.settings.musicVolume });
    sound.play();
    currentMusic = { id, sound };
  } catch {
    currentMusic = null;
  }
}

export function stopMusic(): void {
  if (currentMusic) {
    currentMusic.sound.stop();
    currentMusic.sound.destroy();
    currentMusic = null;
  }
}

/** Applies the music volume setting to the track that is playing now. */
export function refreshMusicVolume(): void {
  const sound = currentMusic?.sound as (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void }) | undefined;
  sound?.setVolume?.(services().session.settings.musicVolume);
}
