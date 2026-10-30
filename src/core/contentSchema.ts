// Shapes of every game-content data file (species, moves, items, ...).
// The JSON files in src/data are checked against these when the game starts,
// so a typo in a data file shows a clear error instead of a strange bug.

import { z } from 'zod';
import type { StoryConfig } from './story/schema';

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

export const GROWTH_RATES = ['fast', 'medium-fast', 'medium-slow', 'slow', 'erratic', 'fluctuating'] as const;
export const GrowthRateSchema = z.enum(GROWTH_RATES);
export type GrowthRate = z.infer<typeof GrowthRateSchema>;

/** delta / zform / spooky: the director's custom forms (Milestone 8, tools/import-custom-forms.ts). */
export const SPECIES_TAGS = ['baby', 'legendary', 'mythical', 'delta', 'zform', 'spooky'] as const;
export type SpeciesTag = (typeof SPECIES_TAGS)[number];

/**
 * Forms besides a species' usual one. Regional and alternate forms are ordinary
 * Pokémon; Mega, Gigantamax, Primal and battle-only forms (Zen Mode, Ash-Greninja,
 * ...) only appear through mechanics that arrive in Milestone 8, so they are never
 * met in the wild, on trainers' teams or as starters.
 */
export const FORM_KINDS = ['regional', 'alternate', 'mega', 'gigantamax', 'primal', 'battle'] as const;
export type FormKind = (typeof FORM_KINDS)[number];

/**
 * How one species evolves into another (GAME_DESIGN.md §5c). Exactly one of
 * `level` (standard level-up, D15) or `item` (use the item from the Bag).
 * `region`: in that region this branch is preferred (Pikachu becomes Alolan
 * Raichu in Alola). `condition`: Tyrogue's Attack/Defense comparison.
 */
export const EvolutionSchema = z
  .object({
    to: z.string(),
    level: z.number().int().min(2).max(100).optional(),
    item: z.string().optional(),
    region: z.string().optional(),
    condition: z.enum(['atkGtDef', 'atkLtDef', 'atkEqDef']).optional(),
  })
  .refine((e) => (e.level === undefined) !== (e.item === undefined), { message: 'an evolution needs exactly one of level or item' });
export type Evolution = z.infer<typeof EvolutionSchema>;

export const SpeciesSchema = z.object({
  id: z.string().min(1),
  dex: z.number().int().positive(),
  name: z.string().min(1),
  /** The generation it (or this form) was introduced in, 1–9. Regions prefer their own generation's Pokémon. */
  generation: z.number().int().min(1).max(9),
  types: z.array(TypeNameSchema).min(1).max(2),
  baseStats: StatBlockSchema,
  catchRate: z.number().int().min(1).max(255),
  baseExp: z.number().int().positive(),
  growthRate: GrowthRateSchema,
  /**
   * 1 = has no pre-evolution (eligible as a "stage-one" starter and in the wild).
   * Baby Pokémon don't count, so Pikachu (from Pichu) is still stage 1.
   */
  evolutionStage: z.number().int().min(1).max(3),
  /** The species it evolves from, if any. */
  evolvesFrom: z.string().nullable().default(null),
  tags: z.array(z.enum(SPECIES_TAGS)).default([]),
  /** Set for forms: what kind, and the species it is a form of. */
  form: z
    .object({ kind: z.enum(FORM_KINDS), base: z.string(), region: z.string().optional() })
    .optional(),
  /** Level-up moves, including moves the battle engine doesn't support yet (they are skipped). */
  learnset: z.array(z.object({ level: z.number().int().min(1).max(100), move: z.string() })).min(1),
  evolutions: z.array(EvolutionSchema).default([]),
  /** File names in the asset pack: sprite "2019" → images/pokemon/2019.png, icon "7/2019", cry "19". */
  assets: z.object({ sprite: z.string(), icon: z.string(), cry: z.string() }),
});
export type Species = z.infer<typeof SpeciesSchema>;

export const WEATHERS = ['rain', 'sun', 'sand', 'snow', 'hail'] as const;
export const WeatherSchema = z.enum(WEATHERS);
export type Weather = z.infer<typeof WeatherSchema>;
/** Where a Pokémon is during the first turn of Fly, Dig, Dive or Phantom Force. */
export const SemiSchema = z.enum(['air', 'underground', 'underwater', 'vanished']);
export type Semi = z.infer<typeof SemiSchema>;

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
  /** `zmove`, `max`: a Z-Move or Max Move made in battle (battle/transform.ts); they hit through Protect for a quarter of their damage. */
  flags: z.array(z.enum(['powder', 'typeless', 'zmove', 'max'])).default([]),
  /**
   * False for moves whose effects the battle engine can't run yet. They stay
   * in the data (and in learnsets) so they can be switched on later, but no
   * Pokémon learns or uses them until then.
   */
  supported: z.boolean().default(true),
  /** For unsupported moves: what still has to be built (the move list's effect text). */
  needs: z.string().optional(),
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
      /** Confuses the target (chance in percent). */
      confuse: z.object({ chance: z.number().min(1).max(100) }).optional(),
      /** Hits this many times: [2, 5] rolls 2–5 hits (35/35/15/15%), [2, 2] always twice. */
      hits: z.tuple([z.number().int().min(2), z.number().int().min(2)]).optional(),
      /** The user must rest on its next turn after this move hits (Hyper Beam). */
      recharge: z.literal(true).optional(),
      /** Status move: the user regains this fraction of its max HP. */
      heal: z.number().positive().max(1).optional(),
      /** Protects the user from moves this turn; fails more often when used in a row. */
      protect: z.literal(true).optional(),
      /** Knocks out the target in one hit; misses more against higher levels and always against higher-level targets. */
      ohko: z.literal(true).optional(),
      /** The user faints after using it (Explosion). */
      selfFaint: z.literal(true).optional(),
      /** Always leaves the target at 1 HP or more (False Swipe). */
      leaveOne: z.literal(true).optional(),
      /** Traps the target and hurts it each turn for 4–5 turns (Wrap). */
      bind: z.literal(true).optional(),
      /** Status move: plants a seed that drains the target each turn (Leech Seed). */
      seed: z.literal(true).optional(),
      /** Power doubles when the target is at half HP or less (Brine). */
      doubleBelowHalf: z.literal(true).optional(),
      /** Power grows as the user's HP falls (Flail, Reversal). */
      lowHpPower: z.literal(true).optional(),
      /** A special move that hits the target's Defense (Psyshock). */
      targetsDefense: z.literal(true).optional(),
      /** Ignores the target's stat stages (Chip Away). */
      ignoreStages: z.literal(true).optional(),
      /**
       * Two-turn move: the first turn charges (and maybe hides the user, or
       * raises its stats); the second attacks. `sunSkips`: no charging in sun,
       * half power in other weather (Solar Beam).
       */
      charge: z.object({ semi: SemiSchema.optional(), sunSkips: z.literal(true).optional(), boosts: z.array(StatChangeSchema).optional() }).optional(),
      /** Can hit a target hiding this way (Earthquake on Dig), doubling its power if `double`. */
      hitsSemi: z.object({ semi: SemiSchema, double: z.boolean() }).optional(),
      /** Attacks for 2–3 turns in a row, then the user becomes confused (Thrash). */
      lockIn: z.literal(true).optional(),
      /** Status move: sets the weather for 5 turns. */
      weather: WeatherSchema.optional(),
      /** Weather Ball: its type and power follow the weather. */
      weatherBall: z.literal(true).optional(),
      /** Healing follows the weather: 2/3 in sun, 1/4 in other weather (Synthesis). */
      healWeather: z.literal(true).optional(),
      /** Heals 2/3 in a sandstorm (Shore Up). */
      healSand: z.literal(true).optional(),
      /** Never misses in this weather (Thunder in rain, Blizzard in snow); a rain move hits half the time in sun. */
      sureIn: WeatherSchema.optional(),
      /** Only works on the user's first turn in battle (Fake Out). */
      firstTurnOnly: z.literal(true).optional(),
      /** Goes through Protect (Feint, Phantom Force). */
      breaksProtect: z.literal(true).optional(),
    })
    .default({}),
});
export type Move = z.infer<typeof MoveSchema>;

