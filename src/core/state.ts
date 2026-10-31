// Shapes of the game's changing state: Pokémon instances, battles, the run,
// and the permanent profile. These schemas double as save-file validators,
// so the game refuses to load a save that doesn't match.

import { NATURE_IDS } from './natures';
import { DramaBattleSchema, freshDrama } from './drama/schema';
import { z } from 'zod';
import { ArchetypeModifierSchema, ATTRIBUTE_KEYS, BattleBoostSchema, BoostStatSchema, SemiSchema, StatNameSchema, StatusIdSchema, TerrainSchema, TransformKindSchema, TypeNameSchema, WeatherSchema } from './contentSchema';
import { STREAM_NAMES, type StreamName } from './rng';
import { ArchivedRivalSchema, StoryStateSchema } from './story/schema';
import { freshHyperBattle } from './battle/hyper';

const RngStateSchema = z.object({ a: z.number(), b: z.number(), c: z.number(), d: z.number() });
export const RngStreamsSchema = z.object(
  Object.fromEntries(STREAM_NAMES.map((n) => [n, RngStateSchema])) as Record<StreamName, typeof RngStateSchema>,
);

export const MoveSlotSchema = z.object({
  id: z.string(),
  pp: z.number().int().min(0),
  /** PP Ups used on this move (each +20% max PP, at most 3; see pokemon.ts maxPp). */
  ppUps: z.number().int().min(0).max(3).optional(),
});
export type MoveSlot = z.infer<typeof MoveSlotSchema>;

export const StatusSchema = z.object({
  id: StatusIdSchema,
  /** Sleep only: turns the Pokémon will still skip. */
  turns: z.number().int().min(0).optional(),
  /** Burn and poison: turns left before it wears off (absent = until cured). */
  left: z.number().int().min(0).optional(),
  /** Poison only: badly poisoned (Toxic), `turns` counts up. */
  bad: z.boolean().optional(),
});
export type Status = z.infer<typeof StatusSchema>;

/** One individual Pokémon (separate from its species definition). */
export const PokemonInstanceSchema = z.object({
  uid: z.string(),
  speciesId: z.string(),
  level: z.number().int().min(1).max(1000),
  /** Total experience points (the level is derived from growth rate). */
  xp: z.number().int().min(0),
  hp: z.number().int().min(0),
  moves: z.array(MoveSlotSchema).min(1).max(6),
  status: StatusSchema.nullable(),
  /** Vitamin stacks per stat; each stack multiplies that stat. */
  vitamins: z.record(StatNameSchema, z.number().int().min(0)),
  shiny: z.boolean(),
  /** How much it likes you (0–255, see core/friendship.ts). */
  friendship: z.number().int().min(0).max(255),
  /**
   * Which of its species' abilities it has: -1 = the hidden ability, otherwise
   * an index into the normal ones (kept through evolution, see abilityOf).
   * Pokémon from saves made before abilities existed get the first one.
   */
  abilitySlot: z.number().int().min(-1).default(0),
  /** Its nature (core/natures.ts). Missing in saves from before natures: neutral. */
  nature: z.enum(NATURE_IDS).optional(),
  /** Held items (catalog id → copies). A Pokémon can hold many items, each up to its catalog max (director, Q1). */
  held: z.record(z.string(), z.number().int().min(1)).optional(),
  /** Small permanent stat boosts per stat (Wings): copies taken, each worth its catalog percent. */
  statBoosts: z.partialRecord(StatNameSchema, z.number().int().min(0)).optional(),
  /** Max HP bonus in percent from the trainer's HP perks (core/trainerPerks.ts syncHpPerks keeps it current). */
  perkHp: z.number().int().optional(),
  /** Hatched from an Egg this run (core/eggs.ts; Elm's perk gives these more experience). */
  hatched: z.boolean().optional(),
  /** Battle effects waiting for (or running in) its next battles: X items, Dire Hit, Guard Spec., status healers. */
  boosts: z.array(BattleBoostSchema).optional(),
  /** The type it becomes when it Terastallizes (M8.5); unset = its current first type. */
  teraType: TypeNameSchema.optional(),
  /** Moves that awakened this run (Signature Move Awakening): they hit harder; gone with the run. */
  awakened: z.array(z.string()).optional(),
  /** In battle only: Dynamaxed, so its HP is doubled (core/battle/transform.ts). */
  dynamaxed: z.literal(true).optional(),
  /** Shadow Pokémon (catalog #76-77, core/shadow.ts): the Heart Gauge, 100 (sealed) down to 0 (purified). */
  shadow: z.object({ heart: z.number().int().min(1).max(100) }).optional(),
});
export type PokemonInstance = z.infer<typeof PokemonInstanceSchema>;

/** What held items have done this battle (by Pokémon uid); see core/battle/held.ts. */
export const HeldStateSchema = z.object({
  /** Once-per-battle items used: uid → item id → times (Gems, Focus Sash, herbs, Absorb Bulb). */
  used: z.record(z.string(), z.record(z.string(), z.number().int().min(0))).default({}),
  /** Choice items: the move the holder is locked into. */
  choice: z.record(z.string(), z.string()).default({}),
  /** Metronome: the holder's last move and how many times in a row. */
  streak: z.record(z.string(), z.object({ moveId: z.string(), count: z.number().int().min(0) })).default({}),
  /** Air Balloons that have popped. */
  popped: z.array(z.string()).default([]),
  /** Micle Berry: the next move can't miss. Custap Berry: moves first next turn. */
  sure: z.array(z.string()).default([]),
  first: z.array(z.string()).default([]),
  /** Critical-hit stages from berries and Dire Hit. */
  crit: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Items taken, knocked off or swapped away for this battle (uid → item ids) and items gained (uid → item → copies). */
  lost: z.record(z.string(), z.array(z.string())).default({}),
  gained: z.record(z.string(), z.record(z.string(), z.number().int().min(0))).default({}),
  /** Embargo turns left per Pokémon uid, and Magic Room turns left. */
  embargo: z.record(z.string(), z.number().int().min(0)).default({}),
  magicRoom: z.number().int().min(0).default(0),
  /** Attacks your side has made this battle (First Attack perks). */
  playerAttacks: z.number().int().min(0).default(0),
  /** Berries the player's side ate this battle (Powder Jar, Gooey Mulch). */
  berries: z.number().int().min(0).default(0),
});
export type HeldState = z.infer<typeof HeldStateSchema>;
export const freshHeldState = (): HeldState => ({ used: {}, choice: {}, streak: {}, popped: [], sure: [], first: [], crit: {}, lost: {}, gained: {}, embargo: {}, magicRoom: 0, playerAttacks: 0, berries: 0 });

