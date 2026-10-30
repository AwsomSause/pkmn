// Rivals (Living Rivalry Engine, slice 1): data file and the per-run record.
// Run state only; account-wide rival state is a separate layer (not built yet).

import { z } from 'zod';
import arcsJson from '../../data/rivalArcs.json';
import pathsJson from '../../data/rivalPaths.json';
import profilesJson from '../../data/rivalProfiles.json';
import rivalsJson from '../../data/rivals.json';

import { TraitsSchema } from '../story/schema';

export { TRAIT_KEYS, type Traits } from '../story/schema';

export const RivalConfigSchema = z.object({
  maxRivals: z.number().int().min(1),
  spark: z.object({
    ordinaryGain: z.number().min(0),
    closeGain: z.number().min(0),
    closeHpShare: z.number().min(0).max(1),
    flawlessGain: z.number().min(0),
    threshold: z.number().min(1),
    dominantHpShare: z.number().min(0).max(1),
    dominantMaxTurns: z.number().int().min(1),
  }),
  traitSpread: z.number().int().min(0).max(50),
  states: z.object({ recurringAt: z.number(), activeAt: z.number(), nemesisAt: z.number(), nemesisMinVindictiveness: z.number(), contenderAt: z.number(), contenderMinAmbition: z.number() }),
  outcomes: z.object({ allyAt: z.number(), allyMinEncounters: z.number().int(), allyMinEmpathy: z.number(), allyMaxPride: z.number(), discourageMaxResilience: z.number(), discourageLoss: z.number(), retireAtSetbacks: z.number().int() }),
  /** Rival Scheduler (doc §13): stages a rival of each ladder state waits between appearances, the floor for any rival, and the pause after any rival appears. */
  /** Optional legacy layer (doc §11): how often an archived rival's character shapes a new one, and the archive's size. */
  legacy: z.object({ chance: z.number().min(0).max(1), minEncounters: z.number().int().min(0), states: z.array(z.string()), archiveMax: z.number().int().min(1), traitBlend: z.number().min(0).max(1) }),
  /** Examples §8: an alliance forms between friends or partners who both lost to you; identity shifts come from a mentor or a grudge. */
  alliance: z.object({ chance: z.number().min(0).max(1) }),
  identity: z.object({ mentorChance: z.number().min(0).max(1), mentorMinAdaptability: z.number(), grudgeSetbacks: z.number().int(), grudgeMaxEmpathy: z.number() }),
  scheduler: z.object({ intervals: z.record(z.string(), z.number().int().min(1)), minGap: z.number().int().min(1), anyGap: z.number().int().min(0) }),
  world: z.object({ unseenWinBase: z.number(), progressCap: z.number().int(), unseenWinPotential: z.number(), privateGoalChance: z.number(), privateGoalMinAmbition: z.number(), fragileResilience: z.number(), toughResilience: z.number(), edgeChance: z.number(), distortedRumorChance: z.number(), friendMinEmpathy: z.number(), rivalMinAmbition: z.number() }),
  relations: z.object({ exchangeChance: z.number(), exchangeShift: z.number(), influenceConfidence: z.number(), triangleGain: z.number(), triangleMinVindictiveness: z.number(), substituteStrain: z.number(), legacyCloseNote: z.boolean() }),
  ultimate: z.object({
    weights: z.object({ intensity: z.number(), history: z.number(), threat: z.number(), stakes: z.number(), relevance: z.number(), progression: z.number(), unresolved: z.number() }),
    minEncounters: z.number().int().min(0),
    switchMargin: z.number().min(0),
  }),
});
export type RivalConfig = z.infer<typeof RivalConfigSchema>;
const StatSchema = z.enum(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
export const RivalProfilesSchema = z.object({
  note: z.string(),
  personalities: z.record(z.string(), z.object({ status: z.enum(['planned', 'limited', 'supported', 'disabled']), traits: TraitsSchema, styles: z.array(z.string()).min(1) })),
  styles: z.record(z.string(), z.object({ status: z.enum(['planned', 'limited', 'supported', 'disabled']), ai: z.number().min(0).max(1), statBias: z.array(StatSchema), extraAdaptations: z.number().int().min(0) })),
  mechanics: z.record(z.string(), z.object({ status: z.enum(['planned', 'limited', 'supported', 'disabled']), note: z.string() })),
  thresholds: z.object({ minAdaptability: z.number(), vindictiveBonusAt: z.number(), forgivingPenaltyAt: z.number() }),
});
export const RIVAL_PROFILES = RivalProfilesSchema.parse(profilesJson);

export const RIVAL_CONFIG: RivalConfig = RivalConfigSchema.parse(rivalsJson);

export type { Rival } from '../story/schema';

export const RivalPathsSchema = z.object({
  note: z.string(),
  paths: z.array(
    z.object({
      id: z.string(),
      when: z.object({
        dominant: z.boolean().optional(),
        close: z.boolean().optional(),
        returning: z.boolean().optional(),
        secondInRegion: z.boolean().optional(),
        personalities: z.array(z.string()).optional(),
        minPride: z.number().optional(),
        minAmbition: z.number().optional(),
        minRegion: z.number().int().optional(),
      }),
      traitNudge: z.record(z.string(), z.number()),
      potentialBonus: z.number(),
      line: z.string(),
    }),
  ).min(1),
});
export const RIVAL_PATHS = RivalPathsSchema.parse(pathsJson);

export const RivalArcsSchema = z.object({
  note: z.string(),
  turnEncounters: z.number().int(),
  turnTicks: z.number().int(),
  resolveEncounters: z.number().int(),
  resolveTicks: z.number().int(),
  good: z.record(z.string(), z.number()),
  bad: z.record(z.string(), z.number()),
  goodBase: z.number().min(0).max(1),
  arcs: z.array(z.object({ id: z.string(), personalities: z.array(z.string()), styles: z.array(z.string()), paths: z.array(z.string()), beginning: z.string(), resolution: z.string() })).min(1),
});
export const RIVAL_ARCS = RivalArcsSchema.parse(arcsJson);
