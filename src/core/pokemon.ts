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
  }
}

export function levelFromXp(rate: GrowthRate, xp: number): number {
  let level = 1;
  while (level < 100 && xpForLevel(rate, level + 1) <= xp) level++;
  return level;
}

/** Moves a species knows at a given level: the last four learned, in order. */
export function movesAtLevel(content: Content, species: Species, level: number): string[] {
  const learned = species.learnset
    .filter((entry) => entry.level <= level && content.moves.has(entry.move))
    .map((entry) => entry.move);
  const unique = [...new Set(learned)];
  return unique.slice(-4);
}

export function createPokemon(
  content: Content,
  speciesId: string,
  level: number,
  uid: string,
): PokemonInstance {
  const species = getSpecies(content, speciesId);
  const moves = movesAtLevel(content, species, level).map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  if (moves.length === 0) throw new Error(`Species "${speciesId}" knows no supported moves at level ${level}`);
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
 * current HP. New moves are learned while there is a free slot; choosing a move
 * to forget arrives in Milestone 2, so extras are reported as skipped.
 */
export function gainXp(content: Content, mon: PokemonInstance, amount: number): LevelUpResult {
  const species = getSpecies(content, mon.speciesId);
  const oldLevel = mon.level;
  const oldMax = maxHp(content, mon);
  mon.xp = Math.min(mon.xp + Math.max(0, Math.floor(amount)), xpForLevel(species.growthRate, 100));
  mon.level = levelFromXp(species.growthRate, mon.xp);
  const learnedMoves: string[] = [];
  const skippedMoves: string[] = [];
  if (mon.level > oldLevel) {
    const newMax = maxHp(content, mon);
    if (mon.hp > 0) mon.hp = Math.min(newMax, mon.hp + (newMax - oldMax));
    const newMoves = species.learnset.filter(
      (e) => e.level > oldLevel && e.level <= mon.level && content.moves.has(e.move),
    );
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
export function addLevels(content: Content, mon: PokemonInstance, levels: number): LevelUpResult {
  const species = getSpecies(content, mon.speciesId);
  const target = Math.min(100, mon.level + levels);
  const needed = xpForLevel(species.growthRate, target) - mon.xp;
  return gainXp(content, mon, Math.max(0, needed));
}

export function isFainted(mon: PokemonInstance): boolean {
  return mon.hp <= 0;
}
