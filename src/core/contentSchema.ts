// Shapes of every game-content data file (species, moves, items, ...).
// The JSON files in src/data are checked against these when the game starts,
// so a typo in a data file shows a clear error instead of a strange bug.

import { z } from 'zod';
import type { StoryConfig } from './story/schema';
import type { RaidFile } from './raid/schema';
import type { TotemFile } from './totem/schema';
import type { ExpeditionFile } from './expedition/schema';
import type { MinigameFile } from './minigame/schema';

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
  /** Weight in kg for Low Kick, Grass Knot, Heavy Slam and Heat Crash (50 when missing). */
  weight: z.number().positive().optional(),
  /** Share of this species that is female (1 = always, 0 = never); null = genderless; missing = an even mix. */
  femaleRatio: z.number().min(0).max(1).nullable().optional(),
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
  /**
   * The abilities it can have (npm run data:abilities): each Pokémon gets one
   * of `normal` at random, or rarely `hidden` (core/abilities.ts). Custom forms
   * with none listed use their base species' abilities.
   */
  abilities: z.object({ normal: z.array(z.string()), hidden: z.string().nullable() }).default({ normal: [], hidden: null }),
  /** File names in the asset pack: sprite "2019" → images/pokemon/2019.png, icon "7/2019", cry "19". */
  assets: z.object({ sprite: z.string(), icon: z.string(), cry: z.string() }),
});
export type Species = z.infer<typeof SpeciesSchema>;

/** An ability a Pokémon can have. What it does in battle is in core/battle/abilities.ts. */
export const AbilitySchema = z.object({ id: z.string().min(1), name: z.string().min(1), description: z.string() });
export type Ability = z.infer<typeof AbilitySchema>;

export const WEATHERS = ['rain', 'sun', 'sand', 'snow', 'hail'] as const;
export const WeatherSchema = z.enum(WEATHERS);
/** Terrains (Electric, Grassy, Misty, Psychic): they last 5 turns and affect Pokémon standing on the ground. */
export const TERRAINS = ['electric', 'grassy', 'misty', 'psychic'] as const;
export const PowerRuleSchema = z.enum([
  'userSpeed', 'targetSpeed', 'userHp', 'targetHp',
  'doubleTargetStatus', 'doubleUserStatus', 'doubleTargetPoison', 'doubleTargetParalyzed', 'doubleTargetAsleep',
  'doubleUserFirst', 'doubleUserSecond',
  'electricTerrainDouble', 'electricTerrainBoost', 'mistyTerrainBoost', 'psychicTerrainBoost', 'needsTerrain',
  'statsRaised', 'targetStatsRaised', 'fallenAllies', 'friendship', 'frustration',
  'perHit', 'magnitude', 'sunBoost', 'doubleTargetHurt', 'doubleRandom', 'stockpile',
  'rageFist', 'stompingTantrum', 'lashOut', 'retaliate', 'echoedVoice', 'rollout', 'fusionFire', 'fusionElectric', 'present', 'trumpCard', 'hardPress',
  'acrobatics', 'doubleDynamax', 'knockOff', 'terrainPulse', 'flingItem', 'targetWeight', 'weightRatio',
]);
export type PowerRule = z.infer<typeof PowerRuleSchema>;

export const SideMoveSchema = z.enum(['reflect', 'lightScreen', 'auroraVeil', 'tailwind', 'safeguard', 'mist', 'luckyChant', 'spikes', 'toxicSpikes', 'stealthRock', 'stickyWeb']);
export type SideMove = z.infer<typeof SideMoveSchema>;

