// Mega-Expeditions (Blueprint section 2): a branching 5–9 node adventure with its own party rules, loot kept
// only on extraction, Mega Energy and a finale. Everything is data; the party mode decides which rules apply.

import { z } from 'zod';
import { TotemDefSchema } from '../totem/schema';
import { RaidDefSchema } from '../raid/schema';
import { EventConditionSchema, TerrainSchema, TypeNameSchema, WeatherSchema } from '../contentSchema';

export const NODE_KINDS = ['wild', 'trainer', 'elite', 'rest', 'cache', 'research', 'mystery', 'recruit', 'megaEnergy', 'totem', 'raid', 'finale'] as const;
export const NodeKindSchema = z.enum(NODE_KINDS);
export type ExpeditionNodeKind = z.infer<typeof NodeKindSchema>;

export const PARTY_MODES = ['own', 'rental', 'recruit', 'draft', 'combined'] as const;
export const PartyModeSchema = z.enum(PARTY_MODES);
export type PartyMode = z.infer<typeof PartyModeSchema>;

const Fraction = z.number().min(0).max(1);

export const MysteryEffectSchema = z.object({
  heal: Fraction.optional(),
  /** Fraction of every party member's max HP lost. */
  hurt: Fraction.optional(),
  money: z.number().int().optional(),
  item: z.string().optional(),
  energy: z.number().int().min(0).optional(),
  research: z.number().int().min(0).optional(),
});

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

/** Weather and terrain on the route's fights from `fromLayer` on; a `pool` rolls one of its entries per fight (a stage that behaves unpredictably). */
export const LegendaryEnvSchema = z.object({
  fromLayer: z.number().int().min(0),
  text: z.string().min(1),
  weather: WeatherSchema.optional(),
  terrain: TerrainSchema.optional(),
  pool: z.array(z.object({ weather: WeatherSchema.optional(), terrain: TerrainSchema.optional(), text: z.string().min(1) })).default([]),
});

/**
 * Legendary world event (spec 19): an expedition-style side stage for one Legendary, with its own environment,
 * route changes, encounter table, NPCs, and a multi-phase finale (a Totem entry with `legendary: true`).
 */
export const LegendaryBlockSchema = z.object({
  species: z.string(),
  epithet: z.string().min(1),
  /** Rarer events turn up less often (multiplies the gate chance). */
  rarity: z.enum(['uncommon', 'rare', 'veryRare']),
  /** Why the opportunity exists right now (shown when the event appears). */
  omen: z.string().min(1),
  lore: z.array(z.string().min(1)).min(1).max(4),
  temporaryNote: z.string().min(1),
  visual: z.object({ tint: Hex, accent: Hex, motif: z.string().min(1) }),
  /** Audio track id; null uses the expedition route music of the tier. */
  music: z.string().nullable().default(null),
  trigger: z.object({
    minRegion: z.number().int().min(0),
    maxRegion: z.number().int().min(0).nullable().default(null),
    /** Only offered at these times of day (empty = any). */
    time: z.array(z.enum(['day', 'eve', 'night'])).default([]),
    /** Only on stages whose theme includes one of these types (empty = any). */
    themeTypes: z.array(TypeNameSchema).default([]),
    /** Every condition must hold... */
    requires: z.array(EventConditionSchema).default([]),
    /** ...and, when listed, at least one of these. */
    any: z.array(EventConditionSchema).default([]),
    /** A party Pokémon of one of these types makes the event more likely (x2 weight). */
    favoured: z.array(TypeNameSchema).default([]),
    weight: z.number().positive().default(1),
  }),
  env: z.array(LegendaryEnvSchema).min(1),
  /** After a stop on this layer, one branch of the next layer collapses (never the only way on). */
  closes: z.array(z.object({ afterLayer: z.number().int().min(0), text: z.string().min(1) })).default([]),
  /** After a stop on this layer, the way on is rearranged (a seeded reshuffle of where the next stops lead). */
  distort: z.array(z.object({ afterLayer: z.number().int().min(0), text: z.string().min(1) })).default([]),
  /** After every stop, Pokémon of these types recover this share of their HP. */
  affinity: z.object({ types: z.array(TypeNameSchema).min(1), heal: z.number().gt(0).max(0.3), text: z.string().min(1) }).nullable().default(null),
  /** After every stop, Pokémon of these types lose this share of their HP (never below 1). */
  peril: z.object({ types: z.array(TypeNameSchema).min(1), chip: z.number().gt(0).max(0.2), text: z.string().min(1) }).nullable().default(null),
  /** The event's own wild table (replaces the stage's) and its level bonus. */
  wild: z.array(z.string()).min(3),
  wildLevelBonus: z.number().int().min(0).max(6).default(2),
  /** Event-exclusive characters met at mystery stops. */
  npcs: z.array(z.object({ id: z.string(), name: z.string().min(1), text: z.string().min(1), options: z.array(z.object({ label: z.string(), result: z.string(), effect: MysteryEffectSchema })).min(2).max(3) })).min(1),
  /** Legendary-themed modifiers, listed in the briefing. */
  modifiers: z.array(z.string().min(1)).max(4).default([]),
  /** Dialogue for the finale and its two endings. */
  finale: z.object({ intro: z.string().min(1), win: z.string().min(1), lose: z.string().min(1) }),
});
export type LegendaryBlock = z.infer<typeof LegendaryBlockSchema>;
export type LegendaryEnv = z.infer<typeof LegendaryEnvSchema>;

