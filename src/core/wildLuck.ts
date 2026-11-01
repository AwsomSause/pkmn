// Ideas W1 wild luck (Kice, 2026-11-01): Shiny meter (M79), Encounter chains (M80) and Alpha encounters (M78).
// Counters live in `run.itemCounters` (no save change). Every roll uses a stream of its own (hashSeed of the run seed
// and node), so no existing roll shifts. Shiny odds only ever go up by a re-roll of their own; nothing here touches the
// encounter stream.

import type { Content } from './contentSchema';
import { Rng, hashSeed } from './rng';
import type { RunState } from './state';

const METER = 'shiny-meter';
const CHAIN = 'chain:';

export const shinyMeter = (run: Pick<RunState, 'itemCounters'>): number => run.itemCounters?.[METER] ?? 0;

export function chainOf(run: Pick<RunState, 'itemCounters'>, speciesId: string): number {
  return run.itemCounters?.[`${CHAIN}${speciesId}`] ?? 0;
}

/** The species currently chained and how long the chain is (null when there is none). */
export function activeChain(run: Pick<RunState, 'itemCounters'>): { speciesId: string; length: number } | null {
  for (const [k, v] of Object.entries(run.itemCounters ?? {})) if (k.startsWith(CHAIN) && v > 0) return { speciesId: k.slice(CHAIN.length), length: v };
  return null;
}

/** Multiplier on the base shiny chance from the meter and the chain of this species (1 = nothing). */
export function shinyBoost(content: Content, run: Pick<RunState, 'itemCounters'>, speciesId: string): number {
  const cfg = content.balance.w1.luck;
  const meter = Math.min(cfg.meterCap, shinyMeter(run));
  const chain = Math.min(cfg.chainCap, chainOf(run, speciesId));
  return 1 + meter * cfg.meterBonus + chain * cfg.chainBonus;
}

/** Meter text for the battle panel, e.g. "Shiny meter 12/50 (x1.6)". */
export function shinyMeterText(content: Content, run: Pick<RunState, 'itemCounters'>, speciesId: string): string {
  const cfg = content.balance.w1.luck;
  const chain = chainOf(run, speciesId);
  return `Shiny meter ${Math.min(cfg.meterCap, shinyMeter(run))}/${cfg.meterCap} (x${shinyBoost(content, run, speciesId).toFixed(2)})${chain > 1 ? ` · chain ${chain}` : ''}`;
}

export interface WildLuck { shiny: boolean; alpha: boolean }

/**
 * A wild Pokémon was set up. Rolls the extra shiny chance and the Alpha chance (own streams), then moves the meter
 * and the chain on. `alreadyShiny` is the ordinary roll's result; the meter resets on any shiny.
 */
export function wildLuck(content: Content, run: RunState, speciesId: string, nodeId: string, alreadyShiny: boolean, baseShinyChance: number): WildLuck {
  const cfg = content.balance.w1.luck;
  const boost = shinyBoost(content, run, speciesId);
  const key = `${run.seed}:wildluck:${run.encountersCompleted}:${nodeId}`;
  const extra = !alreadyShiny && boost > 1 && new Rng(hashSeed(`${key}:shiny`)).chance(Math.min(1, baseShinyChance * (boost - 1)));
  const shiny = alreadyShiny || extra;
  const alpha = new Rng(hashSeed(`${key}:alpha`)).chance(cfg.alphaChance);
  const counters = { ...(run.itemCounters ?? {}) };
  counters[METER] = shiny ? 0 : Math.min(cfg.meterCap, (counters[METER] ?? 0) + 1);
  const previous = counters[`${CHAIN}${speciesId}`] ?? 0;
  for (const k of Object.keys(counters)) if (k.startsWith(CHAIN)) delete counters[k];
  counters[`${CHAIN}${speciesId}`] = previous + 1;
  run.itemCounters = counters;
  return { shiny, alpha };
}
