import type { Content } from './contentSchema';
import { NATURE_IDS } from './natures';
import { rollShiny } from './encounters';
import { eggMoveOptions, familyId, teachEggMove } from './mastery';
import { maxHp } from './pokemon';
import { count, countShiny, discover } from './progress';
import { hashSeed, Rng } from './rng';
import { newMon } from './run';
import type { Egg, PokemonInstance, RunState } from './state';
import { z } from 'zod';
import eggsJson from '../data/eggs.json';
import { abilityOf } from './pokemon';
import { makeBlissful } from './shadowWorld/blissful';
import { CareSchema } from './care/mods';
import { hatchLevelOffset } from './trainerPerks';
import { runPerks } from './archetypes';

// Eggs: found at events or from a Mystery Egg, carried until enough battles (or stages) pass, then hatched.
// Everything about the Egg (species, shiny, egg moves) is rolled when it is laid, so reloading never changes it.

const EggTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  extraDistance: z.number().int().min(0),
  shinyMultiplier: z.number().min(1),
  eggMoveCap: z.number().int().min(1).max(4),
  hiddenAbilityChance: z.number().min(0).max(1),
  bonusLevels: z.number().int().min(0),
  friendship: z.number().int().min(0).max(255),
  blissfulChance: z.number().min(0).max(1),
  line: z.string(),
});
const EggsDataSchema = z.object({
  tiers: z.array(EggTierSchema).min(1),
  origins: z.record(z.string(), z.object({ kind: z.enum(['standard', 'regional', 'event', 'special', 'mystery', 'legacy']), weights: z.record(z.string(), z.number().positive()) })),
  warmAbilities: z.array(z.string()),
  warmPerStep: z.number().int().min(1),
  revealAt: z.number().min(0).max(1),
});
/** Egg tiers, where each kind of Egg comes from and how often (data/eggs.json). */
export const EGGS = EggsDataSchema.parse(eggsJson);
export const EGG_TIERS = EGGS.tiers;
export const eggTier = (id: string | undefined) => EGG_TIERS.find((t) => t.id === id) ?? EGG_TIERS[0]!;

export interface LayOptions {
  level: number;
  left: number;
  unit: Egg['unit'];
  source: string;
  shinyMultiplier?: number;
  /** Key into data/eggs.json `origins` (defaults to `source`); an unknown origin lays an Ordinary Egg. */
  origin?: string;
  /** Force a tier (rewards that promise a rare Egg). */
  tier?: string;
}

/** Hatched Pokémon start this friendly (Gen 2+: 120). */
export const HATCH_FRIENDSHIP = 120;

/** Makes an Egg of `speciesId`'s first stage and adds it to the run. Up to two usable egg moves come with it. */
export function layEgg(content: Content, run: RunState, speciesId: string, opts: LayOptions, rng: Rng): Egg {
  const family = familyId(content, speciesId);
  const n = (run.itemCounters?.['eggs-laid'] ?? 0) + 1;
  // Tier and traits come from their own hash of the seed, so they never move another system's rolls.
  const origin = EGGS.origins[opts.origin ?? opts.source];
  const trng = new Rng(hashSeed(`${run.seed}::egg-tier::${n}`));
  const tier = eggTier(opts.tier ?? (origin ? rollTier(origin.weights, trng) : 'ordinary'));
  const hidden = trng.chance(tier.hiddenAbilityChance);
  const blissful = trng.chance(tier.blissfulChance);
  const usable = eggMoveOptions(content, family).filter((o) => o.active).map((o) => o.id);
  const eggMoves: string[] = [];
  while (eggMoves.length < tier.eggMoveCap && usable.length > 0) eggMoves.push(usable.splice(rng.int(0, usable.length - 1), 1)[0]!);
  run.itemCounters = { ...run.itemCounters, 'eggs-laid': n };
  const left = Math.max(1, opts.left) + tier.extraDistance;
  const egg: Egg = {
    uid: `egg${n}`,
    speciesId: family,
    level: Math.max(1, Math.min(content.balance.difficulty.maxLevel, opts.level)),
    left,
    total: left,
    unit: opts.unit,
    shiny: rollShiny(content, rng, (opts.shinyMultiplier ?? 1) * tier.shinyMultiplier),
    tier: tier.id,
    kind: origin?.kind ?? 'standard',
    heat: 0,
    hidden,
    blissful,
    eggMoves,
    source: opts.source,
  };
  run.eggs = [...run.eggs, egg];
  return egg;
}

function rollTier(weights: Record<string, number>, rng: Rng): string {
  const entries = Object.entries(weights);
  let roll = rng.float() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) {
    roll -= w;
    if (roll < 0) return id;
  }
  return entries[entries.length - 1]![0];
}

