// The permanent player profile (survives between runs).

import { archiveRivals } from './rivals/legacy';
import type { Content } from './contentSchema';
import { applyRunToProfile, type RunEndSummary } from './progress';
import { archiveParty } from './story/reunion';
import { ATTRIBUTE_NAMES, type Profile, type RunState } from './state';

const FINALIZED_HISTORY = 50;

export function createProfile(content: Content, profileId: string): Profile {
  return {
    profileId,
    unlockedArchetypes: [...content.archetypes.values()].filter((a) => a.unlockedByDefault).map((a) => a.id),
    attributes: Object.fromEntries(ATTRIBUTE_NAMES.map((a) => [a, content.balance.attributeMin])),
    bankCredits: 0,
    researchPoints: 0,
    candies: 0,
    stats: { runsStarted: 0, runsEnded: 0, battlesWon: 0, bestEncounters: 0 },
    counters: {},
    best: {},
    speciesSeen: [],
    speciesCaught: [],
    speciesShiny: [],
    achievements: {},
    titles: [],
    activeTitle: null,
    cardFrame: 'classic',
    lifetimeBankCredits: 0,
    runHistory: [],
    lastPayout: null,
    unlockedPools: [],
    licenses: [],
    presets: [],
    lastPrep: null,
    finalizedRunIds: [],
    pastPokemon: [],
    rivalArchive: [],
    claims: {},
    trainerCounters: {},
    trainerBest: {},
    mastery: {},
    gameEvents: {},
  };
}

export function recordRunStarted(profile: Profile): Profile {
  return { ...profile, stats: { ...profile.stats, runsStarted: profile.stats.runsStarted + 1 } };
}

/**
 * Applies a finished run's results to the profile exactly once.
 * If this run id was already applied (e.g. the page was refreshed between
 * saving the profile and clearing the run), nothing changes.
 * Candies earned during the run are added to the permanent profile (D7);
 * then the Bank payout, discoveries, achievements and Run History
 * (core/progress.ts).
 */
export function finalizeRun(
  content: Content,
  profile: Profile,
  run: RunState,
  now: string = new Date().toISOString(),
): { profile: Profile; applied: boolean; summary: RunEndSummary | null } {
  if (profile.finalizedRunIds.includes(run.runId)) return { profile, applied: false, summary: null };
  const next: Profile = structuredClone(profile);
  next.stats.runsEnded += 1;
  // Adventure runs add nothing permanent (Untitled doc §15.2); the rest keep their candies.
  if (run.rules.progressionEligible) next.candies += run.candies;
  next.stats.battlesWon += run.log.battlesWon;
  next.stats.bestEncounters = Math.max(next.stats.bestEncounters, run.encountersCompleted);
  const summary = applyRunToProfile(content, next, run, now);
  archiveParty(content, next, run);
  archiveRivals(next, run);
  next.finalizedRunIds = [...next.finalizedRunIds, run.runId].slice(-FINALIZED_HISTORY);
  return { profile: next, applied: true, summary };
}
