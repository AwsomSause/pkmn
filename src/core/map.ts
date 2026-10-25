// Stage maps: a layered graph of numbered levels (GAME_DESIGN.md §5).
//
// A stage has `columns` columns (20). Each column holds 1–3 nodes and every
// path moves forward exactly one column at a time, so every route from the
// start to the gym passes through exactly 20 numbered nodes. Two columns are
// trainer columns (every node there is a trainer), so every route meets
// exactly two trainers. The last column is the gym leader. Healing stops and
// shops sit beside nodes and don't count as levels.

import type { Content } from './contentSchema';
import type { Rng } from './rng';
import type { MapNode, SideStop, StageMap, StageState } from './state';

const nodeId = (column: number, row: number) => `c${column}r${row}`;

/** Two edges cross when their order flips between the columns (a→b above c→d but b below d). */
function crosses(a: [number, number], b: [number, number]): boolean {
  return (a[0] < b[0] && a[1] > b[1]) || (a[0] > b[0] && a[1] < b[1]);
}

export function generateStageMap(content: Content, rng: Rng): StageMap {
  const cfg = content.balance.stage;
  const C = cfg.columns;

  // 1. Pick the trainer columns, one from each configured range.
  const trainerColumns: number[] = [];
  for (const [first, last] of cfg.trainerColumns) {
    let col = rng.int(first, last);
    while (trainerColumns.includes(col) && col < last) col += 1;
    if (!trainerColumns.includes(col)) trainerColumns.push(col);
  }

  // 2. Column widths and nodes.
  const widths: number[] = [];
  const nodes: MapNode[] = [];
  for (let col = 1; col <= C; col++) {
    const width = col === C ? 1 : rng.int(cfg.minWidth, cfg.maxWidth);
    widths[col] = width;
    const isTrainer = trainerColumns.includes(col);
    const columnNodes: MapNode[] = [];
    for (let row = 0; row < width; row++) {
      const kind = col === C ? 'gym' : isTrainer ? 'trainer' : 'wild';
      const harder = kind === 'wild' && width > 1 && rng.chance(cfg.harderChance);
      const note =
        kind === 'gym'
          ? `gym leader (last column)`
          : kind === 'trainer'
            ? `trainer column ${col} (one of ${trainerColumns.join(', ')})`
            : `wild, column ${col} of ${C}, width ${width}${harder ? `, harder (${Math.round(cfg.harderChance * 100)}% roll)` : ''}`;
      columnNodes.push({ id: nodeId(col, row), column: col, row, kind, harder, next: [], sides: [], note });
    }
    // Always leave at least one normal route through a column.
    if (columnNodes.length > 1 && columnNodes.every((n) => n.harder)) {
      columnNodes[0]!.harder = false;
      columnNodes[0]!.note += ' (made normal so the column has an easier route)';
    }
    nodes.push(...columnNodes);
  }

  // 3. Edges between neighbouring columns: an even, non-crossing spread so
  //    every node has a way forward and every node can be reached, plus a few
  //    extra non-crossing links for more forks.
  const byCol = (col: number) => nodes.filter((n) => n.column === col);
  for (let col = 1; col < C; col++) {
    const from = byCol(col);
    const to = byCol(col + 1);
    const n = from.length;
    const m = to.length;
    const edges: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const lo = Math.floor((i * m) / n);
      const hi = Math.ceil(((i + 1) * m) / n) - 1;
      for (let j = lo; j <= hi; j++) edges.push([i, j]);
    }
    for (let i = 0; i < n; i++) {
      if (!rng.chance(cfg.extraEdgeChance)) continue;
      const targets = edges.filter((e) => e[0] === i).map((e) => e[1]);
      const candidates = [Math.min(...targets) - 1, Math.max(...targets) + 1].filter((j) => j >= 0 && j < m);
      if (candidates.length === 0) continue;
      const j = rng.pick(candidates);
      if (!edges.some((e) => crosses(e, [i, j]))) edges.push([i, j]);
    }
    for (const [i, j] of edges) from[i]!.next.push(to[j]!.id);
    for (const node of from) node.next.sort();
  }

  // 4. Side stops (healing and shops).
  let sideCount = 0;
  const totalWeight = cfg.sideWeights.heal + cfg.sideWeights.shop;
  for (const node of nodes) {
    if (node.column === C) continue;
    let kind: SideStop['kind'] | null = null;
    if (cfg.healBeforeGym && node.column === C - 1) kind = 'heal';
    else if (totalWeight > 0 && rng.chance(cfg.sideChance)) {
      kind = rng.weighted([
        { item: 'heal' as const, weight: cfg.sideWeights.heal },
        { item: 'shop' as const, weight: cfg.sideWeights.shop },
      ]);
    }
    if (kind) node.sides.push({ id: `s${++sideCount}`, kind, used: false });
  }

  return { columns: C, nodes, trainerColumns: [...trainerColumns].sort((a, b) => a - b) };
}