export const TypeChartSchema = z.partialRecord(TypeNameSchema, z.partialRecord(TypeNameSchema, z.number().min(0).max(2)));
export type TypeChart = z.infer<typeof TypeChartSchema>;

// ---------- attributes (GAME_DESIGN.md §9, Milestone 7) ----------

/** Attributes that run from 0 to the maximum. */
export const PLAIN_ATTRIBUTES = ['strength', 'intelligence', 'speed', 'charisma', 'luck', 'love'] as const;
/**
 * Two-ended meters (D9) that run from −max to +max: Rage (+) / Peace (−) and
 * Good (+) / Evil (−). Moving toward one end moves away from the other.
 */
export const METER_ATTRIBUTES = ['ragePeace', 'goodEvil'] as const;
export const ATTRIBUTE_KEYS = [...PLAIN_ATTRIBUTES, ...METER_ATTRIBUTES] as const;
export const AttributeKeySchema = z.enum(ATTRIBUTE_KEYS);
export type AttributeKey = z.infer<typeof AttributeKeySchema>;

// ---------- permanent progression (GAME_DESIGN.md §14) ----------

/** Things the game counts during a run; each run's counts are added to the profile when it ends. */
export const BASE_COUNTER_NAMES = [
  'battlesWon',
  'wildDefeated',
  'trainersDefeated',
  'gymLeadersDefeated',
  'eliteFourDefeated',
  'championsDefeated',
  'regionsCleared',
  /** Regions cleared without the Last Stand Charm saving the run. */
  'regionsClearedNoCharm',
  'runsFinished',
  'runsWon',
  'pokemonCaught',
  'shiniesFound',
  'evolutions',
  'moneyEarned',
  'candiesEarned',
  'encountersCompleted',
  'moneySpent',
  'healStopsUsed',
  /** Caught Pokémon added to the party (or swapped in), and caught Pokémon turned into candies. */
  'caughtKept',
  'caughtToCandies',
  /** Regions cleared with the starter still in the party. */
  'regionsClearedWithStarter',
  /** Stats your Pokémon raised on themselves with moves (Bulk Up, Nasty Plot...): one per stat raised. */
  'statsBoosted',
] as const;
/**
 * Also counted, by type: boss wins (gym leader, Elite Four, champion) by the lead Pokémon's type, as "bossWinsLead.<type>",
 * and enemy Pokémon defeated or caught, by each of their types, as "defeatedOrCaught.<type>".
 */
export const COUNTER_NAMES: readonly string[] = [
  ...BASE_COUNTER_NAMES,
  ...TYPE_NAMES.map((t) => `bossWinsLead.${t}`),
  ...TYPE_NAMES.map((t) => `defeatedOrCaught.${t}`),
];
export const CounterNameSchema = z.string().refine((s) => COUNTER_NAMES.includes(s), { message: 'unknown counter' });

/**
 * A data-defined unlock requirement, shared by achievements and trainers:
 *   total       — a counter summed over every run
 *   best        — a counter's best value in a single run
 *   distinct    — how many different species have been seen or caught
 *   achievement — another achievement has been earned
 */
export const RequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('total'), counter: CounterNameSchema, atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('best'), counter: CounterNameSchema, atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('distinct'), set: z.enum(['speciesSeen', 'speciesCaught']), atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('achievement'), id: z.string() }),
]);
export type Requirement = z.infer<typeof RequirementSchema>;

/** What earning an achievement pays out. */
export const UnlockRewardSchema = z.object({
  bankCredits: z.number().int().min(0).default(0),
  researchPoints: z.number().int().min(0).default(0),
  candies: z.number().int().min(0).default(0),
  /** A profile title the player can show (cosmetic). */
  title: z.string().optional(),
});
export type UnlockReward = z.infer<typeof UnlockRewardSchema>;

export const ACHIEVEMENT_CATEGORIES = ['campaign', 'collection', 'battle', 'exploration', 'economy', 'roguelike', 'relationship', 'secret', 'endgame'] as const;

export const AchievementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(ACHIEVEMENT_CATEGORIES),
  /** Hidden achievements show as "???" until earned. */
  hidden: z.boolean().default(false),
  /** Tiered achievements share a chain id and count up through tiers 1, 2, 3... */
  chain: z.string().optional(),
  tier: z.number().int().min(1).optional(),
  requirement: RequirementSchema,
  reward: UnlockRewardSchema,
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const ArchetypeModifierSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('xpMultiplier'), value: z.number().positive() }),
  z.object({ kind: z.literal('moneyMultiplier'), value: z.number().positive() }),
  z.object({ kind: z.literal('enemyLevelOffset'), value: z.number().int() }),
  z.object({ kind: z.literal('captureMultiplier'), value: z.number().positive() }),
  /** HP restored by healing items (Potion, Super Potion...). */
  z.object({ kind: z.literal('healingMultiplier'), value: z.number().positive() }),
  /** Shop price of the listed items. */
  z.object({ kind: z.literal('priceMultiplier'), items: z.array(z.string()).min(1), value: z.number().positive() }),
  /** Shop stock unlocks this many badges sooner (positive) or later (negative). */
  z.object({ kind: z.literal('shopUnlockOffset'), value: z.number().int() }),
  /** Damage dealt by your Pokémon of this type. */
  z.object({ kind: z.literal('typeDamageMultiplier'), type: TypeNameSchema, value: z.number().positive() }),
  /** Super-effective damage taken by your Pokémon of this type. */
  z.object({ kind: z.literal('weaknessDamageTakenMultiplier'), type: TypeNameSchema, value: z.number().positive() }),
]);
export type ArchetypeModifier = z.infer<typeof ArchetypeModifierSchema>;
export type ArchetypeModifierKind = ArchetypeModifier['kind'];

export const ArchetypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** A short tagline, e.g. "The Survivalist". */
  title: z.string().default(''),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  unlockedByDefault: z.boolean(),
  /** What unlocks this trainer (null for starting trainers). */
  unlock: RequirementSchema.nullable().default(null),
  /** Plain-language version of `unlock`, shown in the Trainer Archive. */
  unlockText: z.string().default(''),
  /** Bank Credits to claim the trainer once its requirement is met. */
  unlockCost: z.number().int().min(0).default(0),
  /** False for trainers whose passives need systems that don't exist yet; shown as "coming later". */
  available: z.boolean().default(true),
  spriteAssetId: z.string(),
  modifiers: z.array(ArchetypeModifierSchema),
  /** Items added to the Bag at the start of a run (a signature preparation). */
  startingItems: z.record(z.string(), z.number().int().positive()).default({}),
});
export type Archetype = z.infer<typeof ArchetypeSchema>;

// ---------- Run-Prep (GAME_DESIGN.md §14.5, §14.7) ----------

/**
 * A pool of starters for the Starter Laboratory. Species that aren't in the
 * game yet are skipped, so a pool can list species ahead of the full Pokédex;
 * a pool with too few known first-stage species shows as "coming later".
 */
