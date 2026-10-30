// Visible reward synergy (catalog #95, #118): one short line saying why a draft card may matter to the current party.
// Pure: reads the run, changes nothing, uses no RNG.

import type { Content, Reward } from './contentSchema';
import { effectiveAttributes } from './attributes';
import { maxHp } from './pokemon';
import type { RunState } from './state';

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

export function rewardSynergy(content: Content, run: RunState, reward: Reward): string | null {
  const name = (id: string) => content.species.get(id)?.name ?? id;
  const e = reward.effect;
  if (e.kind === 'vitamin') {
    const best = run.party.map((m) => ({ m, v: content.species.get(m.speciesId)?.baseStats[e.stat] ?? 0 })).sort((a, b) => b.v - a.v)[0];
    return best ? `Best on ${name(best.m.speciesId)} (${STAT_LABEL[e.stat] ?? e.stat} ${best.v})` : null;
  }
  if (e.kind === 'levelUp') {
    const low = [...run.party].sort((a, b) => a.level - b.level)[0];
    return low ? `Lowest: ${name(low.speciesId)} Lv${low.level}` : null;
  }
  if (reward.category === 'healing') {
    const hurt = run.party.filter((m) => m.hp < maxHp(content, m)).length;
    return hurt > 0 ? `${hurt} of your Pokémon ${hurt === 1 ? 'is' : 'are'} hurt` : 'Nobody needs it right now';
  }
  if (e.kind === 'attribute') {
    const now = (effectiveAttributes(content, run) as Record<string, number>)[e.attribute];
    return now === undefined ? null : `Your ${e.attribute}: ${now} → ${now + e.amount}`;
  }
  return null;
}
