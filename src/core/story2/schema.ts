// Story Overhaul v2, slice F0: the shapes of all story data (src/data/story/*.json), the profile/run/settings containers and the pure helpers
// (name sanitizing). Story code reads these; nothing here touches battle rules or gameplay RNG.
import { z } from 'zod';

export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/);
export const Key = z.string().regex(/^[a-z][a-z0-9_.]*$/);
/** A species or move id from the game data (these use hyphens: nidoran-f, leech-seed). */
export const GameId = z.string().regex(/^[a-z][a-z0-9_-]*$/);
const Ver = z.number().int().min(1);
const Scalar = z.union([z.boolean(), z.number(), z.string()]);

/** A condition and an effect: `kind` picks the rule; the rest is the kind's own fields. Effects carry an id for the never-apply-twice ledger. */
export const CondSchema = z.object({ kind: Id }).catchall(z.unknown());
export const EffectSchema = z.object({ id: Id.optional(), kind: Id }).catchall(z.unknown());
const RoleSpec = z.object({ character: Id.optional(), pool: Id.optional() }).catchall(z.unknown());
const Beat = z.object({ id: Id, line: Id.optional(), kind: Id.optional() }).catchall(z.unknown());
const Choice = z.object({ id: Id, textKey: Key, effects: z.array(EffectSchema).default([]), goto: Id.optional() });
const Variant = z.object({ role: Id, id: Id, textKey: Key, when: z.array(CondSchema).default([]) });
const SlotRule = z.object({ slot: Id }).catchall(z.unknown());
const Branch = z.object({ id: Id, exit: Id.optional() }).catchall(z.unknown());

export const CharacterSchema = z.object({
  id: Id, v: Ver, nameKey: Key, age: z.number().int().min(0),
  role: z.enum(['rival', 'leader', 'elite', 'champion', 'villain', 'mentor', 'npc', 'family']),
  poses: z.record(Id, z.string()),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  home: Id.optional(), party: z.array(Id).default([]),
  relationClass: z.enum(['friend', 'rival', 'mentor', 'stranger', 'family']),
  romanceable: z.boolean().default(false),
  tellings: z.array(Id).default([]),
  bio: z.array(z.object({ tier: z.number(), textKey: Key, spoiler: z.boolean() })),
  flags: z.array(Id).default([]),
});
export type StoryCharacter = z.infer<typeof CharacterSchema>;

export const EventSchema = z.object({
  id: Id, v: Ver, tags: z.array(Id), requires: z.array(CondSchema), roles: z.record(Id, RoleSpec),
  beats: z.array(Beat), choices: z.array(Choice), outputs: z.array(EffectSchema),
  variants: z.array(Variant), cost: z.number().int().min(0), tier: z.enum(['A', 'B', 'C']),
  moment: z.enum(['none', 'minor', 'major', 'landmark']).default('none'),
  /** Backstory module this event belongs to (for the parity gate). */
  backstory: Id.optional(),
});
export type StoryEvent = z.infer<typeof EventSchema>;

export const ArcSchema = z.object({
  id: Id, v: Ver, steps: z.array(z.object({ event: Id, onFail: Id.optional() })),
  nodeCost: z.number(), branches: z.array(Branch), effects: z.array(EffectSchema), exits: z.array(Id).min(1),
});

export const ThemeSchema = z.object({
  id: Id, letter: z.string().length(1), nameKey: Key, beatSheet: z.array(z.object({ act: z.number(), slot: Id })),
  slotRules: z.array(SlotRule), endings: z.array(Id).min(1), weight: z.number(), needs: z.array(Id).default([]),
  /** Twist clue slots and the slot that reveals the twist (for the clue-count gate). */
  twist: z.object({ revealSlot: Id, clueSlots: z.array(Id), minClues: z.number().int().min(0) }).optional(),
  /** S11: the theme's exclusive events (tagged `theme_<id>`), each pinned to a named beat by a slot rule `{ slot, event }`. */
  events: z.array(Id).default([]),
  /** S11: the ending table. First matching row wins; the last row has no conditions. Conditions read run flags and counters. */
  endingGrid: z.array(z.object({ ending: Id, nameKey: Key, sceneKey: Key, when: z.array(CondSchema).default([]) })).default([]),
  /** S11: twist cards (reveal beat, act, clue beats). Fair play: 3 or more clues before the reveal. */
  twists: z.array(z.object({
    id: Id, revealSlot: Id, act: z.number().int().min(1), revealKey: Key, motiveKey: Key, consequenceKey: Key,
    clues: z.array(z.object({ id: Id, slot: Id, textKey: Key })),
  })).default([]),
  /** S11: the Journal tab (name plus 3 entry templates). */
  journal: z.object({ nameKey: Key, templates: z.array(Key) }).optional(),
  /** S11: how well each backstory fits the theme. A missing backstory means no opinion. */
  backstoryFit: z.record(Id, z.enum(['excellent', 'good', 'possible', 'blocked'])).default({}),
  /** S11: ending flags the runtime sets when a fight or scene resolves (not by an event choice). */
  battleFlags: z.array(Id).default([]),
});

