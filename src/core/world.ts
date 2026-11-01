// Exploration (APPROVED.md §5): fog of war, weather fronts, roaming Legendaries and checkpoint camps.
//
// Determinism: fronts and the roamers' first places come from generators seeded by the run seed and
// the stage, never from a gameplay stream, so adding or changing them moves no other roll. Fog and
// the map's forecast are views only. Outcomes never depend on the map's animation.

import { effectiveAttributes } from './attributes';
import type { Content, Weather } from './contentSchema';
import { runGameEventIds } from './gameEvents';
import { currentColumn, findNode } from './map';
import { getCampaign } from './regions';
import { stageKey } from './mapItems';
import { abilityOf } from './pokemon';
import { hashSeed, Rng } from './rng';
import { getTheme } from './themes';
import type { MapNode, RunState, StageState } from './state';

const worldOf = (content: Content) => content.balance.world;

/** Stages finished before this one, counted from the start of the run. */
const stagesDone = (content: Content, run: RunState): number => run.regionIndex * getCampaign(content, run.campaignId).stagesPerRegion + (run.stage?.index ?? 0);

// ---------- fog of war ----------

/** How many columns ahead the map shows right now (fog of war). */
export function sightRange(content: Content, run: RunState): number {
  const w = worldOf(content);
  let sight = w.fogSight + Math.floor(Math.max(0, effectiveAttributes(content, run).intelligence) / w.fogIntelligencePerSight);
  const scouts = run.party.some((m) => {
    if (m.hp <= 0) return false;
    const ability = abilityOf(content, m);
    return (ability !== null && w.fogAbilities.includes(ability)) || (content.species.get(m.speciesId)?.types.includes('flying') ?? false);
  });
  if (scouts) sight += 1;
  return sight;
}

/** The last column the map shows now: your sight, or further after scouting. */
export function visibleColumn(content: Content, run: RunState): number {
  const stage = run.stage!;
  return Math.max(currentColumn(stage) + sightRange(content, run), stage.scoutedTo);
}

/** Whether a node is in the fog given the last visible column (see `visibleColumn`): beyond it and not visited. The gym leader and the League are never fogged. */
export function foggedAt(stage: StageState, seen: number, node: MapNode): boolean {
  if (stage.kind !== 'stage' || node.column >= stage.map.columns || stage.visited.includes(node.id)) return false;
  return node.column > seen;
}

export function isFogged(content: Content, run: RunState, node: MapNode): boolean {
  const stage = run.stage;
  return !!stage && stage.kind === 'stage' && foggedAt(stage, visibleColumn(content, run), node);
}

/** Scouting (mutates `run`): the map shows `columns` more columns ahead for the rest of the stage. */
export function scoutAhead(content: Content, run: RunState, columns: number): number {
  const stage = run.stage!;
  stage.scoutedTo = Math.min(stage.map.columns, Math.max(stage.scoutedTo, visibleColumn(content, run)) + columns);
  return stage.scoutedTo;
}

// ---------- weather fronts ----------

export interface Front {
  weather: Weather;
  from: number;
  to: number;
  /** Which routes it covers: every node, only the top row of each column, or the lower rows. */
  band: 'all' | 'high' | 'low';
}

/** The fronts of this stage: its own (from the seed, none in the League) and any an event brought in. */
export function stageFronts(content: Content, run: RunState): Front[] {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return [];
  const w = worldOf(content);
  const rng = new Rng(hashSeed(`${run.seed}::fronts::${stageKey(run)}`));
  const fronts: Front[] = [];
  if (rng.chance(w.frontChance)) {
    const types = getTheme(content, stage.themeId).types as readonly string[];
    // The stage's theme leans the weather: water rains, fire is sunny, rock and ground blow sand, ice snows.
    const lean: Weather[] = [];
    if (types.includes('water')) lean.push('rain');
    if (types.includes('fire')) lean.push('sun');
    if (types.includes('rock') || types.includes('ground')) lean.push('sand');
    if (types.includes('ice')) lean.push('snow', 'hail');
    const pool = lean.length > 0 && rng.chance(0.6) ? lean : w.frontWeathers;
    const weather = rng.pick([...pool]);
    const length = rng.int(w.frontLength[0], w.frontLength[1]);
    const from = rng.int(3, Math.max(3, stage.map.columns - 1 - length));
    fronts.push({ weather, from, to: Math.min(stage.map.columns - 1, from + length - 1), band: rng.pick(['all', 'high', 'low'] as const) });
  }
  for (const f of stage.extraFronts) fronts.push({ ...f, band: 'all' });
  return fronts;
}

