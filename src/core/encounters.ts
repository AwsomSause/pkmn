// The difficulty model, and planning wild, trainer, gym leader,
// Elite Four and champion encounters.

import { enemyLevelOffset } from './archetypes';
import type { Archetype, BossTeam, Campaign, Content, StatName, Theme } from './contentSchema';
import { createPokemon, getSpecies, maxHp } from './pokemon';
import type { Rng } from './rng';
import type { LevelBreakdown, PokemonInstance } from './state';
import { getBoss, levelCap, type BossRole } from './regions';
import { pickThemeSpecies, trainerClassesFor } from './themes';

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
  const cap = cfg.earlyCaps[stageIndex] ?? cfg.maxSize;
  return Math.max(1, Math.min(cfg.maxSize, cap, cfg.baseSize + Math.floor(cfg.extraPerStage * stageIndex) + extra));
}

/**
 * The species a Pokémon from `speciesId` would be by `level` (trainers' Pokémon
 * arrive already evolved). Trainers count item evolutions (stones, trades,
 * friendship) as happening at balance.evolution levels. With several branches
 * (Eevee) `rng` picks one; without it the first is used.
 */
export function evolvedFormAt(content: Content, speciesId: string, level: number, rng?: Rng): string {
  const { trainerItemLevel, trainerBabyLevel } = content.balance.evolution;
  let id = speciesId;
  for (let guard = 0; guard < 3; guard++) {
    const species = getSpecies(content, id);
    const itemLevel = species.tags.includes('baby') ? trainerBabyLevel : trainerItemLevel;
    // Regional branches (Alolan Raichu, Hisuian Typhlosion) are left to their regions' own Pokémon.
    const ready = species.evolutions.filter((e) => !e.region && level >= (e.level ?? itemLevel));
    if (ready.length === 0) break;
    id = (rng && ready.length > 1 ? rng.pick(ready) : ready[0]!).to;
  }
  return id;
}

export interface WildPlan {
  speciesId: string;
  level: number;
  levelInfo: EnemyLevelBreakdown;
  shiny: boolean;
}

/** A wild Pokémon from the stage's theme (preferring the region's own Pokémon). */
export function planWild(content: Content, archetype: Archetype, theme: Theme, scale: LevelScale, bonus: number, rng: Rng, regionId?: string, shinyMultiplier = 1): WildPlan {
  const speciesId = pickThemeSpecies(content, theme, rng, undefined, regionId);
  const levelInfo = enemyLevel(content, archetype, scale, bonus, rng);
  return { speciesId, level: levelInfo.level, levelInfo, shiny: rollShiny(content, rng, shinyMultiplier) };
}

export interface PlannedMember {
  speciesId: string;
  level: number;
  /** Bosses only: the moves from their team (otherwise the latest level-up moves). */
  moves?: string[];
  /** Bosses only: extra vitamin-style stacks per stat. */
  training?: Partial<Record<StatName, number>>;
}

export interface TrainerPlan {
  classId: string;
  name: string;
  /** Set for gym leaders, Elite Four members and champions. */
  leaderId: string | null;
  members: PlannedMember[];
  levelInfo: EnemyLevelBreakdown[];
  /** 0–1: how often the trainer picks its best move instead of a random one (bosses only). */
  ai: number;
}

/** Creates a planned Pokémon, with a boss's moves and training when it has them. */
export function createPlannedPokemon(content: Content, member: PlannedMember, uid: string, abilityKey: string = uid): PokemonInstance {
  const mon = createPokemon(content, member.speciesId, member.level, uid, abilityKey);
  const moves = (member.moves ?? []).filter((id) => content.moves.has(id));
  if (moves.length > 0) mon.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  for (const [stat, stacks] of Object.entries(member.training ?? {})) mon.vitamins[stat as StatName] = stacks;
  mon.hp = maxHp(content, mon);
  return mon;
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
    return { speciesId: evolvedFormAt(content, pick(i), info.level, rng), level: info.level };
  });
  return { members, levelInfo };
}

/**
 * A trainer whose class fits the theme, with a team drawn from the theme.
 * `stageNumber` counts stages from the start of the run (teams grow with it).
 */
