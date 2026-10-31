// Encounter Director (Balancing Overhaul Phases 4–7, left-out plan 1.2): the one path every
// generated Pokémon goes through. Pipeline: the caller's progression state gives a level and an
// availability-gated pool (core/availability.ts) → weighted draw → evolve to the level → validate
// (known species, a supported move, the level's base-stat ceiling, the source's threat budget,
// core/threat.ts) → bounded retry (balance.threat.retries) → if every draw fails, the weakest
// valid candidate (a logged fallback). Authored Pokémon (boss teams, an event's own species list,
// raid bosses) are not re-rolled: `auditEncounter` checks and logs them as named exceptions.
// Levels are clamped to the cap the caller passes, so no source can lift the level cap.
// Records go to watchers (reports and tests) only; nothing here touches saves or the RNG beyond `draw`.

import type { Content } from './contentSchema';
import { createPokemon, getSpecies, isUsableMove } from './pokemon';
import type { PokemonInstance } from './state';
import { threatBudget, threatOf, type ThreatTier } from './threat';

export type EncounterSource = 'wild' | 'fishing' | 'trainer' | 'gym' | 'elite' | 'champion' | 'event' | 'quest' | 'reward' | 'raid';

export type RejectReason = 'unknown-species' | 'no-moves' | 'over-bst' | 'over-threat';

export interface DirectorRecord {
  source: EncounterSource;
  speciesId: string;
  level: number;
  /** The level asked for before the cap (equal to `level` unless it was clamped). */
  askedLevel: number;
  threat: number;
  budget: number;
  tier: ThreatTier;
  /** Rejections per reason across the draws. */
  rejections: Partial<Record<RejectReason, number>>;
  draws: number;
  /** True when no draw passed and the weakest valid candidate was used. */
  fallback: boolean;
  /** True when not even the fallback passed the hard checks (never expected; the report counts it). */
  invalid: boolean;
  /** Set for authored Pokémon checked but not re-rolled (boss team, event species list, raid boss). */
  exception: string | null;
}

type Watcher = (record: DirectorRecord) => void;
const watchers = new Set<Watcher>();

/** Calls `fn` with every record until the returned function is called (reports and tests). */
export function watchDirector(fn: Watcher): () => void {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

const emit = (record: DirectorRecord) => {
  for (const fn of watchers) fn(record);
};

export const tierFor = (content: Content, source: EncounterSource): ThreatTier => (content.balance.threat.sourceTiers[source] as ThreatTier | undefined) ?? 'standard';

/** The most total base stats a regular enemy may have at `level`: a level-9 route never throws a 550-BST brute at a level-5 party. */
export function bstCeilingAt(content: Content, level: number): number {
  const { base, perLevel } = content.balance.levelBst;
  return Math.min(content.balance.wildMaxBaseStats, base + perLevel * level);
}

const bstOf = (content: Content, id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);

/** A species built at `level` with its default moves, for checking (fixed uid: no RNG). */
const probe = (content: Content, speciesId: string, level: number): PokemonInstance => createPokemon(content, speciesId, level, `director:${speciesId}`);

function check(content: Content, speciesId: string, level: number, budget: number, ordinary: boolean): { reasons: RejectReason[]; threat: number } {
  if (!content.species.has(speciesId)) return { reasons: ['unknown-species'], threat: Infinity };
  const mon = probe(content, speciesId, level);
  const reasons: RejectReason[] = [];
  if (!mon.moves.some((m) => isUsableMove(content, m.id) && m.id !== content.ruleset.struggleMoveId)) reasons.push('no-moves');
  if (ordinary && bstOf(content, speciesId) > bstCeilingAt(content, level)) reasons.push('over-bst');
  const threat = threatOf(content, mon).rating;
  if (threat > budget) reasons.push('over-threat');
  return { reasons, threat };
}

const HARD: readonly RejectReason[] = ['unknown-species', 'no-moves'];

export interface EncounterRequest {
  source: EncounterSource;
  level: number;
  /** The highest level allowed (the region's level cap); the level is clamped to it. */
  cap: number;
  /** One weighted draw from the (already availability-gated) pool. */
  draw: () => string;
  /** The species the draw becomes at the level (trainers' Pokémon arrive evolved). */
  evolve?: (speciesId: string, level: number) => string;
  /** Overrides the source's tier (e.g. a harder route). */
  tier?: ThreatTier;
}

/** Runs the pipeline: draw, validate, bounded retry, logged fallback. Same draws in, same species out. */
export function directSpecies(content: Content, req: EncounterRequest): { speciesId: string; level: number; record: DirectorRecord } {
  const level = Math.max(1, Math.min(req.cap, req.level));
  const tier = req.tier ?? tierFor(content, req.source);
  const budget = threatBudget(content, tier, level);
  const rejections: Partial<Record<RejectReason, number>> = {};
  const tried: { id: string; threat: number; hard: boolean; bst: number }[] = [];
  let chosen: { id: string; threat: number } | null = null;
  for (let i = 0; i <= content.balance.threat.retries; i++) {
    const drawn = req.draw();
    const id = req.evolve ? req.evolve(drawn, level) : drawn;
    const { reasons, threat } = check(content, id, level, budget, true);
    if (reasons.length === 0) {
      chosen = { id, threat };
      break;
    }
    for (const r of reasons) rejections[r] = (rejections[r] ?? 0) + 1;
    tried.push({ id, threat, hard: reasons.some((r) => HARD.includes(r)), bst: content.species.has(id) ? bstOf(content, id) : Infinity });
  }
  const fallback = chosen === null;
  let invalid = false;
  if (!chosen) {
    const valid = tried.filter((t) => !t.hard);
    const from = valid.length > 0 ? valid : tried;
    invalid = valid.length === 0;
    const best = from.reduce((a, b) => (b.bst < a.bst || (b.bst === a.bst && b.threat < a.threat) ? b : a));
    chosen = { id: best.id, threat: best.threat };
  }
  const record: DirectorRecord = { source: req.source, speciesId: chosen.id, level, askedLevel: req.level, threat: chosen.threat, budget, tier, rejections, draws: tried.length + (fallback ? 0 : 1), fallback, invalid, exception: null };
  emit(record);
  return { speciesId: chosen.id, level, record };
}

/** Checks and logs an authored Pokémon (not re-rolled): `exception` names why it may break the ordinary rules. */
export function auditEncounter(content: Content, source: EncounterSource, mon: PokemonInstance, exception: string, askedLevel = mon.level): DirectorRecord {
  const tier = tierFor(content, source);
  const budget = threatBudget(content, tier, mon.level);
  const threat = threatOf(content, mon).rating;
  const rejections: Partial<Record<RejectReason, number>> = {};
  if (!mon.moves.some((m) => isUsableMove(content, m.id) && m.id !== content.ruleset.struggleMoveId)) rejections['no-moves'] = 1;
  if (threat > budget) rejections['over-threat'] = 1;
  const record: DirectorRecord = { source, speciesId: mon.speciesId, level: mon.level, askedLevel, threat, budget, tier, rejections, draws: 0, fallback: false, invalid: false, exception };
  emit(record);
  return record;
}

/** Like auditEncounter for a species at a level (its default moves). */
export function auditSpecies(content: Content, source: EncounterSource, speciesId: string, level: number, exception: string): DirectorRecord {
  return auditEncounter(content, source, probe(content, speciesId, level), exception);
}