export const TerrainSchema = z.enum(TERRAINS);
export type Terrain = z.infer<typeof TerrainSchema>;
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
  /**
   * contact/punch/bite/pulse/sound come from PokeAPI (abilities such as Static and Iron Fist use them).
   * `zmove`, `max`: a Z-Move or Max Move made in battle (battle/transform.ts); they hit through Protect for a quarter of their damage.
   */
  flags: z.array(z.enum(['powder', 'typeless', 'zmove', 'max', 'contact', 'punch', 'bite', 'pulse', 'sound', 'bullet', 'slicing', 'wind'])).default([]),
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
      fixedDamage: z.union([z.literal('level'), z.literal('psywave'), z.number().int().positive()]).optional(),
      /** Takes off half of the target's current HP (Super Fang). */
      halveTarget: z.literal(true).optional(),
      /** Brings the target's HP down to the user's (Endeavor); fails if it is already lower. */
      endeavor: z.literal(true).optional(),
      /** How the move's power is worked out from the battle (see powerFromRule in the engine). */
      powerRule: PowerRuleSchema.optional(),
      /** Does nothing at all (Splash, Celebrate). */
      noop: z.literal(true).optional(),
      /** Status move: puts the user in a state (Focus Energy, Laser Focus, Lock-On, Ingrain, Aqua Ring, Endure). */
      selfState: z.enum(['focusEnergy', 'laserFocus', 'lockOn', 'ingrain', 'aquaRing', 'endure']).optional(),
      /** Rest: sleeps for two turns and heals fully. */
      rest: z.literal(true).optional(),
      /** Wish: heals half the user's max HP at the end of the next turn. */
      wish: z.literal(true).optional(),
      /** Pain Split: both sides end up with the average of their HP. */
      painSplit: z.literal(true).optional(),
      /** Haze / Freezy Frost reset every stat change; Clear Smog resets the target's after its hit. */
      resetStages: z.enum(['both', 'target']).optional(),
      /** Psych Up copies the target's stat changes; Topsy-Turvy flips the target's; the swaps trade stages. */
      stageTrick: z.enum(['copy', 'invert', 'swapAll', 'swapDefense', 'swapOffense']).optional(),
      /** Cures status in the whole party (Heal Bell) or just the user (Refresh). */
      cure: z.enum(['party', 'self']).optional(),
      /** The user leaves the field after the turn (U-turn, Baton Pass: also passes its stat changes). */
      switchOut: z.enum(['switch', 'baton']).optional(),
      /** Drags the target out (Roar, Dragon Tail): a trainer sends another Pokémon, the player's is swapped for a random one. */
      forceSwitch: z.literal(true).optional(),
      /** The target can't be switched out (Mean Look, Block). */
      trap: z.literal(true).optional(),
      /** The user is hurt for half its max HP if the move misses or has no effect (Jump Kick). */
      crashOnMiss: z.literal(true).optional(),
      /** Always a critical hit. */
      alwaysCrit: z.literal(true).optional(),
      /** If the move knocks the target out, the user's stat rises (Fell Stinger). */
      koBoost: z.object({ stat: BoostStatSchema, stages: z.number().int() }).optional(),
      /** Takes hold of the target's last move or its moves (Disable, Encore, Torment, Taunt, Heal Block, Spite). */
      disrupt: z.enum(['disable', 'encore', 'torment', 'taunt', 'healBlock', 'spite', 'throatChop']).optional(),
      /** Uses another move: a random one (Metronome), the target's last (Mirror Move), or the last one used by anyone (Copycat). */
      callMove: z.enum(['metronome', 'mirrorMove', 'copycat']).optional(),
      /** Which stat the attack uses: the target's Attack (Foul Play), the user's Defense (Body Press), or the higher of Atk and Sp. Atk (Photon Geyser). */
      attackFrom: z.enum(['targetAtk', 'def', 'best']).optional(),
      /** Only works on a sleeping target (Dream Eater). */
      requiresSleepingTarget: z.literal(true).optional(),
      /** Fails unless the target chose an attack and the user moved first (Sucker Punch, Thunderclap). */
      suckerPunch: z.literal(true).optional(),
      /** A protecting move that punishes contact: a stat change, a status, or damage (King's Shield, Baneful Bunker, Spiky Shield). */
      protectContact: z.object({ stat: BoostStatSchema.optional(), stages: z.number().int().optional(), status: StatusIdSchema.optional(), hurt: z.number().positive().optional() }).optional(),
      /** Becomes (or makes the target) a single type: Soak, Magic Powder, Camouflage (by terrain), Conversion (the first move's type). */
      setType: z.enum(['water', 'psychic', 'terrain', 'firstMove']).optional(),
      /** Ability tricks: Role Play, Skill Swap, Simple Beam, Worry Seed, Entrainment, Gastro Acid. */
      abilityChange: z.enum(['rolePlay', 'skillSwap', 'simple', 'insomnia', 'entrainment', 'suppress']).optional(),
      /** Field-wide effects for five turns. */
      field: z.enum(['gravity', 'trickRoom', 'waterSport', 'mudSport']).optional(),
      /** Swaps everything set up on the two sides (Court Change). */
      courtChange: z.literal(true).optional(),
      /** Substitute: the user pays a quarter of its max HP for a decoy that takes hits. */
      substitute: z.literal(true).optional(),
      /** Destiny Bond: whoever knocks the user out this turn goes down too. */
      destinyBond: z.literal(true).optional(),
      /** Perish Song: both Pokémon faint in three turns unless they switch out. */
      perishSong: z.literal(true).optional(),
      /** Yawn: the target falls asleep at the end of the next turn. */
      yawn: z.literal(true).optional(),
      /** Magnet Rise: the user floats for five turns. */
      magnetRise: z.literal(true).optional(),
      /** Smack Down / Thousand Arrows: the target is brought to the ground. */
      smackDown: z.literal(true).optional(),
      /** Stockpile and Swallow. */
      stockpile: z.enum(['store', 'swallow']).optional(),
      /** Strength Sap: heals by the target's Attack, then lowers it. */
      strengthSap: z.literal(true).optional(),
      /** Psycho Shift passes the user's status on; Purify cures the target and heals the user. */
      statusTrick: z.enum(['shift', 'purify']).optional(),
      /** Sketch: permanently learns the target's last move. */
      sketch: z.literal(true).optional(),
      /** Assist uses a move from a party member; Nature Power one chosen by the terrain. */
      callFrom: z.enum(['assist', 'nature']).optional(),
      /** 4/3 power against a type it is super effective on (Collision Course). */
      superEffectiveBoost: z.literal(true).optional(),
      /** Can't be used twice in a row (Blood Moon). */
      noRepeat: z.literal(true).optional(),
      /** Fails if the user was hit first (Focus Punch), or unless it was hit by a physical move first (Shell Trap). */
      focus: z.enum(['unhit', 'hitPhysical']).optional(),
      /** One of these statuses at this chance, picked at random (Tri Attack). */
      randomStatus: z.object({ chance: z.number().min(1).max(100), ids: z.array(StatusIdSchema).min(2) }).optional(),
      /** Priority bonus while this terrain is up (Grassy Glide). */
      terrainPriority: z.object({ terrain: TerrainSchema, bonus: z.number().int() }).optional(),
      /** Pays this share of max HP, then changes stats (Belly Drum, Clangorous Soul, Fillet Away, No Retreat). */
      hpCost: z.object({ fraction: z.number().min(0).max(1), stats: z.array(z.object({ stat: BoostStatSchema, stages: z.number().int() })).min(1), trapSelf: z.literal(true).optional() }).optional(),
      /** Raises one random stat that isn't maxed (Acupressure). */
      randomStat: z.number().int().positive().optional(),
      /** Heals the target by this share of max HP (Heal Pulse, Floral Healing). */
      healTarget: z.number().positive().max(1).optional(),
      /** Raises stats of Pokémon of these types (Flower Shield, Rototiller) or with these abilities (Gear Up, Magnetic Flux). */
      fieldBoost: z.object({ types: z.array(TypeNameSchema).optional(), abilities: z.array(z.string()).optional(), stats: z.array(z.object({ stat: BoostStatSchema, stages: z.number().int() })).min(1) }).optional(),
      /** Swaps or averages stats: Power Trick / Power Shift, Speed Swap, Guard Split, Power Split. */
      statOverride: z.enum(['swapAtkDef', 'swapSpe', 'splitDef', 'splitAtk']).optional(),
      /** Charge: Sp. Def +1 and the next Electric move is twice as strong. */
      electricCharge: z.literal(true).optional(),
      /** The user faints: Memento lowers the foe, Healing Wish and Lunar Dance heal the next Pokémon, Final Gambit deals its HP. */
      userFaint: z.enum(['memento', 'healingWish', 'lunarDance', 'finalGambit']).optional(),
      /** Revival Blessing: a fainted party member comes back at half HP. */
      revivalBlessing: z.literal(true).optional(),
      /** Shed Tail: pays half HP for a Substitute and switches out, passing it on. */
      shedTail: z.literal(true).optional(),
      /** Changes the user's type: copy the target's (Reflect Type), add Grass or Ghost to the target, resist its last move (Conversion 2), or lose a type after the hit. */
      typeEdit: z.object({ mode: z.enum(['reflect', 'add', 'resist', 'lose']), type: TypeNameSchema.optional() }).optional(),
      /** The move also counts as this type for effectiveness (Flying Press). */
      secondType: TypeNameSchema.optional(),
      /** Treats this type as weak to the move (Freeze-Dry vs Water). */
      superAgainst: TypeNameSchema.optional(),
      /** Only hits targets that share a type with the user. */
      synchronoise: z.literal(true).optional(),
      /** Foresight and Odor Sleuth ('ghost') / Miracle Eye ('dark'): the target's immunities and evasion are ignored. */
      identify: z.enum(['ghost', 'dark']).optional(),
      /** Tar Shot: Speed -1 and the target becomes weak to Fire. */
      tarShot: z.literal(true).optional(),
      /** Ion Deluge and Plasma Fists make Normal moves Electric this turn; Electrify does it for the target's next move. */
      electrify: z.enum(['field', 'target']).optional(),
      /** Terrain Pulse: type and power follow the terrain. */
      terrainPulse: z.literal(true).optional(),
      /** Tera Blast: the user's Tera type, and the better attacking stat. */
      teraBlast: z.literal(true).optional(),
      /** The type depends on the user's form (Raging Bull, Revelation Dance, Ivy Cudgel, Aura Wheel). */
      formType: z.enum(['tauros', 'oricorio', 'ogerpon', 'morpeko']).optional(),
      /** Secret Power: the extra effect follows the terrain. */
      terrainSecondary: z.literal(true).optional(),
      /** Physical or special, whichever the user is better at (Shell Side Arm). */
      autoCategory: z.literal(true).optional(),
      /** Needs the user to be asleep (Snore, Sleep Talk) and may be used while asleep. */
      asleepOnly: z.literal(true).optional(),
      /** Sleep Talk: uses one of the user's other moves. */
      sleepTalk: z.literal(true).optional(),
      /** Me First: copies the target's chosen attack at 1.5× power. */
      meFirst: z.literal(true).optional(),
      /** Upper Hand: only works on a priority attack. */
      upperHand: z.literal(true).optional(),
      /** Fails unless the user has used all its other moves (Last Resort); or unless it has eaten a berry (Belch); or the target holds an item (Poltergeist). */
      precondition: z.enum(['allOthers', 'ateBerry', 'targetHasItem', 'lowestHp']).optional(),
      /** Nightmare, Curse, Rage: new states. */
      nightmare: z.literal(true).optional(),
      curse: z.literal(true).optional(),
      rage: z.literal(true).optional(),
      imprison: z.literal(true).optional(),
      fairyLock: z.literal(true).optional(),
      snatch: z.literal(true).optional(),
      magicCoat: z.literal(true).optional(),
      shield: z.enum(['status', 'priority', 'damage']).optional(),
      powder: z.literal(true).optional(),
      confuseBoth: z.literal(true).optional(),
      telekinesis: z.literal(true).optional(),
      octolock: z.literal(true).optional(),
      syrupBomb: z.literal(true).optional(),
      saltCure: z.literal(true).optional(),
      uproar: z.literal(true).optional(),
      bide: z.literal(true).optional(),
      beakBlast: z.literal(true).optional(),
      glaiveRush: z.literal(true).optional(),
      mimic: z.literal(true).optional(),
      /** Transform: become a copy of the target. */
      transform: z.literal(true).optional(),
      /** Hits two turns later for the damage this move would do then (Future Sight, Doom Desire). */
      delayed: z.literal(true).optional(),
      /** Cures this status on the target after the hit (Sparkling Aria cures burns). */
      cureTarget: StatusIdSchema.optional(),
      /** The stat changes of a damaging move all happen together on one roll (Silver Wind). */
      together: z.literal(true).optional(),
      /** Only does anything to a target with this status (Venom Drench). */
      needsStatus: StatusIdSchema.optional(),
      /** Hidden Power: the type comes from the user (a fixed roll per Pokémon, since there are no IVs). */
      hiddenPower: z.boolean().optional(),
      /** Attract: the target falls in love and half the time can't move (only opposite genders). */
      attract: z.literal(true).optional(),
      /** Captivate: only works on a target of the opposite gender. */
      oppositeGender: z.literal(true).optional(),
      /** Springtide Storm: 30% to raise the user's Attack (Incarnate) or lower the foe's (Therian). */
      formStorm: z.boolean().optional(),
      /** Beat Up: one hit for each healthy party member, powered by that member's Attack. */
      beatUp: z.boolean().optional(),
      /** Moves that touch held items. */
      itemMove: z.enum(['steal', 'swap', 'knock', 'bestow', 'embargo', 'magicRoom', 'remove', 'burnBerry', 'pluckBerry', 'fling', 'recycle', 'stuffCheeks', 'teatime', 'naturalGift', 'itemType']).optional(),
      /** Spectral Thief: takes the target's stat boosts first. */
      stealBoosts: z.literal(true).optional(),
      /** Copies the target's ability onto the user (Doodle, singles). */
      copyAbility: z.literal(true).optional(),
      /** Grudge: the move that knocks the user out loses all its PP. */
      grudge: z.literal(true).optional(),
      /** Uproar and others: the user can't be put to sleep by anyone while it lasts. */
      /** Toxic: badly poisons (the damage grows each turn). */
      toxic: z.literal(true).optional(),
      /** Roost: heals half and loses the Flying type until the turn ends. */
      roost: z.literal(true).optional(),
      /** Wonder Room: Defense and Sp. Def are swapped for five turns. */
      wonderRoom: z.literal(true).optional(),
      /** Inflicts this status on the target if it has any raised stats (Burning Jealousy). */
      statusIfBoosted: StatusIdSchema.optional(),
      /** Suppresses the target's ability if it has already moved this turn (Core Enforcer). */
      suppressIfMoved: z.literal(true).optional(),
      /** Ignores the target's ability (Sunsteel Strike). */
      ignoreAbility: z.literal(true).optional(),
      /** Counter and Mirror Coat (and Metal Burst for both): returns the damage the user took this turn, times this. */
      counter: z.enum(['physical', 'special', 'both']).optional(),
      /** Sets up something on a side of the field: screens, Tailwind, Safeguard on the user's side; hazards on the foe's. */
      sideMove: SideMoveSchema.optional(),
      /** Clears entry hazards: from the user's side (Rapid Spin) or both sides (Defog, Tidy Up). */
      clearHazards: z.enum(['self', 'both']).optional(),
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
      charge: z.object({ semi: SemiSchema.optional(), sunSkips: z.literal(true).optional(), grab: z.literal(true).optional(), boosts: z.array(StatChangeSchema).optional() }).optional(),
      /** Can hit a target hiding this way (Earthquake on Dig), doubling its power if `double`. */
      hitsSemi: z.object({ semi: SemiSchema, double: z.boolean() }).optional(),
      /** Attacks for 2–3 turns in a row, then the user becomes confused (Thrash). */
      lockIn: z.literal(true).optional(),
      /** Status move: sets the weather for 5 turns. */
      weather: WeatherSchema.optional(),
      /** Status move: sets the terrain for 5 turns (Electric, Grassy, Misty and Psychic Terrain). */
      terrain: TerrainSchema.optional(),
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
export const PlainAttributeSchema = z.enum(PLAIN_ATTRIBUTES);

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
  'eventsCompleted',
  /** Caught Pokémon added to the party (or swapped in), and caught Pokémon turned into candies. */
  'caughtKept',
  'caughtToCandies',
  /** Regions cleared with the starter still in the party. */
  'regionsClearedWithStarter',
  /** Stats your Pokémon raised on themselves with moves (Bulk Up, Nasty Plot...): one per stat raised. */
  'statsBoosted',
  /** Run Quests finished (the trainer's goal offered on the briefing screen). */
  'runQuestsDone',
  /** Raid dens and Totems beaten, and battles won against a rival. */
  'raidsWon',
  /** Pokémon swapped at a Trade Post. */
  'tradesMade',
  'totemsWon',
  'rivalBattlesWon',
  /** Holiday-event stops: clues found, event bosses beaten and event finales won (map events' "count" effect). */
  'eventClues',
  'eventBossesWon',
  'eventFinalesWon',
] as const;
/**
 * Also counted, by type: boss wins (gym leader, Elite Four, champion) by the lead Pokémon's type, as "bossWinsLead.<type>",
 * and enemy Pokémon defeated or caught, by each of their types, as "defeatedOrCaught.<type>".
 * Trainer unlock feats: "bossWinsMono.<type>" (a boss won while every Pokémon in the party has that type) and "bossWinsSolo" (a boss won with a one-Pokémon party).
 */