/** Battle-only conditions on the Pokémon in battle; cleared when it switches out. */
export const VolatileSchema = z.object({
  /** Turns of confusion left (0 = not confused). */
  confusion: z.number().int().min(0).default(0),
  /** Must rest this turn (after Hyper Beam). */
  recharge: z.boolean().default(false),
  /** Protect uses in a row (each one is less likely to work). */
  protectChain: z.number().int().min(0).default(0),
  /** Turns left of being bound (Wrap); it can't switch out meanwhile. */
  bound: z.number().int().min(0).default(0),
  /** Seeded by Leech Seed. */
  seeded: z.boolean().default(false),
  /** The two-turn move it is charging (it uses it next turn). */
  charging: z.string().nullable().default(null),
  /** Hidden in the air, underground, underwater or vanished (first turn of Fly, Dig, Dive, Phantom Force). */
  semi: SemiSchema.nullable().default(null),
  /** Locked into Thrash or Outrage for `turns` more turns. */
  locked: z.object({ moveId: z.string(), turns: z.number().int().min(0) }).nullable().default(null),
  /** Full turns it has been in battle (Fake Out works only on the first). */
  turnsOut: z.number().int().min(0).default(0),
  /** Flash Fire took a Fire move: its own Fire moves are 1.5× as strong. */
  flashFire: z.boolean().default(false),
  /** Truant: it loafs around on its next turn. */
  truant: z.boolean().default(false),
  /** Protean / Libero: the type it has become (until it switches out). */
  typeShift: TypeNameSchema.nullable().default(null),
  /** Trace / Mummy: the ability it has now instead of its own (until it switches out). */
  abilityOverride: z.string().nullable().default(null),
  /** Focus Energy: critical hits are two stages likelier. */
  focusEnergy: z.boolean().default(false),
  /** Laser Focus: the next attack is a critical hit. */
  laserFocus: z.boolean().default(false),
  /** Lock-On / Mind Reader: the next attack can't miss. */
  sureHit: z.boolean().default(false),
  /** Ingrain / Aqua Ring: heals 1/16 each turn (Ingrain also holds it in place). */
  regen: z.enum(['ingrain', 'aquaRing']).nullable().default(null),
  /** Endure: it can't be knocked out this turn. */
  endure: z.boolean().default(false),
  /** Mean Look and friends: it can't be switched out. */
  trapped: z.boolean().default(false),
  /** The move it used last (for Disable, Encore, Spite, Copycat, Torment). */
  lastMove: z.string().nullable().default(null),
  /** Disable: this move can't be used for `turns` more turns. */
  disabled: z.object({ moveId: z.string(), turns: z.number().int().min(0) }).nullable().default(null),
  /** Torment: it can't use the same move twice in a row. */
  torment: z.boolean().default(false),
  /** Taunt: turns left in which it can only use attacks. */
  taunt: z.number().int().min(0).default(0),
  /** Heal Block: turns left in which it can't heal. */
  healBlock: z.number().int().min(0).default(0),
  /** Wish: turns until it heals (0 = none) and the amount. */
  wish: z.object({ turns: z.number().int().min(0), amount: z.number().int().min(0) }).nullable().default(null),
  /** Damage it took from the foe's physical and special moves this turn (Counter, Mirror Coat). */
  tookPhysical: z.number().int().min(0).default(0),
  tookSpecial: z.number().int().min(0).default(0),
  /** What it chose to do this turn: an attack or not (Sucker Punch, Thunderclap). */
  plannedAttack: z.boolean().default(false),
  /** It leaves the field after this turn (U-turn, Baton Pass); `baton` passes its stat changes on. */
  pivot: z.object({ baton: z.boolean() }).nullable().default(null),
  /** The move before the last one (Blood Moon can't be used twice in a row). */
  prevMove: z.string().nullable().default(null),
  /** Substitute: HP left in the decoy (0 = none). */
  substitute: z.number().int().min(0).default(0),
  /** Destiny Bond: whoever knocks it out this turn faints too. */
  destinyBond: z.boolean().default(false),
  /** Perish Song: turns until it faints (0 = not counting). */
  perish: z.number().int().min(0).default(0),
  /** Yawn: turns until it falls asleep (0 = not drowsy). */
  yawn: z.number().int().min(0).default(0),
  /** Magnet Rise: turns left floating. */
  magnetRise: z.number().int().min(0).default(0),
  /** Smack Down: brought to the ground. */
  smackedDown: z.boolean().default(false),
  /** Stockpile: times stored (0–3). */
  stockpile: z.number().int().min(0).max(3).default(0),
  /** Full type override (Reflect Type, Forest's Curse, Burn Up...). */
  typeList: z.array(z.string()).nullable().default(null),
  /** Stats replaced for this stay (Power Trick, Speed Swap, the Splits). */
  statOverride: z.record(z.string(), z.number()).default({}),
  /** Charge: the next Electric move is twice as strong. */
  charged: z.boolean().default(false),
  /** Rage: Attack rises when hit. */
  raging: z.boolean().default(false),
  /** Times hit this stay (Rage Fist). */
  timesHit: z.number().int().min(0).default(0),
  /** Its last move failed (Stomping Tantrum). */
  lastFailed: z.boolean().default(false),
  /** A stat fell this turn (Lash Out). */
  loweredThisTurn: z.boolean().default(false),
  /** Moves used this stay (Last Resort). */
  movesUsed: z.array(z.string()).default([]),
  /** Rollout / Ice Ball hits in a row. */
  rollout: z.number().int().min(0).default(0),
  /** Nightmare: loses HP while asleep. */
  nightmare: z.boolean().default(false),
  /** Cursed by a Ghost's Curse. */
  cursed: z.boolean().default(false),
  /** Imprison: the foe can't use moves it knows. */
  imprison: z.boolean().default(false),
  /** Snatch: steals the foe's next self-move. */
  snatching: z.boolean().default(false),
  /** Magic Coat: bounces status moves this turn. */
  coating: z.boolean().default(false),
  /** Crafty Shield / Quick Guard / Mat Block this turn. */
  shield: z.string().nullable().default(null),
  /** Powder: its Fire move this turn backfires. */
  powdered: z.boolean().default(false),
  /** Foresight / Odor Sleuth ('ghost') or Miracle Eye ('dark'). */
  identified: z.string().nullable().default(null),
  /** Tar Shot: weak to Fire. */
  tarred: z.boolean().default(false),
  /** Telekinesis turns left. */
  telekinesis: z.number().int().min(0).default(0),
  /** Octolock: trapped, stats fall each turn. */
  octolock: z.boolean().default(false),
  /** Syrup Bomb: Speed falls for this many turns. */
  syrup: z.number().int().min(0).default(0),
  /** Salt Cure: loses HP each turn. */
  saltCure: z.boolean().default(false),
  /** Uproar turns left. */
  uproar: z.number().int().min(0).default(0),
  /** Bide: turns left and damage stored. */
  bide: z.object({ turns: z.number().int(), damage: z.number().int() }).nullable().default(null),
  /** Beak Blast: burns contact attackers this turn. */
  beakHeat: z.boolean().default(false),
  /** Electrify: its next move is Electric. */
  electrified: z.boolean().default(false),
  /** Glaive Rush: foes always hit it for double damage. */
  exposed: z.boolean().default(false),
  /** Mimic: the move slot that was replaced. */
  mimicked: z.object({ slot: z.number().int(), original: z.string() }).nullable().default(null),
  /** The move it chose this turn (Me First, Upper Hand). */
  plannedMove: z.string().nullable().default(null),
  /** Grudge: the move that knocks it out loses its PP. */
  grudge: z.boolean().default(false),
  /** Morpeko's Hunger Switch: currently in the Hangry mode. */
  hangry: z.boolean().default(false),
  /** Sky Drop: true while the user of Sky Drop holds this Pokémon in the air. */
  skyHeld: z.boolean().default(false),
  /** Attract: half the time it can't move. */
  infatuated: z.boolean().default(false),
  /** Illusion: the species this Pokémon looks like until a damaging move hits it. */
  illusion: z.string().nullable().default(null),
  /** Roost: Flying type lost until the turn ends. */
  roost: z.boolean().default(false),
  /** Throat Chop: sound moves blocked for this many turns. */
  throat: z.number().int().min(0).default(0),
  /** Types lost (Burn Up, Double Shock). */
  lostTypes: z.array(z.string()).default([]),
});
export type Volatile = z.infer<typeof VolatileSchema>;
export const freshVolatile = (): Volatile => ({
  confusion: 0,
  recharge: false,
  protectChain: 0,
  bound: 0,
  seeded: false,
  charging: null,
  semi: null,
  locked: null,
  turnsOut: 0,
  flashFire: false,
  truant: false,
  typeShift: null,
  abilityOverride: null,
  focusEnergy: false,
  laserFocus: false,
  sureHit: false,
  regen: null,
  endure: false,
  trapped: false,
  lastMove: null,
  disabled: null,
  torment: false,
  taunt: 0,
  healBlock: 0,
  wish: null,
  tookPhysical: 0,
  tookSpecial: 0,
  plannedAttack: false,
  pivot: null,
  prevMove: null,
  substitute: 0,
  destinyBond: false,
  perish: 0,
  yawn: 0,
  magnetRise: 0,
  smackedDown: false,
  stockpile: 0,
  typeList: null,
  statOverride: {},
  charged: false,
  raging: false,
  timesHit: 0,
  lastFailed: false,
  loweredThisTurn: false,
  movesUsed: [],
  rollout: 0,
  nightmare: false,
  cursed: false,
  imprison: false,
  snatching: false,
  coating: false,
  shield: null,
  powdered: false,
  identified: null,
  tarred: false,
  telekinesis: 0,
  octolock: false,
  syrup: 0,
  saltCure: false,
  uproar: 0,
  bide: null,
  beakHeat: false,
  electrified: false,
  exposed: false,
  mimicked: null,
  plannedMove: null,
  grudge: false,
  hangry: false,
  skyHeld: false,
  infatuated: false,
  illusion: null,
  roost: false,
  throat: 0,
  lostTypes: [],
});

export const StagesSchema = z.record(BoostStatSchema, z.number().int().min(-6).max(6));
export type Stages = z.infer<typeof StagesSchema>;

/**
 * A double battle. The engine always works on one Pokémon per side (activeIndex / enemyIndex with
 * their stages and volatile); the other one waits here and the two trade places when the engine
 * turns to it. `index` -1 is an empty spot (nobody left to send out).
 */
const DoublesSlotSchema = z.object({ index: z.number().int().min(-1), stages: StagesSchema, vol: VolatileSchema.default(freshVolatile) });
export const DoublesSchema = z.object({
  player: DoublesSlotSchema,
  enemy: DoublesSlotSchema,
  /** True while the Pokémon in the main fields stands in the right-hand spot (spot 1). */
  swapped: z.object({ player: z.boolean(), enemy: z.boolean() }),
  /** Spots (0 left, 1 right) waiting for the player to send out a replacement. */
  refill: z.array(z.number().int().min(0).max(1)).default([]),
  /** Tatsugiri commanding from inside a partner Dondozo (Commander): they skip their turns and can't be hit. */
  commanding: z.array(z.string()).default([]),
  /** Where each Pokémon last aimed its move (the second turn of Solar Beam goes the same way). */
  aims: z.record(z.string(), z.object({ side: z.enum(['player', 'enemy']), spot: z.union([z.literal(0), z.literal(1)]) })).default({}),
});
export type DoublesState = z.infer<typeof DoublesSchema>;

