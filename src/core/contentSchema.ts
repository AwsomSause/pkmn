// Shapes of every game-content data file (species, moves, items, ...).
// The JSON files in src/data are checked against these when the game starts,
// so a typo in a data file shows a clear error instead of a strange bug.

import { z } from 'zod';

export const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;
export const TypeNameSchema = z.enum(TYPE_NAMES);
export type TypeName = z.infer<typeof TypeNameSchema>;

export const STAT_NAMES = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export const StatNameSchema = z.enum(STAT_NAMES);
export type StatName = z.infer<typeof StatNameSchema>;
export type StatBlock = Record<StatName, number>;

/** Stats that in-battle stage changes (+1, -2, ...) can affect. */
export const BOOST_STATS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'] as const;
export const BoostStatSchema = z.enum(BOOST_STATS);
export type BoostStat = z.infer<typeof BoostStatSchema>;

export const STATUS_IDS = ['brn', 'psn', 'par', 'slp', 'frz'] as const;
export const StatusIdSchema = z.enum(STATUS_IDS);
export type StatusId = z.infer<typeof StatusIdSchema>;

const StatBlockSchema = z.object({
  hp: z.number().int().positive(),
  atk: z.number().int().positive(),
  def: z.number().int().positive(),
  spa: z.number().int().positive(),
  spd: z.number().int().positive(),
  spe: z.number().int().positive(),
});

export const GROWTH_RATES = ['fast', 'medium-fast', 'medium-slow', 'slow'] as const;
export const GrowthRateSchema = z.enum(GROWTH_RATES);
export type GrowthRate = z.infer<typeof GrowthRateSchema>;

export const SpeciesSchema = z.object({
  id: z.string().min(1),
  dex: z.number().int().positive(),
  name: z.string().min(1),
  types: z.array(TypeNameSchema).min(1).max(2),
  baseStats: StatBlockSchema,
  catchRate: z.number().int().min(1).max(255),
  baseExp: z.number().int().positive(),
  growthRate: GrowthRateSchema,
  /** 1 = has no pre-evolution (eligible as a "stage-one" starter). */
  evolutionStage: z.number().int().min(1).max(3),
  learnset: z.array(z.object({ level: z.number().int().min(1).max(100), move: z.string() })).min(1),
  /** Standard level-up evolutions (director decision D15). */
  evolutions: z.array(z.object({ to: z.string(), level: z.number().int().min(2).max(100) })).default([]),
  assets: z.object({ front: z.string(), back: z.string(), cry: z.string().optional() }),
});
export type Species = z.infer<typeof SpeciesSchema>;

const StatChangeSchema = z.object({
  stat: BoostStatSchema,
  stages: z.number().int().min(-6).max(6),
  target: z.enum(['self', 'enemy']),
  /** Percent chance, 1–100. Status moves use 100. */
  chance: z.number().min(1).max(100),
});

export const MoveSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: TypeNameSchema,
  category: z.enum(['physical', 'special', 'status']),
  power: z.number().int().positive().nullable(),
  /** Percent accuracy, or null for moves that never miss. */
  accuracy: z.number().int().min(1).max(100).nullable(),
  pp: z.number().int().positive(),
  priority: z.number().int().min(-7).max(5).default(0),
  critStage: z.number().int().min(0).max(3).default(0),
  target: z.enum(['enemy', 'self']),
  flags: z.array(z.enum(['powder', 'typeless'])).default([]),
  effects: z
    .object({
      status: z.object({ id: StatusIdSchema, chance: z.number().min(1).max(100) }).optional(),
      flinchChance: z.number().min(1).max(100).optional(),
      statChanges: z.array(StatChangeSchema).optional(),
      /** Fraction of damage dealt that the user regains. */
      drain: z.number().positive().max(1).optional(),
      /** Fraction of damage dealt that the user takes back. */
      recoil: z.number().positive().max(1).optional(),
      /** Fraction of the user's max HP it loses after using the move. */
      recoilMaxHp: z.number().positive().max(1).optional(),
      /** Deals damage equal to the user's level, ignoring stats. */
      fixedDamage: z.literal('level').optional(),
    })
    .default({}),
});
export type Move = z.infer<typeof MoveSchema>;

export const TypeChartSchema = z.partialRecord(TypeNameSchema, z.partialRecord(TypeNameSchema, z.number().min(0).max(2)));
export type TypeChart = z.infer<typeof TypeChartSchema>;

