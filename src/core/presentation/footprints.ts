// Footprint sheet lookup for the Pokédex page (tools/drive/build-footprints.py). Presentation only.

import cells from '../../assets/footprints.json';

const CELLS = cells as Record<string, number>;
export const FOOTPRINT_COLS = 32;
export const FOOTPRINT_SIZE = 32;

/** The sheet cell for a species; Megas, regional and other forms fall back to the print of the base they end with ("charizard-mega-x" -> "charizard"). */
export function footprintCell(speciesId: string): number | null {
  for (let id = speciesId; ; ) {
    const c = CELLS[id];
    if (c !== undefined) return c;
    const cut = id.lastIndexOf('-');
    if (cut < 0) return null;
    id = id.slice(0, cut);
  }
}
