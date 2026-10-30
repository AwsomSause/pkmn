// Trainer perks from Trainers.md (pure data in archetypes.json; this file only
// reads the modifier list by kind). Every function returns 1 (or 0 / false) when
// the trainer has no matching modifier, so battle code can call them freely.
// Nothing here rolls a random number.

import type { Perks } from './archetypes';
import type { Content, TypeName } from './contentSchema';
import { abilityOf, calcStats, getSpecies, isUsableMove } from './pokemon';
import type { PokemonInstance } from './state';

type Kind<K extends string> = Extract<Perks[number], { kind: K }>;

function of<K extends Perks[number]['kind']>(perks: Perks | undefined, kind: K): Kind<K>[] {
  return (perks ?? []).filter((m): m is Kind<K> => m.kind === kind);
}

function product<K extends Perks[number]['kind']>(perks: Perks | undefined, kind: K, applies: (m: Kind<K>) => boolean = () => true): number {
  let value = 1;
  for (const m of of(perks, kind)) if (applies(m)) value *= (m as unknown as { value: number }).value;
  return value;
}

function sum<K extends Perks[number]['kind']>(perks: Perks | undefined, kind: K, pick: (m: Kind<K>) => number): number {
  return of(perks, kind).reduce((total, m) => total + pick(m), 0);
}

/** Base Speed at or above which a Pokémon counts as "fast" for perks, and at or below which it is "slow". */
export const FAST_BASE_SPEED = 90;
export const SLOW_BASE_SPEED = 60;

const ULTRA_BEASTS = new Set(['nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela', 'kartana', 'guzzlord', 'necrozma', 'poipole', 'naganadel', 'stakataka', 'blacephalon']);

/** Legendary, Mythical or Ultra Beast (the groups Trainers.md perks name together). */
export function isLegendaryLike(species: { id: string; tags: readonly string[] }): boolean {
  return species.tags.includes('legendary') || species.tags.includes('mythical') || ULTRA_BEASTS.has(species.id);
}

/** Boss classes (gym leaders, Elite Four, champions): the opposing trainer's class id. */
export function isBossClass(classId: string | undefined | null): boolean {
  return classId === 'gym-leader' || classId === 'elite-four' || classId === 'champion';
}

export interface DamageDealtInfo {
  userTypes: readonly TypeName[];
  physical: boolean;
  /** Share of the user's HP left, 0 to 1. */
  hpShare: number;
  userLevel: number;
  targetLevel: number;
  targetIsBoss: boolean;
  weather: string | null;
  moveType: TypeName;
  userBaseSpeed: number;
  userIsMega: boolean;
  partyHasMega: boolean;
  /** The first Pokémon to fight in this battle. */
  firstInBattle: boolean;
  isStarter: boolean;
  /** The types of the Pokémon being hit. */
  targetTypes: readonly TypeName[];
  /** The attacker is holding at least one item. */
  userHoldsItem?: boolean;
  /** This is the first attack your side makes in the battle (false when unknown). */
  firstAttack?: boolean;
  /** Type effectiveness of the hit (above 1 is super effective). */
  effectiveness?: number;
  /** Full turns the attacker has been out. */
  turnsOut?: number;
  /** The target has a status condition. */
  targetStatused?: boolean;
  moveIsZ?: boolean;
  moveIsSpread?: boolean;
  /** Place in the party (0 = first) and the party's size. */
  partyIndex?: number;
  partySize?: number;
  userLegendary?: boolean;
  /** `unusual` / `common`: see unusualKind. */
  userRarity?: 'unusual' | 'common' | null;
  moveFlags?: readonly string[];
  /** Enemies your side has already defeated in this battle. */
  enemiesDefeated?: number;
}

