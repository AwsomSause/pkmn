// Shapes of the story layer (M8.9-0): domain events, memories, per-Pokémon
// history, relationships, recurring enemies, the run chronicle, and the story
// event definitions in src/data/story.json. Every story system (rivals,
// Hyper moments, the chronicle, the legacy card) reads and writes these.
//
// Definitions describe what CAN happen (data); records describe what DID
// happen in this run (saved with the run).

import { z } from 'zod';
import { AttributeKeySchema, BoostStatSchema } from '../contentSchema';

// ---------- domain events ----------

/** Every kind of domain event. Some are emitted by systems that don't exist yet (trades, Mega, escapes, map events). */
export const DOMAIN_EVENT_TYPES = [
  'runStarted',
  'starterChosen',
  'routeChosen',
  'battleStarted',
  'battleEnded',
  'moveUsed',
  'knockout',
  'closeCall',
  'survivedFatal',
  'statusInflicted',
  'switchIn',
  'switchOut',
  'caught',
  'joinedParty',
  'leftParty',
  'released',
  'traded',
  'evolved',
  'transformed',
  'levelUp',
  'friendshipMilestone',
  'bossBeaten',
  'lostToBoss',
  'trainerEscaped',
  'eventChoice',
  'rewardTaken',
  'storyMoment',
  'runEnded',
] as const;
export const DomainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);
export type DomainEventType = z.infer<typeof DomainEventTypeSchema>;

/** Where in the run something happened. Missing parts are null (before the first stage, outside battle...). */
export const WhereSchema = z.object({
  region: z.number().int().min(0),
  stage: z.number().int().min(0).nullable(),
  /** The map column (level 1–20 of the stage). */
  level: z.number().int().min(0).nullable(),
  node: z.string().nullable(),
  /** Which battle of the run (counted from 0), while in one. */
  battle: z.number().int().min(0).nullable(),
  turn: z.number().int().min(0).nullable(),
});
export type Where = z.infer<typeof WhereSchema>;

const DataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const DomainEventSchema = z.object({
  /** The run seed plus the sequence number, so the same run replayed gets the same ids. */
  id: z.string(),
  seq: z.number().int().min(1),
  type: DomainEventTypeSchema,
  where: WhereSchema,
  /** uids of the Pokémon involved (yours first when it matters). */
  actors: z.array(z.string()),
  /** Small facts about the event (species, move, HP...). Flat values only so saves stay small. */
  data: z.record(z.string(), DataValueSchema),
});
export type DomainEvent = z.infer<typeof DomainEventSchema>;

// ---------- memories, history, relationships, enemies, chronicle ----------

export const MemorySchema = z.object({
  eventId: z.string(),
  seq: z.number().int().min(1),
  type: DomainEventTypeSchema,
  /** Higher is more memorable; decides what is kept when a list is full. */
  importance: z.number().int().min(0).max(100),
  text: z.string(),
  where: WhereSchema,
});
export type Memory = z.infer<typeof MemorySchema>;

/** Everything one of your Pokémon has lived through this run. Keyed by uid, so it survives evolution and form changes. */
export const PokemonHistorySchema = z.object({
  uid: z.string(),
  /** Its species now, and when it joined you. */
  speciesId: z.string(),
  originalSpeciesId: z.string(),
  /** How it joined: the starter, a catch, a gift. */
  joinedBy: z.enum(['starter', 'caught', 'gift']),
  joinedAt: WhereSchema,
  battles: z.number().int().min(0),
  knockoutsDealt: z.number().int().min(0),
  knockoutsTaken: z.number().int().min(0),
  closeCalls: z.number().int().min(0),
  survivedFatal: z.number().int().min(0),
  bossesBeaten: z.number().int().min(0),
  /** Most turns in a row it fought on at low HP, and the current streak. */
  longestLowHpStand: z.number().int().min(0),
  lowHpStreak: z.number().int().min(0),
  /** The last battle (index) it fought in, so each battle is counted once. */
  lastBattle: z.number().int().min(0).nullable(),
  evolutions: z.array(z.object({ from: z.string(), to: z.string(), trigger: z.string(), where: WhereSchema })),
  titles: z.array(z.string()),
  /** Its most important memories (limit in story.json). */
  memories: z.array(MemorySchema),
  /** How many times each Hyper moment (story.json id) has happened to it this run. */
  hyper: z.record(z.string(), z.number().int().min(0)).default({}),
});
export type PokemonHistory = z.infer<typeof PokemonHistorySchema>;

export const EntityRefSchema = z.object({
  kind: z.enum(['pokemon', 'trainer', 'enemy']),
  /** A Pokémon uid, a trainer or boss id, or an EnemyProfile id. */
  id: z.string(),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

export const RELATIONSHIP_KINDS = ['rivalry', 'mentorship', 'bond', 'grudge', 'respect'] as const;
export const RelationshipRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(RELATIONSHIP_KINDS),
  a: EntityRefSchema,
  b: EntityRefSchema,
  /** How far it has developed (0 = just formed). */
  stage: z.number().int().min(0),
  open: z.boolean(),
  formedAt: WhereSchema,
  /** Domain event ids that moved it along (limit in story.json). */
  history: z.array(z.string()),
});
export type RelationshipRecord = z.infer<typeof RelationshipRecordSchema>;