export const ArchetypeModifierSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('xpMultiplier'), value: z.number().positive() }),
  z.object({ kind: z.literal('moneyMultiplier'), value: z.number().positive() }),
  z.object({ kind: z.literal('enemyLevelOffset'), value: z.number().int() }),
  z.object({ kind: z.literal('captureMultiplier'), value: z.number().positive() }),
]);
export type ArchetypeModifier = z.infer<typeof ArchetypeModifierSchema>;
export type ArchetypeModifierKind = ArchetypeModifier['kind'];

export const ArchetypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  unlockedByDefault: z.boolean(),
  spriteAssetId: z.string(),
  modifiers: z.array(ArchetypeModifierSchema),
});
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const RARITIES = ['common', 'uncommon', 'rare'] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

export const ItemEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('catch'), multiplier: z.number().positive() }),
  z.object({ kind: z.literal('healHp'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('cureStatus') }),
  z.object({ kind: z.literal('fullRestore') }),
  z.object({ kind: z.literal('restorePp'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('revive'), fraction: z.number().positive().max(1) }),
  z.object({ kind: z.literal('lastStand') }),
]);
export type ItemEffect = z.infer<typeof ItemEffectSchema>;

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['ball', 'healing', 'revive', 'pp', 'charm']),
  iconAssetId: z.string(),
  usableInBattle: z.boolean(),
  usableOutside: z.boolean(),
  /** party = a healthy party member, fainted = a fainted one, enemy = the wild Pokémon. */
  target: z.enum(['party', 'fainted', 'enemy', 'none']),
  effect: ItemEffectSchema,
});
export type Item = z.infer<typeof ItemSchema>;

export const TrainerClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  spriteAssetId: z.string(),
  /** Prize money = moneyPerLevel × the level of their highest-level Pokémon. */
  moneyPerLevel: z.number().int().positive(),
  names: z.array(z.string()).min(1),
  /** The types this class specialises in. A stage only uses classes that share a type with its theme. */
  types: z.array(TypeNameSchema).min(1),
});
export type TrainerClass = z.infer<typeof TrainerClassSchema>;

export const GymLeaderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  spriteAssetId: z.string(),
  /** The leader's usual speciality. Stages prefer a leader whose speciality matches the theme. */
  types: z.array(TypeNameSchema).min(1),
});
export type GymLeader = z.infer<typeof GymLeaderSchema>;

/** A stage theme: a named pair of types that decides which Pokémon, trainers and gym leader appear. */
export const ThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  types: z.tuple([TypeNameSchema, TypeNameSchema]),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const ThemesFileSchema = z.object({
  /** Battle background for each type (a theme uses its first type's arena). */
  arenas: z.record(TypeNameSchema, z.string()),
  themes: z.array(ThemeSchema).min(1),
});

export const ShopEntrySchema = z.object({ item: z.string(), price: z.number().int().positive() });
export type ShopEntry = z.infer<typeof ShopEntrySchema>;

export const RewardEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('addItem'), item: z.string(), quantity: z.number().int().positive() }),
  z.object({ kind: z.literal('money'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('levelUp'), levels: z.number().int().positive() }),
  z.object({ kind: z.literal('vitamin'), stat: StatNameSchema }),
]);
export type RewardEffect = z.infer<typeof RewardEffectSchema>;

export const RewardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['healing', 'currency', 'stat-buff', 'consumable']),
  rarity: RaritySchema,
  effect: RewardEffectSchema,
  /** How repeated picks combine: applied once now, or stacks up to a limit. */
  stacking: z.enum(['instant', 'stacks']),
  /** Who receives it: the run (Bag, money) or a Pokémon the player picks. */
  scope: z.enum(['pokemon', 'run']),
  /** Whether trainer money multipliers apply (only for currency rewards). */
  moneyMultiplierApplies: z.boolean().default(false),
  iconAssetId: z.string(),
});
export type Reward = z.infer<typeof RewardSchema>;

export const RulesetSchema = z.object({
  id: z.string(),
  description: z.string(),
  critMultiplier: z.number(),
  critChanceByStage: z.array(z.number().min(0).max(1)).length(4),
  stabMultiplier: z.number(),
  randomFactorMin: z.number().int().min(1).max(100),
  burnAttackMultiplier: z.number(),
  burnResidualFraction: z.number(),
  poisonResidualFraction: z.number(),
  paralysisSpeedMultiplier: z.number(),
  fullParalysisChance: z.number().min(0).max(1),
  freezeThawChance: z.number().min(0).max(1),
  sleepTurnsMin: z.number().int().min(1),
  sleepTurnsMax: z.number().int().min(1),
  struggleMoveId: z.string(),
  catchStatusMultipliers: z.record(StatusIdSchema, z.number().positive()),
});
export type Ruleset = z.infer<typeof RulesetSchema>;

