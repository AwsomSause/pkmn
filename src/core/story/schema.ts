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
  'rivalryFormed',
  'trainerVowedReturn',
  /** A Pokémon found a feeling in battle (Emotional Turning Point). */
  'feeling',
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

/** The Seven Emotions (Undertale's soul traits): tags on memories; the most common recent one is a Pokémon's current emotion. */
export const EMOTIONS = ['determination', 'bravery', 'justice', 'kindness', 'patience', 'integrity', 'perseverance'] as const;
export const EmotionSchema = z.enum(EMOTIONS);
export type Emotion = (typeof EMOTIONS)[number];

export const MemorySchema = z.object({
  eventId: z.string(),
  seq: z.number().int().min(1),
  type: DomainEventTypeSchema,
  /** Higher is more memorable; decides what is kept when a list is full. */
  importance: z.number().int().min(0).max(100),
  text: z.string(),
  where: WhereSchema,
  /** Seven Emotions tags (from the story moment, or story.json's emotions.byEvent). */
  emotions: z.array(EmotionSchema).default([]),
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
  /** Battles it has fought each opposing species in this run (Heated Rivalry). */
  foes: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Times it used each damaging move in trainer fights this run (Signature Move Awakening). */
  moves: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Times it and each teammate (by uid) took turns landing finishing blows (Friendly Competition). */
  finishTrades: z.record(z.string(), z.number().int().min(0)).default({}),
  /** The Bond Engine's values for this Pokémon (core/bond); created on first use. */
  bond: z.lazy(() => BondSchema).optional(),
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
// ---------- rivals (src/core/rivals) ----------

export const TRAIT_KEYS = ['ambition', 'pride', 'empathy', 'adaptability', 'vindictiveness', 'resilience'] as const;
export const TraitsSchema = z.object({ ambition: z.number().int().min(0).max(100), pride: z.number().int().min(0).max(100), empathy: z.number().int().min(0).max(100), adaptability: z.number().int().min(0).max(100), vindictiveness: z.number().int().min(0).max(100), resilience: z.number().int().min(0).max(100) });
export type Traits = z.infer<typeof TraitsSchema>;

const Dim = z.number().min(0).max(100);
/** Examples §4.1: separate bond dimensions (0–100), a Pokémon trait, habits and recent events. */
export const BondSchema = z.object({
  trust: Dim, affection: Dim, respect: Dim, synchronization: Dim, confidence: Dim, autonomy: Dim, strain: Dim, sharedHistory: z.number().min(0),
  hyperReadiness: Dim,
  trait: z.string(),
  habits: z.record(z.string(), z.string()).default({}),
  recent: z.array(z.string()).default([]),
});
export type Bond = z.infer<typeof BondSchema>;
/** An off-screen event and what caused it (Examples §11 RivalEvent). */
export const OffscreenEventSchema = z.object({
  id: z.string(), eventType: z.string(), pokemon: z.string(), at: z.string(), cause: z.string().nullable(),
  visibility: z.enum(['private', 'rumor', 'observed']), text: z.string(), shown: z.boolean().default(false),
});
export type OffscreenEvent = z.infer<typeof OffscreenEventSchema>;

export const RivalSchema = z.object({
  id: z.string(),
  /** The trainer's class id and name when the rivalry began. */
  classId: z.string(),
  name: z.string(),
  archetype: z.string(),
  style: z.string(),
  traits: TraitsSchema,
  /** The hidden score: how much this trainer wants to beat you. */
  rivalPotential: z.number().min(0),
  origin: z.object({ eventId: z.string(), where: WhereSchema, path: z.string() }),
  /** Where it is on the ladder from a name you remember to a contender; ally and retired are endings of its rivalry with you. */
  state: z.enum(['recognized', 'recurring', 'active', 'nemesis', 'contender', 'ally', 'retired']).default('recognized'),
  /** Battles with you since the Spark, and times a loss shook it. */
  encounters: z.number().int().min(0).default(0),
  setbacks: z.number().int().min(0).default(0),
  /** Its character arc: which one, how far it has turned, stages lived through, and how it ended. */
  arc: z.object({ id: z.string(), stage: z.number().int().min(0).max(2), ticks: z.number().int().min(0), resolution: z.enum(['good', 'bad']).nullable() }).nullable().default(null),
  /** The off-screen world: stages since you last met, stages it sits out, and the level it gained while away. */
  away: z.number().int().min(0).default(0),
  cooldown: z.number().int().min(0).default(0),
  progress: z.number().int().min(0).default(0),
  /** Bonds with its Pokémon, by species id, and what happened off-screen (newest last). */
  bonds: z.record(z.string(), BondSchema).default({}),
  offscreen: z.array(OffscreenEventSchema).default([]),
  /** What it has learned about you, one telegraphed change per return. */
  adaptations: z.array(z.string()).default([]),
  /** What it remembers of its last battle with you. */
  memory: z.object({
    lastBattle: z.object({
      eventId: z.string(),
      result: z.enum(['win', 'lose']),
      hpLeftShare: z.number().min(0).max(1),
      turns: z.number().int().min(0),
      /** Its team that day, for later counter-adaptation. */
      team: z.array(z.string()).max(6),
      /** Uids of your Pokémon that fought it that day (so its Pokémon can recognise them). */
      foes: z.array(z.string()).optional(),
    }),
  }),
});
export type Rival = z.infer<typeof RivalSchema>;

export const StoryStateSchema = z.object({
  /** Last sequence number used (event ids are seed + seq). */
  seq: z.number().int().min(0),
  /** The most recent domain events, oldest first (limit in story.json; histories and the chronicle keep what matters). */
  events: z.array(DomainEventSchema),
  histories: z.record(z.string(), PokemonHistorySchema),
  relationships: z.array(RelationshipRecordSchema),
  enemyProfiles: z.array(EnemyProfileSchema),
  /** Rivals born this run (src/core/rivals). */
  rivals: z.array(RivalSchema),
  /** How rivals feel about each other: enemies, friends or training partners. */
  rivalGraph: z.array(z.object({ a: z.string(), b: z.string(), kind: z.enum(['enemies', 'friends', 'partners']) })).default([]),
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
  /** Heals the Pokémon by a share of its max HP (run scope; applied once). */
  z.object({ kind: z.literal('heal'), hpShare: z.number().gt(0).max(1) }),
  /** Battle scope: raises (or lowers) a stat stage of the opposing Pokémon in battle. */
  z.object({ kind: z.literal('enemyStage'), stat: BoostStatSchema, stages: z.number().int().min(-6).max(6) }),
  /** Clears the Pokémon's status condition (run scope; applied once). */
  z.object({ kind: z.literal('cure') }),
  /** Presentation and a memory only: the moment changes nothing in the battle (Hyper evolutions). */
  z.object({ kind: z.literal('flair') }),
  /** Battle scope: a knocked-out Pokémon gets back up with this share of its max HP (the engine does it). */
  z.object({ kind: z.literal('revive'), hpShare: z.number().gt(0).max(1) }),
  /** Battle scope: hangs on at 1 HP against a fatal hit, or shakes off a status at the end of a turn (the engine does it). */
  z.object({ kind: z.literal('endureOrCure') }),
  /**
   * Battle scope: raises stat stages and heals a share of max HP (the engine does it).
   * `healShare` is the most it heals: all of it with no `healAttribute`, otherwise scaled by that attribute (0 to its maximum).
   */
  /**
   * Battle scope, enemy side: stat stages it gains when its rage is unleashed, and the extra
   * ones when the rage is uncontrollable (the engine does it).
   */
  z.object({
    kind: z.literal('rage'),
    stats: z.partialRecord(BoostStatSchema, z.number().int().min(-6).max(6)),
    uncontrollable: z.partialRecord(BoostStatSchema, z.number().int().min(-6).max(6)),
  }),
  /**
   * Battle scope, your side: extra damage against its rival (a share, 0.1 = +10%), the bigger
   * share when it is reckless, and the stat stages recklessness costs (the engine does it).
   */
  z.object({
    kind: z.literal('rivalry'),
    damage: z.number().min(0).max(1),
    recklessDamage: z.number().min(0).max(1),
    reckless: z.partialRecord(BoostStatSchema, z.number().int().min(-6).max(6)),
  }),
  /**
   * Run scope: a trainer you barely beat joins the rematch pool and comes back in a later stage
   * with its old team at the new levels (+levelBonus) and extra members (the run does it).
   * At most perStage vows per stage and perRegion per region.
   */
  z.object({
    kind: z.literal('rematch'),
    levelBonus: z.number().int().min(0),
    extraMembers: z.number().int().min(0).max(5),
    perStage: z.number().int().positive(),
    perRegion: z.number().int().positive(),
  }),
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
export const STORY_TRIGGERS = ['toughenedItOut', 'hungInThere', 'feltABond', 'pushedBackUp', 'enemyRiledUp', 'heatedRivalry', 'friendlyCompetition', 'trainerReturns', 'megaOverdrive', 'zHeart', 'dynamaxResolve', 'teraTrueColors', 'signatureAwakening', 'secondWind', 'notGivenUp', 'rememberedTraining', 'brokeLimits', 'somethingAwakened', 'instinctsTookOver', 'refusedWeakness', 'turnedPainIntoPower', 'makeYouProud', 'cameToAid', 'moreThanTeammates', 'knowsYouBelieve', 'evolvedBeyond', 'enemyUnshaken', 'enemyInstinct', 'enemyLearned', 'protectingTrainer', 'partnerFall', 'willNotLetDown', 'somethingDifferent', 'waitingForBattle', 'somethingWatching', 'studentLearned', 'studentSurpassed', 'lastLesson', 'differentWays', 'overdriveDetermination', 'overdriveBravery', 'overdriveJustice', 'overdriveKindness', 'overdrivePatience', 'overdriveIntegrity', 'overdrivePerseverance', 'dualEmotion', 'emotionalClash', 'understandEachOther', 'wontLetFriendFight', 'wantsToProve', 'feelsLeftOut', 'gatheringEverything', 'gatherUnleashed', 'fightingBeyondLimits', 'lostComposure'] as const;
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
  /** Only at a decisive moment: a boss or Champion fight, or the Pokémon at or below half HP (Hyper evolutions). */
  decisive: z.boolean().optional(),
  /** Friendship needed. */
  minFriendship: z.number().int().min(0).max(255).optional(),
  /** Hits (moves that damaged it) an opposing Pokémon must take. */
  hits: z.number().int().positive().optional(),
  /** Battles two Pokémon must have fought each other (counting this one). */
  battles: z.number().int().positive().optional(),
  /** Times two teammates must take turns landing finishing blows. */
  trades: z.number().int().positive().optional(),
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
  /** Seven Emotions tags its memory carries. */
  emotions: z.array(EmotionSchema).default([]),
  /** Named variants ("again", "wouldntStayDown"): a different title and lines for the same event. */
  variants: z
    .record(
      z.string(),
      z.object({
        displayName: z.string(),
        messagePool: z.array(z.string()).min(1),
        /** Overrides the definition's visualCue.major (a quieter follow-up line, for example). */
        major: z.boolean().optional(),
      }),
    )
    .default({}),
});
export type StoryEventDefinition = z.infer<typeof StoryEventDefinitionSchema>;

/** An Overdrive chain: steps (event ids or milestone names) that must happen in this order. */
export const StoryChainSchema = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(z.string()).min(2),
  text: z.string(),
  importance: z.number().int().min(0).max(100),
  emotions: z.array(EmotionSchema).default([]),
});
export type StoryChain = z.infer<typeof StoryChainSchema>;

