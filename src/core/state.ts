// Shapes of the game's changing state: Pokémon instances, battles, the run,
// and the permanent profile. These schemas double as save-file validators,
// so the game refuses to load a save that doesn't match.

import { z } from 'zod';
import { BoostStatSchema, StatNameSchema, StatusIdSchema } from './contentSchema';
import { STREAM_NAMES, type StreamName } from './rng';

const RngStateSchema = z.object({ a: z.number(), b: z.number(), c: z.number(), d: z.number() });
export const RngStreamsSchema = z.object(
  Object.fromEntries(STREAM_NAMES.map((n) => [n, RngStateSchema])) as Record<StreamName, typeof RngStateSchema>,
);

export const MoveSlotSchema = z.object({ id: z.string(), pp: z.number().int().min(0) });
export type MoveSlot = z.infer<typeof MoveSlotSchema>;

export const StatusSchema = z.object({
  id: StatusIdSchema,
  /** Sleep only: turns the Pokémon will still skip. */
  turns: z.number().int().min(0).optional(),
});
export type Status = z.infer<typeof StatusSchema>;

/** One individual Pokémon (separate from its species definition). */
export const PokemonInstanceSchema = z.object({
  uid: z.string(),
  speciesId: z.string(),
  level: z.number().int().min(1).max(100),
  /** Total experience points (the level is derived from growth rate). */
  xp: z.number().int().min(0),
  hp: z.number().int().min(0),
  moves: z.array(MoveSlotSchema).min(1).max(4),
  status: StatusSchema.nullable(),
  /** Vitamin stacks per stat; each stack multiplies that stat. */
  vitamins: z.record(StatNameSchema, z.number().int().min(0)),
  shiny: z.boolean(),
});
export type PokemonInstance = z.infer<typeof PokemonInstanceSchema>;

export const StagesSchema = z.record(BoostStatSchema, z.number().int().min(-6).max(6));
export type Stages = z.infer<typeof StagesSchema>;

export const LevelBreakdownSchema = z.object({
  base: z.number(),
  progress: z.number(),
  variance: z.number(),
  archetypeOffset: z.number(),
  bonus: z.number(),
  unclamped: z.number(),
  level: z.number(),
});
export type LevelBreakdown = z.infer<typeof LevelBreakdownSchema>;

export const BattleStateSchema = z.object({
  kind: z.enum(['wild', 'trainer']),
  turn: z.number().int().min(1),
  /** Index into run.party of the Pokémon currently fighting. */
  activeIndex: z.number().int().min(0),
  /** The opposing team (one Pokémon for wild battles). */
  enemyTeam: z.array(PokemonInstanceSchema).min(1).max(6),
  /** Which member of enemyTeam is out. */
  enemyIndex: z.number().int().min(0),
  /** The opposing trainer. `leaderId` is set for gym leaders (classId is then "gym-leader"). */
  trainer: z.object({ classId: z.string(), name: z.string(), leaderId: z.string().nullable().default(null) }).nullable(),
  playerStages: StagesSchema,
  enemyStages: StagesSchema,
  /** uids of party Pokémon that fought the current enemy (they share its experience). */
  participants: z.array(z.string()),
  /** True when the active Pokémon fainted and the player must send out another. */
  needsSwitch: z.boolean(),
  /** The Last Stand Charm can only save the player once per battle. */
  lastStandUsed: z.boolean(),
  outcome: z.enum(['win', 'lose', 'caught']).nullable(),
  /** How each enemy's level was worked out (shown in the debug panel). */
  levelInfo: z.array(LevelBreakdownSchema).default([]),
  /** 0–1: the chance each turn that the enemy picks its best move (bosses), otherwise a random one. */
  ai: z.number().min(0).max(1).default(0),
});
export type BattleState = z.infer<typeof BattleStateSchema>;

// ---------- stage maps ----------

export const SideStopSchema = z.object({
  id: z.string(),
  kind: z.enum(['heal', 'shop']),
  /** A healing stop works once; a shop can be visited again. */
  used: z.boolean(),
});
export type SideStop = z.infer<typeof SideStopSchema>;