function inFront(f: Front, node: MapNode): boolean {
  if (node.column < f.from || node.column > f.to) return false;
  return f.band === 'all' || (f.band === 'high' ? node.row === 0 : node.row > 0);
}

/** The front over a node, if any. */
export function frontAt(content: Content, run: RunState, node: MapNode): Front | null {
  return stageFronts(content, run).find((f) => inFront(f, node)) ?? null;
}

/** The next front within the forecast: how many columns away it starts (0 = you are in it). */
export function forecast(content: Content, run: RunState): { front: Front; startsIn: number } | null {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return null;
  const here = currentColumn(stage);
  const w = worldOf(content);
  let best: { front: Front; startsIn: number } | null = null;
  for (const front of stageFronts(content, run)) {
    if (front.to < here + 1) continue;
    const startsIn = Math.max(0, front.from - (here + 1));
    if (startsIn <= w.frontForecast && (!best || startsIn < best.startsIn)) best = { front, startsIn };
  }
  return best;
}

/** A battle at a node inside a front starts in that weather (mutates `run`; the Gym and the League keep their own). */
export function applyFrontWeather(content: Content, run: RunState, node: MapNode): Weather | null {
  const battle = run.battle;
  if (!battle || battle.weather || node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion') return null;
  const front = frontAt(content, run, node);
  if (!front) return null;
  battle.weather = { id: front.weather, turns: 999 };
  return front.weather;
}

// ---------- roaming Legendaries ----------

/** The event a roamer's stop plays: `roamer-<species>` (events.json). */
export const roamerEventId = (species: string): string => `roamer-${species}`;

/** When a stage starts (mutates `run`): maybe a Legendary starts roaming this map, or all of a running game event's. */
export function spawnRoamers(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  stage.roamers = [];
  const w = worldOf(content);
  if (stagesDone(content, run) + 1 < w.roamerMinStage) return;
  const active = new Set(runGameEventIds(run));
  const rng = new Rng(hashSeed(`${run.seed}::roamers::${stageKey(run)}`));
  const themed = w.roamers.filter((r) => r.gameEvent && active.has(r.gameEvent) && content.events.has(roamerEventId(r.species)));
  let chosen = themed;
  if (chosen.length === 0) {
    if (!rng.chance(w.roamerChance)) return;
    const pool = w.roamers.filter((r) => !r.gameEvent && r.weight > 0 && content.events.has(roamerEventId(r.species)));
    if (pool.length === 0) return;
    chosen = [rng.weighted(pool.map((item) => ({ item, weight: item.weight })))];
  }
  const startColumns = [4, 6, 8];
  chosen.forEach((r, i) => {
    const column = Math.min(stage.map.columns - 2, startColumns[i % startColumns.length]! + rng.int(0, 1));
    const nodes = stage.map.nodes.filter((n) => n.column === column);
    stage.roamers.push({ species: r.species, nodeId: rng.pick(nodes).id, status: 'roaming' });
  });
  placeRoamerStops(run);
}

function placeRoamerStops(run: RunState): void {
  const stage = run.stage!;
  for (const n of stage.map.nodes) n.sides = n.sides.filter((s) => !s.roamer || s.used);
  for (const r of stage.roamers) {
    if (r.status !== 'roaming' || !r.nodeId) continue;
    const node = findNode(stage.map, r.nodeId);
    node.sides.push({ id: `roamer-${r.species}-${node.id}`, kind: 'event', used: false, eventId: roamerEventId(r.species), roamer: r.species });
  }
}

/**
 * The player stepped to a node (mutates `run`): each roamer takes a step ahead along the map, unless it rests.
 * A roamer that reaches the gym column slips away. Each roamer's own generator is seeded by the species,
 * the stage and the node you reached, so choosing again after a reload gives the same chase.
 */
export function advanceRoamers(content: Content, run: RunState, node: MapNode): void {
  const stage = run.stage;
  if (!stage || stage.roamers.length === 0) return;
  const w = worldOf(content);
  for (const r of stage.roamers) {
    if (r.status !== 'roaming' || !r.nodeId) continue;
    if (r.nodeId === node.id) continue; // you are on it: the stop is waiting
    const here = findNode(stage.map, r.nodeId);
    if (here.column <= node.column) {
      // You went past it: it slips away behind you.
      r.status = 'gone';
      continue;
    }
    const rng = new Rng(hashSeed(`${run.seed}::roamer::${r.species}::${stageKey(run)}::${node.id}`));
    if (rng.chance(w.roamerRestChance)) continue;
    if (here.next.length === 0 || here.column >= stage.map.columns - 1) {
      r.status = 'gone';
      continue;
    }
    r.nodeId = rng.pick(here.next);
  }
  placeRoamerStops(run);
}

/** A roamer's stop was played (battle won, fled from or ignored): it stops roaming (mutates `run`). */
export function endRoamer(run: RunState, species?: string): void {
  const stage = run.stage;
  if (!stage) return;
  for (const r of stage.roamers) if (r.status === 'roaming' && (species === undefined || r.species === species)) r.status = 'done';
  placeRoamerStops(run);
}

/** The roamer on a node, for the map. */
export function roamerOn(stage: StageState, nodeId: string): string | null {
  return stage.roamers.find((r) => r.status === 'roaming' && r.nodeId === nodeId)?.species ?? null;
}

/** Whether any Legendary is roaming this map (the `roaming` event condition). */
export function anyRoaming(run: RunState): boolean {
  return (run.stage?.roamers ?? []).some((r) => r.status === 'roaming');
}

// ---------- checkpoint camps ----------

/** Whether this stage has a camp: one every `campEvery` stages (every stage when 1). */
export function stageHasCamp(content: Content, run: RunState): boolean {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return false;
  const n = stagesDone(content, run);
  const every = worldOf(content).campEvery;
  // Every stage has a camp when `campEvery` is 1 (spec §22); otherwise one every few stages, never the first.
  return (n > 0 || every === 1) && n % every === 0;
}

export const CAMP_EVENT_ID = 'camp-checkpoint';

/** Adds this stage's camp beside a middle-column node (mutates `run`); a hidden-free, always-visible stop. */
export function placeCamp(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || !stageHasCamp(content, run) || !content.events.has(CAMP_EVENT_ID)) return;
  const [lo, hi] = worldOf(content).campColumns;
  const rng = new Rng(hashSeed(`${run.seed}::camp::${stageKey(run)}`));
  const column = Math.min(stage.map.columns - 1, rng.int(lo, hi));
  const node = rng.pick(stage.map.nodes.filter((n) => n.column === column));
  node.sides.push({ id: `camp-${node.id}`, kind: 'event', used: false, eventId: CAMP_EVENT_ID });
}