export const StarterPoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  species: z.array(z.string()).min(1),
  unlockedByDefault: z.boolean().default(false),
  /** What must happen before the pool can be bought (null: nothing). */
  unlock: RequirementSchema.nullable().default(null),
  unlockText: z.string().default(''),
  /** A Bank license that must be owned before the pool can be bought. */
  license: z.string().nullable().default(null),
  /** Research Points to unlock the pool. */
  researchCost: z.number().int().min(0).default(0),
});
export type StarterPool = z.infer<typeof StarterPoolSchema>;

/** How the three starters are drawn from the pool. Rules change the choice, not the power. */
export const DRAFT_RULE_KINDS = ['standard', 'typeFocus', 'balanced', 'blind'] as const;
export const DraftRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: z.enum(DRAFT_RULE_KINDS),
  license: z.string().nullable().default(null),
});
export type DraftRule = z.infer<typeof DraftRuleSchema>;

/** A preparation choice: one per run, chosen on the Preparation Desk. */
export const PrepTokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  unlock: RequirementSchema.nullable().default(null),
  unlockText: z.string().default(''),
  license: z.string().nullable().default(null),
  money: z.number().int().min(0).default(0),
  items: z.record(z.string(), z.number().int().positive()).default({}),
});
export type PrepToken = z.infer<typeof PrepTokenSchema>;

/** Investment licenses: bought once with Bank Credits; they open up options rather than add power. */
export const LicenseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  cost: z.number().int().min(0),
  unlock: RequirementSchema.nullable().default(null),
  unlockText: z.string().default(''),
});
export type License = z.infer<typeof LicenseSchema>;

export const RunPrepFileSchema = z.object({
  starterPools: z.array(StarterPoolSchema).min(1),
  draftRules: z.array(DraftRuleSchema).min(1),
  tokens: z.array(PrepTokenSchema),
  licenses: z.array(LicenseSchema),
});

export const RARITIES = ['common', 'uncommon', 'rare', 'epic'] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

/** Battle transformations (Milestone 8.5): each is unlocked by its key item. */
export const TRANSFORM_KINDS = ['mega', 'tera', 'zmove', 'dynamax'] as const;
export const TransformKindSchema = z.enum(TRANSFORM_KINDS);
export type TransformKind = z.infer<typeof TransformKindSchema>;

export const ItemEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('catch'), multiplier: z.number().positive() }),
  z.object({ kind: z.literal('healHp'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('cureStatus') }),
  z.object({ kind: z.literal('fullRestore') }),
  z.object({ kind: z.literal('restorePp'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('revive'), fraction: z.number().positive().max(1) }),
  z.object({ kind: z.literal('lastStand') }),
  /** Evolves a Pokémon that has an evolution using this item (stones, Linking Cord, Soothe Bell, ...). */
  z.object({ kind: z.literal('evolve') }),
  /** Raises a run attribute as soon as it's bought (shop attribute items; never goes in the Bag). */
  z.object({ kind: z.literal('attribute'), attribute: AttributeKeySchema, amount: z.number().int() }),
  /** A key item that unlocks a battle transformation (Mega Ring, ...). Kept for the whole run, never used up. */
  z.object({ kind: z.literal('keyItem'), mechanic: TransformKindSchema }),
  /**
   * A Mega Stone (or Primal orb): species id -> the form it becomes. Owning it
   * lets that species Mega Evolve. Primal orbs work automatically and need no Mega Ring.
   */
  z.object({ kind: z.literal('megaStone'), forms: z.record(z.string(), z.string()), primal: z.boolean().default(false) }),
  /** A Tera Shard: sets a Pokémon's Tera Type (used up). */
  z.object({ kind: z.literal('teraShard'), type: TypeNameSchema }),
  /** A Z-Crystal: with the Z-Ring, turns one move of its type into that type's Z-Move once per battle. */
  z.object({ kind: z.literal('zCrystal'), type: TypeNameSchema }),
]);
export type ItemEffect = z.infer<typeof ItemEffectSchema>;

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['ball', 'healing', 'revive', 'pp', 'charm', 'evolution', 'attribute', 'key', 'transformation']),
  iconAssetId: z.string(),
  usableInBattle: z.boolean(),
  usableOutside: z.boolean(),
  /** party = a healthy party member, fainted = a fainted one, enemy = the wild Pokémon. */
  target: z.enum(['party', 'fainted', 'enemy', 'none']),
  effect: ItemEffectSchema,
  /**
   * Attribute changes for cashing the item in from the Bag when nobody in the
   * party can use it (evolution items; filled in from itemCatalog.json).
   */
  cashIn: z.partialRecord(AttributeKeySchema, z.number().int()).optional(),
});
export type Item = z.infer<typeof ItemSchema>;

// ---------- the item catalog (itemCatalog.json, M8.75 item effects) ----------
//
// Every item in the director's icon pack except Poké Balls and Potions has an
// entry with its own effect (design: the "Item effects plan" Claude Doc).
// status: "supported" entries work and are offered in the draft;
// "existing" entries are items that were already in the game (their reward
// or Bag item keeps working); "pending" entries wait on a part of the plan
// named in `needs` and are never offered until it is built.

const AttributeChangesSchema = z.partialRecord(AttributeKeySchema, z.number().int());

/**
 * What a held item does in battle (item effects, slice 2). Numbers are per
 * copy unless the hook says otherwise; berries and "once" hooks are used up.
 * The battle engine reads these in core/battle/held.ts.
 */