export const LevelBreakdownSchema = z.object({
  base: z.number(),
  progress: z.number(),
  variance: z.number(),
  archetypeOffset: z.number(),
  /** Party-strength correction (levels), when it applied. */
  party: z.number().optional(),
  bonus: z.number(),
  unclamped: z.number(),
  level: z.number(),
});
export type LevelBreakdown = z.infer<typeof LevelBreakdownSchema>;

/**
 * Battle transformations (Mega Evolution, ...; core/battle/transform.ts).
 * A transformed Pokémon's speciesId is its new form during the battle; `forms`
 * remembers what it was so it changes back when the battle ends.
 */
export const BattleTransformSchema = z.object({
  /** The mechanics each side has already used this battle (each works once per battle). */
  used: z.object({ player: z.array(TransformKindSchema), enemy: z.array(TransformKindSchema) }),
  /** uid -> what that Pokémon transformed with and the species it was before. One transformation per Pokémon. */
  forms: z.record(z.string(), z.object({ kind: z.enum(['mega', 'primal', 'gigantamax', 'tera', 'zmove', 'dynamax', 'ability']), from: z.string() })),
  /** The mechanics the opponent may use (bosses; see balance.transformations). */
  enemyMechanics: z.array(TransformKindSchema),
  /** uid -> the type a Terastallized Pokémon has become. */
  teraTypes: z.record(z.string(), TypeNameSchema).default({}),
  /** An extra type a boss member carries this battle (Meteor's Prophecy), by uid. */
  bonusTypes: z.record(z.string(), TypeNameSchema).default({}),
  /** uid -> turns left for a Dynamaxed Pokémon. */
  dynamax: z.record(z.string(), z.number().int().min(0)).default({}),
  /** uid -> the once-per-battle mechanic it used (Tera, Z-Move or Dynamax; one per Pokémon). */
  mechanics: z.record(z.string(), z.enum(['tera', 'zmove', 'dynamax'])).default({}),
});
export type BattleTransform = z.infer<typeof BattleTransformSchema>;

export const freshTransform = (): BattleTransform => ({ used: { player: [], enemy: [] }, forms: {}, enemyMechanics: [], teraTypes: {}, bonusTypes: {}, dynamax: {}, mechanics: {} });

export const freshExtra = () => ({
  allyFaintedTurn: { player: -9, enemy: -9 },
  echo: { n: 0, turn: -9 },
  fusion: { fire: -9, electric: -9 },
  delayed: [] as { side: 'player' | 'enemy'; turns: number; userUid: string; userSide: 'player' | 'enemy'; moveId: string }[],
  ionDeluge: false,
  wonderRoom: 0,
  brokenFace: [] as string[],
  delta: false,
  mimic: {} as Record<string, { kind: 'mimic' | 'transform'; slot: number; moves: { id: string; pp: number }[] }>,
  fairyLock: -9,
  passSub: { player: 0, enemy: 0 },
  healingWish: { player: 'none' as 'none' | 'wish' | 'dance', enemy: 'none' as 'none' | 'wish' | 'dance' },
});

/** What is set up on one side of the field: screens and other turn counters, and entry hazards. */
export const SideEffectsSchema = z.object({
  reflect: z.number().int().min(0).default(0),
  lightScreen: z.number().int().min(0).default(0),
  auroraVeil: z.number().int().min(0).default(0),
  tailwind: z.number().int().min(0).default(0),
  safeguard: z.number().int().min(0).default(0),
  mist: z.number().int().min(0).default(0),
  luckyChant: z.number().int().min(0).default(0),
  spikes: z.number().int().min(0).max(3).default(0),
  toxicSpikes: z.number().int().min(0).max(2).default(0),
  stealthRock: z.boolean().default(false),
  stickyWeb: z.boolean().default(false),
});
export type SideEffects = z.infer<typeof SideEffectsSchema>;
export const freshSideEffects = (): SideEffects => SideEffectsSchema.parse({});

/** The changing state of a raid fight (rules in core/raid/raid.ts). */
export const RaidBattleSchema = z.object({
  id: z.string(),
  /** Shield thresholds (shares of max HP) that haven't fired yet. */
  pendingShields: z.array(z.number()),
  /** Shield points left (absorbs damage before HP); 0 = no shield up. */
  shieldHp: z.number().int().min(0),
  shieldMax: z.number().int().min(0),
  /** Indexes of phases (in the raid's list) already started. */
  phasesDone: z.array(z.number().int().min(0)),
  /** Turns until the next charged attack (null = no telegraph); `charging` = the boss's next hit is boosted. */
  nextCharge: z.number().int().nullable(),
  charging: z.boolean(),
  extraUsed: z.number().int().min(0),
  /** Turns left on the timer (null = no timer). */
  timerLeft: z.number().int().nullable(),
  /** Messages for the player; the engine turns them into events at the end of the turn. */
  notes: z.array(z.object({ tone: z.enum(['shield', 'phase', 'warn', 'info']), text: z.string() })),
  /** Cheers left (Raid Battles pack: Offense / Defense / Healing), and the turns the Offense and Defense cheers still last. */
  cheersLeft: z.number().int().min(0).default(3),
  cheerOffense: z.number().int().min(0).default(0),
  cheerDefense: z.number().int().min(0).default(0),
  /** Cheer level 1 to 3 (earned by winning raids): stronger and richer cheers. */
  cheerLevel: z.number().int().min(1).max(3).default(1),
  /** Who earned a raid memory (uids): started the raid, broke a shield, took a charged attack under a Defense cheer, survived a charged attack. */
  lead: z.string().nullable().default(null),
  breaker: z.string().nullable().default(null),
  tank: z.string().nullable().default(null),
  survivor: z.string().nullable().default(null),
  /** Raid types: a rival fights beside you, the boss is back after escaping, and the approach's prize changes. */
  rivalHelped: z.boolean().default(false),
  /** The named rival fighting the boss (or racing you for the last hit), and whether it landed the final blow. */
  rival: z.object({ id: z.string(), name: z.string(), speciesId: z.string(), level: z.number().int().min(1), mode: z.enum(['help', 'race']) }).nullable().default(null),
  rivalFinished: z.boolean().default(false),
  returning: z.boolean().default(false),
  rewardPercent: z.number().int().default(100),
  draftDelta: z.number().int().default(0),
});
export type RaidBattle = z.infer<typeof RaidBattleSchema>;

/** The changing state of a Totem fight (rules in core/totem/totem.ts). */
export const TotemBattleSchema = z.object({
  id: z.string(),
  /** The Totem's own uid (the ally takes the field in its place while called). */
  uid: z.string(),
  auraDone: z.boolean(),
  phasesDone: z.array(z.number().int().min(0)),
  callsUsed: z.number().int().min(0),
  /** The ally's uid while it is on the field. */
  allyUid: z.string().nullable(),
});
export type TotemBattle = z.infer<typeof TotemBattleSchema>;

/** A wild Pokémon's SOS call (rules in core/battle/sos.ts). */
export const SosBattleSchema = z.object({
  answered: z.number().int().min(0),
  callerUid: z.string().nullable(),
  allyUid: z.string().nullable(),
  lastTurnCalled: z.number().int().min(0),
  lastAnswered: z.boolean().nullable(),
});

/** A minigame being played (rules in core/minigame). `state` is the game's own JSON; `outcome` appears when it ends. */
export const MinigameSessionSchema = z.object({
  id: z.string(),
  sideId: z.string(),
  tier: z.number().int().min(0).max(2),
  state: z.unknown(),
  outcome: z.object({ score: z.number(), max: z.number(), medal: z.enum(['none', 'bronze', 'silver', 'gold']), money: z.number().int(), item: z.string().nullable(), lines: z.array(z.string()) }).nullable(),
});
export type MinigameSession = z.infer<typeof MinigameSessionSchema>;

/** A Mega-Expedition in progress (rules in core/expedition). */
export const ExpeditionStateSchema = z.object({
  id: z.string(),
  nodes: z.array(z.object({ id: z.string(), layer: z.number().int().min(0), kind: z.string(), next: z.array(z.string()), done: z.boolean() })),
  /** The last node finished (null before the first). */
  current: z.string().nullable(),
  /** The node being fought or decided now. */
  node: z.string().nullable(),
  status: z.enum(['choice', 'route', 'battle', 'done']),
  /** A pending choice: recruit/draft/rest/mystery options. `left` = picks still to make (draft). */
  choice: z.object({ kind: z.enum(['draft', 'combined', 'recruit', 'rest', 'mystery']), title: z.string(), options: z.array(z.object({ label: z.string(), detail: z.string(), speciesId: z.string().optional() })), left: z.number().int().min(1) }).nullable(),
  /** The player's own party while rentals or a draft are used. */
  stash: z.array(PokemonInstanceSchema).nullable(),
  /** Pokémon that belong to the expedition only (rentals, recruits): they leave when it ends. */
  tempUids: z.array(z.string()),
  /** Rewards held until extraction; lost (mostly) on failure. */
  loot: z.object({ money: z.number().int().min(0), items: z.record(z.string(), z.number().int().min(0)), energy: z.number().int().min(0), research: z.number().int().min(0) }),
  /** Items lent for the expedition (a Mega Ring, Mega Stones): stones become permanent on success. */
  tempItems: z.array(z.string()),
  level: z.number().int().min(2),
  /** Set when a fight ends: the expedition reads it the next time it is shown. */
  battleResult: z.enum(['win', 'lose']).nullable(),
  log: z.array(z.string()),
});
export type ExpeditionState = z.infer<typeof ExpeditionStateSchema>;