export const EnemyProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The trainer or boss it belongs to, if any. */
  trainerId: z.string().nullable(),
  /** The region (index in the run's order) where it first appeared. */
  region: z.number().int().min(0),
  team: z.array(z.object({ speciesId: z.string(), level: z.number().int().min(1) })).max(6),
  /** Past battles with you (limit in story.json). */
  battles: z.array(z.object({ eventId: z.string(), result: z.enum(['win', 'lose']), where: WhereSchema })),
  /** What it has learned about you (rules come with the nemesis system). */
  adaptations: z.array(z.string()),
});
export type EnemyProfile = z.infer<typeof EnemyProfileSchema>;

export const ChronicleEntrySchema = MemorySchema.extend({ actors: z.array(z.string()) });
export type ChronicleEntry = z.infer<typeof ChronicleEntrySchema>;

/** The story layer's part of a saved run. */
export const StoryStateSchema = z.object({
  /** Last sequence number used (event ids are seed + seq). */
  seq: z.number().int().min(0),
  /** The most recent domain events, oldest first (limit in story.json; histories and the chronicle keep what matters). */
  events: z.array(DomainEventSchema),
  histories: z.record(z.string(), PokemonHistorySchema),
  relationships: z.array(RelationshipRecordSchema),
  enemyProfiles: z.array(EnemyProfileSchema),
  chronicle: z.array(ChronicleEntrySchema),
  /** Ids of run-scope effects already applied: applying one again does nothing. */
  appliedEffects: z.array(z.string()),
  /** Story flags set by effects (for follow-up events). */
  flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  /** Major (cinematic) moments shown in the current battle, for the per-battle budget. */
  majorCuesThisBattle: z.number().int().min(0),
});
export type StoryState = z.infer<typeof StoryStateSchema>;

// ---------- effects ----------

/** A change a story event makes to the game. Each one carries an id; see effects.ts. */
export const StoryEffectSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('money'), amount: z.number().int() }),
  z.object({ kind: z.literal('friendship'), amount: z.number().int() }),
  z.object({ kind: z.literal('attribute'), attribute: AttributeKeySchema, amount: z.number() }),
  z.object({ kind: z.literal('item'), itemId: z.string(), quantity: z.number().int().positive() }),
  z.object({ kind: z.literal('flag'), flag: z.string(), value: z.union([z.boolean(), z.number(), z.string()]) }),
  /** Battle scope: raises (or lowers) a stat stage of the Pokémon in battle. */
  z.object({ kind: z.literal('statStage'), stat: BoostStatSchema, stages: z.number().int().min(-6).max(6) }),
  /** Battle scope: the Pokémon hangs on at 1 HP (the engine does it; the effect records that it was used). */
  z.object({ kind: z.literal('endure') }),
  /** Battle scope: a knocked-out Pokémon gets back up with this share of its max HP (the engine does it). */
  z.object({ kind: z.literal('revive'), hpShare: z.number().gt(0).max(1) }),
  /** Battle scope: hangs on at 1 HP against a fatal hit, or shakes off a status at the end of a turn (the engine does it). */
  z.object({ kind: z.literal('endureOrCure') }),
  /**
   * Battle scope: raises stat stages and heals a share of max HP (the engine does it).
   * `healShare` is the most it heals: all of it with no `healAttribute`, otherwise scaled by that attribute (0 to its maximum).
   */
  z.object({
    kind: z.literal('boost'),
    stats: z.partialRecord(BoostStatSchema, z.number().int().min(-6).max(6)),
    healShare: z.number().min(0).max(1),
    healAttribute: z.enum(['strength', 'intelligence', 'speed', 'charisma', 'luck', 'love', 'rage', 'peace', 'good', 'evil']).nullable().default(null),
  }),
]);
export type StoryEffectSpec = z.infer<typeof StoryEffectSpecSchema>;

// ---------- definitions (src/data/story.json) ----------

/** Resolution order when several triggers fire together (first wins). From the Hyper blueprint §7. */
export const PRIORITY_TIERS = ['knockoutPrevention', 'transformation', 'emotionalOverdrive', 'bondRivalry', 'memory', 'flavour'] as const;
export const PriorityTierSchema = z.enum(PRIORITY_TIERS);
export type PriorityTier = z.infer<typeof PriorityTierSchema>;

/** The conditions the code knows how to check. A definition names one; new kinds need code. */
export const STORY_TRIGGERS = ['toughenedItOut', 'hungInThere', 'feltABond', 'pushedBackUp'] as const;
export type StoryTriggerKind = (typeof STORY_TRIGGERS)[number];

/** Attributes a Hyper chance can read: the plain ones, and each end of the two meters. */
export const HYPER_ATTRIBUTES = ['strength', 'intelligence', 'speed', 'charisma', 'luck', 'love', 'rage', 'peace', 'good', 'evil'] as const;

/**
 * When a trigger may fire. Every field is optional; each trigger reads the ones it needs
 * (docs/story-foundation.md lists which).
 */
