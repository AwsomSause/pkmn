// The Trainer–Pokémon Bond Engine (Examples §4, §6, §9): each rival Pokémon has separate bond
// dimensions, a trait and habits; between your battles an off-screen event changes them, with a cause
// on record. Seeded per stage and rival; never uses the gameplay streams.

import { z } from 'zod';
import bondsJson from '../../data/rivalBonds.json';
import { hashSeed, Rng } from '../rng';
import type { Content } from '../contentSchema';
import { getSpecies } from '../pokemon';
import type { RunState } from '../state';
import type { Bond, OffscreenEvent, Rival } from '../story/schema';

const Delta = z.record(z.string(), z.number());
export const RivalBondsSchema = z.object({
  note: z.string(),
  start: z.object({ low: z.number(), high: z.number(), strain: z.number(), history: z.number(), hyperReadiness: z.number() }),
  perStage: z.object({ events: z.number().int().min(0), recentKept: z.number().int().min(1), historyKept: z.number().int().min(1), causeBoost: z.number(), traitBoost: z.number(), restStrainMax: z.number() }),
  effects: z.object({ levelBonusSync: z.number(), levelBonusConfidence: z.number(), worryStrain: z.number(), worryTrust: z.number(), loyaltyTrust: z.number(), loyaltyAffection: z.number() }),
  dimensions: z.array(z.string()),
  traits: z.record(z.string(), z.object({ loves: z.array(z.string()) })),
  behaviors: z.array(z.object({ id: z.string(), name: z.string(), on: z.enum(['win', 'lose', 'any']), needs: z.record(z.string(), z.number()), delta: Delta })),
  habits: z.object({ note: z.string(), slots: z.array(z.string()), pools: z.record(z.string(), z.array(z.string())), typeComfort: z.record(z.string(), z.array(z.string())) }),
  events: z.array(z.object({
    id: z.string(), name: z.string(), group: z.string(), tags: z.array(z.string()), fit: z.record(z.string(), z.number()), delta: Delta,
    when: z.object({ trustMin: z.number().optional(), trustMax: z.number().optional(), strainMin: z.number().optional(), strainMax: z.number().optional(), confidenceMax: z.number().optional(), autonomyMin: z.number().optional(), hyperMin: z.number().optional(), teammates: z.boolean().optional() }),
    habit: z.string().optional(), visibility: z.enum(['private', 'rumor', 'observed']), after: z.string().optional(), text: z.string(),
  })),
});
export const RIVAL_BONDS = RivalBondsSchema.parse(bondsJson);

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const DIMS = RIVAL_BONDS.dimensions;
type Dim = keyof Bond;

function apply(bond: Bond, delta: Record<string, number>): void {
  for (const [k, v] of Object.entries(delta)) {
    if (k === 'sharedHistory') bond.sharedHistory += v;
    else (bond as unknown as Record<string, number>)[k] = clamp((bond as unknown as Record<string, number>)[k]! + v);
  }
}

const speciesName = (content: Content, id: string) => getSpecies(content, id).name;
const rivalTitle = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;

/** A rival's Pokémon get bonds the first time the world moves: low-ish start spread, one trait each. */
export function ensureBonds(run: RunState, rival: Rival): void {
  const s = RIVAL_BONDS.start;
  const traitIds = Object.keys(RIVAL_BONDS.traits);
  for (const id of new Set(rival.memory.lastBattle.team)) {
    if (rival.bonds[id]) continue;
    const rng = new Rng(hashSeed(`${run.seed}::rival-bond::${rival.id}::${id}`));
    const v = () => rng.int(s.low, s.high);
    rival.bonds[id] = { trust: v(), affection: v(), respect: v(), synchronization: v(), confidence: v(), autonomy: v(), strain: s.strain, sharedHistory: s.history, hyperReadiness: s.hyperReadiness, trait: rng.pick(traitIds), habits: {}, recent: [] };
  }
}

type EventDef = (typeof RIVAL_BONDS.events)[number];

