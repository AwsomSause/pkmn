// The five-choice reward draft.
//
// Draft rules (all numbers live in balance.json):
//   1. Work out which rewards are eligible right now (e.g. a vitamin at its
//      stack limit is not).
//   2. For each of the five slots: roll a rarity tier using the tier weights
//      (only tiers that still have unused eligible rewards can be rolled),
//      then a family in that tier (item families, or the reward's category),
//      then a random unused reward from that family. A family already in the
//      draft keeps only repeatFamilyWeight of its chance, and Luck lowers that
//      further (director, answer 4: "variety based on luck stats").
//   3. Fewer than five eligible rewards is a configuration error: we never
//      show duplicates.
// Luck tilts the weights toward uncommon, rare and epic (attributes.ts luckWeights).
// Catalog items (core/catalog.ts) work like any other reward; a team or player
// item already at its max is a free re-roll of the draft (director, answer 5).

import { getArchetype, moneyMultiplier } from './archetypes';
import { evolutionLevelOffset } from './trainerPerks';
import { addRunAttribute, attributeText, runAttributeEffects } from './attributes';
import type { Archetype, Content, Rarity, Reward } from './contentSchema';
import { RARITIES } from './contentSchema';
import { applyCatalog, catalogTargetProblem, getCatalogEntry, isCatalogUseful, isFreeReroll } from './catalog';
import { evolveFully } from './evolution';
import { changeFriendship } from './friendship';
import { addItem, itemCount, itemUseProblem } from './items';
import { hasKeyItem } from './battle/transform';
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
  if (reward.effect.kind === 'catalog') {
    const entry = getCatalogEntry(content, reward.effect.entry);
    return isFreeReroll(run, entry) || isCatalogUseful(content, run, entry);
  }
  if (reward.effect.kind === 'vitamin') {
    const stat = reward.effect.stat;
    return run.party.some((p) => (p.vitamins[stat] ?? 0) < content.balance.vitaminMaxStacks);
  }
  if (reward.effect.kind === 'levelUp') return run.party.some((p) => p.level < runLevelCap(content, run));
  // Evolution items are only offered when someone in the party can evolve with them.
  const item = reward.effect.kind === 'addItem' ? content.items.get(reward.effect.item) : undefined;
  // Key items and Mega Stones are kept for the run, so they're offered once; a stone only when a party member can use it.
  if (item?.effect.kind === 'keyItem') return itemCount(run.inventory, item.id) === 0;
  // Tera Shards only matter once you have the Tera Orb.
  if (item?.effect.kind === 'teraShard') return hasKeyItem(content, run.inventory, 'tera');
  // A Z-Crystal is offered once you have the Z-Ring, and only when a party member knows a move of its type.
  if (item?.effect.kind === 'zCrystal') {
    const type = item.effect.type;
    return itemCount(run.inventory, item.id) === 0 && hasKeyItem(content, run.inventory, 'zmove') && run.party.some((p) => p.moves.some((m) => content.moves.get(m.id)?.type === type));
  }
  if (item?.effect.kind === 'megaStone') {
    const forms = item.effect.forms;
    return itemCount(run.inventory, item.id) === 0 && run.party.some((p) => forms[p.speciesId] !== undefined);
  }
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
  if (reward.effect.kind === 'catalog') return catalogTargetProblem(content, run, getCatalogEntry(content, reward.effect.entry), mon);
  if (reward.effect.kind === 'vitamin' && (mon.vitamins[reward.effect.stat] ?? 0) >= content.balance.vitaminMaxStacks) {
    return 'That Pokémon has already had the maximum.';
  }
  const cap = runLevelCap(content, run);
  if (reward.effect.kind === 'levelUp' && mon.level >= cap) return `That Pokémon is already at the level cap (${cap}).`;
  return null;
}

/** A free re-roll card: a team or player item the run already has the most of. */
export function isRerollReward(content: Content, run: RunState, reward: Reward): boolean {
  return reward.effect.kind === 'catalog' && isFreeReroll(run, getCatalogEntry(content, reward.effect.entry));
}

export function rewardFamily(reward: Reward): string {
  return reward.family ?? reward.category;
}

