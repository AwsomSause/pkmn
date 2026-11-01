// Ideas W5: what the run's NPC flags change in shops and permadeath (pure; events set the flags).
// Flags live in `run.story.flags` under `ev:<key>` (event effect `flag`).

import type { Content } from './contentSchema';
import type { RunState } from './state';

type FlagStory = { flags: Record<string, boolean | number | string> } | undefined;

export const eventFlag = (story: FlagStory, key: string): number => Number(story?.flags[`ev:${key}`] ?? 0) || 0;

/** Price factor from shopkeeper loyalty (flag `shop-loyalty`): the best discount whose step you have reached. */
export function npcShopFactor(content: Content, story: FlagStory): number {
  const loyalty = eventFlag(story, 'shop-loyalty');
  const best = content.balance.npcShop.loyaltyDiscounts.filter((d) => loyalty >= d.atLeast).reduce((m, d) => Math.max(m, d.discount), 0);
  return 1 - best;
}

/** The secret shop tier (flag `secret-shop`, opened by a gift): extra stock, empty until then. */
export function secretTierEntries(content: Content, story: FlagStory): Content['shop'] {
  if (eventFlag(story, 'secret-shop') < 1) return [];
  return content.balance.npcShop.secretTier.filter((x) => content.items.has(x.item)).map((x) => ({ ...x }) as Content['shop'][number]);
}

/**
 * Insurance (flag `insured`, bought from an insurance NPC): each point saves one fallen Pokémon from Nuzlocke burial,
 * the highest level first. Returns the ones still to be buried; spends the flag (mutates `run`).
 */
export function spendInsurance<T extends { level: number }>(run: Pick<RunState, 'story'>, fallen: T[]): T[] {
  const key = 'ev:insured';
  let left = Number(run.story.flags[key] ?? 0) || 0;
  if (left <= 0 || fallen.length === 0) return fallen;
  const saved = [...fallen].sort((a, b) => b.level - a.level).slice(0, left);
  left -= saved.length;
  run.story.flags[key] = left;
  return fallen.filter((m) => !saved.includes(m));
}
