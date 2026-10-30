// What a rival's personality and battle style change (Living Rivalry Engine, Examples §2 and §3).

import type { Rival } from '../story/schema';
import { RIVAL_PROFILES } from './schema';

export const MAX_ADAPTATIONS = 5;

export interface RivalMods {
  /** Added to the level bonus of its return: vindictive rivals come back stronger, forgiving ones a little weaker. */
  levelBonus: number;
  /** Rivals with low adaptability never counter-pick. */
  canAdapt: boolean;
  /** How many adaptations it can make in a run. */
  adaptCap: number;
  /** 0–1: how often it picks its best move. */
  ai: number;
  /** The stats its picks favour. */
  statBias: readonly string[];
}

export function rivalMods(rival: Pick<Rival, 'archetype' | 'style' | 'traits'> & { progress?: number }): RivalMods {
  const t = RIVAL_PROFILES.thresholds;
  const style = RIVAL_PROFILES.styles[rival.style];
  return {
    levelBonus: (rival.traits.vindictiveness >= t.vindictiveBonusAt ? 1 : rival.traits.vindictiveness <= t.forgivingPenaltyAt ? -1 : 0) + (rival.progress ?? 0),
    canAdapt: rival.traits.adaptability >= t.minAdaptability,
    adaptCap: MAX_ADAPTATIONS + (style?.extraAdaptations ?? 0),
    ai: style?.ai ?? 0,
    statBias: style?.statBias ?? [],
  };
}
