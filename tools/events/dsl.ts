// A small vocabulary for writing map events compactly (tools/build-events.ts
// turns the lists in tools/events/*.ts into src/data/events.json).

export type Json = Record<string, unknown>;

export interface EventOpts {
  stop?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  types?: string[];
  minStage?: number;
  requires?: Json[];
  keyItem?: string;
  cast?: string[];
  pokemon?: string;
  tint?: string;
  effect?: string;
  /** Only in runs started while this game event (gameEvents.json) is on. */
  gameEvent?: string;
}

export function ev(id: string, name: string, group: string, o: EventOpts, intro: string, choices: Json[]): Json {
  const { cast = [], pokemon, tint, effect = 'none', ...rest } = o;
  return { id, name, group, ...rest, scene: { cast, ...(pokemon ? { pokemon } : {}), ...(tint ? { tint } : {}), effect }, intro, choices };
}

/** A choice. `fail` is required with a check or chance. */
export function ch(label: string, success: Json, o: { requires?: Json[]; check?: string; chance?: number; fail?: Json } = {}): Json {
  return { label, ...(o.requires ? { requires: o.requires } : {}), ...(o.check ? { check: o.check } : {}), ...(o.chance !== undefined ? { chance: o.chance } : {}), success, ...(o.fail ? { failure: o.fail } : {}) };
}

export const out = (text: string, ...effects: Json[]): Json => ({ text, effects });
export const fight = (text: string, battle: Json, ...effects: Json[]): Json => ({ text, effects, battle });
export const leave = (text = 'You leave it be and walk on.'): Json => out(text);

// ---------- effects ----------
export const $ = (amount: number): Json => ({ kind: 'money', amount });
export const item = (id: string, count = 1): Json => ({ kind: 'item', id, count });
export const any = (...ids: string[]): Json => ({ kind: 'itemFrom', ids });
export const lose = (id?: string): Json => ({ kind: 'loseItem', ...(id ? { id } : {}) });
/** A trade: the lowest-level party Pokémon fitting `want` leaves (put before the `join` that replaces it). */
export const trade = (label: string, want: { species?: string[]; type?: string; tag?: string; stage?: number; minWeight?: number; maxWeight?: number; generation?: number; minLevel?: number; eggGroup?: string; color?: string } = {}): Json => ({ kind: 'tradeAway', want: { label, ...want } });
export const heal = (share = 1): Json => ({ kind: 'heal', share });
export const hurt = (share: number): Json => ({ kind: 'damage', share });
export const cure = (): Json => ({ kind: 'cure' });
export const status = (s: 'poison' | 'burn' | 'paralysis' | 'sleep'): Json => ({ kind: 'status', status: s });
export const fr = (amount: number, who: 'lead' | 'party' = 'party'): Json => ({ kind: 'friendship', amount, who });
export const attr = (key: string, amount: number): Json => ({ kind: 'attribute', key, amount });
export const good = (n: number): Json => attr('goodEvil', n);
export const evil = (n: number): Json => attr('goodEvil', -n);
export const rage = (n: number): Json => attr('ragePeace', n);
export const peace = (n: number): Json => attr('ragePeace', -n);
export const rp = (amount: number): Json => ({ kind: 'research', amount });
export const lv = (amount: number, who: 'lead' | 'party' = 'lead'): Json => ({ kind: 'levels', amount, who });
export const join = (o: { species?: string[]; types?: string[]; lv?: number; shiny?: number; shadow?: boolean } = {}): Json => ({
  kind: 'join',
  shadow: o.shadow ?? false,
  species: o.species ?? [],
  types: o.types ?? [],
  levelBonus: o.lv ?? 0,
  shinyMultiplier: o.shiny ?? 1,
});
export const egg = (o: { species?: string[]; types?: string[]; lv?: number; shiny?: number; left?: number; unit?: 'battle' | 'stage' } = {}): Json => ({
  kind: 'egg',
  species: o.species ?? [],
  types: o.types ?? [],
  levelBonus: o.lv ?? 0,
  shinyMultiplier: o.shiny ?? 1,
  left: o.left ?? 3,
  unit: o.unit ?? 'battle',
});
export const eggMove = (): Json => ({ kind: 'eggMove' });
export const better = (extra = 0): Json => ({ kind: 'betterDraft', extra });
export const gym = (): Json => ({ kind: 'gymPreview' });
export const flag = (key: string, amount = 1): Json => ({ kind: 'flag', key, amount });
export const reveal = (): Json => ({ kind: 'revealStops' });