const Species = z.array(z.string()).optional();
export const HeldHookSchema = z.discriminatedUnion('hook', [
  /** Moves of these types do more damage (type boosters, Plates for the whole team, species orbs). */
  z.object({ hook: z.literal('typePower'), types: z.array(TypeNameSchema).min(1), percent: z.number().positive(), species: Species }),
  /** The holder's first move of this type in each battle does `multiplier` damage, once per copy (Gems). */
  z.object({ hook: z.literal('gem'), type: TypeNameSchema, multiplier: z.number().positive() }),
  /** Physical (or special) moves do more damage. */
  z.object({ hook: z.literal('categoryPower'), category: z.enum(['physical', 'special']), percent: z.number().positive() }),
  /** Every damaging move does more damage; `recoil` is the share of max HP lost per hit that lands (Life Orb). */
  z.object({ hook: z.literal('power'), percent: z.number().positive(), recoil: z.number().positive().optional() }),
  /** Super-effective moves do more damage (Expert Belt). */
  z.object({ hook: z.literal('superPower'), percent: z.number().positive() }),
  /** Normal moves become this type and do more damage (Drives). */
  z.object({ hook: z.literal('drive'), type: TypeNameSchema, percent: z.number().positive() }),
  /** Repeating the same move: +percent per use in a row, up to max (Metronome). */
  z.object({ hook: z.literal('metronome'), percent: z.number().positive(), max: z.number().positive() }),
  /** A stat is multiplied ("all" = every stat but HP); `species` limits it, `canEvolve` needs a holder that can still evolve. */
  z.object({
    hook: z.literal('stat'),
    stat: z.enum(['atk', 'def', 'spa', 'spd', 'spe', 'all']),
    multiplier: z.number().positive(),
    species: Species,
    canEvolve: z.boolean().optional(),
  }),
  /** Locked into the first move it uses until it switches out (Choice items). */
  z.object({ hook: z.literal('choiceLock') }),
  /** More critical-hit stages; `critDamage` replaces the 1.5x of a critical hit. */
  z.object({ hook: z.literal('crit'), stages: z.number().int().min(0), critDamage: z.number().positive().optional(), species: Species }),
  /** The holder's moves are more accurate (only when it moves after the target, for the Zoom Lens). */
  z.object({ hook: z.literal('accuracy'), percent: z.number().positive(), whenMovingLast: z.boolean().optional() }),
  /** Moves aimed at the holder are less accurate (Bright Powder). */
  z.object({ hook: z.literal('evasion'), percent: z.number().positive() }),
  /** Always moves last in its priority bracket; with `sureHit` its moves can't miss (Lagging Tail). */
  z.object({ hook: z.literal('moveLast'), sureHit: z.boolean().optional() }),
  /** End of turn: heal (positive) or lose (negative) a share of max HP. `typed`: only that type heals, others take `otherwise`. */
  z.object({ hook: z.literal('endTurn'), fraction: z.number(), typed: TypeNameSchema.optional(), otherwise: z.number().optional() }),
  /** A chance to survive a knockout hit with 1 HP (Focus Band). */
  z.object({ hook: z.literal('survive'), percent: z.number().positive() }),
  /** At full HP, survives one knockout hit with 1 HP, once per battle (Focus Sash). */
  z.object({ hook: z.literal('sash') }),
  /** Physical attackers lose a share of their max HP (Rocky Helmet; physical moves count as contact). */
  z.object({ hook: z.literal('contactDamage'), fraction: z.number().positive() }),
  /** The holder's physical hits may inflict a status (Electirizer, Magmarizer). */
  z.object({ hook: z.literal('contactStatus'), status: StatusIdSchema, percent: z.number().positive() }),
  /** The holder's physical hits may make the target flinch; `bonus` is extra damage to a flinched target (Razor Fang). */
  z.object({ hook: z.literal('flinch'), percent: z.number().positive(), bonus: z.number().min(0).optional() }),
  /** End of the holder's first turn: it gets this status (Toxic and Flame Orb), and its moves of `type` get +percent. */
  z.object({ hook: z.literal('selfStatus'), status: StatusIdSchema, type: TypeNameSchema, percent: z.number().positive() }),
  /** Immune to Ground moves until it is first hit (Air Balloon). */
  z.object({ hook: z.literal('airBalloon') }),
  /** The holder's type immunities don't apply (Ring Target). */
  z.object({ hook: z.literal('ringTarget') }),
  /** The holder's trapping moves hurt more each turn (Binding Band). */
  z.object({ hook: z.literal('bindDamage'), multiplier: z.number().positive() }),
  /** Draining moves heal more (Big Root). */
  z.object({ hook: z.literal('drain'), percent: z.number().positive() }),
  /** A two-turn move fires at once, once per battle (Power Herb). */
  z.object({ hook: z.literal('powerHerb') }),
  /** Lowered stats are restored once per battle (White Herb). */
  z.object({ hook: z.literal('whiteHerb') }),
  /** Damage taken changes: from wild Pokémon only, from super-effective hits only, or when the holder is a type. */
  z.object({
    hook: z.literal('damageTaken'),
    percent: z.number(),
    fromWild: z.boolean().optional(),
    superEffective: z.boolean().optional(),
    holderType: TypeNameSchema.optional(),
  }),
  /** Weather the holder starts lasts longer (Heat Rock, ...). */
  z.object({ hook: z.literal('weatherTurns'), weathers: z.array(WeatherSchema).min(1), turns: z.number().int().positive() }),
  /** Extra experience for the holder (Macho Brace). */
  z.object({ hook: z.literal('exp'), multiplier: z.number().positive() }),
  /** Every few levels the holder grows a stat like a vitamin (Power items). */
  z.object({ hook: z.literal('growth'), stat: StatNameSchema, everyLevels: z.number().int().positive() }),
  /** The holder can't evolve (Everstone). */
  z.object({ hook: z.literal('noEvolve') }),
  /** Healing the holder receives is larger (Oval Stone). */
  z.object({ hook: z.literal('healing'), percent: z.number().positive() }),
  /** The holder gains friendship faster (Prism Scale). */
  z.object({ hook: z.literal('friendship'), percent: z.number().positive() }),
  /** The holder's Toughened It Out chance is multiplied (Destiny Knot). */
  z.object({ hook: z.literal('endure'), multiplier: z.number().positive() }),
  /** Each turn, a chance to raise a random stat (Dubious Disc). */
  z.object({ hook: z.literal('randomStat'), percent: z.number().positive() }),
  /** When the holder knocks out a foe it heals a share of max HP (only when it is `holderType`). */
  z.object({ hook: z.literal('koHeal'), fraction: z.number().positive(), holderType: TypeNameSchema.optional() }),
  /** When the holder knocks out a foe: +1 to an attribute, up to `cap` from this item in a run (Scarves). */
  z.object({ hook: z.literal('koAttribute'), attribute: AttributeKeySchema, amount: z.number().int(), cap: z.number().int().positive() }),
  /** A chance, when it hits, to take one of the target's held items (Grip Claw). */
  z.object({ hook: z.literal('steal'), percent: z.number().positive() }),
  /** The holder loses 1/8 HP each turn; a physical attacker catches it (Sticky Barb). */
  z.object({ hook: z.literal('stickyBarb'), fraction: z.number().positive() }),
  /** Hit by a move of this type: a stat rises, once per battle (Absorb Bulb, Cell Battery). */
  z.object({ hook: z.literal('absorb'), type: TypeNameSchema, stat: BoostStatSchema, stages: z.number().int() }),
  /** The holder can always switch out, even when trapped (Shed Shell). */
  z.object({ hook: z.literal('shedShell') }),
  /** While the holder leads the party, wild Pokémon are this many levels higher (negative: lower) (Cleanse Tag). */
  z.object({ hook: z.literal('wildLevel'), amount: z.number().int() }),
  /** The first move aimed at the holder each battle misses (Lax Incense). */
  z.object({ hook: z.literal('dodgeFirst') }),
  /** Wild Pokémon's status moves aimed at the holder miss this much more often, in percent (Pure Incense). */
  z.object({ hook: z.literal('statusShield'), percent: z.number().positive().max(100) }),
  // ---------- berries and other eaten items (each one eaten uses up a copy) ----------
  /** At or below `below` of max HP: heal a share of max HP (or `flat` HP), with attribute changes for the player. */
  z.object({
    hook: z.literal('berryHeal'),
    below: z.number().positive().max(1),
    fraction: z.number().positive().optional(),
    flat: z.number().int().positive().optional(),
    changes: z.partialRecord(AttributeKeySchema, z.number().int()).optional(),
  }),
  /** Cures these statuses (and confusion if `confusion`). */
  z.object({ hook: z.literal('berryCure'), statuses: z.array(StatusIdSchema), confusion: z.boolean().optional() }),
  /** A move at 0 PP regains some PP (Leppa). */
  z.object({ hook: z.literal('berryPp'), amount: z.number().int().positive() }),
  /** At or below `below`: a stat rises (`random` = a random one), or critical-hit stages ("crit"). */
  z.object({ hook: z.literal('berryStat'), below: z.number().positive().max(1), stat: z.enum(['atk', 'def', 'spa', 'spd', 'spe', 'crit', 'random']), stages: z.number().int().positive() }),
  /** At or below `below`: the next move can't miss (Micle). */
  z.object({ hook: z.literal('berrySure'), below: z.number().positive().max(1) }),
  /** At or below `below`: moves first next turn (Custap). */
  z.object({ hook: z.literal('berryFirst'), below: z.number().positive().max(1) }),
  /** Halves one super-effective hit of this type (`any` = any hit of the type, for Chilan). */
  z.object({ hook: z.literal('berryResist'), type: TypeNameSchema, any: z.boolean().optional() }),
  /** Hit by a super-effective move: heal a share of max HP (Enigma). */
  z.object({ hook: z.literal('berrySuper'), fraction: z.number().positive() }),
  /** Hit by a physical (or special) move: the attacker loses a share of its max HP (Jaboca, Rowap). */
  z.object({ hook: z.literal('berryRetaliate'), category: z.enum(['physical', 'special']), fraction: z.number().positive() }),
]);
export type HeldHook = z.infer<typeof HeldHookSchema>;

