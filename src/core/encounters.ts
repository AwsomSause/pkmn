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

/** Whether the next encounter (1-based number `encounterNumber`) is a trainer battle. */
export function isTrainerEncounter(content: Content, encounterNumber: number): boolean {
  return encounterNumber % content.balance.trainerEvery === 0;
}

/** Team size grows with progress: min + one extra per N encounters, capped at max. */
export function trainerTeamSize(content: Content, encountersCompleted: number): number {
  const t = content.balance.trainerTeam;
  return Math.min(t.maxSize, t.minSize + Math.floor(encountersCompleted / t.encountersPerExtraPokemon));
}

/** The species a Pokémon from `speciesId` would be by `level` (trainers' Pokémon arrive already evolved). */
export function evolvedFormAt(content: Content, speciesId: string, level: number): string {
  let id = speciesId;
  for (let guard = 0; guard < 3; guard++) {
    const evo = getSpecies(content, id).evolutions.find((e) => level >= e.level);
    if (!evo) break;
    id = evo.to;
  }
  return id;
}

export interface TrainerPlan {
  classId: string;
  name: string;
  members: { speciesId: string; level: number }[];
}

/** Picks a trainer class, a name, and a team using the prototype level curve. */
export function planTrainer(content: Content, archetype: Archetype, encountersCompleted: number, rng: Rng): TrainerPlan {
  const trainerClass = rng.pick([...content.trainers.values()]);
  const name = rng.pick(trainerClass.names);
  const size = trainerTeamSize(content, encountersCompleted);
  const members = Array.from({ length: size }, () => {
    const level = enemyLevel(content, archetype, encountersCompleted, rng).level;
    return { speciesId: evolvedFormAt(content, rng.pick(trainerClass.pool), level), level };
  });
  return { classId: trainerClass.id, name, members };
}

/** Rolls whether a wild Pokémon is shiny (D8: 1/2000). */
export function rollShiny(content: Content, rng: Rng): boolean {
  return rng.chance(content.balance.shinyChance);
}

/** Candies for releasing a Pokémon: perRelease + floor(level / perLevels). */
export function candiesForRelease(content: Content, level: number): number {
  const c = content.balance.candies;
  return c.perRelease + Math.floor(level / c.perLevels);
}
