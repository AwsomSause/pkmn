// Procedural music layers, motifs and arena ambience (catalog #126, #128-130), built on Web Audio so no new files are needed.
// They sit on top of the base track from the music pack. Presentation only; failures are silent and respect mute and volumes.

import type Phaser from 'phaser';
import { AMBIENCE_VOICE, LAYERS, motifFor, type AmbienceId, type LayerId, type MusicState } from '../core/presentation/musicLayers';
import { services } from '../game/services';

const ROOT_HZ = 110;
const FADE = 0.8;
const LAYER_LEVEL = 0.12;

interface Voice {
  gain: GainNode;
  stop: () => void;
}

let layerVoices = new Map<LayerId, Voice>();
let ambience: Voice | null = null;

function context(scene: Phaser.Scene): AudioContext | null {
  const c = (scene.sound as unknown as { context?: AudioContext }).context;
  return c ?? null;
}

/** The current region's key (catalog 62 "soundtrack family"), in semitones above the root. */
let regionKey = 0;
const hz = (semis: number) => ROOT_HZ * Math.pow(2, (semis + regionKey) / 12);

/** Moves the procedural layers and motifs into a region's key; layers already playing are rebuilt in it. */
export function setRegionKey(semis: number): void {
  if (semis === regionKey) return;
  regionKey = semis;
  for (const v of layerVoices.values()) v.stop();
  layerVoices = new Map();
}

function osc(c: AudioContext, type: OscillatorType, freq: number, out: AudioNode): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(out);
  o.start();
  return o;
}

function makeLayer(c: AudioContext, id: LayerId): Voice {
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);
  const nodes: (OscillatorNode | AudioScheduledSourceNode)[] = [];
  if (id === 'pad') {
    for (const s of [0, 7, 12]) nodes.push(osc(c, 'sine', hz(s), gain));
  } else if (id === 'choir') {
    for (const s of [12, 15, 19]) {
      const o = osc(c, 'triangle', hz(s), gain);
      const lfo = osc(c, 'sine', 5 + s / 10, c.createGain());
      nodes.push(o, lfo);
    }
  } else if (id === 'lead') {
    const o = osc(c, 'sawtooth', hz(24), gain);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    o.disconnect();
    o.connect(filter);
    filter.connect(gain);
    nodes.push(o);
  } else {
    // pulse: a low tone gated at about 2 beats a second
    const tone = c.createOscillator();
    tone.type = 'square';
    tone.frequency.value = hz(-12);
    const gate = c.createGain();
    gate.gain.value = 0.5;
    const lfo = c.createOscillator();
    lfo.frequency.value = 2;
    const depth = c.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(gate.gain);
    tone.connect(gate);
    gate.connect(gain);
    tone.start();
    lfo.start();
    nodes.push(tone, lfo);
  }
  return {
    gain,
    stop: () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      gain.disconnect();
    },
  };
}

function level(): number {
  const { settings } = services().session;
  return settings.muted ? 0 : settings.musicVolume * LAYER_LEVEL;
}

/** Fades the layers for this music state in or out. Safe to call every turn. */
export function setMusicState(scene: Phaser.Scene, state: MusicState): void {
  try {
    const c = context(scene);
    if (!c) return;
    const want = new Set(LAYERS[state]);
    for (const id of want) if (!layerVoices.has(id)) layerVoices.set(id, makeLayer(c, id));
    for (const [id, v] of layerVoices) v.gain.gain.setTargetAtTime(want.has(id) ? level() : 0, c.currentTime, FADE / 3);
  } catch {
    /* audio is never critical */
  }
}

/** A character motif (#129): a few soft notes. */
export function playMotif(scene: Phaser.Scene, id: string): void {
  try {
    const c = context(scene);
    const { settings } = services().session;
    if (!c || settings.muted) return;
    const vol = settings.musicVolume * 0.2;
    motifFor(id).forEach((semi, i) => {
      const t = c.currentTime + i * 0.28;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = hz(semi + 12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* audio is never critical */
  }
}

/** The arena bed (#130): looped noise through a low-pass filter with a slow swell. */
export function setAmbience(scene: Phaser.Scene, id: AmbienceId): void {
  try {
    stopAmbience();
    const c = context(scene);
    const { settings } = services().session;
    if (!c) return;
    const voice = AMBIENCE_VOICE[id];
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; // fixed noise, no gameplay RNG
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = voice.cutoff;
    const gain = c.createGain();
    gain.gain.value = settings.muted ? 0 : settings.sfxVolume * voice.level * 0.12;
    const swell = c.createOscillator();
    swell.frequency.value = voice.swell;
    const swellDepth = c.createGain();
    swellDepth.gain.value = gain.gain.value * 0.6;
    swell.connect(swellDepth);
    swellDepth.connect(gain.gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
    swell.start();
    ambience = {
      gain,
      stop: () => {
        for (const n of [src, swell]) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        gain.disconnect();
      },
    };
  } catch {
    ambience = null;
  }
}

export function stopAmbience(): void {
  ambience?.stop();
  ambience = null;
}

/** Ends every procedural voice (call when leaving a battle). */
export function stopProceduralAudio(): void {
  for (const v of layerVoices.values()) v.stop();
  layerVoices = new Map();
  stopAmbience();
}
