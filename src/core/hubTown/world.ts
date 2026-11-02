// Hub Town rules (spec 2026-11-01 §4, §6, §9): where you can walk, what is in front of you, which Pokémon you walk as.
// Pure: no Phaser, no gameplay RNG. The screen (ui/hubTown) asks these questions every step.

import type { Profile } from '../state';
import { HUB_TOWN, OVERWORLD, type Facing, type HubPlace, type HubTownData } from './schema';

export const STEP: Record<Facing, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export interface Tile {
  x: number;
  y: number;
}

/** The walkable grid of a town map: solid tiles, the map edge, and people standing in the way. */
export class WalkGrid {
  readonly width: number;
  readonly height: number;
  private readonly blocked: Uint8Array;
  private readonly occupied = new Map<number, string>();

  constructor(readonly map: HubTownData = HUB_TOWN) {
    [this.width, this.height] = map.size;
    this.blocked = new Uint8Array(this.width * this.height);
    for (const [x, y] of map.solid) if (this.inside(x, y)) this.blocked[y * this.width + x] = 1;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Solid scenery or the map edge (people are not counted). */
  isSolid(x: number, y: number): boolean {
    return !this.inside(x, y) || this.blocked[y * this.width + x] === 1;
  }

  /** Who stands on a tile (an id), if anyone. */
  occupant(x: number, y: number): string | undefined {
    return this.occupied.get(y * this.width + x);
  }

  /** Move a person's claim from one tile to another (or set it when `from` is null). */
  claim(id: string, to: Tile, from: Tile | null = null): void {
    if (from && this.occupied.get(from.y * this.width + from.x) === id) this.occupied.delete(from.y * this.width + from.x);
    this.occupied.set(to.y * this.width + to.x, id);
  }

  release(id: string, at: Tile): void {
    if (this.occupied.get(at.y * this.width + at.x) === id) this.occupied.delete(at.y * this.width + at.x);
  }

  /** Whether `who` may step onto a tile: not solid and nobody else there. */
  canEnter(x: number, y: number, who?: string): boolean {
    if (this.isSolid(x, y)) return false;
    const there = this.occupant(x, y);
    return there === undefined || there === who;
  }
}

export function ahead(at: Tile, facing: Facing): Tile {
  return { x: at.x + STEP[facing].dx, y: at.y + STEP[facing].dy };
}

/** The building door or sign right in front of you (you face it from an adjacent tile). */
export function placeAhead(at: Tile, facing: Facing, map: HubTownData = HUB_TOWN): HubPlace | null {
  const t = ahead(at, facing);
  return map.places.find((p) => p.kind !== 'gate' && p.door.x === t.x && p.door.y === t.y) ?? null;
}

/** A gateway you are standing in (stepping onto it asks whether to go through). */
export function gateAt(at: Tile, map: HubTownData = HUB_TOWN): HubPlace | null {
  return map.places.find((p) => p.kind === 'gate' && p.door.x === at.x && p.door.y === at.y) ?? null;
}

export function placeById(id: string, map: HubTownData = HUB_TOWN): HubPlace | null {
  return map.places.find((p) => p.id === id) ?? null;
}

/** Four-way facing from a key or a step; diagonals keep the horizontal part (the town is four-directional). */
export function facingOf(dx: number, dy: number): Facing | null {
  if (dx < 0) return 'left';
  if (dx > 0) return 'right';
  if (dy < 0) return 'up';
  if (dy > 0) return 'down';
  return null;
}

// ---------- the Pokémon you walk as ----------

/** The species you used most: most battles, then most caught, then most seen, then the lowest id (stable). */
export function mostUsedSpecies(p: Pick<Profile, 'mastery'>): string | null {
  let best: { id: string; key: [number, number, number] } | null = null;
  for (const [id, m] of Object.entries(p.mastery)) {
    const key: [number, number, number] = [m.battles, m.caught, m.seen];
    if (key[0] + key[1] + key[2] === 0) continue;
    if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && (key[2] > best.key[2] || (key[2] === best.key[2] && id < best.id))))))
      best = { id, key };
  }
  return best?.id ?? null;
}

const SPECIAL_FOLLOWERS: Record<string, string> = { 'nidoran-f': 'NIDORANfE', 'nidoran-m': 'NIDORANmA' };

/** The follower sheet for a species: its own, else its base form's, else null (the screen then uses Pikachu). */
export function followerKey(speciesId: string, available: Record<string, number> = OVERWORLD.followers): string | null {
  const special = SPECIAL_FOLLOWERS[speciesId];
  if (special && available[special]) return special;
  const parts = speciesId.toUpperCase().replace(/[^A-Z0-9-]/g, '').split('-');
  for (let n = parts.length; n >= 1; n--) {
    const key = parts.slice(0, n).join('');
    if (available[key]) return key;
  }
  return null;
}

