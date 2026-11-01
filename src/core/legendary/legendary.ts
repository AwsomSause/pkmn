// Legendary world events (spec 19). Each one is a full expedition definition with a `legendary` block (data/legendaryEvents.json):
// a side stage for one Legendary with its own environment, route changes, wild table, NPCs and a multi-phase finale.
// This file holds the pure rules: when a gate appears, and what the stage does to a fight and to the party.
// Everything is seeded by the run (never by animation), and the outcome record lives in `run.legendary`.

import { conditionMet } from '../events';
import { timeOfDay } from '../arenaStyle';
import { getTheme } from '../themes';
import { hashSeed, Rng } from '../rng';
import { maxHp } from '../pokemon';
import type { Content } from '../contentSchema';
import type { BattleState, ExpeditionState, LegendaryRecord, RunState } from '../state';
import type { ExpeditionDef, LegendaryBlock, LegendaryEnv } from '../expedition/schema';

export const LEGEND_RARITY_FACTOR: Record<LegendaryBlock['rarity'], number> = { uncommon: 1, rare: 0.5, veryRare: 0.2 };

export function legendaryRecord(run: RunState): LegendaryRecord {
  run.legendary ??= { offered: [], completed: [], failed: [], extracted: [], placed: {}, outcomes: [] };
  return run.legendary;
}

export function legendaryEvents(content: Content): ExpeditionDef[] {
  return content.expeditions.expeditions.filter((e) => e.legendary);
}

/** Why an event is not on offer right now (null = it can appear on this stage). */
export function legendaryProblem(content: Content, run: RunState, def: ExpeditionDef): string | null {
  const l = def.legendary;
  const stage = run.stage;
  if (!l || !stage || stage.kind !== 'stage') return 'no stage';
  const rec = run.legendary;
  if (rec?.completed.includes(def.id)) return 'already completed this run';
  if (!content.species.has(l.species)) return 'unknown species';
  const t = l.trigger;
  if (run.regionIndex < t.minRegion) return `needs region ${t.minRegion + 1}+`;
  if (t.maxRegion !== null && run.regionIndex > t.maxRegion) return 'region too late';
  if (t.time.length > 0 && !t.time.includes(timeOfDay(run.seed, stage.index))) return 'wrong time of day';
  if (t.themeTypes.length > 0) {
    const types = getTheme(content, stage.themeId)?.types ?? [];
    if (!t.themeTypes.some((x) => types.includes(x))) return 'wrong stage theme';
  }
  if (!t.requires.every((c) => conditionMet(content, run, c))) return 'conditions not met';
  if (t.any.length > 0 && !t.any.some((c) => conditionMet(content, run, c))) return 'conditions not met';
  return null;
}

/** The events that could appear on the current stage, with their draw weight. */
export function eligibleLegendary(content: Content, run: RunState): { def: ExpeditionDef; weight: number }[] {
  return legendaryEvents(content)
    .filter((d) => legendaryProblem(content, run, d) === null)
    .map((def) => {
      const t = def.legendary!.trigger;
      const liked = t.favoured.length > 0 && run.party.some((m) => (content.species.get(m.speciesId)?.types ?? []).some((x) => t.favoured.includes(x)));
      return { def, weight: t.weight * LEGEND_RARITY_FACTOR[def.legendary!.rarity] * (liked ? 2 : 1) };
    });
}

/** Maybe puts one Legendary gate on this stage (seeded by run, region and stage; at most `perRegion` per region). */
export function placeLegendaryGate(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || !content.legendaryGate) return;
  const cfg = content.legendaryGate;
  const rec = legendaryRecord(run);
  if ((rec.placed[String(run.regionIndex)] ?? 0) >= cfg.perRegion) return;
  const rng = new Rng(hashSeed(`${run.seed}::legend-gate::${run.regionIndex}:${stage.index}`));
  if (!rng.chance(cfg.gateChance)) return;
  const pool = eligibleLegendary(content, run);
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && n.column > 1 && n.sides.length === 0);
  if (pool.length === 0 || candidates.length === 0) return;
  // Rarer events thin themselves out: a second roll against the picked event's own rarity.
  const def = rng.weighted(pool.map((p) => ({ item: p.def, weight: p.weight })));
  if (!rng.chance(Math.min(1, 0.4 + LEGEND_RARITY_FACTOR[def.legendary!.rarity]))) return;
  rng.pick(candidates).sides.push({ id: `legend-${stage.index}`, kind: 'expedition', expeditionId: def.id, used: false });
  rec.placed[String(run.regionIndex)] = (rec.placed[String(run.regionIndex)] ?? 0) + 1;
}