/** Eligibility (§Event simulation rules, step 1): can this event happen to this Pokémon now? */
function eligible(ev: EventDef, bond: Bond, teamSize: number): boolean {
  const w = ev.when;
  if (w.trustMin !== undefined && bond.trust < w.trustMin) return false;
  if (w.trustMax !== undefined && bond.trust > w.trustMax) return false;
  if (w.strainMin !== undefined && bond.strain < w.strainMin) return false;
  if (w.strainMax !== undefined && bond.strain > w.strainMax) return false;
  if (w.confidenceMax !== undefined && bond.confidence > w.confidenceMax) return false;
  if (w.autonomyMin !== undefined && bond.autonomy < w.autonomyMin) return false;
  if (w.hyperMin !== undefined && bond.hyperReadiness < w.hyperMin) return false;
  if (w.teammates && teamSize < 2) return false;
  if (ev.after && !bond.recent.includes(ev.after)) return false;
  return true;
}

function habitFor(content: Content, run: RunState, rival: Rival, speciesId: string, slot: string): string | null {
  const pool = RIVAL_BONDS.habits.pools[slot];
  if (!pool?.length) return null;
  const types = getSpecies(content, speciesId).types;
  const typed = slot === 'comfort' ? types.flatMap((t) => RIVAL_BONDS.habits.typeComfort[t] ?? []) : [];
  const rng = new Rng(hashSeed(`${run.seed}::rival-habit::${rival.id}::${speciesId}::${slot}`));
  return rng.pick(typed.length > 0 ? typed : pool);
}

/** One off-screen event for this rival: pick a rested Pokémon, then an eligible, motivated event; apply and record it. */
export function simulateOffscreen(content: Content, run: RunState, rival: Rival, stageKey: string): OffscreenEvent | null {
  ensureBonds(run, rival);
  const cfg = RIVAL_BONDS.perStage;
  const team = [...new Set(rival.memory.lastBattle.team)];
  const rng = new Rng(hashSeed(`${run.seed}::rival-offscreen::${stageKey}::${rival.id}`));
  // Context: only Pokémon that are not worn out can take part.
  const able = team.filter((id) => rival.bonds[id]!.strain <= cfg.restStrainMax);
  if (able.length === 0) return null;
  const speciesId = rng.pick(able);
  const bond = rival.bonds[speciesId]!;
  const loves = RIVAL_BONDS.traits[bond.trait]?.loves ?? [];
  const entries = RIVAL_BONDS.events
    .filter((ev) => eligible(ev, bond, team.length))
    .map((ev) => {
      // Motivation: the rival's character, the Pokémon's trait, and an open causal chain.
      const character = 1 + Object.entries(ev.fit).reduce((sum, [k, w]) => sum + ((rival.traits as Record<string, number>)[k] ?? 0) / 100 * w, 0);
      const trait = ev.tags.some((t) => loves.includes(t)) ? cfg.traitBoost : 1;
      return { item: ev, weight: character * trait * (ev.after ? cfg.causeBoost : 1) };
    });
  if (entries.length === 0) return null;
  const ev = rng.weighted(entries);
  const cause = ev.after ? (rival.offscreen.filter((o) => o.pokemon === speciesId && o.eventType === ev.after).pop()?.id ?? null) : null;
  apply(bond, ev.delta);
  if (ev.delta.hyperReadiness) bond.hyperReadiness = clamp(bond.hyperReadiness + ev.delta.hyperReadiness);
  if (ev.habit && !bond.habits[ev.habit]) {
    const h = habitFor(content, run, rival, speciesId, ev.habit);
    if (h) bond.habits[ev.habit] = h;
  }
  const record: OffscreenEvent = {
    id: `${rival.id}::${stageKey}`, eventType: ev.id, pokemon: speciesId, at: stageKey, cause, visibility: ev.visibility, shown: false,
    text: ev.text.replaceAll('{rival}', rival.name).replaceAll('{mon}', speciesName(content, speciesId)),
  };
  bond.recent = [...bond.recent, ev.id].slice(-cfg.recentKept);
  rival.offscreen = [...rival.offscreen, record].slice(-cfg.historyKept);
  return record;
}

