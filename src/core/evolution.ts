// Evolution (director decision D15 and GAME_DESIGN.md §5c). Level evolutions
// happen after battles and level-up rewards; every other method (stones,
// trades, friendship, ...) is an item used from the Bag. Friendship
// evolutions also happen on their own once friendship is high enough.

import { genderOf } from './gender';
import type { Content, Evolution } from './contentSchema';
import { blocksEvolution } from './battle/held';
import { friendshipReady } from './friendship';
import { calcStats, getSpecies, isUsableMove, maxHp } from './pokemon';
import type { PokemonInstance } from './state';

/** A stable number from a Pokémon's id, so a branching evolution always goes the same way for that Pokémon. */
function uidHash(uid: string): number {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Narrows the branches that apply right now: a branch for the current region
 * wins (Alolan Raichu in Alola); otherwise branches without a region; then
 * Tyrogue's Attack/Defense condition.
 */
export function applicableBranches(content: Content, mon: PokemonInstance, branches: Evolution[], regionId?: string): Evolution[] {
  const local = branches.filter((e) => e.region && e.region === regionId);
  let list = local.length > 0 ? local : branches.filter((e) => !e.region);
  if (list.some((e) => e.condition)) {
    const { atk, def } = calcStats(content, mon);
    const holds = (c: Evolution['condition']) => (c === 'atkGtDef' ? atk > def : c === 'atkLtDef' ? atk < def : c === 'atkEqDef' ? atk === def : true);
    list = list.filter((e) => holds(e.condition));
  }
  // Gender-bound branches (Gallade, Froslass, Mothim, Meowstic's forms ...).
  if (list.some((e) => e.gender)) {
    const gender = genderOf(content, mon);
    list = list.filter((e) => !e.gender || e.gender === gender);
  }
  return list;
}

/**
 * The species this Pokémon would evolve into on its own right now (by level,
 * or by friendship once it is high enough), if any.
 * Fainted Pokémon don't evolve. When several branches apply (Wurmple, Burmy,
 * Rockruff, ...) one is picked from the Pokémon's id, so it is always the same.
 */
export function evolutionTarget(content: Content, mon: PokemonInstance, regionId?: string, levelOffset = 0, bondReady = false): string | null {
  if (mon.hp <= 0 || mon.care?.holdEvolve) return null;
  const species = getSpecies(content, mon.speciesId);
  // A devoted bond (Bond Engine) can stand in for the last part of the friendship climb.
  const byFriendship = friendshipReady(content, mon) || bondReady;
  const friendshipItem = content.balance.friendship.evolutionItem;
  const ready = species.evolutions.filter((e) => (e.level !== undefined && mon.level >= e.level + levelOffset) || (byFriendship && e.item === friendshipItem));
  const branches = applicableBranches(content, mon, ready, regionId);
  if (branches.length === 0) return null;
  return branches[uidHash(mon.uid) % branches.length]!.to;
}

/** The species an evolution item would turn this Pokémon into (several when the player can choose, e.g. Eevee). */
export function itemEvolutionTargets(content: Content, mon: PokemonInstance, itemId: string, regionId?: string): string[] {
  const species = getSpecies(content, mon.speciesId);
  const matching = species.evolutions.filter((e) => e.item === itemId);
  return applicableBranches(content, mon, matching, regionId).map((e) => e.to);
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
  for (const entry of target.learnset.filter((e) => e.level === mon.level && isUsableMove(content, e.move))) {
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

/** Repeats level and friendship evolution while possible (e.g. a Rare Candy past two thresholds). */
export function evolveFully(content: Content, mon: PokemonInstance, regionId?: string, levelOffset = 0, bondReady = false): EvolutionResult[] {
  const results: EvolutionResult[] = [];
  // An Everstone stops evolution.
  if (blocksEvolution(content, mon)) return results;
  for (let guard = 0; guard < 3; guard++) {
    const to = evolutionTarget(content, mon, regionId, levelOffset, bondReady);
    if (!to) break;
    results.push(evolve(content, mon, to));
  }
  return results;
}
