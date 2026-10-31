// What a Pokédex species page says (pure; drawn by `ui/dexInfo.ts`). Unmet species stay hidden.

import type { Content } from '../contentSchema';
import type { Profile } from '../state';

export type DexState = 'unknown' | 'seen' | 'caught';

export function dexState(profile: Pick<Profile, 'speciesSeen' | 'speciesCaught'>, speciesId: string): DexState {
  if (profile.speciesCaught.includes(speciesId)) return 'caught';
  return profile.speciesSeen.includes(speciesId) ? 'seen' : 'unknown';
}

export interface DexPage {
  state: DexState;
  title: string;
  types: string;
  stats: string[];
  note: string;
}

const STATS = [['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe']] as const;

export function dexPage(content: Content, profile: Pick<Profile, 'speciesSeen' | 'speciesCaught'>, speciesId: string): DexPage {
  const sp = content.species.get(speciesId);
  if (!sp) throw new Error(`Unknown species "${speciesId}"`);
  const state = dexState(profile, speciesId);
  const no = `No. ${String(sp.dex).padStart(4, '0')}`;
  if (state === 'unknown') return { state, title: `${no}  ???`, types: '???', stats: [], note: 'Not met yet. Meet it in a run to fill this page.' };
  const types = sp.types.map((t) => `${t[0]!.toUpperCase()}${t.slice(1)}`).join(' / ');
  const total = STATS.reduce((n, [k]) => n + sp.baseStats[k], 0);
  return {
    state,
    title: `${no}  ${sp.name}`,
    types,
    stats: [...STATS.map(([k, label]) => `${label} ${sp.baseStats[k]}`), `Total ${total}`],
    note: state === 'caught' ? 'You have caught this Pokémon.' : 'Met, not caught yet.',
  };
}
