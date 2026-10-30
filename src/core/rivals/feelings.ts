// How a rival feels about you (Techno blueprint §6.2, Grudge & Respect): a descriptive state
// worked out from its character and what really happened between you, never a moral label.
// Respect asks for a fair rematch; resentment opens aggressively; fear opens guarded.
// Pure and deterministic: nothing here draws a random number.

import type { Rival } from '../story/schema';
import { RIVAL_CONFIG } from './schema';

export const FEELINGS = ['respect', 'rivalry', 'fear', 'gratitude', 'resentment', 'unresolved'] as const;
export type Feeling = (typeof FEELINGS)[number];

export const FEELING_NAMES: Record<Feeling, string> = {
  respect: 'Respect',
  rivalry: 'Rivalry',
  fear: 'Fear',
  gratitude: 'Gratitude',
  resentment: 'Resentment',
  unresolved: 'Unresolved',
};

/** Why the rival feels this way, in a line (what it remembers). */
export interface FeelingRead {
  feeling: Feeling;
  because: string;
}

export function rivalFeeling(rival: Rival): FeelingRead {
  const t = rival.traits;
  const last = rival.memory.lastBattle;
  const close = last.hpLeftShare <= RIVAL_CONFIG.spark.closeHpShare;
  const lopsided = last.hpLeftShare >= RIVAL_CONFIG.spark.dominantHpShare;
  if (rival.state === 'ally') return { feeling: 'gratitude', because: 'you showed it a better way to fight' };
  if (rival.state === 'retired') return { feeling: 'fear', because: 'your Pokémon beat it too many times for it to keep going' };
  if (rival.encounters < 2 && !close) return { feeling: 'unresolved', because: 'it has only met you once' };
  if (lopsided && t.resilience < 40) return { feeling: 'fear', because: 'it was overpowered last time' };
  if (lopsided && t.vindictiveness >= 55) return { feeling: 'resentment', because: 'it was outplayed and has not forgotten' };
  if (rival.state === 'nemesis' && t.vindictiveness >= 55) return { feeling: 'resentment', because: 'it blames you for every setback' };
  if (close && t.empathy >= 45) return { feeling: 'respect', because: 'your last battle was a close one' };
  if (rival.encounters >= 3 && t.empathy >= 55 && t.pride <= 50) return { feeling: 'respect', because: 'you have beaten it fairly, again and again' };
  if (rival.state === 'active' || rival.state === 'contender' || close) return { feeling: 'rivalry', because: close ? 'it nearly won' : 'it wants to settle the score' };
  return { feeling: 'unresolved', because: 'the score between you is still open' };
}

/** What the feeling does at the start of a rematch (null: nothing). */
export function openingFor(feeling: Feeling): 'rivalResentment' | 'rivalFear' | 'rivalRespect' | null {
  return feeling === 'resentment' ? 'rivalResentment' : feeling === 'fear' ? 'rivalFear' : feeling === 'respect' ? 'rivalRespect' : null;
}
