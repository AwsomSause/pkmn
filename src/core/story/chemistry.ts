// Team Chemistry (Techno blueprint §6.8): how two Pokémon do together, worked out from their
// shared history and bond (never from fixed species pairs). Pure and deterministic.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import type { PokemonInstance } from '../state';

export const CHEMISTRY = ['perfectTiming', 'coverPartners', 'competitiveDuo', 'battleTested', 'unlikelyFriends'] as const;
export type ChemistryKind = (typeof CHEMISTRY)[number];

export const CHEMISTRY_NAMES: Record<ChemistryKind, string> = {
  perfectTiming: 'Perfect Timing',
  coverPartners: 'Cover Partners',
  competitiveDuo: 'Competitive Duo',
  battleTested: 'Battle-Tested',
  unlikelyFriends: 'Unlikely Friends',
};

/** The kind of damage a Pokémon's moves lean on. */
function role(content: Content, mon: PokemonInstance): 'physical' | 'special' | 'mixed' {
  let p = 0;
  let s = 0;
  for (const slot of mon.moves) {
    const c = content.moves.get(slot.id)?.category;
    if (c === 'physical') p += 1;
    else if (c === 'special') s += 1;
  }
  return p > s ? 'physical' : s > p ? 'special' : 'mixed';
}

/** The chemistry two party members have, if any (the most special one wins). */
export function chemistryOf(content: Content, run: RunState, aUid: string, bUid: string): ChemistryKind | null {
  const a = run.party.find((m) => m.uid === aUid);
  const b = run.party.find((m) => m.uid === bUid);
  const ha = run.story.histories[aUid];
  const hb = run.story.histories[bUid];
  if (!a || !b || !ha || !hb || aUid === bUid) return null;
  const bond = run.story.relationships.some((r) => r.open && r.kind === 'bond' && ((r.a.id === aUid && r.b.id === bUid) || (r.a.id === bUid && r.b.id === aUid)));
  const typesA = content.species.get(a.speciesId)?.types ?? [];
  const typesB = content.species.get(b.speciesId)?.types ?? [];
  const ra = role(content, a);
  const rb = role(content, b);
  if (bond && ra !== 'mixed' && rb !== 'mixed' && ra !== rb) return 'perfectTiming';
  if (bond && ((ha.hyper['came-to-aid'] ?? 0) > 0 || (hb.hyper['came-to-aid'] ?? 0) > 0 || (ha.hyper['wont-let-friend-fight'] ?? 0) > 0 || (hb.hyper['wont-let-friend-fight'] ?? 0) > 0)) return 'coverPartners';
  if ((ha.hyper['friendly-competition'] ?? 0) > 0 || (hb.hyper['friendly-competition'] ?? 0) > 0) return 'competitiveDuo';
  if (ha.bossesBeaten >= 2 && hb.bossesBeaten >= 2 && ha.survivedFatal + hb.survivedFatal >= 1) return 'battleTested';
  if (bond && !typesA.some((t) => typesB.includes(t))) return 'unlikelyFriends';
  return null;
}

/** Every chemistry pair in the party, as readable lines. */
export function chemistryLines(content: Content, run: RunState): string[] {
  const out: string[] = [];
  const nameOf = (m: PokemonInstance) => content.species.get(m.speciesId)?.name ?? m.speciesId;
  for (let i = 0; i < run.party.length; i++) {
    for (let j = i + 1; j < run.party.length; j++) {
      const k = chemistryOf(content, run, run.party[i]!.uid, run.party[j]!.uid);
      if (k) out.push(`${nameOf(run.party[i]!)} & ${nameOf(run.party[j]!)}: ${CHEMISTRY_NAMES[k]}`);
    }
  }
  return out;
}