export const RemembranceSchema = z.object({
  id: Id, v: Ver, line: z.array(GameId).min(1).max(3), types: z.array(Id).min(1).max(2), temperament: Id, affinity: z.record(Id, z.number()),
  unlock: z.object({ kind: z.enum(['start', 'quiz', 'win', 'mastery', 'event', 'backstory']), arg: z.string().optional() }),
  moves: z.array(GameId), keystone: Id, status: z.enum(['supported', 'limited', 'disabled']),
  /** Quiz fields (S3): combat role, generation of origin, whether the line branches, whether stage 1 is a baby, and whether the quiz may offer it. */
  role: z.enum(['sweeper', 'tank', 'support', 'disruptor', 'trapper', 'pivot', 'scout']).optional(),
  generation: z.number().int().min(1).optional(),
  branching: z.boolean().default(false),
  baby: z.boolean().default(false),
  quizEligible: z.boolean().default(true),
  /** How hard the line is to discover (Design v2 Part II rarity table); not how strong it is. */
  rarity: z.enum(['familiar', 'unusual', 'rare', 'exceptional', 'legendary', 'mythical', 'secret', 'extraordinary']).optional(),
});

export const MoveMomentSchema = z.object({
  id: Id, trigger: z.enum(['first_use', 'finisher', 'save', 'comeback', 'bond_move']), templateKey: Key, typeMap: z.record(Id, Key),
});

export const DialogueLineSchema = z.object({
  id: Id, speaker: Id, when: z.array(CondSchema), textKey: Key, tags: z.array(Id), pose: Id.optional(), bubble: Id.optional(), variantOf: Id.optional(),
});

export const LoreEntrySchema = z.object({
  id: Id, category: z.number().min(1).max(11), nameKey: Key, states: z.array(z.enum(['rumor', 'known', 'verified', 'contested'])),
  interpretations: z.array(z.object({ textKey: Key, sources: z.array(Id) })).default([]),
  sources: z.array(Id), related: z.array(Id).default([]), spoiler: z.boolean().default(false),
});

export const NewsTemplateSchema = z.object({ id: Id, category: Id, tokens: z.array(Id), when: z.array(CondSchema), outlets: z.record(Id, Key) });

export const InteractableSchema = z.object({
  id: Id, verbs: z.array(z.enum(['look', 'talk', 'take', 'use', 'read'])), outputs: z.array(EffectSchema), requires: z.array(CondSchema).default([]), icon: Id.optional(),
});

/** A backstory module (5 planned). `parity` lists the parity-checklist items it provides; `endings` the ones it can reach. */
export const BackstorySchema = z.object({
  id: Id, nameKey: Key, parity: z.array(Id), endings: z.array(Id), catchAllEnding: Id.optional(), signatureProp: Id.optional(),
  /** Module manifest (design doc, Backstory module system). Every id must exist; the Module Validator checks them. */
  events: z.array(Id).default([]), echoEvents: z.array(Id).default([]), encounterPools: z.array(Id).default([]),
  remembranceUnlocks: z.array(Id).default([]), exclusiveItem: Id.optional(),
  /** The ending grid: first matching row wins; the last row must have no conditions (the catch-all). */
  endingGrid: z.array(z.object({ ending: Id, when: z.array(CondSchema).default([]) })).default([]),
});

export const QuizQuestionSchema = z.object({
  id: Id, quick: z.boolean().default(false), textKey: Key,
  answers: z.array(z.object({ id: Id, textKey: Key, weights: z.record(Id, z.number()), tag: Id.optional() })).min(2),
});

