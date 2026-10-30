// Permanent progression (GAME_DESIGN.md §14): counters, discoveries,
// achievements, trainer unlocks and the Bank's run-end payout.
//
// Every unlock uses the same four parts:
//   requirement — data (contentSchema RequirementSchema), checked against the profile
//   progress    — requirementProgress() says how far along the player is
//   reward      — data (UnlockRewardSchema) paid out once
//   claim       — achievements are claimed automatically when a run ends;
//                 trainers are claimed in the Trainer Archive (some cost Bank Credits)

import { getArchetype, researchMultiplier } from './archetypes';
import { eventResearch } from './events';
import { permanentAttributes, readAttributes, type Attributes } from './attributes';
import { getCampaign } from './regions';
import { researchScale, scaleReward } from './rules';
import type { Achievement, Archetype, Content, Requirement, RunQuest, UnlockReward } from './contentSchema';
import type { Payout, Profile, RunState } from './state';
import { topMoments } from './story/record';
import { recordMastery, type MasteryRankUp } from './mastery';
import { addTrainerCounters, awardQuestSteps, questTrainer, runQuestOf, runQuestProgress, type QuestStepDone } from './quests';

/** Adds to one of this run's counters (mutates `run`). */
export function count(run: RunState, counter: string, amount = 1): void {
  if (amount <= 0) return;
  run.log.counters[counter] = (run.log.counters[counter] ?? 0) + amount;
}

/** Remembers species met or caught this run (mutates `run`). */
export function discover(run: RunState, speciesId: string, caught: boolean): void {
  if (!run.log.speciesSeen.includes(speciesId)) run.log.speciesSeen.push(speciesId);
  if (caught && !run.log.speciesCaught.includes(speciesId)) run.log.speciesCaught.push(speciesId);
}

export interface RequirementProgress {
  current: number;
  target: number;
  met: boolean;
}

export function requirementProgress(profile: Profile, req: Requirement): RequirementProgress {
  let current: number;
  let target: number;
  switch (req.kind) {
    case 'total':
      current = profile.counters[req.counter] ?? 0;
      target = req.atLeast;
      break;
    case 'best':
      current = profile.best[req.counter] ?? 0;
      target = req.atLeast;
      break;
    case 'distinct':
      current = profile[req.set].length;
      target = req.atLeast;
      break;
    case 'achievement':
      current = profile.achievements[req.id] ? 1 : 0;
      target = 1;
      break;
  }
  return { current: Math.min(current, target), target, met: current >= target };
}

function applyReward(profile: Profile, reward: UnlockReward): void {
  profile.bankCredits += reward.bankCredits;
  profile.lifetimeBankCredits += reward.bankCredits;
  profile.researchPoints += reward.researchPoints;
  profile.candies += reward.candies;
  if (reward.title && !profile.titles.includes(reward.title)) profile.titles.push(reward.title);
}

/**
 * Awards every achievement whose requirement is now met and pays its reward
 * (mutates `profile`). An achievement is only ever awarded once.
 */
export function awardAchievements(content: Content, profile: Profile, now: string): Achievement[] {
  const earned: Achievement[] = [];
  // Repeat, because one achievement can be another's requirement.
  for (let changed = true; changed; ) {
    changed = false;
    for (const a of content.achievements.values()) {
      if (profile.achievements[a.id] || !requirementProgress(profile, a.requirement).met) continue;
      profile.achievements[a.id] = { earnedAt: now };
      applyReward(profile, a.reward);
      earned.push(a);
      changed = true;
    }
  }
  return earned;
}

/** The Bank's payout for a finished run: savings from leftover money plus a stipend for progress. */
export function runPayout(content: Content, run: RunState): Omit<Payout, 'achievements' | 'total'> {
  const { moneyConversionRate, stipend } = content.balance.bank;
  const c = run.log.counters;
  const savings = Math.floor(run.money * moneyConversionRate);
  const earned =
    stipend.perRun +
    stipend.perEncounter * run.encountersCompleted +
    stipend.perBadge * run.badges.length +
    stipend.perEliteFour * (c.eliteFourDefeated ?? 0) +
    stipend.perChampion * (c.championsDefeated ?? 0) +
    stipend.perRegion * run.regionsCleared.length;
  return { savings, stipend: Math.floor(earned) };
}

