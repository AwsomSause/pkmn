// Bond values for the Battle Drama Engine (guide Phase 7). The full Bond Engine
// is not built, so these are derived from what is real: a rival's traits and its
// record with you. Non-rivals get neutral values. They change who may speak or
// what happens in a scene; they never add hidden stat bonuses.

import type { Rival } from '../story/schema';

export interface Bond {
  trust: number;
  affection: number;
  respect: number;
  synchronization: number;
  confidence: number;
  autonomy: number;
  strain: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const NEUTRAL_BOND: Bond = { trust: 50, affection: 50, respect: 50, synchronization: 50, confidence: 50, autonomy: 50, strain: 0 };

export function rivalBond(rival: Rival | undefined, speciesId?: string): Bond {
  if (!rival) return NEUTRAL_BOND;
  // The rival Pokémon's own bond (core/rivals/bonds.ts) when it has one; otherwise what its trainer's traits imply.
  const real = speciesId ? rival.bonds?.[speciesId] : undefined;
  if (real) return { trust: clamp(real.trust), affection: clamp(real.affection), respect: clamp(real.respect), synchronization: clamp(real.synchronization), confidence: clamp(real.confidence), autonomy: clamp(real.autonomy), strain: clamp(real.strain) };
  const t = rival.traits;
  return {
    trust: clamp(t.empathy),
    affection: clamp(t.empathy * 0.6 + (rival.state === 'ally' ? 30 : 0)),
    respect: clamp(100 - t.pride + rival.encounters * 5),
    synchronization: clamp(t.adaptability),
    confidence: clamp(t.resilience - rival.setbacks * 10),
    autonomy: clamp(t.ambition),
    strain: clamp(rival.setbacks * 15 + t.vindictiveness / 3),
  };
}
