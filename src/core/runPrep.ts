// Run-Prep (GAME_DESIGN.md §14.5, §14.7): starter pools and the Starter
// Laboratory, draft rules, preparation tokens, Bank licenses, loadout presets
// and the Run Build Summary. These choices open up options; none of them
// makes the player's Pokémon stronger.

import { isSpecialForm } from './specialForms';
import { directiveText } from './directive';
import { getArchetype } from './archetypes';
import { attributesLine, readAttributes } from './attributes';
import type { Archetype, Content, DraftRule, License, PrepToken, Species, StarterPool, TypeName } from './contentSchema';
import { requirementProgress } from './progress';
import { masteredStarters } from './mastery';
import type { Rng } from './rng';
import { baseStatTotal, isNative, isWildEligible, wildEligibleSpecies } from './themes';
import { candyStart } from './candyShop';
import { bankTier, presetSlotCount } from './bank';
import type { LoadoutPreset, Profile, RunPrep } from './state';

// ---------- starter pools ----------

/** The first stage of a species' line (Charizard → Charmander); babies don't count, as in evolutionStage. */
export function firstStage(content: Content, id: string): Species | undefined {
  let s = content.species.get(id);
  while (s && s.evolutionStage > 1 && s.evolvesFrom) s = content.species.get(s.evolvesFrom);
  return s;
}

/**
 * A listed species can be a starter if it could be met in the wild, not
 * counting moves: one with no usable move stays in so the content report
 * flags it instead of the pool hiding it.
 */
function isStarterEligible(content: Content, s: Species, specialForms = false, specimens = false): boolean {
  const special = s.tags.includes('legendary') || s.tags.includes('mythical');
  // A Special Specimen set takes plain legendary and mythical species, whatever their stats.
  if (specimens && special && s.evolutionStage === 1 && !s.form && !isSpecialForm(s)) return true;
  if (s.evolutionStage !== 1 || special) return false;
  // An earned special-form set (Spooky Set) may offer its forms; every other pool leaves them out.
  if (specialForms && isSpecialForm(s)) return baseStatTotal(s) <= content.balance.wildMaxBaseStats;
  if (s.form && s.form.kind !== 'regional' && s.form.kind !== 'alternate') return false;
  if (isSpecialForm(s)) return false;
  return baseStatTotal(s) <= content.balance.wildMaxBaseStats;
}

const eligibleCache = new WeakMap<StarterPool, string[]>();

/**
 * The pool's starters, without repeats, in data order: its listed species and
 * its bosses' signature Pokémon (each as its first stage), then every species
 * its filter matches. A pool never offers a legendary, a Mega or a Pokémon too
 * strong for the wild.
 */
