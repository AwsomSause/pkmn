// Run-Prep (GAME_DESIGN.md §14.5, §14.7): starter pools and the Starter
// Laboratory, draft rules, preparation tokens, Bank licenses, loadout presets
// and the Run Build Summary. These choices open up options; none of them
// makes the player's Pokémon stronger.

import { getArchetype } from './archetypes';
import type { Archetype, Content, DraftRule, License, PrepToken, StarterPool, TypeName } from './contentSchema';
import { requirementProgress } from './progress';
import type { Rng } from './rng';
import type { LoadoutPreset, Profile, RunPrep } from './state';

// ---------- starter pools ----------

/** The pool's species that are in the game and first-stage, without repeats, in data order. */
export function eligibleSpecies(content: Content, pool: StarterPool): string[] {
  return [...new Set(pool.species)].filter((id) => content.species.get(id)?.evolutionStage === 1);
}

/**
 *   unlocked     — can be used on the Preparation Desk
 *   buyable      — can be bought with Research Points now
 *   needsLicense — a Bank license must be bought first
 *   locked       — its requirement isn't met yet
 *   comingLater  — too few of its species are in the game yet
 */
export type PoolStatus = 'unlocked' | 'buyable' | 'needsLicense' | 'locked' | 'comingLater';

export function poolStatus(content: Content, profile: Profile, pool: StarterPool): PoolStatus {
  if (eligibleSpecies(content, pool).length < content.balance.starterChoices) return 'comingLater';
  if (pool.unlockedByDefault || profile.unlockedPools.includes(pool.id)) return 'unlocked';
  if (pool.license && !profile.licenses.includes(pool.license)) return 'needsLicense';
  if (pool.unlock && !requirementProgress(profile, pool.unlock).met) return 'locked';
  return 'buyable';
}

export function poolProblem(content: Content, profile: Profile, pool: StarterPool): string | null {
  switch (poolStatus(content, profile, pool)) {
    case 'unlocked':
      return `The ${pool.name} pool is already unlocked.`;
    case 'comingLater':
      return `The ${pool.name} pool arrives with the full Pokédex.`;
    case 'needsLicense':
      return `Needs the ${content.licenses.get(pool.license!)?.name ?? pool.license} from the Bank.`;
    case 'locked':
      return `Not yet: ${pool.unlockText}.`;
    case 'buyable':
      return profile.researchPoints < pool.researchCost
        ? `You need ${pool.researchCost} Research Points (you have ${profile.researchPoints}).`
        : null;
  }
}

/** Buys a starter pool with Research Points. Returns a new profile. */
export function unlockPool(content: Content, current: Profile, poolId: string): Profile {
  const pool = content.starterPools.get(poolId);
  if (!pool) throw new Error(`Unknown starter pool "${poolId}"`);
  const problem = poolProblem(content, current, pool);
  if (problem) throw new Error(problem);
  const profile = structuredClone(current);
  profile.researchPoints -= pool.researchCost;
  profile.unlockedPools.push(pool.id);
  return profile;
}

/** The types found among the pool's starters, for the Type Focus rule. */
export function poolTypes(content: Content, pool: StarterPool): TypeName[] {
  const types = new Set<TypeName>();
  for (const id of eligibleSpecies(content, pool)) for (const t of content.species.get(id)!.types) types.add(t);
  return [...types].sort();
}

// ---------- licenses ----------

export type LicenseStatus = 'owned' | 'buyable' | 'locked';

export function licenseStatus(profile: Profile, license: License): LicenseStatus {
  if (profile.licenses.includes(license.id)) return 'owned';
  if (license.unlock && !requirementProgress(profile, license.unlock).met) return 'locked';
  return 'buyable';
}

export function licenseProblem(profile: Profile, license: License): string | null {
  const status = licenseStatus(profile, license);
  if (status === 'owned') return `You already own the ${license.name}.`;
  if (status === 'locked') return `Not yet: ${license.unlockText}.`;
  if (profile.bankCredits < license.cost) return `You need ${license.cost} Bank Credits (you have ${profile.bankCredits}).`;
  return null;
}

/** Buys a license with Bank Credits. Returns a new profile. */
export function buyLicense(content: Content, current: Profile, licenseId: string): Profile {
  const license = content.licenses.get(licenseId);
  if (!license) throw new Error(`Unknown license "${licenseId}"`);
  const problem = licenseProblem(current, license);
  if (problem) throw new Error(problem);
  const profile = structuredClone(current);
  profile.bankCredits -= license.cost;
  profile.licenses.push(license.id);
  return profile;
}

// ---------- draft rules and preparation tokens ----------

export function draftRuleAvailable(profile: Profile, rule: DraftRule): boolean {
  return rule.license === null || profile.licenses.includes(rule.license);
}

