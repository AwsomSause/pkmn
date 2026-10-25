// Starter generation and wild encounter generation.

import { enemyLevelOffset } from './archetypes';
import type { Archetype, Content } from './contentSchema';
import { getSpecies } from './pokemon';
import type { Rng } from './rng';

/**
 * Picks `count` different species from the starter pool. Only first-stage
 * species (no pre-evolution) are eligible.
 */
export function generateStarterChoices(content: Content, rng: Rng): string[] {
  const { starterPool, starterChoices } = content.balance;
  const eligible = [...new Set(starterPool)].filter((id) => getSpecies(content, id).evolutionStage === 1);
  if (eligible.length < starterChoices) {
    throw new Error(`Starter pool has ${eligible.length} eligible species but ${starterChoices} are needed`);
  }
  return rng.shuffle(eligible).slice(0, starterChoices);
}

export interface EnemyLevelBreakdown {
  base: number;
  variance: number;
  archetypeOffset: number;
  unclamped: number;
  level: number;
}

/**
 * Prototype enemy level curve (a stand-in until stage maps and the full
 * difficulty model arrive in Milestone 3). Order of operations:
 *   1. base     = round(baseLevel + levelsPerEncounter × encountersCompleted)
 *   2. variance = random whole number in [-variance, +variance]
 *   3. archetype offset (Blue +2, Green −1)
 *   4. clamp to [minLevel, maxLevel]
 */
export function enemyLevel(content: Content, archetype: Archetype, encountersCompleted: number, rng: Rng): EnemyLevelBreakdown {
  const cfg = content.balance.prototypeEncounters;
  const base = Math.round(cfg.baseLevel + cfg.levelsPerEncounter * encountersCompleted);
  const variance = cfg.variance > 0 ? rng.int(-cfg.variance, cfg.variance) : 0;
  const archetypeOffset = enemyLevelOffset(archetype);
  const unclamped = base + variance + archetypeOffset;
  const level = Math.max(cfg.minLevel, Math.min(cfg.maxLevel, unclamped));
  return { base, variance, archetypeOffset, unclamped, level };
}

export function pickWildSpecies(content: Content, rng: Rng): string {
  return rng.pick(content.balance.wildPool);
}
