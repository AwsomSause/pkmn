// Rivals (Living Rivalry Engine, slice 1): data file and the per-run record.
// Run state only; account-wide rival state is a separate layer (not built yet).

import { z } from 'zod';
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
  }),
  traitSpread: z.number().int().min(0).max(50),
  states: z.object({ recurringAt: z.number(), activeAt: z.number(), nemesisAt: z.number(), nemesisMinVindictiveness: z.number(), contenderAt: z.number(), contenderMinAmbition: z.number() }),
  outcomes: z.object({ allyAt: z.number(), allyMinEncounters: z.number().int(), allyMinEmpathy: z.number(), allyMaxPride: z.number(), discourageMaxResilience: z.number(), discourageLoss: z.number(), retireAtSetbacks: z.number().int() }),
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
  thresholds: z.object({ minAdaptability: z.number(), vindictiveBonusAt: z.number(), forgivingPenaltyAt: z.number() }),
});
export const RIVAL_PROFILES = RivalProfilesSchema.parse(profilesJson);

export const RIVAL_CONFIG: RivalConfig = RivalConfigSchema.parse(rivalsJson);

export type { Rival } from '../story/schema';
