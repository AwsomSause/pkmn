// Individual Pokémon: creating them, their stats, experience and level-ups.

import { careMultiplier } from './care/mods';
import { natureMultiplier, rollNature } from './natures';
import type { Content, GrowthRate, Species, StatBlock, StatName } from './contentSchema';
import { STAT_NAMES } from './contentSchema';
import { Rng, hashSeed } from './rng';
import type { MoveSlot, PokemonInstance } from './state';

export function getSpecies(content: Content, id: string): Species {
  const species = content.species.get(id);
  if (!species) throw new Error(`Unknown species "${id}"`);
  return species;
}

/** The species whose art shows for a Pokémon outside battle: a Silvally holding a Memory looks like its type form. */
export function lookSpecies(content: Content, mon: Pick<PokemonInstance, 'speciesId' | 'held'>): Species {
  if (mon.speciesId === 'silvally') {
    const memory = Object.keys(mon.held ?? {}).find((id) => id.endsWith('-memory'));
    const form = memory && content.species.get(`silvally-${memory.slice(0, -'-memory'.length)}`);
    if (form) return form;
  }
  return getSpecies(content, mon.speciesId);
}

/**
 * Battle stats from base stats and level (modern formula with no IVs, EVs or
 * natures, per director decision D2), then vitamin stacks.
 *   HP    = floor(2 × Base × Level / 100) + Level + 10
 *   Other = floor(2 × Base × Level / 100) + 5
 */
export function calcStats(content: Content, mon: PokemonInstance): StatBlock {
  const species = getSpecies(content, mon.speciesId);
  const perStack = content.balance.vitaminMultiplierPerStack;
  const stats = {} as StatBlock;
  for (const stat of STAT_NAMES) {
    const base = species.baseStats[stat];
    const raw =
      stat === 'hp'
        ? Math.floor((2 * base * mon.level) / 100) + mon.level + 10
        : Math.floor(((Math.floor((2 * base * mon.level) / 100) + 5) * Math.round(natureMultiplier(mon.nature, stat) * 100)) / 100);
    const stacks = mon.vitamins[stat] ?? 0;
    const boost = ((mon.statBoosts?.[stat] ?? 0) + (stat === 'hp' ? mon.perkHp ?? 0 : 0)) / 100;
    stats[stat] = Math.floor(raw * (1 + perStack * stacks + boost) * (content.balance.careEffects ? careMultiplier(mon.care, stat) : 1));
  }
  // Dynamax doubles HP for its turns (battle/transform.ts).
  if (mon.dynamaxed) stats.hp *= 2;
  return stats;
}

/** Each PP Up adds a fifth of the move's base PP (as in the main games); PP Max counts as three. */
export const PP_UP_SHARE = 0.2;
export const MAX_PP_UPS = 3;

/** A move slot's max PP, counting PP Ups. */
export function maxPp(content: Content, slot: MoveSlot): number {
  const base = content.moves.get(slot.id)!.pp;
  return base + Math.floor(base * PP_UP_SHARE * (slot.ppUps ?? 0)) + (slot.star ? 1 : 0);
}

export function maxHp(content: Content, mon: PokemonInstance): number {
  return calcStats(content, mon).hp;
}

/** The highest level any Pokémon can reach (D14); balance.difficulty.maxLevel may be lower. */
export const LEVEL_LIMIT = 1000;
/** Default for balance.difficulty.highLevelXp (see xpForLevel). */
export const HIGH_LEVEL_XP = 0.4;

/**
 * Total experience needed to reach `level` for a growth rate. Up to 100 these are
 * the standard formulas. Above 100 each level costs `highLevelXp` × (the cost of
 * level 100) × level / 100, so the cost per level grows in step with the EXP a
 * same-level foe gives, and a region's 100 levels take about as many battles as
 * the region has (docs/plans/levels-and-regions-plan.md).
 */
export function xpForLevel(rate: GrowthRate, level: number, highLevelXp = HIGH_LEVEL_XP): number {
  if (level <= 1) return 0;
  if (level > 100) {
    const top = standardXp(rate, 100);
    const step = top - standardXp(rate, 99);
    return top + Math.floor((highLevelXp * step * ((level * (level + 1)) / 2 - 5050)) / 100);
  }
  return standardXp(rate, level);
}