export const ExpeditionDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** 1 early regions … 4 Grand Region. */
  tier: z.number().int().min(1).max(4),
  blurb: z.string().min(1),
  nodes: z.object({ min: z.number().int().min(5), max: z.number().int().max(9) }),
  partyMode: PartyModeSchema,
  /** Weights for the kinds of node between the start and the finale. */
  nodeWeights: z.partialRecord(NodeKindSchema, z.number().min(0)),
  /** The finale: a Mega guardian (one Pokémon that Mega Evolves), a raid or a Totem. */
  finale: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('megaBoss'), species: z.array(z.string()).min(1), levelBonus: z.number().int().min(0).max(8), hpBoostPercent: z.number().int().min(0).max(400) }),
    z.object({ kind: z.literal('raid'), raidId: z.string() }),
    z.object({ kind: z.literal('totem'), totemId: z.string() }),
  ]),
  /** Species lent or offered (rental, draft, recruit). */
  rentals: z.array(z.string()).min(3),
  restHeal: Fraction,
  cache: z.array(z.object({ item: z.string(), chance: Fraction })).min(1),
  /** Mega Energy needed for one temporary Mega Stone. */
  megaCost: z.number().int().min(1).max(6),
  /** Research needed for the objective bonus. */
  researchGoal: z.number().int().min(1),
  rewards: z.object({
    moneyPerLevel: z.number().int().min(0),
    items: z.array(z.object({ item: z.string(), chance: Fraction })).default([]),
    /** Mega Stones granted for good (one per party Pokémon that can use one, up to this many). */
    megaStones: z.number().int().min(0).max(3),
    researchBonusItem: z.string().nullable().default(null),
  }),
  /** The expedition id this one unlocks for the rest of the run when completed. */
  unlocks: z.string().nullable().default(null),
  /** After a failure: the share of the expedition's loot money still kept. */
  failureKeep: Fraction,
  /** Set for a Legendary world event (core/legendary): it is placed by its own trigger, not by the ordinary gate roll. */
  legendary: LegendaryBlockSchema.optional(),
});
export type ExpeditionDef = z.infer<typeof ExpeditionDefSchema>;

export const MysteryEventSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.array(z.object({ label: z.string(), result: z.string(), effect: MysteryEffectSchema })).min(2).max(3),
});

export const ExpeditionFileSchema = z.object({
  denChance: Fraction,
  /** Expedition tier available by region index (the last covers later regions). */
  tierByRegion: z.array(z.number().int().min(1).max(4)).min(1),
  failureHealFraction: z.number().min(0.1).max(1),
  mysteryEvents: z.array(MysteryEventSchema).min(2),
  expeditions: z.array(ExpeditionDefSchema).min(1),
});
export type ExpeditionFile = z.infer<typeof ExpeditionFileSchema>;

/** legendaryEvents.json: the gate roll and the events (full expedition definitions with a `legendary` block). */
export const LegendaryFileSchema = z.object({
  /** Chance a stage carries a Legendary gate at all (before each event's rarity). */
  gateChance: Fraction,
  /** At most this many Legendary gates are placed per region. */
  perRegion: z.number().int().min(1).max(3),
  events: z.array(ExpeditionDefSchema.extend({ legendary: LegendaryBlockSchema })).min(1),
  /** The finale Totem of each event (`legendary: true`). */
  totems: z.array(TotemDefSchema).min(1),
  /** Raid finales (`legendary: true`) for the events that end in a Raid battle instead of a Totem fight. */
  raids: z.array(RaidDefSchema).default([]),
});
export type LegendaryFile = z.infer<typeof LegendaryFileSchema>;