export const BattleStateSchema = z.object({
  kind: z.enum(['wild', 'trainer']),
  /** The ball that caught the wild Pokémon (Friend, Luxury and Heal Ball change it afterwards). */
  ball: z.string().optional(),
  turn: z.number().int().min(1),
  /** Encore! Hype (core/battle/engine.ts applyHype): the meter, turns of boost left, and whether the run's Hype was loaded in. */
  hype: z.number().int().min(0).default(0),
  hypeTurns: z.number().int().min(0).default(0),
  hypeLoaded: z.boolean().default(false),
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
  playerVolatile: VolatileSchema.default(freshVolatile),
  enemyVolatile: VolatileSchema.default(freshVolatile),
  /** The weather and how many turns it has left. */
  weather: z.object({ id: WeatherSchema, turns: z.number().int().min(0), primal: z.string().optional() }).nullable().default(null),
  /** The terrain and how many turns it has left. */
  terrain: z.object({ id: TerrainSchema, turns: z.number().int().min(0) }).nullable().default(null),
  /** Field-wide effects and their turns left. */
  field: z.object({ gravity: z.number().int().min(0).default(0), trickRoom: z.number().int().min(0).default(0), waterSport: z.number().int().min(0).default(0), mudSport: z.number().int().min(0).default(0) }).default(() => ({ gravity: 0, trickRoom: 0, waterSport: 0, mudSport: 0 })),
  /** Smaller battle-wide counters for the rarer moves (see core/battle/engine.ts). */
  extra: z.object({
    allyFaintedTurn: z.object({ player: z.number().int().default(-9), enemy: z.number().int().default(-9) }).default({ player: -9, enemy: -9 }),
    echo: z.object({ n: z.number().int().default(0), turn: z.number().int().default(-9) }).default({ n: 0, turn: -9 }),
    fusion: z.object({ fire: z.number().int().default(-9), electric: z.number().int().default(-9) }).default({ fire: -9, electric: -9 }),
    delayed: z.array(z.object({ side: z.enum(['player', 'enemy']), turns: z.number().int(), userUid: z.string(), userSide: z.enum(['player', 'enemy']), moveId: z.string() })).default([]),
    ionDeluge: z.boolean().default(false),
    wonderRoom: z.number().int().default(0),
    /** Pokémon whose Disguise / Ice Face is already used up. */
    brokenFace: z.array(z.string()).default([]),
    delta: z.boolean().default(false),
    mimic: z.record(z.string(), z.object({ kind: z.enum(['mimic', 'transform']), slot: z.number().int(), moves: z.array(z.object({ id: z.string(), pp: z.number().int() })) })).default({}),
    fairyLock: z.number().int().default(-9),
    passSub: z.object({ player: z.number().int().default(0), enemy: z.number().int().default(0) }).default({ player: 0, enemy: 0 }),
    healingWish: z.object({ player: z.enum(['none', 'wish', 'dance']).default('none'), enemy: z.enum(['none', 'wish', 'dance']).default('none') }).default({ player: 'none', enemy: 'none' }),
  }).default(() => freshExtra()),
  /** Baton Pass: the stat changes the next Pokémon inherits. */
  batonStages: StagesSchema.nullable().default(null),
  /** Screens, Tailwind and entry hazards on each side. */
  sideEffects: z.object({ player: SideEffectsSchema.default(freshSideEffects), enemy: SideEffectsSchema.default(freshSideEffects) }).default(() => ({ player: freshSideEffects(), enemy: freshSideEffects() })),
  /** Sides whose Pokémon just came in and whose entry ability (Intimidate, Drizzle) hasn't happened yet. */
  pendingEntry: z.array(z.enum(['player', 'enemy'])).default([]),
  /** uids of party Pokémon that fought the current enemy (they share its experience). */
  participants: z.array(z.string()),
  /** True when the active Pokémon fainted and the player must send out another. */
  needsSwitch: z.boolean(),
  /** The Last Stand Charm can only save the player once per battle. */
  lastStandUsed: z.boolean(),
  /** A smart trainer's potions and deliberate switches so far this battle. */
  enemyItemsUsed: z.number().int().min(0).default(0),
  enemySwitches: z.number().int().min(0).default(0),
  /** Battle-scope story effects already used this battle (e.g. "toughened-it-out@p1"); see core/story/ledger.ts. */
  storyEffects: z.array(z.string()),
  /** Hyper counters: the current low-HP stand and super-effective hits survived (core/battle/hyper.ts). */
  hyper: z
    .object({
      lowHp: z.object({ uid: z.string(), turns: z.number().int().min(0) }).nullable(),
      superEffective: z.record(z.string(), z.number().int().min(0)),
      rage: z
        .record(
          z.string(),
          z.object({ hits: z.number().int().min(0), state: z.enum(['calm', 'warned', 'spent']), uncontrollable: z.boolean(), denied: z.boolean() }),
        )
        .default({}),
      met: z.record(z.string(), z.array(z.string())).default({}),
      rivals: z.record(z.string(), z.enum(['calm', 'reckless'])).default({}),
      outdo: z.array(z.string()).default([]),
    })
    .default(freshHyperBattle),
  outcome: z.enum(['win', 'lose', 'caught']).nullable(),
  /** A temporary ally (event battle): its uid. It fights beside you in a double battle and leaves the party when the battle ends. */
  loaner: z.string().optional(),
  /** How each enemy's level was worked out (shown in the debug panel). */
  levelInfo: z.array(LevelBreakdownSchema).default([]),
  /** 0–1: the chance each turn that the enemy picks its best move (bosses), otherwise a random one. */
  ai: z.number().min(0).max(1).default(0),
  transform: BattleTransformSchema.default(freshTransform),
  held: HeldStateSchema.default(freshHeldState),
  /** Map items in this battle: turns the wild Pokémon loses (Poké Doll), and the catch-rate items for ball throws. */
  mapItems: z.object({ freeTurns: z.number().int().min(0), thrown: z.number().int().min(0) }).optional(),
  /** A VS Seeker rematch: double prize money. */
  rematch: z.boolean().optional(),
  /** "This Trainer Will Return": the enemy profile id of a trainer back for its rematch. */
  returning: z.string().optional(),
  /** An RSVP Mail rival: beating it gives a better reward draft. */
  rival: z.boolean().optional(),
  /** The scripted first rival (stage 2): fighting it switches the Exp. Share on. */
  firstRival: z.boolean().optional(),
  /** A rival back for its rematch (Living Rivalry Engine): its id, and what it changed about its team. */
  rivalId: z.string().optional(),
  rivalNote: z.string().optional(),
  /** Narrative rival defeat (M12): losing this rival fight is part of the story and does not end the run (rivals/narrativeDefeat.ts). */
  narrative: z.object({ id: z.string(), maxTurns: z.number().int().min(1).default(60) }).optional(),
  /** Nemesis system: the nemesis back for its Return or Reckoning, and the telegraphed change told in the intro. */
  nemesis: z.string().optional(),
  nemesisNote: z.string().optional(),
  /** Trainer tiers: what an ordinary trainer remembers about you, told in the intro. */
  memoryNote: z.string().optional(),
  /** "The Hunter Has Become the Hunted!": an ordinary trainer whose class you beat too often, with a counter-team. */
  hunted: z.boolean().optional(),
  /** A Pokémon fished from a fishing spot: an extra catch, with no reward draft after it. */
  fishing: z.boolean().optional(),
  /** A raid boss fight: shield, phases, telegraph and timer (core/raid/raid.ts). */
  raid: RaidBattleSchema.optional(),
  /** A battle an event started: no reward draft after it, and `win` effects if you win (events.json). */
  event: z.object({ eventId: z.string(), choiceIndex: z.number().int().min(0), sideId: z.string(), success: z.boolean(), step: z.number().int().min(0).optional() }).optional(),
  /** Battle Drama Engine: what the trainer has already said (see core/drama). */
  drama: DramaBattleSchema.default(freshDrama),
  /** A Totem fight: aura, ally calls and phases (core/totem/totem.ts). */
  totem: TotemBattleSchema.optional(),
  /** A wild Pokémon that called for help (core/battle/sos.ts); absent until the first call. */
  sos: SosBattleSchema.optional(),
  /** A fight on an expedition route: afterwards the run goes back to the expedition, not the map or a draft. */
  expedition: z.boolean().optional(),
  /** A double battle (core/battle/doubles.ts): the second Pokémon on each side. */
  doubles: DoublesSchema.optional(),
});
export type BattleState = z.infer<typeof BattleStateSchema>;

