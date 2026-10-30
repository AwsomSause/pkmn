// Wild Pokémon with identity (catalog #26, #27, #30): a first-impression behaviour and, for territorial ones, a warning sign.
// Narrative framing only: it never changes the battle, catch rates or any run stream. Seeded by run seed, encounter and species.

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
