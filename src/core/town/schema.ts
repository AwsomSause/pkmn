// Pocket Town (W7, ledger rows I240-I290, F29, F96-F130, I214): schema for src/data/town.json and the saved town state.
// The town state is `profile.town` (optional, so older profiles load unchanged). Numbers and text are data.

import { z } from 'zod';
import json from '../../data/town.json';

const Count = z.number().int().min(0);
const Items = z.record(z.string(), Count);

/** What an action pays. Research and credits go straight to the profile; money, items, stuff and notes wait as the next run's boon. */
export const RewardSchema = z.object({
  rp: Count.optional(),
  credits: Count.optional(),
  money: Count.optional(),
  items: Items.optional(),
  stuff: Items.optional(),
  coins: Count.optional(),
  xp: Count.optional(),
  /** Counters that go up (name → amount). */
  counts: Items.optional(),
  /** A journal line the next run opens with (flavor only, never a roll). */
  note: z.string().optional(),
  /** Adds the first entry of the pool the player does not have yet (picked by a seeded shuffle) to a collection. */
  unlock: z.object({ set: z.string(), pool: z.array(z.string()).min(1) }).optional(),
  say: z.string().optional(),
});
export type Reward = z.infer<typeof RewardSchema>;

const GradeRewards = z.object({ miss: RewardSchema, ok: RewardSchema, good: RewardSchema, perfect: RewardSchema });

const Cost = z.object({ credits: Count.optional(), rp: Count.optional(), coins: Count.optional(), offerings: Count.optional() });

const Needs = z.object({
  achievements: Count.optional(),
  runs: Count.optional(),
  wins: Count.optional(),
  /** Needs this entry in a collection: [set, id]. */
  has: z.tuple([z.string(), z.string()]).optional(),
  visits: Count.optional(),
  text: z.string().optional(),
});

const Option = z.object({
  id: z.string(),
  label: z.string(),
  desc: z.string().default(''),
  say: z.string().default(''),
  cost: Cost.optional(),
  reward: RewardSchema.optional(),
  /** Pays only the first time this option is picked. */
  once: z.boolean().default(false),
  needs: Needs.optional(),
});
export type TownOption = z.infer<typeof Option>;

const Good = z.object({ id: z.string(), label: z.string(), desc: z.string().default(''), set: z.string(), cost: Cost, reward: RewardSchema.optional(), rarity: z.enum(['common', 'rare', 'epic']).default('common'), needs: Needs.optional() });
export type TownGood = z.infer<typeof Good>;

const Crop = z.object({ id: z.string(), label: z.string(), grow: z.number().int().min(1), stages: z.array(z.string()).min(2), yield: RewardSchema, cost: Cost.optional() });

export const KINDS = ['grade', 'pick', 'buy', 'equip', 'quiz', 'tend', 'puzzle', 'gacha', 'daily', 'view', 'place'] as const;

const Action = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
  kind: z.enum(KINDS),
  /** Ledger rows this action covers. */
  rows: z.array(z.string()).default([]),
  /** How often it can be used: once per run (resets when a run starts), once per day, or without limit. */
  limit: z.enum(['run', 'day', 'none']).default('none'),
  needs: Needs.optional(),
  cost: Cost.optional(),
  /** The timing prompt the screen plays to get a grade (core/interaction/prompt.ts ids). */
  prompt: z.string().optional(),
  rewards: GradeRewards.optional(),
  options: z.array(Option).default([]),
  /** Options built from the profile instead of the list: lastTeam, history, trophies, relics, pets, items. */
  dynamic: z.enum(['lastTeam', 'history', 'trophies', 'relics', 'pets', 'museum', 'contracts', 'ghosts', 'mail', 'items']).optional(),
  /** What a dynamic option pays; "{name}" in `say` is the option's name. */
  template: Option.optional(),
  goods: z.array(Good).default([]),
  set: z.string().optional(),
  slot: z.string().optional(),
  field: z.string().optional(),
  crops: z.array(Crop).default([]),
  plots: Count.default(0),
  puzzle: z.enum(['sequence', 'rotate', 'match']).optional(),
  pool: z.string().optional(),
  /** For a view: the screen to build (stats, ledger, shelf...). */
  view: z.string().optional(),
  max: Count.optional(),
});
export type TownAction = z.infer<typeof Action>;

const Building = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  blurb: z.string(),
  /** Visible from the start; false buildings open with a secret (`needs`). */
  hidden: z.boolean().default(false),
  needs: Needs.optional(),
  actions: z.array(Action).min(1),
});
export type TownBuilding = z.infer<typeof Building>;

