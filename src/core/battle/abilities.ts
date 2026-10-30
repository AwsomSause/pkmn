// What each ability does in battle (M8.75 part C3). The battle engine reads
// these tables; this file only holds the data and the support status.
//
// Every ability has an explicit status (CLAUDE.md §4):
//   supported - the engine runs it (tests/unit/abilities.test.ts)
//   noEffect  - it only matters for things this game doesn't have (held
//               items, genders, double battles, wild-encounter rates), so it
//               correctly does nothing
//   pending   - not built yet: a Pokémon can have it, but it does nothing
//               until it is built (the list is in CHECKLIST.md, part C3)

import type { BoostStat, StatusId, Terrain, TypeName, Weather } from '../contentSchema';

export type AbilityStatus = 'supported' | 'noEffect' | 'pending';

/** Overgrow, Blaze, Torrent, Swarm: moves of this type ×1.5 at 1/3 HP or less. */
export const PINCH: Record<string, TypeName> = { overgrow: 'grass', blaze: 'fire', torrent: 'water', swarm: 'bug' };

/** Weather set when the Pokémon comes in. */
export const WEATHER_SETTERS: Record<string, Weather> = { drizzle: 'rain', drought: 'sun', 'sand-stream': 'sand', 'snow-warning': 'snow' };

/** Terrain set when the Pokémon comes in. */
export const TERRAIN_SETTERS: Record<string, Terrain> = { 'electric-surge': 'electric', 'grassy-surge': 'grassy', 'misty-surge': 'misty', 'psychic-surge': 'psychic' };

/** Speed doubles in this weather. */
export const WEATHER_SPEED: Record<string, Weather[]> = { 'swift-swim': ['rain'], chlorophyll: ['sun'], 'sand-rush': ['sand'], 'slush-rush': ['snow', 'hail'] };

/** Evasion: moves against it are 0.8× as accurate in this weather. */
export const WEATHER_EVASION: Record<string, Weather[]> = { 'sand-veil': ['sand'], 'snow-cloak': ['snow', 'hail'] };

/** Not hurt by sandstorm or hail (Overcoat and Magic Guard by both). */
export const WEATHER_DAMAGE_IMMUNE: Record<string, Weather[]> = {
  overcoat: ['sand', 'hail'],
  'magic-guard': ['sand', 'hail'],
  'sand-veil': ['sand'],
  'sand-rush': ['sand'],
  'sand-force': ['sand'],
  'ice-body': ['hail'],
  'snow-cloak': ['hail'],
};

/**
 * Moves of a type that this ability takes instead of being hurt (status moves
 * too): it heals a fraction of its max HP, raises a stat, or (Flash Fire)
 * powers up its own Fire moves.
 */
export const ABSORB: Record<string, { type: TypeName; heal?: number; boost?: { stat: BoostStat; stages: number }; flashFire?: true }> = {
  'volt-absorb': { type: 'electric', heal: 1 / 4 },
  'water-absorb': { type: 'water', heal: 1 / 4 },
  'dry-skin': { type: 'water', heal: 1 / 4 },
  'earth-eater': { type: 'ground', heal: 1 / 4 },
  'flash-fire': { type: 'fire', flashFire: true },
  'lightning-rod': { type: 'electric', boost: { stat: 'spa', stages: 1 } },
  'storm-drain': { type: 'water', boost: { stat: 'spa', stages: 1 } },
  'sap-sipper': { type: 'grass', boost: { stat: 'atk', stages: 1 } },
  'motor-drive': { type: 'electric', boost: { stat: 'spe', stages: 1 } },
  'well-baked-body': { type: 'fire', boost: { stat: 'def', stages: 2 } },
};

/** Statuses it can't get. */
export const STATUS_IMMUNE: Record<string, StatusId[]> = {
  limber: ['par'],
  insomnia: ['slp'],
  'vital-spirit': ['slp'],
  'sweet-veil': ['slp'],
  immunity: ['psn'],
  'pastel-veil': ['psn'],
  'water-veil': ['brn'],
  'water-bubble': ['brn'],
  'thermal-exchange': ['brn'],
  'magma-armor': ['frz'],
  'purifying-salt': ['brn', 'psn', 'par', 'slp', 'frz'],
  comatose: ['brn', 'psn', 'par', 'slp', 'frz'],
};

