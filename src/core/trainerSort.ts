// Sorting for trainer lists (Trainer Select, Trainer Archive). Pure: no Phaser, no RNG.
// Game and region are not stored on the trainer data; they come from the table below
// (a trainer that is not listed counts as "Other"; the Masters EX trainers with no home region sit in Pasio). Trainer Evolutions follow their base trainer.

import type { Archetype } from './contentSchema';
import type { Profile } from './state';
import { trainerStatus, type TrainerStatus } from './progress';

export const TRAINER_SORT_KEYS = ['default', 'game', 'region', 'name', 'obtainment', 'tier', 'owned', 'recent'] as const;
export type TrainerSortKey = (typeof TRAINER_SORT_KEYS)[number];

export const TRAINER_SORT_LABELS: Record<TrainerSortKey, string> = {
  default: 'Default',
  game: 'Game',
  region: 'Region',
  name: 'Name (A–Z)',
  obtainment: 'How obtained',
  tier: 'Unlock tier',
  owned: 'Owned first',
  recent: 'Recently unlocked',
};

/** Games in release order (also the sort order). */
export const GAMES = ['Red/Blue/Yellow', 'Gold/Silver/Crystal', 'Ruby/Sapphire/Emerald', 'FireRed/LeafGreen', 'Diamond/Pearl/Platinum', 'Black/White', 'Black 2/White 2', 'X/Y', 'Omega Ruby/Alpha Sapphire', 'Sun/Moon', 'Ultra Sun/Ultra Moon', "Let's Go Pikachu/Eevee", 'Sword/Shield', 'Legends: Arceus', 'Scarlet/Violet', 'Legends: Z-A', 'Masters EX', 'Anime', 'Other'] as const;
export type Game = (typeof GAMES)[number];

/** Regions in the usual order. */
export const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Hisui', 'Paldea', 'Pasio', 'Other'] as const;
export type Region = (typeof REGIONS)[number];

const G: Record<string, Game> = { rby: 'Red/Blue/Yellow', gsc: 'Gold/Silver/Crystal', rse: 'Ruby/Sapphire/Emerald', frlg: 'FireRed/LeafGreen', dppt: 'Diamond/Pearl/Platinum', bw: 'Black/White', b2: 'Black 2/White 2', xy: 'X/Y', oras: 'Omega Ruby/Alpha Sapphire', sm: 'Sun/Moon', usum: 'Ultra Sun/Ultra Moon', lgpe: "Let's Go Pikachu/Eevee", ss: 'Sword/Shield', la: 'Legends: Arceus', sv: 'Scarlet/Violet', za: 'Legends: Z-A', ms: 'Masters EX', an: 'Anime', ot: 'Other' };
const R: Record<string, Region> = { k: 'Kanto', j: 'Johto', h: 'Hoenn', s: 'Sinnoh', u: 'Unova', x: 'Kalos', a: 'Alola', g: 'Galar', i: 'Hisui', p: 'Paldea', m: 'Pasio', o: 'Other' };