export const FALLBACK_FOLLOWER = 'PIKACHU';

/**
 * The Pokémon you walk Hub Town as: the one you chose (profile.hubTown.pokemon), else your most-used one, else Pikachu.
 * Choosing never touches your party or any run.
 */
export function hubPokemon(p: Pick<Profile, 'mastery' | 'hubTown'>): { speciesId: string | null; follower: string } {
  const chosen = p.hubTown?.pokemon ?? null;
  for (const id of [chosen, mostUsedSpecies(p)]) {
    if (!id) continue;
    const key = followerKey(id);
    if (key) return { speciesId: id, follower: key };
  }
  return { speciesId: null, follower: FALLBACK_FOLLOWER };
}

/** Species you may walk as: any you have caught at least once (with overworld art). */
export function hubPokemonChoices(p: Pick<Profile, 'mastery'>): string[] {
  return Object.entries(p.mastery)
    .filter(([id, m]) => m.caught > 0 && followerKey(id) !== null)
    .sort((a, b) => b[1].battles - a[1].battles || b[1].caught - a[1].caught || (a[0] < b[0] ? -1 : 1))
    .map(([id]) => id);
}

/** Choose (or clear with null) the Pokémon you walk as. Returns a new profile; an unknown or uncaught species is refused. */
export function chooseHubPokemon<P extends Pick<Profile, 'mastery' | 'hubTown'>>(p: P, speciesId: string | null): P {
  if (speciesId !== null && !hubPokemonChoices(p).includes(speciesId)) return p;
  return { ...p, hubTown: { ...p.hubTown, pokemon: speciesId } };
}

// ---------- the trainers you see in town ----------

/** Named trainers with their own overworld sheet (archetype id prefix → sheet). */
const NAMED_SHEETS: [string, string][] = [
  ['red', 'trainer_POKEMONTRAINER_Red'], ['leaf', 'trainer_POKEMONTRAINER_Leaf'], ['blue', 'blue_overworld'], ['brendan', 'brendan_walk'],
  ['nemona', 'nemona'], ['steven', 'steve'], ['zinnia', 'Zinnia'], ['gladion', '003_Gladion'], ['lusamine', '022_Lusamine'], ['sonia', 'NPC_Sonia'],
];
/** Trainer classes by a word in the archetype id or name. */
const CLASS_SHEETS: [RegExp, string][] = [
  [/hiker/i, 'trHiker'], [/fisher/i, 'trFisher'], [/swimmer/i, 'trSwimmer_M'], [/scientist|researcher|professor|oak/i, 'trScientist_F'],
  [/black.?belt|karate|chuck|bruno|brawly|maylene/i, 'NPC_008_Black_Belt'], [/battle.?girl/i, 'NPC_009_Battle_Girl'], [/dancer/i, 'trDancer'],
  [/gentleman/i, 'trGentleman'], [/lass/i, 'LASS'], [/youngster/i, 'YOUNGSTER'], [/ace/i, '071_Ace_Trainer_Male'], [/backpacker/i, 'trBackpacker_F'],
  [/parasol|lady/i, 'trParasolLady'], [/school/i, 'trSchoolKid_F'], [/waitress/i, 'trWaitress'], [/kimono|furisode/i, 'trFurisodeGirl_Kali'],
];
/** Everyone else gets one of these, the same one every time (a hash of the id). */
const GENERIC_SHEETS = ['071_Ace_Trainer_Male', '072_Ace_Trainer_Female', 'boy_run', 'girl_run', 'Emma', 'Jane', 'Einer', 'Mia_walk', 'Raya_walk', 'trchar150', 'trchar154', 'NPC40', 'NPC_074', 'NPC_11'];

function stableIndex(text: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}

/** The overworld sheet for a trainer (archetype): its own if it has one, else its class, else a stable generic one. */
export function trainerSheet(archetypeId: string, name = '', available: readonly string[] = OVERWORLD.trainers): string {
  const has = (s: string) => available.includes(s);
  const named = NAMED_SHEETS.find(([id]) => archetypeId === id || archetypeId.startsWith(`${id}-`));
  if (named && has(named[1])) return named[1];
  const byClass = CLASS_SHEETS.find(([re, s]) => (re.test(archetypeId) || re.test(name)) && has(s));
  if (byClass) return byClass[1];
  const pool = GENERIC_SHEETS.filter(has);
  return pool.length ? pool[stableIndex(archetypeId, pool.length)]! : available[0]!;
}
