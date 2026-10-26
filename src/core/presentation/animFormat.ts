// The compact battle animation format and the maths that places its sprites.
//
// PokeRogue's animation files (built in RPG Maker style) describe each move as
// a list of frames, one every 50 ms. Each frame lists sprites: pieces of the
// move's sprite sheet ("graphic"), or copies of the user or target Pokémon,
// with a position, zoom, angle, opacity and blend mode. Positions are relative
// to a focus: the target, the user, or the line from user to target (so the
// same file works whichever side uses the move). Timed events start sounds and
// fade a full-screen background in or out.
//
// tools/import-battle-anims.ts converts those files into the shorter form
// below; the battle screen's player (ui/battleFx/animPlayer.ts) draws them.
// Nothing here touches battle state or random numbers.

import { z } from 'zod';

/** Who a frame sprite is: a copy of the user, of the target, or a piece of the sheet. */
export const FrameTarget = { USER: 0, TARGET: 1, GRAPHIC: 2 } as const;
/** What a frame sprite's position is relative to. */
export const Focus = { TARGET: 1, USER: 2, USER_TARGET: 3, SCREEN: 4 } as const;
export const Blend = { NORMAL: 0, ADD: 1, SUBTRACT: 2 } as const;

/** Milliseconds per animation frame (PokeRogue: 3 game frames at 60 fps). */
export const FRAME_MS = 50;
/** Sprite sheet cell size in pixels. */
export const SHEET_FRAME = 96;

/**
 * One sprite in one frame:
 * [target, sheetFrame, x, y, zoomX%, zoomY%, angle, opacity 0–255, flags, blend, priority, focus, tone?]
 * flags: 1 visible, 2 mirrored, 4 locked (kept when it disappears from later frames).
 */
export type CompactFrame =
  | [number, number, number, number, number, number, number, number, number, number, number, number]
  | [number, number, number, number, number, number, number, number, number, number, number, number, [number, number, number, number]];

export type CompactEvent =
  | { f: number; k: 'sound'; r: string; v: number; p: number }
  | { f: number; k: 'bg' | 'bgUpdate'; r: string; x: number; y: number; o: number; d: number };

export interface CompactVariant {
  /** Sprite sheet slug, or null when the animation only moves the Pokémon. */
  g: string | null;
  frames: CompactFrame[][];
  events: CompactEvent[];
}

export interface CompactAnim {
  v: 1;
  /** One variant, or two: [used by the player's side, used by the opponent's side]. */
  variants: CompactVariant[];
}

const num = z.number();
const FrameSchema = z.union([
  z.tuple([num, num, num, num, num, num, num, num, num, num, num, num]),
  z.tuple([num, num, num, num, num, num, num, num, num, num, num, num, z.tuple([num, num, num, num])]),
]);
const EventSchema = z.union([
  z.object({ f: num, k: z.literal('sound'), r: z.string(), v: num, p: num }),
  z.object({ f: num, k: z.enum(['bg', 'bgUpdate']), r: z.string(), x: num, y: num, o: num, d: num }),
]);
export const CompactAnimSchema = z.object({
  v: z.literal(1),
  variants: z.array(z.object({ g: z.string().nullable(), frames: z.array(z.array(FrameSchema)), events: z.array(EventSchema) })).min(1).max(2),
});

/** "PRAS- Electric" -> "pras-electric"; "PRSFX- Thunderbolt2.wav" -> "prsfx-thunderbolt2". */
export function animSlug(name: string): string {
  return name
    .replace(/\.(wav|m4a|mp3|ogg|png)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Which variant a side uses, and whether user and target swap roles for it (PokeRogue's "opponent animation"). */
export function chooseVariant(anim: CompactAnim, userIsPlayer: boolean): { variant: CompactVariant; swapped: boolean } {
  if (anim.variants.length > 1 && !userIsPlayer) return { variant: anim.variants[1]!, swapped: true };
  return { variant: anim.variants[0]!, swapped: false };
}

/** How long a variant runs, in animation frames, including background fades that outlast the last frame. */
export function variantLength(variant: CompactVariant): number {
  let end = variant.frames.length;
  for (const e of variant.events) if (e.k !== 'sound') end = Math.max(end, e.f + e.d * 2);
  return end;
}

// ---------------------------------------------------------------- placement

/**
 * Where the battlers are, in PokeRogue's 320×180 field units. `x, y` is the
 * point the sprite stands on (bottom centre); `halfHeight` is half its drawn
 * height.
 */
export interface Battler {
  x: number;
  y: number;
  halfHeight: number;
}

export interface Placement {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

// The positions the files were drawn for.
const USER_FOCUS = { x: 106, y: 148 - 32 };
const TARGET_FOCUS = { x: 234, y: 84 - 32 };

/**
 * Places one frame sprite (PokeRogue's getGraphicFrameData). `user` and
 * `target` are after any role swap. Returns field units.
 */
export function placeFrame(frame: CompactFrame, user: Battler, target: Battler): Placement {
  const [kind, , fx, fy, zoomX, zoomY, angle, , flags, , , focus] = frame;
  let x = fx + 106;
  let y = fy + 116;
  let scaleX = (zoomX / 100) * (flags & 2 ? -1 : 1);
  const scaleY = zoomY / 100;
  if (focus === Focus.TARGET) {
    x += target.x - TARGET_FOCUS.x;
    y += target.y - target.halfHeight - TARGET_FOCUS.y;
  } else if (focus === Focus.USER) {
    x += user.x - USER_FOCUS.x;
    y += user.y - user.halfHeight - USER_FOCUS.y;
  } else if (focus === Focus.USER_TARGET) {
    // Map the line the file was drawn along onto the real user → target line.
    const src = [USER_FOCUS.x, USER_FOCUS.y, TARGET_FOCUS.x, TARGET_FOCUS.y] as const;
    const dst = [user.x, user.y - user.halfHeight, target.x, target.y - target.halfHeight] as const;
    const tx = src[2] === src[0] ? 0 : (x - src[0]) / (src[2] - src[0]);
    const ty = src[3] === src[1] ? 0 : (y - src[1]) / (src[3] - src[1]);
    x = dst[0] + tx * (dst[2] - dst[0]);
    y = dst[1] + ty * (dst[3] - dst[1]);
    const reversed = src[0] < src[2] ? dst[0] > dst[2] : src[0] > src[2] ? dst[0] < dst[2] : false;
    if (kind === FrameTarget.GRAPHIC && reversed) scaleX *= -1;
  }
  return { x, y, scaleX, scaleY, angle: -angle };
}
