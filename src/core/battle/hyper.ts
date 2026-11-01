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
import type { Emotion, HYPER_ATTRIBUTES, StoryEventDefinition, StoryTriggerKind } from '../story/schema';

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
  /** Earlier battles this run in which your Pokémon fought this opposing species. */
  rivalBattles(uid: string, speciesId: string): number;
  /** Teammates (uids) your Pokémon has a Friendly Competition with. */
  friendlyRivals(uid: string): string[];
  /** A Pokémon's current emotion (Emotional Awakening), when it has one. */
  emotion?(uid: string): Emotion | null;
}

/** Hyper counters for the battle (saved with it). */
export interface HyperBattleState {
  /** The Pokémon at low HP at the end of the last turn, and for how many turns in a row. */
  lowHp: { uid: string; turns: number } | null;
  /** Super-effective hits each of your Pokémon has survived this battle. */
  superEffective: Record<string, number>;
  /** "The Enemy Is Getting Riled Up": each opposing Pokémon's build-up (by uid). */
  rage: Record<string, EnemyRage>;
  /** Heated Rivalry: the opposing species each of your Pokémon (by uid) has faced this battle. */
  met: Record<string, string[]>;
  /** Rivals that recognised each other this battle ("uid|speciesId"), and whether yours turned reckless. */
  rivals: Record<string, 'calm' | 'reckless'>;
  /** Friendly Competition: your Pokémon that saw a teammate rival land a finishing blow (they hit harder). */
  outdo: string[];
  /** Hits each of your Pokémon has taken this battle (Defiance counts the overwhelmed). */
  taken: Record<string, number>;
  /** Guard Formation (Protective Instinct): turns left for each of your Pokémon (by uid) that is guarded. */
  guard: Record<string, number>;
}

/**
 * An opposing Pokémon's rage: it builds while it takes hits ("calm"), is shown a turn ahead
 * ("warned"), and is either unleashed before its next move or calmed by a counter ("spent").
 */
export interface EnemyRage {
  hits: number;
  state: 'calm' | 'warned' | 'spent';
  /** "Its Rage Is Uncontrollable": it also lowers its own Defense. */
  uncontrollable: boolean;
  /** Your Pokémon survived its finishing blow this turn. */
  denied: boolean;
}

export function freshHyperBattle(): HyperBattleState {
  return { lowHp: null, superEffective: {}, rage: {}, met: {}, rivals: {}, outdo: [], taken: {}, guard: {} };
}

/** Rolls an eligible moment (no roll when it is certain). */
export function rollHyper(hyper: HyperContext, e: HyperEligibility): boolean {
  if (e.chance <= 0) return false;
  if (e.chance >= 1) return true;
  return hyper.rng.chance(e.chance);
}
