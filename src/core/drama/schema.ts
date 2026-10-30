// Battle Drama Engine: data file and the per-battle state (what was already said).
// The state only stops repeats; it never changes a battle outcome.

import { z } from 'zod';
import dramaJson from '../../data/drama.json';

export const VOICES = ['brash', 'gentle', 'calm', 'grim', 'cheerful'] as const;
export type Voice = (typeof VOICES)[number];

export const DIALOGUE_CATEGORIES = [
  'opening', 'command', 'declaration', 'reactionCrit', 'reactionHurt', 'ownKo', 'foeKo', 'switch',
  'desperation', 'taunt', 'defeat', 'victory', 'callbackWon', 'callbackLost',
] as const;
export type DialogueCategory = (typeof DIALOGUE_CATEGORIES)[number];

/** How big a moment is: ambient lines are dropped first, climactic ones always show. */
export const TIERS = ['ambient', 'tactical', 'major', 'climactic'] as const;
export type Tier = (typeof TIERS)[number];

const VoiceLines = z.object(Object.fromEntries(VOICES.map((v) => [v, z.array(z.string().min(1)).min(1)])) as Record<Voice, z.ZodArray<z.ZodString>>);

export const DramaDataSchema = z.object({
  note: z.string(),
  config: z.object({
    budget: z.object({ ordinary: z.number().int().min(0), gym: z.number().int().min(0), rival: z.number().int().min(0), boss: z.number().int().min(0) }),
    minGapTurns: z.number().int().min(0),
    recentLines: z.number().int().min(1),
    frequency: z.object({ off: z.number(), low: z.number(), normal: z.number(), high: z.number() }),
    declarationMoveBpMin: z.number().int().min(1),
    desperationHpShare: z.number().min(0).max(1),
  }),
  voices: z.record(z.string(), z.string()),
  lines: z.object(Object.fromEntries(DIALOGUE_CATEGORIES.map((c) => [c, VoiceLines])) as Record<DialogueCategory, typeof VoiceLines>),
});
export const DRAMA = DramaDataSchema.parse(dramaJson);

export const DramaBattleSchema = z.object({
  /** Drama event ids already handled (a replayed turn or reloaded save never says anything twice). */
  seen: z.array(z.string()).default([]),
  /** Ids of the latest lines spoken (category/voice/index), so none repeats soon. */
  recent: z.array(z.string()).default([]),
  /** The turn each category was last spoken, for the minimum gap. */
  lastTurn: z.record(z.string(), z.number().int()).default({}),
  /** Lines shown this battle, against the budget. */
  lines: z.number().int().min(0).default(0),
  /** The most recent turn a non-ambient line was shown. */
  lastLineTurn: z.number().int().default(-99),
  /** What the trainer has seen you do (visible moves only). */
  playerMoves: z.record(z.string(), z.number().int().min(0)).default({}),
});
export type DramaBattle = z.infer<typeof DramaBattleSchema>;
export const freshDrama = (): DramaBattle => DramaBattleSchema.parse({});

export const DIALOGUE_FREQUENCIES = ['off', 'low', 'normal', 'high'] as const;
export type DialogueFrequency = (typeof DIALOGUE_FREQUENCIES)[number];