/** A temporary battle effect a Pokémon carries into its next battles (X items, Dire Hit, Guard Spec., status healers). */
export const BattleBoostSchema = z.discriminatedUnion('kind', [
  /** Stat stages ("crit" = critical-hit stages) for `turns` turns of battle. */
  z.object({ kind: z.literal('stage'), stat: z.enum(['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'crit']), stages: z.number().int(), turns: z.number().int().positive() }),
  /** Stats can't be lowered by the opponent for `turns` turns (Guard Spec.). */
  z.object({ kind: z.literal('guard'), turns: z.number().int().positive() }),
  /** Can't get this status (or confusion) during its next battle. */
  z.object({ kind: z.literal('immune'), status: z.enum(['brn', 'psn', 'par', 'slp', 'frz', 'confusion']) }),
]);
export type BattleBoost = z.infer<typeof BattleBoostSchema>;

/**
 * What a map and encounter item changes (M8.75 item effects, slice 3a). Wild
 * Pokémon changes apply to wild battles only; random choices use a generator
 * of their own (see core/mapItems.ts), so they never change any other roll.
 */
export const EncounterModSchema = z.discriminatedUnion('mod', [
  /** The wild battle is skipped: no battle and no reward, but the level counts (Repels). */
  z.object({ mod: z.literal('repel') }),
  /** Wild Pokémon are this many levels higher (negative: lower). */
  z.object({ mod: z.literal('level'), amount: z.number().int() }),
  /** Extra EXP from wild battles, in percent. */
  z.object({ mod: z.literal('exp'), percent: z.number().positive() }),
  /** A chance (percent, per copy for run-long items) that the wild Pokémon is one of these types; "themeFirst"/"themeSecond" are the stage's types. */
  z.object({ mod: z.literal('types'), types: z.array(z.union([TypeNameSchema, z.enum(['themeFirst', 'themeSecond'])])).min(1), percent: z.number().positive().max(100) }),
  /** Shiny chance multiplier. */
  z.object({ mod: z.literal('shiny'), multiplier: z.number().positive() }),
  /** Wild Pokémon may be of any type (the stage theme is ignored). */
  z.object({ mod: z.literal('anyType') }),
  /** The wild Pokémon is the strongest (highest base stats) of three drawn. */
  z.object({ mod: z.literal('rare') }),
  /** The wild Pokémon is from the first generation and the stage's types (or the item's pool), when there are any. */
  z.object({ mod: z.literal('gen1') }),
  /** A chance (percent per copy) that the wild Pokémon is this species. */
  z.object({ mod: z.literal('species'), species: z.string(), percent: z.number().positive().max(100) }),
  /** The wild Pokémon loses its first turn. */
  z.object({ mod: z.literal('freeTurn') }),
  /** The wild Pokémon starts with lowered Speed. */
  z.object({ mod: z.literal('foeSpeed'), stages: z.number().int() }),
  /** Ball throws: catch-rate multiplier, only at these types or at shiny Pokémon when given. */
  z.object({ mod: z.literal('catch'), multiplier: z.number().positive(), types: z.array(TypeNameSchema).optional(), shiny: z.boolean().optional() }),
]);
export type EncounterMod = z.infer<typeof EncounterModSchema>;

/**
 * How long a map item lasts: some wild battles, ball throws, shop purchases,
 * shop visits or trainer wins, the rest of this stage, the whole next stage, or the run.
 */
export const EncounterLastsSchema = z.discriminatedUnion('for', [
  z.object({ for: z.literal('battles'), count: z.number().int().positive() }),
  z.object({ for: z.literal('throws'), count: z.number().int().positive() }),
  z.object({ for: z.literal('purchases'), count: z.number().int().positive() }),
  z.object({ for: z.literal('shops'), count: z.number().int().positive() }),
  z.object({ for: z.literal('trainers'), count: z.number().int().positive() }),
  /** Uses the player spends from the map's Items menu (Escape Rope, VS Seeker). */
  z.object({ for: z.literal('manual'), count: z.number().int().positive() }),
  z.object({ for: z.literal('stage') }),
  z.object({ for: z.literal('nextStage') }),
  z.object({ for: z.literal('run') }),
]);

/** What a shop or money item changes (M8.75 item effects, slice 3b). */
export const PerkSchema = z.discriminatedUnion('perk', [
  /** Shop prices are this much lower (Coupons). */
  z.object({ perk: z.literal('discount'), percent: z.number().positive().max(100) }),
  /** Each shop purchase earns a point per copy; at `every` points the next purchase is free (Point Card). */
  z.object({ perk: z.literal('points'), every: z.number().int().positive() }),
  /** Shops also sell this many items early: the next ones you would unlock with badges (Member Card, Wepear Berry). */
  z.object({ perk: z.literal('earlyStock'), count: z.number().int().positive() }),
  /** Trainers (not wild Pokémon) pay this much more prize money. */
  z.object({ perk: z.literal('trainerMoney'), percent: z.number().positive() }),
  /** Wild battles on a stage of this type pay this much more per copy (Soot Sack). */
  z.object({ perk: z.literal('wildMoney'), type: TypeNameSchema, amount: z.number().int().positive() }),
  /** A Bag item from the shop after each trainer win: one of the cheapest third (Loot Sack). */
  z.object({ perk: z.literal('trainerLoot') }),
  /** Every `every` trainer wins: a Bag item from the dearest third of the shop (Blue Card). */
  z.object({ perk: z.literal('trainerPoints'), every: z.number().int().positive() }),
  /** Money per copy when the run reaches a new region (Pass Orb). */
  z.object({ perk: z.literal('regionMoney'), amount: z.number().int().positive() }),
  // ---------- getting around the map (slice 3b-2) ----------
  /** From the Items menu: go back to the last fork and choose again (Escape Rope). */
  z.object({ perk: z.literal('escapeRope') }),
  /** Once per stage, from the Items menu: ride two columns ahead, skipping one (Bicycle). */
  z.object({ perk: z.literal('bicycle') }),
  /** Once per stage, from the Items menu: jump to any node in the next column, even without a path (Acro Bike). */
  z.object({ perk: z.literal('acroBike') }),
  /** Once per stage, from the Items menu: ride past the next wild Pokémon and still get its reward (Mach Bike). */
  z.object({ perk: z.literal('machBike') }),
  /** At the next shop, turns into this run-long item, or into `refund` money if the player already has it (Bike Voucher). */
  z.object({ perk: z.literal('voucher'), item: z.string(), refund: z.number().int().min(0) }),
  /** From the Items menu: fight a trainer you beat on this stage again, for double money (VS Seeker). */
  z.object({ perk: z.literal('rematch') }),
  /** The map shows what waits at nodes: wild Pokémon (Devon Scope), trainers' teams (Town Map), the gym leader's ace or whole team (Rule Book, Orange Mail). */
  z.object({ perk: z.literal('preview'), what: z.enum(['wild', 'trainers', 'gymAce', 'gymTeam']) }),
  /** The gym leaders of this region's next stages, with their types (Fame Checker). */
  z.object({ perk: z.literal('nextLeaders') }),
  /** Each stage, one wild stop hides a Bag item; win there to find it (Itemfinder). */
  z.object({ perk: z.literal('hiddenItem') }),
]);
export type Perk = z.infer<typeof PerkSchema>;

export const CatalogEffectSchema = z.discriminatedUnion('kind', [
  /** Attribute changes for the run; optionally heals or befriends the lead. */
  z.object({
    kind: z.literal('attributes'),
    changes: AttributeChangesSchema,
    healLead: z.number().int().positive().optional(),
    leadFriendship: z.number().int().optional(),
  }),
  /** Money now (trainer money bonuses apply), plus attribute changes and an optional team heal. */
  z.object({ kind: z.literal('money'), amount: z.number().int().positive(), changes: AttributeChangesSchema, teamHeal: z.number().positive().max(1).optional() }),
  /** A permanent percentage on one stat of one Pokémon, per copy (Wings). */
  z.object({ kind: z.literal('statBoost'), stat: StatNameSchema, percent: z.number().positive() }),
  /** One Pokémon gains friendship (negative: loses it), plus attribute changes. */
  z.object({ kind: z.literal('feed'), friendship: z.number().int(), changes: AttributeChangesSchema }),
  /** Raises the max PP of one move the player picks (each up is +20%, at most 3 per move). */
  z.object({ kind: z.literal('ppUp'), ups: z.number().int().min(1).max(3) }),
  /** Care for one Pokémon: heal HP, revive, cure status, restore one move's PP; friendship and attribute side effects. */
  z.object({
    kind: z.literal('care'),
    heal: z.number().int().positive().optional(),
    revive: z.number().positive().max(1).optional(),
    cure: z.boolean().optional(),
    ppMove: z.literal('lowest').optional(),
    friendship: z.number().int().optional(),
    changes: AttributeChangesSchema.optional(),
  }),
  /** Care for the whole team. `pp` -1 means full PP; `heal` is a fraction of max HP. */
  z.object({
    kind: z.literal('teamCare'),
    heal: z.number().positive().max(1).optional(),
    revive: z.number().positive().max(1).optional(),
    pp: z.number().int().min(-1).optional(),
    cureSleep: z.boolean().optional(),
    changes: AttributeChangesSchema.optional(),
  }),
  /** A run-long perk (Amulet Coin, Exp. Share...). `percent` is per copy. */
  z.object({
    kind: z.literal('passive'),
    passive: z.enum(['money', 'trainerMoney', 'expShare', 'gymInterest', 'newSpeciesLove', 'stageCharisma', 'catchUpExp']),
    percent: z.number().positive(),
  }),
  /** The fossil's Pokémon joins the party (or is released, like a catch). */
  z.object({ kind: z.literal('fossil'), species: z.string() }),
  /** Teach a move of one type the Pokémon can learn: TM = pick 1 of 3 random ones, HM = pick any. */
  z.object({ kind: z.literal('teachMove'), type: TypeNameSchema, mode: z.enum(['tm', 'hm']) }),
  /** A held item: copies go on the chosen Pokémon (or on every team member for team items like the Plates). */
  z.object({ kind: z.literal('held'), hooks: z.array(HeldHookSchema).min(1) }),
  /** Battle effects carried into the chosen Pokémon's next battles (or every team member's); `cure` also cures that status now. */
  z.object({ kind: z.literal('battleBoost'), boosts: z.array(BattleBoostSchema).min(1), cure: StatusIdSchema.optional() }),
  /** A map and encounter item (Repels, Flutes, Incense, Mail, Poké Doll, Apricorns...), plus attribute changes now. */
  z.object({ kind: z.literal('encounter'), lasts: EncounterLastsSchema, mods: z.array(EncounterModSchema).min(1), changes: AttributeChangesSchema.optional() }),
  /** A shop or money item (Coupons, Point Card, Loot Sack, Reply Mail...). */
  z.object({ kind: z.literal('perk'), lasts: EncounterLastsSchema, perks: z.array(PerkSchema).min(1) }),
]);
export type CatalogEffect = z.infer<typeof CatalogEffectSchema>;

export const CATALOG_NEEDS = ['battle', 'map', 'events', 'm8.5'] as const;

export const CatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    family: z.string().min(1),
    description: z.string().min(1),
    rarity: RaritySchema,
    /** Where copies pile up: on one Pokémon, the whole team, or the player. */
    stacksOn: z.enum(['pokemon', 'team', 'player']),
    /** Most copies that do anything (null: no limit). */
    max: z.number().int().positive().nullable(),
    how: z.enum(['held', 'use', 'passive']),
    /** File name in the director's icon pack (images/items/gen5/<icon>.png), or null when the pack has none. */
    icon: z.string().nullable(),
    status: z.enum(['supported', 'existing', 'pending']),
    /** For "existing" (and some "pending") entries: the reward or Bag item already in the game. */
    existing: z.string().optional(),
    /** Evolution items: what cashing the item in gives. */
    cashIn: AttributeChangesSchema.optional(),
    /** For "pending" entries: which parts of the plan it waits on. */
    needs: z.array(z.enum(CATALOG_NEEDS)).optional(),
    effect: CatalogEffectSchema.optional(),
  })
  .refine((e) => (e.status === 'supported') === (e.effect !== undefined), { message: 'a supported entry needs an effect (and only supported entries have one)' })
  .refine((e) => e.status !== 'pending' || (e.needs?.length ?? 0) > 0, { message: 'a pending entry must say what it needs' });
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

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

/** Where a boss can stand: at the end of a stage, in an Elite Four, or as champion. */
export const BOSS_ROLES = ['gym', 'elite', 'champion'] as const;
export type BossRole = (typeof BOSS_ROLES)[number];

/**
 * A gym leader, Elite Four member or champion (bosses.json). Any boss can take
 * any of the three roles. Stages prefer a gym leader whose speciality matches
 * the theme; bosses with no types use mixed teams.
 */
export const BossProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  types: z.array(TypeNameSchema).max(2),
  /** Portrait asset ids: the default one, and optional ones for a role (e.g. a champion outfit). */
  sprites: z.object({ default: z.string(), gym: z.string().optional(), elite: z.string().optional(), champion: z.string().optional() }),
  /** The boss's signature Pokémon, ace first. tools/build-boss-teams.ts builds their teams from these. */
  signature: z.array(z.string()).min(1),
});
export type BossProfile = z.infer<typeof BossProfileSchema>;

