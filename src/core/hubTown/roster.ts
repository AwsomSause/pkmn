// Hub Town's crowd (spec 2026-11-01 §8, Kice 2026-11-02 "more trainers and Pokémon that wander around and change over
// time"): who is out and about right now. The crowd changes every half hour of local time and grows with your progress;
// the Pokémon are ones you have met. Pure and deterministic: a hash of the profile id and the time window, its own stream,
// never gameplay RNG. Where each one walks next is presentation (ui/hubTown/crowd.ts) and never touches the profile.

import { hashSeed, Rng } from '../rng';
import type { Profile } from '../state';
import { HUB_TOWN, OVERWORLD, type Facing, type HubTownData } from './schema';
import { followerKey, WalkGrid, type Tile } from './world';

/** Minutes per crowd: the people and Pokémon in town change this often. */
export const CROWD_WINDOW_MINUTES = 30;
/** Pokémon you see in town before you have met any (common partners). */
const STARTER_CROWD = ['pikachu', 'eevee', 'bulbasaur', 'charmander', 'squirtle', 'pidgey', 'rattata', 'meowth', 'psyduck', 'growlithe', 'jigglypuff', 'togepi', 'marill', 'skitty', 'buneary', 'lillipup'];
/** Zones each kind prefers (the plaza is busiest). */
const TRAINER_ZONES = ['plaza', 'plaza', 'north', 'west', 'east', 'south', 'south', 'lake', 'meadow', 'orchard', 'flowers'];
const MON_ZONES = ['plaza', 'meadow', 'grove', 'flowers', 'sanctuary', 'sanctuary', 'orchard', 'lake', 'cove', 'west', 'east', 'south'];

export interface Wanderer {
  id: string;
  kind: 'trainer' | 'pokemon';
  /** Trainer sheet name (OVERWORLD.trainers) or follower key. */
  sheet: string;
  /** For Pokémon: the species id (for its name). */
  speciesId?: string;
  zone: string;
  start: Tile;
  facing: Facing;
}

/** The time window a moment falls in (local time): "2026-11-02T13" + half. */
export function crowdWindow(now: Date, minutes = CROWD_WINDOW_MINUTES): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / minutes);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}#${slot}`;
}

/** How many of each are out: more as you finish runs and meet Pokémon. */
export function crowdSize(p: Pick<Profile, 'stats' | 'mastery'>): { trainers: number; pokemon: number } {
  const met = Object.values(p.mastery).filter((m) => m.seen > 0 || m.caught > 0).length;
  return { trainers: 10 + Math.min(10, p.stats.runsEnded), pokemon: 12 + Math.min(14, Math.floor(met / 8)) };
}

/** Species that may wander: ones you met (with walking art), else the common partners. */
export function crowdSpecies(p: Pick<Profile, 'mastery'>, available: Record<string, number> = OVERWORLD.followers): string[] {
  const met = Object.entries(p.mastery)
    .filter(([, m]) => m.seen > 0 || m.caught > 0)
    .map(([id]) => id)
    .filter((id) => followerKey(id, available) !== null)
    .sort();
  return met.length >= 6 ? met : [...new Set([...met, ...STARTER_CROWD.filter((id) => followerKey(id, available) !== null)])];
}

/** The crowd in town during one window. Same profile + same window = same crowd. */
export function hubCrowd(p: Pick<Profile, 'profileId' | 'stats' | 'mastery'>, window: string, map: HubTownData = HUB_TOWN): Wanderer[] {
  const rng = new Rng(hashSeed(`hubtown-crowd::${p.profileId}::${window}`));
  const grid = new WalkGrid(map);
  // Keep doors, stands, keepers and pedestals clear.
  const reserved = new Set<string>();
  const key = (t: Tile) => `${t.x},${t.y}`;
  for (const pl of map.places) {
    reserved.add(key(pl.door));
    reserved.add(key(pl.stand));
  }
  for (const k of map.keepers) reserved.add(key(k));
  for (const [x, y] of map.pads) for (const dx of [-1, 0, 1]) reserved.add(`${x + dx},${y}`);
  reserved.add(key(map.spawn));
  const taken = new Set<string>();
  const facings: Facing[] = ['up', 'down', 'left', 'right'];
  const spotIn = (zone: string): Tile | null => {
    const z = map.zones[zone];
    if (!z) return null;
    for (let tries = 0; tries < 40; tries++) {
      const t = { x: z[0] + rng.int(0, z[2] - 1), y: z[1] + rng.int(0, z[3] - 1) };
      if (grid.isSolid(t.x, t.y) || reserved.has(key(t)) || taken.has(key(t))) continue;
      taken.add(key(t));
      return t;
    }
    return null;
  };

  const size = crowdSize(p);
  const out: Wanderer[] = [];
  const keeperSheets = new Set(map.keepers.map((k) => k.sprite));
  const sheets = OVERWORLD.trainers.filter((s) => !keeperSheets.has(s));
  const species = crowdSpecies(p);
  for (let i = 0; i < size.pokemon && species.length; i++) {
    const speciesId = species[rng.int(0, species.length - 1)]!;
    const zone = MON_ZONES[rng.int(0, MON_ZONES.length - 1)]!;
    const start = spotIn(zone);
    if (!start) continue;
    out.push({ id: `mon-${i}`, kind: 'pokemon', sheet: followerKey(speciesId)!, speciesId, zone, start, facing: facings[rng.int(0, 3)]! });
  }
  for (let i = 0; i < size.trainers && sheets.length; i++) {
    const sheet = sheets.splice(rng.int(0, sheets.length - 1), 1)[0]!;
    const zone = TRAINER_ZONES[rng.int(0, TRAINER_ZONES.length - 1)]!;
    const start = spotIn(zone);
    if (!start) continue;
    out.push({ id: `trainer-${i}`, kind: 'trainer', sheet, zone, start, facing: facings[rng.int(0, 3)]! });
  }
  return out;
}