/** Stat drops caused by the opponent that it ignores ('all' = every stat). */
export const DROP_GUARD: Record<string, BoostStat | 'all'> = {
  'clear-body': 'all',
  'white-smoke': 'all',
  'full-metal-body': 'all',
  'hyper-cutter': 'atk',
  'keen-eye': 'acc',
  'minds-eye': 'acc',
  'big-pecks': 'def',
};

/** Abilities that also stop Intimidate (Gen 8+). */
export const INTIMIDATE_GUARD = new Set(['inner-focus', 'own-tempo', 'oblivious', 'scrappy']);

/** Moves with this flag are this much stronger. */
export const FLAG_BOOST: Record<string, { flag: 'contact' | 'punch' | 'bite' | 'pulse' | 'sound' | 'slicing'; multiplier: number }> = {
  'tough-claws': { flag: 'contact', multiplier: 1.3 },
  'iron-fist': { flag: 'punch', multiplier: 1.2 },
  sharpness: { flag: 'slicing', multiplier: 1.5 },
  'strong-jaw': { flag: 'bite', multiplier: 1.5 },
  'mega-launcher': { flag: 'pulse', multiplier: 1.5 },
  'punk-rock': { flag: 'sound', multiplier: 1.3 },
};

/** Normal moves become this type and are 1.2× as strong. */
export const TYPE_CHANGE: Record<string, TypeName> = { pixilate: 'fairy', aerilate: 'flying', refrigerate: 'ice', galvanize: 'electric', dragonize: 'dragon' };

/** A contact move on it may give the attacker this status (30%). */
export const CONTACT_STATUS: Record<string, StatusId> = { static: 'par', 'flame-body': 'brn', 'poison-point': 'psn' };

/** A contact move on it hurts the attacker by 1/8 of the attacker's max HP. */
export const CONTACT_HURT = new Set(['rough-skin', 'iron-barbs']);

/** Ignore the target's abilities when attacking. */
export const MOLD_BREAKERS = new Set(['mold-breaker', 'teravolt', 'turboblaze']);

/** Raise a stat when its move knocks the target out. */
export const KO_BOOST: Record<string, BoostStat | 'best'> = { moxie: 'atk', 'chilling-neigh': 'atk', 'grim-neigh': 'spa', 'as-one-glastrier': 'atk', 'as-one-spectrier': 'spa', 'beast-boost': 'best' };

/** After being hit by a damaging move (and surviving): raise its stats. */
export const HIT_BOOST: Record<string, { types?: TypeName[]; physical?: true; changes: { stat: BoostStat; stages: number }[] }> = {
  justified: { types: ['dark'], changes: [{ stat: 'atk', stages: 1 }] },
  rattled: { types: ['bug', 'ghost', 'dark'], changes: [{ stat: 'spe', stages: 1 }] },
  'steam-engine': { types: ['fire', 'water'], changes: [{ stat: 'spe', stages: 6 }] },
  'water-compaction': { types: ['water'], changes: [{ stat: 'def', stages: 2 }] },
  'thermal-exchange': { types: ['fire'], changes: [{ stat: 'atk', stages: 1 }] },
  stamina: { changes: [{ stat: 'def', stages: 1 }] },
  'weak-armor': { physical: true, changes: [{ stat: 'def', stages: -1 }, { stat: 'spe', stages: 2 }] },
};

/** Moves of this type are 1.5× as strong. */
export const TYPE_BOOST: Record<string, TypeName> = { 'dragons-maw': 'dragon', 'rocky-payload': 'rock', steelworker: 'steel', transistor: 'electric', 'fire-mane': 'fire' };

