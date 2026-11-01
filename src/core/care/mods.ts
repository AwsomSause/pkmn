// Care & party life (W2): the per-Pokémon care record and the small stat nudges it gives.
// A leaf file (no game imports) so core/pokemon.ts can read it without a cycle.

import { z } from 'zod';
import careJson from '../../data/care.json';

const CareDataSchema = z.object({
  flavors: z.array(z.string()).length(5),
  moodRange: z.number().int().min(1),
  moodStatPercent: z.number().min(0),
  fatigue: z.object({ perFight: z.number().int(), max: z.number().int(), statPercent: z.number(), benchedRecovery: z.number().int() }),
  pet: z.object({ perStop: z.number().int(), friendship: z.number().int() }),
  hug: z.object({ friendship: z.number().int(), affection: z.number().int(), mood: z.number().int() }),
  feed: z.object({
    liked: z.object({ friendship: z.number().int(), mood: z.number().int() }),
    neutral: z.object({ friendship: z.number().int(), mood: z.number().int() }),
    hated: z.object({ friendship: z.number().int(), mood: z.number().int() }),
    sulkStops: z.number().int(),
  }),
  groom: z.object({ friendship: z.number().int() }),
  lullaby: z.object({ healShare: z.number().min(0).max(1), friendship: z.number().int() }),
  cheer: z.object({ mood: z.number().int(), lowMoodBonus: z.number().int() }),
  train: z.object({ fights: z.number().int().min(1), statPercent: z.number() }),
  talent: z.object({ afterFights: z.number().int().min(1), minFriendship: z.number().int(), statPercent: z.number() }),
  winMood: z.number().int(),
  faintMood: z.number().int(),
  benchedWinsToSulk: z.number().int().min(1),
  nicknameMax: z.number().int().min(1),
  accessories: z.record(z.string(), z.object({ stat: z.enum(['atk', 'def', 'spa', 'spd', 'spe']), percent: z.number() })),
  sing: z.object({ eggSteps: z.number().int().min(1) }),
  releaseGift: z.object({ candiesPerLevels: z.number().int().min(1) }),
  quips: z.record(z.string(), z.array(z.string()).min(1)),
});
export const CARE = CareDataSchema.parse(careJson);

/** What one Pokémon remembers about how it has been treated. Every field is optional/defaulted: older saves load unchanged. */
export const CareSchema = z.object({
  nickname: z.string().max(24).optional(),
  /** -moodRange..+moodRange; nudges non-HP stats by moodStatPercent per step. */
  mood: z.number().int().default(0),
  /** Fights in a row without a rest on the bench; each takes statPercent off non-HP stats (up to max). */
  fatigue: z.number().int().min(0).default(0),
  fights: z.number().int().min(0).default(0),
  wins: z.number().int().min(0).default(0),
  falls: z.number().int().min(0).default(0),
  /** Won battles spent on the bench (3 in a row and it sulks). */
  benchedWins: z.number().int().min(0).default(0),
  /** The stop clock (run.encountersCompleted) when each care action was last used, and how often at that stop. */
  stop: z.number().int().default(-1),
  done: z.record(z.string(), z.number().int()).default({}),
  /** Refuses food until this stop clock value (a hated flavor). */
  sulkUntil: z.number().int().default(-1),
  favourite: z.boolean().optional(),
  ace: z.boolean().optional(),
  sparkle: z.boolean().optional(),
  /** Dress-up: a worn accessory (a key of data/care.json accessories) with a tiny stat buff. */
  accessory: z.string().optional(),
  /** Hidden talent: a stat that grew on its own after enough fights. */
  talent: z.enum(['atk', 'def', 'spa', 'spd', 'spe']).optional(),
  /** Training focus: this stat gets a boost for `left` more fights. */
  train: z.object({ stat: z.enum(['atk', 'def', 'spa', 'spd', 'spe']), left: z.number().int().min(0) }).optional(),
});
export type Care = z.infer<typeof CareSchema>;

/** Stat multiplier from mood, fatigue, talent and training (1 = no change). HP is never touched. */
export function careMultiplier(care: Care | undefined, stat: string): number {
  if (!care || stat === 'hp') return 1;
  const mood = Math.max(-CARE.moodRange, Math.min(CARE.moodRange, care.mood));
  let pct = mood * CARE.moodStatPercent - Math.min(care.fatigue, CARE.fatigue.max) * CARE.fatigue.statPercent;
  if (care.talent === stat) pct += CARE.talent.statPercent;
  if (care.train && care.train.left > 0 && care.train.stat === stat) pct += CARE.train.statPercent;
  const acc = care.accessory ? CARE.accessories[care.accessory] : undefined;
  if (acc && acc.stat === stat) pct += acc.percent;
  return Math.max(0.5, 1 + pct / 100);
}
