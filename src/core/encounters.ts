// Starters, the difficulty model, and planning wild, trainer, gym leader,
// Elite Four and champion encounters.

import { enemyLevelOffset } from './archetypes';
import type { Archetype, Campaign, Content, Theme } from './contentSchema';
import { getSpecies } from './pokemon';
import type { Rng } from './rng';
import type { LevelBreakdown } from './state';
import { levelCap, type BossRole } from './regions';
import { pickThemeSpecies, pickTypeSpecies, trainerClassesFor } from './themes';

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

/** Where an encounter sits on the region's difficulty curve. */
export interface LevelScale {
  /** The region's starting level (its first wild Pokémon). */
  start: number;
  /** The level its last gym leader is built around (just under the cap). */
  end: number;
  /** 0 at the region's first level, 1 at its last gym (and in the league). */
  t: number;
  /** The region's level cap; no enemy goes above it. */
  cap: number;
}

export function levelScale(content: Content, campaign: Campaign, regionIndex: number, stageIndex: number, column: number): LevelScale {
  const cfg = content.balance.difficulty;
  const cap = levelCap(content, regionIndex);
  const start = regionIndex === 0 ? cfg.baseLevel : levelCap(content, regionIndex - 1);
  const end = Math.max(start, cap - cfg.capMargin);
  const total = campaign.stagesPerRegion * campaign.columns - 1;
  const t = Math.min(1, Math.max(0, (stageIndex * campaign.columns + (column - 1)) / Math.max(1, total)));
  return { start, end, t, cap };
}

/** The league comes after the region's last gym: the top of the curve. */
export function leagueScale(content: Content, regionIndex: number): LevelScale {
  const cfg = content.balance.difficulty;
  const cap = levelCap(content, regionIndex);
  const start = regionIndex === 0 ? cfg.baseLevel : levelCap(content, regionIndex - 1);
  return { start, end: Math.max(start, cap - cfg.capMargin), t: 1, cap };
}

/**
 * The difficulty model. Order of operations:
 *   1. base     = the region's start level
 *   2. progress = (end − start) × t^curve  (rises quickly early in a region, then levels off)
 *   3. variance = random whole number in [-variance, +variance]
 *   4. archetype offset (Blue +2, Green −1)
 *   5. bonus    = node bonus (trainer, gym leader, Elite Four, champion, harder route)
 *   6. level    = round(base + progress) + variance + offset + bonus, clamped to [minLevel, the region's level cap]
 */