/** Damage multiplier for a hit your Pokémon deals (stacks with the older type modifiers). */
export function damageDealtPerk(perks: Perks | undefined, i: DamageDealtInfo): number {
  let v = 1;
  v *= product(perks, 'damageMultiplier', (m) => (!m.type || i.userTypes.includes(m.type)) && (!m.types || m.types.some((t) => i.userTypes.includes(t))) && (!m.category || (m.category === 'physical') === i.physical) && (!m.speed || (m.speed === 'fast' ? i.userBaseSpeed >= FAST_BASE_SPEED : i.userBaseSpeed <= SLOW_BASE_SPEED)) && (m.legendary === undefined || m.legendary === Boolean(i.userLegendary)));
  v *= product(perks, 'moveFlagDamage', (m) => m.flags.some((f) => i.moveFlags?.includes(f)));
  for (const m of of(perks, 'unusualDamageMultiplier')) v *= i.userRarity === 'unusual' ? m.unusual : i.userRarity === 'common' ? m.common : 1;
  if ((i.enemiesDefeated ?? 0) > 0) v *= product(perks, 'afterKoDamageMultiplier');
  v *= product(perks, 'lowHpDamageMultiplier', (m) => i.hpShare < m.below);
  v *= product(perks, 'levelGapDamageMultiplier', (m) => (m.foe === 'higher' ? i.targetLevel > i.userLevel : i.targetLevel < i.userLevel));
  if (i.targetIsBoss) v *= product(perks, 'bossDamageMultiplier');
  v *= product(perks, 'damageVsTypeMultiplier', (m) => i.targetTypes.includes(m.foeType));
  v *= product(perks, 'starterDamageMultiplier', (m) => m.starter === i.isStarter);
  for (const m of of(perks, 'battleOrderDamage')) v *= i.firstInBattle ? m.first : m.later;
  for (const m of of(perks, 'firstAttackDamage')) v *= i.firstAttack ? m.first : m.later;
  if ((i.effectiveness ?? 1) > 1) v *= product(perks, 'superEffectiveDamageMultiplier');
  if ((i.turnsOut ?? 0) >= 1) v *= product(perks, 'stayingDamageMultiplier');
  if (i.targetStatused) v *= product(perks, 'statusedFoeDamageMultiplier');
  if (i.moveIsZ) v *= product(perks, 'zMoveDamageMultiplier');
  v *= product(perks, 'spreadMoveDamageMultiplier', (m) => m.spread === Boolean(i.moveIsSpread));
  v *= product(perks, 'partyPositionDamage', (m) => (m.position === 'first' ? i.partyIndex === 0 : i.partyIndex !== undefined && i.partySize !== undefined && i.partyIndex === i.partySize - 1));
  v *= product(perks, 'heldItemDamageMultiplier', (m) => m.holding === Boolean(i.userHoldsItem));
  if (i.userIsMega) v *= product(perks, 'megaDamageMultiplier');
  if (i.partyHasMega && !i.userIsMega) v *= product(perks, 'nonMegaDamageMultiplier');
  const rainOrSun = i.weather === 'rain' || i.weather === 'sun' ? i.weather : null;
  if (rainOrSun) v *= product(perks, 'weatherDamageMultiplier', (m) => m.side === 'player' && m.weather === rainOrSun && (!m.moveType || m.moveType === i.moveType));
  return v;
}

export interface DamageTakenInfo {
  targetTypes: readonly TypeName[];
  moveType: TypeName;
  attackerIsLegendary: boolean;
  attackerIsBoss: boolean;
  weather: string | null;
  targetIsMega?: boolean;
  effectiveness?: number;
  /** Full turns the defender has been out (0 = it just came in). */
  targetTurnsOut?: number;
}

/** Damage multiplier for a hit your Pokémon takes. */
export function damageTakenPerk(perks: Perks | undefined, i: DamageTakenInfo): number {
  let v = 1;
  v *= product(perks, 'damageTakenMultiplier', (m) => {
    if (m.type && !i.targetTypes.includes(m.type)) return false;
    if (m.moveType && m.moveType !== i.moveType) return false;
    if (m.fromLegendary && !i.attackerIsLegendary) return false;
    return true;
  });
  if (i.attackerIsBoss) v *= product(perks, 'bossDamageTakenMultiplier');
  if (i.targetIsMega) v *= product(perks, 'megaDamageTakenMultiplier');
  if ((i.effectiveness ?? 1) > 1) v *= product(perks, 'superEffectiveTakenMultiplier');
  if (i.targetTurnsOut === 0) v *= product(perks, 'switchGuard');
  const rainOrSun = i.weather === 'rain' || i.weather === 'sun' ? i.weather : null;
  if (rainOrSun) v *= product(perks, 'weatherDamageMultiplier', (m) => m.side === 'enemy' && m.weather === rainOrSun && (!m.moveType || m.moveType === i.moveType));
  return v;
}

