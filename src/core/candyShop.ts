// The Candy Shop (D7): candies from released Pokémon buy permanent starting perks, once each.
// Perks add to the starting Bag and money of every run; they never touch a roll.

import type { Content } from './contentSchema';
import type { Profile } from './state';

export type CandyPerk = Content['balance']['candyShop'][number];

export function candyPerkProblem(content: Content, profile: Profile, id: string): string | null {
  const perk = content.balance.candyShop.find((p) => p.id === id);
  if (!perk) return `Unknown perk "${id}".`;
  if (profile.candyPerks.includes(id)) return `You already own the ${perk.name}.`;
  if (profile.candies < perk.cost) return `You need ${perk.cost} candies (you have ${profile.candies}).`;
  return null;
}

/** Buys a perk with candies. Returns a new profile. */
export function buyCandyPerk(content: Content, current: Profile, id: string): Profile {
  const problem = candyPerkProblem(content, current, id);
  if (problem) throw new Error(problem);
  const profile = structuredClone(current);
  profile.candies -= content.balance.candyShop.find((p) => p.id === id)!.cost;
  profile.candyPerks.push(id);
  return profile;
}

/** What the owned perks add to a run's start. */
export function candyStart(content: Content, owned: readonly string[]): { money: number; items: Record<string, number> } {
  const out = { money: 0, items: {} as Record<string, number> };
  for (const perk of content.balance.candyShop) {
    if (!owned.includes(perk.id)) continue;
    out.money += perk.money;
    for (const [id, n] of Object.entries(perk.items)) out.items[id] = (out.items[id] ?? 0) + n;
  }
  return out;
}
