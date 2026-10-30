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
  if (e.kind === 'addItem') {
    const have = run.inventory[e.item] ?? 0;
    return have > 0 ? `You carry ${have} already` : 'New to your Bag';
  }
  if (e.kind === 'money') return `You have ₽${run.money}`;
  if (e.kind === 'deal') {
    if (e.cost > 0) return run.money >= e.cost ? `Costs ₽${e.cost}; you have ₽${run.money}` : `Costs ₽${e.cost}; you only have ₽${run.money}`;
    return e.chance < 1 ? `${Math.round(e.chance * 100)}% chance to pay off` : 'A sure bundle, no cost';
  }
  if (e.kind === 'catalog') {
    const entry = content.catalog.get(e.entry);
    if (!entry) return null;
    const have = run.inventory[e.entry] ?? 0;
    if (reward.category === 'transformation' || reward.category === 'key') return have > 0 ? `You already carry ${have}` : 'You have none yet';
    const fainted = run.party.filter((m) => m.hp <= 0).length;
    if (entry.family.startsWith('Revive') || /revive/i.test(entry.name)) return fainted > 0 ? `${fainted} fainted Pokémon could use it` : 'Nobody has fainted';
    return have > 0 ? `You carry ${have} already` : 'New to your Bag';
  }
  return null;
}