export const MapNodeSchema = z.object({
  id: z.string(),
  /** 1-based level number on the stage (every route visits each column once). */
  column: z.number().int().min(1),
  /** Position within the column, top to bottom. */
  row: z.number().int().min(0),
  kind: z.enum(['wild', 'trainer', 'gym', 'elite', 'champion']),
  /** A harder route: stronger enemies, better rewards. */
  harder: z.boolean(),
  /** ids of the nodes in the next column this node leads to. */
  next: z.array(z.string()),
  /** Optional stops beside this node (they don't count as levels). */
  sides: z.array(SideStopSchema),
  /** How the generator made this node, for debugging. */
  note: z.string(),
});
export type MapNode = z.infer<typeof MapNodeSchema>;

export const StageMapSchema = z.object({
  columns: z.number().int().min(1),
  nodes: z.array(MapNodeSchema).min(1),
  trainerColumns: z.array(z.number().int()),
});
export type StageMap = z.infer<typeof StageMapSchema>;

export const StageStateSchema = z.object({
  /** "stage" is a themed stage ending at a gym; "league" is the Elite Four and champion. */
  kind: z.enum(['stage', 'league']).default('stage'),
  /** 0 for the first stage of the region (the league comes after the last stage). */
  index: z.number().int().min(0),
  /** The theme (for the league: the region's last stage theme, used for the champion's team). */
  themeId: z.string(),
  /** The gym leader waiting at the last column (for the league: the champion). */
  leaderId: z.string(),
  /** League only: the Elite Four members, in order. */
  eliteFour: z.array(z.string()).default([]),
  map: StageMapSchema,
  /** The node the player is on (null before choosing the first one). */
  current: z.string().nullable(),
  visited: z.array(z.string()),
});
export type StageState = z.infer<typeof StageStateSchema>;

export function currentEnemy(battle: BattleState): PokemonInstance {
  const enemy = battle.enemyTeam[battle.enemyIndex];
  if (!enemy) throw new Error('No enemy Pokémon is out');
  return enemy;
}

/** Choices the player must make before the run continues. */
export const PendingDecisionSchema = z.discriminatedUnion('kind', [
  /** A Pokémon that knows four moves wants to learn another. */
  z.object({ kind: z.literal('learnMove'), uid: z.string(), moveId: z.string() }),
  /** A caught Pokémon waiting to join the party (or be released for candies). */
  z.object({ kind: z.literal('caught'), mon: PokemonInstanceSchema }),
]);
export type PendingDecision = z.infer<typeof PendingDecisionSchema>;

export const RunPhaseSchema = z.enum(['starter', 'map', 'shop', 'battle', 'decision', 'reward', 'over']);
export type RunPhase = z.infer<typeof RunPhaseSchema>;

export const RunStateSchema = z.object({
  runId: z.string(),
  seed: z.string(),
  archetypeId: z.string(),
  phase: RunPhaseSchema,
  starterChoices: z.array(z.string()),
  party: z.array(PokemonInstanceSchema),
  money: z.number().int().min(0),
  /** Bag contents: item id → count. */
  inventory: z.record(z.string(), z.number().int().min(0)),
  /** Candies earned this run; added to the profile when the run ends (D7). */
  candies: z.number().int().min(0),
  /** Number of encounters completed so far. */
  encountersCompleted: z.number().int().min(0),
  battle: BattleStateSchema.nullable(),
  /** Decisions to make after a battle, oldest first. */
  pending: z.array(PendingDecisionSchema),
  /** Where the run goes once all pending decisions are made. */
  afterDecisions: z.enum(['reward', 'map']),
  /** The current stage and its map (null only for saves from before stage maps existed). */
  stage: StageStateSchema.nullable(),
  /** Themes and bosses (gym leaders, Elite Four, champions) already used this run (they never repeat, D6). */
  usedThemes: z.array(z.string()),
  usedLeaders: z.array(z.string()),
  /** Gym leaders beaten, in order. */
  badges: z.array(z.string()),
  /** Which campaign shape this run uses ("full", or "dev" for quick testing). */
  campaignId: z.string(),
  /** Region ids in the order this run visits them (shuffled per run; the Grand Region is last). */
  regionOrder: z.array(z.string()),
  regionIndex: z.number().int().min(0),
  /** Regions whose champion has been beaten. */
  regionsCleared: z.array(z.string()),
  /** True once the last region's champion is beaten. */
  victory: z.boolean(),
  /** The five reward ids on offer, while phase is "reward". */
  draft: z.array(z.string()).nullable(),
  /** Run-only additive modifiers for the ten attributes (no effects yet). */
  attributeModifiers: z.record(z.string(), z.number()),
  rng: RngStreamsSchema,
  nextUid: z.number().int().min(1),
  log: z.object({
    rewardsTaken: z.array(z.string()),
    battlesWon: z.number().int().min(0),
    /** This run's counters (names in contentSchema COUNTER_NAMES); added to the profile when the run ends. */
    counters: z.record(z.string(), z.number().int().min(0)),
    /** Species met and caught this run, for the profile's discoveries. */
    speciesSeen: z.array(z.string()),
    speciesCaught: z.array(z.string()),
    /** True once the Last Stand Charm has saved the run in the current region. */
    charmUsedInRegion: z.boolean(),
    /** What ended the run, when it was lost. */
    defeatedBy: z.object({ speciesId: z.string(), level: z.number().int(), trainer: z.string().nullable() }).nullable(),
  }),
});
export type RunState = z.infer<typeof RunStateSchema>;