/** S4: one Story Stop's contract (design Part V-B). `col` is the map column (League: the corridor step); null for a Region Gate or a Finale/Epilogue scene. */
export const STOP_CATEGORIES = ['narrative', 'character', 'conflict', 'discovery', 'relationship', 'branch', 'climax', 'resolution', 'recovery'] as const;
export const StopContractSchema = z.object({
  id: Id, stage: z.number().int().min(1), act: z.number().int().min(1).max(8), col: z.number().int().min(1).nullable(),
  category: z.enum(STOP_CATEGORIES), weight: z.enum(['main', 'side']), slotTags: z.array(Id), intensity: z.number().int().min(1).max(5),
  cinematic: z.boolean(), fallback: Id, locked: z.boolean(), lane: z.number().int().min(0), beat: z.number().int().min(1).max(7).optional(),
});
export type StopContract = z.infer<typeof StopContractSchema>;

export const StoryBlueprintSchema = z.object({
  id: Id, seed: z.string(), contentHash: z.string(), theme: Id, antagonist: Id,
  rivals: z.object({ primary: Id, secondary: Id, friendly: Id }), observer: Id.optional(),
  slots: z.array(z.object({ slot: Id, stop: z.number(), event: Id, fallbacks: z.array(Id) })),
  locks: z.array(Id), replans: z.array(z.object({ at: z.number(), reason: Id })),
  /** S4: the 44 Stop contracts in play order, and a checksum over the whole blueprint (a mismatch on load re-tells the story). */
  stops: z.array(StopContractSchema).default([]),
  checksum: z.string().default(''),
});
export type StoryBlueprint = z.infer<typeof StoryBlueprintSchema>;

// ---------- S10: the seven story rivals (design Part IV-R). Data only; the engine reads these through story2/storyRivals.ts ----------

export const RIVAL_ROLES = ['primary', 'secondary', 'friendly'] as const;
export const CLUE_TYPES = ['behavioral', 'verbal', 'material', 'pokemon', 'third_party'] as const;
const Species = z.string().regex(/^[a-z][a-z0-9-]*$/);
const RivalSlot = z.object({ species: Species, nick: z.string().max(16).optional(), ace: z.boolean().optional(), move: Id.or(z.string().regex(/^[a-z][a-z0-9-]*$/)).optional(), item: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(), freedOnly: z.boolean().optional() });
const RivalCounter = z.object({ slot: z.number().int().min(0).max(6), species: Species.optional(), vs: z.array(Id), freedOnly: z.boolean().optional(), draw: z.boolean().optional() });
export const RivalTeamSchema = z.object({
  act: z.number().int().min(1).max(6), slots: z.array(RivalSlot).min(2).max(6),
  /** Pip only: extra slots drawn from the character's `drawPool`. */
  draws: z.number().int().min(0).max(6).optional(),
  /** Marisol: the slot that is a different species when Bastion is not freed. */
  fallbackSlot: z.object({ slot: z.number().int().min(1).max(6), species: Species }).optional(),
  counter: RivalCounter.nullable(), note: Id.optional(),
});
export const RivalClueSchema = z.object({
  id: Id, act: z.number().int().min(1).max(6), place: Id, type: z.enum(CLUE_TYPES), textKey: Key,
  /** Fair-play audit fields (design 4): on a stop the player must pass, plainly visible, an innocent reading shown with it, the Journal line after the reveal, the eye icon. */
  mandatory: z.boolean(), visible: z.boolean(), cover: z.boolean(), coverKey: Key, retroKey: Key, icon: Id,
});
export const StoryRivalSchema = z.object({
  id: Id, v: Ver, character: Id, archetype: z.enum(['friendly', 'competitive', 'reluctant', 'unpredictable', 'secret', 'turned_villain', 'fallen']),
  types: z.array(Id).min(1), roles: z.array(z.enum(RIVAL_ROLES)).min(2), defaultFriendly: z.boolean().default(false), status: z.enum(['supported', 'limited', 'disabled']),
  /** Which key scenes (beats 2, 4, 6, 8) each role plays, and the Acts of a Friendly rival's three friendly spars. */
  sceneBeats: z.object({ primary: z.array(z.number().int().min(1).max(8)), secondary: z.array(z.number().int().min(1).max(8)), friendly: z.array(z.number().int().min(1).max(8)).optional() }), sparActs: z.array(z.number().int().min(1).max(6)).default([]),
  /** A Secondary Secret/Villain/Fallen rival runs a compressed arc: these clue ids, a reveal after `revealNeeds`, and only these outcomes. */
  compressed: z.object({ clueIds: z.array(Id), revealNeeds: z.number().int().min(0), outcomes: z.array(Id).min(2) }).optional(),
  teams: z.array(RivalTeamSchema).length(6), drawPool: z.array(Species).default([]),
  lines: z.object({ intro: Key, mid: Key, win: Key, lose: Key, aceOut: Key, rematch: Key, rematchAfter: Key.optional() }),
  friendlyLineKey: Key, hostileLineKey: Key, likes: z.array(Id), dislikes: z.array(Id),
  packKind: z.enum(['secret', 'tone', 'faith_break']), packs: z.array(z.object({ id: Id, nameKey: Key, vars: z.record(Id, z.string()), payoffKey: Key })).min(1),
  endings: z.array(Id).min(1), scenes: z.array(z.object({ beat: z.number().int().min(1).max(8), act: z.number().int().min(1).max(8), place: Id, event: Id })),
  ledger: z.array(RivalClueSchema).default([]), dossier: z.record(Id, z.string()).optional(),
});
export type StoryRival = z.infer<typeof StoryRivalSchema>;
export type RivalRole = (typeof RIVAL_ROLES)[number];