/** Multiplier on one of your Pokémon's stats (or max HP). */
export function statPerk(perks: Perks | undefined, stat: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', types: readonly TypeName[], when: { burned?: boolean; threeStageLine?: boolean } = {}): number {
  let v = product(perks, 'statMultiplier', (m) => m.stat === stat && (!m.type || types.includes(m.type)));
  if (stat !== 'hp') v *= product(perks, 'conditionalStatMultiplier', (m) => m.stat === stat && (!m.type || types.includes(m.type)) && Boolean(when[m.when]));
  return v;
}

export interface XpInfo {
  types: readonly TypeName[];
  baseSpeed: number;
  isStarter: boolean;
  isBossBattle: boolean;
}

/** Experience multiplier for one Pokémon (group perks and ordinary-battle perks). */
export function xpPerk(perks: Perks | undefined, i: XpInfo): number {
  let v = product(perks, 'groupXpMultiplier', (m) => {
    if (m.type && !i.types.includes(m.type)) return false;
    if (m.notType && i.types.includes(m.notType)) return false;
    if (m.speed === 'fast' && i.baseSpeed < FAST_BASE_SPEED) return false;
    if (m.speed === 'slow' && i.baseSpeed > SLOW_BASE_SPEED) return false;
    if (m.starter !== undefined && m.starter !== i.isStarter) return false;
    return true;
  });
  if (!i.isBossBattle) v *= product(perks, 'ordinaryXpMultiplier');
  return v;
}

export function friendshipPerk(perks: Perks | undefined): number {
  return product(perks, 'friendshipMultiplier');
}

/** Chance (0-1) that a fatal hit leaves the Pokémon at 1 HP. */
export function survivalChance(perks: Perks | undefined, types: readonly TypeName[]): number {
  let miss = 1;
  for (const m of of(perks, 'survivalChance')) if (!m.type || types.includes(m.type)) miss *= 1 - m.chance;
  return 1 - miss;
}

/** Turns of sleep or confusion your Pokémon inflict, with the trainer's longer-status perks. */
export function statusTurnsPerk(perks: Perks | undefined, turns: number): number {
  return Math.ceil(turns * product(perks, 'statusDurationMultiplier')) + sum(perks, 'statusDurationBonus', (m) => m.turns);
}

export function statusChancePerk(perks: Perks | undefined, userTypes: readonly TypeName[], status?: string): number {
  return product(perks, 'statusChanceMultiplier', (m) => (!m.type || userTypes.includes(m.type)) && (!m.status || m.status === status));
}

export function weatherTurnsBonus(perks: Perks | undefined): number {
  return sum(perks, 'weatherTurnsBonus', (m) => m.turns);
}

export function encounterWeightPerk(perks: Perks | undefined, group: 'legendary' | 'rare'): number {
  return product(perks, 'encounterWeightMultiplier', (m) => m.group === group);
}

export function hyperChancePerk(perks: Perks | undefined): number {
  return product(perks, 'hyperChanceMultiplier');
}

export function evolutionLevelOffset(perks: Perks | undefined): number {
  return sum(perks, 'evolutionLevelOffset', (m) => m.value);
}

export function startingLevelOffset(perks: Perks | undefined): number {
  return sum(perks, 'startingLevelOffset', (m) => m.value);
}

export function regionLevelOffset(perks: Perks | undefined): number {
  return sum(perks, 'regionLevelOffset', (m) => m.value);
}

export function rivalLevelOffset(perks: Perks | undefined): number {
  return sum(perks, 'rivalLevelOffset', (m) => m.value);
}

/** Run attributes the trainer starts with (e.g. Luck 20). */
export function startingAttributes(perks: Perks | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of of(perks, 'startingAttribute')) out[m.key] = (out[m.key] ?? 0) + m.value;
  return out;
}

/** How many Pokémon can be released in a run, or null for no limit. */
export function releaseLimit(perks: Perks | undefined): number | null {
  const limits = of(perks, 'releaseLimit').map((m) => m.value);
  return limits.length === 0 ? null : Math.min(...limits);
}

