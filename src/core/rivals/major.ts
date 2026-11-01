// The guaranteed major rival (Kice spec §21) and its ace and learned moves (§9, §10).
//
// Every run's first rival (stage 2, core/firstRival.ts) becomes a full rival record the moment that fight ends, so a
// run never lacks a central rival. It is a semi-canon character (majorRivals.json): Blue, Gary, Silver, Barry or Hop
// keep Pokémon from their canonical teams, evolved and levelled to this game, around the starter they picked.
// Its ace (the starter) is tracked battle to battle (§9). It studies the move that beat it (§10) and trains a counter
// for the Pokémon that beat its ace, and keeps both across stages. Nothing here draws from a gameplay stream.

import { z } from 'zod';
import json from '../../data/majorRivals.json';
import { typeEffectiveness } from '../battle/damage';
import type { Content, TypeName } from '../contentSchema';
import { evolvedFormAt, type PlannedMember, type TrainerPlan } from '../encounters';
import { familyId } from '../mastery';
import { getSpecies, movesAtLevel, usableLearnset } from '../pokemon';
import { hashSeed, Rng } from '../rng';
import { fnv1a } from '../story/moments';
import type { PokemonInstance, RunState } from '../state';
import type { DomainEvent, Rival, Traits, Where } from '../story/schema';
import { TRAIT_KEYS } from '../story/schema';
import { factionFor } from './standing';
import { RIVAL_ARCS, RIVAL_CONFIG, RIVAL_PROFILES } from './schema';

const LinesSchema = z.object({ intro: z.string(), studied: z.string(), counter: z.string() });
export const MajorRivalsSchema = z.object({
  note: z.string(),
  characters: z.record(z.string(), z.object({ home: z.string(), personality: z.string(), style: z.string(), pool: z.array(z.string()).min(3), lines: LinesSchema })),
  config: z.object({
    interval: z.number().int().min(1),
    aceHeldAt: z.number().int().min(0),
    aceHeld: z.record(z.string(), z.string()),
    aceHeldFallback: z.string(),
    study: z.object({ max: z.number().int().min(0), minKos: z.number().int().min(1) }),
    counter: z.object({ max: z.number().int().min(0) }),
  }),
  monRival: z.object({
    note: z.string(),
    chance: z.number().min(0).max(1),
    maxOpen: z.number().int().min(0),
    minTurns: z.number().int().min(0),
    levelBonus: z.number().int(),
    atkBoost: z.number().int().min(0).max(6),
    catchChance: z.number().min(0).max(1),
    catchAfterMeetings: z.number().int().min(0),
    marks: z.array(z.string()).min(1),
  }),
  sacrifice: z.object({ note: z.string(), chance: z.number().min(0).max(1), priority: z.number().int().min(1), moves: z.number().int().min(1) }),
});
export const MAJOR = MajorRivalsSchema.parse(json);

/** The run's major rival, if it has been met. */
export const majorRival = (run: RunState): Rival | undefined => run.story.rivals.find((r) => r.major);

/** The canon character for a first-rival name (the trainer class's names are the characters), or a stable fallback. */
export function characterOf(name: string): { id: string; data: (typeof MAJOR.characters)[string] } {
  const ids = Object.keys(MAJOR.characters).sort();
  const id = MAJOR.characters[name] ? name : ids[fnv1a(name) % ids.length]!;
  return { id, data: MAJOR.characters[id]! };
}

const where = (w: Where) => `${w.region}.${w.stage ?? 0}`;

/**
 * Makes the major rival from the first-rival battle that just ended (mutates run). Idempotent: a run has one.
 * `team` is the rival's team that day, `result` the player's result.
 */