export const ATTRIBUTE_NAMES = [
  'strength', 'intelligence', 'speed', 'charisma', 'luck',
  'rage', 'peace', 'good', 'evil', 'love',
] as const;
export type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

/** The Bank's payout for one finished run (GAME_DESIGN.md §14.2). */
export const PayoutSchema = z.object({
  /** Leftover Poké Dollars converted at the Bank's rate. */
  savings: z.number().int().min(0),
  /** Credits for progress, paid even for a lost run. */
  stipend: z.number().int().min(0),
  /** Credits from achievements earned at the end of this run. */
  achievements: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type Payout = z.infer<typeof PayoutSchema>;

/** One finished run, kept in the Run History. */
export const RunRecordSchema = z.object({
  runId: z.string(),
  endedAt: z.string(),
  seed: z.string(),
  archetypeId: z.string(),
  campaignId: z.string(),
  victory: z.boolean(),
  regionsCleared: z.number().int().min(0),
  regions: z.number().int().min(0),
  badges: z.number().int().min(0),
  encounters: z.number().int().min(0),
  defeatedBy: z.object({ speciesId: z.string(), level: z.number().int(), trainer: z.string().nullable() }).nullable(),
  party: z.array(z.object({ speciesId: z.string(), level: z.number().int() })),
  bankCredits: z.number().int().min(0),
  researchPoints: z.number().int().min(0),
  achievements: z.array(z.string()),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

export const ProfileSchema = z.object({
  profileId: z.string(),
  unlockedArchetypes: z.array(z.string()),
  attributes: z.record(z.string(), z.number()),
  /** Permanent Bank currency for upgrades and unlocks (D16). */
  bankCredits: z.number().int().min(0),
  /** Earned from discoveries; spent on starters and research (D16). */
  researchPoints: z.number().int().min(0),
  /** Permanent candies (D7), the fourth currency. */
  candies: z.number().int().min(0),
  stats: z.object({
    runsStarted: z.number().int().min(0),
    runsEnded: z.number().int().min(0),
    battlesWon: z.number().int().min(0),
    bestEncounters: z.number().int().min(0),
  }),
  /** Every counter summed over all runs that count for progress. */
  counters: z.record(z.string(), z.number().int().min(0)),
  /** Each counter's best value in a single run. */
  best: z.record(z.string(), z.number().int().min(0)),
  speciesSeen: z.array(z.string()),
  speciesCaught: z.array(z.string()),
  /** Earned achievements: id → when. */
  achievements: z.record(z.string(), z.object({ earnedAt: z.string() })),
  /** Titles earned from achievements, and the one on show. */
  titles: z.array(z.string()),
  activeTitle: z.string().nullable(),
  lifetimeBankCredits: z.number().int().min(0),
  runHistory: z.array(RunRecordSchema),
  /** What the last finished run paid out (shown on the run-end screen and in the Bank). */
  lastPayout: PayoutSchema.nullable(),
  /** Recently finalized run ids, so a run's result is never applied twice. */
  finalizedRunIds: z.array(z.string()),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.object({
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  muted: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function freshStages(): Stages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}