/**
 * Keeps each party Pokémon's HP perk bonus current (mutates `party`). When the maximum
 * goes up, current HP rises by the same amount; when it goes down, current HP is capped.
 */
export function syncHpPerks(content: Content, perks: Perks | undefined, party: PokemonInstance[]): void {
  for (const mon of party) {
    const percent = Math.round((statPerk(perks, 'hp', getSpecies(content, mon.speciesId).types) - 1) * 100);
    if ((mon.perkHp ?? 0) === percent) continue;
    const before = calcStats(content, mon).hp;
    if (percent === 0) delete mon.perkHp;
    else mon.perkHp = percent;
    const after = calcStats(content, mon).hp;
    mon.hp = Math.max(mon.hp > 0 ? 1 : 0, Math.min(after, mon.hp + Math.max(0, after - before)));
  }
}

/** The friendship a Mega Evolved Pokémon needs to stay Mega after battle, or null when the trainer has no such perk. */
export function permanentMegaFriendship(perks: Perks | undefined): number | null {
  const needs = of(perks, 'permanentMega').map((m) => m.minFriendship);
  return needs.length === 0 ? null : Math.min(...needs);
}

/** How many permanent Megas the party may hold (null: no limit). */
export function megaPartyLimit(perks: Perks | undefined): number | null {
  const limits = of(perks, 'megaPartyLimit').map((m) => m.max);
  return limits.length === 0 ? null : Math.min(...limits);
}

/** The strongest usable same-type attack in the species' whole learnset (Ash's starter), or null. */
export function signatureMoveFor(content: Content, speciesId: string): string | null {
  const species = getSpecies(content, speciesId);
  let best: { id: string; power: number } | null = null;
  for (const entry of species.learnset) {
    const move = content.moves.get(entry.move);
    if (!move || move.category === 'status' || !move.power || !species.types.includes(move.type) || !isUsableMove(content, move.id)) continue;
    if (!best || move.power > best.power || (move.power === best.power && move.id < best.id)) best = { id: move.id, power: move.power };
  }
  return best?.id ?? null;
}

export function hasStarterSignature(perks: Perks | undefined): boolean {
  return of(perks, 'starterSignatureMove').length > 0;
}

/** Pokémon the party can hold. */
export function partyLimit(base: number, perks: Perks | undefined): number {
  return Math.max(1, base + sum(perks, 'partySizeOffset', (m) => m.value));
}

/** Spare Pokémon the PC holds (0: no PC). */
export function boxCapacity(perks: Perks | undefined): number {
  return sum(perks, 'boxCapacity', (m) => m.slots);
}

/** Different items one Pokémon can hold. */
export function itemSlotLimit(base: number, perks: Perks | undefined): number {
  return Math.max(1, base + sum(perks, 'itemSlotOffset', (m) => m.value));
}

export function catchLevelOffset(perks: Perks | undefined): number {
  return sum(perks, 'catchLevelOffset', (m) => m.value);
}

/** Weight multiplier for one wild species: type perks and the rare-encounter perk (rare: base stat total at or above `rareBst`). */
export function wildWeightPerk(perks: Perks | undefined, types: readonly TypeName[], isRare: boolean, bestStat?: string): number {
  let v = product(perks, 'typeEncounterWeight', (m) => types.includes(m.type));
  v *= product(perks, 'statEncounterWeight', (m) => m.stat === bestStat);
  if (isRare) v *= encounterWeightPerk(perks, 'rare');
  return v;
}

export function burnDamagePerk(perks: Perks | undefined): number {
  return product(perks, 'burnDamageMultiplier');
}

/** Extra PP a move of this type costs. */
export function ppCostExtra(perks: Perks | undefined, type: TypeName): number {
  return sum(perks, 'ppCostExtra', (m) => (m.type === type ? m.extra : 0));
}

export function rivalTeamTypes(perks: Perks | undefined): TypeName[] {
  return of(perks, 'rivalTeamType').map((m) => m.type);
}

export function rivalCounterBonus(perks: Perks | undefined): number {
  return sum(perks, 'rivalCounterBonus', (m) => m.count);
}

