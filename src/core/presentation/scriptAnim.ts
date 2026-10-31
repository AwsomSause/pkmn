// Scripted move animations ported from Elite Battle DX (EBDX).
//
// EBDX writes each move animation as a Ruby script that moves sprites a little
// every frame. We can't run Ruby, so each ported move is a short, readable
// timeline instead: layers of sprites that travel between the user, the target
// and the point between them, plus what the target does when hit.
// ui/battleFx/scriptPlayer.ts draws them. Presentation only: nothing here
// touches battle state, and the random-looking spread comes from `scatter`, a
// hash of the script name, layer and particle, never from the gameplay streams.

import { z } from 'zod';

/** EBDX's screen is 512 wide, ours is 960: one EBDX pixel is this many of ours. */
export const EBDX_SCALE = 1.875;

const Point = z.object({
  /** What the point is measured from. */
  at: z.enum(['user', 'target', 'mid']),
  /** Offset in EBDX pixels (positive y is down). Mirrored for the other side so a script reads the same from either end. */
  dx: z.number().default(0),
  dy: z.number().default(0),
  /** Random spread: each particle gets a fixed offset between -j/2 and +j/2. */
  jx: z.number().default(0),
  jy: z.number().default(0),
});
export type ScriptPoint = z.infer<typeof Point>;

const Layer = z.object({
  /** Picture in public/assets/images/packs/ebdx/moves/<img>.png. */
  img: z.string().min(1),
  /** Size of one cell when the picture is a strip or grid of frames. */
  cell: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
  /** Which cells play, in order, one every `frameMs` (looping). Default: all cells of row 0. */
  frames: z.array(z.number().int().min(0)).optional(),
  frameMs: z.number().positive().default(50),
  /** A particle picks one grid row by scatter (the flame art has three). */
  randomRow: z.boolean().default(false),
  /** A full-field backdrop (tiled and drifting) instead of particles. */
  fill: z.boolean().default(false),
  /** Pivot inside the picture, 0–1. */
  origin: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
  count: z.number().int().min(1).max(64).default(1),
  /** When the first particle starts, and the gap before each next one (ms). */
  start: z.number().min(0).default(0),
  stagger: z.number().min(0).default(0),
  /** How long each particle lives (ms). */
  dur: z.number().positive(),
  from: Point,
  to: Point.optional(),
  ease: z.enum(['linear', 'out', 'in', 'inOut', 'back']).default('linear'),
  /** Sideways bulge of the path in EBDX pixels (sign chosen per particle). */
  arc: z.number().default(0),
  scale: z.tuple([z.number(), z.number()]).default([1, 1]),
  /** Each particle multiplies its scale by one of these, picked by scatter. */
  scaleSet: z.array(z.number().positive()).optional(),
  /** Fraction of the life spent fading in, and the fraction at which fading out starts. */
  fade: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).default([0.2, 0.7]),
  alpha: z.number().min(0).max(1).default(1),
  /** Degrees at the start and end, or 'aim' to point along the path. */
  angle: z.union([z.tuple([z.number(), z.number()]), z.literal('aim')]).default([0, 0]),
  /** Each particle may be flipped sideways by scatter. */
  flip: z.boolean().default(false),
  blend: z.enum(['normal', 'add']).default('normal'),
  tint: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});
export type ScriptLayer = z.infer<typeof Layer>;

export const ScriptAnimSchema = z.object({
  v: z.literal(1),
  /** Total length (ms); the last particle and the target's reaction must fit. */
  length: z.number().positive().max(4000),
  /** A colour veil over the field, to make the effect stand out. */
  veil: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), alpha: z.number().min(0).max(1), inMs: z.number().min(0), outMs: z.number().min(0) }).optional(),
  layers: z.array(Layer).max(8),
  /** What the target does: a bounce-back squash, a shake, a colour flash. */
  hit: z
    .object({
      at: z.number().min(0),
      squash: z.number().min(0).max(0.5).default(0),
      shake: z.object({ ms: z.number().positive(), amp: z.number().positive() }).optional(),
      flash: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), ms: z.number().positive() }).optional(),
    })
    .optional(),
  /** The user's own shake (a roar, a wind-up). */
  userShake: z.object({ at: z.number().min(0), ms: z.number().positive(), amp: z.number().positive() }).optional(),
  /** Sound effects: ids of public/assets/audio/ebdx/<id>.m4a and when they play. */
  sfx: z.array(z.object({ at: z.number().min(0), id: z.string().min(1), vol: z.number().min(0).max(1).default(0.6), src: z.string().optional() })).default([]),
});
export type ScriptAnim = z.infer<typeof ScriptAnimSchema>;

export const EbdxAnimsFileSchema = z.object({
  source: z.string(),
  scripts: z.record(z.string(), ScriptAnimSchema),
  /** Move id (as in moves.json) → script name. */
  moves: z.record(z.string(), z.string()),
});
export type EbdxAnimsFile = z.infer<typeof EbdxAnimsFileSchema>;

export function parseEbdxAnims(raw: unknown): EbdxAnimsFile {
  const result = EbdxAnimsFileSchema.safeParse(raw);
  if (!result.success) throw new Error(`ebdxAnims.json is invalid: ${result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  for (const [move, script] of Object.entries(result.data.moves)) {
    if (!result.data.scripts[script]) throw new Error(`ebdxAnims.json: move ${move} uses missing script ${script}`);
  }
  return result.data;
}

/** A fixed number in [0, 1) for (script, layer, particle, slot): the same every time, and never the gameplay RNG. */
export function scatter(script: string, layer: number, particle: number, slot: number): number {
  let h = 2166136261;
  for (const c of `${script}:${layer}:${particle}:${slot}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const EASE: Record<ScriptLayer['ease'], (t: number) => number> = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  back: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};
export const ease = (kind: ScriptLayer['ease'], t: number): number => EASE[kind](Math.min(1, Math.max(0, t)));

/** Opacity of a particle at life fraction t (0–1): fades in, holds, fades out. */
export function lifeAlpha(t: number, fade: readonly [number, number]): number {
  if (t < 0 || t > 1) return 0;
  const [fin, fout] = fade;
  if (fin > 0 && t < fin) return t / fin;
  if (fout < 1 && t > fout) return (1 - t) / (1 - fout);
  return 1;
}

/** The pictures and sound ids a file's scripts need (for the asset catalog). */
export function scriptAssets(file: EbdxAnimsFile): { images: string[]; sounds: string[] } {
  const images = new Set<string>();
  const sounds = new Set<string>();
  for (const s of Object.values(file.scripts)) {
    s.layers.forEach((l) => images.add(l.img));
    s.sfx.forEach((f) => sounds.add(f.id));
  }
  return { images: [...images].sort(), sounds: [...sounds].sort() };
}
