// The five-choice reward draft.
//
// Draft rules (all numbers live in balance.json):
//   1. Work out which rewards are eligible right now (e.g. a vitamin at its
//      stack limit is not).
//   2. For each of the five slots: roll a rarity tier using the tier weights
//      (only tiers that still have unused eligible rewards can be rolled), then
//      pick a random unused reward from that tier.
//   3. Fewer than five eligible rewards is a configuration error: we never
//      show duplicates.
// Luck does not change the weights yet; its formula is an open design decision.

import { moneyMultiplier } from './archetypes';
import type { Archetype, Content, Rarity, Reward } from './contentSchema';
import { RARITIES } from './contentSchema';
import { addLevels, maxHp } from './pokemon';
import type { Rng } from './rng';
import type { RunState } from './state';

export class RewardConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewardConfigError';
  }
}

export function isRewardEligible(content: Content, run: RunState, reward: Reward): boolean {
  const lead = run.party[0];
  if (reward.scope === 'lead' && !lead) return false;
  if (reward.effect.kind === 'vitamin' && lead) {
    return (lead.vitamins[reward.effect.stat] ?? 0) < content.balance.vitaminMaxStacks;
  }
  if (reward.effect.kind === 'levelUp' && lead) return lead.level < 100;
  return true;
}

export function generateDraft(content: Content, run: RunState, rng: Rng): string[] {
  const size = content.balance.draftSize;
  const eligible = [...content.rewards.values()].filter((r) => isRewardEligible(content, run, r));
  if (eligible.length < size) {
    throw new RewardConfigError(`Only ${eligible.length} eligible rewards; a draft needs ${size} distinct rewards`);
  }
  const byTier = new Map<Rarity, Reward[]>(RARITIES.map((t) => [t, eligible.filter((r) => r.rarity === t)]));
  const chosen: string[] = [];
  while (chosen.length < size) {
    const tier = rng.weighted(
      RARITIES.map((t) => ({ item: t, weight: byTier.get(t)!.length > 0 ? content.balance.rarityWeights[t] ?? 0 : 0 })),
    );
    const pool = byTier.get(tier)!;
    const index = rng.int(0, pool.length - 1);
    const [reward] = pool.splice(index, 1);
    chosen.push(reward!.id);
  }
  return chosen;
}

export interface RewardResult {
  rewardId: string;
  message: string;
}

/** Applies a reward to the run (mutates `run`). Returns a message for the player. */
export function applyReward(content: Content, run: RunState, archetype: Archetype, rewardId: string): RewardResult {
  const reward = content.rewards.get(rewardId);
  if (!reward) throw new Error(`Unknown reward "${rewardId}"`);
  const lead = run.party[0];
  const effect = reward.effect;
  let message = '';
  switch (effect.kind) {
    case 'healHp': {
      if (!lead) break;
      const max = maxHp(content, lead);
      const before = lead.hp;
      lead.hp = effect.amount === 'full' ? max : Math.min(max, lead.hp + effect.amount);
      message = `${nameOf(content, lead.speciesId)} recovered ${lead.hp - before} HP.`;
      break;
    }
    case 'cureStatus':
      if (!lead) break;
      lead.status = null;
      message = `${nameOf(content, lead.speciesId)} is cured of status problems.`;
      break;
    case 'fullRestore':
      if (!lead) break;
      lead.hp = maxHp(content, lead);
      lead.status = null;
      message = `${nameOf(content, lead.speciesId)} is fully restored.`;
      break;
    case 'restorePp':
      if (!lead) break;
      for (const slot of lead.moves) {
        const max = content.moves.get(slot.id)!.pp;
        slot.pp = Math.min(max, slot.pp + effect.amount);
      }
      message = `${nameOf(content, lead.speciesId)}'s moves regained PP.`;
      break;
    case 'money': {
      const multiplier = reward.moneyMultiplierApplies ? moneyMultiplier(archetype) : 1;
      const amount = Math.floor(effect.amount * multiplier);
      run.money += amount;
      message = `You received ₽${amount}.`;
      break;
    }
    case 'levelUp': {
      if (!lead) break;
      const result = addLevels(content, lead, effect.levels);
      message = `${nameOf(content, lead.speciesId)} grew to level ${result.newLevel}!`;
      break;
    }
    case 'vitamin': {
      if (!lead) break;
      const before = maxHp(content, lead);
      lead.vitamins[effect.stat] = Math.min(content.balance.vitaminMaxStacks, (lead.vitamins[effect.stat] ?? 0) + 1);
      if (effect.stat === 'hp') lead.hp += maxHp(content, lead) - before;
      message = `${nameOf(content, lead.speciesId)}'s ${STAT_LABELS[effect.stat]} rose!`;
      break;
    }
  }
  run.log.rewardsTaken.push(rewardId);
  return { rewardId, message };
}

const STAT_LABELS = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as const;

function nameOf(content: Content, speciesId: string): string {
  return content.species.get(speciesId)?.name ?? speciesId;
}
