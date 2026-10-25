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
 * Gen 5+ damage formula, rounding down after each step:
 *   base = floor(floor(floor(2 × L / 5 + 2) × Power × A / D) / 50) + 2
 *   then × crit (1.5) × random (0.85–1.00) × STAB (1.5) × type × burn (0.5, physical)
 * A critical hit ignores the attacker's negative attack stages and the
 * defender's positive defense stages. Minimum 1 damage unless immune.
 * (The main games use 4096-based rounding; results can differ by about 1 HP.)
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
  if (input.stab) damage = Math.floor(damage * ruleset.stabMultiplier);
  damage = Math.floor(damage * input.effectiveness);
  if (input.burned && input.physical) damage = Math.floor(damage * ruleset.burnAttackMultiplier);
  return Math.max(1, damage);
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
