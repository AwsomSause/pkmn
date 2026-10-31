// Run Journal, Hall of Memories, Ghost Trainers, Heirlooms and the world's memory (APPROVED.md sections 3, 7, 8).
// Plain schemas and the data file's config; no imports from the rest of core so state.ts can use them.

import { z } from 'zod';
import cfgJson from '../../data/memories.json';

/** A Legacy Descendant's lineage: the ancestor, and the one trait it carries. */
export const LineageSchema = z.object({ ancestor: z.string(), runId: z.string(), trait: z.string(), moveId: z.string().optional(), nature: z.string().optional() });
export type Lineage = z.infer<typeof LineageSchema>;

export const REPLAY_KINDS = ['gym', 'elite', 'champion', 'rival', 'nemesis', 'ghost', 'gauntlet', 'echo'] as const;
export const BattleReplaySchema = z.object({
  id: z.string(),
  kind: z.enum(REPLAY_KINDS),
  title: z.string(),
  outcome: z.enum(['win', 'lose']),
  region: z.number().int().min(0),
  stage: z.number().int().min(0),
  foe: z.object({ name: z.string(), team: z.array(z.string()) }),
  /** The species of your Pokémon that fought. */
  team: z.array(z.string()),
  turns: z.number().int().min(0),
  lines: z.array(z.string()),
});
export type BattleReplay = z.infer<typeof BattleReplaySchema>;

export const ConsequenceSchema = z.object({
  id: z.string(),
  kind: z.enum(['echo', 'thanks', 'grudge']),
  text: z.string(),
  /** regionIndex * 100 + stage index: the first stage it can come due. */
  due: z.number().int().min(0),
  done: z.boolean().default(false),
});
export type Consequence = z.infer<typeof ConsequenceSchema>;

export const WorldMemorySchema = z.object({
  /** Side stops and harder roads passed by: Branch Memory. */
  skipped: z.array(z.object({ id: z.string(), kind: z.enum(['event', 'minigame', 'expedition', 'service', 'harder']), label: z.string(), region: z.number().int().min(0), stage: z.number().int().min(0) })).default([]),
  consequences: z.array(ConsequenceSchema).default([]),
  /** Villain operations by id: the step told so far, the clues you found, how it ended. */
  ops: z.record(z.string(), z.object({ step: z.number().int().min(0), clues: z.number().int().min(0), outcome: z.enum(['running', 'foiled', 'succeeded']) })).default({}),
  /** Event choices that helped or turned away someone (what the world remembers you by). */
  helped: z.number().int().min(0).default(0),
  declined: z.number().int().min(0).default(0),
  /** Recurring NPCs by id: the beat last told. */
  npcs: z.record(z.string(), z.number().int().min(0)).default({}),
});
export type WorldMemory = z.infer<typeof WorldMemorySchema>;
export const freshWorld = (): WorldMemory => WorldMemorySchema.parse({});

const PastMonSchema = z.object({ speciesId: z.string(), level: z.number().int().min(1), moves: z.array(z.string()) });
/** What a new run is told about the player's earlier runs: a small snapshot, so the run never reads the profile. */
export const PastDigestSchema = z.object({
  ghosts: z.array(z.object({ runId: z.string(), trainer: z.string(), classId: z.string(), region: z.string(), team: z.array(PastMonSchema), fell: z.string(), memento: z.string().nullable() })).default([]),
  gauntlet: z.array(z.object({ runId: z.string(), trainer: z.string(), classId: z.string(), team: z.array(PastMonSchema) })).default([]),
  keepsakes: z.array(z.object({ id: z.string(), itemId: z.string(), owner: z.string(), runId: z.string(), line: z.string() })).default([]),
  friends: z.array(z.object({ id: z.string(), name: z.string(), speciesId: z.string().nullable(), line: z.string() })).default([]),
  /** Ids used this run (ghosts laid to rest, keepsakes recovered, cameos met): written to the profile when the run ends. */
  used: z.array(z.string()).default([]),
});
export type PastDigest = z.infer<typeof PastDigestSchema>;

