// Friendship (M8.75 part B). Every Pokémon has a friendship value from 0 to
// `max`. It grows when the Pokémon levels up, wins battles and takes vitamins,
// and drops a little when it faints. Charisma makes it grow faster. At
// `evolveAt` or more, friendship evolutions (Pichu, Golbat, Eevee, ...) happen
// on their own after a battle; the Soothe Bell still evolves them right away.

import type { Content } from './contentSchema';
import { friendshipMultiplier } from './battle/held';
import type { PokemonInstance } from './state';

/** Changes a Pokémon's friendship, kept within 0 and the maximum. Gains are scaled by `gainMultiplier` (Charisma). */
export function changeFriendship(content: Content, mon: PokemonInstance, amount: number, gainMultiplier = 1): number {
  const { max } = content.balance.friendship;
  // A Prism Scale makes its holder warm up faster.
  const delta = amount > 0 ? Math.round(amount * gainMultiplier * friendshipMultiplier(content, mon)) : amount;
  mon.friendship = Math.max(0, Math.min(max, mon.friendship + delta));
  return mon.friendship;
}

/** Whether friendship is high enough for a friendship evolution. */
export function friendshipReady(content: Content, mon: PokemonInstance): boolean {
  return mon.friendship >= content.balance.friendship.evolveAt;
}

/** Friendship as 0 to 5 hearts for the party screen (5 means it can evolve by friendship). */
export function friendshipHearts(content: Content, mon: PokemonInstance): number {
  const { evolveAt } = content.balance.friendship;
  if (mon.friendship >= evolveAt) return 5;
  return Math.min(4, Math.floor((mon.friendship / evolveAt) * 5));
}
