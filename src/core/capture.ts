// Catch probability. Based on the modern formula, simplified to one roll:
//
//   a = (3 × maxHP − 2 × HP) × catchRate × ball / (3 × maxHP) × status
//   base chance = 1 if a ≥ 255, otherwise (a / 255)^0.75
//   final chance = base × trainer modifier (Green × 0.85), clamped to 0..1
//
// (a/255)^0.75 is exactly the chance of passing the main games' four shake
// checks, so the odds match; we just roll once. The number of shakes shown
// on screen is derived from the same roll.

export interface CatchInput {
  maxHp: number;
  hp: number;
  catchRate: number;
  ballMultiplier: number;
  /** 2.5 for sleep/freeze, 1.5 for paralysis/poison/burn, 1 otherwise. */
  statusMultiplier: number;
  /** Product of trainer and item modifiers applied to the final probability. */
  finalMultiplier: number;
}

export function catchValue(input: CatchInput): number {
  const maxHp = Math.max(1, input.maxHp);
  const hp = Math.max(0, Math.min(input.hp, maxHp));
  return (((3 * maxHp - 2 * hp) * input.catchRate * input.ballMultiplier) / (3 * maxHp)) * input.statusMultiplier;
}

export function catchProbability(input: CatchInput): number {
  const a = catchValue(input);
  const base = a >= 255 ? 1 : Math.pow(Math.max(0, a) / 255, 0.75);
  return Math.max(0, Math.min(1, base * input.finalMultiplier));
}

export interface CatchRoll {
  caught: boolean;
  /** 0–3 wobbles to show before the result. */
  shakes: number;
}

/** Turns a roll in [0, 1) into a result: caught if roll < p; otherwise count the shakes it survived. */
export function resolveCatchRoll(probability: number, roll: number): CatchRoll {
  if (roll < probability) return { caught: true, shakes: 3 };
  const perShake = Math.pow(probability, 1 / 4);
  let shakes = 0;
  for (let k = 1; k <= 3; k++) if (roll < Math.pow(perShake, k)) shakes = k;
  return { caught: false, shakes };
}