export const StoryConfigSchema = z.object({
  /** Protégé system: battles a veteran needs, the level gap to a protégé, and the gap at which it graduates. */
  mentorship: z.object({ mentorBattles: z.number().int().positive(), levelGap: z.number().int().positive(), graduateGap: z.number().int().min(0) }),
  /** Legacy titles (Techno §6.1): earned from a Pokémon's own history; recognition only, never a stat. */
  legacyTitles: z
    .array(
      z.object({
        title: z.string(),
        needs: z.object({
          survivedFatal: z.number().int().positive().optional(),
          bossesBeaten: z.number().int().positive().optional(),
          closeCalls: z.number().int().positive().optional(),
          battles: z.number().int().positive().optional(),
          evolutions: z.number().int().positive().optional(),
          /** Has had at least one of these story events (ids from `definitions`). */
          anyMoment: z.array(z.string()).optional(),
          /** The run was won with it in the party. */
          victory: z.boolean().optional(),
        }),
      }),
    )
    .default([]),
  /** Overdrive chains (blueprint §6). */
  chains: z.array(StoryChainSchema).default([]),
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
  /** Signature Move Awakening: damaging-move uses in trainer fights before it awakens, and the damage multiplier it then gets (this run only). */
  awakening: z.object({ uses: z.number().int().positive(), boost: z.number().min(1).max(2), perPokemon: z.number().int().positive() }),
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
  emotions: z.object({
    /** A Pokémon's current emotion is the most common tag in this many of its latest tagged memories. */
    window: z.number().int().positive(),
    /** The heart colour of each emotion. */
    colors: z.record(EmotionSchema, z.string()),
    /** Tags for memories of each kind of domain event (story moments use their definition's tags). */
    byEvent: z.partialRecord(DomainEventTypeSchema, z.array(EmotionSchema)),
  }),
  definitions: z.array(StoryEventDefinitionSchema),
});
export type StoryConfig = z.infer<typeof StoryConfigSchema>;