export function tokenAvailable(profile: Profile, token: PrepToken): boolean {
  if (token.license !== null && !profile.licenses.includes(token.license)) return false;
  return !token.unlock || requirementProgress(profile, token.unlock).met;
}

/** Why a token can't be chosen yet, in plain words. */
export function tokenLockText(content: Content, token: PrepToken): string {
  if (token.license !== null) return `needs the ${content.licenses.get(token.license)?.name ?? token.license}`;
  return token.unlockText ? token.unlockText.charAt(0).toLowerCase() + token.unlockText.slice(1) : 'locked';
}

export function standardRule(content: Content): DraftRule {
  return [...content.draftRules.values()].find((r) => r.kind === 'standard' && r.license === null)!;
}

/** The choices a brand-new player gets: the full campaign, the starting pool, the standard draft, no token. */
export function defaultPrep(content: Content): RunPrep {
  const pool = [...content.starterPools.values()].find((p) => p.unlockedByDefault)!;
  return { campaignId: 'full', poolId: pool.id, draftRuleId: standardRule(content).id, typeFocus: null, tokenId: null };
}

export interface ResolvedPrep {
  archetypeId: string;
  prep: RunPrep;
  /** Every choice that was no longer available and what replaced it. */
  problems: string[];
}

/**
 * Checks a trainer and preparation against what the profile has unlocked.
 * Anything no longer available (a missing trainer, pool, rule, type or token)
 * is replaced by the default and reported, so the player sees it before the run starts.
 */
export function resolvePrep(content: Content, profile: Profile, archetypeId: string, wanted: RunPrep): ResolvedPrep {
  const problems: string[] = [];
  const base = defaultPrep(content);
  const prep: RunPrep = { ...wanted };

  const archetype = content.archetypes.get(archetypeId);
  const trainerOk = archetype && archetype.available && (archetype.unlockedByDefault || profile.unlockedArchetypes.includes(archetype.id));
  const fallbackTrainer = [...content.archetypes.values()].find((a) => a.unlockedByDefault)!;
  if (!trainerOk) problems.push(`Trainer "${archetype?.name ?? archetypeId}" isn't available; using ${fallbackTrainer.name}.`);

  if (!content.campaigns.has(prep.campaignId)) {
    problems.push(`Campaign "${prep.campaignId}" doesn't exist; using the full campaign.`);
    prep.campaignId = base.campaignId;
  }
  const pool = content.starterPools.get(prep.poolId);
  if (!pool || poolStatus(content, profile, pool) !== 'unlocked') {
    problems.push(`The ${pool?.name ?? prep.poolId} pool isn't unlocked; using ${content.starterPools.get(base.poolId)!.name}.`);
    prep.poolId = base.poolId;
  }
  const rule = content.draftRules.get(prep.draftRuleId);
  if (!rule || !draftRuleAvailable(profile, rule)) {
    problems.push(`The ${rule?.name ?? prep.draftRuleId} rule isn't available; using ${standardRule(content).name}.`);
    prep.draftRuleId = base.draftRuleId;
  }
  if (content.draftRules.get(prep.draftRuleId)!.kind === 'typeFocus') {
    const types = poolTypes(content, content.starterPools.get(prep.poolId)!);
    if (prep.typeFocus === null || !types.includes(prep.typeFocus)) {
      if (prep.typeFocus !== null) problems.push(`No ${typeName(prep.typeFocus)}-type starters in this pool; focusing on ${typeName(types[0]!)} instead.`);
      prep.typeFocus = types[0] ?? null;
    }
  } else {
    prep.typeFocus = null;
  }
  if (prep.tokenId !== null) {
    const token = content.prepTokens.get(prep.tokenId);
    if (!token || !tokenAvailable(profile, token)) {
      problems.push(`The ${token?.name ?? prep.tokenId} preparation isn't available; going without.`);
      prep.tokenId = null;
    }
  }
  return { archetypeId: trainerOk ? archetypeId : fallbackTrainer.id, prep, problems };
}

// ---------- drawing the starters ----------

export interface StarterDraft {
  choices: string[];
  /** Set when the rule couldn't be met in full and the draft filled in with other starters. */
  note: string | null;
}

/**
 * Draws the starters from the pool under the draft rule. A rule that the pool
 * can't satisfy never rerolls forever: the draft fills the rest at random and
 * says so in `note`.
 */