// ---------- the Trainer Plaza (core/plaza) ----------

export const PlazaStateSchema = z.object({
  /** How well the plaza knows you: grows with trades, errands, fair deals and club matches. */
  rep: z.number().int().min(0).default(0),
  /** Friendship with each regular (plaza.json `regulars`). */
  friends: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Unlocks: "alley", "trade:<trader id>", "discount:<regular id>", "caravan:<id>". */
  flags: z.array(z.string()).default([]),
  /** Errands taken and not finished; `base` is the counter's value when you took it. */
  errands: z.array(z.object({ id: z.string(), base: z.number().int().min(0), stage: z.string() })).default([]),
  /** Errands and board notices finished for good. */
  done: z.array(z.string()).default([]),
  /** Things done at this stage's plaza: "<stage key>:<what>" counts. */
  used: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Trainers you fought earlier in the run, for "past enemies return". */
  foes: z.array(z.object({ name: z.string(), classId: z.string(), won: z.boolean() })).default([]),
  /** A Battle Club streak in progress. */
  club: z.object({ stage: z.string(), format: z.string(), round: z.number().int().min(0), theme: z.string().nullable().default(null) }).nullable().default(null),
  visits: z.number().int().min(0).default(0),
});
export type PlazaState = z.infer<typeof PlazaStateSchema>;
export const freshPlaza = (): PlazaState => PlazaStateSchema.parse({});

// ---------- stage maps ----------

export const SideStopSchema = z.object({
  id: z.string(),
  kind: z.enum(['heal', 'shop', 'fish', 'raid', 'totem', 'event', 'expedition', 'minigame', 'service', 'plaza']),
  /** A raid den: which raid (raids.json) waits here. */
  raidId: z.string().optional(),
  /** A raid boss that escaped earlier and is back, stronger. */
  returning: z.boolean().optional(),
  /** A Totem's territory: which Totem (totems.json) lives here. */
  totemId: z.string().optional(),
  /** An expedition gate: which expedition (expeditions.json) starts here. */
  expeditionId: z.string().optional(),
  /** A minigame stop: which game (minigames.json) waits here. */
  minigameId: z.string().optional(),
  /** A service stop: which service (services.json) waits here. */
  serviceId: z.string().optional(),
  /** A healing stop, a fishing spot and an event work once; a shop can be visited again. */
  used: z.boolean(),
  /** An event stop's event (events.json). */
  eventId: z.string().optional(),
  /** A hidden event shows as "?" until the player reaches its node (or Intelligence or a Silph Scope reveals it). */
  hidden: z.boolean().optional(),
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
  z.object({ kind: z.literal('caught'), mon: PokemonInstanceSchema, /** A beaten raid boss joining: the raid's tier (picks the capture jingle). */ raidTier: z.number().int().min(1).max(6).optional() }),
  /** A TM or HM: pick which of these moves the Pokémon learns (or skip). */
  z.object({ kind: z.literal('teachMove'), uid: z.string(), itemName: z.string(), moveIds: z.array(z.string()).min(1) }),
  /** A Pokémon from a past run wants to join (story slice 5, core/story/reunion.ts); `hallOfFame`: it won a past run with you. */
  z.object({ kind: z.literal('reunion'), mon: PokemonInstanceSchema, hallOfFame: z.boolean() }),
  /** A veteran offers to mentor a younger teammate (core/story/mentorship.ts). */
  z.object({ kind: z.literal('mentorship'), mentorUid: z.string(), proteUid: z.string(), path: z.enum(['guardian', 'striker', 'strategist', 'survivor', 'challenger', 'bonded']) }),
  /** A benched Pokémon asks to lead (core/story/askLead.ts). */
  z.object({ kind: z.literal('askLead'), uid: z.string(), reason: z.enum(['leftOut', 'campfire']) }),
  /** A PP Up or PP Max: pick which move gets the extra PP. */
  z.object({ kind: z.literal('ppUp'), uid: z.string(), itemName: z.string(), ups: z.number().int().min(1).max(3) }),
  /** A trainer's signature mechanic: pick one of the options (core/signature.ts). */
  z.object({
    kind: z.literal('signature'),
    mechanicId: z.string(),
    title: z.string(),
    options: z.array(z.object({
      label: z.string(),
      description: z.string(),
      effects: z.array(ArchetypeModifierSchema),
      /** Items and party levels the option hands out at once. */
      grant: z.object({ items: z.record(z.string(), z.number().int().positive()).optional(), partyLevels: z.number().int().positive().optional() }).optional(),
      /** The effects run out: after `battles` more battles of the `until` kind. */
      temp: z.object({ battles: z.number().int().min(1), until: z.enum(['battle', 'boss', 'wild']) }).optional(),
    })).min(2),
  }),
]);
export type PendingDecision = z.infer<typeof PendingDecisionSchema>;

/** The choices made on the Preparation Desk before a run (GAME_DESIGN.md §14.7). */
export const RunPrepSchema = z.object({
  campaignId: z.string(),
  poolId: z.string(),
  draftRuleId: z.string(),
  /** The chosen type, for the Type Focus draft rule. */
  typeFocus: TypeNameSchema.nullable(),
  /** The preparation token for this run, or none. */
  tokenId: z.string().nullable(),
  /** The Research Directive (plan Part 5): a type to study this run for bonus Research Points, or none. */
  directive: TypeNameSchema.nullable(),
  /** The Field License (Untitled doc §10): one exploration hint for the run, or none. */
  license: z.enum(['boss', 'shop', 'weakness']).nullable().default(null),
  /** A Bank loan (core/bank.ts): extra starting money, repaid by reaching enough badges. */
  loan: z.boolean().default(false),
  /** An item taken out of the Collector's Vault to start this run with. */
  vaultItem: z.string().nullable().default(null),
});
export type RunPrep = z.infer<typeof RunPrepSchema>;

/** A saved loadout: a trainer and preparation choices (preferences only, nothing is reserved). */
export const LoadoutPresetSchema = RunPrepSchema.extend({ name: z.string(), archetypeId: z.string() });
export type LoadoutPreset = z.infer<typeof LoadoutPresetSchema>;

/** The rules a run was started with, fixed for the whole run (Untitled doc §13–16). Rewards use this snapshot at the end. */
export const RunRulesSchema = z.object({
  ruleVersion: z.number().int().min(1),
  modeId: z.string(),
  difficultyId: z.string(),
  modifierIds: z.array(z.string()),
  deathBlock: z.boolean(),
  /** True once Death-Block has saved the run (it works once). */
  deathBlockUsed: z.boolean(),
  /** False means no account-level rewards of any kind (Adventure). */
  progressionEligible: z.boolean(),
  /** The published reward multiplier, fixed at the start. */
  rewardMultiplier: z.number().min(0),
  /** Added to every enemy's level. */
  enemyLevelBonus: z.number().int(),
  /** Monotype: the type everything must share (set when the starter is chosen). */
  lockType: z.string().nullable().default(null),
  /** Single Region Dex: the generation the run draws from. */
  lockGeneration: z.number().int().min(1).max(9).nullable().default(null),
  /** Regional Circuit: the region the player chose (null: picked by the seed). */
  regionId: z.string().nullable().default(null),
  /** Endless: laps of the regions finished so far. */
  loops: z.number().int().min(0).default(0),
  /** Times a wipe sent the run back to its checkpoint. */
  wipes: z.number().int().min(0),
});
export type RunRules = z.infer<typeof RunRulesSchema>;

export const RunPhaseSchema = z.enum(['starter', 'map', 'shop', 'battle', 'decision', 'reward', 'over', 'expedition', 'minigame']);
export type RunPhase = z.infer<typeof RunPhaseSchema>;

/** A Pokémon kept from a finished run, that may come back in a later one (core/story/reunion.ts). */
export const PastPokemonSchema = z.object({
  speciesId: z.string(),
  level: z.number().int().min(1).max(1000),
  shiny: z.boolean(),
  abilitySlot: z.number().int().min(-1),
  moves: z.array(z.string()).min(1).max(4),
  teraType: TypeNameSchema.optional(),
  runId: z.string(),
  /** It was in the party when that run was won. */
  hallOfFame: z.boolean(),
  /** The legacy titles it earned in that run (Techno §6.9): it comes back remembered. */
  titles: z.array(z.string()).optional(),
});
export type PastPokemon = z.infer<typeof PastPokemonSchema>;