/** One row of the theme table: who fills which role, the pack the row names, and the original Preferred/Allowed/Avoid archetypes. */
export const RivalThemeSchema = z.object({
  theme: Id, primary: Id, secondary: Id, friendly: Id, pack: z.object({ rival: Id, pack: Id }),
  preferred: z.array(Id), allowed: z.array(Id), avoid: z.array(Id),
});
export type RivalThemeRow = z.infer<typeof RivalThemeSchema>;

export const SLOT_RULES_PLACEHOLDER = z.object({ weights: z.record(Id, z.number()).default({}) });

/** Everything `src/data/story/*.json` holds, parsed. Empty arrays are valid (F0 ships no content). */
export const StoryDataSchema = z.object({
  characters: z.array(CharacterSchema), events: z.array(EventSchema), arcs: z.array(ArcSchema), themes: z.array(ThemeSchema),
  remembrances: z.array(RemembranceSchema), moveMoments: z.array(MoveMomentSchema), dialogue: z.array(DialogueLineSchema),
  lore: z.array(LoreEntrySchema), news: z.array(NewsTemplateSchema), interactables: z.array(InteractableSchema),
  backstories: z.array(BackstorySchema), quiz: z.array(QuizQuestionSchema), blueprintRules: SLOT_RULES_PLACEHOLDER,
  rivals: z.array(StoryRivalSchema).default([]), rivalThemes: z.array(RivalThemeSchema).default([]),
  text: z.record(Key, z.string()),
  hash: z.string(),
});
export type StoryData = z.infer<typeof StoryDataSchema>;

// ---------- save containers (profile v20, run v40, settings v39) ----------

export const PronounsSchema = z.object({ subj: z.string().max(12), obj: z.string().max(12), poss: z.string().max(12), reflexive: z.string().max(12) });

/** A finished Story Run, kept in the profile (the Run Chronicle). Written once at run end; never read back into gameplay. */
export const ChronicleRecordSchema = z.object({
  runId: z.string(),
  endedAt: z.string(),
  victory: z.boolean(),
  seed: z.string(),
  title: z.string(),
  backstory: z.string().optional(),
  theme: z.string().optional(),
  starter: z.object({ line: z.string(), temperament: z.string() }).optional(),
  rival: z.string().optional(),
  antagonist: z.string().optional(),
  stops: z.object({ done: z.number().int().min(0), planned: z.number().int().min(0) }),
  losses: z.number().int().min(0).default(0),
  /** Final relationship stage per character met. */
  relationships: z.record(z.string(), z.string()).default({}),
  /** Scenes seen, in order (up to 12). */
  highlights: z.array(z.string()).max(12).default([]),
  /** S5: the backstory ending reached (an ending id), when the run got that far. */
  ending: z.string().optional(),
});
export type ChronicleRecord = z.infer<typeof ChronicleRecordSchema>;

