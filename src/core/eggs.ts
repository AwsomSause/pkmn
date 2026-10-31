import type { Content } from './contentSchema';
import { NATURE_IDS } from './natures';
import { rollShiny } from './encounters';
import { eggMoveOptions, familyId, teachEggMove } from './mastery';
import { maxHp } from './pokemon';
import { count, countShiny, discover } from './progress';
import type { Rng } from './rng';
import { newMon } from './run';
import type { Egg, PokemonInstance, RunState } from './state';
import { hatchLevelOffset } from './trainerPerks';
import { runPerks } from './archetypes';

// Eggs: found at events or from a Mystery Egg, carried until enough battles (or stages) pass, then hatched.
// Everything about the Egg (species, shiny, egg moves) is rolled when it is laid, so reloading never changes it.

export interface LayOptions {
  level: number;
  left: number;
  unit: Egg['unit'];
  source: string;
  shinyMultiplier?: number;
}

/** Hatched Pokémon start this friendly (Gen 2+: 120). */
export const HATCH_FRIENDSHIP = 120;

/** Makes an Egg of `speciesId`'s first stage and adds it to the run. Up to two usable egg moves come with it. */
export function layEgg(content: Content, run: RunState, speciesId: string, opts: LayOptions, rng: Rng): Egg {
  const family = familyId(content, speciesId);
  const usable = eggMoveOptions(content, family).filter((o) => o.active).map((o) => o.id);
  const eggMoves: string[] = [];
  while (eggMoves.length < 2 && usable.length > 0) eggMoves.push(usable.splice(rng.int(0, usable.length - 1), 1)[0]!);
  const n = (run.itemCounters?.['eggs-laid'] ?? 0) + 1;
  run.itemCounters = { ...run.itemCounters, 'eggs-laid': n };
  const egg: Egg = {
    uid: `egg${n}`,
    speciesId: family,
    level: Math.max(1, Math.min(content.balance.difficulty.maxLevel, opts.level)),
    left: Math.max(1, opts.left),
    unit: opts.unit,
    shiny: rollShiny(content, rng, opts.shinyMultiplier ?? 1),
    eggMoves,
    source: opts.source,
  };
  run.eggs = [...run.eggs, egg];
  return egg;
}

/** Turns an Egg into its Pokémon (does not touch the run's egg list). */
export function hatchEgg(content: Content, run: RunState, egg: Egg): PokemonInstance {
  const level = Math.max(1, Math.min(content.balance.difficulty.maxLevel, egg.level + hatchLevelOffset(runPerks(content, run))));
  const mon = newMon(content, run, egg.speciesId, level, 'p');
  mon.shiny = egg.shiny;
  mon.hatched = true;
  mon.friendship = Math.max(mon.friendship, HATCH_FRIENDSHIP);
  for (const id of egg.eggMoves) teachEggMove(content, mon, id, egg.eggMoves);
  // Legacy Descendant (core/memories/heirloom.ts): the one trait its ancestor passed on.
  if (egg.lineage) {
    mon.lineage = egg.lineage;
    if (egg.lineage.nature && (NATURE_IDS as readonly string[]).includes(egg.lineage.nature)) mon.nature = egg.lineage.nature as (typeof NATURE_IDS)[number];
    if (egg.lineage.moveId) teachEggMove(content, mon, egg.lineage.moveId, [...egg.eggMoves, egg.lineage.moveId]);
  }
  mon.hp = maxHp(content, mon);
  return mon;
}

/**
 * One battle (or stage) passes for every Egg counting in `unit`. Eggs that reach 0 hatch: their
 * Pokémon are queued as "caught" decisions (the hatch plays on that screen) and returned.
 */
export function tickEggs(content: Content, run: RunState, unit: Egg['unit']): PokemonInstance[] {
  if (run.eggs.length === 0) return [];
  const hatched: PokemonInstance[] = [];
  const kept: Egg[] = [];
  for (const egg of run.eggs) {
    const left = egg.unit === unit ? egg.left - 1 : egg.left;
    if (left > 0) {
      kept.push({ ...egg, left });
      continue;
    }
    const mon = hatchEgg(content, run, egg);
    if (mon.shiny) countShiny(run, mon.speciesId);
    discover(run, mon.speciesId, true);
    count(run, 'eggsHatched');
    run.pending.push({ kind: 'caught', mon });
    hatched.push(mon);
  }
  run.eggs = kept;
  return hatched;
}

/** "Hatches after 3 more battles" for menus. */
export function eggStatus(egg: Egg): string {
  const what = egg.unit === 'battle' ? 'battle' : 'stage';
  return egg.left <= 1 ? `Hatches after the next ${what}` : `Hatches in ${egg.left} ${what}s`;
}
