// Game modes, difficulty, modifiers, Death-Block (Untitled doc §13–16, Phase E).
// The choices are copied into the run (`run.rules`) when it starts and never change; rewards use that snapshot.

import { z } from 'zod';
import rulesJson from '../data/runRules.json';
import type { RunRules, RunState } from './state';

const Status = z.enum(['supported', 'planned']);
export const RunRulesDataSchema = z.object({
  note: z.string(),
  ruleVersion: z.number().int().min(1),
  multiplierCap: z.number().min(1),
  difficulties: z.array(z.object({ id: z.string(), name: z.string(), blurb: z.string(), multiplier: z.number().min(0), enemyLevelBonus: z.number().int() })).min(1),
  deathBlock: z.object({ battles: z.number().int().min(1), multiplier: z.number().min(0), rule: z.string() }),
  modifiers: z.array(z.object({ id: z.string(), name: z.string(), status: Status, bonus: z.number().min(0), blurb: z.string(), disables: z.array(z.enum(['mega', 'tera', 'zmove', 'dynamax'])).optional(), startScale: z.number().min(0).max(1).optional() })),
  modes: z.array(z.object({ id: z.string(), name: z.string(), status: Status, progressionEligible: z.boolean(), checkpoints: z.boolean(), wipeMoneyLoss: z.number().min(0).max(1).optional(), blurb: z.string() })).min(1),
});
export const RUN_RULES = RunRulesDataSchema.parse(rulesJson);

export interface RulesChoice {
  modeId: string;
  difficultyId: string;
  modifierIds: readonly string[];
  deathBlock: boolean;
}
export const STANDARD_CHOICE: RulesChoice = { modeId: 'standard', difficultyId: 'standard', modifierIds: [], deathBlock: false };

export const getMode = (id: string) => RUN_RULES.modes.find((m) => m.id === id);
export const getDifficulty = (id: string) => RUN_RULES.difficulties.find((d) => d.id === id);
export const getModifier = (id: string) => RUN_RULES.modifiers.find((m) => m.id === id);

/** Why a choice cannot start, or null. Planned modes and modifiers are listed but not playable. */
export function rulesProblem(choice: RulesChoice): string | null {
  const mode = getMode(choice.modeId);
  if (!mode) return `Unknown mode "${choice.modeId}"`;
  if (mode.status !== 'supported') return `${mode.name} is not available yet`;
  if (!getDifficulty(choice.difficultyId)) return `Unknown difficulty "${choice.difficultyId}"`;
  if (new Set(choice.modifierIds).size !== choice.modifierIds.length) return 'A modifier is chosen twice';
  for (const id of choice.modifierIds) {
    const m = getModifier(id);
    if (!m) return `Unknown modifier "${id}"`;
    if (m.status !== 'supported') return `${m.name} is not available yet`;
  }
  return null;
}

/**
 * The reward multiplier: difficulty × (1 + the modifiers' bonuses), capped, then Death-Block's cut.
 * Adventure earns no account rewards, so its multiplier is 0 for them (it is 1 for in-run rewards, which are not multiplied).
 */
export function rewardMultiplier(choice: RulesChoice): number {
  const mode = getMode(choice.modeId);
  if (!mode?.progressionEligible) return 0;
  const difficulty = getDifficulty(choice.difficultyId)?.multiplier ?? 1;
  const bonus = choice.modifierIds.reduce((sum, id) => sum + (getModifier(id)?.bonus ?? 0), 0);
  const capped = Math.min(RUN_RULES.multiplierCap, difficulty * (1 + bonus));
  const total = choice.deathBlock ? capped * RUN_RULES.deathBlock.multiplier : capped;
  return Math.round(total * 100) / 100;
}

/** The snapshot stored in the run. Throws on a choice that cannot start. */
export function makeRules(choice: RulesChoice): RunRules {
  const problem = rulesProblem(choice);
  if (problem) throw new Error(problem);
  return {
    ruleVersion: RUN_RULES.ruleVersion,
    modeId: choice.modeId,
    difficultyId: choice.difficultyId,
    modifierIds: [...choice.modifierIds],
    deathBlock: choice.deathBlock,
    deathBlockUsed: false,
    progressionEligible: getMode(choice.modeId)!.progressionEligible,
    rewardMultiplier: rewardMultiplier(choice),
    enemyLevelBonus: getDifficulty(choice.difficultyId)!.enemyLevelBonus,
    wipes: 0,
  };
}

/** The same rules a run without a `rules` record always had. */
export const standardRules = (): RunRules => makeRules(STANDARD_CHOICE);

/** Transformations the modifiers switch off. */
export function disabledByRules(rules: RunRules): ('mega' | 'tera' | 'zmove' | 'dynamax')[] {
  return [...new Set(rules.modifierIds.flatMap((id) => getModifier(id)?.disables ?? []))];
}

/** Scales a starting amount (money, items) by the modifiers. */
export function startScale(rules: RunRules): number {
  return rules.modifierIds.reduce((s, id) => s * (getModifier(id)?.startScale ?? 1), 1);
}

/** Whether a checkpoint should be kept now: Adventure always, Death-Block until it is used or the first battles are over. */
export function wantsCheckpoint(run: Pick<RunState, 'rules' | 'encountersCompleted'>): boolean {
  if (getMode(run.rules.modeId)?.checkpoints) return true;
  return run.rules.deathBlock && !run.rules.deathBlockUsed && run.encountersCompleted < RUN_RULES.deathBlock.battles;
}

/** Account-level rewards are scaled by the snapshot's multiplier. */
export const scaleReward = (amount: number, rules: RunRules): number => Math.round(amount * rules.rewardMultiplier);

/** The lines shown before launch: what you are choosing and what it does to rewards. */
export function rulesLines(choice: RulesChoice): string[] {
  const mode = getMode(choice.modeId);
  const difficulty = getDifficulty(choice.difficultyId);
  const lines = [`Mode: ${mode?.name ?? choice.modeId} - ${mode?.blurb ?? ''}`, `Difficulty: ${difficulty?.name ?? choice.difficultyId} - ${difficulty?.blurb ?? ''}`];
  for (const id of choice.modifierIds) lines.push(`Modifier: ${getModifier(id)?.name ?? id} - ${getModifier(id)?.blurb ?? ''}`);
  if (choice.deathBlock) lines.push(`Death-Block on: ${RUN_RULES.deathBlock.rule}`);
  lines.push(mode?.progressionEligible ? `Reward multiplier: x${rewardMultiplier(choice).toFixed(2)}` : 'No Bank Credits, Research Points, candies, unlocks or achievements in this mode.');
  return lines;
}