/** Moves of this type are 4/3 as strong for everyone on the field (Aura Break flips it to 3/4). */
export const AURAS: Record<string, TypeName> = { 'dark-aura': 'dark', 'fairy-aura': 'fairy' };

/** Raise a stat when it comes in. */
export const ENTRY_BOOST: Record<string, BoostStat> = { 'intrepid-sword': 'atk', 'dauntless-shield': 'def' };

/** The foe's priority moves fail against these. */
export const PRIORITY_GUARD = new Set(['queenly-majesty', 'dazzling', 'armor-tail']);

/** Trace can't copy these; Mummy and Lingering Aroma don't overwrite them. */
export const UNTRACEABLE = new Set(['trace', 'stance-change', 'schooling', 'disguise', 'battle-bond', 'power-construct', 'rks-system', 'zen-mode', 'imposter', 'illusion', 'comatose', 'receiver', 'power-of-alchemy', 'neutralizing-gas', 'gulp-missile', 'hunger-switch', 'ice-face', 'zero-to-hero', 'tera-shift', 'terashell', 'teraform-zero', 'commander', 'as-one-glastrier', 'as-one-spectrier']);

/** A contact move on it gives the attacker this ability. */
export const SPREADS_ON_CONTACT = new Set(['mummy', 'lingering-aroma']);

/** Ruin abilities: every other Pokémon's stat is 0.75× while this one is out. */
export const RUINS: Record<string, 'atk' | 'def' | 'spa' | 'spd'> = { 'tablets-of-ruin': 'atk', 'sword-of-ruin': 'def', 'vessel-of-ruin': 'spa', 'beads-of-ruin': 'spd' };

/** The foe can't switch out (Ghost types are free): Shadow Tag all, Arena Trap grounded, Magnet Pull Steel. */
export const TRAPPERS = new Set(['shadow-tag', 'arena-trap', 'magnet-pull']);

/** After a damaging hit that drops it under half HP, it raises this stat once. */
export const HALF_HP_BOOST: Record<string, { stat: BoostStat; stages: number }> = { berserk: { stat: 'spa', stages: 1 }, 'anger-shell': { stat: 'atk', stages: 1 } };

