// Totem Pokémon (Blueprint section 3): territorial minibosses tied to a place (their type matches the stage),
// each with an aura, optional ally calls, behaviour phases and a home-field environment.

import { z } from 'zod';
import { BoostStatSchema, TerrainSchema, TypeNameSchema, WeatherSchema } from '../contentSchema';
import { RaidPhaseSchema } from '../raid/schema';

const Fraction = z.number().gt(0).lt(1);

export const TotemTiers = ['early', 'mid', 'late', 'grand'] as const;

export const TotemAuraSchema = z.object({
  /** Shown in the battle UI and the den preview. */
  text: z.string().min(1),
  /** Stat stages the Totem starts with (kept small: one or two stages in total). */
  boost: z.partialRecord(BoostStatSchema, z.number().int().min(1).max(2)).optional(),
  weather: WeatherSchema.optional(),
  terrain: TerrainSchema.optional(),
  /** A hazard on the player's side of the field. */
  hazard: z.enum(['stealthRock', 'spikes', 'toxicSpikes', 'stickyWeb']).optional(),
});

export const TotemAllySchema = z.object({
  species: z.string(),
  /** Added to the Totem's level (never above it). */
  levelOffset: z.number().int().min(-15).max(0),
  /** The ally is called once the Totem is at or below this share of its HP. */
  triggerHp: Fraction,
  /** Hard cap on calls in one battle: no endless summoning. */
  maxCalls: z.number().int().min(1).max(3),
  /** Whether a new ally may be called after the last one was defeated. */
  resummon: z.boolean(),
  text: z.string().min(1),
  /** What the ally does for the Totem when it arrives. */
  support: z.object({ heal: Fraction.optional(), weather: WeatherSchema.optional(), screens: z.boolean().optional() }).default({}),
});

/** A status the Totem's territory keeps spreading: each end of turn, every Pokémon of yours without a status may catch it. */
export const TotemFieldEffectSchema = z.object({
  status: z.enum(['brn', 'psn', 'par']),
  chance: z.number().min(0.05).max(0.5),
  text: z.string().min(1),
});

export const TotemDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tier: z.enum(TotemTiers),
  /** The Totem lives on stages whose theme includes this type. */
  type: TypeNameSchema,
  blurb: z.string().min(1),
  species: z.array(z.string()).min(1),
  levelBonus: z.number().int().min(0).max(8),
  hpBoostPercent: z.number().int().min(0).max(600),
  aura: TotemAuraSchema,
  ally: TotemAllySchema.nullable().default(null),
  /** True 2v1: the ally stands beside the Totem from the first turn (a double battle when you have two Pokémon able to fight; otherwise it is called mid-fight as usual). */
  twoVsOne: z.boolean().default(false),
  /** A unique status field effect of the territory. */
  fieldEffect: TotemFieldEffectSchema.nullable().default(null),
  phases: z.array(RaidPhaseSchema).max(3).default([]),
  /** Home-field advantage: weather or terrain that is on from the start. */
  environment: z.object({ text: z.string().min(1), weather: WeatherSchema.optional(), terrain: TerrainSchema.optional() }).nullable().default(null),
  rewards: z.object({
    moneyPerLevel: z.number().int().min(0),
    items: z.array(z.object({ item: z.string(), chance: z.number().min(0).max(1) })).default([]),
    draftExtra: z.number().int().min(0).max(3).default(0),
    /** A rare Pokémon offered after the win (a normal catch decision). */
    rareJoin: z.object({ species: z.string(), chance: z.number().min(0).max(1) }).nullable().default(null),
    /** A permanent-for-this-run unlock (new route / expedition access) and research points. */
    unlock: z.string().nullable().default(null),
    research: z.number().int().min(0).default(0),
    /** Mega Stones for good (one per party Pokémon that can use one, up to this many), plus a Mega Ring if you have none. */
    megaStones: z.number().int().min(0).max(3).default(0),
  }),
});
export type TotemDef = z.infer<typeof TotemDefSchema>;

export const TotemFileSchema = z.object({
  denChance: z.number().min(0).max(1),
  /** Totem tier by region index (the last entry covers later regions). */
  tierByRegion: z.array(z.enum(TotemTiers)).min(1),
  failureHealFraction: z.number().min(0.1).max(1),
  totems: z.array(TotemDefSchema).min(1),
});
export type TotemFile = z.infer<typeof TotemFileSchema>;
