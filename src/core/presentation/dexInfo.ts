// What a Pokédex species page says (pure; drawn by `ui/dexInfo.ts`). Unmet species stay hidden.

import type { Content } from '../contentSchema';
import { maxResearchLevel, nextResearchGoal, researchLevelOf, tallyOf } from '../dexResearch';
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
  /** Species research (S497): level and what the next level needs. Empty until the species is met. */
  research: string;
}

const STATS = [['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe']] as const;

export function dexPage(content: Content, profile: Pick<Profile, 'speciesSeen' | 'speciesCaught'> & Partial<Pick<Profile, 'dexResearch'>>, speciesId: string): DexPage {
  const sp = content.species.get(speciesId);
  if (!sp) throw new Error(`Unknown species "${speciesId}"`);
  const state = dexState(profile, speciesId);
  const no = `No. ${String(sp.dex).padStart(4, '0')}`;
  if (state === 'unknown') return { state, title: `${no}  ???`, types: '???', stats: [], note: 'Not met yet. Meet it in a run to fill this page.', research: '' };
  const types = sp.types.map((t) => `${t[0]!.toUpperCase()}${t.slice(1)}`).join(' / ');
  const total = STATS.reduce((n, [k]) => n + sp.baseStats[k], 0);
  return {
    state,
    title: `${no}  ${sp.name}`,
    types,
    stats: [...STATS.map(([k, label]) => `${label} ${sp.baseStats[k]}`), `Total ${total}`],
    note: state === 'caught' ? 'You have caught this Pokémon.' : 'Met, not caught yet.',
    research: researchLine(profile, speciesId),
  };
}

function researchLine(profile: Partial<Pick<Profile, 'dexResearch'>>, speciesId: string): string {
  const t = tallyOf(profile, speciesId);
  const level = researchLevelOf(t);
  const goal = nextResearchGoal(t);
  return `Research level ${level} of ${maxResearchLevel()}${goal ? ` · Next: ${goal}` : ' · Perfect!'}`;
}

/** The Pokédex "Data" page (Pokedex Data Page pack idea): abilities, breeding, evolutions and the level-up moves. */
export interface DexDataPage {
  state: DexState;
  title: string;
  /** Short labelled facts, one per line. */
  facts: string[];
  /** How it evolves, one line per way (empty for a final form). */
  evolutions: string[];
  /** Level-up moves ("Lv 12  Vine Whip"). */
  moves: string[];
}

const title = (s: string): string => s.split('-').map((w) => `${w[0]!.toUpperCase()}${w.slice(1)}`).join(' ');

export function dexDataPage(content: Content, profile: Pick<Profile, 'speciesSeen' | 'speciesCaught'>, speciesId: string): DexDataPage {
  const sp = content.species.get(speciesId);
  if (!sp) throw new Error(`Unknown species "${speciesId}"`);
  const state = dexState(profile, speciesId);
  const no = `No. ${String(sp.dex).padStart(4, '0')}`;
  if (state === 'unknown') return { state, title: `${no}  ???`, facts: [], evolutions: [], moves: [] };
  const abilityName = (id: string): string => content.abilities.get(id)?.name ?? title(id);
  const hidden = sp.abilities.hidden;
  const female = sp.femaleRatio;
  const facts = [
    `Abilities: ${sp.abilities.normal.map(abilityName).join(', ')}`,
    `Hidden ability: ${hidden ? (state === 'caught' ? abilityName(hidden) : '???') : 'none'}`,
    `Egg groups: ${sp.eggGroups.length ? sp.eggGroups.map(title).join(', ') : 'none'}`,
    `Gender: ${female === null || female === undefined ? 'unknown' : female === 0 ? 'male only' : female === 1 ? 'female only' : `${Math.round((1 - female) * 100)}% male, ${Math.round(female * 100)}% female`}`,
    `Weight: ${sp.weight} kg`,
    `Catch rate: ${sp.catchRate}`,
    `Growth: ${title(sp.growthRate)}`,
  ];
  const evolutions = sp.evolutions.map((e) => {
    const how = [e.level ? `Lv ${e.level}` : '', e.item ? title(e.item) : '', e.condition ? title(String(e.condition)) : '', e.region ? `in ${title(e.region)}` : ''].filter(Boolean).join(', ');
    return `${content.species.get(e.to)?.name ?? title(e.to)}${how ? ` (${how})` : ''}`;
  });
  const moves = sp.learnset.slice(0, 14).map((e) => `Lv ${String(e.level).padStart(2, ' ')}  ${content.moves.get(e.move)?.name ?? title(e.move)}`);
  return { state, title: `${no}  ${sp.name}`, facts, evolutions, moves };
}