/** "game region" codes per trainer id. */
const ORIGINS: Record<string, string> = {
  red: 'rby k', blue: 'rby k', green: 'rby k', brock: 'rby k', misty: 'rby k', giovanni: 'rby k', oak: 'rby k', bill: 'rby k', blaine: 'rby k', 'blue-classic': 'rby k', 'brock-classic': 'rby k', bruno: 'rby k', erika: 'rby k', 'green-classic': 'rby k', koga: 'rby k', 'lt-surge': 'rby k', 'misty-classic': 'rby k', 'oak-classic': 'rby k', 'red-classic': 'rby k', sabrina: 'rby k', 'team-rocket': 'rby k', yellow: 'rby k', lorelei: 'rby k', agatha: 'rby k',
  'agatha-lgpe': 'lgpe k', 'blaine-lgpe': 'lgpe k', 'koga-lgpe': 'lgpe k', 'sabrina-lgpe': 'lgpe k', 'lorelei-lgpe': 'lgpe k',
  'blue-gen-3-champion': 'frlg k', 'bruno-gen-3': 'frlg k', 'erika-gen-3': 'frlg k', 'mr-fuji-gen-3': 'frlg k', 'leaf-gen-3': 'frlg k',
  'blue-gen-7': 'sm k', 'red-masters': 'ms k', 'brock-masters': 'ms k',
  bugsy: 'gsc j', chuck: 'gsc j', clair: 'gsc j', elm: 'gsc j', ethan: 'gsc j', eusine: 'gsc j', falkner: 'gsc j', janine: 'gsc j', jasmine: 'gsc j', karen: 'gsc j', kris: 'gsc j', kurt: 'gsc j', lance: 'gsc j', lyra: 'gsc j', morty: 'gsc j', pryce: 'gsc j', silver: 'gsc j', whitney: 'gsc j', 'spr-hgss-ethan': 'gsc j', 'spr-hgss-silver': 'gsc j',
  'brendan-emerald': 'rse h', 'brendan-ruby-sapphire': 'rse h', 'may-emerald': 'rse h', 'may-ruby-sapphire': 'rse h', 'drake-gen-3': 'rse h', flannery: 'rse h', glacia: 'rse h', juan: 'rse h', matt: 'rse h', noland: 'rse h', norman: 'rse h', phoebe: 'rse h', shelly: 'rse h', sidney: 'rse h', tabitha: 'rse h', wally: 'rse h', wattson: 'rse h',
  'archie-gen-6': 'oras h', 'brawly-gen-6': 'oras h', drasna: 'oras h', 'tate-liza-gen-6': 'oras h', 'wallace-gen-6': 'oras h', 'winona-gen-6': 'oras h', 'steven-gen-6': 'oras h', 'phoebe-gen-6': 'oras h', 'roxanne-gen-6': 'oras h', 'maxie-gen-6': 'oras h', lisia: 'oras h', zinnia: 'oras h',
  'anabel-gen-7': 'sm h', 'archie-usum': 'usum h',
  cynthia: 'dppt s', aaron: 'dppt s', barry: 'dppt s', byron: 'dppt s', cheryl: 'dppt s', 'crasher-wake': 'dppt s', cyrus: 'dppt s', 'dawn-gen-4-platinum': 'dppt s', dawn: 'dppt s', fantina: 'dppt s', flint: 'dppt s', gardenia: 'dppt s', ginter: 'dppt s', 'lucas-gen-4-platinum': 'dppt s', lucas: 'dppt s', maylene: 'dppt s', palmer: 'dppt s', riley: 'dppt s', rowan: 'dppt s', volkner: 'dppt s', 'spr-pt-barry': 'dppt s', 'spr-pt-dawn': 'dppt s', 'spr-pt-looker': 'dppt s', 'spr-pt-lucas': 'dppt s',
  'cynthia-gen-7': 'sm s', 'cynthia-masters': 'ms s', 'cynthia-masters-4': 'ms s',
  n: 'bw u', 'n-classic': 'bw u', alder: 'bw u', caitlin: 'bw u', cheren: 'bw u', chili: 'bw u', cilan: 'bw u', clay: 'bw u', colress: 'bw u', cress: 'bw u', drayden: 'bw u', emmet: 'bw u', ghetsis: 'bw u', hilbert: 'bw u', hilda: 'bw u', juniper: 'bw u', rosa: 'bw u', skyla: 'bw u', ingo: 'bw u', marlon: 'ms u',
  'bianca-pwt': 'b2 u', 'elesa-gen-5-bw2': 'b2 u', 'iris-gen-5-bw2': 'b2 u', hugh: 'b2 u', nate: 'b2 u', benga: 'b2 u', 'roxie-masters': 'ms u',
  az: 'xy x', calem: 'xy x', clemont: 'xy x', diantha: 'xy x', korrina: 'xy x', lysandre: 'xy x', olympia: 'xy x', serena: 'xy x', shauna: 'xy x', sycamore: 'xy x', tierno: 'xy x', valerie: 'xy x', wulfric: 'xy x', grant: 'xy x',
  acerola: 'sm a', 'elio-usum': 'usum a', hala: 'sm a', hapu: 'sm a', 'hau-stance': 'sm a', ilima: 'sm a', kahili: 'sm a', kiawe: 'sm a', kukui: 'sm a', lana: 'sm a', 'lusamine-nihilego': 'sm a', mallow: 'sm a', mina: 'sm a', molayne: 'sm a', nanu: 'sm a', olivia: 'sm a', plumeria: 'sm a', selene: 'sm a', sophocles: 'sm a', wicke: 'sm a', guzma: 'sm a', 'gladion-stance': 'sm a', 'lillie-z': 'sm a', 'grimsley-gen-7': 'sm u', 'lusamine-masters': 'ms a', 'gladion-masters-2': 'ms a',
  allister: 'ss g', bea: 'ss g', bede: 'ss g', 'gloria-league': 'ss g', hop: 'ss g', kabu: 'ss g', klara: 'ss g', melony: 'ss g', milo: 'ss g', nessa: 'ss g', opal: 'ss g', peonia: 'ss g', peony: 'ss g', piers: 'ss g', raihan: 'ss g', sonia: 'ss g', 'sordward-shielbert': 'ss g', 'leon-masters': 'ms g', 'marnie-masters-4': 'ms g',
  adaman: 'la i', arezu: 'la i', cogita: 'la i', rei: 'la i', volo: 'la i', irida: 'la i',
  'ball-guy': 'sv p', brassius: 'sv p', canari: 'sv p', carmine: 'sv p', geeta: 'sv p', giacomo: 'sv p', grusha: 'sv p', iono: 'sv p', katy: 'sv p', 'nemona-v': 'sv p', ortega: 'sv p',
  'the-royal': 'sm a', 'hex-maniac': 'xy x', thorton: 'dppt s', brigette: 'dppt s', grace: 'xy x', harmony: 'ms m', jacinthe: 'za x', magnus: 'ms m', marley: 'dppt s', ryuki: 'ss g',
  alain: 'an x', 'ash-kalos': 'an x', ash: 'an k', 'todd-snap': 'an k', trace: 'an k', trevor: 'an k',
};