export const COUNTER_NAMES: readonly string[] = [
  ...BASE_COUNTER_NAMES,
  ...TYPE_NAMES.map((t) => `bossWinsLead.${t}`),
  ...TYPE_NAMES.map((t) => `defeatedOrCaught.${t}`),
  ...TYPE_NAMES.map((t) => `bossWinsMono.${t}`),
  'bossWinsSolo',
];
export const CounterNameSchema = z.string().refine((s) => COUNTER_NAMES.includes(s), { message: 'unknown counter' });

/**
 * A data-defined unlock requirement, shared by achievements and trainers:
 *   total       — a counter summed over every run
 *   best        — a counter's best value in a single run
 *   distinct    — how many different species have been seen or caught
 *   achievement — another achievement has been earned
 *   claim       — a claim-ledger key exists (e.g. a game event's reward, "event:spooky-season:reward")
 */
const LeafRequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('total'), counter: CounterNameSchema, atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('best'), counter: CounterNameSchema, atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('distinct'), set: z.enum(['speciesSeen', 'speciesCaught']), atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('achievement'), id: z.string() }),
  z.object({ kind: z.literal('claim'), key: z.string().min(1) }),
  /** A species caught at least once (any run). */
  z.object({ kind: z.literal('caught'), species: z.string().min(1) }),
]);
export const RequirementSchema = z.union([
  LeafRequirementSchema,
  /** Every part must be met (trainer unlock challenges). */
  z.object({ kind: z.literal('all'), parts: z.array(LeafRequirementSchema).min(2).max(4) }),
]);
export type LeafRequirement = z.infer<typeof LeafRequirementSchema>;
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

/** What a trainer quest step pays out, once (its claim key is `quest:<trainer>:<step>`). */
export const QuestRewardSchema = UnlockRewardSchema.extend({
  /** A Starter Laboratory set unlocked for free. */
  pool: z.string().optional(),
  /** The last step of a special trainer's line unlocks their Trainer Evolution. */
  evolution: z.boolean().default(false),
  /** A trainer unlocked for free (the Spooky pack's Hex Maniac). */
  trainer: z.string().optional(),
});
export type QuestReward = z.infer<typeof QuestRewardSchema>;

/**
 * One step of a trainer's quest line. Counters ("total", "best") count only
 * runs played as that trainer; steps are done in order, across runs.
 */
export const QuestStepSchema = z.object({
  /** What to do, in a few words. */
  goal: z.string().min(1),
  /** A line of story shown when the step is done. */
  story: z.string().min(1),
  requirement: RequirementSchema,
  reward: QuestRewardSchema,
});
export type QuestStep = z.infer<typeof QuestStepSchema>;

export const QuestLineSchema = z.object({
  trainerId: z.string(),
  name: z.string().min(1),
  steps: z.array(QuestStepSchema).length(5),
});
export type QuestLine = z.infer<typeof QuestLineSchema>;

/** A goal for one run, offered on the briefing screen; done when the run's counter reaches `atLeast`. */
export const RunQuestSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  counter: CounterNameSchema,
  atLeast: z.number().int().positive(),
  researchPoints: z.number().int().min(0),
});
export type RunQuest = z.infer<typeof RunQuestSchema>;

export const TrainerQuestsFileSchema = z.object({
  lines: z.array(QuestLineSchema),
  runQuests: z.array(RunQuestSchema).min(1),
});

