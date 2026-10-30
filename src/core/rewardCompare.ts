// Reward comparison (catalog #118): "now" against "after" for the Pokémon or meter a draft card would change.
// Pure: it works on copies and changes nothing.

import type { Content, Reward } from './contentSchema';
import { effectiveAttributes } from './attributes';
import { calcStats } from './pokemon';
import { runLevelCap } from './regions';
import type { RunState } from './state';

export interface RewardCompare {
  /** What changes, e.g. "Charizard Atk". */
  label: string;
  now: number;
  after: number;
}

const STAT: Record<string, 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'> = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe' };
const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

export function compareReward(content: Content, run: RunState, reward: Reward): RewardCompare | null {
  const e = reward.effect;
  const name = (id: string) => content.species.get(id)?.name ?? id;
  if (e.kind === 'vitamin') {
    const key = STAT[e.stat]!;
    const best = [...run.party].sort((a, b) => (content.species.get(b.speciesId)?.baseStats[key] ?? 0) - (content.species.get(a.speciesId)?.baseStats[key] ?? 0))[0];
    if (!best) return null;
    const after = structuredClone(best);
    after.vitamins[e.stat] = Math.min(content.balance.vitaminMaxStacks, (after.vitamins[e.stat] ?? 0) + 1);
    return { label: `${name(best.speciesId)} ${STAT_LABEL[e.stat]}`, now: calcStats(content, best)[key], after: calcStats(content, after)[key] };
  }
  if (e.kind === 'levelUp') {
    const low = [...run.party].sort((a, b) => a.level - b.level)[0];
    if (!low) return null;
    return { label: `${name(low.speciesId)} level`, now: low.level, after: Math.min(runLevelCap(content, run), low.level + e.levels) };
  }
  if (e.kind === 'attribute') {
    const now = (effectiveAttributes(content, run) as Record<string, number>)[e.attribute];
    return now === undefined ? null : { label: e.attribute, now, after: now + e.amount };
  }
  if (e.kind === 'money') return { label: 'Money ₽', now: run.money, after: run.money + e.amount };
  return null;
}

export const compareText = (c: RewardCompare) => `${c.label}: ${c.now} → ${c.after}`;
