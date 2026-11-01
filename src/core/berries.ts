import { z } from 'zod';
import berriesJson from '../data/berries.json';
import type { Content } from './contentSchema';
import { giveItem } from './events';
import { count } from './progress';
import { hashSeed, Rng } from './rng';
import type { GardenPlot, PokemonInstance, RunState } from './state';

// Berry cultivation (Kice's spec §27): plant a berry a Pokémon holds, it grows over stages, harvest it at any Berry Garden.
// Plot, mutation and harvest are fixed by the run seed, so reloading or re-opening a garden never changes them.

const BerriesSchema = z.object({
  maxPlots: z.number().int().min(1),
  growStages: z.record(z.string(), z.number().int().min(1)),
  wateredFaster: z.number().int().min(0),
  waterTypes: z.array(z.string()),
  harvestBase: z.number().int().min(1),
  soil: z.record(z.string(), z.object({ types: z.array(z.string()), bonusYield: z.number().int().min(0), mutationMultiplier: z.number().min(0) })),
  mutationChance: z.number().min(0).max(1),
  mutatedBonus: z.number().int().min(0),
  crossChance: z.number().min(0).max(1),
  crossPool: z.array(z.string()),
});
/** Garden numbers (data/berries.json). */
export const BERRIES = BerriesSchema.parse(berriesJson);

const isBerry = (content: Content, id: string): boolean => !!content.catalog.get(id)?.family.startsWith('Berries') && content.catalog.get(id)?.effect?.kind === 'held';

/** Berries a Pokémon holds that could be planted: [berry id, copies]. */
export function plantableBerries(content: Content, mon: PokemonInstance): string[] {
  return Object.keys(mon.held ?? {}).filter((id) => isBerry(content, id) && (mon.held![id] ?? 0) > 0).sort();
}

/** The garden's soil from the stage's theme: Grass/Ground/Water/Bug stages are rich, Fire/Rock/Ice/Steel poor, the rest fair. */
export function soilHere(content: Content, run: Pick<RunState, 'stage'>): GardenPlot['soil'] {
  const theme = run.stage ? content.themes.get(run.stage.themeId) : undefined;
  if (!theme) return 'fair';
  for (const kind of ['rich', 'poor'] as const) if (theme.types.some((t) => BERRIES.soil[kind]?.types.includes(t))) return kind;
  return 'fair';
}

/** Stages a berry needs, shortened by one when a Water- or Grass-type waters it. Never below 1. */
export function growTime(content: Content, run: Pick<RunState, 'party'>, berryId: string): number {
  const base = BERRIES.growStages[content.catalog.get(berryId)?.rarity ?? 'common'] ?? 1;
  const watered = run.party.some((m) => m.hp > 0 && content.species.get(m.speciesId)?.types.some((t) => BERRIES.waterTypes.includes(t)));
  return Math.max(1, base - (watered ? BERRIES.wateredFaster : 0));
}

/** Why `mon` cannot plant `berryId` now, or null. */
export function plantProblem(run: Pick<RunState, 'garden'>): string | null {
  return run.garden.length >= BERRIES.maxPlots ? `The garden is full (${BERRIES.maxPlots} plots).` : null;
}

/** Takes one held berry from `mon` and plants it. The plot is mutated by a seeded roll. */
export function plantBerry(content: Content, run: RunState, mon: PokemonInstance, berryId: string): GardenPlot {
  const n = (run.itemCounters?.['plots-planted'] ?? 0) + 1;
  run.itemCounters = { ...run.itemCounters, 'plots-planted': n };
  mon.held![berryId]! -= 1;
  if (mon.held![berryId] === 0) delete mon.held![berryId];
  const rng = new Rng(hashSeed(`${run.seed}::plant::${n}`));
  const soil = soilHere(content, run);
  const plot: GardenPlot = { uid: `plot${n}`, berryId, left: growTime(content, run, berryId), mutated: rng.chance(BERRIES.mutationChance * (BERRIES.soil[soil]?.mutationMultiplier ?? 1)), soil };
  run.garden = [...run.garden, plot];
  return plot;
}

/** A new stage: every plot grows one closer to ripe. */
export function growGarden(run: RunState): void {
  run.garden = run.garden.map((p) => (p.left > 0 ? { ...p, left: p.left - 1 } : p));
}

/** "Oran Berry (ripe)", "Lum Berry (2 stages left, mutated)" for menus. */
export function plotLabel(content: Content, plot: GardenPlot): string {
  const name = content.catalog.get(plot.berryId)?.name ?? plot.berryId;
  const state = plot.left <= 0 ? 'ripe' : `${plot.left} stage${plot.left === 1 ? '' : 's'} left`;
  return `${name} (${state}${plot.mutated ? ', mutated' : ''}${plot.soil === 'fair' ? '' : `, ${plot.soil} soil`})`;
}

/**
 * Picks a ripe plot. A mutated plot gives its Hyper version when one exists, else extra berries. If another ripe plot
 * of a different berry grows beside it, cross-pollination may add a rare berry. Returns what was received.
 */
export function harvestPlot(content: Content, run: RunState, plotUid: string): string[] {
  const plot = run.garden.find((p) => p.uid === plotUid);
  if (!plot || plot.left > 0) throw new Error('That plot is not ripe yet.');
  const rng = new Rng(hashSeed(`${run.seed}::harvest::${plot.uid}`));
  const hyper = `hyper-${plot.berryId}`;
  const mutantId = plot.mutated && content.catalog.has(hyper) ? hyper : null;
  const got: string[] = [];
  const base = BERRIES.harvestBase + (BERRIES.soil[plot.soil]?.bonusYield ?? 0) + (plot.mutated && !mutantId ? BERRIES.mutatedBonus : 0);
  got.push(giveItem(content, run, plot.berryId, base, rng));
  if (mutantId) got.push(giveItem(content, run, mutantId, 1, rng));
  const neighbours = run.garden.filter((p) => p.uid !== plot.uid && p.left <= 0 && p.berryId !== plot.berryId);
  const pool = BERRIES.crossPool.filter((id) => content.catalog.has(id));
  if (neighbours.length > 0 && pool.length > 0 && rng.chance(BERRIES.crossChance)) got.push(giveItem(content, run, rng.pick(pool), 1, rng));
  run.garden = run.garden.filter((p) => p.uid !== plot.uid);
  count(run, 'berriesHarvested');
  return got;
}