export function generateDraft(
  content: Content,
  run: RunState,
  rng: Rng,
  weights: Partial<Record<Rarity, number>> = content.balance.rarityWeights,
  draftVariety = runAttributeEffects(content, run).draftVariety,
  /** Draft items: a bigger draft, rewards that must be in it (first), and rewards that must not (the rest of a draft being re-rolled). */
  opts: { size?: number; forced?: readonly string[]; exclude?: readonly string[] } = {},
): string[] {
  const size = opts.size ?? content.balance.draftSize;
  const forced = [...new Set(opts.forced ?? [])].filter((id) => content.rewards.has(id) && isRewardEligible(content, run, content.rewards.get(id)!)).slice(0, size);
  const skip = new Set([...forced, ...(opts.exclude ?? [])]);
  const eligible = [...content.rewards.values()].filter((r) => !skip.has(r.id) && isRewardEligible(content, run, r));
  if (eligible.length + forced.length < size) {
    throw new RewardConfigError(`Only ${eligible.length + forced.length} eligible rewards; a draft needs ${size} distinct rewards`);
  }
  const byTier = new Map<Rarity, Reward[]>(RARITIES.map((t) => [t, eligible.filter((r) => r.rarity === t)]));
  const repeatWeight = content.balance.repeatFamilyWeight * (1 - draftVariety);
  const chosen: string[] = [...forced];
  if (forced.some((id) => content.rewards.get(id)!.category === 'attribute')) for (const p of byTier.values()) for (let i = p.length - 1; i >= 0; i--) if (p[i]!.category === 'attribute') p.splice(i, 1);
  const families = new Set<string>(forced.map((id) => rewardFamily(content.rewards.get(id)!)));
  while (chosen.length < size) {
    const tier = rng.weighted(
      RARITIES.map((t) => ({ item: t, weight: byTier.get(t)!.length > 0 ? weights[t] ?? 0 : 0 })),
    );
    const pool = byTier.get(tier)!;
    const tierFamilies = [...new Set(pool.map(rewardFamily))];
    const anyFresh = tierFamilies.some((f) => !families.has(f));
    // A tier holding only families already shown still fills the slot.
    const family = rng.weighted(tierFamilies.map((f) => ({ item: f, weight: anyFresh && families.has(f) ? repeatWeight : 1 })));
    const members = pool.filter((r) => rewardFamily(r) === family);
    const reward = members[rng.int(0, members.length - 1)]!;
    pool.splice(pool.indexOf(reward), 1);
    // At most one attribute item per draft: once one is in, the rest leave every tier.
    if (reward.category === 'attribute') for (const p of byTier.values()) for (let i = p.length - 1; i >= 0; i--) if (p[i]!.category === 'attribute') p.splice(i, 1);
    families.add(family);
    chosen.push(reward.id);
  }
  return chosen;
}

export interface RewardResult {
  rewardId: string;
  messages: string[];
  /** Moves a levelled-up Pokémon wants to learn (it already knows four), and choices items ask for. */
  pending: PendingDecision[];
  /** The pick was a free re-roll: the run gets a new draft instead of moving on. */
  reroll?: boolean;
}

/**
 * Applies a reward to the run (mutates `run`). Rewards with scope "pokemon"
 * go to `targetIndex` in the party. Returns messages for the player.
 */
export function applyReward(content: Content, run: RunState, archetype: Archetype, rewardId: string, targetIndex = 0, rng?: Rng): RewardResult {
  const reward = content.rewards.get(rewardId);
  if (!reward) throw new Error(`Unknown reward "${rewardId}"`);
  const problem = rewardTargetProblem(content, run, reward, targetIndex);
  if (problem) throw new Error(problem);
  const target = run.party[targetIndex];
  const effect = reward.effect;
  const messages: string[] = [];
  const pending: PendingDecision[] = [];
  switch (effect.kind) {
    case 'catalog': {
      const entry = getCatalogEntry(content, effect.entry);
      if (isFreeReroll(run, entry)) {
        messages.push(`You already have the ${entry.name}. Free re-roll!`);
        run.log.rewardsTaken.push(rewardId);
        return { rewardId, messages, pending, reroll: true };
      }
      if (!rng) throw new Error('A catalog item needs the reward stream');
      const result = applyCatalog(content, run, entry, target, { moneyMultiplier: reward.moneyMultiplierApplies ? moneyMultiplier(archetype) : 1, rng });
      messages.push(...result.messages);
      pending.push(...result.pending);
      break;
    }
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
      changeFriendship(content, mon, content.balance.friendship.perLevel * result.levelsGained, runAttributeEffects(content, run).friendship);
      messages.push(`${nameOf(content, mon.speciesId)} grew to level ${result.newLevel}!`);
      for (const m of result.learnedMoves) messages.push(`${nameOf(content, mon.speciesId)} learned ${content.moves.get(m)!.name}!`);
      for (const m of result.skippedMoves) pending.push({ kind: 'learnMove', uid: mon.uid, moveId: m });
      for (const evo of evolveFully(content, mon, run.regionOrder[run.regionIndex], evolutionLevelOffset(getArchetype(content, run.archetypeId).modifiers))) {
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
      changeFriendship(content, mon, content.balance.friendship.perVitamin, runAttributeEffects(content, run).friendship);
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