export function eligibleSpecies(content: Content, pool: StarterPool, mastered: readonly string[] = []): string[] {
  // The "Mastered" set holds your Silver-ranked species, so it changes with the profile and isn't cached.
  if (pool.mastered) return [...new Set(mastered.map((id) => firstStage(content, id)).filter((s): s is Species => !!s && isStarterEligible(content, s)).map((s) => s.id))];
  const cached = eligibleCache.get(pool);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const id of pool.species) {
    const s = firstStage(content, id);
    if (s && isStarterEligible(content, s, pool.specialForms, pool.specimens)) ids.add(s.id);
  }
  // Bosses' Pokémon are picked for their final forms, so a first stage with no usable move (Abra) is skipped.
  for (const id of pool.bosses.flatMap((b) => content.bosses.get(b)?.signature ?? [])) {
    const s = firstStage(content, id);
    if (s && isWildEligible(content, s)) ids.add(s.id);
  }
  const filter = pool.filter;
  if (filter) {
    for (const s of wildEligibleSpecies(content)) {
      if (filter.types && !s.types.some((t) => filter.types!.includes(t))) continue;
      if (filter.region && !isNative(content, s, filter.region)) continue;
      ids.add(s.id);
    }
  }
  const result = [...ids];
  eligibleCache.set(pool, result);
  return result;
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
  if (pool.mastered) return eligibleSpecies(content, pool, masteredStarters(content, profile)).length < content.balance.starterChoices ? 'locked' : 'unlocked';
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
  if (bankTier(profile) < license.tier) return `Needs Bank tier ${license.tier}.`;
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
  return { campaignId: 'full', poolId: pool.id, draftRuleId: standardRule(content).id, typeFocus: null, tokenId: null, directive: null, license: null, loan: false, vaultItem: null };
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
  if (content.starterPools.get(prep.poolId)?.specimens && rule && rule.kind !== 'standard') {
    problems.push(`Special Specimen starters only use the ${standardRule(content).name} rule.`);
    prep.draftRuleId = base.draftRuleId;
  } else if (!rule || !draftRuleAvailable(profile, rule)) {
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
export function draftStarters(content: Content, rng: Rng, prep: RunPrep, mastered: readonly string[] = []): StarterDraft {
  const n = content.balance.starterChoices;
  const pool = content.starterPools.get(prep.poolId);
  if (!pool) throw new Error(`Unknown starter pool "${prep.poolId}"`);
  const eligible = eligibleSpecies(content, pool, mastered);
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
  // Expanded Research: the draw also reaches into the Research pool's unusual first stages.
  if (rule.kind === 'expanded') {
    const extra = content.starterPools.get('research');
    const wide = rng.shuffle([...new Set([...eligible, ...(extra ? eligibleSpecies(content, extra) : [])])]);
    return { choices: wide.slice(0, n), note: null };
  }
  // Regional Research: all starters come from one region (the first drawn species' home).
  if (rule.kind === 'regional') {
    for (const first of shuffled) {
      const s = content.species.get(first)!;
      const region = [...content.regions.values()].find((r) => r.id !== 'grand' && isNative(content, s, r.id));
      if (!region) continue;
      const home = shuffled.filter((id) => isNative(content, content.species.get(id)!, region.id));
      if (home.length >= n) return { choices: home.slice(0, n), note: `All three starters are native to ${region.name}.` };
    }
    return { choices: shuffled.slice(0, n), note: 'No region has three native starters in this pool; they are random.' };
  }
  // Rare Specimen: one of the three comes from the Rare pool.
  if (rule.kind === 'rareSpecimen') {
    const rare = content.starterPools.get('rare');
    const rareIds = rare ? eligibleSpecies(content, rare).filter((id) => !shuffled.slice(0, n - 1).includes(id)) : [];
    if (rareIds.length === 0) return { choices: shuffled.slice(0, n), note: 'The Rare pool has no specimen to add; the starters are random.' };
    return { choices: [...shuffled.slice(0, n - 1), rng.pick(rareIds)], note: 'One starter is a rare specimen.' };
  }
  // Evolution Specialist: only species that evolve twice (three-stage lines).
  if (rule.kind === 'evolution') {
    const chain = (id: string) => (content.species.get(id)!.evolutions ?? []).some((e) => (content.species.get(e.to)?.evolutions ?? []).length > 0);
    const lines = shuffled.filter(chain);
    if (lines.length >= n) return { choices: lines.slice(0, n), note: 'Every starter evolves twice.' };
    return { choices: [...lines, ...shuffled.filter((id) => !lines.includes(id))].slice(0, n), note: `This pool has only ${lines.length} three-stage line${lines.length === 1 ? '' : 's'}; the rest are random.` };
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

/**
 * Signature Pokémon (Untitled doc §11): when none of the trainer's signature
 * species was drawn but the pool (and a Type Focus) allows one, it takes the
 * last slot with balance.signatureStarterChance. It runs on its own RNG
 * stream, so the draft itself rolls exactly as for any other trainer.
 */
export function withSignatureStarter(content: Content, rng: Rng, archetype: Archetype, prep: RunPrep, choices: string[], mastered: readonly string[] = []): string[] {
  const pool = content.starterPools.get(prep.poolId);
  if (!pool || archetype.signatureSpecies.length === 0) return choices;
  const eligible = new Set(eligibleSpecies(content, pool, mastered));
  const rule = content.draftRules.get(prep.draftRuleId);
  const focus = rule?.kind === 'typeFocus' ? prep.typeFocus : null;
  const candidates = [...new Set(archetype.signatureSpecies.map((id) => firstStage(content, id)?.id))].filter(
    (id): id is string => !!id && eligible.has(id) && (!focus || content.species.get(id)!.types.includes(focus)),
  );
  if (candidates.length === 0 || choices.some((id) => candidates.includes(id))) return choices;
  if (!rng.chance(content.balance.signatureStarterChance)) return choices;
  return [...choices.slice(0, -1), rng.pick(candidates)];
}

// ---------- starting resources and the build summary ----------

/** A token's small attribute bonus, added to the run's starting modifiers. */
export function withTokenAttribute<T extends Record<string, number>>(content: Content, prep: RunPrep, mods: T): T {
  const a = prep.tokenId ? content.prepTokens.get(prep.tokenId)?.attribute : null;
  return a ? { ...mods, [a.key]: (mods[a.key] ?? 0) + a.amount } : mods;
}

export interface StartingResources {
  money: number;
  items: Record<string, number>;
}

/** Money and items at the start of a run: the base Bag, the trainer's signature items and the preparation token. */
export function startingResources(content: Content, archetype: Archetype, prep: RunPrep, candyPerks: readonly string[] = []): StartingResources {
  const items: Record<string, number> = { ...content.balance.startingItems };
  const add = (from: Record<string, number>) => {
    for (const [id, n] of Object.entries(from)) items[id] = (items[id] ?? 0) + n;
  };
  add(archetype.startingItems);
  const token = prep.tokenId ? content.prepTokens.get(prep.tokenId) : undefined;
  if (token) add(token.items);
  if (prep.vaultItem) add({ [prep.vaultItem]: 1 });
  const candy = candyStart(content, candyPerks);
  add(candy.items);
  const loan = prep.loan ? content.balance.bank.loan.money : 0;
  return { money: content.balance.money.startingMoney + (token?.money ?? 0) + loan + candy.money, items };
}

export function itemsText(content: Content, items: Record<string, number>): string {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${content.items.get(id)?.name ?? id} ×${n}`)
    .join(', ');
}

/** The Run Build Summary: what this trainer and these choices add up to, in plain lines. */
export function buildSummary(content: Content, archetypeId: string, prep: RunPrep, attributes?: Record<string, number>): string[] {
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
    ...signatureLines(content, archetype),
    `Campaign: ${campaign?.name ?? prep.campaignId}`,
    `Starters: ${pool.name} pool (${eligibleSpecies(content, pool).length} species), ${rule.name}${rule.kind === 'typeFocus' && prep.typeFocus ? `: ${typeName(prep.typeFocus)}` : ''}`,
    `Preparation: ${token ? `${token.name}, ${token.description.charAt(0).toLowerCase()}${token.description.slice(1)}` : 'none'}`,
    `Start with: ₽${res.money}; ${itemsText(content, res.items) || 'an empty Bag'}`,
    ...(prep.directive ? [directiveText(content, prep.directive)] : []),
    ...(prep.loan ? [`Bank loan: +₽${content.balance.bank.loan.money}; finish with ${content.balance.bank.loan.badges}+ badges or the Bank takes ${content.balance.bank.loan.penalty} credits.`] : []),
    ...(prep.vaultItem ? [`From the Vault: ${content.items.get(prep.vaultItem)?.name ?? prep.vaultItem}`] : []),
  ];
  if (attributes) lines.push(`Attributes: ${attributesLine(readAttributes(content, attributes))}`);
  return lines;
}

/** The trainer's identity in words: signature types and Pokémon. Empty for trainers without one (Red). */
export function signatureLines(content: Content, archetype: Archetype): string[] {
  const parts: string[] = [];
  if (archetype.signatureTypes.length > 0) parts.push(archetype.signatureTypes.map(typeName).join('/'));
  const names = archetype.signatureSpecies.map((id) => content.species.get(id)?.name ?? id);
  if (names.length > 0) parts.push(names.join(', '));
  return parts.length > 0 ? [`Signature: ${parts.join(' · ')}`] : [];
}

/** "fire" → "Fire". */
export function typeName(type: TypeName): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ---------- loadout presets ----------

/** Stores a loadout in a preset slot. Returns a new profile. */
export function savePreset(content: Content, current: Profile, slot: number, preset: LoadoutPreset): Profile {
  if (slot < 0 || slot >= presetSlotCount(content, current)) throw new Error(`There is no preset slot ${slot + 1}`);
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