const Quiz = z.object({ q: z.string(), a: z.array(z.string()).min(2), right: Count, why: z.string().default('') });

export const TownDataSchema = z.object({
  note: z.string(),
  buildings: z.array(Building).min(1),
  quizzes: z.record(z.string(), z.array(Quiz).min(1)),
  lore: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })),
  guests: z.array(z.object({ id: z.string(), who: z.string(), secret: z.string() })),
  vignettes: z.record(z.string(), z.array(z.string()).min(1)),
  letters: z.array(z.object({ id: z.string(), from: z.string(), text: z.string(), gift: RewardSchema.optional() })),
  seasons: z.array(z.object({ id: z.string(), name: z.string(), months: z.array(z.number().int().min(1).max(12)), prop: z.string(), tap: z.string(), reward: RewardSchema })),
  track: z.array(z.object({ xp: Count, label: z.string(), reward: RewardSchema })),
  dailyGifts: z.array(RewardSchema),
  dailyQuests: z.array(z.object({ id: z.string(), text: z.string(), action: z.string(), reward: RewardSchema })),
  badgePerks: z.record(z.string(), RewardSchema),
  pets: z.object({ chatter: z.array(z.string()), bondAt: Count }),
  gacha: z.object({ cost: Cost, pity: Count, pools: z.array(z.object({ rarity: z.enum(['common', 'rare', 'epic']), weight: Count, goods: z.array(z.object({ set: z.string(), id: z.string(), label: z.string() })) })), dupe: RewardSchema }),
  tracks: z.array(z.object({ id: z.string(), name: z.string(), unlock: z.string() })),
  floors: z.array(z.object({ id: z.string(), name: z.string(), scene: z.string(), building: z.string().nullable() })),
  jokes: z.array(z.string()),
  contest: z.array(z.object({ id: z.string(), name: z.string(), types: z.array(z.string()) })),
  recipes: z.array(z.object({ a: z.string(), b: z.string(), id: z.string(), name: z.string(), reward: RewardSchema })),
  mush: RewardSchema,
  roster: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), achievements: Count, line: z.string() })),
  pools: z.object({ cries: z.array(z.string()).min(4), memory: z.array(z.string()).min(4) }),
  caps: z.object({ notes: Count, graffiti: Count, photos: Count, pins: Count, wishes: Count, boonItems: Count }),
});
export type TownData = z.infer<typeof TownDataSchema>;
export const TOWN = TownDataSchema.parse(json);

// ---------- saved state ----------

export const BoonSchema = z.object({ money: Count.default(0), items: Items.default({}), stuff: Items.default({}), notes: z.array(z.string()).default([]) });
export type Boon = z.infer<typeof BoonSchema>;

export const PlotSchema = z.object({ crop: z.string(), stage: Count.default(0), wet: z.boolean().default(false) });
export type Plot = z.infer<typeof PlotSchema>;

export const TownProfileSchema = z.object({
  /** Goes up with every roll, so the same action twice rolls different results but a reload repeats the last one. */
  counter: Count.default(0),
  /** Actions used since the last run started (limit "run"). */
  spent: z.array(z.string()).default([]),
  /** Action id → the day it was last used (limit "day"). */
  daily: z.record(z.string(), z.string()).default({}),
  boon: BoonSchema.default(() => BoonSchema.parse({})),
  counts: Items.default({}),
  /** Collections: stickers, ribbons, cards, decor, trails, backdrops, outfits, relics, tracks, books, recipes, secrets... */
  sets: z.record(z.string(), z.array(z.string())).default({}),
  equipped: z.record(z.string(), z.string()).default({}),
  placed: z.record(z.string(), z.tuple([z.number(), z.number()])).default({}),
  plots: z.record(z.string(), PlotSchema).default({}),
  /** Picks made once (option ids), so "once" rewards never pay twice. */
  done: z.array(z.string()).default([]),
  /** Short text kept on the shelves: graffiti signatures, photo captions, pinned contracts, wishes, shrine blessings. */
  wall: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
  pins: z.array(z.string()).default([]),
  wishes: z.array(z.string()).default([]),
  /** Puzzle progress: the vault number, statue turns, and how many vaults were opened. */
  puzzle: z.record(z.string(), z.array(z.number().int())).default({}),
  /** Items left behind at the end of runs, waiting in Lost & Found. */
  lost: z.array(z.string()).default([]),
  /** Facts about the last finished run the town reacts to. */
  last: z.object({ victory: z.boolean(), cleared: Count, runId: z.string() }).nullable().default(null),
});
export type TownProfile = z.infer<typeof TownProfileSchema>;
export const freshTown = (): TownProfile => TownProfileSchema.parse({});
