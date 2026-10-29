// Hyper moments in battle (M8.9 Phase 1). The engine decides them, because
// they change the battle: Toughened It Out, Felt a Bond and Pushed Itself
// Back Up save a Pokémon from a knockout, and Hung In There raises its
// defenses. Their numbers come from the story.json definitions, and who is
// eligible (friendship, memories, attributes) comes from the run through a
// HyperContext (core/story/hyper.ts builds it). Every chance is rolled on the
// "hyper" stream, so the battle stream's rolls never change.
//
// Limits: each moment's cooldown is kept in the battle's story ledger, and
// at most one Hyper moment changes the battle per side per turn.

import type { PokemonInstance } from '../state';
import type { Rng } from '../rng';
import type { HYPER_ATTRIBUTES, StoryEventDefinition, StoryTriggerKind } from '../story/schema';

export type HyperAttribute = (typeof HYPER_ATTRIBUTES)[number];

/** Whether a Pokémon may have a moment now, and how likely it is. */
export interface HyperEligibility {
  def: StoryEventDefinition;
  /** 0–1; 1 or more fires without a roll. */
  chance: number;
  /** A named variant of the definition ("again"), or null. */
  variant: string | null;
}

export interface HyperContext {
  /** The "hyper" random stream. */
  rng: Rng;
  /** Null when the Pokémon can't have this moment (no definition, friendship too low, no memory to draw on). */
  eligibility(trigger: StoryTriggerKind, mon: PokemonInstance): HyperEligibility | null;
  /** An attribute's value as a share of its maximum (0–1). */
  attributeShare(attribute: HyperAttribute): number;
}

/** Hyper counters for the battle (saved with it). */
export interface HyperBattleState {
  /** The Pokémon at low HP at the end of the last turn, and for how many turns in a row. */
  lowHp: { uid: string; turns: number } | null;
  /** Super-effective hits each of your Pokémon has survived this battle. */
  superEffective: Record<string, number>;
}

export function freshHyperBattle(): HyperBattleState {
  return { lowHp: null, superEffective: {} };
}

/** Rolls an eligible moment (no roll when it is certain). */
export function rollHyper(hyper: HyperContext, e: HyperEligibility): boolean {
  if (e.chance <= 0) return false;
  if (e.chance >= 1) return true;
  return hyper.rng.chance(e.chance);
}