export const TRAINING_STATS = STAT_NAMES;

/**
 * One boss Pokémon as written in bossTeams.json:
 * "garchomp / earthquake dragon-claw stone-edge swords-dance / atk+4 spe+4 hp+3".
 * The last part (training: extra vitamin-style stacks) is optional.
 */
export const BossMemberSchema = z.string().transform((text, ctx) => {
  const [speciesId = '', movesText = '', trainingText = ''] = text.split('/').map((p) => p.trim());
  const moves = movesText.split(/\s+/).filter(Boolean);
  const training: Partial<Record<StatName, number>> = {};
  for (const part of trainingText.split(/\s+/).filter(Boolean)) {
    const match = /^(hp|atk|def|spa|spd|spe)\+(\d+)$/.exec(part);
    if (!match) {
      ctx.addIssue({ code: 'custom', message: `"${part}" is not a training entry like "atk+2" in "${text}"` });
      return z.NEVER;
    }
    training[match[1] as StatName] = Number(match[2]);
  }
  if (!speciesId || moves.length < 1 || moves.length > 4) {
    ctx.addIssue({ code: 'custom', message: `"${text}" needs a species and 1–4 moves` });
    return z.NEVER;
  }
  return { speciesId, moves, training };
});
export type BossMember = z.infer<typeof BossMemberSchema>;

