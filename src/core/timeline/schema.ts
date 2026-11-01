// Save shapes for Revisit This Timeline (core/timeline/genesis.ts). Kept apart so the save layer need not load the run engine.

import { z } from 'zod';
import { PastPokemonSchema, ProfileSchema, RunPrepSchema, RunStateSchema } from '../state';
import { RivalSchema } from '../story/schema';
import { HeirloomSchema, PastDigestSchema } from '../memories/schema';

/** How a lost run ended, saved when it ended: where the player got to and the rival who mattered most (it becomes the replay's front-runner). */
export const TimelineOriginSchema = z.object({
  badges: z.number().int().min(0),
  regionsCleared: z.number().int().min(0),
  encounters: z.number().int().min(0),
  rival: RivalSchema.nullable(),
});
export type TimelineOrigin = z.infer<typeof TimelineOriginSchema>;

const RulesChoiceSchema = z.object({
  modeId: z.string(),
  difficultyId: z.string(),
  modifierIds: z.array(z.string()),
  deathBlock: z.boolean(),
  noRewards: z.boolean().optional(),
  weeks: z.boolean().optional(),
});

/**
 * A run's starting inputs. Profile-dependent picks that use their own seed-derived generator (legacy rival, reunion,
 * the remembered champion team) are stored as their results, not as the whole archive, to keep saves small.
 */
export const RunGenesisSchema = z.object({
  runId: z.string(),
  seed: z.string(),
  archetypeId: z.string(),
  campaignId: z.string().optional(),
  prep: RunPrepSchema.optional(),
  rules: RulesChoiceSchema.optional(),
  attributes: z.record(z.string(), z.number()).optional(),
  mastery: ProfileSchema.shape.mastery.optional(),
  gameEvents: z.array(z.string()).default([]),
  raidTierUnlocked: z.number().int().optional(),
  licenses: z.array(z.string()).default([]),
  candyPerks: z.array(z.string()).default([]),
  ownedTrainers: z.array(z.string()).default([]),
  /** Results of the archive picks made at the start. */
  legacyRival: RunStateSchema.shape.legacyRival,
  reunion: z.object({ mon: PastPokemonSchema, afterEncounters: z.number().int().min(1), done: z.boolean() }).nullable().default(null),
  storyFlags: z.record(z.string(), z.unknown()).default({}),
  /** Memories: what the run knew of earlier runs and the heirloom it started with, so a replay meets the same ghosts and keepsakes. */
  past: PastDigestSchema.nullable().default(null),
  heirloom: HeirloomSchema.nullable().default(null),
  /** The Trainer Network parcel added after creation (core/legacy.ts startGrants). */
  grants: z.object({ money: z.number().int(), items: z.record(z.string(), z.number().int()), /** Camp stuff from the Town (Shrine Water). */ stuff: z.record(z.string(), z.number().int()).optional() }),
  ruleVersion: z.number().int(),
  startedAt: z.string(),
  /** Filled in when the run is lost (null while it is still going or if it ended before this was recorded). */
  origin: TimelineOriginSchema.nullable().default(null),
});
export type RunGenesis = z.infer<typeof RunGenesisSchema>;

export const ReplayStatusSchema = z.enum(['active', 'finished', 'abandoned']);
export type ReplayStatus = z.infer<typeof ReplayStatusSchema>;

/** One replay of a lost run. Stored apart from the profile's run history; the original record is never edited. */
export const ReplayRecordSchema = z.object({
  replayId: z.string(),
  originRunId: z.string(),
  attempt: z.number().int().min(1),
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
  status: ReplayStatusSchema,
  victory: z.boolean().default(false),
  regionsCleared: z.number().int().min(0).default(0),
  badges: z.number().int().min(0).default(0),
  encounters: z.number().int().min(0).default(0),
  /** One of the five False Protagonist outcomes (core/timeline/frontRunner.ts), set when the replay finishes (null when abandoned). */
  outcome: z.string().nullable().default(null),
});
export type ReplayRecord = z.infer<typeof ReplayRecordSchema>;

export const TimelineStoreSchema = z.object({
  /** Newest first. */
  genesis: z.array(RunGenesisSchema).default([]),
  /** Newest first. */
  replays: z.array(ReplayRecordSchema).default([]),
});
export type TimelineStore = z.infer<typeof TimelineStoreSchema>;

export const emptyTimelineStore = (): TimelineStore => ({ genesis: [], replays: [] });

