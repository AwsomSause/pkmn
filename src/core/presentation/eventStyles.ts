// Map-event screen styles (run events redesign, Kice 2026-11-02): the player picks how an event
// is presented in Settings. Presentation only; the outcome never depends on the style.
// Dependency-free so the settings schema can import it.

/** Every style id the settings save accepts (all eight Kice picked). */
export const EVENT_STYLE_IDS = ['diorama', 'storybook', 'novel', 'cards', 'comic', 'cinematic', 'cyber', 'wii'] as const;
export type EventStyleId = (typeof EVENT_STYLE_IDS)[number];

export const EVENT_STYLE_LABELS: Record<EventStyleId, string> = {
  diorama: 'Diorama',
  storybook: 'Storybook',
  novel: 'Visual Novel',
  cards: 'Card Draw',
  comic: 'Comic Panels',
  cinematic: 'Cinematic',
  cyber: 'Cyber HUD',
  wii: 'Wii Channel',
};

/** The styles that are built and can be picked in Settings, in cycle order. Others fall back to Diorama. */
export const EVENT_STYLES_READY: readonly EventStyleId[] = EVENT_STYLE_IDS;

/** The style an event screen draws with: the saved choice when it is built, else Diorama. */
export function eventStyleOf(saved: string | undefined): EventStyleId {
  return EVENT_STYLES_READY.includes(saved as EventStyleId) ? (saved as EventStyleId) : 'diorama';
}

/** The next built style after this one (Settings cycles through them). */
export function nextEventStyle(current: EventStyleId): EventStyleId {
  const i = EVENT_STYLES_READY.indexOf(current);
  return EVENT_STYLES_READY[(i + 1) % EVENT_STYLES_READY.length]!;
}

/** What kind of option a choice is, for its colour and tag on every style. */
export type ChoiceKind = 'battle' | 'trade' | 'chance' | 'cost' | 'safe';

export const CHOICE_KIND_LABEL: Record<ChoiceKind, string> = { battle: 'BATTLE', trade: 'TRADE', chance: 'CHANCE', cost: 'COST', safe: 'SAFE' };

// ---------- event backdrops (Pokemon Memories battlebacks) ----------

type Time = 'day' | 'eve' | 'night';
/** Each backdrop and the times of day it has art for. */
export const EVENT_BACKDROPS = {
  field: ['day', 'eve', 'night'],
  forest: ['day', 'eve', 'night'],
  city: ['day', 'eve', 'night'],
  rocky: ['day', 'eve', 'night'],
  water: ['day', 'eve', 'night'],
  sand: ['day', 'night'],
  snow: ['eve', 'night'],
  mountain: ['day'],
  grotto: ['day'],
  cave: ['day'],
  ruins: ['day'],
  indoor: ['day'],
} as const satisfies Record<string, readonly Time[]>;
export type EventBackdrop = keyof typeof EVENT_BACKDROPS;

const TYPE_BACKDROP: Record<string, EventBackdrop> = {
  normal: 'field', grass: 'forest', bug: 'forest', fire: 'mountain', water: 'water', ice: 'snow', electric: 'city', steel: 'city', poison: 'grotto',
  ground: 'sand', rock: 'rocky', fighting: 'rocky', flying: 'field', psychic: 'ruins', ghost: 'forest', dark: 'city', dragon: 'mountain', fairy: 'forest',
};
/** Types whose places are always shown at night. */
const NIGHT_TYPES = new Set(['ghost', 'dark']);
/** Event groups with a place (and maybe an hour) of their own. */
const GROUP_BACKDROP: Record<string, { bg: EventBackdrop; time?: Time }> = {
  'Roaming Legendaries': { bg: 'rocky', time: 'night' },
  'Legendary Beasts Chase': { bg: 'rocky', time: 'night' },
  'Legendary Route': { bg: 'mountain' },
  'Tower of Legends': { bg: 'ruins' },
  'Haunted Detour': { bg: 'forest', time: 'night' },
  'Spooky Mode': { bg: 'forest', time: 'night' },
  'Campfire Tales': { bg: 'forest', time: 'night' },
  'Mystery Dungeon': { bg: 'cave' },
  'Secret Paths': { bg: 'grotto' },
  'Hidden Paths': { bg: 'grotto' },
  'Wild Pokémon scenes': { bg: 'forest' },
  'Tricksters, villains and teams': { bg: 'city', time: 'eve' },
  'Merchants and deals': { bg: 'city' },
  'Plasma Operation': { bg: 'city', time: 'night' },
};

/**
 * The backdrop file for an event ("forest_night"): its group's place if it has one, else the stage
 * type's place, at the run's hour (morning/afternoon = day). Missing hours fall to the nearest one drawn.
 */
export function eventBackdrop(stageTypes: readonly string[], group: string, period: 'morning' | 'afternoon' | 'evening' | 'night'): string {
  const byGroup = GROUP_BACKDROP[group];
  const type = stageTypes[0] ?? 'normal';
  const bg = byGroup?.bg ?? TYPE_BACKDROP[type] ?? 'field';
  const want: Time = byGroup?.time ?? (NIGHT_TYPES.has(type) ? 'night' : period === 'evening' ? 'eve' : period === 'night' ? 'night' : 'day');
  const times: readonly Time[] = EVENT_BACKDROPS[bg];
  const time = times.includes(want) ? want : want === 'day' ? times[0]! : times[times.length - 1]!;
  return time === 'day' ? bg : `${bg}_${time}`;
}