/** Names the daycare offers for an egg (event name-the-egg sets the flag to 1-3). */
export const EGG_NAMES: Record<number, string> = { 1: 'Sunny', 2: 'Midnight', 3: 'Pebble' };

/** Turns an Egg into its Pokémon (does not touch the run's egg list). */
export function hatchEgg(content: Content, run: RunState, egg: Egg): PokemonInstance {
  const tier = eggTier(egg.tier);
  const level = Math.max(1, Math.min(content.balance.difficulty.maxLevel, egg.level + tier.bonusLevels + hatchLevelOffset(runPerks(content, run))));
  const mon = newMon(content, run, egg.speciesId, level, 'p');
  mon.shiny = egg.shiny;
  mon.hatched = true;
  mon.eggTier = tier.id;
  mon.friendship = Math.max(mon.friendship, HATCH_FRIENDSHIP, tier.friendship);
  if (egg.hidden && content.species.get(egg.speciesId)?.abilities.hidden) mon.abilitySlot = -1;
  if (egg.blissful && !run.party.some((m) => m.blissful)) makeBlissful(content, mon);
  for (const id of egg.eggMoves) teachEggMove(content, mon, id, egg.eggMoves);
  // Legacy Descendant (core/memories/heirloom.ts): the one trait its ancestor passed on.
  if (egg.lineage) {
    mon.lineage = egg.lineage;
    if (egg.lineage.nature && (NATURE_IDS as readonly string[]).includes(egg.lineage.nature)) mon.nature = egg.lineage.nature as (typeof NATURE_IDS)[number];
    if (egg.lineage.moveId) teachEggMove(content, mon, egg.lineage.moveId, [...egg.eggMoves, egg.lineage.moveId]);
  }
  // W10 (I512): an egg you named at the daycare hatches already knowing its name.
  const named = EGG_NAMES[Number(run.story.flags['ev:egg-name'] ?? 0)];
  if (named) {
    mon.care = { ...(mon.care ?? CareSchema.parse({})), nickname: named };
    run.story.flags['ev:egg-name'] = 0;
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
  const warmth = eggWarmth(content, run);
  const kept: Egg[] = [];
  for (const egg of run.eggs) {
    let left = egg.unit === unit ? egg.left - 1 : egg.left;
    let heat = egg.heat;
    if (egg.unit === unit) {
      heat += warmth;
      while (heat >= EGGS.warmPerStep) {
        heat -= EGGS.warmPerStep;
        left -= 1;
      }
    }
    if (left > 0) {
      kept.push({ ...egg, left, heat });
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

/** Party Pokémon that keep Eggs warm (Flame Body and friends): each adds one warmth per step, two warmth make an extra step. Capped at 3. */
export function eggWarmth(content: Content, run: Pick<RunState, 'party'>): number {
  return Math.min(3, run.party.filter((m) => m.hp > 0 && EGGS.warmAbilities.includes(abilityOf(content, m) ?? '')).length);
}

/** A night at camp (or any warm spot): every Egg gets `steps` closer to hatching, but never hatches by it (it keeps at least 1 left). Returns how many Eggs moved. */
export function warmEggs(run: RunState, steps = 1): number {
  let moved = 0;
  run.eggs = run.eggs.map((egg) => {
    const left = Math.max(1, egg.left - steps);
    if (left !== egg.left) moved += 1;
    return { ...egg, left };
  });
  return moved;
}

/** 0 to 1: how far along the Egg is. */
export function eggProgress(egg: Egg): number {
  const total = Math.max(1, egg.total ?? egg.left);
  return Math.max(0, Math.min(1, 1 - egg.left / total));
}

/** Mystery and Hidden eggs keep their tier secret until they are about half hatched. */
export const eggRevealed = (egg: Egg): boolean => egg.kind !== 'mystery' || eggProgress(egg) >= EGGS.revealAt;

/** "Rare Egg (Event) [###-----] Hatches in 3 stages" with a small progress bar, for menus. */
export function eggLabel(egg: Egg): string {
  const filled = Math.round(eggProgress(egg) * 8);
  const bar = `[${'#'.repeat(filled)}${'-'.repeat(8 - filled)}]`;
  const name = eggRevealed(egg) ? `${eggTier(egg.tier).name} Egg` : 'Mystery Egg';
  return `${name} (${egg.source}) ${bar} ${eggStatus(egg)}`;
}

/** "Hatches after 3 more battles" for menus. */
export function eggStatus(egg: Egg): string {
  const what = egg.unit === 'battle' ? 'battle' : 'stage';
  return egg.left <= 1 ? `Hatches after the next ${what}` : `Hatches in ${egg.left} ${what}s`;
}