/** The environment in force for a fight on `layer`: the last entry that has started, or a roll from its pool. */
export function envAt(def: ExpeditionDef, layer: number, rng: Rng): { weather?: LegendaryEnv['weather']; terrain?: LegendaryEnv['terrain']; text: string } | null {
  const l = def.legendary;
  if (!l) return null;
  const started = l.env.filter((e) => e.fromLayer <= layer);
  const e = started[started.length - 1];
  if (!e) return null;
  if (e.pool.length > 0) {
    const p = rng.pick(e.pool);
    return { weather: p.weather, terrain: p.terrain, text: p.text };
  }
  return { weather: e.weather, terrain: e.terrain, text: e.text };
}

/** Puts the stage's weather and terrain on a fight that is about to start. Returns the line to show. */
export function applyBattleEnvironment(def: ExpeditionDef, battle: BattleState, layer: number, rng: Rng): string | null {
  const env = envAt(def, layer, rng);
  if (!env) return null;
  if (env.weather) battle.weather = { id: env.weather, turns: 999 };
  if (env.terrain) battle.terrain = { id: env.terrain, turns: 999 };
  return env.text;
}

/**
 * After a stop on `layer`: affinity heals, peril hurts, branches collapse and the way on may be rearranged.
 * Returns the lines for the expedition log.
 */
export function afterStop(content: Content, run: RunState, exp: ExpeditionState, def: ExpeditionDef, layer: number): string[] {
  const l = def.legendary;
  if (!l) return [];
  const out: string[] = [];
  const typesOf = (id: string) => content.species.get(id)?.types ?? [];
  if (l.affinity) {
    let healed = false;
    for (const m of run.party) {
      if (m.hp <= 0 || !typesOf(m.speciesId).some((t) => l.affinity!.types.includes(t))) continue;
      const max = maxHp(content, m);
      if (m.hp < max) healed = true;
      m.hp = Math.min(max, m.hp + Math.ceil(max * l.affinity.heal));
    }
    if (healed) out.push(l.affinity.text);
  }
  if (l.peril) {
    let hurt = false;
    for (const m of run.party) {
      if (m.hp <= 1 || !typesOf(m.speciesId).some((t) => l.peril!.types.includes(t))) continue;
      m.hp = Math.max(1, m.hp - Math.ceil(maxHp(content, m) * l.peril.chip));
      hurt = true;
    }
    if (hurt) out.push(l.peril.text);
  }
  const rng = new Rng(hashSeed(`${run.seed}::legend-route::${exp.id}:${layer}`));
  // The open stops of the next layer are read fresh each time: a collapse must not be undone by a rearrangement.
  const open = () => exp.nodes.filter((n) => n.layer === layer + 1 && !n.blocked);
  for (const c of l.closes.filter((x) => x.afterLayer === layer)) {
    if (collapseOne(exp, layer, open(), rng)) out.push(c.text);
  }
  for (const d of l.distort.filter((x) => x.afterLayer === layer)) {
    if (rearrange(exp, layer, open(), rng)) out.push(d.text);
  }
  return out;
}

/** Closes one stop of the next layer when another stays open; sources that led only there are re-pointed. */
function collapseOne(exp: ExpeditionState, layer: number, next: ExpeditionState['nodes'], rng: Rng): boolean {
  if (next.length < 2) return false;
  const victim = rng.pick(next);
  const keep = next.find((n) => n.id !== victim.id)!;
  victim.blocked = true;
  for (const n of exp.nodes.filter((x) => x.layer === layer)) {
    n.next = n.next.filter((id) => id !== victim.id);
    if (n.next.length === 0) n.next = [keep.id];
  }
  return true;
}

/** Re-points the way on from the stop just finished: 1 or 2 seeded stops of the next layer (every stop of it stays reachable from some node). */
function rearrange(exp: ExpeditionState, layer: number, next: ExpeditionState['nodes'], rng: Rng): boolean {
  if (next.length < 2) return false;
  const here = exp.nodes.find((n) => n.id === exp.current);
  if (!here || here.layer !== layer) return false;
  const shuffled = rng.shuffle([...next]);
  here.next = shuffled.slice(0, rng.int(1, 2)).map((n) => n.id).sort();
  return true;
}

/** Lines for the stage screen: what the environment does now. */
export function stageRules(def: ExpeditionDef, layer: number): string[] {
  const l = def.legendary;
  if (!l) return [];
  const started = l.env.filter((e) => e.fromLayer <= layer);
  const e = started[started.length - 1];
  const out = e ? [e.pool.length > 0 ? `${e.text} (it shifts from fight to fight)` : e.text] : [];
  if (l.affinity) out.push(`${l.affinity.types.join('/')}: ${l.affinity.text}`);
  if (l.peril) out.push(`${l.peril.types.join('/')}: ${l.peril.text}`);
  return out;
}

export function recordOutcome(run: RunState, def: ExpeditionDef, outcome: 'completed' | 'failed' | 'extracted'): void {
  const rec = legendaryRecord(run);
  const list = outcome === 'completed' ? rec.completed : outcome === 'failed' ? rec.failed : rec.extracted;
  if (!list.includes(def.id)) list.push(def.id);
  rec.outcomes.push({ id: def.id, outcome, region: run.regionIndex, stage: run.stage?.index ?? 0 });
}
