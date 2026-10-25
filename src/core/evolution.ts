// Standard level-up evolution (director decision D15).

import type { Content } from './contentSchema';
import { getSpecies, maxHp } from './pokemon';
import type { PokemonInstance } from './state';

/** The species this Pokémon would evolve into right now, if any. Fainted Pokémon don't evolve. */
export function evolutionTarget(content: Content, mon: PokemonInstance): string | null {
  if (mon.hp <= 0) return null;
  const species = getSpecies(content, mon.speciesId);
  const evo = species.evolutions.find((e) => mon.level >= e.level);
  return evo ? evo.to : null;
}

export interface EvolutionResult {
  from: string;
  to: string;
  /** Moves the new form learns at its current level. */
  learnedMoves: string[];
  /** Moves it wanted to learn but already knows four. */
  wantsToLearn: string[];
}

/**
 * Evolves the Pokémon in place. Keeps its level, XP, moves, status and damage
 * taken (max HP gained is added to current HP). Then teaches any moves the new
 * species learns at exactly its current level.
 */
export function evolve(content: Content, mon: PokemonInstance, to: string): EvolutionResult {
  const from = mon.speciesId;
  const target = getSpecies(content, to);
  const oldMax = maxHp(content, mon);
  mon.speciesId = to;
  mon.hp = Math.min(maxHp(content, mon), mon.hp + (maxHp(content, mon) - oldMax));
  const learnedMoves: string[] = [];
  const wantsToLearn: string[] = [];
  for (const entry of target.learnset.filter((e) => e.level === mon.level && content.moves.has(e.move))) {
    if (mon.moves.some((m) => m.id === entry.move)) continue;
    if (mon.moves.length < 4) {
      mon.moves.push({ id: entry.move, pp: content.moves.get(entry.move)!.pp });
      learnedMoves.push(entry.move);
    } else {
      wantsToLearn.push(entry.move);
    }
  }
  return { from, to, learnedMoves, wantsToLearn };
}

/** Repeats evolution while possible (e.g. a Rare Candy past two thresholds). */
export function evolveFully(content: Content, mon: PokemonInstance): EvolutionResult[] {
  const results: EvolutionResult[] = [];
  for (let guard = 0; guard < 3; guard++) {
    const to = evolutionTarget(content, mon);
    if (!to) break;
    results.push(evolve(content, mon, to));
  }
  return results;
}
