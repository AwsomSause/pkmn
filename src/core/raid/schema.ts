// Raid boss definitions (Blueprint: Raids, Mega-Expeditions, Totem Pokémon & Minigames, section 1).
// A raid is a boss with mechanics: a big HP pool, shields, phases, telegraphed attacks, extra actions,
// an optional turn timer and a reward table. Every mechanic is optional (low tiers use one or two).

import { z } from 'zod';
import { BoostStatSchema, TerrainSchema, TypeNameSchema, WeatherSchema } from '../contentSchema';

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

/** Field rules of a raid (Raid Battles pack): all optional. */
export const RaidModifiersSchema = z.object({
  /** A terrain that lasts the whole fight. */
  terrain: TerrainSchema.optional(),
  /** Elemental surge: the boss's moves of this type hit `boost` times as hard. */
  surge: z.object({ type: TypeNameSchema, boost: z.number().min(1.1).max(2), text: z.string().min(1) }).optional(),
  /** Healing restriction: no healing items and no Healing cheer. */
  noHealing: z.boolean().optional(),
  /** Rotating weakness: every `everyTurns` turns the boss is weak to the next type (your moves of it do `boost` times the damage). */
  rotatingWeakness: z.object({ types: z.array(TypeNameSchema).min(2).max(6), everyTurns: z.number().int().min(2).max(6), boost: z.number().min(1.1).max(2) }).optional(),
});
export type RaidModifiers = z.infer<typeof RaidModifiersSchema>;

/** How the player takes on a raid (regional approach, rival choice). Chosen at the den; the cost is paid on entering. */
export const RaidApproachSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  text: z.string().min(1),
  cost: z.number().int().min(0).default(0),
  /** Added to the boss's HP boost (percent; negative = a weaker boss). */
  hpDeltaPercent: z.number().int().min(-60).max(100).default(0),
  /** The boss starts the fight at this share of its HP (a rival already fought it); shields above it are gone. */
  startHp: Fraction.optional(),
  /** Sets or shifts the timer (a race): added to the raid's timer, or to 20 when it has none. */
  timerDelta: z.number().int().min(-15).max(15).default(0),
  /** Prize money and extra draft choices after the win. */
  rewardPercent: z.number().int().min(10).max(200).default(100),
  draftDelta: z.number().int().min(-2).max(2).default(0),
  /** A rival trainer fights beside you ("The Rival Who Stood Beside You" for the Pokémon in front). */
  rivalHelps: z.boolean().default(false),
  /** A rival races you for the last hit (hits harder, and a rival that lands the final blow takes half the prize). */
  rivalRaces: z.boolean().default(false),
  /** Walk away: no fight, the den is used up. */
  leave: z.boolean().default(false),
});
export type RaidApproach = z.infer<typeof RaidApproachSchema>;

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
  /** wild: the plain den. regional: choose how to prepare. rival: a rival is already fighting it. anomaly: strange rules and a research find. */
  kind: z.enum(['wild', 'regional', 'rival', 'anomaly']).default('wild'),
  approaches: z.array(RaidApproachSchema).max(3).default([]),
  modifiers: RaidModifiersSchema.default({}),
  /** Moves the boss knows beyond the usual four (up to two more). */
  extraMoves: z.array(z.string()).max(2).default([]),
  rewards: RaidRewardSchema,
  /**
   * A Gang Raid (APPROVED.md §12): an evil faction's stronghold. The boss is a Shadow Pokémon; the approaches are the
   * ways in (stealth, direct, rescue-first). Never in the random den pool: the shadow world places it (shadowWorld/world.ts).
   */
  gang: z.object({
    faction: z.string().min(1),
    shadowBoss: z.boolean().default(true),
    /** The Shadow boss joins you when you win (kept Shadow; purify it over the run). */
    rescue: z.boolean().default(true),
    /** The faction's lieutenant leads this raid (escapes twice, then is caught). */
    lieutenant: z.boolean().default(false),
    /** Operations of the faction that fall when you win. */
    heatDrop: z.number().int().min(1).max(3).default(1),
  }).optional(),
  /** The Grand-Enemy's own fights (core/story/grandEnemy): placed by the campaign, never in the random den pool. */
  grand: z.enum(['contact', 'reckoning']).optional(),
});
export type RaidDef = z.infer<typeof RaidDefSchema>;

/** How badges scale a raid (spec 31). Badges are the main progression signal; special raids take a share of it, the Grand-Enemy and gang raids none. */
export const BadgeScalingSchema = z.object({
  /** Extra boss levels per badge (kept at or under the region's level cap), up to `maxLevelBonus`. */
  levelPerBadge: z.number().min(0).max(2),
  maxLevelBonus: z.number().int().min(0).max(12),
  /** Extra boss HP (percent of the base pool) per badge, up to `maxHpPercent`. */
  hpPercentPerBadge: z.number().min(0).max(30),
  maxHpPercent: z.number().int().min(0).max(300),
  /** Each shield is worth this much more of the boss's HP per badge. */
  shieldPointsPerBadge: z.number().min(0).max(0.05),
  /** The charged attack hits this much harder per badge (never above ×2), and charges one turn sooner from `fasterChargeBadges`. */
  telegraphBoostPerBadge: z.number().min(0).max(0.1),
  fasterChargeBadges: z.number().int().min(1),
  /** From this many badges the boss knows its second extra move, uses its hidden ability, gets one more bonus attack and (tier 3+) a last shield at 25% HP. */
  secondMoveBadges: z.number().int().min(1),
  hiddenAbilityBadges: z.number().int().min(1),
  extraActionBadges: z.number().int().min(1),
  lastShieldBadges: z.number().int().min(1),
  /** Prize money grows by this percent per badge (up to `maxMoneyPercent`); one more draft choice and (tier 5+) one more rare-encounter token from these badge counts. */
  moneyPercentPerBadge: z.number().min(0).max(20),
  maxMoneyPercent: z.number().int().min(0).max(300),
  extraDraftBadges: z.number().int().min(1),
  rareTokenBadges: z.number().int().min(1),
  /** The share of the badge count used by each raid kind (default 1; the Grand-Enemy and gang raids are never scaled). */
  kindShare: z.partialRecord(z.enum(['wild', 'regional', 'rival', 'anomaly']), z.number().min(0).max(1)).default({}),
  /** Badges needed before a den can hold a raid of tier 1 to 6 (an open tier is not enough on its own). */
  tierBadges: z.array(z.number().int().min(0)).length(6),
  /** Names of tiers 1 to 6 (Standard, Advanced, Elite, Exceptional, Legendary), and the label of rival and anomaly raids. */
  tierNames: z.array(z.string().min(1)).length(6),
  eventLabel: z.string().min(1),
});
export type BadgeScaling = z.infer<typeof BadgeScalingSchema>;

export const RaidFileSchema = z.object({
  badgeScaling: BadgeScalingSchema,
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