/** One species' mastery counters (runs it was seen/caught in, battles, boss wins, evolutions, flawless boss runs, regions cleared). */
export const MasteryRecordSchema = z.object({
  seen: z.number().int().min(0).default(0),
  caught: z.number().int().min(0).default(0),
  battles: z.number().int().min(0).default(0),
  bossWins: z.number().int().min(0).default(0),
  evolved: z.number().int().min(0).default(0),
  flawless: z.number().int().min(0).default(0),
  regions: z.number().int().min(0).default(0),
  /** The player's picks for this family (kept on its first stage): egg moves and ability slot (-1 hidden). */
  eggMoves: z.array(z.string()).max(2).optional(),
  abilitySlot: z.number().int().min(-1).optional(),
});
export type MasteryRecord = z.infer<typeof MasteryRecordSchema>;

/** What a family's mastery gives a Pokémon of it when it joins (worked out at the start of a run from the profile). */
export const MasteryPerkSchema = z.object({
  eggMoves: z.array(z.string()),
  abilitySlot: z.number().int().min(-1).nullable(),
  awaken: z.boolean(),
});
export type MasteryPerk = z.infer<typeof MasteryPerkSchema>;

/** An Egg the player carries (core/eggs.ts). It hatches when `left` battles (or stages) have passed. */
export const EggSchema = z.object({
  uid: z.string(),
  /** The first stage of its line; what hatches. */
  speciesId: z.string(),
  level: z.number().int().min(1).max(1000),
  left: z.number().int().min(0),
  unit: z.enum(['battle', 'stage']),
  /** Rolled when the Egg was found, so reloading never changes it. */
  shiny: z.boolean(),
  eggMoves: z.array(z.string()),
  /** Where it came from, for the party screen ("Egg Nest", "Mystery Egg"). */
  source: z.string(),
});
export type Egg = z.infer<typeof EggSchema>;

export const RunStateSchema = z.object({
  runId: z.string(),
  seed: z.string(),
  archetypeId: z.string(),
  phase: RunPhaseSchema,
  starterChoices: z.array(z.string()),
  /** How the run was prepared, and a note when the draft rule had to fall back. */
  prep: RunPrepSchema.extend({ note: z.string().nullable() }),
  party: z.array(PokemonInstanceSchema),
  money: z.number().int().min(0),
  /** Bag contents: item id → count. */
  inventory: z.record(z.string(), z.number().int().min(0)),
  /** Team and player catalog items owned this run (catalog id → copies): passives like the Amulet Coin. */
  passives: z.record(z.string(), z.number().int().min(1)).optional(),
  /** Running totals some items need across a run (a Scarf's knockout bonus so far). */
  itemCounters: z.record(z.string(), z.number().int().min(0)).optional(),
  /** A bike chosen from the map's Items menu for the next move (see core/mapItems.ts). */
  moveMode: z.enum(['bicycle', 'acroBike', 'machBike']).optional(),
  /**
   * Map, shop and money items still working (Repels, Flutes, Mail, Apricorns, Coupons...; see core/mapItems.ts):
   * wild battles, ball throws or other uses left, or the stage it lasts for ("next" until the next stage starts).
   */
  mapEffects: z
    .array(
      z.object({
        itemId: z.string(),
        battles: z.number().int().min(0).optional(),
        throws: z.number().int().min(0).optional(),
        /** Shop purchases, shop visits or trainer wins left (the item's `lasts` says which). */
        uses: z.number().int().min(0).optional(),
        stage: z.string().optional(),
      }),
    )
    .optional(),
  /** Candies earned this run; added to the profile when the run ends (D7). */
  candies: z.number().int().min(0),
  /** Number of encounters completed so far. */
  encountersCompleted: z.number().int().min(0),
  battle: BattleStateSchema.nullable(),
  /** Decisions to make after a battle, oldest first. */
  pending: z.array(PendingDecisionSchema),
  /** Eggs waiting to hatch (core/eggs.ts). */
  eggs: z.array(EggSchema).default([]),
  /** Where the run goes once all pending decisions are made. */
  afterDecisions: z.enum(['reward', 'map', 'expedition', 'eventChain']),
  /** An event detour with more battles to come: the next one starts after any decisions (core/events.ts continueEventChain). */
  eventChain: z.object({ eventId: z.string(), choiceIndex: z.number().int().min(0), sideId: z.string(), success: z.boolean(), step: z.number().int().min(0) }).optional(),
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
  /** Rewards that come back in the next draft (Lock Capsule, Favored Mail). */
  draftCarry: z.array(z.string()).optional(),
  /** Transformations switched off for this run (a challenge; M8.75 part D adds the menu that sets it). */
  disabledMechanics: z.array(TransformKindSchema).default([]),
  /** Spare Pokémon in the PC (trainers with box space; core/box.ts). */
  box: z.array(PokemonInstanceSchema).default([]),
  /** Modifiers the run's signature choices added to the trainer's (core/signature.ts). */
  perkEffects: z.array(ArchetypeModifierSchema).default([]),
  /** Bank licenses owned when the run began (Scavenger, Fortune, Survival work inside the run). Older runs have none. */
  licenses: z.array(z.string()).optional(),
  /** Effects of the last temporary signature choice per mechanic, so the next choice can replace them. */
  /** Encore! Hype carried between battles (reset after a boss battle). */
  hype: z.number().int().min(0).default(0),
  /** Signature effects that run out: they leave `perkEffects` after `battles` more battles (of the `until` kind). */
  tempEffects: z.array(z.object({ effects: z.array(ArchetypeModifierSchema), battles: z.number().int().min(1), until: z.enum(['battle', 'boss', 'wild']) })).default([]),
  signatureApplied: z.record(z.string(), z.array(ArchetypeModifierSchema)).default({}),
  /** Mode, difficulty, modifiers and their reward multiplier (core/rules.ts). */
  rules: RunRulesSchema,
  /** Adventure and Death-Block: where a wipe sends you back to (a copy of the run without its own checkpoint). */
  checkpoint: z.record(z.string(), z.unknown()).optional(),
  /** VS Recorder: the run as the current trainer battle began, so a loss can replay it once. */
  recorder: z.record(z.string(), z.unknown()).optional(),
  /** Journal: one line per finished stage (the stops passed), kept for the run history. */
  journal: z.array(z.string()).default([]),
  /** This run's Run Quest (trainerQuests.json runQuests), or null when none was offered. */
  runQuest: z.string().nullable().default(null),
  /** Species Mastery unlocks for this run, by family (first-stage id): applied to each Pokémon of it that joins. */
  mastery: z.record(z.string(), MasteryPerkSchema).default({}),
  /** Game event editions on when the run started ("rivalry-week@2026-W44"): their rules apply and the run counts for them. */
  gameEvents: z.array(z.string()).default([]),
  /** Permanent attributes when the run started (the profile's, copied so the rules stay pure). */
  baseAttributes: z.record(z.string(), z.number()),
  /** Run-only additions to the attributes (from rewards). */
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
    /** Species whose shiny turned up this run. */
    speciesShiny: z.array(z.string()).default([]),
    /** True once the Last Stand Charm has saved the run in the current region. */
    charmUsedInRegion: z.boolean(),
    /** What ended the run, when it was lost. */
    defeatedBy: z.object({ speciesId: z.string(), level: z.number().int(), trainer: z.string().nullable() }).nullable(),
    /** The starter's uid (for Love: regions cleared with the starter still in the party). */
    starterUid: z.string().nullable(),
  }),
  /** The story layer: domain events, Pokémon histories, the chronicle and applied effect ids (core/story). */
  story: StoryStateSchema,
  /** An earlier run's rival whose character may shape one of this run's rivals (picked at the start from the account archive; null: none). */
  legacyRival: ArchivedRivalSchema.nullable().default(null),
  /** Raid record this run (dens entered, won, lost) and the dens already finished. */
  /** Totem record this run, the unlocks they gave and research points. */
  /** The expedition in progress, and the ones finished or unlocked this run. */
  expedition: ExpeditionStateSchema.nullable().default(null),
  /** The minigame in progress; what it paid this stage (money, items, plays per game); attempts per stop; best medal per game. */
  minigame: MinigameSessionSchema.nullable().default(null),
  minigames: z.object({
    stage: z.number().int().default(-1),
    money: z.number().int().default(0),
    items: z.number().int().default(0),
    plays: z.record(z.string(), z.number().int()).default({}),
    attempts: z.record(z.string(), z.number().int()).default({}),
    best: z.record(z.string(), z.enum(['none', 'bronze', 'silver', 'gold'])).default({}),
    effects: z.number().int().default(0),
    /** A shop discount won in a minigame, good for the stage it was won in. */
    discount: z.object({ percent: z.number().int(), stage: z.number().int() }).nullable().default(null),
  }).default(() => ({ stage: -1, money: 0, items: 0, plays: {}, attempts: {}, best: {}, effects: 0, discount: null })),
  expeditions: z.object({ completed: z.array(z.string()), failed: z.array(z.string()), unlocked: z.array(z.string()), last: z.array(z.string()).default([]) }).default(() => ({ completed: [], failed: [], unlocked: [], last: [] })),
  totems: z.object({ entered: z.number().int().min(0), won: z.number().int().min(0), lost: z.number().int().min(0), done: z.array(z.string()), unlocks: z.array(z.string()), research: z.number().int().min(0) }).default(() => ({ entered: 0, won: 0, lost: 0, done: [], unlocks: [], research: 0 })),
  /** Crafting materials held (material id → count; core/crafting.ts). Run-only. */
  materials: z.record(z.string(), z.number().int().min(0)).default(() => ({})),
  /** The Trainer Plaza's memory (core/plaza). */
  plaza: PlazaStateSchema.default(freshPlaza),
  raids: z.object({ entered: z.number().int().min(0), won: z.number().int().min(0), lost: z.number().int().min(0), bestTier: z.number().int().min(0), done: z.array(z.string()), /** Raids whose boss escaped (the timer ran out); each comes back as a stronger den in a later stage. */ escaped: z.array(z.string()).default([]), /** The best raid tier won in earlier runs (older saves: every tier open). */ unlockedTier: z.number().int().min(0).max(6).default(6) }).default(() => ({ entered: 0, won: 0, lost: 0, bestTier: 0, done: [], unlockedTier: 6, escaped: [] })),
  /** Revisit This Timeline (core/timeline/genesis.ts): set only on a replay of a lost run, which saves in its own slot and never touches the profile. */
  timeline: z.object({ replayId: z.string(), originRunId: z.string(), attempt: z.number().int().min(1) }).optional(),
  /** A past run's Pokémon waiting to meet you after this many battles (story slice 5); unset when none was chosen. */
  reunion: z.object({ mon: PastPokemonSchema, afterEncounters: z.number().int().min(1), done: z.boolean() }).optional(),
});
export type RunState = z.infer<typeof RunStateSchema>;