export interface RunEndSummary {
  payout: Payout;
  researchPoints: number;
  newSpeciesSeen: string[];
  newSpeciesCaught: string[];
  achievements: Achievement[];
  /** Trainers whose requirement became met with this run (they can now be claimed). */
  trainersReady: Archetype[];
  /** Permanent attributes before and after this run (they grow from lifetime counters). */
  attributesBefore: Attributes;
  attributesAfter: Attributes;
  /** Trainer quest steps finished by this run, in order. */
  questSteps: QuestStepDone[];
  /** The Run Quest, when this run finished it. */
  runQuestDone: RunQuest | null;
  /** Species Mastery ranks reached by this run (each paid once). */
  masteryUps: MasteryRankUp[];
}

/**
 * Adds a finished run to the profile (mutates `profile`): counters, bests,
 * discoveries and Research Points (only for campaigns that count for
 * progress), the Bank payout, achievements and the Run History entry.
 */
export function applyRunToProfile(content: Content, profile: Profile, run: RunState, now: string): RunEndSummary {
  // Adventure earns nothing for the account; test campaigns count nothing either.
  const counts = getCampaign(content, run.campaignId).countsForProgress && run.rules.progressionEligible;
  const readyBefore = new Set(trainersReadyToClaim(content, profile).map((a) => a.id));
  const research = content.balance.research;
  const attributesBefore = readAttributes(content, profile.attributes);
  let researchPoints = 0;
  let newSpeciesSeen: string[] = [];
  let newSpeciesCaught: string[] = [];

  // The Run Quest: done when its counter reached the goal; it pays Research Points and counts for quest lines.
  const runQuest = runQuestOf(content, run);
  const runQuestDone = counts && runQuest !== null && runQuestProgress(content, run)!.met;
  if (counts) {
    const runCounters = { ...run.log.counters, runsFinished: 1, runsWon: run.victory ? 1 : 0, ...(runQuestDone ? { runQuestsDone: (run.log.counters.runQuestsDone ?? 0) + 1 } : {}) };
    for (const [name, value] of Object.entries(runCounters)) {
      if (value <= 0) continue;
      profile.counters[name] = (profile.counters[name] ?? 0) + value;
      profile.best[name] = Math.max(profile.best[name] ?? 0, value);
    }
    newSpeciesSeen = run.log.speciesSeen.filter((id) => !profile.speciesSeen.includes(id));
    newSpeciesCaught = run.log.speciesCaught.filter((id) => !profile.speciesCaught.includes(id));
    profile.speciesSeen.push(...newSpeciesSeen);
    profile.speciesCaught.push(...newSpeciesCaught);
    researchPoints = Math.round(
      (research.perSpeciesSeen * newSpeciesSeen.length +
        research.perSpeciesCaught * newSpeciesCaught.length +
        research.perShiny * (run.log.counters.shiniesFound ?? 0)) *
        researchMultiplier(getArchetype(content, run.archetypeId)),
    ) + eventResearch(run);
    researchPoints = scaleReward(Math.round(researchPoints * researchScale(run.rules)), run.rules);
    if (runQuestDone) researchPoints += runQuest.researchPoints;
    profile.researchPoints += researchPoints;
    profile.attributes = permanentAttributes(content, profile);
    addTrainerCounters(profile, questTrainer(content, run.archetypeId), runCounters);
  }
  const questSteps = counts ? awardQuestSteps(content, profile, questTrainer(content, run.archetypeId), now) : [];
  const masteryUps = counts ? recordMastery(content, profile, run, now) : [];

  const raw = runPayout(content, run);
  // The multiplier fixed at the start (0 for Adventure). It scales savings and the stipend, not achievements.
  const base = run.rules.progressionEligible ? { savings: scaleReward(raw.savings, run.rules), stipend: scaleReward(raw.stipend, run.rules) } : { savings: 0, stipend: 0 };
  const creditsBefore = profile.bankCredits;
  profile.bankCredits += base.savings + base.stipend;
  profile.lifetimeBankCredits += base.savings + base.stipend;
  const achievements = counts ? awardAchievements(content, profile, now) : [];
  const achievementCredits = achievements.reduce((sum, a) => sum + a.reward.bankCredits, 0);
  const payout: Payout = { ...base, achievements: achievementCredits, total: profile.bankCredits - creditsBefore };
  profile.lastPayout = payout;

  profile.runHistory = [
    {
      runId: run.runId,
      endedAt: now,
      seed: run.seed,
      archetypeId: run.archetypeId,
      campaignId: run.campaignId,
      victory: run.victory,
      regionsCleared: run.regionsCleared.length,
      regions: run.regionOrder.length,
      badges: run.badges.length,
      encounters: run.encountersCompleted,
      defeatedBy: run.log.defeatedBy,
      party: run.party.map((m) => ({ speciesId: m.speciesId, level: m.level })),
      bankCredits: payout.total,
      researchPoints: researchPoints + achievements.reduce((sum, a) => sum + a.reward.researchPoints, 0),
      achievements: achievements.map((a) => a.id),
      moments: topMoments(run.story).map((m) => m.text),
    },
    ...profile.runHistory,
  ].slice(0, content.balance.runHistorySize);

  const trainersReady = trainersReadyToClaim(content, profile).filter((a) => !readyBefore.has(a.id));
  const attributesAfter = readAttributes(content, profile.attributes);
  return { payout, researchPoints, newSpeciesSeen, newSpeciesCaught, achievements, trainersReady, attributesBefore, attributesAfter, questSteps, runQuestDone: runQuestDone ? runQuest : null, masteryUps };
}

