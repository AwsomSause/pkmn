// "A Past Pokémon Wants to Join Your Party" (M8.9 Phase 1, slice 5, simple version).
// When a run ends, its party is kept in the profile's archive of past Pokémon.
// A new run may pick one of them (Hall of Fame Pokémon are likelier) to meet
// after a few battles won: it offers to join at the level of the battle you just
// won, keeping its moves, ability, shininess and Tera type. You can take it,
// take a keepsake (candies), or let it go on its journey.
//
// The choice is rolled on a generator of its own, seeded by the run's seed, so
// no other roll changes.

import type { Content } from '../contentSchema';
import { getSpecies, createPokemon, maxHp } from '../pokemon';
import { hashSeed, Rng } from '../rng';
import type { PastPokemon, PokemonInstance, Profile, RunState } from '../state';

/** Adds a finished run's party to the front of the archive (mutates `profile`), keeping the newest `archiveSize`. */
export function archiveParty(content: Content, profile: Profile, run: RunState): void {
  const kept: PastPokemon[] = run.party.map((m) => ({
    speciesId: m.speciesId,
    level: m.level,
    shiny: m.shiny,
    abilitySlot: m.abilitySlot,
    moves: m.moves.map((s) => s.id),
    ...(m.teraType ? { teraType: m.teraType } : {}),
    runId: run.runId,
    hallOfFame: run.victory,
    titles: run.story.histories[m.uid]?.titles ?? [],
  }));
  profile.pastPokemon = [...kept, ...profile.pastPokemon].slice(0, content.balance.reunion.archiveSize);
}

/** Whether this run has a reunion, with whom and when (null: none). Rolled on its own generator. */
export function planReunion(content: Content, seed: string, archive: readonly PastPokemon[]): RunState['reunion'] | null {
  const cfg = content.balance.reunion;
  const known = archive.filter((p) => content.species.has(p.speciesId));
  if (known.length === 0) return null;
  const rng = new Rng(hashSeed(`${seed}::reunion`));
  if (!rng.chance(cfg.chance)) return null;
  const mon = rng.weighted(known.map((p) => ({ item: p, weight: p.hallOfFame ? cfg.hallOfFameWeight : 1 })));
  const [min, max] = cfg.afterEncounters;
  return { mon: structuredClone(mon), afterEncounters: rng.int(min, Math.max(min, max)), done: false };
}

/**
 * The species it is at `level`: an evolved Pokémon met below the level it evolved at goes back
 * along its line (an item evolution counts as the trainer item level), so it can't come back too strong.
 */
export function formAtLevel(content: Content, speciesId: string, level: number): string {
  let id = speciesId;
  for (let guard = 0; guard < 3; guard++) {
    const from = getSpecies(content, id).evolvesFrom;
    const parent = from ? content.species.get(from) : undefined;
    const evo = parent?.evolutions.find((e) => e.to === id);
    if (!parent || !evo) break;
    const { trainerItemLevel, trainerBabyLevel } = content.balance.evolution;
    const needs = evo.level ?? (parent.tags.includes('baby') ? trainerBabyLevel : trainerItemLevel);
    if (level >= needs) break;
    id = parent.id;
  }
  return id;
}

/** The past Pokémon as a party member at `level`, keeping what it learned: its moves that still fit, ability, shininess and Tera type. */
export function reunionPokemon(content: Content, past: PastPokemon, level: number, uid: string): PokemonInstance {
  const cfg = content.balance.reunion;
  const speciesId = formAtLevel(content, past.speciesId, level);
  const mon = createPokemon(content, speciesId, level, uid);
  const moves = past.moves.filter((id) => content.moves.has(id));
  if (moves.length > 0) mon.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  mon.shiny = past.shiny;
  const species = getSpecies(content, speciesId);
  if (past.abilitySlot === -1 ? Boolean(species.abilities.hidden) : past.abilitySlot < species.abilities.normal.length) mon.abilitySlot = past.abilitySlot;
  if (past.teraType) mon.teraType = past.teraType;
  mon.friendship = past.hallOfFame ? cfg.hallOfFameFriendship : cfg.friendship;
  mon.hp = maxHp(content, mon);
  return mon;
}
