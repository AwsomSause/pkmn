// Rivals (Living Rivalry Engine, slice 1): data file and the per-run record.
// Run state only; account-wide rival state is a separate layer (not built yet).

import { z } from 'zod';
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
  archetypes: z.array(z.object({ id: z.string(), name: z.string(), style: z.string(), traits: TraitsSchema })).min(1),
  traitSpread: z.number().int().min(0).max(50),
});
export type RivalConfig = z.infer<typeof RivalConfigSchema>;
export const RIVAL_CONFIG: RivalConfig = RivalConfigSchema.parse(rivalsJson);

export type { Rival } from '../story/schema';