export const BalanceSchema = z.object({
  partyMax: z.number().int().positive(),
  starterLevel: z.number().int().positive(),
  starterChoices: z.number().int().positive(),
  starterPool: z.array(z.string()).min(1),
  wildPool: z.array(z.string()).min(1),
  draftSize: z.number().int().positive(),
  rarityWeights: z.record(RaritySchema, z.number().min(0)),
  vitaminMultiplierPerStack: z.number().positive(),
  vitaminMaxStacks: z.number().int().positive(),
  /** Enemy level = baseLevel + levelsPerColumn × columns travelled + variance + archetype + node bonus. */
  difficulty: z.object({
    baseLevel: z.number(),
    levelsPerColumn: z.number().min(0),
    variance: z.number().int().min(0),
    minLevel: z.number().int().min(1),
    maxLevel: z.number().int().max(100),
    trainerBonus: z.number().int().min(0),
    gymBonus: z.number().int().min(0),
    /** Extra levels on the gym leader's last Pokémon. */
    aceBonus: z.number().int().min(0),
    /** Extra levels on a "harder" route node: [min, max]. */
    harderBonus: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  }),
  /** Stage map shape. */
  stage: z.object({
    columns: z.number().int().min(3),
    minWidth: z.number().int().min(1),
    maxWidth: z.number().int().min(1).max(5),
    /** Each range is [first, last] column; one trainer column is picked from each. */
    trainerColumns: z.array(z.tuple([z.number().int().min(1), z.number().int().min(1)])),
    harderChance: z.number().min(0).max(1),
    extraEdgeChance: z.number().min(0).max(1),
    sideChance: z.number().min(0).max(1),
    sideWeights: z.object({ heal: z.number().min(0), shop: z.number().min(0) }),
    /** Every node in the column just before the gym gets a healing side stop. */
    healBeforeGym: z.boolean(),
  }),
  /** A theme's wild pool is topped up from wildPool when it has fewer species than this. */
  minThemePool: z.number().int().min(1),
  /** Weight multiplier for species that have both of the theme's types. */
  dualTypeWeight: z.number().min(1),
  harderRarityWeights: z.record(RaritySchema, z.number().min(0)),
  bossRarityWeights: z.record(RaritySchema, z.number().min(0)),
  money: z.object({ startingMoney: z.number().int().min(0), wildPerEnemyLevel: z.number().min(0), gymLeaderPerLevel: z.number().min(0) }),
  attributeMin: z.number(),
  attributeMax: z.number(),
  startingItems: z.record(z.string(), z.number().int().positive()),
  /** Chance that a wild Pokémon is shiny (director decision D8: 1/2000). */
  shinyChance: z.number().min(0).max(1),
  /** Team size = baseSize + extraPerStage × stage number (from 0) + a random 0..randomExtra, capped at maxSize. */
  trainerTeam: z.object({
    baseSize: z.number().int().min(1),
    extraPerStage: z.number().min(0),
    randomExtra: z.number().int().min(0),
    maxSize: z.number().int().min(1).max(6),
  }),
  gymTeam: z.object({
    baseSize: z.number().int().min(1),
    extraPerStage: z.number().min(0),
    randomExtra: z.number().int().min(0),
    maxSize: z.number().int().min(1).max(6),
  }),
  /** Candies for releasing a caught Pokémon: perRelease + floor(level / perLevels). */
  candies: z.object({ perRelease: z.number().int().min(0), perLevels: z.number().int().min(1) }),
});
export type Balance = z.infer<typeof BalanceSchema>;

export interface Content {
  species: Map<string, Species>;
  moves: Map<string, Move>;
  typeChart: TypeChart;
  archetypes: Map<string, Archetype>;
  rewards: Map<string, Reward>;
  items: Map<string, Item>;
  trainers: Map<string, TrainerClass>;
  gymLeaders: Map<string, GymLeader>;
  themes: Map<string, Theme>;
  arenas: Partial<Record<TypeName, string>>;
  shop: ShopEntry[];
  ruleset: Ruleset;
  balance: Balance;
}
