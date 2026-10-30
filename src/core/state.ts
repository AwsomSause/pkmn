// Shapes of the game's changing state: Pokémon instances, battles, the run,
// and the permanent profile. These schemas double as save-file validators,
// so the game refuses to load a save that doesn't match.

import { z } from 'zod';
import { ATTRIBUTE_KEYS, BattleBoostSchema, BoostStatSchema, SemiSchema, StatNameSchema, StatusIdSchema, TerrainSchema, TransformKindSchema, TypeNameSchema, WeatherSchema } from './contentSchema';
import { STREAM_NAMES, type StreamName } from './rng';
import { StoryStateSchema } from './story/schema';
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
  /** How much it likes you (0–255, see core/friendship.ts). */
  friendship: z.number().int().min(0).max(255),
  /**
   * Which of its species' abilities it has: -1 = the hidden ability, otherwise
   * an index into the normal ones (kept through evolution, see abilityOf).
   * Pokémon from saves made before abilities existed get the first one.
   */
  abilitySlot: z.number().int().min(-1).default(0),
  /** Held items (catalog id → copies). A Pokémon can hold many items, each up to its catalog max (director, Q1). */
  held: z.record(z.string(), z.number().int().min(1)).optional(),
  /** Small permanent stat boosts per stat (Wings): copies taken, each worth its catalog percent. */
  statBoosts: z.partialRecord(StatNameSchema, z.number().int().min(0)).optional(),
  /** Battle effects waiting for (or running in) its next battles: X items, Dire Hit, Guard Spec., status healers. */
  boosts: z.array(BattleBoostSchema).optional(),
  /** The type it becomes when it Terastallizes (M8.5); unset = its current first type. */
  teraType: TypeNameSchema.optional(),
  /** In battle only: Dynamaxed, so its HP is doubled (core/battle/transform.ts). */
  dynamaxed: z.literal(true).optional(),
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
});
export type HeldState = z.infer<typeof HeldStateSchema>;
export const freshHeldState = (): HeldState => ({ used: {}, choice: {}, streak: {}, popped: [], sure: [], first: [], crit: {} });

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
});

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

/**
 * Battle transformations (Mega Evolution, ...; core/battle/transform.ts).
 * A transformed Pokémon's speciesId is its new form during the battle; `forms`
 * remembers what it was so it changes back when the battle ends.
 */
export const BattleTransformSchema = z.object({
  /** The mechanics each side has already used this battle (each works once per battle). */
  used: z.object({ player: z.array(TransformKindSchema), enemy: z.array(TransformKindSchema) }),
  /** uid -> what that Pokémon transformed with and the species it was before. One transformation per Pokémon. */
  forms: z.record(z.string(), z.object({ kind: z.enum(['mega', 'primal', 'gigantamax', 'tera', 'zmove', 'dynamax']), from: z.string() })),
  /** The mechanics the opponent may use (bosses; see balance.transformations). */
  enemyMechanics: z.array(TransformKindSchema),
  /** uid -> the type a Terastallized Pokémon has become. */
  teraTypes: z.record(z.string(), TypeNameSchema).default({}),
  /** uid -> turns left for a Dynamaxed Pokémon. */
  dynamax: z.record(z.string(), z.number().int().min(0)).default({}),
  /** uid -> the once-per-battle mechanic it used (Tera, Z-Move or Dynamax; one per Pokémon). */
  mechanics: z.record(z.string(), z.enum(['tera', 'zmove', 'dynamax'])).default({}),
});
export type BattleTransform = z.infer<typeof BattleTransformSchema>;

export const freshTransform = (): BattleTransform => ({ used: { player: [], enemy: [] }, forms: {}, enemyMechanics: [], teraTypes: {}, dynamax: {}, mechanics: {} });

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
  playerVolatile: VolatileSchema.default(freshVolatile),
  enemyVolatile: VolatileSchema.default(freshVolatile),
  /** The weather and how many turns it has left. */
  weather: z.object({ id: WeatherSchema, turns: z.number().int().min(0) }).nullable().default(null),
  /** The terrain and how many turns it has left. */
  terrain: z.object({ id: TerrainSchema, turns: z.number().int().min(0) }).nullable().default(null),
  /** Field-wide effects and their turns left. */
  field: z.object({ gravity: z.number().int().min(0).default(0), trickRoom: z.number().int().min(0).default(0), waterSport: z.number().int().min(0).default(0), mudSport: z.number().int().min(0).default(0) }).default(() => ({ gravity: 0, trickRoom: 0, waterSport: 0, mudSport: 0 })),
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
  /** A rival back for its rematch (Living Rivalry Engine): its id, and what it changed about its team. */
  rivalId: z.string().optional(),
  rivalNote: z.string().optional(),
  /** A Pokémon fished from a fishing spot: an extra catch, with no reward draft after it. */
  fishing: z.boolean().optional(),
});
export type BattleState = z.infer<typeof BattleStateSchema>;

