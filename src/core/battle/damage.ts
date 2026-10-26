// Pure battle calculations. No randomness happens in here: random values
// (crit roll, damage roll, accuracy roll) are passed in, which makes every
// function easy to test with known answers.

import type { BoostStat, Move, Ruleset, TypeChart, TypeName } from '../contentSchema';

/** Type effectiveness of an attacking type against one or two defending types. */
export function typeEffectiveness(chart: TypeChart, attack: TypeName, defenders: readonly TypeName[]): number {
  let multiplier = 1;
  for (const def of defenders) {
    multiplier *= chart[attack]?.[def] ?? 1;
  }
  return multiplier;
}

/** Multiplier for Attack/Defense/Sp. Atk/Sp. Def/Speed stages (-6..+6). */
export function statStageMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/** Multiplier for accuracy/evasion stages (-6..+6). */
export function accuracyStageMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

export function clampStage(stage: number): number {
  return Math.max(-6, Math.min(6, Math.trunc(stage)));
}

/**
 * Chance (0..1) that a move hits. Null accuracy = never misses.
 * Uses the user's accuracy stage minus the target's evasion stage.
 */
export function hitChance(moveAccuracy: number | null, accStage: number, evaStage: number): number {
  if (moveAccuracy === null) return 1;
  const chance = (moveAccuracy / 100) * accuracyStageMultiplier(accStage - evaStage);
  return Math.max(0, Math.min(1, chance));
}

export function critChance(ruleset: Ruleset, critStage: number): number {
  const index = Math.max(0, Math.min(ruleset.critChanceByStage.length - 1, critStage));
  return ruleset.critChanceByStage[index]!;
}

export interface DamageInput {
  level: number;
  power: number;
  /** Attacker's Attack or Sp. Atk stat (before stages). */
  attack: number;
  /** Defender's Defense or Sp. Def stat (before stages). */
  defense: number;
  attackStage: number;
  defenseStage: number;
  stab: boolean;
  effectiveness: number;
  crit: boolean;
  /** Damage roll from ruleset.randomFactorMin to 100 (inclusive). */
  randomFactor: number;
  burned: boolean;
  physical: boolean;
}

/**
 * Applies a multiplier the way the main games do: as a fraction of 4096,
 * rounding halves down (so ×1.5 on 5 gives 7, not 8).
 */
export function pokeRound(value: number, multiplier: number): number {
  const m = Math.round(multiplier * 4096);
  return Math.floor((value * m + 2047) / 4096);
}

/**
 * Gen 5+ damage formula, with the main games' rounding:
 *   base = floor(floor(floor(2 × L / 5 + 2) × Power × A / D) / 50) + 2
 *   then × crit (1.5, rounded down) × random (0.85–1.00, rounded down)
 *   × STAB (1.5, rounded half down) × type (rounded down) × burn (0.5, physical, rounded half down)
 * A critical hit ignores the attacker's negative attack stages and the
 * defender's positive defense stages. Minimum 1 damage unless immune.
 */
export function calcDamage(ruleset: Ruleset, input: DamageInput): number {
  if (input.effectiveness === 0) return 0;
  const atkStage = input.crit ? Math.max(0, input.attackStage) : input.attackStage;
  const defStage = input.crit ? Math.min(0, input.defenseStage) : input.defenseStage;
  const a = Math.max(1, Math.floor(input.attack * statStageMultiplier(atkStage)));
  const d = Math.max(1, Math.floor(input.defense * statStageMultiplier(defStage)));

  let damage = Math.floor(Math.floor(Math.floor((2 * input.level) / 5 + 2) * input.power * a / d) / 50) + 2;
  if (input.crit) damage = Math.floor(damage * ruleset.critMultiplier);
  damage = Math.floor((damage * input.randomFactor) / 100);
  if (input.stab) damage = pokeRound(damage, ruleset.stabMultiplier);
  damage = Math.floor(damage * input.effectiveness);
  if (input.burned && input.physical) damage = pokeRound(damage, ruleset.burnAttackMultiplier);
  return Math.max(1, damage);
}

/** Chance a confused Pokémon hurts itself instead of moving (Gen 7+). */
export const confusionHitChance = 1 / 3;

/** How many times a multi-hit move hits: [2, 5] is 2 or 3 (35% each), 4 or 5 (15% each); a fixed range like [2, 2] always hits that often. */
export function multiHitCount(range: readonly [number, number], rng: { float(): number }): number {
  const [min, max] = range;
  if (min === max) return min;
  if (min === 2 && max === 5) {
    const r = rng.float();
    return r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5;
  }
  return min + Math.floor(rng.float() * (max - min + 1));
}

/** One-hit KO moves: 30% plus the level difference (the target can't be higher level; that check is the caller's). */
export function ohkoAccuracy(userLevel: number, targetLevel: number): number {
  return Math.max(0, Math.min(1, (30 + userLevel - targetLevel) / 100));
}

/** Flail and Reversal: stronger the lower the user's HP. */
export function lowHpPower(hp: number, maxHp: number): number {
  const p = Math.floor((48 * hp) / maxHp);
  return p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20;
}

/** Effective Speed including stages and paralysis. */
export function effectiveSpeed(ruleset: Ruleset, speed: number, stage: number, paralyzed: boolean): number {
  let value = Math.floor(speed * statStageMultiplier(stage));
  if (paralyzed) value = Math.floor(value * ruleset.paralysisSpeedMultiplier);
  return value;
}

export interface TurnOrderInput {
  priority: number;
  speed: number;
}

/**
 * Who acts first: higher move priority first, then higher Speed.
 * Returns 'tie' when both are equal; the caller resolves ties with a seeded roll.
 */
export function compareTurnOrder(a: TurnOrderInput, b: TurnOrderInput): 'a' | 'b' | 'tie' {
  if (a.priority !== b.priority) return a.priority > b.priority ? 'a' : 'b';
  if (a.speed !== b.speed) return a.speed > b.speed ? 'a' : 'b';
  return 'tie';
}

/** Can this status be inflicted on a Pokémon with these types (and this move)? */
export function isStatusImmune(status: string, types: readonly TypeName[], move?: Move): boolean {
  if (move?.flags.includes('powder') && types.includes('grass')) return true;
  switch (status) {
    case 'brn':
      return types.includes('fire');
    case 'par':
      return types.includes('electric');
    case 'psn':
      return types.includes('poison') || types.includes('steel');
    case 'frz':
      return types.includes('ice');
    default:
      return false;
  }
}

export type { BoostStat };
