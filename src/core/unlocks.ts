// Permanent unlocks and duplicate compensation (Untitled doc §8.3): a reward that gives a starter set, trainer or title
// the account already owns pays Research Points instead of nothing. A leaf module (no core imports), so any reward path can use it.

import rulesJson from '../data/runRules.json';
import type { Profile } from './state';

export interface Unlocks {
  pool?: string | null;
  trainer?: string | null;
  title?: string | null;
}

/** Adds each unlock the profile lacks; every one it already had pays the duplicate compensation. Returns how many were duplicates. */
export function grantUnlocks(profile: Profile, unlocks: Unlocks): number {
  let duplicates = 0;
  const give = (list: string[], id: string | null | undefined) => {
    if (!id) return;
    if (list.includes(id)) duplicates += 1;
    else list.push(id);
  };
  give(profile.unlockedPools, unlocks.pool);
  give(profile.unlockedArchetypes, unlocks.trainer);
  give(profile.titles, unlocks.title);
  profile.researchPoints += duplicates * rulesJson.duplicateCompensation.researchPoints;
  return duplicates;
}
