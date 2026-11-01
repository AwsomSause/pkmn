// Ideas W4 traversal: type-based obstacles on the stage map (Surf, Cut, Strength, torches, ice bridges, dig
// tunnels, spectral doors, power panels, fairy rings, lava rivers, spider webs, cloud gaps, seasonal floods...).
// An obstacle sits on a wild node. Walking onto it, the first healthy party Pokémon of a fitting type (or with a
// fitting ability, or under a fitting weather front) crosses it for a reward; without one the party takes the
// long way round (a small HP cost or a status, never a knockout). The node's battle happens either way, so no
// path is ever closed and no run can get stuck.
//
// Determinism: placement and rewards come from generators seeded by the run seed, region, stage and node (their
// own hash, never a gameplay stream), so adding obstacles moves no other roll. Placement happens once at stage
// start and is stored on the stage (run v34), so the season or a front changing later never moves an obstacle.

import { z } from 'zod';
import json from '../data/traversal.json';
import { runPerks } from './archetypes';
import { seasonOf } from './clock';
import { EventEffectSchema, type Content } from './contentSchema';
import { applyEffect, conditionMet } from './events';
import { changeFriendship } from './friendship';
import { stageKey } from './mapItems';
import { abilityOf, maxHp } from './pokemon';
import { count } from './progress';
import { hashSeed, Rng } from './rng';
import { emit } from './story/record';
import { getTheme } from './themes';
import { frontAt } from './world';
import type { MapNode, PokemonInstance, RunState, StageState } from './state';

const SEASON = z.enum(['Spring', 'Summer', 'Autumn', 'Winter']);
export const ObstacleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** The approved idea this obstacle builds (ledger row), for the coverage tracker. */
  idea: z.string(),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  /** "{Pokémon} {verb} the {name}". */
  verb: z.string().min(1),
  types: z.array(z.string()).min(1),
  abilities: z.array(z.string()).default([]),
  /** A weather front over the node (core/world.ts) also clears it (the weather clash: rain puts out a fire). */
  weather: z.array(z.string()).default([]),
  /** Placed `themeWeight` times as often on stages of these types. */
  themes: z.array(z.string()).default([]),
  /** Placed `seasonWeight` times as often in these run seasons. */
  seasons: z.array(SEASON).default([]),
  /** Only placed in these seasons (seasonal terrain). */
  onlySeasons: z.array(SEASON).default([]),
  weight: z.number().positive().default(1),
  /** Share of max HP the Pokémon that crosses spends (flying costs stamina). */
  cost: z.number().min(0).max(0.5).default(0),
  pass: z.array(EventEffectSchema),
  detour: z.array(EventEffectSchema),
  detourText: z.string().min(1),
});
export type Obstacle = z.infer<typeof ObstacleSchema>;
export const TraversalSchema = z.object({
  note: z.string(),
  perStage: z.number().int().min(0),
  fromColumn: z.number().int().min(1),
  themeWeight: z.number().min(1),
  seasonWeight: z.number().min(1),
  friendship: z.number().int().min(0),
  obstacles: z.array(ObstacleSchema).min(1),
});
export const TRAVERSAL = TraversalSchema.parse(json);
const BY_ID = new Map(TRAVERSAL.obstacles.map((o) => [o.id, o]));

export const obstacleDef = (id: string): Obstacle | undefined => BY_ID.get(id);

/** The obstacle still waiting on a node, or null. */
export function obstacleAt(stage: StageState | null | undefined, nodeId: string): Obstacle | null {
  const id = stage?.obstacles?.[nodeId];
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** How many obstacles a stage gets, and the weight multipliers from the run's rules (live events). */
function perkTweaks(content: Content, run: RunState): { extra: number; weight: (id: string) => number } {
  const perks = runPerks(content, run) ?? [];
  let extra = 0;
  for (const m of perks) if (m.kind === 'traversalExtra') extra += m.count;
  const weight = (id: string) => perks.reduce((v, m) => (m.kind === 'traversalWeight' && m.obstacle === id ? v * m.value : v), 1);
  return { extra, weight };
}

/** The weight of an obstacle kind on this stage (0 = not placed). */
export function obstacleWeight(content: Content, run: RunState, o: Obstacle, themeTypes: readonly string[], tweak: (id: string) => number = () => 1): number {
  const season = seasonOf(content, run);
  if (o.onlySeasons.length > 0 && !o.onlySeasons.includes(season)) return 0;
  let w = o.weight * tweak(o.id);
  if (o.themes.some((t) => themeTypes.includes(t))) w *= TRAVERSAL.themeWeight;
  if (o.seasons.includes(season)) w *= TRAVERSAL.seasonWeight;
  return w;
}

/**
 * Places the stage's obstacles (mutates `run`). Only wild nodes from `fromColumn` to two before the gym, and only
 * where every node leading in has another way forward, so an obstacle is always a choice, never a wall.
 */
export function placeObstacles(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || !content.balance.world.traversal) return;
  const { extra, weight } = perkTweaks(content, run);
  const want = TRAVERSAL.perStage + extra;
  stage.obstacles = {};
  if (want <= 0) return;
  const rng = new Rng(hashSeed(`${run.seed}::traversal::${run.regionIndex}::${stage.index}`));
  const types = getTheme(content, stage.themeId).types as readonly string[];
  const pool = TRAVERSAL.obstacles.map((o) => ({ item: o, weight: obstacleWeight(content, run, o, types, weight) })).filter((p) => p.weight > 0);
  if (pool.length === 0) return;
  const map = stage.map;
  const candidates = rng.shuffle(map.nodes.filter((n) => n.kind === 'wild' && n.column >= TRAVERSAL.fromColumn && n.column <= map.columns - 2));
  const blocked = new Set<string>();
  for (const node of candidates) {
    if (blocked.size >= want) break;
    const into = map.nodes.filter((p) => p.next.includes(node.id));
    if (into.some((p) => !p.next.some((id) => id !== node.id && !blocked.has(id)))) continue;
    blocked.add(node.id);
    stage.obstacles[node.id] = rng.weighted(pool).id;
  }
}