const ProfileStoryObject = z.object({
  protagonist: z.object({
    look: z.enum(['look_a', 'look_b']).default('look_a'), name: z.string().max(16).default(''), pronouns: z.union([z.string(), PronounsSchema]).default('they'), nameSet: z.boolean().default(false),
    /** S2: the Look the player asked for when it was not ready (Look B); the stored `look` is then look_a. */
    lookRequested: z.enum(['look_a', 'look_b']).optional(),
  }).default({ look: 'look_a', name: '', pronouns: 'they', nameSet: false }),
  prologue: z.object({
    done: z.boolean().default(false), mode: z.enum(['full', 'quick', 'skipped']).default('full'), beatsSeen: z.array(z.string()).max(12).default([]),
    /** S2: Vance's Tone (set once per save), the 'getting to it' gag flag, and whether the Look/mode screen was answered. */
    vanceTone: z.enum(['warm', 'formal', 'playful']).optional(), vanceGettingToIt: z.boolean().default(false), modeChosen: z.boolean().default(false),
  }).default({ done: false, mode: 'full', beatsSeen: [], vanceGettingToIt: false, modeChosen: false }),
  quiz: z.object({ lastResult: z.object({ traitVector: z.record(z.string(), z.number()), picks: z.array(z.string()).max(3) }).nullable().default(null) }).default({ lastResult: null }),
  /** Prologue Beats 7-8 / Short Intake: the backstory and Starter line chosen for the next Story Run (used once, then cleared). */
  nextRun: z.object({ backstory: z.string().optional(), line: z.string().optional() }).default({}),
  remembrance: z.record(z.string(), z.object({ state: z.enum(['locked', 'seen', 'unlocked']), firstSeenRun: z.number().int().nullable().default(null), runs: z.number().int().default(0), mastery: z.number().default(0) })).default({}),
  lore: z.record(z.string(), z.object({ state: z.enum(['rumor', 'known', 'verified', 'contested']), sources: z.array(z.string()).max(4).default([]) })).default({}),
  cast: z.record(z.string(), z.object({ tellings: z.array(z.string()).max(6).default([]), wins: z.number().int().default(0), losses: z.number().int().default(0), runs: z.array(z.string()).default([]) })).default({}),
  chronicles: z.array(ChronicleRecordSchema).max(40).default([]),
  sceneSnapshots: z.array(z.unknown()).max(60).default([]),
  endingsSeen: z.array(z.string()).max(60).default([]),
  /** S6: Keepsake ids unlocked, and the one worn per slot (any Pokémon shows the same outfit). */
  keepsakes: z.array(z.string()).max(40).default([]),
  worn: z.record(z.string(), z.string()).default({}),
  newBadges: z.array(z.string()).max(100).default([]),
  contentHashSeen: z.string().default(''),
});
export type ProfileStory = z.infer<typeof ProfileStoryObject>;
export const freshProfileStory = (): ProfileStory => ProfileStoryObject.parse({});
/** A damaged `story` object falls back to the defaults; the rest of the profile survives. */
export const ProfileStorySchema = ProfileStoryObject.catch(() => freshProfileStory()).default(freshProfileStory());