export function enemyLevel(content: Content, archetype: Archetype, scale: LevelScale, bonus: number, rng: Rng): EnemyLevelBreakdown {
  const cfg = content.balance.difficulty;
  const base = scale.start;
  const progressLevels = (scale.end - scale.start) * Math.pow(scale.t, cfg.curve);
  const variance = cfg.variance > 0 ? rng.int(-cfg.variance, cfg.variance) : 0;
  const archetypeOffset = enemyLevelOffset(archetype);
  const unclamped = Math.round(base + progressLevels) + variance + archetypeOffset + bonus;
  const level = Math.max(cfg.minLevel, Math.min(scale.cap, cfg.maxLevel, unclamped));
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
export function planWild(content: Content, archetype: Archetype, theme: Theme, scale: LevelScale, bonus: number, rng: Rng): WildPlan {
  const speciesId = pickThemeSpecies(content, theme, rng);
  const levelInfo = enemyLevel(content, archetype, scale, bonus, rng);
  return { speciesId, level: levelInfo.level, levelInfo, shiny: rollShiny(content, rng) };
}

export interface TrainerPlan {
  classId: string;
  name: string;
  /** Set for gym leaders, Elite Four members and champions. */
  leaderId: string | null;
  members: { speciesId: string; level: number }[];
  levelInfo: EnemyLevelBreakdown[];
}

/** Builds a team: one level breakdown and species per member; the last member gets `aceBonus` more levels. */
function buildTeam(
  content: Content,
  archetype: Archetype,
  scale: LevelScale,
  size: number,
  bonus: number,
  aceBonus: number,
  pick: (i: number) => string,
  rng: Rng,
): Pick<TrainerPlan, 'members' | 'levelInfo'> {
  const levelInfo: EnemyLevelBreakdown[] = [];
  const members = Array.from({ length: size }, (_, i) => {
    const info = enemyLevel(content, archetype, scale, bonus + (i === size - 1 ? aceBonus : 0), rng);
    levelInfo.push(info);
    return { speciesId: evolvedFormAt(content, pick(i), info.level), level: info.level };
  });
  return { members, levelInfo };
}

/**
 * A trainer whose class fits the theme, with a team drawn from the theme.
 * `stageNumber` counts stages from the start of the run (teams grow with it).
 */
export function planTrainer(content: Content, archetype: Archetype, theme: Theme, stageNumber: number, scale: LevelScale, rng: Rng): TrainerPlan {
  const trainerClass = rng.pick(trainerClassesFor(content, theme));
  const name = rng.pick(trainerClass.names);
  const size = teamSize(content.balance.trainerTeam, stageNumber, rng);
  const team = buildTeam(content, archetype, scale, size, content.balance.difficulty.trainerBonus, 0, () => pickThemeSpecies(content, theme, rng, trainerClass.types), rng);
  return { classId: trainerClass.id, name, leaderId: null, ...team };
}

/** The class ids used for boss battles (they aren't trainer classes in trainers.json). */
export const GYM_LEADER_CLASS = 'gym-leader';
export const ELITE_FOUR_CLASS = 'elite-four';
export const CHAMPION_CLASS = 'champion';

/** Which kind of boss a battle's trainer class is, or null for an ordinary trainer. */
export function bossRoleForClass(classId: string): BossRole | null {
  if (classId === GYM_LEADER_CLASS) return 'gym';
  if (classId === ELITE_FOUR_CLASS) return 'elite';
  if (classId === CHAMPION_CLASS) return 'champion';
  return null;
}

/** The gym leader's team: drawn from the theme, a little stronger, with a stronger last Pokémon (their ace). */
export function planGymLeader(content: Content, archetype: Archetype, theme: Theme, leaderId: string, stageNumber: number, scale: LevelScale, rng: Rng): TrainerPlan {
  const leader = content.gymLeaders.get(leaderId);
  if (!leader) throw new Error(`Unknown gym leader "${leaderId}"`);
  const { gymBonus, aceBonus } = content.balance.difficulty;
  const size = teamSize(content.balance.gymTeam, stageNumber, rng);
  const team = buildTeam(content, archetype, scale, size, gymBonus, aceBonus, () => pickThemeSpecies(content, theme, rng), rng);
  return { classId: GYM_LEADER_CLASS, name: leader.name, leaderId, ...team };
}

/** An Elite Four member's team: Pokémon of their speciality type. Teams grow with each region. */
export function planEliteFour(content: Content, archetype: Archetype, memberId: string, regionIndex: number, scale: LevelScale, rng: Rng): TrainerPlan {
  const member = content.eliteFour.get(memberId);
  if (!member) throw new Error(`Unknown Elite Four member "${memberId}"`);
  const { eliteFourBonus, aceBonus } = content.balance.difficulty;
  const size = teamSize(content.balance.eliteFourTeam, regionIndex, rng);
  const team = buildTeam(content, archetype, scale, size, eliteFourBonus, aceBonus, () => pickTypeSpecies(content, member.types, rng), rng);
  return { classId: ELITE_FOUR_CLASS, name: member.name, leaderId: memberId, ...team };
}

/**
 * The champion's team. A champion with a speciality uses that type; the others
 * bring one Pokémon from each of the region's stage themes, most recent first.
 */
export function planChampion(content: Content, archetype: Archetype, championId: string, regionIndex: number, regionThemes: readonly Theme[], scale: LevelScale, rng: Rng): TrainerPlan {
  const champion = content.champions.get(championId);
  if (!champion) throw new Error(`Unknown champion "${championId}"`);
  const { championBonus, aceBonus } = content.balance.difficulty;
  const size = teamSize(content.balance.championTeam, regionIndex, rng);
  const themes = [...regionThemes].reverse();
  const pick = (i: number) =>
    champion.types.length > 0 || themes.length === 0
      ? pickTypeSpecies(content, champion.types.length > 0 ? champion.types : ['normal'], rng)
      : pickThemeSpecies(content, themes[i % themes.length]!, rng);
  const team = buildTeam(content, archetype, scale, size, championBonus, aceBonus, pick, rng);
  return { classId: CHAMPION_CLASS, name: champion.name, leaderId: championId, ...team };
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