/** Ordinary NPC trainers (ids `npc-...`) are the classic Kanto classes. */
const originOf = (id: string): string | undefined => ORIGINS[id] ?? (id.startsWith('npc-') ? 'rby k' : undefined);

export function trainerGame(a: Archetype, byId: (id: string) => Archetype | undefined = () => undefined): Game {
  const base = a.evolvedFrom ? byId(a.evolvedFrom) : undefined;
  const code = originOf((base ?? a).id);
  return code ? (G[code.split(' ')[0]!] ?? 'Other') : 'Other';
}

export function trainerRegion(a: Archetype, byId: (id: string) => Archetype | undefined = () => undefined): Region {
  const base = a.evolvedFrom ? byId(a.evolvedFrom) : undefined;
  const code = originOf((base ?? a).id);
  return code ? (R[code.split(' ')[1]!] ?? 'Other') : 'Other';
}

/** How a trainer joins the team: 0 starting, 1 unlock challenge, 2 Trainer Evolution, 3 later update. */
export function obtainmentRank(a: Archetype): number {
  if (a.evolvedFrom) return 2;
  if (a.unlockedByDefault) return 0;
  return a.available ? 1 : 3;
}

export const OBTAINMENT_LABELS = ['Starting trainer', 'Unlock challenge', 'Trainer Evolution', 'Coming later'] as const;

/** Unlock tier for sorting: starting trainers 0, tiers 1–5, evolutions 6. */
export function tierRank(a: Archetype): number {
  if (a.evolvedFrom) return 6;
  if (a.unlockedByDefault) return 0;
  return a.unlockTier ?? 7;
}

const STATUS_ORDER: Record<TrainerStatus, number> = { unlocked: 0, claimable: 1, locked: 2, comingLater: 3 };

/**
 * Returns the trainers in the chosen order. `base` is the data order (base trainer, then its evolutions).
 * The sort is stable: ties keep data order, so every key gives the same order every time.
 * `reverse` flips the result.
 */
export function sortTrainers(list: readonly Archetype[], key: TrainerSortKey, profile: Profile, reverse = false): Archetype[] {
  const byId = new Map(list.map((a) => [a.id, a]));
  const lookup = (id: string) => byId.get(id);
  const index = new Map(list.map((a, i) => [a.id, i]));
  const unlockedAt = (a: Archetype): number => {
    const i = profile.unlockedArchetypes.indexOf(a.id);
    return i >= 0 ? i : a.unlockedByDefault ? -1 : Number.MAX_SAFE_INTEGER;
  };
  const rank = (a: Archetype): number[] => {
    switch (key) {
      case 'game': return [GAMES.indexOf(trainerGame(a, lookup))];
      case 'region': return [REGIONS.indexOf(trainerRegion(a, lookup))];
      case 'obtainment': return [obtainmentRank(a)];
      case 'tier': return [tierRank(a)];
      case 'owned': return [STATUS_ORDER[trainerStatus(profile, a)]];
      case 'recent': return [trainerStatus(profile, a) === 'unlocked' ? 0 : 1, -unlockedAt(a)];
      default: return [];
    }
  };
  const sorted = [...list].sort((x, y) => {
    if (key === 'name') return x.name.localeCompare(y.name) || index.get(x.id)! - index.get(y.id)!;
    const rx = rank(x);
    const ry = rank(y);
    for (let i = 0; i < rx.length; i++) if (rx[i] !== ry[i]) return rx[i]! - ry[i]!;
    // Within a group, keep the game's own order, except that region/game groups read best alphabetically.
    if (key === 'game' || key === 'region') return x.name.localeCompare(y.name) || index.get(x.id)! - index.get(y.id)!;
    return index.get(x.id)! - index.get(y.id)!;
  });
  return reverse ? sorted.reverse() : sorted;
}
