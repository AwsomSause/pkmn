// Canon heights for sizing trainers against Pokémon in the Hub (W13). Presentation only: no rule, roll or save ever
// reads a height. Pokémon heights come from the Essentials PBS data (src/data/speciesHeights.json, generations 1-8);
// anything else is estimated from its weight. Trainer heights are estimates (src/data/trainerHeights.json).

import { z } from 'zod';
import speciesHeightsJson from '../data/speciesHeights.json';
import trainerHeightsJson from '../data/trainerHeights.json';
import type { Species } from './contentSchema';

const SpeciesHeightsSchema = z.object({ note: z.string(), heights: z.record(z.string(), z.number().min(0.05).max(100)) });
const TrainerHeightsSchema = z.object({
  note: z.string(),
  default: z.number().min(0.5).max(3),
  byId: z.record(z.string(), z.number().min(0.5).max(3)),
  patterns: z.array(z.object({ match: z.string(), m: z.number().min(0.5).max(3).optional(), strip: z.boolean().optional() })),
});

export const SPECIES_HEIGHTS = SpeciesHeightsSchema.parse(speciesHeightsJson).heights;
export const TRAINER_HEIGHTS = TrainerHeightsSchema.parse(trainerHeightsJson);

/** Canon height of a species in metres: its own entry, its base form's, then a weight-based estimate. */
export function pokemonHeightM(species: Pick<Species, 'id' | 'weight' | 'form'>): number {
  const own = SPECIES_HEIGHTS[species.id];
  if (own !== undefined) return own;
  const base = (species.form as { base?: string } | undefined)?.base;
  if (base && SPECIES_HEIGHTS[base] !== undefined) return SPECIES_HEIGHTS[base]!;
  // Heights grow roughly with the cube root of weight (a 6.9 kg Bulbasaur is 0.7 m, a 460 kg Snorlax 2.1 m).
  const w = Math.max(0.1, species.weight ?? 20);
  return Math.round(Math.min(20, Math.max(0.1, 0.37 * Math.cbrt(w) * (w < 1 ? 1.4 : 1))) * 10) / 10;
}

/** Height of a trainer (archetype id) in metres. */
export function trainerHeightM(archetypeId: string): number {
  const { byId, patterns } = TRAINER_HEIGHTS;
  let id = archetypeId;
  for (let guard = 0; guard < 6; guard++) {
    if (byId[id] !== undefined) return byId[id]!;
    const hit = patterns.find((p) => new RegExp(p.match).test(id));
    if (!hit) break;
    if (hit.m !== undefined) return hit.m;
    // Strip a version tag ("blue-classic" is "blue") and look again.
    const stripped = id.replace(new RegExp(hit.match), (_all, pre) => (pre ? '-' : '')).replace(/^-|-$/g, '').replace(/^evolved-/, '');
    if (stripped === id || stripped === '') break;
    id = stripped;
  }
  return byId[id] ?? TRAINER_HEIGHTS.default;
}

export interface SizedPair { trainerPx: number; monPx: number }

/**
 * Pixel heights for a trainer and a Pokémon standing side by side: the same pixels-per-metre for both, so a
 * Wailord towers over its trainer and a Joltik comes up to their ankle. The pair shrinks together to fit
 * `maxPx`, and a tiny Pokémon never gets smaller than `minMonPx` so it stays readable.
 */
export function sizePair(trainerM: number, monM: number, opts: { pxPerMetre?: number; maxPx?: number; minMonPx?: number } = {}): SizedPair {
  const { pxPerMetre = 100, maxPx = 250, minMonPx = 44 } = opts;
  let scale = pxPerMetre;
  const tall = Math.max(trainerM, monM);
  if (tall * scale > maxPx) scale = maxPx / tall;
  return { trainerPx: Math.round(trainerM * scale), monPx: Math.round(Math.max(minMonPx, monM * scale)) };
}
