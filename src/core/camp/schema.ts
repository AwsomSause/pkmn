// Camp, gadgets and crafting (W3): the data shape (src/data/camp.json) and the saved state.
// Run state is optional (`run.camp`) and profile state is optional (`profile.camp`), so older saves load unchanged.

import { z } from 'zod';
import json from '../../data/camp.json';
import { ArchetypeModifierSchema } from '../contentSchema';

const Cost = z.record(z.string(), z.number().int().min(0));
const Range = z.tuple([z.number().int(), z.number().int()]);
const Effects = z.array(ArchetypeModifierSchema);
const Gives = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('brew'), heal: z.number().min(0).max(1), mood: z.number().int(), text: z.string() }),
  z.object({ kind: z.literal('stuff'), stuff: z.string(), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('item'), item: z.string(), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('gadget'), gadget: z.string() }),
  z.object({ kind: z.literal('mat'), mat: z.string(), amount: z.number().int().positive() }),
]);
const Good = z.object({
  id: z.string(), name: z.string(), blurb: z.string(), limit: z.number().int().positive(),
  price: z.number().int().min(0).optional(), tokens: z.number().int().min(0).optional(),
  kind: z.enum(['mystery', 'stuff', 'relic', 'mat']),
  stuff: z.string().optional(), mat: z.string().optional(), amount: z.number().int().positive().optional(),
  curse: z.boolean().optional(), risky: z.boolean().optional(),
});

export const CampDataSchema = z.object({
  note: z.string(),
  gadgets: z.array(z.object({ id: z.string(), name: z.string(), blurb: z.string(), uses: z.number().int().positive(), repair: Cost, bench: Cost, page: z.boolean().optional() })).min(1),
  limits: z.object({ stopPerAction: z.number().int().positive() }),
  actions: z.array(z.object({
    id: z.string(), group: z.enum(['gadgets', 'kitchen', 'workshop', 'market', 'camp']), name: z.string(), desc: z.string(),
    gadget: z.string().optional(), limit: z.enum(['stop', 'stage', 'none']),
    args: z.enum(['none', 'party', 'choice', 'grade', 'berries', 'pair', 'mix', 'item', 'label', 'stall', 'shelf']),
    choices: z.array(z.string()).optional(),
  })).min(1),
  combos: z.array(z.object({ id: z.string(), name: z.string(), a: z.string(), b: z.string(), gives: Gives, locked: z.boolean().optional() })).min(1),
  pot: z.object({ battles: z.number().int().positive(), perBerry: z.number(), maxBerries: z.number().int().positive(), mood: z.number().int(), meals: z.record(z.string(), z.object({ name: z.string(), effect: ArchetypeModifierSchema })), note: z.string() }),
  radio: z.object({ battles: z.number().int().positive(), news: z.object({ effects: Effects }), rock: z.object({ effects: Effects }), lullaby: z.object({ effects: Effects }), quiz: z.object({ effects: Effects }) }),
  flute: z.record(z.string(), z.object({ effects: Effects, battles: z.number().int().positive() })),
  tent: z.object({ heal: z.record(z.string(), z.number()), mood: z.record(z.string(), z.number().int()), fatigue: z.record(z.string(), z.number().int()) }),
  fireworks: z.object({ mood: z.number().int(), friendship: z.number().int() }),
  glow: z.object({ friendship: z.number().int() }),
  dowse: z.object({ chance: z.number(), money: Range, materials: z.number().int(), chestChance: z.number() }),
  photo: z.object({ firstMoney: z.number().int(), friendship: z.number().int(), mood: z.number().int() }),
  net: z.object({ silk: z.number().int(), friendshipBug: z.number().int() }),
  mirror: z.object({ luck: z.number().int() }),
  shake: z.object({ chance: z.number(), money: Range }),
  well: z.object({ coin: z.number().int(), wealth: Range, health: z.number(), friends: z.number().int(), luckGood: z.number().int(), luckBad: z.number().int(), chance: z.number() }),
  vending: z.object({ price: z.number().int(), jam: z.number(), thief: z.number(), stolen: z.number().int(), table: z.array(z.object({ item: z.string(), weight: z.number() })).min(1) }),
  bottle: z.object({ texts: z.array(z.string()).min(1), kind: z.object({ money: Range }), funny: z.object({ friendship: z.number().int() }) }),
  scraps: z.object({ pieces: z.number().int(), money: Range, materials: z.number().int(), item: z.string() }),
  chest: z.object({ money: Range, materials: z.number().int(), item: z.string(), lockpick: z.record(z.string(), z.number()) }),
  capsule: z.object({ note: z.string() }),
  stall: z.object({ base: z.number(), haggle: z.number(), bluffBonus: z.number(), bluffFail: z.number(), hat: z.record(z.string(), z.number()), theft: z.number(), customers: z.array(z.string()).min(1) }),
  mixPotions: z.object({ ratios: z.array(z.string()).min(1), success: z.object({ item: z.string(), amount: z.number().int() }), fail: z.string() }),
  sniff: z.object({ poison: z.number(), reward: z.object({ money: Range }) }),
  recycle: z.object({ perCost: z.number(), minScrap: z.number().int() }),
  fuse: z.object({ sameTypeCopies: z.number().int(), differentCopies: z.number().int(), plates: z.record(z.string(), z.string()) }),
  tmShelf: z.object({ choices: z.number().int() }),
  seals: z.object({ cost: Cost }).catchall(z.any()),
  distract: z.object({ effects: Effects, battles: z.number().int() }),
  launcher: z.object({ perfect: z.number(), good: z.number(), ok: z.number(), miss: z.number() }),
  market: z.object({ slots: z.number().int(), lucky: z.number().int(), tokenName: z.string(), tokensPerAction: z.number().int(), goods: z.array(Good), tokenGoods: z.array(Good), mysteryOdds: z.array(z.object({ label: z.string(), weight: z.number(), kind: z.enum(['mats', 'item', 'stuff', 'mat', 'relic']), item: z.string().optional(), amount: z.number().int().optional(), stuff: z.string().optional(), mat: z.string().optional() })) }),
  relics: z.array(z.object({ id: z.string(), name: z.string(), tier: z.number().int().min(1), effects: Effects, curse: z.object({ effects: Effects, text: z.string() }).nullable(), blurb: z.string() })).min(1),
  purify: z.object({ money: z.number().int(), materials: Cost }),
  altar: z.object({ need: z.number().int() }),
  curseLuckLoss: z.number().int(),
  scenarios: z.record(z.string(), z.string()),
  narration: z.record(z.string(), z.string()),
  sniffHints: z.record(z.string(), z.string()),
});
export type CampData = z.infer<typeof CampDataSchema>;
export const CAMP = CampDataSchema.parse(json) as CampData;

