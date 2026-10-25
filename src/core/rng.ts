// Seeded random number generation.
//
// Every random decision in a run comes from one of several named "streams".
// Each stream is its own generator, derived from the run seed, so rolling a
// reward never changes what the next wild Pokémon will be (and vice versa).
// Generator state is plain numbers, so it can be saved and restored exactly.

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export const STREAM_NAMES = ['starter', 'encounter', 'reward', 'battle', 'map', 'capture', 'shop'] as const;
export type StreamName = (typeof STREAM_NAMES)[number];
export type RngStreams = Record<StreamName, RngState>;

/** Turns any string into a 128-bit generator state (cyrb128 hash). */
export function hashSeed(text: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return { a: h1 >>> 0, b: h2 >>> 0, c: h3 >>> 0, d: h4 >>> 0 };
}

/** Creates one independent generator state per stream from the run seed. */
export function createStreams(seed: string): RngStreams {
  const streams = {} as RngStreams;
  for (const name of STREAM_NAMES) {
    streams[name] = hashSeed(`${seed}::${name}`);
  }
  return streams;
}

/** Makes a short random seed for a new run (uses real randomness, not a stream). */
export function makeRandomSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** sfc32 generator. Small, fast and good enough for games. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  get state(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  /** Next 32-bit unsigned integer. */
  nextUint32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) >>> 0;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  float(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** True with probability p (p is clamped to 0..1). */
  chance(p: number): boolean {
    const clamped = Math.min(1, Math.max(0, p));
    if (clamped >= 1) return true;
    if (clamped <= 0) return false;
    return this.float() < clamped;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Picks one entry using relative weights. Entries with weight <= 0 are never picked. */
  weighted<T>(entries: readonly { item: T; weight: number }[]): T {
    const usable = entries.filter((e) => e.weight > 0);
    const total = usable.reduce((sum, e) => sum + e.weight, 0);
    if (usable.length === 0 || total <= 0) throw new Error('Rng.weighted: no entries with positive weight');
    let roll = this.float() * total;
    for (const entry of usable) {
      roll -= entry.weight;
      if (roll < 0) return entry.item;
    }
    return usable[usable.length - 1]!.item;
  }

  /** Returns a shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }
}

/**
 * Runs `fn` with the named stream and writes the advanced state back.
 * This is the only way run code should consume randomness.
 */
export function withStream<T>(streams: RngStreams, name: StreamName, fn: (rng: Rng) => T): T {
  const rng = new Rng(streams[name]);
  const result = fn(rng);
  streams[name] = rng.state;
  return result;
}
