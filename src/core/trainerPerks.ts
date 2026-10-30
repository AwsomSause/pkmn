// Trainer perks from Trainers.md (pure data in archetypes.json; this file only
// reads the modifier list by kind). Every function returns 1 (or 0 / false) when
// the trainer has no matching modifier, so battle code can call them freely.
// Nothing here rolls a random number.

import type { Perks } from './archetypes';
import type { Content, TypeName } from './contentSchema';
import { calcStats, getSpecies, isUsableMove } from './pokemon';
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
}

/** Damage multiplier for a hit your Pokémon deals (stacks with the older type modifiers). */
export function damageDealtPerk(perks: Perks | undefined, i: DamageDealtInfo): number {
  let v = 1;
  v *= product(perks, 'damageMultiplier', (m) => (!m.type || i.userTypes.includes(m.type)) && (!m.types || m.types.some((t) => i.userTypes.includes(t))) && (!m.category || (m.category === 'physical') === i.physical) && (!m.speed || (m.speed === 'fast' ? i.userBaseSpeed >= FAST_BASE_SPEED : i.userBaseSpeed <= SLOW_BASE_SPEED)));
  v *= product(perks, 'lowHpDamageMultiplier', (m) => i.hpShare < m.below);
  v *= product(perks, 'levelGapDamageMultiplier', (m) => (m.foe === 'higher' ? i.targetLevel > i.userLevel : i.targetLevel < i.userLevel));
  if (i.targetIsBoss) v *= product(perks, 'bossDamageMultiplier');
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
  const rainOrSun = i.weather === 'rain' || i.weather === 'sun' ? i.weather : null;
  if (rainOrSun) v *= product(perks, 'weatherDamageMultiplier', (m) => m.side === 'enemy' && m.weather === rainOrSun && (!m.moveType || m.moveType === i.moveType));
  return v;
}

/** Multiplier on one of your Pokémon's stats (or max HP). */
export function statPerk(perks: Perks | undefined, stat: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', types: readonly TypeName[]): number {
  return product(perks, 'statMultiplier', (m) => m.stat === stat && (!m.type || types.includes(m.type)));
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

export function statusChancePerk(perks: Perks | undefined, userTypes: readonly TypeName[]): number {
  return product(perks, 'statusChanceMultiplier', (m) => !m.type || userTypes.includes(m.type));
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
