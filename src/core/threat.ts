// Combat Threat Rating (Balancing Overhaul Phase 6, left-out plan 1.2): one number for how
// dangerous a generated battle configuration is, 100 = an average Pokémon (all base stats 70)
// with a 60-power same-type attack at the same level. It looks at the stats at its level,
// its best attack (power, accuracy, same-type bonus), speed, priority, setup, recovery and
// status moves, and a short list of strong abilities. Stage budgets (easy / standard /
// challenging / elite) cap it per encounter in core/encounterDirector.ts. Weights live in
// balance.json `threat`. Pure and deterministic: no RNG.

import type { Content } from './contentSchema';
import { abilityOf, calcStats, createPokemon, getSpecies } from './pokemon';
import type { PokemonInstance } from './state';

export type ThreatTier = 'easy' | 'standard' | 'challenging' | 'elite';
export const THREAT_TIERS: readonly ThreatTier[] = ['easy', 'standard', 'challenging', 'elite'];

export interface ThreatBreakdown {
  rating: number;
  offense: number;
  bulk: number;
  speed: number;
  bonus: number;
  /** The attack behind the offense score (null with no damaging move). */
  bestMove: string | null;
}

const refStat = (level: number) => Math.floor((2 * 70 * level) / 100) + 5;
const refHp = (level: number) => Math.floor((2 * 70 * level) / 100) + level + 10;

/** The rating of a built Pokémon (its moves, level and ability as they are). */
export function threatOf(content: Content, mon: PokemonInstance): ThreatBreakdown {
  const cfg = content.balance.threat;
  const species = getSpecies(content, mon.speciesId);
  const stats = calcStats(content, mon);
  const ref = refStat(mon.level);
  let best = 0;
  let bestMove: string | null = null;
  let bonus = 0;
  const seen = new Set<string>();
  for (const slot of mon.moves) {
    const move = content.moves.get(slot.id);
    if (!move) continue;
    if (move.category === 'status') {
      const fx = move.effects;
      if (!seen.has('setup') && fx.statChanges?.some((c) => c.target === 'self' && c.stages > 0)) (seen.add('setup'), (bonus += cfg.setupBonus));
      else if (!seen.has('recovery') && fx.heal) (seen.add('recovery'), (bonus += cfg.recoveryBonus));
      else if (!seen.has('status') && fx.status) (seen.add('status'), (bonus += cfg.statusBonus));
      continue;
    }
    const attack = move.category === 'physical' ? stats.atk : stats.spa;
    const value = (move.power ?? 0) * ((move.accuracy ?? 100) / 100) * (species.types.includes(move.type) ? 1.5 : 1) * attack;
    if (value > best) (best = value), (bestMove = move.id);
    if (!seen.has('priority') && move.priority > 0 && (move.power ?? 0) > 0) (seen.add('priority'), (bonus += cfg.priorityBonus));
  }
  const offense = Math.max(cfg.noAttackOffense, best / (60 * 1.5 * ref));
  const bulk = (stats.hp * (stats.def + stats.spd)) / 2 / (refHp(mon.level) * ref);
  const speed = Math.min(2, stats.spe / ref);
  const ability = abilityOf(content, mon);
  if (ability && cfg.strongAbilities.includes(ability)) bonus += cfg.abilityBonus;
  const rating = Math.round(100 * Math.sqrt(offense * bulk) * (1 - cfg.speedWeight + cfg.speedWeight * speed) * (1 + bonus));
  return { rating, offense, bulk, speed, bonus, bestMove };
}

/** The rating of a species at a level with its default moves and ability (no RNG: a fixed uid). */
export function speciesThreat(content: Content, speciesId: string, level: number): number {
  return threatOf(content, createPokemon(content, speciesId, level, `threat:${speciesId}`)).rating;
}

/** The highest rating an encounter of `tier` may have at `level` (balance.threat.budgets: base + perLevel × level, capped; the cap rises past level 100). */
export function threatBudget(content: Content, tier: ThreatTier, level: number): number {
  const b = content.balance.threat.budgets[tier];
  return Math.min(b.max, b.base + b.perLevel * level) + b.perLevelAbove100 * Math.max(0, level - 100);
}