/** Abilities the battle engine runs. */
const SUPPORTED = new Set<string>([
  ...Object.keys(PINCH),
  ...Object.keys(WEATHER_SETTERS),
  ...Object.keys(TERRAIN_SETTERS),
  ...Object.keys(WEATHER_SPEED),
  ...Object.keys(WEATHER_EVASION),
  ...Object.keys(WEATHER_DAMAGE_IMMUNE),
  ...Object.keys(ABSORB),
  ...Object.keys(STATUS_IMMUNE),
  ...Object.keys(DROP_GUARD),
  ...INTIMIDATE_GUARD,
  ...Object.keys(FLAG_BOOST),
  ...Object.keys(TYPE_CHANGE),
  ...Object.keys(CONTACT_STATUS),
  ...CONTACT_HURT,
  ...MOLD_BREAKERS,
  ...Object.keys(KO_BOOST),
  ...Object.keys(HIT_BOOST),
  ...Object.keys(TYPE_BOOST),
  ...Object.keys(AURAS),
  ...Object.keys(ENTRY_BOOST),
  ...PRIORITY_GUARD,
  ...SPREADS_ON_CONTACT,
  ...Object.keys(RUINS),
  ...TRAPPERS,
  ...Object.keys(HALF_HP_BOOST),
  'neutralizing-gas', 'eelevate', 'guard-dog', 'color-change', 'cursed-body', 'perish-body', 'cotton-down', 'toxic-debris',
<<<<<<< HEAD
  'piercing-drill', 'unseen-fist',
  'bulletproof', 'sharpness', 'wind-rider', 'wind-power', 'electromorphosis', 'desolate-land', 'primordial-sea', 'forecast', 'flower-gift',
  'mimicry', 'zen-mode', 'schooling', 'stance-change', 'power-construct', 'hunger-switch', 'battle-bond', 'disguise',
  'ice-face', 'gulp-missile', 'zero-to-hero', 'tera-shift', 'stakeout', 'stall', 'quick-draw', 'parental-bond', 'mirror-armor', 'opportunist',
  'soul-heart', 'imposter', 'gorilla-tactics', 'mycelium-might', 'mega-sol', 'protosynthesis', 'quark-drive', 'tera-shell', 'poison-puppeteer', 'innards-out', 'supreme-overlord', 'normalize', 'liquid-voice', 'moody', 'wandering-spirit', 'magic-bounce',
=======
  'piercing-drill', 'unseen-fist', 'supreme-overlord', 'normalize', 'liquid-voice', 'moody', 'wandering-spirit', 'magic-bounce',
>>>>>>> origin/claude/project-thread-h47l6h
  'cloud-nine', 'air-lock', 'trace', 'protean', 'libero', 'neuroforce', 'aura-break', 'good-as-gold', 'corrosion', 'tangled-feet', 'wonder-skin', 'spicy-spray', 'toxic-chain',
  'sand-spit', 'seed-sower', 'bad-dreams', 'grass-pelt', 'surge-surfer', 'hadron-engine', 'orichalcum-pulse',
  'intimidate', 'download', 'pressure', 'levitate', 'wonder-guard', 'soundproof',
  'thick-fat', 'heatproof', 'fluffy', 'ice-scales', 'filter', 'solid-rock', 'prism-armor', 'multiscale', 'shadow-shield',
  'marvel-scale', 'fur-coat', 'unaware', 'sturdy',
  'huge-power', 'pure-power', 'hustle', 'guts', 'defeatist', 'slow-start', 'solar-power', 'toxic-boost', 'flare-boost',
  'technician', 'adaptability', 'sniper', 'super-luck', 'battle-armor', 'shell-armor', 'merciless', 'tinted-lens', 'reckless',
  'sheer-force', 'analytic', 'compound-eyes', 'no-guard', 'victory-star', 'skill-link', 'serene-grace', 'shield-dust',
  'rock-head', 'magic-guard', 'liquid-ooze', 'stench', 'effect-spore', 'poison-touch', 'aftermath', 'gooey', 'tangling-hair',
  'long-reach', 'scrappy', 'simple', 'contrary', 'defiant', 'competitive', 'synchronize', 'leaf-guard', 'own-tempo',
  'inner-focus', 'steadfast', 'early-bird', 'truant', 'damp', 'quick-feet', 'prankster', 'gale-wings', 'triage',
  'speed-boost', 'rain-dish', 'ice-body', 'shed-skin', 'hydration', 'poison-heal', 'natural-cure', 'regenerator', 'anger-point',
]);

/**
 * Abilities that only affect things this game doesn't have: held items,
 * genders and attraction, double battles, running away, wild-encounter rates,
 * forced switching and the overworld.
 */
const NO_EFFECT = new Set<string>([
  'run-away', 'pickup', 'honey-gather', 'illuminate', 'ball-fetch', 'frisk', 'anticipation', 'forewarn', 'pickpocket',
  'magician', 'sticky-hold', 'klutz', 'unburden', 'gluttony', 'harvest', 'cheek-pouch', 'ripen', 'cud-chew', 'symbiosis',
  'healer', 'friend-guard', 'telepathy', 'plus', 'minus', 'battery', 'power-spot', 'steely-spirit', 'curious-medicine',
  'cute-charm', 'rivalry', 'suction-cups', 'unnerve', 'flower-veil', 'aroma-veil', 'receiver', 'power-of-alchemy',
  'costar', 'commander', 'dancer', 'stalwart', 'propeller-tail', 'hospitality', 'supersweet-syrup', 'emergency-exit', 'wimp-out',
  'heavy-metal', 'light-metal', 'infiltrator', 'screen-cleaner', 'rks-system',
]);

export function abilityStatus(id: string): AbilityStatus {
  if (SUPPORTED.has(id)) return 'supported';
  if (NO_EFFECT.has(id)) return 'noEffect';
  return 'pending';
}
