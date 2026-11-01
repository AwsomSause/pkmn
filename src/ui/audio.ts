// Music and sound effects. Only plays assets that exist in the manifest,
// and respects the player's volume/mute settings.

import type Phaser from 'phaser';
import { pokemonAssetIds } from '../assets/catalog';
import type { Species } from '../core/contentSchema';
import { cryDetune } from '../core/wardrobe';
import { sfxAllowed, SFX_WINDOW_MS, type SfxPlay } from '../core/audioBudget';
import { services } from '../game/services';
import { loadAssets } from './lazyAssets';

let recentSfx: SfxPlay[] = [];

export function playSfx(scene: Phaser.Scene, id: string, volumeScale = 1, detune = 0): void {
  const { session, assets } = services();
  if (!assets.has(id) || session.settings.muted) return;
  // Many hits in a row: cap how many play at once and skip an immediate repeat.
  const now = performance.now();
  recentSfx = recentSfx.filter((p) => now - p.at < SFX_WINDOW_MS);
  if (!sfxAllowed(recentSfx, id, now)) return;
  recentSfx.push({ id, at: now });
  try {
    scene.sound.play(id, { volume: session.settings.sfxVolume * volumeScale, detune });
  } catch {
    // Audio can fail before the first user interaction; it's never critical.
  }
}

/** Plays a Pokémon's cry, loading it first if this screen didn't preload it. */
export function playCry(scene: Phaser.Scene, species: Species): void {
  const id = pokemonAssetIds(species.assets).cry;
  if (!services().assets.has(id) || services().session.settings.muted) return;
  const detune = cryDetune(services().session.profile);
  if (scene.cache.audio.exists(id)) playSfx(scene, id, 0.6, detune);
  else void loadAssets(scene, [id]).then(() => scene.sys.isActive() && playSfx(scene, id, 0.6, detune));
}

/** Plays a sound that loads on demand (jingles, status sounds), loading it first if this screen didn't. */
export function playSfxLazy(scene: Phaser.Scene, id: string, volumeScale = 1): void {
  if (!services().assets.has(id) || services().session.settings.muted) return;
  if (scene.cache.audio.exists(id)) playSfx(scene, id, volumeScale);
  else void loadAssets(scene, [id]).then(() => scene.sys.isActive() && playSfx(scene, id, volumeScale));
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

/** Plays a song that loads on demand; the fallback song runs until it has arrived. */
export function playMusicLazy(scene: Phaser.Scene, id: string, fallback = 'bgm.menu'): void {
  if (scene.cache.audio.exists(id)) return playMusic(scene, id);
  playMusic(scene, fallback);
  if (!services().assets.has(id)) return;
  void loadAssets(scene, [id]).then(() => scene.sys.isActive() && playMusic(scene, id));
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

/** Camp ambience by the hour (synthesised, so no audio files are needed): a soft wind bed, plus crickets in the evening, owl-like hoots at night, birdsong in the morning. Stops with the scene; respects mute and the sound-effects volume. */
export function startAmbient(scene: Phaser.Scene, period: 'morning' | 'afternoon' | 'evening' | 'night'): void {
  const { session } = services();
  const sm = scene.sound as unknown as { context?: AudioContext };
  const ctx = sm.context;
  if (!ctx || session.settings.muted || session.settings.sfxVolume <= 0) return;
  try {
    const gain = ctx.createGain();
    gain.gain.value = 0.05 * session.settings.sfxVolume;
    gain.connect(ctx.destination);
    // Wind: low-passed noise.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = period === 'night' ? 300 : 600;
    noise.connect(lp).connect(gain);
    noise.start();
    // Little calls on a timer: [pitch Hz, wave, every ms].
    const call = { morning: [1800, 'sine', 1400], afternoon: [0, 'sine', 0], evening: [4200, 'square', 700], night: [420, 'sine', 3200] }[period] as [number, OscillatorType, number];
    const beep = (): void => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = call[1];
      osc.frequency.value = call[0] * (0.9 + Math.random() * 0.2);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.02 * session.settings.sfxVolume, ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    };
    const timer = call[2] > 0 ? window.setInterval(beep, call[2]) : 0;
    scene.events.once('shutdown', () => {
      window.clearInterval(timer);
      try {
        noise.stop();
        gain.disconnect();
      } catch {
        // already stopped
      }
    });
  } catch {
    // Audio is never critical.
  }
}
