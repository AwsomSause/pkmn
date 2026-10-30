// Game modes, difficulty, modifiers, Death-Block (Untitled doc §13–16, Phase E).
// The choices are copied into the run (`run.rules`) when it starts and never change; rewards use that snapshot.

import { z } from 'zod';
import rulesJson from '../data/runRules.json';
import type { Content, TypeName } from './contentSchema';
import { getSpecies } from './pokemon';
import { hashSeed, Rng } from './rng';
import { poolTypes } from './runPrep';
import type { RunRules, RunState } from './state';
import { wildEligibleSpecies } from './themes';

const Status = z.enum(['supported', 'planned']);
export const RunRulesDataSchema = z.object({
  note: z.string(),
  ruleVersion: z.number().int().min(1),
  multiplierCap: z.number().min(1),
  difficulties: z.array(z.object({ id: z.string(), name: z.string(), blurb: z.string(), multiplier: z.number().min(0), enemyLevelBonus: z.number().int() })).min(1),
  deathBlock: z.object({ battles: z.number().int().min(1), multiplier: z.number().min(0), rule: z.string() }),
  modifiers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: Status,
      bonus: z.number().min(0),
      blurb: z.string(),
      /** Modifiers in one group cannot be picked together (they would stack into the same part of the game). */
      group: z.string(),
      disables: z.array(z.enum(['mega', 'tera', 'zmove', 'dynamax'])).optional(),
      startScale: z.number().min(0).max(1).optional(),
      /** Every Pokémon you keep shares a type with your starter. */
      lockType: z.boolean().optional(),
      /** Wild and trainer Pokémon come from one generation picked from the seed. */
      lockGeneration: z.boolean().optional(),
      battleMoney: z.number().min(0).optional(),
      enemyLevel: z.number().int().optional(),
      researchScale: z.number().min(0).optional(),
      blind: z.boolean().optional(),
      noRevives: z.boolean().optional(),
      randomDraft: z.boolean().optional(),
      campaignId: z.string().optional(),
      eventChance: z.number().min(0).optional(),
      partyCap: z.number().int().min(1).max(6).optional(),
      noDuplicates: z.boolean().optional(),
    }),
  ),
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
  const groups = choice.modifierIds.map((id) => getModifier(id)!.group);
  const clash = groups.find((g, i) => groups.indexOf(g) !== i);
  if (clash) return `Two modifiers of the same kind ("${clash}") cannot be combined`;
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
    enemyLevelBonus: getDifficulty(choice.difficultyId)!.enemyLevelBonus + choice.modifierIds.reduce((n, id) => n + (getModifier(id)?.enemyLevel ?? 0), 0),
    lockType: null,
    lockGeneration: null,
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

// ---------- what each modifier does ----------

const has = (rules: Pick<RunRules, 'modifierIds'>, pick: (m: NonNullable<ReturnType<typeof getModifier>>) => unknown) => rules.modifierIds.some((id) => pick(getModifier(id)!));
const product = (rules: Pick<RunRules, 'modifierIds'>, pick: (m: NonNullable<ReturnType<typeof getModifier>>) => number | undefined) =>
  rules.modifierIds.reduce((n, id) => n * (pick(getModifier(id)!) ?? 1), 1);

export const blindMap = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.blind);
export const noRevives = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.noRevives);
export const battleMoneyScale = (rules: Pick<RunRules, 'modifierIds'>): number => product(rules, (m) => m.battleMoney);
export const researchScale = (rules: Pick<RunRules, 'modifierIds'>): number => product(rules, (m) => m.researchScale);
export const eventChanceScale = (rules: Pick<RunRules, 'modifierIds'>): number => product(rules, (m) => m.eventChance);
export const wantsRandomDraft = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.randomDraft);
export const wantsGenerationLock = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.lockGeneration);
export const wantsTypeLock = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.lockType);
/** A modifier's own campaign (Boss Rush), or null. */
export const rulesCampaign = (choice: Pick<RulesChoice, 'modifierIds'>): string | null => choice.modifierIds.map((id) => getModifier(id)?.campaignId).find(Boolean) ?? null;

/** How many Pokémon the party may hold. */
export function partyCap(content: Content, rules: Pick<RunRules, 'modifierIds'>): number {
  return rules.modifierIds.reduce((cap, id) => Math.min(cap, getModifier(id)?.partyCap ?? cap), content.balance.partyMax);
}

/** The first evolution stage of a species (the "line" for No Duplicate Species). */
function lineRoot(content: Content, speciesId: string): string {
  let id = speciesId;
  for (let guard = 0; guard < 6; guard++) {
    const from = [...content.species.values()].find((s) => s.evolutions.some((e) => e.to === id));
    if (!from) return id;
    id = from.id;
  }
  return id;
}

/** Why a Pokémon cannot join the party under this run's modifiers, or null. */
export function joinProblem(content: Content, run: Pick<RunState, 'rules' | 'party'>, speciesId: string, replacing?: string): string | null {
  const species = getSpecies(content, speciesId);
  if (run.rules.lockType && !species.types.includes(run.rules.lockType as TypeName)) return `Monotype: only ${run.rules.lockType}-type Pokémon can join`;
  if (has(run.rules, (m) => m.noDuplicates)) {
    const root = lineRoot(content, speciesId);
    if (run.party.some((p) => p.uid !== replacing && lineRoot(content, p.speciesId) === root)) return 'No Duplicate Species: you already have this line';
  }
  return null;
}

/** The generation of a Single Region Dex run: a seeded pick among generations with plenty of wild Pokémon. */
export function pickGeneration(content: Content, seed: string): number {
  const counts = new Map<number, number>();
  for (const s of wildEligibleSpecies(content)) counts.set(s.generation, (counts.get(s.generation) ?? 0) + 1);
  const gens = [...counts].filter(([, n]) => n >= 40).map(([g]) => g).sort((a, b) => a - b);
  return gens[new Rng(hashSeed(`${seed}::generation`)).int(0, gens.length - 1)]!;
}

/** A species outside the locked generation is swapped for one of the same type from inside it (seeded by `key`, never a gameplay stream). */
export function lockSpecies(content: Content, run: Pick<RunState, 'rules' | 'seed'>, speciesId: string, key: string): string {
  const gen = run.rules.lockGeneration;
  const species = getSpecies(content, speciesId);
  if (!gen || species.generation === gen) return speciesId;
  const inside = wildEligibleSpecies(content).filter((s) => s.generation === gen);
  const same = inside.filter((s) => s.types.some((t) => species.types.includes(t)));
  const pool = same.length > 0 ? same : inside;
  return pool[new Rng(hashSeed(`${run.seed}::genlock::${key}`)).int(0, pool.length - 1)]!.id;
}

/** Random Draft: a draft rule with no license, picked from the seed (a Type Focus rule also gets a type from the pool). */
export function randomDraft(content: Content, seed: string, prep: { poolId: string }): { draftRuleId: string; typeFocus: TypeName | null } {
  const rules = [...content.draftRules.values()].filter((r) => r.license === null && r.kind !== 'blind');
  const rng = new Rng(hashSeed(`${seed}::random-draft`));
  const rule = rules[rng.int(0, rules.length - 1)]!;
  const types = rule.kind === 'typeFocus' ? poolTypes(content, content.starterPools.get(prep.poolId)!) : [];
  return { draftRuleId: rule.id, typeFocus: types.length > 0 ? types[rng.int(0, types.length - 1)]! : null };
}
