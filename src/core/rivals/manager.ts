// RivalManager: creates a rival from a "Spark" (a memorable loss), deterministically.

import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import type { DomainEvent, Where } from '../story/schema';
import type { Rival, Traits } from '../story/schema';
import { TRAIT_KEYS } from '../story/schema';
import { applyLegacy } from './legacy';
import { RIVAL_ARCS, RIVAL_CONFIG, RIVAL_PATHS, RIVAL_PROFILES } from './schema';

export interface SparkInput {
  where: Where;
  classId: string;
  name: string;
  team: string[];
  /** The battle's end event (its id keeps one battle from creating two rivals). */
  ended: DomainEvent;
  hpLeftShare: number;
  turns: number;
  /** True when none of your Pokémon fainted. */
  flawless: boolean;
  /** A trainer who vowed to return and lost again. */
  returning?: boolean;
}

/** How much the player's win raised this trainer's rival potential. */
export function sparkGain(input: Pick<SparkInput, 'hpLeftShare' | 'flawless'>): number {
  const cfg = RIVAL_CONFIG.spark;
  if (input.flawless) return cfg.flawlessGain;
  if (input.hpLeftShare <= cfg.closeHpShare) return cfg.closeGain;
  return cfg.ordinaryGain;
}

/** Makes the run's rival if this loss is memorable enough and the run has room. Returns it, or null. */
export function maybeSpark(run: RunState, input: SparkInput): Rival | null {
  const rivals = run.story.rivals;
  const id = `rival-${input.ended.id}`;
  if (rivals.length >= RIVAL_CONFIG.maxRivals || rivals.some((r) => r.id === id)) return null;
  const gain = sparkGain(input);
  if (gain < RIVAL_CONFIG.spark.threshold) return null;
  // Its own seeded stream: never touches the gameplay streams.
  const rng = new Rng(hashSeed(`${run.seed}::rival::${id}`));
  const personalityId = rng.pick(Object.keys(RIVAL_PROFILES.personalities).sort());
  const personality = RIVAL_PROFILES.personalities[personalityId]!;
  const styleId = rng.pick(personality.styles);
  const spread = RIVAL_CONFIG.traitSpread;
  const traits = Object.fromEntries(TRAIT_KEYS.map((k) => [k, Math.max(0, Math.min(100, personality.traits[k] + rng.int(-spread, spread)))])) as Traits;
  // Which path led here: the first one whose conditions the battle and the character meet.
  const dominant = input.hpLeftShare >= RIVAL_CONFIG.spark.dominantHpShare && input.turns <= RIVAL_CONFIG.spark.dominantMaxTurns;
  const close = input.hpLeftShare <= RIVAL_CONFIG.spark.closeHpShare;
  const secondInRegion = rivals.some((r) => r.origin.where.region === input.where.region);
  const path = RIVAL_PATHS.paths.find(({ when: w }) =>
    (w.dominant === undefined || w.dominant === dominant) &&
    (w.close === undefined || w.close === close) &&
    (w.returning === undefined || w.returning === Boolean(input.returning)) &&
    (w.secondInRegion === undefined || w.secondInRegion === secondInRegion) &&
    (w.personalities === undefined || w.personalities.includes(personalityId)) &&
    (w.minPride === undefined || traits.pride >= w.minPride) &&
    (w.minAmbition === undefined || traits.ambition >= w.minAmbition) &&
    (w.minRegion === undefined || input.where.region >= w.minRegion))!;
  for (const [k, n] of Object.entries(path.traitNudge)) traits[k as keyof Traits] = Math.max(0, Math.min(100, traits[k as keyof Traits] + n));
  const rival: Rival = {
    id,
    classId: input.classId,
    name: input.name,
    archetype: personalityId,
    style: styleId,
    traits,
    rivalPotential: gain + path.potentialBonus,
    state: 'recognized',
    arc: null,
    away: 0,
    cooldown: 0,
    progress: 0,
    encounters: 0,
    setbacks: 0,
    adaptations: [],
    bonds: {},
    offscreen: [],
    origin: { eventId: input.ended.id, where: input.where, path: path.id },
    memory: { lastBattle: { eventId: input.ended.id, result: 'win', hpLeftShare: input.hpLeftShare, turns: input.turns, team: input.team } },
  };
  const arc = RIVAL_ARCS.arcs.find((a) => a.personalities.includes(personalityId) || a.styles.includes(styleId) || a.paths.includes(path.id));
  if (arc) rival.arc = { id: arc.id, stage: 0, ticks: 0, resolution: null };
  applyLegacy(run, rival);
  rivals.push(rival);
  return rival;
}