/** Examples §4.2: how the rival treats its team after a battle with you. Shifts every member's bond. */
export function afterBattleBehavior(content: Content, run: RunState, rival: Rival, won: boolean): string | null {
  ensureBonds(run, rival);
  const rng = new Rng(hashSeed(`${run.seed}::rival-behavior::${rival.id}::${rival.encounters}`));
  const fits = RIVAL_BONDS.behaviors
    .filter((b) => (b.on === 'any' || (b.on === 'win') === won) && Object.entries(b.needs).every(([k, v]) => ((rival.traits as Record<string, number>)[k] ?? 0) >= v))
    .map((b) => ({ item: b, weight: 1 }));
  if (fits.length === 0) return null;
  const b = rng.weighted(fits);
  for (const bond of Object.values(rival.bonds)) apply(bond, b.delta);
  return b.name;
}

/** Bonds change how hard it hits: a pair in sync returns stronger, a worn-out team weaker. */
export function bondShift(rival: Pick<Rival, 'bonds'>): number {
  const bonds = Object.values(rival.bonds);
  if (bonds.length === 0) return 0;
  const avg = (k: Dim) => bonds.reduce((s, b) => s + (b[k] as number), 0) / bonds.length;
  const e = RIVAL_BONDS.effects;
  if (avg('strain') >= e.worryStrain) return -1;
  return avg('synchronization') >= e.levelBonusSync && avg('confidence') >= e.levelBonusConfidence ? 1 : 0;
}

/** A short line the player can notice before the battle: the oldest observed event not yet shown. */
export function bondNote(rival: Rival): string | null {
  const ev = rival.offscreen.find((o) => o.visibility === 'observed' && !o.shown);
  if (!ev) return null;
  ev.shown = true;
  return ev.text;
}

/** Rumours from events other people saw (the world's rumour line). */
export function rumorFrom(rival: Rival, content: Content, ev: OffscreenEvent): string | null {
  return ev.visibility === 'rumor' ? `${rivalTitle(content, rival)}: ${ev.text}` : null;
}

/** A line per Pokémon for the chronicle: trait, strongest and weakest dimension, a habit. */
export function bondLines(content: Content, rival: Rival): string[] {
  return Object.entries(rival.bonds).map(([id, b]) => {
    const dims = DIMS.filter((d) => d !== 'sharedHistory').map((d) => [d, b[d as Dim] as number] as const);
    const top = [...dims].sort((a, c) => (c[0] === 'strain' ? 0 : c[1]) - (a[0] === 'strain' ? 0 : a[1]))[0]!;
    const habit = Object.values(b.habits)[0];
    const mood = b.strain >= RIVAL_BONDS.effects.worryStrain ? 'worn out' : b.trust >= RIVAL_BONDS.effects.loyaltyTrust && b.affection >= RIVAL_BONDS.effects.loyaltyAffection ? 'devoted' : b.trust <= RIVAL_BONDS.effects.worryTrust ? 'distant' : 'steady';
    return `${speciesName(content, id)} (${b.trait}, ${mood}; best: ${top[0]} ${top[1]})${habit ? ` ${habit}` : ''}`;
  });
}

/** Public reputation (Examples §8): how other trainers see a rival, from how it treats its team and how it fights. Derived, never saved. */
export function reputation(rival: Pick<Rival, 'bonds' | 'traits' | 'encounters'>): 'respected' | 'feared' | 'disliked' | 'unknown' {
  const bonds = Object.values(rival.bonds);
  if (bonds.length === 0 || rival.encounters === 0) return 'unknown';
  const avg = (k: 'trust' | 'strain') => bonds.reduce((s, b) => s + b[k], 0) / bonds.length;
  const e = RIVAL_BONDS.effects;
  if (avg('strain') >= e.worryStrain || avg('trust') <= e.worryTrust) return rival.traits.ambition >= 60 ? 'feared' : 'disliked';
  return avg('trust') >= e.loyaltyTrust - 15 ? 'respected' : 'unknown';
}

/** A signature (Examples §8): once a rival has fought you twice, the habit its team shows in battle becomes its known tell. */
export function signature(content: Content, rival: Rival): string | null {
  if (rival.encounters < 2) return null;
  for (const [id, b] of Object.entries(rival.bonds)) if (b.habits.tell) return `${speciesName(content, id)} ${b.habits.tell}`;
  return null;
}
