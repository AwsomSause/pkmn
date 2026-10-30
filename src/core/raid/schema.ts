// Raid boss definitions (Blueprint: Raids, Mega-Expeditions, Totem Pokémon & Minigames, section 1).
// A raid is a boss with mechanics: a big HP pool, shields, phases, telegraphed attacks, extra actions,
// an optional turn timer and a reward table. Every mechanic is optional (low tiers use one or two).

import { z } from 'zod';
import { BoostStatSchema, WeatherSchema } from '../contentSchema';

const Fraction = z.number().gt(0).lt(1);

export const RaidPhaseSchema = z.object({
  /** The phase starts once the boss is at or below this share of its HP. */
  atHp: Fraction,
  /** Shown to the player when the phase starts. */
  text: z.string().min(1),
  /** Stat stages the boss gains. */
  boost: z.partialRecord(BoostStatSchema, z.number().int().min(-6).max(6)).optional(),
  weather: WeatherSchema.optional(),
  /** Wipes the player's stat changes. */
  clearPlayerStages: z.boolean().optional(),
  /** Cures the boss's status condition and lowers its own negative stages to 0. */
  cleanse: z.boolean().optional(),
});
export type RaidPhase = z.infer<typeof RaidPhaseSchema>;

export const RaidRewardSchema = z.object({
  /** Prize money = this × the boss's level. */
  moneyPerLevel: z.number().int().min(0),
  /** Bag items, each with its own chance (rolled once, from a seeded generator). */
  items: z.array(z.object({ item: z.string(), chance: z.number().min(0).max(1) })).default([]),
  /** Extra choices in the reward draft after the win. */
  draftExtra: z.number().int().min(0).max(3).default(0),
  /** The beaten boss offers to join the team (a normal catch decision). */
  joinChance: z.number().min(0).max(1).default(0),
  /** Mega resources: Mega Stones for good (one per party Pokémon that can use one, up to this many), plus a Mega Ring if you have none. */
  megaStones: z.number().int().min(0).max(3).default(0),
  /** Rare-encounter tokens: the next this-many wild encounters are far likelier to be rare or Legendary. */
  rareEncounters: z.number().int().min(0).max(3).default(0),
});

export const RaidDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tier: z.number().int().min(1).max(6),
  blurb: z.string().min(1),
  /** The boss is one of these species (picked from a seeded generator, so a den is stable). */
  species: z.array(z.string()).min(1),
  /** Levels above the region's top wild level (always kept at or under the region's level cap). */
  levelBonus: z.number().int().min(0).max(10),
  /** Extra max HP, in percent (300 = four times the normal HP pool). */
  hpBoostPercent: z.number().int().min(0).max(900),
  /** Money the player pays at the den (spent once, when the raid starts). */
  entryCost: z.number().int().min(0),
  /** Shields: each threshold raises a shield worth `points` of the boss's max HP; the boss can't drop below the threshold until it breaks. */
  shield: z.object({ at: z.array(Fraction).min(1).max(3), points: z.number().min(0.05).max(0.5) }).nullable().default(null),
  phases: z.array(RaidPhaseSchema).max(3).default([]),
  /** Every `everyTurns` turns the boss charges: its next hit is `boost` times stronger unless the player breaks a shield first, or puts the boss under one of the `interruptedBy` statuses (counterplay, catalog 24). */
  telegraph: z.object({ everyTurns: z.number().int().min(2).max(6), boost: z.number().min(1.1).max(2), text: z.string(), interruptedBy: z.array(z.enum(['slp', 'par', 'frz'])).default(['slp', 'par', 'frz']) }).nullable().default(null),
  /** An extra attack after the normal actions, once the boss is under `belowHp`; at most `max` times per battle. */
  extraActions: z.object({ belowHp: Fraction, max: z.number().int().min(1).max(3) }).nullable().default(null),
  /** The raid ends when the timer runs out. */
  timerTurns: z.number().int().min(5).max(60).nullable().default(null),
  weather: WeatherSchema.nullable().default(null),
  rewards: RaidRewardSchema,
  /** The Grand-Enemy's own fights (core/story/grandEnemy): placed by the campaign, never in the random den pool. */
  grand: z.enum(['contact', 'reckoning']).optional(),
});
export type RaidDef = z.infer<typeof RaidDefSchema>;

export const RaidFileSchema = z.object({
  /** Chance that a stage has a raid den (the Pokémon League never does). */
  denChance: z.number().min(0).max(1),
  /** Raid tiers a den can have, by region index (the last entry covers later regions). */
  tiersByRegion: z.array(z.array(z.number().int().min(1).max(6)).min(1)).min(1),
  /** After a lost or abandoned raid: the party is back on its feet at this share of max HP. */
  failureHealFraction: z.number().min(0.1).max(1),
  /** Raid tiers open from the very first run. A higher tier opens for later runs once a raid one tier below it is won (in any run). */
  openTiers: z.number().int().min(1).max(6).default(3),
  raids: z.array(RaidDefSchema).min(1),
});
export type RaidFile = z.infer<typeof RaidFileSchema>;
