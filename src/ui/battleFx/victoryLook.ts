// What a boss victory screen says (catalog 91 "boss-specific victory screens":
// a victory pose, the team lineup and a Chronicle stamp; one template, the
// boss's own accent colour). Worked out without Phaser so it can be tested.

import type { Content } from '../../core/contentSchema';
import type { BossInfo } from '../../core/regions';
import type { PokemonInstance } from '../../core/state';
import { getSpecies } from '../../core/pokemon';

export interface BossVictory {
  title: string;
  /** "Chronicle · Turn 7 · Pikachu landed the last hit · no one fainted". */
  stamp: string;
  /** The boss's first type, for the accent colour. */
  accentType: string;
  lineup: { speciesId: string; fainted: boolean }[];
}

/** `turns` is the battle's last turn; `finisher` the Pokémon in front when it ended. */
export function bossVictory(content: Content, boss: BossInfo, party: PokemonInstance[], turns: number, finisher: PokemonInstance | null): BossVictory {
  const fainted = party.filter((m) => m.hp <= 0).length;
  const parts = [`Chronicle · Turn ${turns}`, finisher ? `${getSpecies(content, finisher.speciesId).name} landed the last hit` : null, fainted === 0 ? 'no one fainted' : `${fainted} fainted`];
  return {
    title: `${boss.title} defeated!`,
    stamp: parts.filter(Boolean).join(' · '),
    accentType: boss.types[0] ?? 'normal',
    lineup: party.map((m) => ({ speciesId: m.speciesId, fainted: m.hp <= 0 })),
  };
}