export interface Crossing {
  obstacle: Obstacle;
  /** The Pokémon that crosses it (null: the party takes the long way round, or the weather does it). */
  passer: PokemonInstance | null;
  /** Why it can cross: a type, an ability, the weather, or null (the long way round). */
  how: 'type' | 'ability' | 'weather' | null;
}

/** Who would cross the obstacle on this node, read from the party as it is now. */
export function crossingFor(content: Content, run: RunState, node: MapNode): Crossing | null {
  const obstacle = obstacleAt(run.stage, node.id);
  if (!obstacle) return null;
  const alive = run.party.filter((m) => m.hp > 0);
  const byType = alive.find((m) => content.species.get(m.speciesId)?.types.some((t) => obstacle.types.includes(t)));
  if (byType) return { obstacle, passer: byType, how: 'type' };
  const byAbility = alive.find((m) => {
    const a = abilityOf(content, m);
    return a !== null && obstacle.abilities.includes(a);
  });
  if (byAbility) return { obstacle, passer: byAbility, how: 'ability' };
  const front = frontAt(content, run, node);
  if (front && obstacle.weather.includes(front.weather)) return { obstacle, passer: null, how: 'weather' };
  return { obstacle, passer: null, how: null };
}

const typeWords = (o: Obstacle) => o.types.map((t) => t[0]!.toUpperCase() + t.slice(1)).join(' or ');

/** One line for the map: what the obstacle needs and what will happen. */
export function crossingHint(content: Content, run: RunState, node: MapNode): string | null {
  const c = crossingFor(content, run, node);
  if (!c) return null;
  const needs = `needs a ${typeWords(c.obstacle)} type${c.obstacle.weather.length ? ` or a ${c.obstacle.weather.join('/')} front` : ''}`;
  if (c.how === 'weather') return `${c.obstacle.name} (${needs}): the weather clears it for you.`;
  if (c.passer) return `${c.obstacle.name} (${needs}): ${content.species.get(c.passer.speciesId)?.name ?? 'your Pokémon'} can cross it for a reward${c.obstacle.cost ? ` (costs it ${Math.round(c.obstacle.cost * 100)}% HP)` : ''}.`;
  return `${c.obstacle.name} (${needs}): nobody can cross, so you would take the long way round.`;
}

/**
 * Crosses the obstacle on the node the party just reached (mutates `run`; call after `stage.current` is set).
 * Returns the words for the map, or null when there is no obstacle there.
 */
export function crossObstacle(content: Content, run: RunState, node: MapNode): string | null {
  const stage = run.stage;
  const c = crossingFor(content, run, node);
  if (!stage || !c) return null;
  delete stage.obstacles![node.id];
  const rng = new Rng(hashSeed(`${run.seed}::traversal-cross::${stageKey(run)}::${node.id}`));
  const o = c.obstacle;
  if (c.how === null) {
    const words = o.detour.map((e) => applyEffect(content, run, e, rng)).filter(Boolean);
    count(run, 'obstaclesDetoured');
    return `${o.detourText}${words.length ? ` (${words.join(', ')})` : ''}`;
  }
  const who = c.passer ? (content.species.get(c.passer.speciesId)?.name ?? 'Your Pokémon') : 'The weather';
  if (c.passer) {
    changeFriendship(content, c.passer, TRAVERSAL.friendship);
    if (o.cost > 0) c.passer.hp = Math.max(1, c.passer.hp - Math.ceil(maxHp(content, c.passer) * o.cost));
  }
  const words = o.pass.map((e) => applyEffect(content, run, e, rng)).filter(Boolean);
  count(run, 'obstaclesCleared');
  const text = c.how === 'weather' ? `The ${frontAt(content, run, node)?.weather ?? 'weather'} clears the ${o.name}.` : `${who} ${o.verb} the ${o.name}!`;
  emit(content, run, 'storyMoment', { actors: c.passer ? [c.passer.uid] : [], data: { def: 'traversal', suppressed: false }, importance: 30, text });
  return `${text}${words.length ? ` (${words.join(', ')})` : ''}`;
}

