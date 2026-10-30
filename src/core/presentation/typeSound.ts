// Type sound vocabulary (catalog #127): one short, recognisable sound per type, from the imported move-animation sounds.
// Played only when a move's own animation is missing, so a hit never goes silent. Presentation only.

export const TYPE_SOUND: Record<string, string> = {
  normal: 'ess-normaldamage',
  fire: 'prsfx-flamethrower',
  water: 'ess-water1',
  electric: 'ess-thunder1',
  grass: 'prsfx-vine-whip',
  ice: 'ess-ice2',
  fighting: 'prsfx-karate-chop1',
  poison: 'ess-poison',
  ground: 'prsfx-earthquake1',
  flying: 'ess-gust',
  psychic: 'prsfx-psychic',
  bug: 'prsfx-bug-buzz',
  rock: 'prsfx-rock-slide',
  ghost: 'prsfx-shadow-ball1',
  dragon: 'prsfx-dragon-pulse',
  dark: 'ess-darkness2',
  steel: 'prsfx-metal-claw1',
  fairy: 'prsfx-moonblast1',
};

/** The animation-sound name for a type, or null for an unknown type. */
export const typeSoundFor = (type: string): string | null => TYPE_SOUND[type] ?? null;