export type TrainerStatus = 'unlocked' | 'claimable' | 'locked' | 'comingLater';

/** Where a trainer stands in the Trainer Archive. */
export function trainerStatus(profile: Profile, archetype: Archetype): TrainerStatus {
  // A Trainer Evolution unlocks when its base trainer's quest line is finished (claim "evolution:<base>").
  if (archetype.evolvedFrom) return profile.claims?.[`evolution:${archetype.evolvedFrom}`] ? 'unlocked' : archetype.available ? 'locked' : 'comingLater';
  if (archetype.unlockedByDefault || profile.unlockedArchetypes.includes(archetype.id)) return 'unlocked';
  if (!archetype.available) return 'comingLater';
  if (archetype.unlock && requirementProgress(profile, archetype.unlock).met) return 'claimable';
  return 'locked';
}

export function trainersReadyToClaim(content: Content, profile: Profile): Archetype[] {
  return [...content.archetypes.values()].filter((a) => trainerStatus(profile, a) === 'claimable');
}

/** Why a trainer can't be claimed right now, or null if it can. */
export function claimProblem(profile: Profile, archetype: Archetype): string | null {
  const status = trainerStatus(profile, archetype);
  if (status === 'unlocked') return `${archetype.name} is already on your team.`;
  if (status === 'comingLater') return `${archetype.name} arrives in a later update.`;
  if (status === 'locked') return `Not yet: ${archetype.unlockText}.`;
  if (profile.bankCredits < archetype.unlockCost) return `You need ${archetype.unlockCost} Bank Credits (you have ${profile.bankCredits}).`;
  return null;
}

/** Claims a trainer whose requirement is met, paying its Bank Credit cost. Returns a new profile. */
export function claimTrainer(content: Content, current: Profile, archetypeId: string): Profile {
  const archetype = content.archetypes.get(archetypeId);
  if (!archetype) throw new Error(`Unknown trainer "${archetypeId}"`);
  const problem = claimProblem(current, archetype);
  if (problem) throw new Error(problem);
  const profile = structuredClone(current);
  profile.bankCredits -= archetype.unlockCost;
  profile.unlockedArchetypes.push(archetype.id);
  return profile;
}

/** Shows an earned title on the profile (or none). Returns a new profile. */
export function setActiveTitle(current: Profile, title: string | null): Profile {
  if (title !== null && !current.titles.includes(title)) throw new Error(`Title "${title}" isn't earned yet`);
  return { ...current, activeTitle: title };
}