export function createMajorRival(run: RunState, input: { classId: string; name: string; team: string[]; ended: DomainEvent; where: Where; result: 'win' | 'lose'; hpLeftShare: number; turns: number; foes: string[] }, content: Content): Rival | null {
  if (majorRival(run) || input.team.length === 0) return null;
  const { id: canon, data } = characterOf(input.name);
  const personality = RIVAL_PROFILES.personalities[data.personality];
  // Its own seeded stream: never touches the gameplay streams.
  const rng = new Rng(hashSeed(`${run.seed}::major-rival`));
  const spread = RIVAL_CONFIG.traitSpread;
  const traits = Object.fromEntries(TRAIT_KEYS.map((k) => [k, Math.max(0, Math.min(100, (personality?.traits[k] ?? 50) + rng.int(-spread, spread)))])) as Traits;
  const rival: Rival = {
    id: 'rival-major',
    classId: input.classId,
    name: input.name,
    archetype: personality ? data.personality : Object.keys(RIVAL_PROFILES.personalities).sort()[0]!,
    style: data.style,
    traits,
    rivalPotential: RIVAL_CONFIG.states.recurringAt,
    state: 'recurring',
    arc: null,
    away: 0,
    faction: factionFor(data.personality),
    cooldown: 0,
    progress: 0,
    encounters: 1,
    setbacks: 0,
    adaptations: [],
    bonds: {},
    offscreen: [],
    major: true,
    canon,
    ace: familyId(content, input.team[0]!),
    origin: { eventId: input.ended.id, where: input.where, path: 'major' },
    memory: { lastBattle: { eventId: input.ended.id, result: input.result, hpLeftShare: input.hpLeftShare, turns: input.turns, team: input.team.slice(0, 6), foes: input.foes } },
  };
  const arc = RIVAL_ARCS.arcs.find((a) => a.personalities.includes(rival.archetype) || a.styles.includes(rival.style));
  if (arc) rival.arc = { id: arc.id, stage: 0, ticks: 0, resolution: null };
  run.story.rivals.push(rival);
  return rival;
}

/**
 * Semi-canon team: each planned slot after the first becomes a Pokémon from the character's canonical pool, evolved for
 * its level. The same slot always draws the same family, so the team stays recognizable from meeting to meeting.
 */
export function canonPlan(content: Content, rival: Rival, plan: TrainerPlan): TrainerPlan {
  if (!rival.major) return plan;
  const pool = characterOf(rival.canon ?? rival.name).data.pool.filter((id) => content.species.has(id) && familyId(content, id) !== rival.ace);
  if (pool.length === 0) return plan;
  const start = fnv1a(`canon::${rival.canon ?? rival.name}`) % pool.length;
  const used = new Set<string>();
  const members = plan.members.map((m, i) => {
    const family = pool[(start + i) % pool.length]!;
    if (used.has(family)) return m;
    used.add(family);
    return { ...m, speciesId: evolvedFormAt(content, family, m.level) };
  });
  return { ...plan, members };
}

const power = (content: Content, id: string) => content.moves.get(id)?.power ?? 0;

/** Puts `moveId` into a move list, replacing the weakest one when it is full. */
function teach(content: Content, moves: string[], moveId: string): string[] {
  if (moves.includes(moveId)) return moves;
  if (moves.length < 4) return [...moves, moveId];
  const weakest = moves.reduce((w, id, i) => (power(content, id) < power(content, moves[w]!) ? i : w), 0);
  return moves.map((id, i) => (i === weakest ? moveId : id));
}

/**
 * The ace's moves for this meeting (§9/§10): its level-up moves, plus each studied move and each counter it trained.
 * A studied move the ace can't learn becomes its own type's closest damaging move it can (an adaptation of your move),
 * so it never learns arbitrary moves. Returns the moves and the counter aimed at your Pokémon in front, if any.
 */
export function aceMoves(content: Content, rival: Rival, speciesId: string, level: number): string[] {
  const species = getSpecies(content, speciesId);
  let moves = movesAtLevel(content, species, level);
  for (const s of rival.studied ?? []) {
    const id = adaptMove(content, speciesId, level, s.moveId);
    if (id) moves = teach(content, moves, id);
  }
  for (const c of rival.counters ?? []) if (content.moves.has(c.moveId)) moves = teach(content, moves, c.moveId);
  return moves;
}

/** The move the ace uses for a studied `moveId`: the move itself if it can learn it, else its closest same-type learnset move. */
export function adaptMove(content: Content, speciesId: string, level: number, moveId: string): string | null {
  const move = content.moves.get(moveId);
  if (!move) return null;
  const species = getSpecies(content, speciesId);
  const learnset = [...new Set(usableLearnset(content, species).filter((e) => e.level <= level).map((e) => e.move))];
  if (learnset.includes(moveId) || species.types.includes(move.type as TypeName)) return moveId;
  return learnset
    .filter((id) => content.moves.get(id)?.type === move.type && power(content, id) > 0)
    .sort((a, b) => Math.abs(power(content, a) - (move.power ?? 0)) - Math.abs(power(content, b) - (move.power ?? 0)) || a.localeCompare(b))[0] ?? null;
}