export const BossTeamSchema = z.object({
  /** The level the team was built for (the game's difficulty curve sets the real levels). */
  level: z.number().int().min(1).max(100),
  /** 0–1: the chance each turn that the boss picks its best move instead of a random one. */
  ai: z.number().min(0).max(1),
  members: z.array(BossMemberSchema).min(1).max(6),
});
export type BossTeam = z.infer<typeof BossTeamSchema>;

/** bossTeams.json: 16 gym teams, 10 Elite Four teams and 10 champion teams per boss. */
export const BossTeamsFileSchema = z.record(
  z.string(),
  z.object({ gym: z.array(BossTeamSchema).length(16), elite: z.array(BossTeamSchema).length(10), champion: z.array(BossTeamSchema).length(10) }),
);
export type BossTeams = z.infer<typeof BossTeamsFileSchema>[string];

export interface Boss extends BossProfile {
  teams: BossTeams;
}

/** A region: these bosses are preferred there in each role (empty lists mean "anyone"). All ids are bosses.json ids. */
export const RegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gymLeaders: z.array(z.string()),
  eliteFour: z.array(z.string()),
  champions: z.array(z.string()),
  /** The Grand Region always comes last. */
  grand: z.boolean().default(false),
  /** The generations of Pokémon native to this region (empty = every generation is native). */
  generations: z.array(z.number().int().min(1).max(9)).default([]),
});
export type Region = z.infer<typeof RegionSchema>;

/** The shape of a campaign: how many regions, stages and levels. "dev" is a tiny one for testing. */
export const CampaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Regular regions, in random order (each appears once). */
  regularRegions: z.number().int().min(1),
  /** Whether the Grand Region comes after them. */
  grandRegion: z.boolean(),
  /** False for test campaigns: their runs still pay out, but don't count toward achievements and unlocks. */
  countsForProgress: z.boolean().default(true),
  stagesPerRegion: z.number().int().min(1),
  /** Numbered levels per stage (the last is the gym leader). */
  columns: z.number().int().min(3),
  /** Each range is [first, last] column; one trainer column is picked from each. */
  trainerColumns: z.array(z.tuple([z.number().int().min(1), z.number().int().min(1)])),
  eliteFourSize: z.number().int().min(1),
});
export type Campaign = z.infer<typeof CampaignSchema>;

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

export const ShopEntrySchema = z.object({
  item: z.string(),
  price: z.number().int().positive(),
  /** The item is in stock once the player has this many badges. */
  minBadges: z.number().int().min(0).default(0),
});
export type ShopEntry = z.infer<typeof ShopEntrySchema>;

export const RewardEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('addItem'), item: z.string(), quantity: z.number().int().positive() }),
  z.object({ kind: z.literal('money'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('levelUp'), levels: z.number().int().positive() }),
  z.object({ kind: z.literal('vitamin'), stat: StatNameSchema }),
  /** Adds to an attribute for the rest of the run (negative moves a meter toward its other end). */
  z.object({ kind: z.literal('attribute'), attribute: AttributeKeySchema, amount: z.number().int() }),
  /** An item from the item catalog (itemCatalog.json); its effect is the entry's. */
  z.object({ kind: z.literal('catalog'), entry: z.string() }),
]);
export type RewardEffect = z.infer<typeof RewardEffectSchema>;