/** The attribute keys (six plain attributes and the Rage/Peace and Good/Evil meters). */
export const ATTRIBUTE_NAMES = ATTRIBUTE_KEYS;

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
/** A Legacy Card kept in the Hall of Fame (core/story/legacy.ts). */
export const LegacyRecordSchema = z.object({
  speciesId: z.string(),
  level: z.number().int(),
  shiny: z.boolean(),
  titles: z.array(z.string()),
  tags: z.array(z.string()),
  signature: z.string().nullable(),
  /** Its mentor's species, when it was a protégé ("It Carried Its Mentor's Legacy"). Older saves: none. */
  mentor: z.string().nullable().default(null),
  /** Legacy Records it earned (Hall of Fame chains such as The Long Gauntlet). Older saves: none. */
  records: z.array(z.string()).default([]),
});
export type LegacyRecord = z.infer<typeof LegacyRecordSchema>;

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
  party: z.array(z.object({ speciesId: z.string(), level: z.number().int(), shiny: z.boolean().default(false) })),
  bankCredits: z.number().int().min(0),
  researchPoints: z.number().int().min(0),
  achievements: z.array(z.string()),
  /** The run's top chronicle moments, most memorable first. */
  moments: z.array(z.string()),
  /** Journal: the run's map, stage by stage (empty without the Journal). */
  journal: z.array(z.string()).default([]),
  /** Hall of Fame: the run's epitaph (null when nothing stood out). */
  epitaph: z.string().nullable().default(null),
  /** Hall of Fame: each party Pokémon's Legacy Card when the run ended. */
  legacy: z.array(LegacyRecordSchema).default([]),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

/** The kinds of moment a legacy run keeps for Relive the Moment (core/legacyRuns.ts). */
export const LEGACY_MOMENT_KINDS = ['firstGym', 'firstLegendary', 'rivalDefeat', 'rivalLoss', 'championVictory', 'finalStanding', 'lastSecond', 'runEnding'] as const;
export const LegacyMomentKindSchema = z.enum(LEGACY_MOMENT_KINDS);
export type LegacyMomentKind = z.infer<typeof LegacyMomentKindSchema>;

/** One party Pokémon as it was when the run ended. */
export const LegacyMonSchema = z.object({
  uid: z.string(),
  speciesId: z.string(),
  level: z.number().int(),
  shiny: z.boolean(),
  moves: z.array(z.string()),
  abilitySlot: z.number().int(),
  nature: z.string().nullable(),
  held: z.array(z.string()),
  starter: z.boolean(),
  knockouts: z.number().int().min(0),
  bossesBeaten: z.number().int().min(0),
  titles: z.array(z.string()),
});
export type LegacyMon = z.infer<typeof LegacyMonSchema>;

/**
 * A finished run, written once when it ends and never changed afterwards (profile v14, core/legacyRuns.ts).
 * It keeps enough to rebuild the run's start (seed, trainer, campaign, prep, rules, starter, region order) and the
 * story of what happened (team, ace, bosses, rivals, nemeses, legendaries, chronicle, moments). The Legacy Score is
 * worked out from it when needed, never stored, so the weights can change without a migration.
 */
