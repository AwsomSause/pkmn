// The permanent player profile (survives between runs).

import type { Content } from './contentSchema';
import { ATTRIBUTE_NAMES, type Profile, type RunState } from './state';

const FINALIZED_HISTORY = 50;

export function createProfile(content: Content, profileId: string): Profile {
  return {
    profileId,
    unlockedArchetypes: [...content.archetypes.values()].filter((a) => a.unlockedByDefault).map((a) => a.id),
    attributes: Object.fromEntries(ATTRIBUTE_NAMES.map((a) => [a, content.balance.attributeMin])),
    bankCurrency: 0,
    stats: { runsStarted: 0, runsEnded: 0, battlesWon: 0, bestEncounters: 0 },
    finalizedRunIds: [],
  };
}

export function recordRunStarted(profile: Profile): Profile {
  return { ...profile, stats: { ...profile.stats, runsStarted: profile.stats.runsStarted + 1 } };
}

/**
 * Applies a finished run's results to the profile exactly once.
 * If this run id was already applied (e.g. the page was refreshed between
 * saving the profile and clearing the run), nothing changes.
 * Milestone 1 awards statistics only; permanent currency arrives in Milestone 5.
 */
export function finalizeRun(profile: Profile, run: RunState): { profile: Profile; applied: boolean } {
  if (profile.finalizedRunIds.includes(run.runId)) return { profile, applied: false };
  const next: Profile = structuredClone(profile);
  next.stats.runsEnded += 1;
  next.stats.battlesWon += run.log.battlesWon;
  next.stats.bestEncounters = Math.max(next.stats.bestEncounters, run.encountersCompleted);
  next.finalizedRunIds = [...next.finalizedRunIds, run.runId].slice(-FINALIZED_HISTORY);
  return { profile: next, applied: true };
}