export const ArchetypeModifierSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('xpMultiplier'), value: z.number().positive() }),
  z.object({ kind: z.literal('moneyMultiplier'), value: z.number().positive() }),
  z.object({ kind: z.literal('enemyLevelOffset'), value: z.number().int() }),
  z.object({ kind: z.literal('captureMultiplier'), value: z.number().positive() }),
  /** HP restored by healing items (Potion, Super Potion...). */
  z.object({ kind: z.literal('healingMultiplier'), value: z.number().positive() }),
  /** Shop price of the listed items, or of a whole group (Poké Balls, everything else, everything). */
  z.object({ kind: z.literal('priceMultiplier'), items: z.array(z.string()).min(1).optional(), group: z.enum(['balls', 'otherItems', 'all']).optional(), value: z.number().positive() }),
  /** Shop stock unlocks this many badges sooner (positive) or later (negative). */
  z.object({ kind: z.literal('shopUnlockOffset'), value: z.number().int() }),
  /** Damage dealt by your Pokémon of this type. */
  z.object({ kind: z.literal('typeDamageMultiplier'), type: TypeNameSchema, value: z.number().positive() }),
  /** Super-effective damage taken by your Pokémon of this type. */
  z.object({ kind: z.literal('weaknessDamageTakenMultiplier'), type: TypeNameSchema, value: z.number().positive() }),
  /** Friendship your Pokémon gain from battles. */
  z.object({ kind: z.literal('friendshipMultiplier'), value: z.number().positive() }),
  /** Research Points from new species, catches and shinies at the end of a run. */
  z.object({ kind: z.literal('researchMultiplier'), value: z.number().positive() }),
  /** The map shows what waits at nodes, like the preview items: wild Pokémon, trainers' teams, or the gym leader's team. */
  z.object({ kind: z.literal('preview'), what: z.enum(['wild', 'trainers', 'gymTeam']) }),
  /** Damage dealt by your Pokémon, filtered by their type and/or the move's category (Trainers.md perks). */
  z.object({ kind: z.literal('damageMultiplier'), type: TypeNameSchema.optional(), types: z.array(TypeNameSchema).min(1).optional(), category: z.enum(['physical', 'special']).optional(), speed: z.enum(['fast', 'slow']).optional(), legendary: z.boolean().optional(), ultraBeast: z.boolean().optional(), value: z.number().positive() }),
  /** Damage taken by your Pokémon: those of `type`, from moves of `moveType`, or from Legendary/Mythical/Ultra Beast attackers. */
  z.object({ kind: z.literal('damageTakenMultiplier'), type: TypeNameSchema.optional(), moveType: TypeNameSchema.optional(), fromLegendary: z.boolean().optional(), value: z.number().positive() }),
  /** A battle stat (or max HP) of your Pokémon, optionally only those of one type. */
  z.object({ kind: z.literal('statMultiplier'), stat: z.enum(['hp', 'atk', 'def', 'spa', 'spd', 'spe']), type: TypeNameSchema.optional(), value: z.number().positive() }),
  /** Experience for a group of Pokémon: of a type, not of a type, fast (base Speed 90+) or slow (base Speed 60-), or the starter. */
  z.object({ kind: z.literal('groupXpMultiplier'), type: TypeNameSchema.optional(), notType: TypeNameSchema.optional(), speed: z.enum(['fast', 'slow']).optional(), starter: z.boolean().optional(), ultraBeast: z.boolean().optional(), value: z.number().positive() }),
  /** Experience from ordinary (non-boss) battles only. */
  z.object({ kind: z.literal('ordinaryXpMultiplier'), value: z.number().positive() }),
  /** A Mega Evolved Pokémon with at least this much friendship stays Mega after the battle (Alain). */
  z.object({ kind: z.literal('permanentMega'), minFriendship: z.number().int().min(0) }),
  /** At most this many Pokémon in the party can be in a permanent Mega form. */
  z.object({ kind: z.literal('megaPartyLimit'), max: z.number().int().min(0) }),
  /** Damage multiplier for non-Mega Pokémon while a Mega Pokémon is in the party. */
  z.object({ kind: z.literal('nonMegaDamageMultiplier'), value: z.number().positive() }),
  /** Your starter knows its species' strongest same-type move from the start (Ash). */
  z.object({ kind: z.literal('starterSignatureMove') }),
  /** Friendship-based bonuses (Return, friendship Hyper moments) are switched off. */
  z.object({ kind: z.literal('friendshipBonusesDisabled') }),
  /** Your Pokémon below this share of their HP (0-1) deal more damage. */
  z.object({ kind: z.literal('lowHpDamageMultiplier'), below: z.number().positive().max(1), value: z.number().positive() }),
  /** Damage dealt to gym leaders, Elite Four members and champions. */
  z.object({ kind: z.literal('bossDamageMultiplier'), value: z.number().positive() }),
  /** Damage taken from gym leaders, Elite Four members and champions. */
  z.object({ kind: z.literal('bossDamageTakenMultiplier'), value: z.number().positive() }),
  /** Damage dealt to foes of a higher or lower level than your attacker. */
  z.object({ kind: z.literal('levelGapDamageMultiplier'), foe: z.enum(['higher', 'lower']), value: z.number().positive() }),
  /** Chance (0-1) that a fatal hit leaves your Pokémon (of `type`) at 1 HP, once per Pokémon per battle. */
  z.object({ kind: z.literal('survivalChance'), type: TypeNameSchema.optional(), chance: z.number().positive().max(1) }),
  /** How long statuses your Pokémon inflict last (sleep, confusion). */
  z.object({ kind: z.literal('statusDurationMultiplier'), value: z.number().positive() }),
  /** Extra turns of sleep or confusion on foes you inflict it on. */
  z.object({ kind: z.literal('statusDurationBonus'), turns: z.number().int().positive() }),
  /** Chance of your Pokémon's (of `type`) moves inflicting a status. */
  z.object({ kind: z.literal('statusChanceMultiplier'), type: TypeNameSchema.optional(), status: StatusIdSchema.optional(), value: z.number().positive() }),
  /** Extra turns of weather your side sets up. */
  z.object({ kind: z.literal('weatherTurnsBonus'), turns: z.number().int().positive() }),
  /** Damage boost in a weather: your moves in `weather` (side player) or the enemy's (side enemy). */
  z.object({ kind: z.literal('weatherDamageMultiplier'), weather: z.enum(['rain', 'sun']), side: z.enum(['player', 'enemy']), moveType: TypeNameSchema.optional(), value: z.number().positive() }),
  /** Multiplier on how often a group of wild Pokémon is offered. */
  z.object({ kind: z.literal('encounterWeightMultiplier'), group: z.enum(['legendary', 'rare']), value: z.number().positive() }),
  /** Chance of your Hyper moments. */
  z.object({ kind: z.literal('hyperChanceMultiplier'), value: z.number().positive() }),
  /** Pokémon evolve this many levels later (positive) or sooner. */
  z.object({ kind: z.literal('evolutionLevelOffset'), value: z.number().int() }),
  /** Your starting Pokémon begin the run this many levels higher (negative: lower). */
  z.object({ kind: z.literal('startingLevelOffset'), value: z.number().int() }),
  /** At the start of each region after the first, every party Pokémon changes by this many levels. */
  z.object({ kind: z.literal('regionLevelOffset'), value: z.number().int() }),
  /** Rivals are this many levels above you. */
  z.object({ kind: z.literal('rivalLevelOffset'), value: z.number().int() }),
  /** Start the run with this much of a run attribute (e.g. Luck). */
  z.object({ kind: z.literal('startingAttribute'), key: z.string(), value: z.number().int() }),
  /** At most this many Pokémon can be released per run. */
  z.object({ kind: z.literal('releaseLimit'), value: z.number().int().min(0) }),
  /** Room in the PC for spare Pokémon (deposit and withdraw on the map between battles). */
  z.object({ kind: z.literal('boxCapacity'), slots: z.number().int().positive() }),
  /** The party holds this many fewer (negative) or more Pokémon. */
  z.object({ kind: z.literal('partySizeOffset'), value: z.number().int() }),
  /** How many different items one Pokémon can hold changes by this much. */
  z.object({ kind: z.literal('itemSlotOffset'), value: z.number().int() }),
  /** Newly caught Pokémon start this many levels higher (negative: lower). */
  z.object({ kind: z.literal('catchLevelOffset'), value: z.number().int() }),
  /** Wild species of a type turn up less (or more) often. */
  z.object({ kind: z.literal('typeEncounterWeight'), type: TypeNameSchema, value: z.number().positive() }),
  /** Burn damage on foes you burn. */
  z.object({ kind: z.literal('burnDamageMultiplier'), value: z.number().positive() }),
  /** A stat bonus that only applies in a situation: while burned, or for Pokémon from a three-stage evolution line. */
  z.object({ kind: z.literal('conditionalStatMultiplier'), stat: z.enum(['atk', 'def', 'spa', 'spd', 'spe']), type: TypeNameSchema.optional(), when: z.enum(['burned', 'threeStageLine']), value: z.number().positive() }),
  /** Moves of a type cost extra PP. */
  z.object({ kind: z.literal('ppCostExtra'), type: TypeNameSchema, extra: z.number().int().positive() }),
  /** Rivals always carry a Pokémon of this type. */
  z.object({ kind: z.literal('rivalTeamType'), type: TypeNameSchema }),
  /** Rivals counter this many more of your Pokémon on a return. */
  z.object({ kind: z.literal('rivalCounterBonus'), count: z.number().int().positive() }),
  /** Chance of the opposing side's Hyper moments (rival Hyper/Overdrive events). */
  z.object({ kind: z.literal('enemyHyperChanceMultiplier'), value: z.number().positive() }),
  /** The Pokémon that fought first in a battle deals more damage, every later one less. */
  z.object({ kind: z.literal('battleOrderDamage'), first: z.number().positive(), later: z.number().positive() }),
  /** Pokémon of a type recover this share of max HP each turn in a weather. */
  z.object({ kind: z.literal('weatherHeal'), type: TypeNameSchema, weather: z.enum(['rain', 'sun']), percent: z.number().positive() }),
  /** Damage dealt by your starter (starter: true) or by everyone else (false). */
  z.object({ kind: z.literal('starterDamageMultiplier'), starter: z.boolean(), value: z.number().positive() }),
  /** Damage your Pokémon deal to foes of a type (a signature choice, e.g. Rival's Answer). */
  z.object({ kind: z.literal('damageVsTypeMultiplier'), foeType: TypeNameSchema, value: z.number().positive() }),
  /** Wild species whose highest base stat is `stat` turn up more or less often. */
  z.object({ kind: z.literal('statEncounterWeight'), stat: StatNameSchema, value: z.number().positive() }),
  /** Mega Evolved Pokémon of yours take more damage. */
  z.object({ kind: z.literal('megaDamageTakenMultiplier'), value: z.number().positive() }),
  /** Your side's first attack in a battle deals `first`× damage, every later attack `later`×. */
  z.object({ kind: z.literal('firstAttackDamage'), first: z.number().positive(), later: z.number().positive() }),
  /** Damage dealt by your Pokémon that are holding an item (holding: true) or not holding one (false). */
  z.object({ kind: z.literal('heldItemDamageMultiplier'), holding: z.boolean(), value: z.number().positive() }),
  /** Held-item bonuses on your Pokémon (stats, damage boosts, healing, draining) are this much stronger. */
  z.object({ kind: z.literal('heldEffectMultiplier'), value: z.number().positive() }),
  /** After each won battle, every conscious party Pokémon recovers this share of its max HP. */
  z.object({ kind: z.literal('postBattleHeal'), percent: z.number().positive() }),
  /** Rare and epic rewards turn up this much more often in reward drafts. */
  z.object({ kind: z.literal('rareItemWeight'), value: z.number().positive() }),
  /** Critical-hit damage: your Pokémon's crits (side player) or the crits they take (side enemy). */
  z.object({ kind: z.literal('critDamageMultiplier'), side: z.enum(['player', 'enemy']), value: z.number().positive() }),
  /** Damage dealt by your Mega Evolved Pokémon. */
  z.object({ kind: z.literal('megaDamageMultiplier'), value: z.number().positive() }),
  /** Damage dealt by your Z-Moves. */
  z.object({ kind: z.literal('zMoveDamageMultiplier'), value: z.number().positive() }),
  /** Your Z-Move can only be used after this many turns of the battle. */
  z.object({ kind: z.literal('zMoveDelay'), turns: z.number().int().positive() }),
  /** Damage dealt by multi-target (spread: true) or single-target (false) moves. */
  z.object({ kind: z.literal('spreadMoveDamageMultiplier'), spread: z.boolean(), value: z.number().positive() }),
  /** Pokémon of a type recover this share of max HP at the end of every turn. */
  z.object({ kind: z.literal('turnHeal'), type: TypeNameSchema, percent: z.number().positive() }),
  /** HP restored by healing moves your Pokémon use. */
  z.object({ kind: z.literal('healingMoveMultiplier'), value: z.number().positive() }),
  /** Burn damage on your own Pokémon. */
  z.object({ kind: z.literal('burnDamageTakenMultiplier'), value: z.number().positive() }),
  /** Damage dealt by the first or last Pokémon in your party order. */
  z.object({ kind: z.literal('partyPositionDamage'), position: z.enum(['first', 'last']), value: z.number().positive() }),
  /** Prize money from gym leaders, Elite Four members and champions. */
  z.object({ kind: z.literal('bossMoneyMultiplier'), value: z.number().positive() }),
  /** Prize money from double battles. */
  z.object({ kind: z.literal('doubleBattleRewardMultiplier'), value: z.number().positive() }),
  /** Accuracy of your status moves. */
  z.object({ kind: z.literal('statusMoveAccuracy'), value: z.number().positive() }),
  /** This many more locked shop entries are for sale early. */
  z.object({ kind: z.literal('shopEarlyStock'), count: z.number().int().positive() }),
  /** Damage taken by a Pokémon on its first turn after it enters battle (switching in). */
  z.object({ kind: z.literal('switchGuard'), value: z.number().positive() }),
  /** Damage dealt by a Pokémon that has been out for at least a full turn. */
  z.object({ kind: z.literal('stayingDamageMultiplier'), value: z.number().positive() }),
  /** Prize money from champion battles. */
  z.object({ kind: z.literal('championMoneyMultiplier'), value: z.number().positive() }),
  /** Prize money from ordinary (non-boss) battles. */
  z.object({ kind: z.literal('ordinaryMoneyMultiplier'), value: z.number().positive() }),
  /** Chance of critical hits by your Pokémon. */
  z.object({ kind: z.literal('critChanceMultiplier'), value: z.number().positive() }),
  /** Friendship-based bonuses (Return power, friendship Hyper moments) count friendship this much higher. */
  z.object({ kind: z.literal('friendshipBonusMultiplier'), value: z.number().positive() }),
  /** Damage dealt by super-effective hits of your Pokémon. */
  z.object({ kind: z.literal('superEffectiveDamageMultiplier'), value: z.number().positive() }),
  /** Damage your Pokémon take from super-effective hits. */
  z.object({ kind: z.literal('superEffectiveTakenMultiplier'), value: z.number().positive() }),
  /** Poison damage on foes you poison. */
  z.object({ kind: z.literal('poisonDamageMultiplier'), value: z.number().positive() }),
  /** Your Pokémon (of `type`) are harder to hit: enemy accuracy against them is divided by this. */
  z.object({ kind: z.literal('evasionMultiplier'), type: TypeNameSchema.optional(), value: z.number().positive() }),
  /** Damage dealt to foes with a status condition (burn, poison, sleep...). */
  z.object({ kind: z.literal('statusedFoeDamageMultiplier'), value: z.number().positive() }),
  /** Encore!: critical hits build Hype; at `needed` Hype your active Pokémon deals `damage`× for `turns` turns; a miss or failed move costs `missPenalty` Hype; Hype resets after each boss battle. */
  z.object({ kind: z.literal('hypeMeter'), needed: z.number().int().positive(), damage: z.number().positive(), turns: z.number().int().positive(), missPenalty: z.number().int().min(0) }),
  /** Every third boss you face is this many levels higher (Meteor's Prophecy). */
  z.object({ kind: z.literal('thirdBossLevels'), value: z.number().int().positive() }),
  /** Elite Four members are this many levels higher (negative: lower). */
  z.object({ kind: z.literal('eliteLevelOffset'), value: z.number().int() }),
  /** Foes can't heal with moves, drains or healing effects. */
  z.object({ kind: z.literal('enemyHealingBlocked') }),
  /** Mega Evolution happens this many turns later than normal. */
  z.object({ kind: z.literal('megaDelay'), turns: z.number().int().positive() }),
  // ---------- Trainer Evolutions (core/trainerEvolution.ts): each evolved trainer's own mechanic ----------
  /** Champion Red's Last Stand: once per battle, your last Pokémon standing survives a knockout hit at 1 HP. */
  z.object({ kind: z.literal('championLastStand') }),
  /** Champion Blue's Smell Ya Later: on the first turn of a trainer battle your Pokémon moves before the foe's same-priority move. */
  z.object({ kind: z.literal('firstStrike') }),
  /** Champion Cynthia's Champion's Aura: at the start of a boss battle your lead's best stat rises by `stages`. */
  z.object({ kind: z.literal('championsAura'), stages: z.number().int().min(1).max(6) }),
  /** Rocket Boss Giovanni's Black Market: shops also sell stock your badges haven't opened yet, at `markup` times the price. */
  z.object({ kind: z.literal('blackMarket'), markup: z.number().min(1) }),
  /** King N's Voice of Pokémon: a wild Pokémon you defeat asks to join with this chance (no ball needed). */
  z.object({ kind: z.literal('voiceOfPokemon'), chance: z.number().positive().max(1) }),
  /** Added to the chance of a critical hit for your Pokémon (0.1 = 10 percentage points). */
  z.object({ kind: z.literal('critChanceBonus'), value: z.number().positive().max(1) }),
  /** Prize money after catching a wild Pokémon. */
  z.object({ kind: z.literal('catchMoneyMultiplier'), value: z.number().positive() }),
  /** Damage dealt to a foe of the same species as the attacker (N). */
  z.object({ kind: z.literal('sameSpeciesDamageMultiplier'), value: z.number().positive() }),
  /** Damage of Agile-style (fast, light: priority moves and power 60 or less) or Strong-style (power 90 or more) moves (Rei). */
  z.object({ kind: z.literal('moveStyleDamage'), style: z.enum(['agile', 'strong']), value: z.number().positive() }),
  /** Food (Berries and Honey) bought as map items lasts this much longer, rounded up (Mallow). */
  z.object({ kind: z.literal('foodDurationMultiplier'), value: z.number().positive() }),
  /** Fishing offers pick the strongest of this many more tries at each choice, so rare Pokémon turn up more often (Lana). */
  z.object({ kind: z.literal('fishingRareTries'), tries: z.number().int().positive() }),
  /** Every won battle has this chance (0-1) of one more reward choice (Looker). */
  z.object({ kind: z.literal('bonusRewardChance'), chance: z.number().positive().max(1) }),
  /** Each stage has this chance (0-1) of a hidden Bag item at one wild stop, with no Itemfinder needed (Looker). */
  z.object({ kind: z.literal('hiddenItemChance'), chance: z.number().positive().max(1) }),
  /** Damage of moves with one of these flags (dance and sound moves, punches...). */
  z.object({ kind: z.literal('moveFlagDamage'), flags: z.array(z.enum(['sound', 'punch', 'bite', 'pulse', 'bullet', 'slicing', 'wind', 'contact', 'dance'])).min(1), value: z.number().positive() }),
  /** Pokémon with an unusual type pairing or ability deal `unusual`× damage; those with a very common ability deal `common`×. */
  z.object({ kind: z.literal('unusualDamageMultiplier'), unusual: z.number().positive(), common: z.number().positive() }),
  /** Damage dealt once your side has defeated an enemy in the same battle. */
  z.object({ kind: z.literal('afterKoDamageMultiplier'), value: z.number().positive() }),
  /** Champion Oak's Field Research: each species you catch for the first time in a run pays this much money. */
  z.object({ kind: z.literal('fieldResearch'), money: z.number().int().positive() }),
  /** Spooky pack (Hex Maniac, Spooky Season): this share of wild Pokémon turn into Spooky forms (added to Spooky mode's share). */
  z.object({ kind: z.literal('spookyEncounters'), chance: z.number().positive().max(1) }),
  /** A game event's own map stops (e.g. the Spooky pack's) appear in this trainer's runs all year. */
  z.object({ kind: z.literal('eventStops'), gameEvent: z.string().min(1) }),
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
  /** Difficulty of the unlock challenge, 1 (easy) to 5 (Champion-hard); set from trainerUnlocks.json. */
  unlockTier: z.number().int().min(1).max(5).optional(),
  /** A line of the trainer's voice shown with the challenge. */
  unlockFlavor: z.string().optional(),
  /** "supported" = the exact feat runs; "limited" = approximated with the closest counter (see the file's note). */
  unlockStatus: z.enum(['supported', 'limited']).optional(),
  /** False for trainers whose passives need systems that don't exist yet; shown as "coming later". */
  available: z.boolean().default(true),
  spriteAssetId: z.string(),
  modifiers: z.array(ArchetypeModifierSchema),
  /** Items added to the Bag at the start of a run (a signature preparation). */
  startingItems: z.record(z.string(), z.number().int().positive()).default({}),
  // ---------- identity (Untitled doc §11) ----------
  /** The trainer's types, shown on the Trainer Archive and the Run Build Summary. */
  signatureTypes: z.array(TypeNameSchema).max(2).default([]),
  /** Species (any stage) more likely among the three starters, never forced. */
  signatureSpecies: z.array(z.string()).default([]),
  /** The trainer's own starter set in the Starter Laboratory. */
  signaturePool: z.string().nullable().default(null),
  /** Tags events and dialogue can react to (e.g. "pacifist" closes aggressive event choices). */
  eventTags: z.array(z.string()).default([]),
  /** The trainer's signature mechanic (core/signature.ts), if any. */
  signatureMechanic: z.string().nullable().default(null),
  /**
   * A Trainer Evolution (plan Part 2c): the base trainer this is the evolved form of. It unlocks when the
   * base trainer's quest line is finished, and runs count toward the base trainer's quests.
   */
  evolvedFrom: z.string().nullable().default(null),
});
export type Archetype = z.infer<typeof ArchetypeSchema>;