export const LegacyRunSchema = z.object({
  /** The record's own format (bump it with a migration when the shape changes). */
  format: z.literal(1),
  /** "run": written at the end of a run. "history": rebuilt from an older Run History entry (fewer facts). */
  source: z.enum(['run', 'history']),
  runId: z.string(),
  endedAt: z.string(),
  seed: z.string(),
  archetypeId: z.string(),
  campaignId: z.string(),
  /** The Preparation Desk choices and rules the run started with (null for rebuilt records). */
  prep: RunPrepSchema.extend({ note: z.string().nullable() }).nullable(),
  rules: RunRulesSchema.nullable(),
  starter: z.object({ speciesId: z.string(), choices: z.array(z.string()) }).nullable(),
  regionOrder: z.array(z.string()),
  regionsCleared: z.array(z.string()),
  /** The region index the run reached (0: the first region). */
  regionReached: z.number().int().min(0),
  outcome: z.enum(['victory', 'defeat']),
  encounters: z.number().int().min(0),
  battlesWon: z.number().int().min(0),
  /** Gym leader ids, in the order beaten. */
  badges: z.array(z.string()),
  bosses: z.object({ gym: z.number().int().min(0), elite: z.number().int().min(0), champion: z.number().int().min(0) }),
  team: z.array(LegacyMonSchema),
  /** The Ace Pokémon's uid (a team member), or null when the team is empty. */
  aceUid: z.string().nullable(),
  rivals: z.array(z.object({
    id: z.string(), name: z.string(), classId: z.string(), archetype: z.string(), state: z.string(),
    encounters: z.number().int().min(0), setbacks: z.number().int().min(0),
    /** The last battle with it, from your side. */
    lastResult: z.enum(['win', 'lose']).nullable(),
    resolution: z.enum(['good', 'bad']).nullable(),
    team: z.array(z.string()),
    /** Past contender: it took over a Gym, reached the finals, or became Champion (null: none). */
    rank: z.enum(['gymLeader', 'finalist', 'champion']).nullable().default(null),
    /** Its off-screen journey when the run ended (core/rivals/progression.ts): lead in stages, region, badges, regions done, wins, defeats, fame, milestone kinds oldest first. Null: it had none. */
    world: z.object({ lead: z.number().int(), region: z.number().int().min(0), badges: z.number().int().min(0), regionsDone: z.number().int().min(0), wins: z.number().int().min(0), defeats: z.number().int().min(0), fame: z.number().int().min(0), milestones: z.array(z.string()) }).nullable().default(null),
    /** Narrative defeats it handed you (M12): story losses that did not end the run. */
    narrativeWins: z.number().int().min(0).default(0),
  })),
  nemeses: z.array(z.object({ id: z.string(), speciesId: z.string(), archetype: z.string(), cause: z.string(), settledAs: z.enum(['beaten', 'caught']).nullable() })),
  /** Legendary or mythical species met, and the ones caught. */
  legendaries: z.object({ seen: z.array(z.string()), caught: z.array(z.string()) }),
  defeatedBy: z.object({ speciesId: z.string(), level: z.number().int(), trainer: z.string().nullable() }).nullable(),
  /** The last battle of the run: the one that ended it, or the champion fight. */
  finalBattle: z.object({ result: z.enum(['win', 'lose']), speciesId: z.string().nullable(), level: z.number().int().nullable(), trainer: z.string().nullable() }).nullable(),
  stats: z.object({ maxLevel: z.number().int().min(0), survivedFatal: z.number().int().min(0), closeCalls: z.number().int().min(0), caught: z.number().int().min(0), shinies: z.number().int().min(0), rivalWins: z.number().int().min(0) }),
  /** Game events and run-scope story effects that happened (ids), for unique narrative events. */
  narrative: z.array(z.string()),
  /** The run's most memorable chronicle entries, most memorable first. */
  chronicle: z.array(z.object({ type: z.string(), text: z.string(), importance: z.number().int(), region: z.number().int().min(0), stage: z.number().int().min(0).nullable() })),
  /** Relive the Moment: the run's key moments, oldest first. */
  moments: z.array(z.object({ kind: LegacyMomentKindSchema, text: z.string(), speciesId: z.string().nullable(), region: z.number().int().min(0).nullable() })),
  /** The map, stage by stage. */
  journal: z.array(z.string()),
  epitaph: z.string().nullable(),
  /**
   * Everything the run began with (core/timeline/schema.ts RunGenesisSchema, plus how it ended as `origin`), so Revisit
   * This Timeline rebuilds a lost run from this record. Kept loose here (the timeline module parses it) to avoid an
   * import cycle. Null for runs that began before timelines were recorded.
   */
  genesis: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type LegacyRun = z.infer<typeof LegacyRunSchema>;

/** Legacy & Live hub systems (core/legacy.ts). Optional: older profiles have none and load as empty. */
export const LegacySchema = z.object({
  /** Prestige rank 0 to 5: a title and more contacts, nothing is ever deleted. */
  prestige: z.number().int().min(0).max(5).default(0),
  /** Research Tree nodes bought with Research Points. */
  tree: z.array(z.string()).default([]),
  /** Trainer Network contacts switched on (trainer ids). */
  contacts: z.array(z.string()).default([]),
  /** Item Museum: every item id ever held in a finished run. */
  museum: z.array(z.string()).default([]),
  /** Regional Intelligence Board: what the account knows of each region. */
  regionIntel: z.record(z.string(), z.object({ visits: z.number().int().min(0), clears: z.number().int().min(0), bestBadges: z.number().int().min(0) })).default({}),
  /** Seed Shelf: shared seed codes kept for later (core/seedCode.ts). */
  seedShelf: z.array(z.object({ code: z.string(), label: z.string(), at: z.string() })).default([]),
});
export type LegacyState = z.infer<typeof LegacySchema>;

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
  /** Species a shiny has been found for (Research Room). */
  speciesShiny: z.array(z.string()).default([]),
  /** Earned achievements: id → when. */
  achievements: z.record(z.string(), z.object({ earnedAt: z.string() })),
  /** Titles earned from achievements, and the one on show. */
  titles: z.array(z.string()),
  activeTitle: z.string().nullable(),
  /** The card frame on show around the trainer card (Wardrobe, core/wardrobe.ts). */
  cardFrame: z.string(),
  lifetimeBankCredits: z.number().int().min(0),
  /** The Bank tier (1 to 5, core/bank.ts): higher tiers open services, not bigger payouts. */
  bankTier: z.number().int().min(1).max(5).default(1),
  /** Items kept in the Collector's Vault (Bank tier 5). */
  vault: z.array(z.string()).default([]),
  /** Candy Shop perks bought with candies (balance.candyShop): they add to every run's starting Bag. */
  candyPerks: z.array(z.string()).default([]),
  runHistory: z.array(RunRecordSchema),
  /** What the last finished run paid out (shown on the run-end screen and in the Bank). */
  lastPayout: PayoutSchema.nullable(),
  /** Starter pools bought in the Starter Laboratory (pools unlocked from the start aren't listed). */
  unlockedPools: z.array(z.string()),
  /** Bank licenses owned. */
  licenses: z.array(z.string()),
  /** Loadout presets by slot (null: empty slot). */
  presets: z.array(LoadoutPresetSchema.nullable()),
  /** The last run's trainer and preparation, offered again next time. */
  lastPrep: LoadoutPresetSchema.nullable(),
  /** Recently finalized run ids, so a run's result is never applied twice. */
  finalizedRunIds: z.array(z.string()),
  /** Rivals from finished runs (core/rivals/legacy.ts). */
  rivalArchive: z.array(ArchivedRivalSchema).default([]),
  /** Party Pokémon of past runs, newest first; one may come back to join a later run. */
  pastPokemon: z.array(PastPokemonSchema),
  /** The claim ledger: every one-time reward paid, by key ("quest:misty:3"), so nothing pays twice. */
  claims: z.record(z.string(), z.object({ at: z.string() })),
  /** Move Mastery (core/moveMastery.ts): how often each damaging move was used in trainer fights, over all finished runs. */
  moveUses: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Run-end stamps collected (core/recap.ts runStamps): how many runs earned each. */
  stamps: z.record(z.string(), z.number().int().min(0)).optional(),
  /** The title-screen arena you chose in the Wardrobe (a bg.arena.* key), or unset to cycle through them all. */
  menuArena: z.string().optional(),
  /** The cry theme chosen in the Wardrobe (core/wardrobe.ts CRY_THEMES), or unset for normal cries. */
  cryTheme: z.string().optional(),
  /** Counters summed over the runs played as each trainer, and their best single run (for quest lines). */
  trainerCounters: z.record(z.string(), z.record(z.string(), z.number().int().min(0))),
  trainerBest: z.record(z.string(), z.record(z.string(), z.number().int().min(0))),
  /** Species Mastery (core/mastery.ts): counters for each species you met, and your picks for its family's unlocks. */
  mastery: z.record(z.string(), MasteryRecordSchema),
  /** Game event progress (core/gameEvents.ts): counters summed over each edition's runs, by edition ("rivalry-week@2026-W44"). */
  gameEvents: z.record(z.string(), z.record(z.string(), z.number().int().min(0))),
  /** Legacy & Live hub systems: Research Tree, Prestige, Trainer Network, Item Museum, Intelligence Board, Seed Shelf (core/legacy.ts). */
  legacy: LegacySchema.optional(),
  /** Hyper moment codex (core/story/codex.ts): times each story moment (story.json id) was seen, over all runs. */
  momentCodex: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Legacy runs (core/legacyRuns.ts): every finished run's immutable record, newest first (profile v14). */
  legacyRuns: z.array(LegacyRunSchema).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.object({
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  muted: z.boolean(),
  /** Battle animations: full, reduced (no flashing, shaking or big motion), or off (skipped). */
  battleAnimations: z.enum(['full', 'reduced', 'off']),
  /** 0–1: how strong flashes are (the "Flashes" setting). */
  effectIntensity: z.number().min(0).max(1),
  /** 0–1: how strong screen shake is, separate from flashes. */
  shakeIntensity: z.number().min(0).max(1).default(1),
  /** Skip the drifting ambience particles (clouds, fog and rays stay). */
  reduceParticles: z.boolean().default(false),
  /** Battle text speed: all at once, a quick typewriter, or a slower one. */
  textSpeed: z.enum(['instant', 'fast', 'normal', 'slow']).default('instant'),
  /** Battle messages move on by themselves after `messageDelay` (otherwise only move and damage lines do). */
  autoAdvance: z.boolean().default(false),
  messageDelay: z.enum(['short', 'normal', 'long']).default('normal'),
  /** Stronger contrast for the whole game screen. */
  highContrast: z.boolean().default(false),
  /** Colour-blind help: names the move's type in words next to the coloured art. */
  typeMarkers: z.boolean().default(false),
  /** How much of the window the game fills: full, 90% or 80%. */
  uiScale: z.enum(['full', 'medium', 'small']).default('full'),
  /** Off keeps menu icons and idle Pokémon still. */
  spriteAnimations: z.boolean().default(true),
  /** Floating damage numbers over the Pokémon that was hit. */
  damageNumbers: z.boolean().default(true),
  /** The catch screen: every stat and note, or a short summary. */
  catchDetail: z.enum(['full', 'compact']).default('full'),
  /** How fast battles play: showcase (0.75×, lingering), normal, fast (2×) or quick (3×). Outcomes never depend on it. */
  battleSpeed: z.enum(['showcase', 'normal', 'fast', 'quick']),
  /** How much trainers talk in battle: off, low, normal or high. */
  dialogueFrequency: z.enum(['off', 'low', 'normal', 'high']),
  /** Show why damage came out as it did (effectiveness, STAB, crit) in the battle text. */
  damageDetails: z.boolean().default(false),
  /** The last accessibility preset applied ('custom' once any single setting is changed by hand). */
  accessibilityProfile: z.enum(['custom', 'reducedMotion', 'lowFlash', 'moreDetail', 'fastBattles']).default('custom'),
  /** How trainer lists are sorted (core/trainerSort.ts), and whether that order is flipped. */
  trainerSort: z.enum(['default', 'game', 'region', 'name', 'obtainment', 'tier', 'owned', 'recent']).default('default'),
  trainerSortReverse: z.boolean().default(false),
  /** Which battle UI style draws the databoxes (ui/battleUiStyles.ts). */
  battleUi: z.enum(['aero', 'kit', 'kitLong']).default('aero'),
  /** Animation switches (spec 6.6). Each is remembered while `disableAllAnimations` overrides them (core/accessibility.ts `animationFlags`). */
  abilityAnimations: z.boolean().default(true),
  battleTextAnimations: z.boolean().default(true),
  interactionAnimations: z.boolean().default(true),
  hyperAnimations: z.boolean().default(true),
  rivalAnimations: z.boolean().default(true),
  evolutionAnimations: z.boolean().default(true),
  battleScreenEffects: z.boolean().default(true),
  /** How fast animations play and how strong they look. */
  animationSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
  animationIntensity: z.enum(['reduced', 'normal', 'enhanced']).default('normal'),
  /** Master switch: turns every animation off without forgetting the individual ones above. */
  disableAllAnimations: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function freshStages(): Stages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}