/** The ace's held item once the rivalry has history: a type booster for its first type. */
export function aceHeld(content: Content, rival: Rival, speciesId: string): string | null {
  if (rival.encounters < MAJOR.config.aceHeldAt) return null;
  const type = getSpecies(content, speciesId).types[0] ?? 'normal';
  const id = MAJOR.config.aceHeld[type] ?? MAJOR.config.aceHeldFallback;
  return content.catalog.has(id) ? id : null;
}

/**
 * Applies the ace's tracked progression to the plan (§9/§10): studied and counter moves, its held item. Mutates nothing;
 * a plan without the ace is returned as is.
 */
export function withAceProgress(content: Content, rival: Rival, plan: TrainerPlan): TrainerPlan {
  if (!rival.ace) return plan;
  const i = plan.members.findIndex((m) => familyId(content, m.speciesId) === rival.ace);
  if (i < 0) return plan;
  const m = plan.members[i]!;
  const held = aceHeld(content, rival, m.speciesId);
  const extra = (rival.studied?.length ?? 0) + (rival.counters?.length ?? 0) > 0;
  if (!held && !extra) return plan;
  const next: PlannedMember = { ...m, ...(extra ? { moves: aceMoves(content, rival, m.speciesId, m.level) } : {}), ...(held && !m.held ? { held: { [held]: 1 } } : {}) };
  return { ...plan, members: plan.members.map((x, k) => (k === i ? next : x)) };
}

/** The intro lines the major rival says about what it learned (studied move and counter), filled in. */
export function majorNote(content: Content, rival: Rival, aceSpecies: string | null): string | null {
  if (!rival.major) return null;
  const { data } = characterOf(rival.canon ?? rival.name);
  const ace = aceSpecies ? (content.species.get(aceSpecies)?.name ?? aceSpecies) : 'its ace';
  const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');
  const lines = [fill(data.lines.intro, { rival: rival.name, ace })];
  const s = rival.studied?.[rival.studied.length - 1];
  if (s) lines.push(fill(data.lines.studied, { rival: rival.name, ace, move: content.moves.get(s.moveId)?.name ?? s.moveId }));
  const c = rival.counters?.[rival.counters.length - 1];
  if (c) lines.push(fill(data.lines.counter, { rival: rival.name, ace, move: content.moves.get(c.moveId)?.name ?? c.moveId, target: c.targetName }));
  return lines.join(' ');
}

/** A damaging move the ace can learn by `level` that hits `targetTypes` super effectively (strongest first), or null. */
export function counterMove(content: Content, speciesId: string, level: number, targetTypes: readonly string[]): string | null {
  const species = getSpecies(content, speciesId);
  const pool = [...new Set(usableLearnset(content, species).filter((e) => e.level <= level).map((e) => e.move))];
  return pool
    .filter((id) => power(content, id) > 0 && typeEffectiveness(content.typeChart, content.moves.get(id)!.type as TypeName, targetTypes as TypeName[]) >= 2)
    .sort((a, b) => power(content, b) - power(content, a) || a.localeCompare(b))[0] ?? null;
}

export interface Knockout {
  /** The rival's Pokémon (enemy uid) and its species, and your Pokémon that knocked it out with which move. */
  foeUid: string;
  foeSpecies: string;
  by: string;
  moveId: string | null;
}

/**
 * After a battle with the major rival (or any rival): what it learned (§10). Mutates `rival`. Returns the lines to tell.
 * Studied move: the move of yours that knocked out the most of its Pokémon (minKos+), once per move, up to `study.max`.
 * Counter: the Pokémon that knocked out its ace gets a counter move trained for it (one per target, up to `counter.max`).
 */
