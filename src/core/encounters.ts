// Starters, the difficulty model, and planning wild, trainer and gym leader encounters.

import { enemyLevelOffset } from './archetypes';
import type { Archetype, Content, Theme } from './contentSchema';
import { getSpecies } from './pokemon';
import type { Rng } from './rng';
import type { LevelBreakdown } from './state';
import { pickThemeSpecies, trainerClassesFor } from './themes';

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

export type EnemyLevelBreakdown = LevelBreakdown;

/** How far into the run a stage column is: 0 for the first column of the first stage. */
export function runProgress(content: Content, stageIndex: number, column: number): number {
  return stageIndex * content.balance.stage.columns + (column - 1);
}

/**
 * The difficulty model. Order of operations:
 *   1. base     = baseLevel
 *   2. progress = levelsPerColumn × columns travelled so far in the run
 *   3. variance = random whole number in [-variance, +variance]
 *   4. archetype offset (Blue +2, Green −1)
 *   5. bonus    = node bonus (trainer, gym leader, harder route)
 *   6. level    = round(base + progress) + variance + offset + bonus, clamped to [minLevel, maxLevel]
 */
export function enemyLevel(content: Content, archetype: Archetype, progress: number, bonus: number, rng: Rng): EnemyLevelBreakdown {
  const cfg = content.balance.difficulty;
  const base = cfg.baseLevel;
  const progressLevels = cfg.levelsPerColumn * progress;
  const variance = cfg.variance > 0 ? rng.int(-cfg.variance, cfg.variance) : 0;
  const archetypeOffset = enemyLevelOffset(archetype);
  const unclamped = Math.round(base + progressLevels) + variance + archetypeOffset + bonus;
  const level = Math.max(cfg.minLevel, Math.min(cfg.maxLevel, unclamped));
  return { base, progress: progressLevels, variance, archetypeOffset, bonus, unclamped, level };
}

type TeamConfig = Content['balance']['trainerTeam'];

/** Team size grows with each stage: baseSize + extraPerStage × stage + random extra, capped. */
export function teamSize(cfg: TeamConfig, stageIndex: number, rng: Rng): number {
  const extra = cfg.randomExtra > 0 ? rng.int(0, cfg.randomExtra) : 0;
  return Math.max(1, Math.min(cfg.maxSize, cfg.baseSize + Math.floor(cfg.extraPerStage * stageIndex) + extra));
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

export interface WildPlan {
  speciesId: string;
  level: number;
  levelInfo: EnemyLevelBreakdown;
  shiny: boolean;
}

/** A wild Pokémon from the stage's theme. */
export function planWild(content: Content, archetype: Archetype, theme: Theme, progress: number, bonus: number, rng: Rng): WildPlan {
  const speciesId = pickThemeSpecies(content, theme, rng);
  const levelInfo = enemyLevel(content, archetype, progress, bonus, rng);
  return { speciesId, level: levelInfo.level, levelInfo, shiny: rollShiny(content, rng) };
}

export interface TrainerPlan {
  classId: string;
  name: string;
  /** Set for gym leaders. */
  leaderId: string | null;
  members: { speciesId: string; level: number }[];
  levelInfo: EnemyLevelBreakdown[];
}

/** A trainer whose class fits the theme, with a team drawn from the theme. */
export function planTrainer(content: Content, archetype: Archetype, theme: Theme, stageIndex: number, progress: number, rng: Rng): TrainerPlan {
  const trainerClass = rng.pick(trainerClassesFor(content, theme));
  const name = rng.pick(trainerClass.names);
  const size = teamSize(content.balance.trainerTeam, stageIndex, rng);
  const levelInfo: EnemyLevelBreakdown[] = [];
  const members = Array.from({ length: size }, () => {
    const info = enemyLevel(content, archetype, progress, content.balance.difficulty.trainerBonus, rng);
    levelInfo.push(info);
    return { speciesId: evolvedFormAt(content, pickThemeSpecies(content, theme, rng, trainerClass.types), info.level), level: info.level };
  });
  return { classId: trainerClass.id, name, leaderId: null, members, levelInfo };
}

/** The class id used for gym leader battles (gym leaders aren't a trainer class in trainers.json). */
export const GYM_LEADER_CLASS = 'gym-leader';

/** The gym leader's team: drawn from the theme, a little stronger, with a stronger last Pokémon (their ace). */
export function planGymLeader(content: Content, archetype: Archetype, theme: Theme, leaderId: string, stageIndex: number, progress: number, rng: Rng): TrainerPlan {
  const leader = content.gymLeaders.get(leaderId);
  if (!leader) throw new Error(`Unknown gym leader "${leaderId}"`);
  const { gymBonus, aceBonus } = content.balance.difficulty;
  const size = teamSize(content.balance.gymTeam, stageIndex, rng);
  const levelInfo: EnemyLevelBreakdown[] = [];
  const members = Array.from({ length: size }, (_, i) => {
    const info = enemyLevel(content, archetype, progress, gymBonus + (i === size - 1 ? aceBonus : 0), rng);
    levelInfo.push(info);
    return { speciesId: evolvedFormAt(content, pickThemeSpecies(content, theme, rng), info.level), level: info.level };
  });
  return { classId: GYM_LEADER_CLASS, name: leader.name, leaderId, members, levelInfo };
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
