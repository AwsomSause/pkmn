// Battle Drama Engine: data file and the per-battle state (what was already said).
// The state only stops repeats; it never changes a battle outcome.

import { z } from 'zod';
import dramaJson from '../../data/drama.json';
import eventsJson from '../../data/dramaEvents.json';

export const VOICES = ['brash', 'gentle', 'calm', 'grim', 'cheerful'] as const;
export type Voice = (typeof VOICES)[number];

export const DIALOGUE_CATEGORIES = [
  'opening', 'command', 'declaration', 'reactionCrit', 'reactionHurt', 'ownKo', 'foeKo', 'switch',
  'desperation', 'taunt', 'defeat', 'victory', 'callbackWon', 'callbackLost',
  'status', 'statusInflict', 'miss', 'foeMiss', 'survived', 'encourage', 'evolveReady',
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
    frequency: z.object({ normal: z.number(), high: z.number() }),
    declarationMoveBpMin: z.number().int().min(1),
    desperationHpShare: z.number().min(0).max(1),
  }),
  voices: z.record(z.string(), z.string()),
  lines: z.object(Object.fromEntries(DIALOGUE_CATEGORIES.map((c) => [c, VoiceLines])) as Record<DialogueCategory, typeof VoiceLines>),
  /** Extra lines picked by bond, rival arc and your trainer's favoured type: tag -> category -> lines. */
  flavor: z.record(z.string(), z.record(z.string(), z.array(z.string().min(1)).min(1))).default({}),
  /** What the trainer says once the battle is over, from what you really did ({move}, {foe}). */
  afterBattle: z.object({ win: z.array(z.string().min(1)).min(1), lose: z.array(z.string().min(1)).min(1) }),
  /** Your own Pokémon's declarations ({name}, {move}). */
  playerDeclarations: z.object({ lastStand: z.array(z.string().min(1)).min(1), finisher: z.array(z.string().min(1)).min(1), bold: z.array(z.string().min(1)).min(1) }),
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
  /** Enemy Pokémon (uids) allowed to evolve in this battle, and those that already did. */
  evolvable: z.array(z.string()).default([]),
  evolved: z.array(z.string()).default([]),
  /** Bond Engine, once per battle: Pokémon that refused a command, took initiative, practiced pairs that handed over, Pokémon that revealed a move. */
  refused: z.array(z.string()).default([]),
  initiated: z.array(z.string()).default([]),
  combos: z.array(z.string()).default([]),
  revealed: z.array(z.string()).default([]),
  /** What each Pokémon felt this battle, and the emotions already turned into a turning point. */
  feelings: z.record(z.string(), z.record(z.string(), z.number().int().min(0))).default({}),
  turned: z.array(z.string()).default([]),
  /** Battle recap tally (catalog 14): damage dealt per Pokémon, narrowest survival, biggest hit. Optional: older saves have none. */
  recap: z.object({
    dealt: z.record(z.string(), z.number()).default({}),
    low: z.object({ uid: z.string(), share: z.number() }).nullable().default(null),
    bigHit: z.object({ uid: z.string(), moveId: z.string(), amount: z.number() }).nullable().default(null),
  }).optional(),
});
export type DramaBattle = z.infer<typeof DramaBattleSchema>;
export const freshDrama = (): DramaBattle => DramaBattleSchema.parse({});

export const DIALOGUE_FREQUENCIES = ['off', 'low', 'normal', 'high'] as const;
export type DialogueFrequency = (typeof DIALOGUE_FREQUENCIES)[number];

// ---------- the rare-event library (guide §5, Phase 6) and signature declarations (Phase 4) ----------


export const DECLARATION_STYLES = ['warning', 'signature', 'promise', 'desperateGamble', 'tacticalCall', 'showman', 'quietThreat', 'personalCallback'] as const;
export type DeclarationStyle = (typeof DECLARATION_STYLES)[number];

export const DramaEventDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** planned: needs a system that is not built yet (no check exists). */
  status: z.enum(['planned', 'limited', 'supported', 'disabled']),
  severity: z.enum(['tactical', 'major', 'climactic']),
  cooldownBattles: z.number().int().min(0),
  /** Percent chance once eligible (picked by hashing, not by gameplay RNG). */
  chance: z.number().min(0).max(100),
  /** Writes a Chronicle entry and a rival memory flag. */
  records: z.boolean(),
  requires: z.string(),
  lines: z.array(z.string()),
  voices: z.array(z.enum(VOICES)).optional(),
  classes: z.array(z.enum(['ordinary', 'gym', 'rival', 'boss'])).optional(),
  /** What a rival says about it the next time you meet. */
  remember: z.string().optional(),
  /** Trait changes it makes to the rival (clamped 0–100) and the Chronicle line for them. */
  /** Fair AI influence: added to how often the trainer picks its best move for the rest of the battle (uses only what it has seen). */
  aiShift: z.number().min(-1).max(1).optional(),
  traitShift: z.record(z.string(), z.number().int()).optional(),
  shiftText: z.string().optional(),
});
export type DramaEventDef = z.infer<typeof DramaEventDefSchema>;

const lineList = z.array(z.string().min(1)).min(1);
export const DramaLibrarySchema = z.object({
  note: z.string(),
  events: z.array(DramaEventDefSchema),
  declarations: z.object(Object.fromEntries(DECLARATION_STYLES.map((s) => [s, lineList])) as Record<DeclarationStyle, typeof lineList>),
  aftermath: z.object({ hit: lineList, miss: lineList, ko: lineList }),
});
export const DRAMA_LIBRARY = DramaLibrarySchema.parse(eventsJson);

/** Hash text into a small non-negative integer (FNV-1a). Not a gameplay random stream. */
export function pickIndex(text: string, size: number): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % size;
}
