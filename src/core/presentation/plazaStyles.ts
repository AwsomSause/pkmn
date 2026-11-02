// Plaza styles (Kice 2026-11-02, mock-ups 7, 9, 10, 12 in project files `redesign/plaza/`): the player picks how the
// Trainer Plaza is drawn. Every style shows the same tile-map plaza (Pokemon-Memories tiles, `tools/build-plaza-map.py`)
// and the same districts, crowd and menus; only the framing and overlays change. Pure data: no Phaser, no gameplay RNG.

export const PLAZA_STYLE_IDS = ['aero', 'seasons', 'diorama', 'social'] as const;
export type PlazaStyleId = (typeof PLAZA_STYLE_IDS)[number];

export const PLAZA_STYLE_LABELS: Record<PlazaStyleId, string> = {
  aero: 'Aero Bubbles',
  seasons: 'Regional Looks',
  diorama: 'Diorama Island',
  social: 'Social Square',
};

export function plazaStyleOf(saved: string | undefined): PlazaStyleId {
  return (PLAZA_STYLE_IDS as readonly string[]).includes(saved ?? '') ? (saved as PlazaStyleId) : 'aero';
}

export function nextPlazaStyle(id: PlazaStyleId): PlazaStyleId {
  return PLAZA_STYLE_IDS[(PLAZA_STYLE_IDS.indexOf(id) + 1) % PLAZA_STYLE_IDS.length]!;
}

/** The baked map: 60 x 34 tiles of 32 px. */
export const PLAZA_MAP = { tile: 32, cols: 60, rows: 34 } as const;

export interface TileSpot {
  x: number;
  y: number;
}

/** Where each district's label sits (over its building) and where the player stands to use it, in map tiles. */
export const DISTRICT_SPOTS: Record<'market' | 'trading' | 'gathering' | 'social' | 'services' | 'secret', { label: TileSpot; stand: TileSpot }> = {
  market: { label: { x: 19, y: 3.2 }, stand: { x: 19, y: 10.6 } },
  trading: { label: { x: 11.7, y: 12.0 }, stand: { x: 15, y: 15.2 } },
  gathering: { label: { x: 29.5, y: 14.6 }, stand: { x: 29.5, y: 18.8 } },
  social: { label: { x: 48.2, y: 12.2 }, stand: { x: 44.6, y: 15.6 } },
  services: { label: { x: 40.3, y: 3.4 }, stand: { x: 40.3, y: 10.6 } },
  secret: { label: { x: 49, y: 22.2 }, stand: { x: 45.2, y: 24.6 } },
};

/** The paved square the crowd wanders on (tiles). */
export const PLAZA_FLOOR = { x: 14.5, y: 10.5, w: 30, h: 13 } as const;
/** Where the player arrives (the path from the route). */
export const PLAZA_ENTRY: TileSpot = { x: 30, y: 27 };

/** Stall keepers and counter staff that stand still and idle-bob (walk sheet, tile spot). */
export const PLAZA_KEEPERS: { sheet: string; at: TileSpot }[] = [
  { sheet: 'NPC_113_Mart_M', at: { x: 24, y: 6.2 } },
  { sheet: 'NPC_114_Mart_F', at: { x: 27.2, y: 6.2 } },
  { sheet: 'YOUNGSTER', at: { x: 30.4, y: 6.2 } },
  { sheet: 'trWaitress', at: { x: 33.4, y: 6.2 } },
  { sheet: 'trHiker', at: { x: 11.6, y: 18.2 } },
  { sheet: 'trScientist_F', at: { x: 40.2, y: 9.2 } },
];

/** Walk sheets for the wandering crowd (4 x 4 frames of 64 px: down, left, right, up). */
export const PLAZA_WALKERS = ['ace_trainer_f', 'trBackpacker_F', 'trGentleman', 'trParasolLady', 'trDancer', 'trSchoolKid_F', 'trFisher', 'trBlackBelt', 'trBattleGirl', 'LASS', 'trSwimmer_M'] as const;
/** Asset id of a walk sheet: the plaza shares Hub Town's trainer sheets (`src/data/overworld.json`). */
export const plazaSheetId = (sheet: string): string => `ow.trainer.${sheet}`;
/** Every walk sheet the plaza can show, loaded when the scene opens. */
export const PLAZA_OW_SHEETS: readonly string[] = ['boy_run', 'hood_man', 'nemona', ...PLAZA_WALKERS, ...PLAZA_KEEPERS.map((k) => k.sheet)];

/** A wanderer's walk sheet: rivals look like a rival, shady folk wear a hood, everyone else is picked by a hash of their id. */
export function walkerSheet(id: string, kind: string): string {
  if (kind === 'rival') return 'nemona';
  if (kind === 'foe') return 'hood_man';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PLAZA_WALKERS[h % PLAZA_WALKERS.length]!;
}

export type PlazaSeason = 'spring' | 'autumn' | 'snow' | 'dusk';
export const PLAZA_SEASONS: Record<PlazaSeason, { name: string; tint: number; alpha: number; particle: number; fall: 'drift' | 'fall' | 'haze' }> = {
  spring: { name: 'Spring Festival', tint: 0xffd0e8, alpha: 0.1, particle: 0xffb4d2, fall: 'drift' },
  autumn: { name: 'Autumn Harvest', tint: 0xe67828, alpha: 0.26, particle: 0xe88a30, fall: 'drift' },
  snow: { name: 'Snowfall', tint: 0xd7ebff, alpha: 0.32, particle: 0xffffff, fall: 'fall' },
  dusk: { name: 'Desert Dusk', tint: 0xffa050, alpha: 0.24, particle: 0xf0d8a0, fall: 'haze' },
};

/** Regional Looks: the season follows the stage in the region (two stages each), warm regions skip snow. */
export function plazaSeason(stageIndex: number, regionId: string | undefined): PlazaSeason {
  const order: PlazaSeason[] = ['spring', 'autumn', 'snow', 'dusk'];
  const pick = order[Math.floor(Math.max(0, stageIndex) / 2) % order.length]!;
  const warm = regionId === 'alola' || regionId === 'hoenn' || regionId === 'trial-archipelago';
  return warm && pick === 'snow' ? 'dusk' : pick;
}