export const RewardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['healing', 'currency', 'stat-buff', 'consumable', 'attribute', 'key', 'transformation', 'item']),
  rarity: RaritySchema,
  /** Item family for draft variety (catalog items); rewards without one use their category. */
  family: z.string().optional(),
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
  wildPool: z.array(z.string()).min(1),
  draftSize: z.number().int().positive(),
  rarityWeights: z.record(RaritySchema, z.number().min(0)),
  /**
   * Draft variety: a family already in the draft keeps this share of its
   * weight for the next slot (lowered further by Luck, see luckDraftVariety).
   */
  repeatFamilyWeight: z.number().min(0).max(1),
  /**
   * Held items bosses carry (director, answer 3): how many for each role, the
   * rarity weights, and how much the rare and epic weights grow per region.
   */
  bossHeldItems: z.object({
    gym: z.number().int().min(0),
    elite: z.number().int().min(0),
    champion: z.number().int().min(0),
    rarityWeights: z.record(RaritySchema, z.number().min(0)),
    betterPerRegion: z.number().min(0),
  }),
  vitaminMultiplierPerStack: z.number().positive(),
  vitaminMaxStacks: z.number().int().positive(),
  /** Battle transformations (M8.5): which bosses may use them. */
  transformations: z.object({
    /** Gym leaders use them from this gym of the run on (1 = the first gym). */
    bossGymFrom: z.number().int().min(1),
    /** Elite Four members and champions always may. */
    league: z.boolean(),
    /** Turns a Dynamax lasts, counting the turn it starts. */
    dynamaxTurns: z.number().int().min(1).default(3),
  }),
  /** Friendship (M8.75 part B): how it grows and when friendship evolutions happen. */
  friendship: z.object({
    max: z.number().int().positive().max(255),
    /** Every new Pokémon (wild, caught, trainer) starts here. */
    base: z.number().int().min(0),
    /** The starter starts here instead. */
    starter: z.number().int().min(0),
    /** At this or more, friendship evolutions happen after a battle. */
    evolveAt: z.number().int().positive(),
    /** The item that stands for a friendship evolution in species data. */
    evolutionItem: z.string(),
    perLevel: z.number().min(0),
    /** Each participant still standing when a battle is won. */
    perBattleWon: z.number().min(0),
    /** Instead of perBattleWon, for gym leaders, the Elite Four and champions. */
    perBossWon: z.number().min(0),
    perVitamin: z.number().min(0),
    /** Lost when it faints (a negative number). */
    perFaint: z.number().max(0),
  }),
  /**
   * Enemy levels climb through each region from its start level to just under its level cap:
   * start + (cap − capMargin − start) × t^curve, where t goes 0 → 1 from the first level of the
   * region to its last gym. Then variance, archetype offset and node bonus are added.
   */
  difficulty: z.object({
    baseLevel: z.number(),
    curve: z.number().positive(),
    capMargin: z.number().int().min(0),
    /** Each region raises the level cap by this much (director decision D14). */
    levelCapStep: z.number().int().positive(),
    variance: z.number().int().min(0),
    minLevel: z.number().int().min(1),
    maxLevel: z.number().int().max(100),
    trainerBonus: z.number().int().min(0),
    gymBonus: z.number().int().min(0),
    /** Extra levels on the gym leader's last Pokémon. */
    aceBonus: z.number().int().min(0),
    eliteFourBonus: z.number().int().min(0),
    championBonus: z.number().int().min(0),
    /** Extra levels on a "harder" route node: [min, max]. */
    harderBonus: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  }),
  /** Stage map shape (the number of columns and trainer columns come from the campaign). */
  stage: z.object({
    minWidth: z.number().int().min(1),
    maxWidth: z.number().int().min(1).max(5),
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
  money: z.object({
    startingMoney: z.number().int().min(0),
    wildPerEnemyLevel: z.number().min(0),
    gymLeaderPerLevel: z.number().min(0),
    eliteFourPerLevel: z.number().min(0),
    championPerLevel: z.number().min(0),
  }),
  campaigns: z.array(CampaignSchema).min(1),
  attributeMin: z.number(),
  attributeMax: z.number(),
  /** What attributes do (GAME_DESIGN.md §9). Each value is the effect at the maximum; it scales in a straight line. */
  attributeEffects: z.object({
    strengthPhysicalDamage: z.number().min(0),
    intelligenceSpecialDamage: z.number().min(0),
    speedStat: z.number().min(0),
    charismaPriceCut: z.number().min(0).max(1),
    luckUncommonWeight: z.number().min(0),
    luckRareWeight: z.number().min(0),
    luckEpicWeight: z.number().min(0),
    /** Luck at its maximum removes repeated item families from a draft entirely. */
    luckDraftVariety: z.number().min(0).max(1),
    luckShinyChance: z.number().min(0),
    rageDamageDealt: z.number().min(0),
    rageDamageTaken: z.number().min(0),
    peaceHealing: z.number().min(0),
    peaceDamageTakenCut: z.number().min(0).max(1),
    goodCatch: z.number().min(0),
    evilMoney: z.number().min(0),
    /** Charisma: more experience for your Pokémon. */
    charismaExpGain: z.number().min(0),
    /** Charisma: friendship grows faster. */
    charismaFriendshipGain: z.number().min(0),
  }),
  /**
   * How permanent attributes grow (D10): every `per` of a lifetime counter (or of
   * distinct species) adds `amount`. Negative amounts move a meter toward its other end.
   */
  attributeGrowth: z.array(
    z.object({
      attribute: AttributeKeySchema,
      counter: CounterNameSchema.optional(),
      set: z.enum(['speciesSeen', 'speciesCaught']).optional(),
      per: z.number().int().positive(),
      amount: z.number().int(),
    }).refine((g) => (g.counter === undefined) !== (g.set === undefined), { message: 'needs exactly one of counter or set' }),
  ),
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
  /** Elite Four and champion teams grow with each region (extraPerStage counts regions here). */
  eliteFourTeam: z.object({
    baseSize: z.number().int().min(1),
    extraPerStage: z.number().min(0),
    randomExtra: z.number().int().min(0),
    maxSize: z.number().int().min(1).max(6),
  }),
  championTeam: z.object({
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
  /**
   * Trainers' Pokémon evolve by item (stones, trades, friendship) once they reach
   * trainerItemLevel, or trainerBabyLevel for baby Pokémon (Pichu, Togepi, ...).
   */
  evolution: z.object({ trainerItemLevel: z.number().int().min(2).max(100), trainerBabyLevel: z.number().int().min(2).max(100) }),
  /**
   * Region eligibility: in a region, wild and trainer Pokémon from its own
   * generation(s) are this many times as likely as others (still themed).
   */
  nativeWeight: z.number().min(1),
  /** Wild Pokémon have a base stat total no higher than this (keeps Ultra Beasts and Paradox Pokémon out). */
  wildMaxBaseStats: z.number().int().positive(),
  /** Candies for releasing a caught Pokémon: perRelease + floor(level / perLevels). */
  candies: z.object({ perRelease: z.number().int().min(0), perLevels: z.number().int().min(1) }),
  /** Run-end payout into the Bank (GAME_DESIGN.md §14.2). */
  bank: z.object({
    /** Share of leftover Poké Dollars that becomes Bank Credits. */
    moneyConversionRate: z.number().min(0).max(1),
    /** The stipend: credits for progress, paid even when the run is lost. */
    stipend: z.object({
      perRun: z.number().int().min(0),
      perEncounter: z.number().min(0),
      perBadge: z.number().int().min(0),
      perEliteFour: z.number().int().min(0),
      perChampion: z.number().int().min(0),
      perRegion: z.number().int().min(0),
    }),
  }),
  /** Research Points for discoveries (first time ever seen or caught). */
  research: z.object({
    perSpeciesSeen: z.number().int().min(0),
    perSpeciesCaught: z.number().int().min(0),
    perShiny: z.number().int().min(0),
  }),
  /** How many finished runs the Run History keeps. */
  runHistorySize: z.number().int().min(1),
  /** How many loadout presets the Preparation Desk can store. */
  presetSlots: z.number().int().min(1),
});
export type Balance = z.infer<typeof BalanceSchema>;

/** zMoves.json (npm run data:zmoves, from Pokémon Showdown's move data). */
export const ZMoveDataSchema = z.object({
  /** The Z-Move each type's crystal makes. */
  byType: z.partialRecord(TypeNameSchema, z.string()),
  /** Z-Move power for each damaging move. */
  power: z.record(z.string(), z.number().int().positive()),
  /** What a status move adds when used as a Z-Move (it still works as itself). */
  status: z.record(
    z.string(),
    z.object({
      boosts: z.array(z.object({ stat: BoostStatSchema, stages: z.number().int() })).optional(),
      /** `clearNegative`: the user's lowered stats go back to normal; `heal`: the user's HP is restored in full. */
      effect: z.enum(['clearNegative', 'heal']).optional(),
    }),
  ),
});
export type ZMoveData = z.infer<typeof ZMoveDataSchema>;

/** What a Max or G-Max Move does after it hits (maxMoves.json). */
const MaxEffectSchema = z.object({
  weather: WeatherSchema.optional(),
  statChanges: z.array(StatChangeSchema.omit({ chance: true })).optional(),
  status: StatusIdSchema.optional(),
  confuse: z.literal(true).optional(),
  bind: z.literal(true).optional(),
  breaksProtect: z.literal(true).optional(),
});
export type MaxEffect = z.infer<typeof MaxEffectSchema>;

/** maxMoves.json (npm run data:maxmoves, from Pokémon Showdown's move data). */
export const MaxMoveDataSchema = z.object({
  /** The Max Move each type's damaging moves become. */
  byType: z.partialRecord(TypeNameSchema, z.string()),
  /** What every status move becomes (Max Guard). */
  guard: z.string(),
  /** Max Move power for each damaging move. */
  power: z.record(z.string(), z.number().int().positive()),
  /** Max Move id -> its side effect. */
  effects: z.record(z.string(), MaxEffectSchema),
  /** G-Max Move id -> the Gigantamax forms that use it instead of their type's Max Move. */
  gmax: z.record(
    z.string(),
    z.object({ forms: z.array(z.string()).min(1), type: TypeNameSchema, power: z.number().int().positive().optional(), effects: MaxEffectSchema.optional() }),
  ),
});
export type MaxMoveData = z.infer<typeof MaxMoveDataSchema>;

export interface Content {
  species: Map<string, Species>;
  moves: Map<string, Move>;
  typeChart: TypeChart;
  archetypes: Map<string, Archetype>;
  achievements: Map<string, Achievement>;
  starterPools: Map<string, StarterPool>;
  draftRules: Map<string, DraftRule>;
  prepTokens: Map<string, PrepToken>;
  licenses: Map<string, License>;
  rewards: Map<string, Reward>;
  items: Map<string, Item>;
  /** Every catalog item (itemCatalog.json), supported or not. */
  catalog: Map<string, CatalogEntry>;
  /** Every move each species can learn by TM, tutor or egg, beyond its level-up moves (learnables.json). */
  learnables: Map<string, string[]>;
  trainers: Map<string, TrainerClass>;
  /** Every gym leader, Elite Four member and champion, with their teams. */
  bosses: Map<string, Boss>;
  regions: Map<string, Region>;
  campaigns: Map<string, Campaign>;
  themes: Map<string, Theme>;
  arenas: Partial<Record<TypeName, string>>;
  shop: ShopEntry[];
  ruleset: Ruleset;
  balance: Balance;
  /** Story layer settings and story event definitions (story.json, core/story). */
  story: StoryConfig;
  zMoves: ZMoveData;
  maxMoves: MaxMoveData;
}
