// "This Trainer Will Return" (M8.9 Phase 1). A trainer you barely beat (one
// Pokémon left standing, at low HP) vows to come back: it gets an enemy
// profile and waits in the rematch pool. The first ordinary trainer battle of
// a later stage is that trainer instead, with its old team at the new levels
// and an extra member. The hooks decide the vow (core/story/hooks.ts); the run
// asks this file who is waiting when it sets up a battle (core/run.ts).
//
// The returning team is revised on a generator of its own, after the normal
// trainer was planned on the encounter stream, so no other roll changes.

import type { Content } from '../contentSchema';
import { evolvedFormAt, type PlannedMember, type TrainerPlan } from '../encounters';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import type { EnemyProfile, StoryEffectSpec } from './schema';

export type RematchEffect = Extract<StoryEffectSpec, { kind: 'rematch' }>;

/** The story flag that says where a trainer is in its return ("waiting", then "returned"). */
export const returnFlag = (profileId: string) => `return:${profileId}`;

/** The vow's definition and numbers, or null when it is switched off. */
export function rematchRule(content: Content): { id: string; effect: RematchEffect; lowHpShare: number } | null {
  const def = content.story.definitions.find((d) => d.triggerConditions.trigger === 'trainerReturns');
  if (!def || def.effect?.kind !== 'rematch') return null;
  return { id: def.id, effect: def.effect, lowHpShare: def.triggerConditions.lowHpShare ?? 0 };
}

/** Profiles of trainers that vowed to return (waiting or already back). */
export function vowedTrainers(run: RunState): EnemyProfile[] {
  return run.story.enemyProfiles.filter((p) => run.story.flags[returnFlag(p.id)] !== undefined);
}

/** The trainer who vowed first and is still waiting, if it vowed in an earlier stage. */
export function waitingTrainer(run: RunState): EnemyProfile | null {
  return (
    vowedTrainers(run).find((p) => {
      if (run.story.flags[returnFlag(p.id)] !== 'waiting') return false;
      const vow = p.battles[0]?.where;
      return !vow || vow.region !== run.regionIndex || vow.stage !== (run.stage?.index ?? null);
    }) ?? null
  );
}

/**
 * The returning trainer's team: its old Pokémon (evolved if their new level allows) at the
 * levels the planned trainer would have had, plus `levelBonus`, then extra members from the
 * planned team until it has `extraMembers` more than before (or the planned size, if bigger).
 */
export function revisedTeam(content: Content, run: RunState, profile: EnemyProfile, plan: TrainerPlan, effect: RematchEffect): TrainerPlan {
  const rng = new Rng(hashSeed(`${run.seed}::returning::${profile.id}`));
  const last = plan.members.length - 1;
  const levelAt = (i: number) => plan.members[Math.min(i, last)]!.level + effect.levelBonus;
  const members: PlannedMember[] = profile.team.slice(0, 6).map((m, i) => {
    const level = Math.max(levelAt(i), m.level);
    return { speciesId: evolvedFormAt(content, m.speciesId, level, rng), level };
  });
  const target = Math.min(6, Math.max(plan.members.length, profile.team.length + effect.extraMembers));
  for (let i = members.length; members.length < target; i++) {
    const p = plan.members[i] ?? plan.members[i % plan.members.length]!;
    members.push({ speciesId: p.speciesId, level: p.level + effect.levelBonus });
  }
  const levelInfo = members.map((_, i) => plan.levelInfo[Math.min(i, plan.levelInfo.length - 1)]!);
  return { ...plan, classId: profile.trainerId ?? plan.classId, name: profile.name, members, levelInfo };
}