// ---------- M94 landmarks: one per region, with a lasting effect ----------

/** Landmark events (`stop: 'landmark'`, one per region in events.json) are placed here, never drawn at random. */
export const LANDMARK_STOP = 'landmark';

/**
 * The region's landmark (mutates `run`): on the region's second stage, once, beside a node in the middle of
 * the map. Its choices grant a relic (a lasting run effect, once per id), so a landmark marks the whole run.
 */
export function placeLandmark(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || stage.index !== 1) return;
  const def = [...content.events.values()]
    .filter((e) => e.stop === LANDMARK_STOP && !run.itemCounters?.[`event-seen:${e.id}`] && e.requires.every((c) => conditionMet(content, run, c)))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!def) return;
  const column = Math.min(stage.map.columns - 2, Math.ceil(stage.map.columns / 2) + 1);
  const node = stage.map.nodes.filter((n) => n.column === column).sort((a, b) => a.row - b.row)[0];
  if (!node) return;
  node.sides.push({ id: `landmark-${node.id}`, kind: 'event', used: false, eventId: def.id });
}

// ---------- live-event map rules (ideas W4 for W9: E170, E182, E183) ----------

/** The tower climb rule on this run, or null (the map draws rising and has checkpoints). */
export function towerClimb(content: Content, run: RunState): { checkpointEvery: number } | null {
  const m = (runPerks(content, run) ?? []).find((p) => p.kind === 'towerClimb');
  return m && m.kind === 'towerClimb' ? { checkpointEvery: m.checkpointEvery } : null;
}

/** At stage start (mutates `run`): Sky Tower checkpoints (a healing stop on every node of every Nth column) and events a rule places on every stage. */
export function placeWeekStops(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const tower = towerClimb(content, run);
  if (tower) {
    for (const n of stage.map.nodes) {
      if (n.column % tower.checkpointEvery !== 0 || n.column >= stage.map.columns - 1 || n.sides.some((x) => x.kind === 'heal')) continue;
      n.sides.push({ id: `checkpoint-${n.id}`, kind: 'heal', used: false });
    }
  }
  for (const m of runPerks(content, run) ?? []) {
    if (m.kind !== 'placeEvent' || !content.events.has(m.eventId)) continue;
    const column = Math.max(2, Math.floor(stage.map.columns / 3));
    const node = stage.map.nodes.filter((n) => n.column === column).sort((a, b) => a.row - b.row)[0];
    if (!node) continue;
    node.sides.push({ id: `week-${m.eventId}-${node.id}`, kind: 'event', used: false, eventId: m.eventId });
    if (run.itemCounters) delete run.itemCounters[`event-seen:${m.eventId}`];
  }
}

/**
 * Earthquake tremors (mutates `run`; call after `stage.current` is set): every `every` nodes walked, the side
 * stops of two unvisited nodes ahead swap places. Seeded from the run, stage and step. Returns words or null.
 */
export function tremorStep(content: Content, run: RunState): string | null {
  const stage = run.stage;
  const rule = (runPerks(content, run) ?? []).find((p) => p.kind === 'stopShuffle');
  if (!stage || stage.kind !== 'stage' || !rule || rule.kind !== 'stopShuffle' || stage.current === null) return null;
  if (stage.visited.length % rule.every !== 0) return null;
  const here = stage.map.nodes.find((n) => n.id === stage.current)!;
  const ahead = stage.map.nodes.filter((n) => n.column > here.column && n.column < stage.map.columns && !stage.visited.includes(n.id));
  const withStops = ahead.filter((n) => n.sides.some((x) => !x.used));
  if (withStops.length === 0 || ahead.length < 2) return null;
  const rng = new Rng(hashSeed(`${run.seed}::tremor::${stageKey(run)}::${stage.visited.length}`));
  const a = rng.pick(withStops);
  const b = rng.pick(ahead.filter((n) => n.id !== a.id));
  [a.sides, b.sides] = [b.sides, a.sides];
  return `The ground shakes! The stops at levels ${a.column} and ${b.column} have swapped places.`;
}