// ---------- stage maps ----------

export const SideStopSchema = z.object({
  id: z.string(),
  kind: z.enum(['heal', 'shop', 'fish']),
  /** A healing stop and a fishing spot work once; a shop can be visited again. */
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
  /** A TM or HM: pick which of these moves the Pokémon learns (or skip). */
  z.object({ kind: z.literal('teachMove'), uid: z.string(), itemName: z.string(), moveIds: z.array(z.string()).min(1) }),
  /** A Pokémon from a past run wants to join (story slice 5, core/story/reunion.ts); `hallOfFame`: it won a past run with you. */
  z.object({ kind: z.literal('reunion'), mon: PokemonInstanceSchema, hallOfFame: z.boolean() }),
  /** A PP Up or PP Max: pick which move gets the extra PP. */
  z.object({ kind: z.literal('ppUp'), uid: z.string(), itemName: z.string(), ups: z.number().int().min(1).max(3) }),
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
});
export type RunPrep = z.infer<typeof RunPrepSchema>;

/** A saved loadout: a trainer and preparation choices (preferences only, nothing is reserved). */
export const LoadoutPresetSchema = RunPrepSchema.extend({ name: z.string(), archetypeId: z.string() });
export type LoadoutPreset = z.infer<typeof LoadoutPresetSchema>;

export const RunPhaseSchema = z.enum(['starter', 'map', 'shop', 'battle', 'decision', 'reward', 'over']);
export type RunPhase = z.infer<typeof RunPhaseSchema>;

/** A Pokémon kept from a finished run, that may come back in a later one (core/story/reunion.ts). */
export const PastPokemonSchema = z.object({
  speciesId: z.string(),
  level: z.number().int().min(1).max(100),
  shiny: z.boolean(),
  abilitySlot: z.number().int().min(-1),
  moves: z.array(z.string()).min(1).max(4),
  teraType: TypeNameSchema.optional(),
  runId: z.string(),
  /** It was in the party when that run was won. */
  hallOfFame: z.boolean(),
});
export type PastPokemon = z.infer<typeof PastPokemonSchema>;

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
  /** Rewards that come back in the next draft (Lock Capsule, Favored Mail). */
  draftCarry: z.array(z.string()).optional(),
  /** Transformations switched off for this run (a challenge; M8.75 part D adds the menu that sets it). */
  disabledMechanics: z.array(TransformKindSchema).default([]),
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
    /** True once the Last Stand Charm has saved the run in the current region. */
    charmUsedInRegion: z.boolean(),
    /** What ended the run, when it was lost. */
    defeatedBy: z.object({ speciesId: z.string(), level: z.number().int(), trainer: z.string().nullable() }).nullable(),
    /** The starter's uid (for Love: regions cleared with the starter still in the party). */
    starterUid: z.string().nullable(),
  }),
  /** The story layer: domain events, Pokémon histories, the chronicle and applied effect ids (core/story). */
  story: StoryStateSchema,
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
  /** The run's top chronicle moments, most memorable first. */
  moments: z.array(z.string()),
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
  /** Party Pokémon of past runs, newest first; one may come back to join a later run. */
  pastPokemon: z.array(PastPokemonSchema),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.object({
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  muted: z.boolean(),
  /** Battle animations: full, reduced (no flashing, shaking or big motion), or off (skipped). */
  battleAnimations: z.enum(['full', 'reduced', 'off']),
  /** 0–1: how strong screen shake and flashes are. */
  effectIntensity: z.number().min(0).max(1),
  /** How fast battles play: normal, fast (2×) or quick (3×). Outcomes never depend on it. */
  battleSpeed: z.enum(['normal', 'fast', 'quick']),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function freshStages(): Stages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}