export function enemyHyperChancePerk(perks: Perks | undefined): number {
  return product(perks, 'enemyHyperChanceMultiplier');
}

/** Share of max HP a Pokémon of these types recovers each turn in this weather (0 for none). */
export function weatherHealPercent(perks: Perks | undefined, types: readonly TypeName[], weather: string | null): number {
  return sum(perks, 'weatherHeal', (m) => (m.weather === weather && types.includes(m.type) ? m.percent : 0));
}

/** Whether the species' evolution line has three stages. */
export function inThreeStageLine(content: Content, speciesId: string): boolean {
  const longest = (id: string): number => {
    const sp = content.species.get(id);
    if (!sp || sp.evolutions.length === 0) return 1;
    return 1 + Math.max(...sp.evolutions.map((e) => longest(e.to)));
  };
  const sp = getSpecies(content, speciesId);
  return sp.evolutionStage - 1 + longest(speciesId) >= 3;
}

/** Scales a held-item bonus (a multiplier above 1) by the trainer's held-effect strength. */
export function scaleHeldBonus(perks: Perks | undefined, multiplier: number): number {
  const k = product(perks, 'heldEffectMultiplier');
  return k === 1 ? multiplier : 1 + (multiplier - 1) * k;
}

/** Share of max HP every conscious party Pokémon recovers after a won battle (0 to 1). */
export function postBattleHealShare(perks: Perks | undefined): number {
  return sum(perks, 'postBattleHeal', (m) => m.percent) / 100;
}

export function rareItemWeightPerk(perks: Perks | undefined): number {
  return product(perks, 'rareItemWeight');
}

/** Multiplier on the critical-hit damage multiplier: crits you deal (player) or take (enemy). */
export function critDamagePerk(perks: Perks | undefined, side: 'player' | 'enemy'): number {
  return product(perks, 'critDamageMultiplier', (m) => m.side === side);
}

export function megaDelayTurns(perks: Perks | undefined): number {
  return sum(perks, 'megaDelay', (m) => m.turns);
}

export function eliteLevelOffset(perks: Perks | undefined): number {
  return sum(perks, 'eliteLevelOffset', (m) => m.value);
}

export function enemyHealingBlocked(perks: Perks | undefined): boolean {
  return of(perks, 'enemyHealingBlocked').length > 0;
}

/** Moves that hit every foe in double battles (for the perk's damage rule; battle/doubles.ts has the full target list). */
const SPREAD_MOVES = new Set([
  'earthquake', 'surf', 'rock-slide', 'blizzard', 'heat-wave', 'discharge', 'razor-leaf', 'muddy-water', 'bulldoze', 'dazzling-gleam', 'hyper-voice',
  'icy-wind', 'snarl', 'electroweb', 'sludge-wave', 'eruption', 'water-spout', 'boomburst', 'lava-plume', 'sparkling-aria', 'origin-pulse',
  'precipice-blades', 'petal-blizzard', 'struggle-bug', 'breaking-swipe', 'glaciate', 'mind-blown', 'self-destruct', 'explosion', 'magnitude',
  'acid', 'powder-snow', 'swift', 'twister', 'air-cutter', 'incinerate', 'clanging-scales', 'core-enforcer', 'burning-jealousy', 'corrosive-gas',
  'dark-void', 'parabolic-charge', 'sandsear-storm', 'wildbolt-storm', 'bleakwind-storm', 'springtide-storm', 'hyper-voice', 'misty-explosion',
  'synchronoise', 'teatime', 'overdrive', 'disarming-voice',
  'bubble', 'sweet-scent', 'growl', 'leer', 'tail-whip', 'captivate', 'poison-gas',
]);
export function isSpreadMove(moveId: string): boolean {
  return SPREAD_MOVES.has(moveId);
}

export function turnHealPercent(perks: Perks | undefined, types: readonly TypeName[]): number {
  return sum(perks, 'turnHeal', (m) => (types.includes(m.type) ? m.percent : 0));
}

export function healingMoveMultiplier(perks: Perks | undefined): number {
  return product(perks, 'healingMoveMultiplier');
}

export function burnDamageTakenPerk(perks: Perks | undefined): number {
  return product(perks, 'burnDamageTakenMultiplier');
}