// ---------- Run-Prep (GAME_DESIGN.md §14.5, §14.7) ----------

/**
 * A pool of starters for the Starter Laboratory. Species that aren't in the
 * game yet are skipped, so a pool can list species ahead of the full Pokédex;
 * a pool with too few known first-stage species shows as "coming later".
 */
export const STARTER_POOL_CATEGORIES = ['classic', 'region', 'type', 'role', 'trainer', 'evilTeam', 'league', 'spinOff', 'research', 'rare', 'event'] as const;
export type StarterPoolCategory = (typeof STARTER_POOL_CATEGORIES)[number];

export const StarterPoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  /** The Starter Laboratory groups pools by category. */
  category: z.enum(STARTER_POOL_CATEGORIES).default('classic'),
  /** Listed species; an evolved one stands for its first stage (Charizard means Charmander). */
  species: z.array(z.string()).default([]),
  /** Adds the signature Pokémon of these bosses (as first stages). */
  bosses: z.array(z.string()).default([]),
  /** Adds every starter-eligible species of these types, or native to this region. */
  filter: z.object({ types: z.array(TypeNameSchema).optional(), region: z.string().optional() }).optional(),
  unlockedByDefault: z.boolean().default(false),
  /** What must happen before the pool can be bought (null: nothing). */
  unlock: RequirementSchema.nullable().default(null),
  unlockText: z.string().default(''),
  /** A Bank license that must be owned before the pool can be bought. */
  license: z.string().nullable().default(null),
  /** Research Points to unlock the pool. */
  researchCost: z.number().int().min(0).default(0),
  /** The "Mastered" set: its species are the ones you raised to Silver mastery or better (core/mastery.ts). */
  mastered: z.boolean().default(false),
  /** An earned set that may hold special forms (Spooky forms...), which every other pool leaves out (core/specialForms.ts). */
  specialForms: z.boolean().default(false),
}).refine((p) => p.species.length > 0 || p.bosses.length > 0 || p.filter !== undefined || p.mastered, { message: 'a starter pool needs species, bosses, a filter or mastered' });
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
  /** A ball. `rule` adds a condition to `multiplier` (see ballBonus in battle/engine.ts); `after` changes the caught Pokémon. */
  z.object({
    kind: z.literal('catch'),
    multiplier: z.number().positive(),
    rule: z.enum(['level', 'lure', 'dive', 'net', 'moon', 'love', 'heavy', 'fast', 'nest', 'repeat', 'timer', 'quick', 'dusk']).optional(),
    after: z.enum(['friend', 'luxury', 'heal']).optional(),
  }),
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
  /** Battle-only "urge" items on the Pokémon in battle: trigger its ability now, use its held Berry or Herb now, or reset its stat changes. */
  z.object({ kind: z.literal('urge'), what: z.enum(['ability', 'item', 'reset']) }),
  /** Makes the opposing Pokémon drop its held item for the rest of the battle (Item Drop). */
  z.object({ kind: z.literal('itemDrop') }),
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
  /** Reflect, Light Screen and Aurora Veil the holder sets last longer (Light Clay). */
  z.object({ hook: z.literal('lightClay'), turns: z.number().int().positive() }),
  /** When hit, the attacker is forced out, once per battle (Red Card). */
  z.object({ hook: z.literal('redCard') }),
  /** When hit, the holder switches out, once per battle (Eject Button). */
  z.object({ hook: z.literal('ejectButton') }),
  /** A Taunt on the holder is cured at once, once per battle (Mental Herb). */
  z.object({ hook: z.literal('mentalHerb') }),
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
  /** The holder can't get these statuses (Lunar Wing: sleep). */
  /** Takes no damage from these weathers (Go-Goggles: sandstorm). */
  z.object({ hook: z.literal('weatherImmune'), weathers: z.array(WeatherSchema).min(1) }),
  /** Once per battle, wakes the whole team at the end of a turn (Poké Flute). */
  z.object({ hook: z.literal('wakeAll') }),
  z.object({ hook: z.literal('statusImmune'), statuses: z.array(StatusIdSchema).min(1) }),
  /** While held, this species takes another form in battle (Griseous Orb, Gracidea). */
  z.object({ hook: z.literal('formHeld'), from: z.string(), to: z.string() }),
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
  z.object({ kind: z.literal('immune'), status: z.enum(['brn', 'psn', 'par', 'slp', 'frz', 'confusion', 'infatuation']) }),
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
  /** Catching the wild Pokémon also drops a cheap Bag item (Pinap Berry). */
  z.object({ mod: z.literal('drop') }),
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
  // ---------- extra map stops (slice 3b-3) ----------
  /** Each stage gets a fishing spot; fishing shows `choices` Pokémon to pick from, the last one stronger with `rare` (Rods). */
  z.object({ perk: z.literal('fishing'), choices: z.number().int().min(1).max(3), rare: z.boolean() }),
  /** An extra stop beside a node: somewhere on the stage when it starts (Wave, Tropic and Harbor Mail), or at the next node the player moves to (Bridge Mail). */
  z.object({ perk: z.literal('extraStop'), kind: z.enum(['heal', 'shop', 'fish', 'event']), where: z.enum(['stage', 'nextNode']) }),
  /** Every hidden "?" stop shows what it is (Silph Scope). */
  z.object({ perk: z.literal('revealEvents') }),
  /** The next event shows each choice's odds and outcome before you choose (Inquiry Mail). */
  z.object({ perk: z.literal('eventInsight') }),
  /** Key items and tickets: holding one opens its event stop (events.json `keyItem`). */
  z.object({ perk: z.literal('eventKey') }),
  /** Tidal Bell, Clear Bell: this legendary is chosen whenever an event could offer it. */
  z.object({ perk: z.literal('favorSpecies'), species: z.string() }),
  /** Pal Pad: the first Pokémon caught each stage joins with this many extra levels. */
  /** X-Transceiver: once per stage, from the Items menu, call home and heal the whole team by a share. */
  z.object({ perk: z.literal('transceiver'), heal: z.number().positive().max(1) }),
  /** Wailmer Pail, Sprayduck: once per stage, from the Items menu, tend a Pokémon (friendship) or cool one down (Peace). */
  z.object({ perk: z.literal('pail'), friendship: z.number().int().positive() }),
  z.object({ perk: z.literal('sprayduck'), peace: z.number().int().positive() }),
  /** Squirtbottle: once per stage, from the Items menu, the lead gains extra EXP from the next battle. */
  z.object({ perk: z.literal('squirt'), percent: z.number().positive() }),
  /** VS Recorder: losing a trainer battle replays it from the start, once per run. */
  z.object({ perk: z.literal('vsRecorder') }),
  /** GB Sounds: the battle music plays in the Game Boy style. */
  z.object({ perk: z.literal('gbSounds') }),
  /** Journal: the run's full map is recorded with the run history. */
  z.object({ perk: z.literal('journal') }),
  /** Seal Case: catching a Pokémon shows a special effect and gives Luck. */
  z.object({ perk: z.literal('sealCase'), luck: z.number().int().positive() }),
  /** Seal Bag: items sell for their full shop price instead of half. */
  z.object({ perk: z.literal('fullSell') }),
  z.object({ perk: z.literal('palPad'), levels: z.number().int().positive() }),
  /** Prop Case: Contest stops give double Charisma. */
  z.object({ perk: z.literal('doubleContest') }),
  /** Explorer Kit: every finished event stop gives one more item. */
  z.object({ perk: z.literal('eventBonus') }),
  /** The next trainer's reward draft uses the gym leader's odds (Bridge Mail S). */
  z.object({ perk: z.literal('betterDraft') }),
  // ---------- draft items (slice 3b-3b) ----------
  /** Each stage's first reward draft shows one extra choice (Dowsing Machine). */
  z.object({ perk: z.literal('dowsing') }),
  /** The reward draft after each trainer win shows one extra choice (Bloom Mail). */
  z.object({ perk: z.literal('extraChoice') }),
  /** From the reward screen: swap one draft choice for a new one (Cornn Berry). */
  z.object({ perk: z.literal('rerollOne') }),
  /** From the reward screen: a choice you lock comes back in the next draft too (Lock Capsule). */
  z.object({ perk: z.literal('lockOne') }),
  /** The best reward you skip in the next draft comes back in the one after (Favored Mail). */
  z.object({ perk: z.literal('favored') }),
  /** The first ordinary trainer of the stage is a rival: its team is stronger, and beating it gives a draft with gym odds and one more choice (RSVP Mail). */
  z.object({ perk: z.literal('rival'), levelBonus: z.number().int().min(0) }),
  /** TMs offer this many more moves to pick from (TM Case). */
  z.object({ perk: z.literal('tmChoices'), extra: z.number().int().positive() }),
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
    passive: z.enum(['money', 'trainerMoney', 'expShare', 'gymInterest', 'newSpeciesLove', 'stageCharisma', 'catchUpExp', 'berrySave', 'berryHeal', 'berryPinch', 'berryMoney', 'berryPeace', 'feedFriendship', 'feedCharisma', 'berryPots', 'berryPotsExtra', 'apricornBox']),
    percent: z.number().positive(),
  }),
  /** The fossil's Pokémon joins the party (or is released, like a catch). */
  z.object({ kind: z.literal('fossil'), species: z.string() }),
  /** Mystery Egg: hatches after this many stages into a random first-stage Pokémon (shiny chance times `shiny`). */
  z.object({ kind: z.literal('egg'), stages: z.number().int().positive(), shiny: z.number().positive() }),
  /** Goes into the Bag (items.json `item`) to be used in battle or from the map. */
  z.object({ kind: z.literal('bagItem'), item: z.string(), count: z.number().int().positive().default(1) }),
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

