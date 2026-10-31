// The Bond Engine for your Pokémon (the rivals' Pokémon already have one in
// core/rivals/bonds.ts; both use the same `Bond` record from story/schema.ts).
// Values change what a Pokémon may do (refuse a reckless command, step in,
// reveal a move); they never add stats.

export const BOND_KEYS = ['trust', 'affection', 'respect', 'synchronization', 'confidence', 'autonomy', 'strain'] as const;
export type BondKey = (typeof BOND_KEYS)[number];

/** How willful each Pokémon trait is to begin with (its starting autonomy). */
export const TRAIT_AUTONOMY: Record<string, number> = {
  independent: 75, stubborn: 75, proud: 70, competitive: 65, brave: 55, playful: 55, curious: 55, patient: 40, cautious: 35, empathetic: 30, protective: 30, anxious: 25,
};

/** Tuning for the rules in index.ts, in one place. */
export const BOND_RULES = {
  start: { starter: { trust: 55, affection: 40 }, caught: { trust: 40, affection: 25 }, gift: { trust: 50, affection: 35 } },
  /** Refusal: a reckless command (it would faint the user) is refused once per battle when it is willful and distrusts you. */
  refuse: { minAutonomy: 60, maxTrust: 35 },
  /** Initiative: a Pokémon in sync with you swaps a command that cannot work for its best move that can. */
  initiative: { minSynchronization: 70, minTrust: 60 },
  /** Unplanned Combination: a practiced pair (an open Bond relationship) that is in sync. */
  combo: { minSynchronization: 50 },
  /** New Move: a Pokémon you trust and are in sync with, pushed to half HP. */
  reveal: { minTrust: 70, minSynchronization: 60, hpShare: 0.5 },
  /** Bond evolution: a devoted Pokémon evolves by friendship once friendship reaches this share of the usual threshold. */
  evolve: { minFriendshipShare: 0.6 },
  /** Bond lessons: a devoted Pokémon with a free move slot learns a move it was ready for after a win. */
  lesson: { maxPerBattle: 1 },
} as const;
