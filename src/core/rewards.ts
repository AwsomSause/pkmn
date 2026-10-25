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
import { addRunAttribute, attributeText } from './attributes';
import type { Archetype, Content, Rarity, Reward } from './contentSchema';
import { RARITIES } from './contentSchema';
import { evolveFully } from './evolution';
import { addItem, itemUseProblem } from './items';
import { addLevels, maxHp } from './pokemon';
import { count } from './progress';
import { runLevelCap } from './regions';
import type { Rng } from './rng';
import type { PendingDecision, RunState } from './state';

export class RewardConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewardConfigError';
  }
}

export function isRewardEligible(content: Content, run: RunState, reward: Reward): boolean {
  if (reward.scope === 'pokemon' && run.party.length === 0) return false;
  if (reward.effect.kind === 'vitamin') {
    const stat = reward.effect.stat;
    return run.party.some((p) => (p.vitamins[stat] ?? 0) < content.balance.vitaminMaxStacks);
  }
  if (reward.effect.kind === 'levelUp') return run.party.some((p) => p.level < runLevelCap(content, run));
  // Evolution items are only offered when someone in the party can evolve with them.
  const item = reward.effect.kind === 'addItem' ? content.items.get(reward.effect.item) : undefined;
  if (item?.effect.kind === 'evolve') {
    return run.party.some((p) => itemUseProblem(content, item, p, run.regionOrder[run.regionIndex]) === null);
  }
  return true;
}

/** Why this reward can't go to this Pokémon, or null if it can. */
export function rewardTargetProblem(content: Content, run: RunState, reward: Reward, targetIndex: number): string | null {
  if (reward.scope !== 'pokemon') return null;
  const mon = run.party[targetIndex];
  if (!mon) return 'Choose a Pokémon.';
  if (reward.effect.kind === 'vitamin' && (mon.vitamins[reward.effect.stat] ?? 0) >= content.balance.vitaminMaxStacks) {
    return 'That Pokémon has already had the maximum.';
  }
  const cap = runLevelCap(content, run);
  if (reward.effect.kind === 'levelUp' && mon.level >= cap) return `That Pokémon is already at the level cap (${cap}).`;
  return null;
}

export function generateDraft(content: Content, run: RunState, rng: Rng, weights: Partial<Record<Rarity, number>> = content.balance.rarityWeights): string[] {
  const size = content.balance.draftSize;
  const eligible = [...content.rewards.values()].filter((r) => isRewardEligible(content, run, r));
  if (eligible.length < size) {
    throw new RewardConfigError(`Only ${eligible.length} eligible rewards; a draft needs ${size} distinct rewards`);
  }
  const byTier = new Map<Rarity, Reward[]>(RARITIES.map((t) => [t, eligible.filter((r) => r.rarity === t)]));
  const chosen: string[] = [];
  while (chosen.length < size) {
    const tier = rng.weighted(
      RARITIES.map((t) => ({ item: t, weight: byTier.get(t)!.length > 0 ? weights[t] ?? 0 : 0 })),
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
  messages: string[];
  /** Moves a levelled-up Pokémon wants to learn (it already knows four). */
  pending: PendingDecision[];
}

/**
 * Applies a reward to the run (mutates `run`). Rewards with scope "pokemon"
 * go to `targetIndex` in the party. Returns messages for the player.
 */
export function applyReward(content: Content, run: RunState, archetype: Archetype, rewardId: string, targetIndex = 0): RewardResult {
  const reward = content.rewards.get(rewardId);
  if (!reward) throw new Error(`Unknown reward "${rewardId}"`);
  const problem = rewardTargetProblem(content, run, reward, targetIndex);
  if (problem) throw new Error(problem);
  const target = run.party[targetIndex];
  const effect = reward.effect;
  const messages: string[] = [];
  const pending: PendingDecision[] = [];
  switch (effect.kind) {
    case 'addItem': {
      addItem(run.inventory, effect.item, effect.quantity);
      const item = content.items.get(effect.item)!;
      messages.push(`${item.name}${effect.quantity > 1 ? ` ×${effect.quantity}` : ''} added to your Bag.`);
      break;
    }
    case 'money': {
      const multiplier = reward.moneyMultiplierApplies ? moneyMultiplier(archetype) : 1;
      const amount = Math.floor(effect.amount * multiplier);
      run.money += amount;
      messages.push(`You received ₽${amount}.`);
      break;
    }
    case 'levelUp': {
      const mon = target!;
      const result = addLevels(content, mon, effect.levels, runLevelCap(content, run));
      messages.push(`${nameOf(content, mon.speciesId)} grew to level ${result.newLevel}!`);
      for (const m of result.learnedMoves) messages.push(`${nameOf(content, mon.speciesId)} learned ${content.moves.get(m)!.name}!`);
      for (const m of result.skippedMoves) pending.push({ kind: 'learnMove', uid: mon.uid, moveId: m });
      for (const evo of evolveFully(content, mon, run.regionOrder[run.regionIndex])) {
        count(run, 'evolutions');
        messages.push(`${nameOf(content, evo.from)} evolved into ${nameOf(content, evo.to)}!`);
        for (const m of evo.learnedMoves) messages.push(`${nameOf(content, evo.to)} learned ${content.moves.get(m)!.name}!`);
        for (const m of evo.wantsToLearn) pending.push({ kind: 'learnMove', uid: mon.uid, moveId: m });
      }
      break;
    }
    case 'attribute': {
      const value = addRunAttribute(content, run, effect.attribute, effect.amount);
      messages.push(`${attributeText(effect.attribute, value)} for the rest of this run.`);
      break;
    }
    case 'vitamin': {
      const mon = target!;
      const before = maxHp(content, mon);
      mon.vitamins[effect.stat] = Math.min(content.balance.vitaminMaxStacks, (mon.vitamins[effect.stat] ?? 0) + 1);
      if (effect.stat === 'hp' && mon.hp > 0) mon.hp += maxHp(content, mon) - before;
      messages.push(`${nameOf(content, mon.speciesId)}'s ${STAT_LABELS[effect.stat]} rose!`);
      break;
    }
  }
  run.log.rewardsTaken.push(rewardId);
  return { rewardId, messages, pending };
}

const STAT_LABELS = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as const;

function nameOf(content: Content, speciesId: string): string {
  return content.species.get(speciesId)?.name ?? speciesId;
}