/** Whether the player carries a Pokémon with one of the abilities (for secret paths). */
export function partyHasAbility(content: Content, run: RunState, abilities: readonly string[]): boolean {
  return run.party.some((m) => {
    const a = abilityOf(content, m);
    return a !== null && abilities.includes(a);
  });
}

// ---------- convoy mode ----------

/** An event brings an escort into the stage (mutates `run`); one at a time. */
export function startConvoy(run: RunState, name: string, hp: number): boolean {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || stage.convoy) return false;
  stage.convoy = { name, hp, maxHp: hp };
  return true;
}

export function healConvoy(run: RunState, amount: number): void {
  const convoy = run.stage?.convoy;
  if (convoy) convoy.hp = Math.min(convoy.maxHp, convoy.hp + amount);
}

/**
 * The player stepped to a node with an escort (mutates `run`). A battle node may strike it: a seeded roll
 * from the stage and node, softened by a guarding ability in the party. At 0 health it is lost. At the gym
 * a living escort is delivered for the reward; either way the escort ends there.
 */
export function convoyStep(content: Content, run: RunState, node: MapNode): void {
  const stage = run.stage;
  const convoy = stage?.convoy;
  if (!stage || !convoy) return;
  const w = worldOf(content);
  const flag = (key: string): void => {
    run.story.flags[`ev:${key}`] = Number(run.story.flags[`ev:${key}`] ?? 0) + 1;
  };
  if (node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion') {
    if (convoy.hp > 0) {
      run.money += w.convoyReward + convoy.hp * w.convoyRewardPerHp;
      flag('convoy-delivered');
    }
    stage.convoy = null;
    return;
  }
  if (node.kind !== 'wild' && node.kind !== 'trainer') return;
  const rng = new Rng(hashSeed(`${run.seed}::convoy::${stageKey(run)}::${node.id}`));
  if (!rng.chance(w.convoyHitChance)) return;
  const guard = partyHasAbility(content, run, w.convoyGuardAbilities) ? 1 : 0;
  convoy.hp = Math.max(0, convoy.hp - Math.max(1, rng.int(w.convoyHit[0], w.convoyHit[1]) - guard));
  if (convoy.hp === 0) {
    flag('convoy-lost');
    stage.convoy = null;
  }
}