function standardXp(rate: GrowthRate, n: number): number {
  switch (rate) {
    case 'fast':
      return Math.floor((4 * n ** 3) / 5);
    case 'medium-fast':
      return n ** 3;
    case 'medium-slow':
      return Math.max(0, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140));
    case 'slow':
      return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      if (n <= 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n <= 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n <= 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n <= 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n <= 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

export function levelFromXp(rate: GrowthRate, xp: number, maxLevel = 100, highLevelXp = HIGH_LEVEL_XP): number {
  let lo = 1;
  let hi = Math.max(1, Math.min(LEVEL_LIMIT, maxLevel));
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (xpForLevel(rate, mid, highLevelXp) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Whether a Pokémon can learn and use this move (it exists and the battle engine supports it). */
export function isUsableMove(content: Content, moveId: string): boolean {
  return content.moves.get(moveId)?.supported === true;
}

/** A species' level-up moves that the game supports, in order. */
export function usableLearnset(content: Content, species: Species): Species['learnset'] {
  return species.learnset.filter((entry) => isUsableMove(content, entry.move));
}

/**
 * Moves a species knows at a given level: the last four learned, in order.
 * If it has learned no supported move yet (its first moves aren't supported),
 * it knows its earliest supported move.
 */
export function movesAtLevel(content: Content, species: Species, level: number): string[] {
  const usable = usableLearnset(content, species);
  const learned = usable.filter((entry) => entry.level <= level).map((entry) => entry.move);
  const unique = [...new Set(learned)];
  const four = unique.length === 0 && usable[0] ? [usable[0].move] : unique.slice(-4);
  // A Pokémon that can attack always knows an attacking move: the oldest move makes room for the latest one it has learned.
  const attacks = (id: string) => (content.moves.get(id)?.power ?? 0) > 0;
  if (!four.some(attacks)) {
    // The latest attack it has learned, else its earliest attack at any level (a level-2 Jigglypuff would otherwise have only Sing),
    // else Tackle as a stand-in (Metapod, Kakuna, Abra, Magikarp and Smeargle have none). Ditto keeps Transform.
    const attack = [...unique].reverse().find(attacks) ?? usable.find((entry) => attacks(entry.move))?.move ?? (species.id === 'ditto' ? undefined : 'tackle');
    if (attack) return four.length >= 4 ? [...four.slice(1), attack] : [...four, attack];
  }
  // Early on, a Pokémon whose only attacks are Normal-type (Magnemite with just Tackle) also gets its earliest other-type attack,
  // so a Ghost-type foe cannot make a fight unwinnable.
  if (level <= content.balance.opening.softMovesUntilLevel + 5) {
    const only = (id: string) => content.moves.get(id)?.type;
    const offTypeAttack = usable.find((entry) => attacks(entry.move) && only(entry.move) !== 'normal')?.move;
    if (offTypeAttack && !four.includes(offTypeAttack) && four.some(attacks) && four.filter(attacks).every((id) => only(id) === 'normal')) {
      if (four.length < 4) return [...four, offTypeAttack];
      const drop = four.findIndex((id) => !attacks(id));
      return four.map((id, i) => (i === (drop >= 0 ? drop : 0) ? offTypeAttack : id));
    }
  }
  return four;
}

/**
 * Which ability a new Pokémon gets (director's choice: random, hidden ones
 * rare): its hidden ability with balance.abilities.hiddenChance, otherwise one
 * of its normal abilities at random. The roll comes from a hash of `key` (the
 * run seed and the Pokémon's uid), not from an RNG stream, so adding
 * abilities changed no other roll.
 */
export function rollAbilitySlot(content: Content, species: Species, key: string): number {
  const rng = new Rng(hashSeed(`ability:${key}`));
  const hiddenRoll = rng.float();
  if (species.abilities.hidden && hiddenRoll < content.balance.abilities.hiddenChance) return -1;
  return species.abilities.normal.length > 1 ? rng.int(0, species.abilities.normal.length - 1) : 0;
}

/**
 * The ability a Pokémon has now, or null if its species has none listed.
 * After evolving it keeps its slot: the same-numbered normal ability of the
 * new species (wrapping round), or its hidden one.
 */
export function abilityOf(content: Content, mon: PokemonInstance): string | null {
  const { normal, hidden } = getSpecies(content, mon.speciesId).abilities;
  if (mon.abilitySlot === -1 && hidden) return hidden;
  if (normal.length === 0) return hidden;
  return normal[Math.max(0, mon.abilitySlot) % normal.length]!;
}

/** `abilityKey` picks its ability (see rollAbilitySlot); runs pass `${seed}:${uid}`. */
export function createPokemon(
  content: Content,
  speciesId: string,
  level: number,
  uid: string,
  abilityKey: string = uid,
): PokemonInstance {
  const species = getSpecies(content, speciesId);
  // A species with no supported moves at all (Ditto, Smeargle, ...) only has Struggle until its moves are built.
  const known = movesAtLevel(content, species, level);
  const moveIds = known.length > 0 ? known : [content.ruleset.struggleMoveId];
  const moves = moveIds.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  const vitamins = Object.fromEntries(STAT_NAMES.map((s) => [s, 0])) as Record<StatName, number>;
  const mon: PokemonInstance = {
    uid,
    speciesId,
    level,
    xp: xpForLevel(species.growthRate, level, content.balance.difficulty.highLevelXp),
    hp: 1,
    moves,
    status: null,
    vitamins,
    shiny: false,
    friendship: content.balance.friendship.base,
    abilitySlot: rollAbilitySlot(content, species, abilityKey),
    nature: rollNature(abilityKey),
  };
  mon.hp = maxHp(content, mon);
  return mon;
}

/**
 * Experience for defeating a Pokémon (Gen 5+ scaled formula):
 *   floor( (b × Lf / 5) × ((2Lf + 10) / (Lf + Lp + 10))^2.5 ) + 1
 * b = defeated species' base experience, Lf = its level, Lp = winner's level.
 * The trainer's XP multiplier is applied after, then rounded down.
 */
export function xpForDefeat(baseExp: number, faintedLevel: number, winnerLevel: number, multiplier: number): number {
  const scale = Math.pow((2 * faintedLevel + 10) / (faintedLevel + winnerLevel + 10), 2.5);
  const base = Math.floor(((baseExp * faintedLevel) / 5) * scale) + 1;
  return Math.floor(base * multiplier);
}

export interface LevelUpResult {
  levelsGained: number;
  newLevel: number;
  learnedMoves: string[];
  /** Moves that could not be learned because four are already known. */
  skippedMoves: string[];
}

/**
 * Adds experience (or levels) and handles level-ups. Max HP gains are added to
 * current HP. New moves are learned while there is a free slot; extras are
 * reported as skipped (the run then asks the player whether to forget a move).
 * Experience stops at `levelCap` (the region's level cap, D14).
 */
export function gainXp(content: Content, mon: PokemonInstance, amount: number, levelCap = LEVEL_LIMIT): LevelUpResult {
  const species = getSpecies(content, mon.speciesId);
  const oldLevel = mon.level;
  const oldMax = maxHp(content, mon);
  const { maxLevel, highLevelXp } = content.balance.difficulty;
  const top = Math.min(maxLevel, levelCap);
  const maxXp = Math.max(mon.xp, xpForLevel(species.growthRate, top, highLevelXp));
  mon.xp = Math.min(mon.xp + Math.max(0, Math.floor(amount)), maxXp);
  mon.level = Math.max(oldLevel, levelFromXp(species.growthRate, mon.xp, Math.max(oldLevel, top), highLevelXp));
  const learnedMoves: string[] = [];
  const skippedMoves: string[] = [];
  if (mon.level > oldLevel) {
    const newMax = maxHp(content, mon);
    if (mon.hp > 0) mon.hp = Math.min(newMax, mon.hp + (newMax - oldMax));
    const newMoves = usableLearnset(content, species).filter((e) => e.level > oldLevel && e.level <= mon.level);
    for (const entry of newMoves) {
      if (mon.moves.some((m) => m.id === entry.move)) continue;
      if (mon.moves.length < 4) {
        mon.moves.push({ id: entry.move, pp: content.moves.get(entry.move)!.pp });
        learnedMoves.push(entry.move);
      } else {
        skippedMoves.push(entry.move);
      }
    }
  }
  return { levelsGained: mon.level - oldLevel, newLevel: mon.level, learnedMoves, skippedMoves };
}

/** Raises the level directly (Rare Candy): sets XP to the start of the new level. */
export function addLevels(content: Content, mon: PokemonInstance, levels: number, levelCap = LEVEL_LIMIT): LevelUpResult {
  const species = getSpecies(content, mon.speciesId);
  const target = Math.min(content.balance.difficulty.maxLevel, levelCap, mon.level + levels);
  const needed = xpForLevel(species.growthRate, target, content.balance.difficulty.highLevelXp) - mon.xp;
  return gainXp(content, mon, Math.max(0, needed), levelCap);
}

export function isFainted(mon: PokemonInstance): boolean {
  return mon.hp <= 0;
}
