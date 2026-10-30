// Picks which of the six UIE header-bar colours suits a region's accent colour
// (nearest in RGB). Pure; the art is chosen by `ui/frames.ts`.

export const FRAME_COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'red'] as const;
export type FrameColor = (typeof FRAME_COLORS)[number];

const SWATCH: Record<FrameColor, number> = {
  blue: 0x3060d0,
  green: 0x30b050,
  orange: 0xe09020,
  pink: 0xf080b0,
  purple: 0x8050c8,
  red: 0xd03030,
};

const channels = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export function frameColorFor(accent: number): FrameColor {
  const [r, g, b] = channels(accent);
  let best: FrameColor = 'blue';
  let bestDist = Infinity;
  for (const name of FRAME_COLORS) {
    const [sr, sg, sb] = channels(SWATCH[name]);
    const d = (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}