export function planTrainer(content: Content, archetype: Archetype, theme: Theme, stageNumber: number, scale: LevelScale, rng: Rng, regionId?: string): TrainerPlan {
  const trainerClass = rng.pick(trainerClassesFor(content, theme));
  const name = rng.pick(trainerClass.names);
  const size = teamSize(content.balance.trainerTeam, stageNumber, rng);
  const team = buildTeam(content, archetype, scale, size, content.balance.difficulty.trainerBonus, 0, () => pickThemeSpecies(content, theme, rng, trainerClass.types, regionId), rng);
  return { classId: trainerClass.id, name, leaderId: null, ai: 0, ...team };
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

/** Gym teams per boss: team 1–8 for the run's first eight stages, 9–16 for the next eight, then team 16 again. */
export const GYM_TEAM_COUNT = 16;
/** Elite Four and champion teams per boss: one per region (the Grand Region is the tenth). */
export const LEAGUE_TEAM_COUNT = 10;

/** Which of a boss's teams a battle uses: the stage number (gyms) or region number (league), capped at the last team. */
export function bossTeamIndex(role: BossRole, number: number): number {
  const count = role === 'gym' ? GYM_TEAM_COUNT : LEAGUE_TEAM_COUNT;
  return Math.max(0, Math.min(count - 1, number));
}

/** The species of a boss's team, in battle order (the last one is the ace). Needs no roll, so map previews can show it. */
export function bossTeamSpecies(content: Content, role: BossRole, bossId: string, number: number): string[] {
  return getBoss(content, bossId).teams[role][bossTeamIndex(role, number)]!.members.map((m) => m.speciesId);
}

/**
 * A boss's team for a battle: the species, moves and training come from
 * bossTeams.json; levels follow the difficulty curve with the role's bonus,
 * and the last Pokémon (the ace) gets `aceBonus` more.
 */
function planBoss(content: Content, archetype: Archetype, role: BossRole, bossId: string, number: number, scale: LevelScale, bonus: number, classId: string, rng: Rng): TrainerPlan {
  const boss = getBoss(content, bossId);
  const team: BossTeam = boss.teams[role][bossTeamIndex(role, number)]!;
  const { aceBonus } = content.balance.difficulty;
  const levelInfo: EnemyLevelBreakdown[] = [];
  const members = team.members.map((m, i) => {
    const info = enemyLevel(content, archetype, scale, bonus + (i === team.members.length - 1 ? aceBonus : 0), rng);
    levelInfo.push(info);
    return { speciesId: m.speciesId, level: info.level, moves: m.moves, training: m.training };
  });
  return { classId, name: boss.name, leaderId: bossId, members, levelInfo, ai: team.ai };
}

/** The gym leader's team for the run's `stageNumber`-th stage (0-based). */
export function planGymLeader(content: Content, archetype: Archetype, leaderId: string, stageNumber: number, scale: LevelScale, rng: Rng): TrainerPlan {
  return planBoss(content, archetype, 'gym', leaderId, stageNumber, scale, content.balance.difficulty.gymBonus, GYM_LEADER_CLASS, rng);
}

/** An Elite Four member's team for region `regionIndex` (0-based). Teams get harder every region. */
export function planEliteFour(content: Content, archetype: Archetype, memberId: string, regionIndex: number, scale: LevelScale, rng: Rng): TrainerPlan {
  return planBoss(content, archetype, 'elite', memberId, regionIndex, scale, content.balance.difficulty.eliteFourBonus, ELITE_FOUR_CLASS, rng);
}

/** The champion's team for region `regionIndex` (0-based): the hardest battle of the region. */
export function planChampion(content: Content, archetype: Archetype, championId: string, regionIndex: number, scale: LevelScale, rng: Rng): TrainerPlan {
  return planBoss(content, archetype, 'champion', championId, regionIndex, scale, content.balance.difficulty.championBonus, CHAMPION_CLASS, rng);
}

/** Rolls whether a wild Pokémon is shiny (D8: 1/2000, raised by Luck through `multiplier`). */
export function rollShiny(content: Content, rng: Rng, multiplier = 1): boolean {
  return rng.chance(Math.min(1, content.balance.shinyChance * multiplier));
}

/** Candies for releasing a Pokémon: perRelease + floor(level / perLevels). */
export function candiesForRelease(content: Content, level: number): number {
  const c = content.balance.candies;
  return c.perRelease + Math.floor(level / c.perLevels);
}