export const TriggerConditionsSchema = z.object({
  trigger: z.enum(STORY_TRIGGERS),
  /** The Pokémon had at least this share of its max HP before the hit. */
  minHpShare: z.number().min(0).max(1).optional(),
  /** At or below this share of max HP counts as badly hurt. */
  lowHpShare: z.number().min(0).max(1).optional(),
  /** Turns in a row at low HP. */
  turns: z.number().int().positive().optional(),
  /** Super-effective hits survived this battle (a variant's condition). */
  superEffectiveHits: z.number().int().positive().optional(),
  /** Friendship needed. */
  minFriendship: z.number().int().min(0).max(255).optional(),
  /** The Pokémon's history must hold at least one of these (closeCall, survivedFatal, bossBeaten, or another definition's id). */
  needsMemory: z.array(z.string()).optional(),
});

/**
 * A Hyper chance: `base`, plus `perPoint` for each point of the named attributes
 * (their average when there are several), never more than `cap` times the base.
 * `again` multiplies the base once the same Pokémon has had this moment earlier in the run.
 */
export const HyperChanceSchema = z.object({
  base: z.number().min(0).max(1),
  attributes: z.array(z.enum(HYPER_ATTRIBUTES)),
  perPoint: z.number().min(0),
  cap: z.number().min(1),
  again: z.number().min(0).max(1).default(1),
});
export type HyperChance = z.infer<typeof HyperChanceSchema>;

export const PresentationCueSpecSchema = z.object({
  /** Major cues are cinematic (count against the per-battle budget); minor ones are a line of text. */
  major: z.boolean(),
  /** Aura / banner colour, as #rrggbb. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sound: z.string().nullable(),
  /** Optional extras for later presentation work. */
  music: z.string().nullable().default(null),
  cutIn: z.boolean().default(false),
  shake: z.boolean().default(false),
});
export type PresentationCueSpec = z.infer<typeof PresentationCueSpecSchema>;

/** One story/Hyper event, using the blueprint's 14 fields. */
export const StoryEventDefinitionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  /** Alternate texts; {name} is your Pokémon, {enemy} the opposing one. */
  messagePool: z.array(z.string()).min(1),
  category: z.enum(['survival', 'bond', 'emotion', 'rivalry', 'enemy', 'evolution', 'legacy', 'flavour']),
  triggerConditions: TriggerConditionsSchema,
  /** Chance once the trigger's conditions hold (null: always). Rolled on the "hyper" stream. */
  chance: HyperChanceSchema.nullable(),
  effect: StoryEffectSpecSchema.nullable(),
  /** Scope: a battle-scope effect is thrown away when the battle ends. */
  duration: z.enum(['battle', 'run', 'account']),
  cooldown: z.enum(['none', 'oncePerBattlePerPokemon', 'oncePerBattle', 'oncePerRunPerPokemon', 'oncePerRun']),
  memoryRecord: z.object({ importance: z.number().int().min(0).max(100), text: z.string() }).nullable(),
  followUpEvents: z.array(z.string()),
  visualCue: PresentationCueSpecSchema,
  priority: PriorityTierSchema,
  /** Restrictions (species, form, trainer, region, mechanic...). Checked once those systems exist. */
  eligibilityTags: z.array(z.string()),
  /** Named variants ("again", "wouldntStayDown"): a different title and lines for the same event. */
  variants: z.record(z.string(), z.object({ displayName: z.string(), messagePool: z.array(z.string()).min(1) })).default({}),
});
export type StoryEventDefinition = z.infer<typeof StoryEventDefinitionSchema>;

export const StoryConfigSchema = z.object({
  limits: z.object({
    recentEvents: z.number().int().positive(),
    memoriesPerPokemon: z.number().int().positive(),
    histories: z.number().int().positive(),
    openRelationships: z.number().int().positive(),
    relationshipHistory: z.number().int().positive(),
    enemyProfilesPerRun: z.number().int().positive(),
    enemyProfilesPerRegion: z.number().int().positive(),
    enemyProfileBattles: z.number().int().positive(),
    chronicleEntries: z.number().int().positive(),
    appliedEffects: z.number().int().positive(),
  }),
  /** Major (cinematic) moments per battle; smaller ones are still recorded. */
  majorCuesPerBattle: z.number().int().min(0),
  /** A hit that leaves your Pokémon at this share of its max HP or less is a close call. */
  closeCallHpShare: z.number().min(0).max(1),
  /** At or below this share of max HP a turn counts toward a low-HP stand. */
  lowHpShare: z.number().min(0).max(1),
  /** Friendship values that make a milestone when first reached. */
  friendshipMilestones: z.array(z.number().int().min(0).max(255)),
  /** A domain event this important (or more) goes into the chronicle. */
  chronicleMinImportance: z.number().int().min(0).max(100),
  /** How memorable each kind of domain event is (0: never a memory). */
  importance: z.record(DomainEventTypeSchema, z.number().int().min(0).max(100)),
  definitions: z.array(StoryEventDefinitionSchema),
});
export type StoryConfig = z.infer<typeof StoryConfigSchema>;
