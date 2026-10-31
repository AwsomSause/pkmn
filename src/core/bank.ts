// The Bank beyond credits and licenses (GAME_DESIGN §14.2): tiers that open services (never multiply
// rewards), the Exchange Counter, savings milestones and the three licenses that act inside a run.
// Nothing here rolls a random number.

import type { Content, ShopEntry } from './contentSchema';
import type { Profile } from './state';

export const BANK_MAX_TIER = 5;
/** The licenses that change a run (the others only open Preparation Desk options). */
const RUN_LICENSES = ['scavenger', 'fortune', 'survival'];

export const runLicenses = (owned: readonly string[]): string[] => owned.filter((id) => RUN_LICENSES.includes(id));
export const bankTier = (profile: Pick<Profile, 'bankTier'>): number => profile.bankTier ?? 1;

export function nextTier(content: Content, profile: Pick<Profile, 'bankTier'>) {
  return content.balance.bank.tiers.find((t) => t.tier === bankTier(profile) + 1) ?? null;
}

export function tierProblem(content: Content, profile: Profile): string | null {
  const next = nextTier(content, profile);
  if (!next) return 'The Bank is already at its top tier.';
  if (profile.bankCredits < next.cost) return `You need ${next.cost} Bank Credits (you have ${profile.bankCredits}).`;
  return null;
}

/** Buys the next Bank tier with credits. Returns a new profile. */
export function buyTier(content: Content, current: Profile, now: string): Profile {
  const problem = tierProblem(content, current);
  if (problem) throw new Error(problem);
  const next = nextTier(content, current)!;
  const profile = structuredClone(current);
  profile.bankCredits -= next.cost;
  profile.bankTier = next.tier;
  profile.claims[`bank:tier:${next.tier}`] = { at: now };
  return profile;
}

/** Loadout preset slots: tier 2 adds some. */
export const presetSlotCount = (content: Content, profile: Pick<Profile, 'bankTier'>): number =>
  content.balance.presetSlots + (bankTier(profile) >= 2 ? content.balance.bank.tierPresetBonus : 0);

// ---------- Exchange Counter (tier 3) ----------

export type ExchangeDirection = 'toPoints' | 'toCredits';

export function exchangeProblem(content: Content, profile: Profile, dir: ExchangeDirection): string | null {
  if (bankTier(profile) < 3) return 'The Exchange Counter opens at Bank tier 3.';
  const x = content.balance.bank.exchange;
  if (dir === 'toPoints') return profile.bankCredits < x.credits ? `You need ${x.credits} Bank Credits (you have ${profile.bankCredits}).` : null;
  return profile.researchPoints < x.backPoints ? `You need ${x.backPoints} Research Points (you have ${profile.researchPoints}).` : null;
}

/** One lot at the Exchange Counter. Returns a new profile. Credits gained this way do not count toward milestones. */
export function exchange(content: Content, current: Profile, dir: ExchangeDirection): Profile {
  const problem = exchangeProblem(content, current, dir);
  if (problem) throw new Error(problem);
  const x = content.balance.bank.exchange;
  const profile = structuredClone(current);
  if (dir === 'toPoints') {
    profile.bankCredits -= x.credits;
    profile.researchPoints += x.points;
  } else {
    profile.researchPoints -= x.backPoints;
    profile.bankCredits += x.backCredits;
  }
  return profile;
}

// ---------- savings milestones ----------

/** Pays the titles for lifetime credits reached (mutates `profile`, once each through the claim ledger). Returns the titles gained. */
export function claimBankMilestones(content: Content, profile: Profile, now: string): string[] {
  const gained: string[] = [];
  for (const m of content.balance.bank.milestones) {
    const key = `bank:milestone:${m.credits}`;
    if (profile.lifetimeBankCredits < m.credits || profile.claims[key]) continue;
    profile.claims[key] = { at: now };
    if (!profile.titles.includes(m.title)) profile.titles.push(m.title);
    gained.push(m.title);
  }
  return gained;
}

// ---------- licenses inside a run ----------

/** The Survival License's shop entry, or null without it. */
export function survivalEntry(content: Content, licenses: readonly string[] | undefined): ShopEntry | null {
  if (!licenses?.includes('survival')) return null;
  const s = content.balance.bank.survival;
  return content.items.has(s.item) ? { item: s.item, price: s.price, minBadges: s.minBadges } : null;
}

/** Extra Poké Dollars a Scavenger License adds to a map event's money, or 0 (the roll comes from the event's own stream). */
export function scavengerBonus(content: Content, licenses: readonly string[] | undefined, rng: { chance(p: number): boolean }): number {
  if (!licenses?.includes('scavenger')) return 0;
  const s = content.balance.bank.scavenger;
  return rng.chance(s.chance) ? s.money : 0;
}

/** The Fortune License's draft lean, or null. */
export function fortuneBias(content: Content, licenses: readonly string[] | undefined): { categories: string[]; weight: number } | null {
  return licenses?.includes('fortune') ? content.balance.bank.fortune : null;
}