export const TrainerAiSchema = z.object({
  /** A smart trainer (a boss) heals once its Pokémon is under this share of its max HP. */
  healBelow: z.number().min(0).max(1),
  /** The share of max HP a trainer's potion restores. */
  healFraction: z.number().positive().max(1),
  /** Potions a smart trainer may use in one battle. */
  maxItems: z.number().int().min(0),
  /** Times a smart trainer may swap its Pokémon out on purpose in one battle. */
  maxSwitches: z.number().int().min(0),
  /** It swaps when its best move is worth less than this share of the best a teammate has. */
  switchRatio: z.number().positive().max(1),
});

export const EVENT_RARITIES = ['common', 'uncommon', 'rare', 'epic'] as const;
export type EventRarity = (typeof EVENT_RARITIES)[number];

export const BalanceSchema = z.object({
  trainerAi: TrainerAiSchema,
  /** Double battles: the chance an ordinary trainer fights two at a time, from this stage number (0 = the first stage). */
  doubles: z.object({ chance: z.number().min(0).max(1), fromStage: z.number().int().min(0) }).default({ chance: 0.3, fromStage: 1 }),
  partyMax: z.number().int().positive(),
  starterLevel: z.number().int().positive(),
  starterChoices: z.number().int().positive(),
  /** The chance a trainer's signature species takes the last starter slot when none was drawn (own RNG stream). */
  signatureStarterChance: z.number().min(0).max(1),
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
  /** Abilities (M8.75 part C3): the chance a new Pokémon has its hidden ability instead of a normal one. */
  abilities: z.object({ hiddenChance: z.number().min(0).max(1) }),
  /**
   * Species Mastery (core/mastery.ts): battles needed for Bronze, Silver (when it can't evolve) and Gold,
   * and the Research Points each rank pays once.
   */
  /** The Research Directive (plan Part 5): defeat or catch this many of the studied type for these Research Points. */
  directive: z.object({ target: z.number().int().min(1), researchPoints: z.number().int().min(0) }),
  mastery: z.object({
    bronzeBattles: z.number().int().min(1),
    silverBattles: z.number().int().min(1),
    goldBattles: z.number().int().min(1),
    rankResearch: z.object({ bronze: z.number().int().min(0), silver: z.number().int().min(0), gold: z.number().int().min(0), master: z.number().int().min(0) }),
  }),
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
  /** Map events ("?" stops): how many per stage, how many hidden, and how checks and rarities work. */
  events: z.object({
    perStage: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    hiddenShare: z.number().min(0).max(1),
    rarityWeights: z.record(z.enum(EVENT_RARITIES), z.number().min(0)),
    /** Events of the stage's theme types are this many times as likely. */
    themeWeight: z.number().min(1),
    /** Check chance: base% + 1% per attribute point, between min% and max%. */
    checkBase: z.number(),
    checkMin: z.number(),
    checkMax: z.number(),
    /** Intelligence at or above this reveals one hidden stop per stage. */
    revealIntelligence: z.number().int(),
    /** Money for an event gift nobody can take (a held item with no free holder, or one you hold the most of). */
    soldGift: z.number().int().min(0),
    /** Rest spots (stop "rest") placed on every stage. */
    restPerStage: z.number().int().min(0),
    /** Prize money per level of the top Pokémon for an event's trainer (one with no trainer class). */
    trainerMoneyPerLevel: z.number().int().min(0),
    /** Items the Explorer Kit can turn up. */
    explorerItems: z.array(z.string()).min(1),
    /** Map events a running game event features (gameEvents.json mapEvents) are this many times as likely. */
    gameEventWeight: z.number().min(1),
  }),
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
    /** Early-game bands: the largest team in each of the run's first stages (stage 1: 1 Pokémon, then 2–4). Later stages use maxSize. */
    earlyCaps: z.array(z.number().int().min(1).max(6)).default([]),
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
  /** The gentle opening: for the first `encounters` fights of a run, wild Pokémon above `maxBaseStats` are swapped for weaker ones and are `levelOffset` levels lower (never below `minLevel`). */
  opening: z.object({ encounters: z.number().int().min(0), maxBaseStats: z.number().int().positive(), levelOffset: z.number().int().min(0), minLevel: z.number().int().min(1), softMovesUntilLevel: z.number().int().min(0) }),
  /** Chance that a wild encounter is a Legendary, Mythical or Ultra Beast (trainer perks scale it). */
  legendaryWildChance: z.number().min(0).max(1),
  /** The first region index (0 = first) where such encounters can appear. */
  legendaryMinRegion: z.number().int().min(0),
  /** How many different items one Pokémon can hold (trainer perks change it). */
  heldItemSlots: z.number().int().positive(),
  /** Wild species with at least this base stat total count as rare (trainer perks make them turn up more or less). */
  rareEncounterBst: z.number().int().positive(),
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
  /**
   * "A Past Pokémon Wants to Join" (story slice 5): how many past Pokémon the profile keeps, the chance a run
   * has a reunion, the battles (won) before it comes, its friendship (more if it won a past run with you),
   * how much likelier Hall of Fame Pokémon are to come back, and the keepsake's candies (times a release's).
   */
  reunion: z.object({
    archiveSize: z.number().int().min(1),
    chance: z.number().min(0).max(1),
    afterEncounters: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
    friendship: z.number().int().min(0).max(255),
    hallOfFameFriendship: z.number().int().min(0).max(255),
    hallOfFameWeight: z.number().min(0),
    keepsakeCandyMultiplier: z.number().int().min(1),
  }),
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
  terrain: TerrainSchema.optional(),
  /** Heals the user this fraction of its max HP after the hit (G-Max Finale). */
  heal: z.number().positive().max(1).optional(),
  /** Cures the user's status after the hit (G-Max Sweetness). */
  cureUser: z.literal(true).optional(),
  /** Inflicts one of these statuses on the target after the hit, picked at random (G-Max Stun Shock, Befuddle). */
  randomStatus: z.array(StatusIdSchema).min(1).optional(),
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

// ---------- map events ("?" stops; plans/events-and-map-stops-plan) ----------

/** The one signature animation each event scene plays. */
export const EVENT_EFFECTS = ['none', 'rattle', 'spin', 'flicker', 'glint', 'shake', 'float', 'net', 'rain', 'sparkle', 'fog', 'fire', 'snow', 'hearts'] as const;

/** Something an event or one of its choices needs; a locked choice stays visible with its requirement. */
export const EventConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('money'), atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('partySize'), atLeast: z.number().int().min(1).max(6) }),
  z.object({ kind: z.literal('attribute'), key: AttributeKeySchema, atLeast: z.number().int() }),
  /** A meter leaning one way: Rage (positive ragePeace) / Peace (negative), Good (positive goodEvil) / Evil (negative). */
  z.object({ kind: z.literal('meter'), key: z.enum(['ragePeace', 'goodEvil']), side: z.enum(['positive', 'negative']), atLeast: z.number().int().min(0) }),
  z.object({ kind: z.literal('item'), id: z.string() }),
  z.object({ kind: z.literal('partyType'), type: TypeNameSchema }),
  /** A species in the party. */
  z.object({ kind: z.literal('partySpecies'), species: z.string() }),
  /** An event that has already been played this run. */
  z.object({ kind: z.literal('eventSeen'), id: z.string() }),
  /** The trainer must not carry this tag (N is "pacifist": no aggressive choices). */
  z.object({ kind: z.literal('noTrainerTag'), tag: z.string() }),
]);
export type EventCondition = z.infer<typeof EventConditionSchema>;

