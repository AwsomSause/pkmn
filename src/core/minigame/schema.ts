// Minigame framework (Blueprint section 4): every minigame is described by the same configuration and returns the
// same result (score, medal, success), and one reward system pays it out. Reward numbers are data.

import { z } from 'zod';

export const MEDALS = ['none', 'bronze', 'silver', 'gold'] as const;
export type Medal = (typeof MEDALS)[number];

const RewardSchema = z.object({
  money: z.number().int().min(0),
  item: z.object({ item: z.string(), chance: z.number().min(0).max(1) }).nullable().default(null),
});

export const MinigameDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  category: z.enum(['memory', 'timing', 'knowledge', 'resource', 'puzzle', 'skill']),
  blurb: z.string().min(1),
  /** Shown before the game starts. */
  instructions: z.string().min(1),
  unlockRequirements: z.object({ badges: z.number().int().min(0), regionIndex: z.number().int().min(0) }),
  /** Easy, Normal, Hard: the numbers each game reads (see games.ts). */
  difficultyTiers: z.array(z.object({ id: z.string(), label: z.string(), params: z.record(z.string(), z.number()) })).length(3),
  /** Per attempt, in game ticks (0 = no time limit). */
  durationLimit: z.number().int().min(0),
  /** Tries at one stop. */
  attemptLimit: z.number().int().min(1).max(5),
  scoringRules: z.string().min(1),
  /** Share of the best possible score needed for each medal. */
  medals: z.object({ bronze: z.number().gt(0).lt(1), silver: z.number().gt(0).lt(1), gold: z.number().gt(0).max(1) }),
  rewardTable: z.object({ bronze: RewardSchema, silver: RewardSchema, gold: RewardSchema }),
  failureOutcome: z.string().min(1),
  replayRules: z.string().min(1),
  uiConfiguration: z.object({ layout: z.enum(['grid', 'choices']), tickMs: z.number().int().min(0) }),
  accessibilityOptions: z.object({ slowFactor: z.number().min(1).max(4), noTimerOption: z.boolean() }),
});
export type MinigameDef = z.infer<typeof MinigameDefSchema>;

export const MinigameFileSchema = z.object({
  economy: z.object({
    /** Chance that a stage has a minigame stop. */
    stopChance: z.number().min(0).max(1),
    /** Most money minigames can pay per stage, times (region number). */
    stageMoneyCap: z.number().int().min(0),
    /** Each repeat of the same game in a stage pays this share of the last payout. */
    diminishing: z.number().min(0).max(1),
    /** Items are only paid from this difficulty tier on (1 easy, 2 normal, 3 hard). */
    itemMinTier: z.number().int().min(1).max(3),
    itemCapPerStage: z.number().int().min(0),
    tierMultipliers: z.array(z.number().min(0)).length(3),
  }),
  games: z.array(MinigameDefSchema).min(1),
});
export type MinigameFile = z.infer<typeof MinigameFileSchema>;
