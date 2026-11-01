// Modifier Run (idea F77): every `every` completed encounters the player picks 1 of 3 blessings/curses.
// Pure: the three offered come from the run seed and the pick number, never from a gameplay stream.

import { z } from 'zod';
import data from '../data/mutators.json';
import { hashSeed, Rng } from './rng';
import type { RunState } from './state';

const MutatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['blessing', 'curse']),
  blurb: z.string(),
  money: z.number().positive().optional(),
  xp: z.number().positive().optional(),
  catch: z.number().positive().optional(),
  enemyLevel: z.number().int().optional(),
  rewardBonus: z.number().min(0).optional(),
});
export type Mutator = z.infer<typeof MutatorSchema>;
const DataSchema = z.object({ note: z.string(), every: z.number().int().min(1), choices: z.number().int().min(2), mutators: z.array(MutatorSchema).min(3) });
export const MUTATORS = DataSchema.parse(data);

export const getMutator = (id: string): Mutator | undefined => MUTATORS.mutators.find((m) => m.id === id);
const picked = (run: Pick<RunState, 'mutators'>): Mutator[] => (run.mutators ?? []).flatMap((id) => getMutator(id) ?? []);
const product = (run: Pick<RunState, 'mutators'>, key: 'money' | 'xp' | 'catch'): number => picked(run).reduce((n, m) => n * (m[key] ?? 1), 1);
export const mutatorMoney = (run: Pick<RunState, 'mutators'>): number => product(run, 'money');
export const mutatorXp = (run: Pick<RunState, 'mutators'>): number => product(run, 'xp');
export const mutatorCatch = (run: Pick<RunState, 'mutators'>): number => product(run, 'catch');

/** True when this completed-encounter count is a pick point (in a mode that asks for them). */
export const mutatorDue = (every: number | undefined, encountersCompleted: number): boolean => !!every && encountersCompleted > 0 && encountersCompleted % every === 0;

/** The offer for pick number `n` (0-based): three different mutators, never one already taken, with a blessing and a curse among them. */
export function mutatorOffer(run: Pick<RunState, 'seed' | 'mutators'>, n: number): string[] {
  const rng = new Rng(hashSeed(`${run.seed}::mutator::${n}`));
  const free = MUTATORS.mutators.filter((m) => !(run.mutators ?? []).includes(m.id));
  const pool = free.length >= MUTATORS.choices ? free : MUTATORS.mutators;
  const blessing = rng.pick(pool.filter((m) => m.kind === 'blessing'));
  const curse = rng.pick(pool.filter((m) => m.kind === 'curse'));
  const rest = rng.shuffle(pool.filter((m) => m !== blessing && m !== curse)).slice(0, MUTATORS.choices - 2);
  return rng.shuffle([blessing, curse, ...rest]).map((m) => m.id);
}

/** Takes the pick: remembers it and applies its level and reward changes to the run's rules (mutates `run`). */
export function applyMutator(run: RunState, id: string): Mutator {
  const m = getMutator(id);
  if (!m) throw new Error(`Unknown modifier "${id}"`);
  run.mutators = [...(run.mutators ?? []), id];
  run.rules = {
    ...run.rules,
    enemyLevelBonus: run.rules.enemyLevelBonus + (m.enemyLevel ?? 0),
    rewardMultiplier: run.rules.progressionEligible ? Math.round((run.rules.rewardMultiplier + (m.rewardBonus ?? 0)) * 100) / 100 : run.rules.rewardMultiplier,
  };
  return m;
}