export const HEIRLOOM_KINDS = ['egg', 'item', 'move', 'trait'] as const;
export const HeirloomOptionSchema = z.object({
  id: z.enum(HEIRLOOM_KINDS),
  label: z.string(),
  text: z.string(),
  itemId: z.string().optional(),
  moveId: z.string().optional(),
  nature: z.string().optional(),
});
export type HeirloomOption = z.infer<typeof HeirloomOptionSchema>;

/** A Legacy Pokémon: the Ace of a finished run, waiting for the player to choose what it passes on. */
export const HeirloomSchema = z.object({
  runId: z.string(),
  speciesId: z.string(),
  name: z.string(),
  level: z.number().int(),
  shiny: z.boolean(),
  trainer: z.string(),
  options: z.array(HeirloomOptionSchema),
  /** The option picked (null: not chosen yet). */
  chosen: z.enum(HEIRLOOM_KINDS).nullable().default(null),
  /** Handed over to a run. */
  spent: z.boolean().default(false),
});
export type Heirloom = z.infer<typeof HeirloomSchema>;

export const MemoriesSchema = z.object({
  heirlooms: z.array(HeirloomSchema).default([]),
  /** Ghosts laid to rest, keepsakes recovered and cameos met (ids from PastDigest). */
  claimed: z.array(z.string()).default([]),
  cameos: z.array(z.string()).default([]),
});
export type Memories = z.infer<typeof MemoriesSchema>;

const Op = z.object({ id: z.string(), org: z.string(), name: z.string(), steps: z.array(z.string()).length(3), foiled: z.string(), succeeded: z.string() });
const Npc = z.object({ id: z.string(), name: z.string(), beats: z.array(z.string()).length(3), badBeats: z.array(z.string()).length(3), item: z.string(), money: z.number().int().min(0) });
const MemoriesConfigSchema = z.object({
  note: z.string(),
  replay: z.object({ maxLines: z.number().int().min(4), maxPerRun: z.number().int().min(1), turnLinesCap: z.number().int().min(1) }),
  hall: z.object({ size: z.number().int().min(1), minScore: z.number() }),
  fallen: z.object({ wins: z.number().int().min(1) }),
  digest: z.object({ ghosts: z.number().int(), gauntlet: z.number().int(), keepsakes: z.number().int(), friends: z.number().int() }),
  ghosts: z.object({ chance: z.number().min(0).max(1), perRun: z.number().int().min(1), levelBonus: z.number().int(), moneyPerLevel: z.number().int(), mementoFallback: z.string(), minEncounters: z.number().int().min(0) }),
  gauntlet: z.object({ teams: z.number().int().min(1).max(5), levelBonus: z.number().int(), money: z.number().int(), item: z.string(), itemCount: z.number().int().min(1) }),
  heirloom: z.object({ keep: z.number().int().min(1), eggLevel: z.number().int().min(1), eggStages: z.number().int().min(1), minLevel: z.number().int().min(1), itemFallback: z.string() }),
  world: z.object({ skippedKeep: z.number().int(), perStage: z.number().int(), echoDelay: z.number().int(), echoLevelBonus: z.number().int(), echoMoneyPerLevel: z.number().int(), echoItem: z.string(), thanksMoney: z.number().int(), thanksDelay: z.number().int(), grudgeMoney: z.number().int(), moralityAt: z.number() }),
  cameo: z.object({ chance: z.number().min(0).max(1), money: z.number().int(), friendship: z.number().int() }),
  lostFound: z.object({ chance: z.number().min(0).max(1), discount: z.number().min(0).max(1) }),
  ops: z.object({ start: z.number().min(0).max(1), clues: z.number().int().min(1), reward: z.number().int(), loss: z.number().min(0).max(1), lossMax: z.number().int() }),
  operations: z.array(Op),
  npcs: z.array(Npc),
});
export const MEMORIES = MemoriesConfigSchema.parse(cfgJson);
