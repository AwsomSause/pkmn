// What a battle does to a rival (Living Rivalry Engine §5): it climbs the ladder, may be shaken,
// may accept your lead and become an ally, may retire; losing never deletes it.

import type { Rival } from '../story/schema';
import { RIVAL_CONFIG } from './schema';

/** The ladder rung its rivalry potential and character earn. */
export function stateFor(rival: Pick<Rival, 'rivalPotential' | 'traits'>): Rival['state'] {
  const s = RIVAL_CONFIG.states;
  if (rival.rivalPotential >= s.contenderAt && rival.traits.ambition >= s.contenderMinAmbition) return 'contender';
  if (rival.rivalPotential >= s.nemesisAt && rival.traits.vindictiveness >= s.nemesisMinVindictiveness) return 'nemesis';
  if (rival.rivalPotential >= s.activeAt) return 'active';
  if (rival.rivalPotential >= s.recurringAt) return 'recurring';
  return 'recognized';
}

export type Outcome = 'grew' | 'shaken' | 'ally' | 'retired';

/** You beat the rival again: its potential rose by `gain`. Returns what became of it. */
export function applyDefeat(rival: Rival, gain: number): Outcome {
  const o = RIVAL_CONFIG.outcomes;
  rival.encounters += 1;
  rival.rivalPotential += gain;
  const t = rival.traits;
  // A gracious rival accepts your lead and becomes your ally.
  if (rival.encounters >= o.allyMinEncounters && rival.rivalPotential >= o.allyAt && t.empathy >= o.allyMinEmpathy && t.pride <= o.allyMaxPride) {
    rival.state = 'ally';
    return 'ally';
  }
  // A fragile one is shaken: its drive drops, and after enough setbacks it steps away.
  if (t.resilience <= o.discourageMaxResilience) {
    rival.setbacks += 1;
    rival.rivalPotential = Math.max(0, rival.rivalPotential - o.discourageLoss);
    if (rival.setbacks >= o.retireAtSetbacks) {
      rival.state = 'retired';
      return 'retired';
    }
    rival.state = stateFor(rival);
    return 'shaken';
  }
  rival.state = stateFor(rival);
  return 'grew';
}

/** Allies and retired rivals no longer come back to fight you. */
export const isHostile = (rival: Pick<Rival, 'state'>): boolean => rival.state !== 'ally' && rival.state !== 'retired';