// ---------- saved state ----------

export const BAG_SORTS = ['obtained', 'type', 'rarity', 'recent', 'name'] as const;

/** A relic held this run; a cursed one cannot be dropped, sold or traded until cleansed. */
export const RelicSchema = z.object({ id: z.string(), cursed: z.boolean() });
export type RelicHeld = z.infer<typeof RelicSchema>;

export const CampStateSchema = z.object({
  /** Owned gadgets: id → uses left (0 = broken, mend it at the forge). */
  wear: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Counted odds and ends: oil, keys, bottles, map scraps, recipe pages, letters, TM stock (`tm-<type>`). */
  stuff: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Actions used: `<action>@<stop or stage key>` → count. Old keys are dropped as the stop changes. */
  done: z.record(z.string(), z.number().int().min(0)).default({}),
  labels: z.record(z.string(), z.string()).default({}),
  relics: z.array(RelicSchema).default([]),
  luck: z.number().int().default(0),
  morality: z.number().int().default(0),
  tokens: z.number().int().min(0).default(0),
  /** Market goods bought this run: good id → copies. */
  bought: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Items used for the first time this run (journal narration), newest last. */
  journal: z.array(z.string()).default([]),
  recent: z.array(z.string()).default([]),
  bagSort: z.enum(BAG_SORTS).default('obtained'),
  hat: z.string().default('none'),
  photos: z.array(z.string()).default([]),
  launcher: z.boolean().default(false),
  /** A parcel being carried (opened = false): who it is for is the next stall customer. */
  parcel: z.object({ item: z.string(), sealed: z.boolean(), style: z.string() }).nullable().default(null),
  /** Skill-throw grade for the next ball throw (set by the screen, cleared by the engine call). */
  lastThrow: z.string().nullable().default(null),
});
export type CampState = z.infer<typeof CampStateSchema>;
export const freshCamp = (): CampState => CampStateSchema.parse({});

/** Kept across runs: the cookbook, the time capsule, the photo album and the item journal. */
export const CampProfileSchema = z.object({
  cookbook: z.array(z.string()).default([]),
  album: z.array(z.string()).default([]),
  journal: z.array(z.string()).default([]),
  capsule: z.object({ item: z.string(), kind: z.enum(['bag', 'held', 'mat']), buriedIn: z.string() }).nullable().default(null),
  digs: z.number().int().min(0).default(0),
});
export type CampProfile = z.infer<typeof CampProfileSchema>;
export const freshCampProfile = (): CampProfile => CampProfileSchema.parse({});

/** The catch-rate factor for a skill throw (the Ball Launcher). 1 when no grade was given. */
export function skillThrowFactor(grade: string | undefined): number {
  if (!grade) return 1;
  return (CAMP.launcher as Record<string, number>)[grade] ?? 1;
}
