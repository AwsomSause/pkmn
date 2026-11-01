// Smart item distribution (Major Update spec §1, PokeRogue-style).
//
// The draft (rewards.ts) rolls a rarity tier, then a family, then a reward.
// This module tilts those odds by the run's situation; all numbers live in
// balance.json `itemDistribution`. It reads state only and never rolls.
//   - Tier odds: rare and epic grow a little with each badge (capped), and every
//     epic already taken this run makes the next one rarer (no epic snowball).
//   - Reward odds (relevance):
//       0     a species item (Light Ball, Soul Dew, Griseous Orb...) when no party
//             member is that species: never offered;
//       low   a type item (Charcoal, Fire Gem, Flame Plate...) when no party
//             member knows a move of that type;
//       less  for each copy the run already owns (held across the party or in the Bag);
//       more  for healing when party members are hurt or fainted.

import type { CatalogEntry, Content, Rarity, Reward } from './contentSchema';
import { getCatalogEntry, ownedCopies } from './catalog';
import { itemCount } from './items';
import { maxHp } from './pokemon';
import type { PokemonInstance, RunState } from './state';

type Weights = Partial<Record<Rarity, number>>;

/** Species ids a Pokémon counts as for species-locked items: itself and its base form. */
function speciesKeys(content: Content, mon: PokemonInstance): string[] {
  const base = content.species.get(mon.speciesId)?.form?.base;
  return base ? [mon.speciesId, base] : [mon.speciesId];
}

/** The species a held item needs (null: anyone can use it). */
export function itemSpecies(entry: CatalogEntry): string[] | null {
  const effect = entry.effect;
  if (effect?.kind !== 'held') return null;
  const out = new Set<string>();
  for (const hook of effect.hooks as readonly Record<string, unknown>[]) {
    if (Array.isArray(hook.species)) for (const s of hook.species) out.add(String(s));
    if (hook.hook === 'formHeld' && typeof hook.from === 'string') out.add(hook.from);
    if (hook.hook === 'memory') out.add('silvally');
  }
  return out.size > 0 ? [...out] : null;
}

/** The move types a held item powers up (typePower, gems); empty when it isn't a type item. */
export function itemTypes(entry: CatalogEntry): string[] {
  const effect = entry.effect;
  if (effect?.kind !== 'held') return [];
  const out = new Set<string>();
  for (const hook of effect.hooks as readonly Record<string, unknown>[]) {
    if (hook.hook !== 'typePower' && hook.hook !== 'gem') continue;
    if (Array.isArray(hook.types)) for (const t of hook.types) out.add(String(t));
    if (typeof hook.type === 'string') out.add(hook.type);
  }
  return [...out];
}

/** Copies of a catalog item the run already owns: held across the party or loose in the Bag, or as a team/player item. */
export function catalogCopies(run: RunState, entry: CatalogEntry): number {
  if (entry.stacksOn === 'pokemon' && entry.effect?.kind === 'held') return run.party.reduce((n, p) => n + (p.held?.[entry.id] ?? 0), run.looseHeld?.[entry.id] ?? 0);
  if (entry.stacksOn === 'pokemon') return 0;
  return ownedCopies(run, entry);
}

/** Share of the party that is hurt (HP below full) and share that has fainted, 0..1 each. */
function partyNeed(content: Content, run: RunState): { hurt: number; fainted: number } {
  const n = run.party.length || 1;
  let hurt = 0;
  let fainted = 0;
  for (const p of run.party) {
    if (p.hp <= 0) fainted++;
    else if (p.hp < maxHp(content, p) || p.status) hurt++;
  }
  return { hurt: hurt / n, fainted: fainted / n };
}

function isHealing(content: Content, reward: Reward, entry: CatalogEntry | null): 'heal' | 'revive' | null {
  if (entry) {
    const e = entry.effect;
    if (e?.kind === 'care' || e?.kind === 'teamCare') return e.revive !== undefined ? 'revive' : 'heal';
    return null;
  }
  if (reward.effect.kind !== 'addItem') return null;
  const category = content.items.get(reward.effect.item)?.category;
  if (category === 'revive') return 'revive';
  return reward.category === 'healing' ? 'heal' : null;
}

/** How likely this reward is to be offered compared with others in its family (1 = normal, 0 = never). */
export function rewardRelevance(content: Content, run: RunState, reward: Reward): number {
  const cfg = content.balance.itemDistribution;
  if (!cfg.enabled) return 1;
  const entry = reward.effect.kind === 'catalog' ? getCatalogEntry(content, reward.effect.entry) : null;
  let weight = 1;
  if (entry) {
    const species = itemSpecies(entry);
    if (species && !run.party.some((p) => speciesKeys(content, p).some((s) => species.includes(s)))) return 0;
    const types = itemTypes(entry);
    if (types.length > 0 && !run.party.some((p) => p.moves.some((m) => types.includes(content.moves.get(m.id)?.type ?? '')))) weight *= cfg.offTypeWeight;
    weight /= 1 + cfg.ownedPenalty * catalogCopies(run, entry);
  } else if (reward.effect.kind === 'addItem') {
    weight /= 1 + cfg.ownedPenalty * (itemCount(run.inventory, reward.effect.item) / Math.max(1, reward.effect.quantity));
  }
  const healing = isHealing(content, reward, entry);
  if (healing) {
    const need = partyNeed(content, run);
    weight *= healing === 'revive' ? cfg.healIdleWeight + cfg.needBonus * need.fainted : cfg.healIdleWeight + cfg.needBonus * need.hurt;
  }
  return weight;
}

/** Epic rewards already taken this run. */
export function epicsTaken(content: Content, run: RunState): number {
  return run.log.rewardsTaken.filter((id) => content.rewards.get(id)?.rarity === 'epic').length;
}

/** Tier weights for this run: rare/epic grow with badges, epic shrinks after each epic taken. */
export function adjustTierWeights(content: Content, run: RunState, weights: Weights): Weights {
  const cfg = content.balance.itemDistribution;
  if (!cfg.enabled) return weights;
  const badges = Math.min(run.badges.length, cfg.badgeCap);
  const epicDecay = Math.max(cfg.epicRepeatFloor, cfg.epicRepeatDecay ** epicsTaken(content, run));
  return {
    ...weights,
    rare: (weights.rare ?? 0) * (1 + cfg.rarePerBadge * badges),
    epic: (weights.epic ?? 0) * (1 + cfg.epicPerBadge * badges) * epicDecay,
  };
}