export function bossMoneyPerk(perks: Perks | undefined): number {
  return product(perks, 'bossMoneyMultiplier');
}

export function doubleBattleRewardPerk(perks: Perks | undefined): number {
  return product(perks, 'doubleBattleRewardMultiplier');
}

export function statusMoveAccuracyPerk(perks: Perks | undefined): number {
  return product(perks, 'statusMoveAccuracy');
}

export function shopEarlyStockPerk(perks: Perks | undefined): number {
  return sum(perks, 'shopEarlyStock', (m) => m.count);
}

export function zMoveDelayTurns(perks: Perks | undefined): number {
  return sum(perks, 'zMoveDelay', (m) => m.turns);
}

export function championMoneyPerk(perks: Perks | undefined): number {
  return product(perks, 'championMoneyMultiplier');
}

export function ordinaryMoneyPerk(perks: Perks | undefined): number {
  return product(perks, 'ordinaryMoneyMultiplier');
}

export function critChancePerk(perks: Perks | undefined): number {
  return product(perks, 'critChanceMultiplier');
}

/** Friendship as friendship-based bonuses see it. */
export function bonusFriendship(perks: Perks | undefined, friendship: number): number {
  return friendship * product(perks, 'friendshipBonusMultiplier');
}

/** Added to your Pokémon's critical-hit chance. */
export function critChanceBonusPerk(perks: Perks | undefined): number {
  return sum(perks, 'critChanceBonus', (m) => m.value);
}

export function catchMoneyPerk(perks: Perks | undefined): number {
  return product(perks, 'catchMoneyMultiplier');
}

/** Move flags a perk can name: the data's flags plus "dance" (the dance moves, by name). */
const DANCE_MOVES = new Set(['swords-dance', 'dragon-dance', 'quiver-dance', 'feather-dance', 'petal-dance', 'fiery-dance', 'lunar-dance', 'teeter-dance', 'revelation-dance', 'victory-dance', 'clangorous-soul-dance', 'aqua-step', 'raging-fury-dance']);
export function moveFlagsOf(move: { id: string; flags: readonly string[] }): readonly string[] {
  return DANCE_MOVES.has(move.id) ? [...move.flags, 'dance'] : move.flags;
}

const RARITY = new WeakMap<Content, { combo: Map<string, number>; ability: Map<string, number> }>();
/** An ability held by this many species or more is "common"; by this few or fewer, or a type pairing this rare, is "unusual". */
export const COMMON_ABILITY_MIN = 60;
export const UNUSUAL_ABILITY_MAX = 12;
export const UNUSUAL_COMBO_MAX = 6;

/** Whether a Pokémon's type pairing or ability is unusual (rare among all species) or its ability very common. Counts are cached per content set. */
export function unusualKind(content: Content, mon: PokemonInstance): 'unusual' | 'common' | null {
  let table = RARITY.get(content);
  if (!table) {
    table = { combo: new Map(), ability: new Map() };
    for (const sp of content.species.values()) {
      const combo = [...sp.types].sort().join('/');
      table.combo.set(combo, (table.combo.get(combo) ?? 0) + 1);
      for (const a of new Set([...sp.abilities.normal, sp.abilities.hidden].filter((x): x is string => Boolean(x)))) table.ability.set(a, (table.ability.get(a) ?? 0) + 1);
    }
    RARITY.set(content, table);
  }
  const sp = getSpecies(content, mon.speciesId);
  const ability = abilityOf(content, mon);
  const abilityCount = ability ? (table.ability.get(ability) ?? 0) : 0;
  const comboCount = table.combo.get([...sp.types].sort().join('/')) ?? 0;
  if (abilityCount >= COMMON_ABILITY_MIN) return 'common';
  if ((ability && abilityCount <= UNUSUAL_ABILITY_MAX) || comboCount <= UNUSUAL_COMBO_MAX) return 'unusual';
  return null;
}

export function poisonDamagePerk(perks: Perks | undefined): number {
  return product(perks, 'poisonDamageMultiplier');
}

/** Enemy accuracy against one of your Pokémon is divided by this. */
export function evasionPerk(perks: Perks | undefined, types: readonly TypeName[]): number {
  return product(perks, 'evasionMultiplier', (m) => !m.type || types.includes(m.type));
}
