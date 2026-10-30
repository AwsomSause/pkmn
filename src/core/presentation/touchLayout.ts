// Readable mobile fallback (catalog #125): when to show the on-screen pad and the rotate hint. Pure.

export interface Viewport {
  width: number;
  height: number;
  /** True for touch-first devices (pointer: coarse). */
  coarse: boolean;
}

/** The pad appears on touch devices and on narrow windows, where there is no keyboard to rely on. */
export function showTouchPad(v: Viewport): boolean {
  return v.coarse || v.width < 700;
}

/** Portrait phones get a hint: the 16:9 game is much larger when the phone is turned. */
export function showRotateHint(v: Viewport): boolean {
  return v.width < 600 && v.height > v.width;
}

/** The canvas keeps 16:9; this is its on-screen width at the viewport (the pad takes `padHeight` from the height). */
export function canvasWidth(v: Viewport, padHeight: number): number {
  return Math.floor(Math.min(v.width, (v.height - padHeight) * (16 / 9)));
}

/** Text is kept readable if the canvas is at least this wide (the game's smallest text is ~16 px at 960 wide). */
export const MIN_READABLE_CANVAS = 480;