// ---------- battles ----------
export const wild = (o: { species?: string[]; types?: string[]; lv?: number; shiny?: number; win?: Json[]; recall?: boolean } = {}): Json => ({
  kind: 'wild',
  ...(o.recall ? { recall: true } : {}),
  species: o.species ?? [],
  types: o.types ?? [],
  levelBonus: o.lv ?? 0,
  shinyMultiplier: o.shiny ?? 1,
  win: o.win ?? [],
});
export const trainer = (name: string, o: { cls?: string; boss?: string; size?: number; types?: string[]; lv?: number; win?: Json[]; ghost?: boolean; retired?: boolean; ally?: string } = {}): Json => ({
  kind: 'trainer',
  name,
  ...(o.cls ? { classId: o.cls } : {}),
  ...(o.boss ? { bossId: o.boss } : {}),
  ...(o.ghost ? { ghost: true } : {}),
  ...(o.retired ? { retired: true } : {}),
  ...(o.ally ? { ally: o.ally } : {}),
  size: o.size ?? 2,
  types: o.types ?? [],
  levelBonus: o.lv ?? 0,
  win: o.win ?? [],
});

// ---------- conditions ----------
export const money = (atLeast: number): Json => ({ kind: 'money', atLeast });
export const party = (atLeast: number): Json => ({ kind: 'partySize', atLeast });
export const att = (key: string, atLeast: number): Json => ({ kind: 'attribute', key, atLeast });
export const isGood = (atLeast: number): Json => ({ kind: 'meter', key: 'goodEvil', side: 'positive', atLeast });
export const isEvil = (atLeast: number): Json => ({ kind: 'meter', key: 'goodEvil', side: 'negative', atLeast });
export const isRage = (atLeast: number): Json => ({ kind: 'meter', key: 'ragePeace', side: 'positive', atLeast });
export const isPeace = (atLeast: number): Json => ({ kind: 'meter', key: 'ragePeace', side: 'negative', atLeast });
export const has = (id: string): Json => ({ kind: 'item', id });
export const feels = (id: string): Json => ({ kind: 'emotion', id });
export const ptype = (type: string): Json => ({ kind: 'partyType', type });
/** Aggressive choices N (tag "pacifist") won't make. */
export const fierce: Json = { kind: 'noTrainerTag', tag: 'pacifist' };

// ---------- item groups ----------
export const HEALING = ['potion', 'super-potion', 'hyper-potion', 'full-heal', 'revive'];
export const BALLS = ['poke-ball', 'great-ball', 'ultra-ball'];
export const VITAMINS = ['protein', 'calcium', 'carbos', 'hp-up', 'iron', 'zinc'];
export const STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone', 'dusk-stone', 'dawn-stone', 'shiny-stone', 'ice-stone'];
export const TREASURE = ['nugget', 'big-pearl', 'pearl', 'star-piece', 'stardust', 'comet-shard', 'relic-gold', 'rare-bone', 'big-mushroom'];
export const HELD = ['leftovers', 'focus-sash', 'life-orb', 'choice-band', 'lucky-punch', 'macho-brace', 'smoke-ball'];
export const BERRIES = ['oran-berry', 'sitrus-berry', 'lum-berry'];
export const FOSSILS = ['old-amber', 'helix-fossil', 'dome-fossil'];

// ---------- map changes ----------
export const stopHere = (stop: 'heal' | 'shop' | 'fish'): Json => ({ kind: 'addStop', stop });
export const ferry = (): Json => ({ kind: 'skipAhead' });
export const RARE_HELD = ['leftovers', 'focus-sash', 'choice-band', 'choice-specs', 'choice-scarf', 'life-orb', 'eviolite', 'rocky-helmet'];
export const TYPE_ITEMS = ['silk-scarf', 'black-belt', 'sharp-beak', 'soft-sand', 'hard-stone', 'spell-tag', 'metal-coat', 'charcoal', 'mystic-water', 'miracle-seed', 'magnet', 'dragon-fang'];
export const SNACKS = ['fresh-water', 'soda-pop', 'lemonade', 'moomoo-milk', 'lava-cookie', 'old-gateau', 'casteliacone', 'sweet-heart'];