export function draftStarters(content: Content, rng: Rng, prep: RunPrep): StarterDraft {
  const n = content.balance.starterChoices;
  const pool = content.starterPools.get(prep.poolId);
  if (!pool) throw new Error(`Unknown starter pool "${prep.poolId}"`);
  const eligible = eligibleSpecies(content, pool);
  if (eligible.length < n) throw new Error(`Starter pool "${pool.id}" has ${eligible.length} eligible species but ${n} are needed`);
  const shuffled = rng.shuffle(eligible);
  const rule = content.draftRules.get(prep.draftRuleId) ?? standardRule(content);
  const typesOf = (id: string) => content.species.get(id)!.types;

  if (rule.kind === 'typeFocus' && prep.typeFocus) {
    const type = prep.typeFocus;
    const matching = shuffled.filter((id) => typesOf(id).includes(type));
    if (matching.length >= n) return { choices: matching.slice(0, n), note: null };
    const rest = shuffled.filter((id) => !matching.includes(id));
    return {
      choices: [...matching, ...rest].slice(0, n),
      note: `This pool has only ${matching.length} ${typeName(type)}-type starter${matching.length === 1 ? '' : 's'}; the rest are random.`,
    };
  }
  if (rule.kind === 'balanced') {
    const picked: string[] = [];
    for (const id of shuffled) {
      if (picked.length === n) break;
      if (picked.every((p) => !typesOf(p).some((t) => typesOf(id).includes(t)))) picked.push(id);
    }
    if (picked.length === n) return { choices: picked, note: null };
    const rest = shuffled.filter((id) => !picked.includes(id));
    return { choices: [...picked, ...rest].slice(0, n), note: 'This pool can\'t give three starters with no shared types; some share a type.' };
  }
  return { choices: shuffled.slice(0, n), note: null };
}

// ---------- starting resources and the build summary ----------

export interface StartingResources {
  money: number;
  items: Record<string, number>;
}

/** Money and items at the start of a run: the base Bag, the trainer's signature items and the preparation token. */
export function startingResources(content: Content, archetype: Archetype, prep: RunPrep): StartingResources {
  const items: Record<string, number> = { ...content.balance.startingItems };
  const add = (from: Record<string, number>) => {
    for (const [id, n] of Object.entries(from)) items[id] = (items[id] ?? 0) + n;
  };
  add(archetype.startingItems);
  const token = prep.tokenId ? content.prepTokens.get(prep.tokenId) : undefined;
  if (token) add(token.items);
  return { money: content.balance.money.startingMoney + (token?.money ?? 0), items };
}

export function itemsText(content: Content, items: Record<string, number>): string {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${content.items.get(id)?.name ?? id} ×${n}`)
    .join(', ');
}

/** The Run Build Summary: what this trainer and these choices add up to, in plain lines. */
export function buildSummary(content: Content, archetypeId: string, prep: RunPrep): string[] {
  const archetype = getArchetype(content, archetypeId);
  const pool = content.starterPools.get(prep.poolId)!;
  const rule = content.draftRules.get(prep.draftRuleId)!;
  const token = prep.tokenId ? content.prepTokens.get(prep.tokenId) : undefined;
  const campaign = content.campaigns.get(prep.campaignId);
  const res = startingResources(content, archetype, prep);
  const lines = [
    `Trainer: ${archetype.name}${archetype.title ? ` (${archetype.title})` : ''}`,
    ...archetype.pros.map((p) => `  + ${p}`),
    ...archetype.cons.map((c) => `  − ${c}`),
    `Campaign: ${campaign?.name ?? prep.campaignId}`,
    `Starters: ${pool.name} pool (${eligibleSpecies(content, pool).length} species), ${rule.name}${rule.kind === 'typeFocus' && prep.typeFocus ? `: ${typeName(prep.typeFocus)}` : ''}`,
    `Preparation: ${token ? `${token.name}, ${token.description.charAt(0).toLowerCase()}${token.description.slice(1)}` : 'none'}`,
    `Start with: ₽${res.money}; ${itemsText(content, res.items) || 'an empty Bag'}`,
  ];
  return lines;
}

/** "fire" → "Fire". */
export function typeName(type: TypeName): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ---------- loadout presets ----------

/** Stores a loadout in a preset slot. Returns a new profile. */
export function savePreset(content: Content, current: Profile, slot: number, preset: LoadoutPreset): Profile {
  if (slot < 0 || slot >= content.balance.presetSlots) throw new Error(`There is no preset slot ${slot + 1}`);
  const profile = structuredClone(current);
  while (profile.presets.length <= slot) profile.presets.push(null);
  profile.presets[slot] = structuredClone(preset);
  return profile;
}

export function presetIn(profile: Profile, slot: number): LoadoutPreset | null {
  return profile.presets[slot] ?? null;
}

/** A preset's trainer and preparation, split apart. */
export function presetParts(preset: LoadoutPreset): { archetypeId: string; prep: RunPrep } {
  const { name: _name, archetypeId, ...prep } = preset;
  return { archetypeId, prep };
}