/** S9: the Orrery Circuit's cast and badge rules (inside run v40's `story.v2`). `cast[i]` is gym stage i+1 (24 in all): the town's two doors. */
export const CircuitStateSchema = z.object({
  cast: z.array(z.object({ doors: z.tuple([z.string(), z.string()]) })).default([]),
  /** Door chosen per gym stage (0-based global stage as a string); an unset stage takes the first door. */
  chosen: z.record(z.string(), z.string()).default({}),
  /** Towns passed (global stage as a string), at most 2 per region. */
  passed: z.array(z.string()).default([]),
  passedOver: z.array(z.string()).default([]),
  met: z.array(z.string()).default([]),
  badges: z.array(z.object({ leaderId: z.string(), regionId: z.number().int().min(0), counted: z.boolean(), source: z.enum(['gym', 'guest']) })).default([]),
  seals: z.array(z.number().int().min(0)).default([]),
  /** Guest Match taken per region (leader id), and the Circuit Merit it earned. */
  guest: z.record(z.string(), z.string()).default({}),
  merit: z.number().int().min(0).default(0),
});
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const StoryV2Schema = z.object({
  mode: z.literal('story_run'),
  protagonist: z.object({ look: z.string(), name: z.string(), pronouns: z.union([z.string(), PronounsSchema]), backstory: z.string().optional(), signatureProp: z.string().optional() }).optional(),
  blueprintId: z.string().optional(),
  blueprint: StoryBlueprintSchema.optional(),
  contentHash: z.string().default(''),
  quiz: z.object({ traitVector: z.record(z.string(), z.number()), picks: z.array(z.string()) }).optional(),
  starter: z.object({ lineId: z.string(), temperament: z.string(), twist: z.string().optional(), keystone: z.array(z.string()).default([]) }).optional(),
  heartbondOverrides: z.number().int().min(0).default(0),
  /** S6: the Personality Autonomy setting, copied here each turn (off and flavor: no refusal offers; full: offers the player may override at a Heartbond cost). */
  autonomy: z.enum(['off', 'flavor', 'full']).default('full'),
  circuit: CircuitStateSchema.optional(),
  /** S6: the partner's uid, levels already latched (unlocks never fall), latches waiting for a safe moment to play, the Keystone flag, and the pay ledger. */
  heartbond: z.object({
    partner: z.string().optional(),
    latched: z.array(z.number().int().min(1).max(10)).default([]),
    pending: z.array(z.number().int().min(1).max(10)).default([]),
    keystoneReady: z.boolean().default(false),
    ledger: z.array(z.string()).max(600).default([]),
  }).default(() => ({ latched: [], pending: [], keystoneReady: false, ledger: [] })),
  /** S7: the Dramatic Moments setting, copied here each turn (off: no Feats and no Charge). */
  dramatic: z.enum(['off', 'quiet', 'full', 'prompt']).default('full'),
  /** S7: the partner's Resolve Charge (0 to 100), banked Feats, the Feats used (id, battle key, Act), Charge ledger keys, a player-armed Feat (Prompt mode), and the first Feat (Chronicle). */
  feats: z.object({
    charge: z.number().int().min(0).max(100).default(0),
    banked: z.number().int().min(0).max(2).default(0),
    used: z.array(z.object({ id: z.string(), battle: z.string(), act: z.number().int().min(0) })).default([]),
    gains: z.array(z.string()).max(400).default([]),
    armed: z.boolean().default(false),
    first: z.string().nullable().default(null),
  }).default(() => ({ charge: 0, banked: 0, used: [], gains: [], armed: false, first: null })),
  /** S7d: the partner's signature moves learned this run (Signature I or its Keystone upgrade, Signature II), added to it in each battle. */
  sigMoves: z.array(z.string()).max(2).default([]),
  /** S7d: the name shown for each signature move (the player may rename each once a run; core/story2/moveName.ts). */
  sigNames: z.record(z.string(), z.object({ defaultName: z.string(), raw: z.string().nullable(), display: z.string(), renamed: z.boolean() })).default({}),
  cast: z.record(z.string(), z.object({
    stage: z.string(), attrs: z.record(z.string(), z.number()).default({}), memories: z.array(z.string()).default([]),
    /** S8 relationship record: flags (met, owes_player...), gate events passed, structured memories, the stage waiting to settle, last contact. */
    flags: z.record(z.string(), z.boolean()).default({}),
    gates: z.array(z.string()).default([]),
    mem: z.array(z.object({ tag: z.string(), salience: z.number().int().min(1).max(10), node: z.number().int().min(0) })).default([]),
    scenes: z.number().int().min(0).default(0),
    pending: z.string().nullable().default(null),
    last: z.object({ node: z.number().int().min(0), summary: z.string() }).nullable().default(null),
  })).default({}),
  arcs: z.record(z.string(), z.object({ state: z.string(), step: z.number().int().default(0), nodeCost: z.number().default(0) })).default({}),
  facts: z.record(z.string(), Scalar).default({}),
  stops: z.object({ index: z.number().int().default(0), planned: z.number().int().default(0), done: z.array(z.string()).default([]) }).default(() => ({ index: 0, planned: 0, done: [] })),
  replans: z.array(z.record(z.string(), Scalar)).default([]),
  /** W3: per-rival relationship record (Respect, Rivalry, Affection, Suspicion, 0 to 100) and the gate events passed. */
  rel: z.record(z.string(), z.object({ respect: z.number().int().min(0).max(100), rivalry: z.number().int().min(0).max(100), affection: z.number().int().min(0).max(100), suspicion: z.number().int().min(0).max(100), met: z.boolean().default(true), gates: z.array(z.string()).default([]) })).default({}),
  /** W3: hidden consequences waiting to surface (due is a linear stage number), the scenes already played and the consequences already fired. */
  queue: z.array(z.object({ id: z.string(), hidden: z.string(), rival: z.string(), due: z.number().int().min(0) })).default([]),
  scenesDone: z.array(z.string()).default([]),
  /** W3 wiring: the rival choice scene on offer (core/story2/rivalStory.ts), and lines waiting to be shown (a choice's reply, a surfaced consequence). */
  rivalScene: z.object({ scene: z.string(), rival: z.string() }).nullable().default(null),
  notes: z.array(z.object({ kicker: z.string(), lines: z.array(z.object({ speaker: z.string().nullable(), text: z.string() })) })).max(20).default([]),
  fired: z.array(z.string()).default([]),
  /** S5: the backstory module loader's state (what is queued, playing and played, the echo count, the ending, scene snapshots for the Journal and Archive). */
  module: z.object({
    backstory: z.string(),
    /** Scenes waiting to play next (the intro, a choice's follow-up), then the one on screen now. */
    queue: z.array(z.string()).default([]),
    active: z.string().nullable().default(null),
    activeStop: z.string().nullable().default(null),
    played: z.array(z.string()).default([]),
    echoes: z.number().int().min(0).default(0),
    lastSceneStop: z.number().int().min(0).default(0),
    ending: z.string().nullable().default(null),
    chronicle: z.array(z.string()).default([]),
    snapshots: z.array(z.object({ event: z.string(), stop: z.string().nullable(), act: z.number().int().min(0), text: z.string(), choice: z.string().nullable() })).default([]),
  }).optional(),
});
export type StoryV2 = z.infer<typeof StoryV2Schema>;

