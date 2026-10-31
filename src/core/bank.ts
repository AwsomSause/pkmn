// The Bank beyond credits and licenses (GAME_DESIGN §14.2): tiers that open services (never multiply
// rewards), the Exchange Counter, savings milestones and the three licenses that act inside a run.
// Nothing here rolls a random number.

import type { Content, ShopEntry } from './contentSchema';
import type { Profile, RunState } from './state';

export const BANK_MAX_TIER = 5;
/** The licenses that change a run (the others only open Preparation Desk options). */
const RUN_LICENSES = ['scavenger', 'fortune', 'survival'];

export const runLicenses = (owned: readonly string[]): string[] => owned.filter((id) => RUN_LICENSES.includes(id) || id.startsWith('region:'));

/** What a new run takes from the profile: the in-run licenses and, from tier 4, the Regional Accounts opened (as `region:<id>`). */
export function runBankFlags(profile: Profile): string[] {
  const accounts = bankTier(profile) >= 4 ? Object.keys(profile.claims).filter((k) => k.startsWith('bank:region:')).map((k) => `region:${k.slice('bank:region:'.length)}`) : [];
  return runLicenses([...profile.licenses, ...accounts]);
}
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

/** Shop entries the Bank adds to a run: the Survival License's item and one item per Regional Account. */
export function bankShopEntries(content: Content, licenses: readonly string[] | undefined): ShopEntry[] {
  const entries: ShopEntry[] = [];
  const bank = content.balance.bank;
  if (licenses?.includes('survival') && content.items.has(bank.survival.item)) entries.push({ item: bank.survival.item, price: bank.survival.price, minBadges: bank.survival.minBadges });
  for (const flag of licenses ?? []) {
    const r = flag.startsWith('region:') ? bank.regional[flag.slice(7)] : undefined;
    if (r && content.items.has(r.item)) entries.push({ item: r.item, price: r.price, minBadges: 0 });
  }
  return entries;
}

// ---------- Regional Accounts (tier 4) ----------

/** Opens the account of every region this run cleared (mutates `profile`, once each). Returns the region ids opened. */
export function claimRegionAccounts(content: Content, profile: Profile, regionsCleared: readonly string[], now: string): string[] {
  const opened: string[] = [];
  for (const id of regionsCleared) {
    const key = `bank:region:${id}`;
    if (!content.balance.bank.regional[id] || profile.claims[key]) continue;
    profile.claims[key] = { at: now };
    opened.push(id);
  }
  return opened;
}

// ---------- Collector's Vault (tier 5) ----------

const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3 };

/** The best rare+ item left in a finished run's Bag that the Vault may keep, or null. Key items, Stones for evolution and balls are not kept. */
export function vaultCandidate(content: Content, run: Pick<RunState, 'inventory'>): string | null {
  const min = RARITY_RANK[content.balance.bank.vault.minRarity]!;
  const ok = Object.keys(run.inventory)
    .filter((id) => (run.inventory[id] ?? 0) > 0)
    .filter((id) => content.catalog.get(id)?.how === 'held' && RARITY_RANK[content.catalog.get(id)!.rarity]! >= min)
    .sort((a, b) => RARITY_RANK[content.catalog.get(b)!.rarity]! - RARITY_RANK[content.catalog.get(a)!.rarity]! || a.localeCompare(b));
  return ok[0] ?? null;
}

/** Tier 5: keeps the run's best held item in the Vault while there is room (mutates `profile`). Returns the item kept. */
export function vaultDeposit(content: Content, profile: Profile, run: Pick<RunState, 'inventory'>): string | null {
  if (bankTier(profile) < 5 || profile.vault.length >= content.balance.bank.vault.slots) return null;
  const id = vaultCandidate(content, run);
  if (!id) return null;
  profile.vault.push(id);
  return id;
}

/** Removes one copy of an item from the Vault when a run starts with it. Returns false when it isn't there. */
export function vaultTake(profile: Profile, id: string): boolean {
  const at = profile.vault.indexOf(id);
  if (at < 0) return false;
  profile.vault.splice(at, 1);
  return true;
}

export function loanProblem(content: Content, profile: Pick<Profile, 'bankTier'>): string | null {
  return bankTier(profile) < 3 ? 'Loans open at Bank tier 3.' : null;
}

/** Credits a loan costs at the end of a run: the penalty when fewer than the required badges were won, else 0. */
export function loanDue(content: Content, run: Pick<RunState, 'prep' | 'badges'>): number {
  const loan = content.balance.bank.loan;
  return run.prep?.loan && run.badges.length < loan.badges ? loan.penalty : 0;
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