export function learnFromBattle(content: Content, run: RunState, rival: Rival, kos: Knockout[], at: Where): string[] {
  const cfg = MAJOR.config;
  const out: string[] = [];
  const studied = (rival.studied ??= []);
  const byMove = new Map<string, number>();
  for (const k of kos) if (k.moveId && power(content, k.moveId) > 0) byMove.set(k.moveId, (byMove.get(k.moveId) ?? 0) + 1);
  const best = [...byMove.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (best && best[1] >= cfg.study.minKos && studied.length < cfg.study.max && !studied.some((s) => s.moveId === best[0])) {
    const user = kos.find((k) => k.moveId === best[0])!.by;
    const from = run.party.find((m) => m.uid === user);
    studied.push({ moveId: best[0], from: from ? getSpecies(content, from.speciesId).name : 'your team', at: where(at) });
    out.push(`${rival.name} studied your ${content.moves.get(best[0])?.name ?? best[0]}.`);
  }
  const aceKo = rival.ace ? kos.find((k) => familyId(content, k.foeSpecies) === rival.ace) : undefined;
  const target = aceKo ? run.party.find((m) => m.uid === aceKo.by) : undefined;
  const counters = (rival.counters ??= []);
  if (aceKo && target && counters.length < cfg.counter.max && !counters.some((c) => c.target === target.uid)) {
    const ace = rival.aceLog?.speciesId ?? aceKo.foeSpecies;
    const level = rival.aceLog?.level ?? target.level;
    const move = counterMove(content, ace, level + 10, getSpecies(content, target.speciesId).types);
    if (move) {
      const targetName = getSpecies(content, target.speciesId).name;
      counters.push({ target: target.uid, targetName, moveId: move, at: where(at) });
      out.push(`${rival.name} swore ${getSpecies(content, ace).name} would learn ${content.moves.get(move)?.name ?? move} for your ${targetName}.`);
    }
  }
  if (rival.studied.length === 0) delete rival.studied;
  if (rival.counters.length === 0) delete rival.counters;
  return out;
}

/** §9: the ace's record after a battle (form, level, moves, held item, wins and losses, and what changed). Mutates `rival`. */
export function recordAce(content: Content, rival: Rival, team: readonly PokemonInstance[], won: boolean): void {
  if (!rival.ace) return;
  const mon = team.find((m) => familyId(content, m.speciesId) === rival.ace);
  if (!mon) return;
  const prev = rival.aceLog;
  const mods: string[] = [...(prev?.mods ?? [])];
  if (prev && prev.speciesId !== mon.speciesId) mods.push(`Evolved into ${getSpecies(content, mon.speciesId).name}`);
  const held = Object.keys(mon.held ?? {})[0] ?? null;
  if (held && prev?.held !== held) mods.push(`Holds ${content.catalog.get(held)?.name ?? held}`);
  for (const id of mon.awakened ?? []) mods.push(`Signature: ${content.moves.get(id)?.name ?? id}`);
  rival.aceLog = {
    speciesId: mon.speciesId,
    level: mon.level,
    moves: mon.moves.map((m) => m.id),
    held,
    battles: (prev?.battles ?? 0) + 1,
    wins: (prev?.wins ?? 0) + (won ? 1 : 0),
    losses: (prev?.losses ?? 0) + (won ? 0 : 1),
    mods: [...new Set(mods)].slice(-6),
  };
}

/** Readable ace lines for the Story screen. */
export function aceLines(content: Content, rival: Rival): string[] {
  const a = rival.aceLog;
  const out: string[] = [];
  if (rival.major && rival.canon) out.push(`Major rival (${characterOf(rival.canon).data.home})`);
  if (a) {
    out.push(`Ace ${getSpecies(content, a.speciesId).name} Lv ${a.level}: ${a.wins}W/${a.losses}L in ${a.battles} battles${a.held ? `, holds ${content.catalog.get(a.held)?.name ?? a.held}` : ''}`);
    out.push(`Ace moves: ${a.moves.map((id) => content.moves.get(id)?.name ?? id).join(', ')}`);
    if (a.mods.length > 0) out.push(`Ace changes: ${a.mods.join(', ')}`);
  }
  for (const s of rival.studied ?? []) out.push(`Studied your ${content.moves.get(s.moveId)?.name ?? s.moveId} (${s.from})`);
  for (const c of rival.counters ?? []) out.push(`Counter for your ${c.targetName}: ${content.moves.get(c.moveId)?.name ?? c.moveId}`);
  return out;
}
