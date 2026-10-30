// Wild Pokémon with identity (catalog #26, #27, #30): a first-impression behaviour and, for territorial ones, a warning sign.
// Seeded by run seed, encounter and species (no run stream is used). Each behaviour also nudges the catch odds (CATCH_MULTIPLIER);
// the battle itself is unchanged.

import type { Content } from './contentSchema';
import { hashSeed, Rng } from './rng';
import type { RunState } from './state';

export type WildBehaviorId = 'curious' | 'timid' | 'territorial' | 'playful' | 'sick' | 'guarding' | 'calm';

interface BehaviorDef {
  id: WildBehaviorId;
  weight: number;
  /** %s is the species name. */
  sign: string;
  line: string;
}

export const WILD_BEHAVIORS: BehaviorDef[] = [
  { id: 'curious', weight: 3, sign: 'Small tracks circle your path.', line: 'A curious %s edges closer to look at you.' },
  { id: 'timid', weight: 3, sign: 'Rustling stops when you step near.', line: 'A timid %s peeks out, ready to bolt.' },
  { id: 'territorial', weight: 3, sign: 'Claw marks and broken branches mark this ground.', line: 'This is a territorial %s\'s ground. It will not back down.' },
  { id: 'playful', weight: 2, sign: 'You hear playful cries ahead.', line: 'A playful %s bounces out to meet you.' },
  { id: 'sick', weight: 1, sign: 'Faint, uneven cries drift from the grass.', line: 'This %s looks unwell, but it still stands to fight.' },
  { id: 'guarding', weight: 2, sign: 'A nest of gathered berries lies in your way.', line: 'A %s guards something close by and will not leave.' },
  { id: 'calm', weight: 2, sign: 'Everything is oddly still.', line: 'A calm %s watches you without fear.' },
];

/** Share of ordinary wild encounters that get a behaviour; the rest stay plain. */
export const WILD_BEHAVIOR_CHANCE = 0.4;

/** Catch-chance multiplier per behaviour (sick and calm foes are easier to catch, guarded and timid ones harder). */
export const CATCH_MULTIPLIER: Record<WildBehaviorId, number> = { curious: 1.1, timid: 0.85, territorial: 0.9, playful: 1.05, sick: 1.4, guarding: 0.9, calm: 1.2 };

export interface WildFraming {
  id: WildBehaviorId;
  /** The warning sign shown first (territorial warning, #30). */
  sign: string;
  /** The line when the wild Pokémon appears. */
  line: string;
}

export function wildBehavior(content: Content, run: Pick<RunState, 'seed' | 'encountersCompleted' | 'battle'>): WildFraming | null {
  const battle = run.battle;
  if (!battle || battle.kind !== 'wild') return null;
  const foe = battle.enemyTeam[battle.enemyIndex];
  if (!foe) return null;
  const rng = new Rng(hashSeed(`${run.seed}::wildBehavior::${run.encountersCompleted}::${foe.speciesId}`));
  if (!rng.chance(WILD_BEHAVIOR_CHANCE)) return null;
  const total = WILD_BEHAVIORS.reduce((n, b) => n + b.weight, 0);
  let roll = rng.float() * total;
  const def = WILD_BEHAVIORS.find((b) => (roll -= b.weight) < 0) ?? WILD_BEHAVIORS[0]!;
  const name = content.species.get(foe.speciesId)?.name ?? foe.speciesId;
  return { id: def.id, sign: def.sign, line: def.line.replace('%s', name) };
}

/** Multiplier on the catch probability for this wild encounter (1 when it has no behaviour). */
export function wildCatchMultiplier(content: Content, run: Pick<RunState, 'seed' | 'encountersCompleted' | 'battle'>): number {
  const f = wildBehavior(content, run);
  return f ? CATCH_MULTIPLIER[f.id] : 1;
}