/** One thing an outcome does. `share` is a fraction of max HP. */
export const EventEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('money'), amount: z.number().int() }),
  z.object({ kind: z.literal('item'), id: z.string(), count: z.number().int().positive().default(1) }),
  /** One of these items, picked by the event's roll. */
  z.object({ kind: z.literal('itemFrom'), ids: z.array(z.string()).min(1), count: z.number().int().positive().default(1) }),
  /** A random item from the Bag is lost (never a key item). */
  z.object({ kind: z.literal('loseItem'), id: z.string().optional() }),
  /** A healing spot, shop or fishing spot opens beside this node. */
  z.object({ kind: z.literal('addStop'), stop: z.enum(['heal', 'shop', 'fish']) }),
  /** A ferry: jump to a node next to the gym (SS Ticket). */
  z.object({ kind: z.literal('skipAhead') }),
  z.object({ kind: z.literal('heal'), share: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('damage'), share: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('cure') }),
  z.object({ kind: z.literal('status'), status: z.enum(['poison', 'burn', 'paralysis', 'sleep']) }),
  z.object({ kind: z.literal('friendship'), amount: z.number().int(), who: z.enum(['lead', 'party']).default('party') }),
  z.object({ kind: z.literal('attribute'), key: AttributeKeySchema, amount: z.number().int() }),
  /** Research Points, paid at the end of the run. */
  z.object({ kind: z.literal('research'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('levels'), amount: z.number().int().positive(), who: z.enum(['lead', 'party']).default('lead') }),
  /** A Pokémon joins (or goes to storage when the party is full): a listed species, or one of the types, or the stage's theme. */
  z.object({ kind: z.literal('join'), species: z.array(z.string()).default([]), types: z.array(TypeNameSchema).default([]), levelBonus: z.number().int().default(0), shinyMultiplier: z.number().min(1).default(1) }),
  /** The next reward draft uses the gym leader's odds and offers `extra` more choices. */
  z.object({ kind: z.literal('betterDraft'), extra: z.number().int().min(0).default(0) }),
  /** The map shows this stage's gym leader's whole team. */
  z.object({ kind: z.literal('gymPreview') }),
  /** Every hidden "?" stop on this stage shows what it is. */
  z.object({ kind: z.literal('revealStops') }),
  /** A party member changes form for good (Therian Forme, Black Kyurem...); `consume` is another species that leaves the party for it. */
  z.object({ kind: z.literal('formChange'), from: z.string(), to: z.string(), consume: z.string().optional() }),
  /** Adds to a run counter: a holiday event's clue, boss or finale (game event objectives count these). */
  z.object({ kind: z.literal('count'), counter: z.enum(['eventClues', 'eventBossesWon', 'eventFinalesWon']), amount: z.number().int().positive().default(1) }),
]);
export type EventEffect = z.infer<typeof EventEffectSchema>;