/** Lists everything wrong with a map (empty when it's valid). */
export function validateStageMap(map: StageMap): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const n of map.nodes) {
    if (ids.has(n.id)) problems.push(`duplicate node id ${n.id}`);
    ids.add(n.id);
  }
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  for (let col = 1; col <= map.columns; col++) {
    const nodes = map.nodes.filter((n) => n.column === col);
    if (nodes.length === 0) problems.push(`column ${col} is empty`);
    const isTrainerCol = map.trainerColumns.includes(col);
    for (const n of nodes) {
      if (col === map.columns && n.kind !== 'gym') problems.push(`last column node ${n.id} is not the gym`);
      if (col !== map.columns && n.kind === 'gym') problems.push(`gym ${n.id} is not in the last column`);
      if (col !== map.columns && isTrainerCol !== (n.kind === 'trainer')) problems.push(`node ${n.id} kind ${n.kind} doesn't match trainer columns`);
      if (col < map.columns && n.next.length === 0) problems.push(`node ${n.id} is a dead end`);
      for (const id of n.next) {
        const target = byId.get(id);
        if (!target) problems.push(`node ${n.id} leads to missing node ${id}`);
        else if (target.column !== col + 1) problems.push(`node ${n.id} skips or goes back to column ${target.column}`);
      }
      if (col > 1 && !map.nodes.some((p) => p.next.includes(n.id))) problems.push(`node ${n.id} can't be reached`);
    }
    if (col === map.columns && nodes.length !== 1) problems.push(`last column has ${nodes.length} nodes (needs exactly 1)`);
  }
  if (map.trainerColumns.length !== 2) problems.push(`expected 2 trainer columns, found ${map.trainerColumns.length}`);
  // No crossing lines between neighbouring columns (keeps the map readable).
  for (let col = 1; col < map.columns; col++) {
    const from = map.nodes.filter((n) => n.column === col);
    const edges: [number, number][] = from.flatMap((n) => n.next.map((id) => [n.row, byId.get(id)?.row ?? 0] as [number, number]));
    for (let a = 0; a < edges.length; a++) for (let b = a + 1; b < edges.length; b++) if (crosses(edges[a]!, edges[b]!)) problems.push(`lines cross between columns ${col} and ${col + 1}`);
  }
  return [...new Set(problems)];
}

export function findNode(map: StageMap, id: string): MapNode {
  const node = map.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`No map node "${id}"`);
  return node;
}

/** The nodes the player may move to next. */
export function nextChoices(stage: StageState): MapNode[] {
  if (stage.current === null) return stage.map.nodes.filter((n) => n.column === 1);
  const current = findNode(stage.map, stage.current);
  return current.next.map((id) => findNode(stage.map, id));
}

/** The column the player is on (0 before the first node). */
export function currentColumn(stage: StageState): number {
  return stage.current === null ? 0 : findNode(stage.map, stage.current).column;
}