export const STORY_SETTINGS_DEFAULTS = {
  intensity: 'full', dramaticMoments: 'full', autonomy: 'full', romance: 'off', activities: 'standard',
  subtitleSize: 'medium', subtitleStyle: 'boxed', spoilerGuard: true, journalVoice: 'vance',
} as const;
export const StorySettingsSchema = z.object({
  intensity: z.enum(['full', 'streamlined', 'minimal']).default('full'),
  dramaticMoments: z.enum(['off', 'quiet', 'full', 'prompt']).default('full'),
  autonomy: z.enum(['off', 'flavor', 'full']).default('full'),
  romance: z.enum(['off', 'on']).default('off'),
  activities: z.enum(['standard', 'quick']).default('standard'),
  subtitleSize: z.enum(['small', 'medium', 'large']).default('medium'),
  subtitleStyle: z.enum(['plain', 'boxed']).default('boxed'),
  spoilerGuard: z.boolean().default(true),
  journalVoice: z.enum(['vance', 'plain']).default('vance'),
});
export type StorySettings = z.infer<typeof StorySettingsSchema>;

/** Romance stays off until the director turns it on in balance.json (story.romanceEnabled). */
export function romanceEnabled(settings: { story?: StorySettings }, balanceFlag: boolean): boolean {
  return balanceFlag && settings.story?.romance === 'on';
}

// ---------- name sanitizing (rules from the design doc, Data schemas) ----------

const FORBIDDEN = /[\p{Cc}\p{Cf}‪-‮⁦-⁩<>{}%]/u;
const ALLOWED = /^[\p{L}\p{M}\p{N} \-'.]+$/u;
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export function graphemeCount(s: string): number {
  return segmenter ? [...segmenter.segment(s)].length : [...s].length;
}
/** The stored name, or null if the input is rejected. Trims and collapses spaces; 1 to 16 grapheme clusters; letters, marks, digits, space, hyphen, apostrophe, period only. */
export function sanitizeName(input: string): string | null {
  if (typeof input !== 'string' || input.length > 200 || FORBIDDEN.test(input)) return null;
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name || graphemeCount(name) > 16 || !ALLOWED.test(name) || /^[\p{N} ]+$/u.test(name)) return null;
  return name;
}
