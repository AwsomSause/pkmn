// Individual Pokémon: creating them, their stats, experience and level-ups.

import type { Content, GrowthRate, Species, StatBlock, StatName } from './contentSchema';
import { STAT_NAMES } from './contentSchema';
import type { PokemonInstance } from './state';

export function getSpecies(content: Content, id: string): Species {
  const species = content.species.get(id);
  if (!species) throw new Error(`Unknown species "${id}"`);
  return species;
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
        : Math.floor((2 * base * mon.level) / 100) + 5;
    const stacks = mon.vitamins[stat] ?? 0;
    stats[stat] = Math.floor(raw * (1 + perStack * stacks));
  }
  return stats;
}

export function maxHp(content: Content, mon: PokemonInstance): number {
  return calcStats(content, mon).hp;
}

/** Total experience needed to reach `level` for a growth rate (standard formulas). */
export function xpForLevel(rate: GrowthRate, level: number): number {
  if (level <= 1) return 0;
  const n = level;
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

export function levelFromXp(rate: GrowthRate, xp: number): number {
  let level = 1;
  while (level < 100 && xpForLevel(rate, level + 1) <= xp) level++;
  return level;
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
  if (unique.length === 0 && usable[0]) return [usable[0].move];
  return unique.slice(-4);
}

export function createPokemon(
  content: Content,
  speciesId: string,
  level: number,
  uid: string,
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
    xp: xpForLevel(species.growthRate, level),
    hp: 1,
    moves,
    status: null,
    vitamins,
    shiny: false,
    friendship: content.balance.friendship.base,
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
export function gainXp(content: Content, mon: PokemonInstance, amount: number, levelCap = 100): LevelUpResult {
  const species = getSpecies(content, mon.speciesId);
  const oldLevel = mon.level;
  const oldMax = maxHp(content, mon);
  const maxXp = Math.max(mon.xp, xpForLevel(species.growthRate, Math.min(100, levelCap)));
  mon.xp = Math.min(mon.xp + Math.max(0, Math.floor(amount)), maxXp);
  mon.level = levelFromXp(species.growthRate, mon.xp);
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
export function addLevels(content: Content, mon: PokemonInstance, levels: number, levelCap = 100): LevelUpResult {
  const species = getSpecies(content, mon.speciesId);
  const target = Math.min(100, levelCap, mon.level + levels);
  const needed = xpForLevel(species.growthRate, target) - mon.xp;
  return gainXp(content, mon, Math.max(0, needed), levelCap);
}

export function isFainted(mon: PokemonInstance): boolean {
  return mon.hp <= 0;
}