/** A battle an outcome starts; `win` effects apply only if you win it. Wild Pokémon can be caught. */
export const EventBattleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('wild'),
    species: z.array(z.string()).default([]),
    types: z.array(TypeNameSchema).default([]),
    levelBonus: z.number().int().default(0),
    shinyMultiplier: z.number().min(1).default(1),
    win: z.array(EventEffectSchema).default([]),
  }),
  z.object({
    kind: z.literal('trainer'),
    /** A trainer class from trainers.json, or a boss id (its signature team). */
    classId: z.string().optional(),
    bossId: z.string().optional(),
    name: z.string(),
    size: z.number().int().min(1).max(6).default(2),
    types: z.array(TypeNameSchema).default([]),
    levelBonus: z.number().int().default(0),
    win: z.array(EventEffectSchema).default([]),
  }),
]);
export type EventBattle = z.infer<typeof EventBattleSchema>;

export const EventOutcomeSchema = z.object({
  text: z.string(),
  effects: z.array(EventEffectSchema).default([]),
  battle: EventBattleSchema.optional(),
});
export type EventOutcome = z.infer<typeof EventOutcomeSchema>;

export const EventChoiceSchema = z.object({
  label: z.string().min(1),
  requires: z.array(EventConditionSchema).default([]),
  /** An attribute check: success chance = base% + 1% per point, clamped (balance.events). */
  check: PlainAttributeSchema.optional(),
  /** A plain chance of success (0–1), for luck rolls without an attribute. */
  chance: z.number().min(0).max(1).optional(),
  success: EventOutcomeSchema,
  /** What happens when the check or chance fails (needed when there is one). */
  failure: EventOutcomeSchema.optional(),
});
export type EventChoice = z.infer<typeof EventChoiceSchema>;

export const EventSceneSchema = z.object({
  /** Asset ids of the people in the scene ("trainer.hiker", "boss.giovanni"). */
  cast: z.array(z.string()).max(3).default([]),
  /** A Pokémon shown in the scene. */
  pokemon: z.string().optional(),
  /** Backdrop tint as "#rrggbb". */
  tint: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  effect: z.enum(EVENT_EFFECTS).default('none'),
});

// ---------- game events (Untitled doc §17, plan Part 4b): weekly and holiday events ----------

/** One milestone of a game event, counted over the runs started while it is on. */
export const GameEventObjectiveSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  counter: CounterNameSchema,
  atLeast: z.number().int().positive(),
  reward: QuestRewardSchema,
});
export type GameEventObjective = z.infer<typeof GameEventObjectiveSchema>;

/** A month and day, "MM-DD" (UTC). */
const MonthDaySchema = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

/**
 * A timed account event (Untitled doc §17.4). Weekly events rotate by ISO week; holiday and themed
 * events come back every year between two dates. Every run started while one is on plays by its
 * rules and counts toward its objectives. Rewards use claim keys, so nothing pays twice.
 */
export const GameEventSchema = z.object({
  id: z.string().min(1),
  /** Bumped when the definition changes; a reward already earned is never taken back. */
  version: z.number().int().min(1),
  name: z.string().min(1),
  kind: z.enum(['weekly', 'holiday', 'themed']),
  description: z.string().min(1),
  /** Weekly: one of the rotation, chosen by ISO week. Yearly: on between two dates (inclusive, may wrap the new year). */
  schedule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('weeklyRotation') }),
    z.object({ kind: z.literal('yearly'), start: MonthDaySchema, end: MonthDaySchema }),
  ]),
  /** What makes an edition: the ISO week ("2026-W44") or the year ("2026"). */
  seedRule: z.enum(['isoWeek', 'year']),
  /** Which runs count: only runs that earn progress (Standard mode, not the dev campaign) when true. */
  progressionEligibility: z.boolean().default(true),
  /** Which runs it applies to (every mode for now). */
  eligibility: z.object({ minRunsFinished: z.number().int().min(0).default(0) }).default({ minRunsFinished: 0 }),
  mode: z.enum(['any']).default('any'),
  /** The themed ruleset, in words, and the trainer modifiers it adds to every run started while it is on. */
  ruleText: z.string().min(1),
  modifiers: z.array(ArchetypeModifierSchema).default([]),
  /** Map events (events.json) it features: they turn up more often. */
  mapEvents: z.array(z.string()).default([]),
  objectives: z.array(GameEventObjectiveSchema).min(3).max(5),
  /** For finishing every objective, the first time ever; after that, `fallbackReward` instead. */
  reward: QuestRewardSchema,
  repeatPolicy: z.enum(['oncePerEvent', 'oncePerEdition']).default('oncePerEvent'),
  fallbackReward: QuestRewardSchema,
  visualTheme: z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), icon: z.string() }),
  contentTags: z.array(z.string()).default([]),
});
export type GameEvent = z.infer<typeof GameEventSchema>;
export const GameEventsFileSchema = z.object({ events: z.array(GameEventSchema).min(1) });

export const EventDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Catalog group, e.g. "Merchants and deals". */
  group: z.string(),
  /** The map stop it shows as (each has its own icon): event, merchant, shrine, treasure... */
  stop: z.string().default('event'),
  rarity: z.enum(EVENT_RARITIES).default('common'),
  /** Stages themed with these types see it more often. */
  types: z.array(TypeNameSchema).default([]),
  /** Not before this stage of the run (1 = the first). */
  minStage: z.number().int().min(1).default(1),
  /** It only appears when these hold (e.g. an item it needs). */
  requires: z.array(EventConditionSchema).default([]),
  /** Only appears when the player holds this key item; it is used up. */
  keyItem: z.string().optional(),
  /** Only appears in a run started while this game event (gameEvents.json) was on, e.g. the Spooky pack. */
  gameEvent: z.string().nullable().default(null),
  scene: EventSceneSchema.default({ cast: [], effect: 'none' }),
  intro: z.string(),
  choices: z.array(EventChoiceSchema).min(1).max(4),
}).refine((e) => e.choices.every((c) => (c.check === undefined && c.chance === undefined) || c.failure), { message: 'a choice with a check or chance needs a failure outcome' });
export type EventDef = z.infer<typeof EventDefSchema>;

export const EventsFileSchema = z.object({ events: z.array(EventDefSchema).min(1) });

export interface Content {
  species: Map<string, Species>;
  moves: Map<string, Move>;
  abilities: Map<string, Ability>;
  typeChart: TypeChart;
  archetypes: Map<string, Archetype>;
  achievements: Map<string, Achievement>;
  /** Trainer quest lines by trainer id, and Run Quests (trainerQuests.json, core/quests.ts). */
  questLines: Map<string, QuestLine>;
  runQuests: Map<string, RunQuest>;
  /** Weekly, holiday and themed game events (gameEvents.json), in file order. */
  gameEvents: Map<string, GameEvent>;
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
  /** Each species' egg moves (learnables.json "egg"), for Species Mastery. */
  eggMoves: Map<string, string[]>;
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
  /** Raid bosses and den placement (raids.json, core/raid). */
  raids: RaidFile;
  /** Map events (events.json, core/events.ts). */
  events: Map<string, EventDef>;
  /** Totem Pokémon (totems.json, core/totem). */
  totems: TotemFile;
  /** Mega-Expeditions (expeditions.json, core/expedition). */
  expeditions: ExpeditionFile;
  /** Minigames (minigames.json, core/minigame). */
  minigames: MinigameFile;
  zMoves: ZMoveData;
  maxMoves: MaxMoveData;
}

/** One trainer's unlock challenge (trainerUnlocks.json, built by `npm run data:trainer-unlocks`). */
export const TrainerUnlockSchema = z.object({
  trainerId: z.string(),
  tier: z.number().int().min(1).max(5),
  /** Plain-language challenge shown in the Trainer Archive. */
  text: z.string().min(1),
  flavor: z.string().min(1),
  requirement: RequirementSchema,
  cost: z.number().int().min(0),
  status: z.enum(['supported', 'limited']),
  /** For "limited": what the closest counter leaves out. */
  note: z.string().optional(),
});
export const TrainerUnlocksFileSchema = z.object({ unlocks: z.array(TrainerUnlockSchema) });
