// Regional identity packs (catalog 62), the look and sound part: each region has
// its own sky tint and accent for menus and the map, a motif word for its
// banner, and a musical key for the procedural layers and motifs (its
// "soundtrack family"). The local event pool, species bias and crisis kind come
// from other systems (events, generations, crisis). Pure data, presentation only.

export interface RegionIdentity {
  /** Aero sky tint behind gameplay menus. */
  sky: number;
  /** Accent for the map header and banners. */
  accent: number;
  /** One word for the region's motif, shown in its banner. */
  motif: string;
  /** Semitones added to the procedural music root (A2), so each region sits in its own key. */
  key: number;
}

const IDENTITY: Record<string, RegionIdentity> = {
  kanto: { sky: 0x3a7bd5, accent: 0xf04848, motif: 'Classic', key: 0 },
  johto: { sky: 0x6a7fc8, accent: 0xd8a040, motif: 'Tradition', key: 2 },
  hoenn: { sky: 0x2aa0b8, accent: 0x40c070, motif: 'Tides', key: 5 },
  sinnoh: { sky: 0x5a6ab8, accent: 0xa0c8f0, motif: 'Myth', key: -2 },
  unova: { sky: 0x4a5878, accent: 0xe0e0e0, motif: 'Ideals', key: 3 },
  kalos: { sky: 0x7a6ad0, accent: 0xf080b0, motif: 'Beauty', key: 7 },
  alola: { sky: 0x28b8d8, accent: 0xf8a040, motif: 'Islands', key: 4 },
  galar: { sky: 0x4a6aa8, accent: 0xd03050, motif: 'Stadium', key: -3 },
  paldea: { sky: 0x3a9ad0, accent: 0xf0b020, motif: 'Treasure', key: 1 },
  torren: { sky: 0x3a2a5a, accent: 0x9a60f0, motif: 'Delta', key: -1 },
  'frontier-isles': { sky: 0x2a6a8a, accent: 0xf0c040, motif: 'Frontier', key: 6 },
  'trial-archipelago': { sky: 0x20a8a0, accent: 0xf07050, motif: 'Trials', key: -4 },
  grand: { sky: 0x2a2f6a, accent: 0xf8e080, motif: 'Legend', key: -5 },
};

const FALLBACK: RegionIdentity = IDENTITY.kanto!;

export function regionIdentity(regionId: string | undefined): RegionIdentity {
  return (regionId && IDENTITY[regionId]) || FALLBACK;
}

export const REGION_IDENTITY_IDS = Object.keys(IDENTITY);
