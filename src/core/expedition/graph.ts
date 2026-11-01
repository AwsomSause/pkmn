// Expedition route generation: a layered directed graph with a single start layer and a single finale.
// Every node is reachable, every non-final node has a way forward, and the same seed gives the same route.

import { Rng } from '../rng';
import { legendLayout } from '../legendary/identity';
import type { ExpeditionDef, ExpeditionNodeKind } from './schema';

export interface RouteNode {
  id: string;
  layer: number;
  kind: ExpeditionNodeKind;
  next: string[];
  done: boolean;
  /** Collapsed by a Legendary event: no longer reachable. */
  blocked?: boolean;
}

const COMBAT: ExpeditionNodeKind[] = ['wild', 'trainer', 'elite', 'totem'];
const RESOURCE: ExpeditionNodeKind[] = ['rest', 'cache', 'research', 'megaEnergy', 'mystery', 'recruit'];

/** Layer sizes: 1 (start), 1–2 per middle layer, 1 (finale); the total is within the def's node range. */
export function layerSizes(def: ExpeditionDef, rng: Rng): number[] {
  // A Legendary event has an authored layout of its own.
  const authored = legendLayout(def);
  if (authored) return [...authored.sizes];
  for (let tries = 0; tries < 50; tries++) {
    const middle = rng.int(2, 5);
    const sizes = [1, ...Array.from({ length: middle }, () => rng.int(1, 2)), 1];
    const total = sizes.reduce((a, b) => a + b, 0);
    if (total >= def.nodes.min && total <= def.nodes.max) return sizes;
  }
  return [1, 2, 2, 2, 1];
}

export function generateRoute(def: ExpeditionDef, rng: Rng): RouteNode[] {
  const sizes = layerSizes(def, rng);
  const cross = legendLayout(def)?.cross ?? 0.4;
  const layers: RouteNode[][] = sizes.map((size, layer) =>
    Array.from({ length: size }, (_, i) => ({ id: `n${layer}-${i}`, layer, kind: 'wild' as ExpeditionNodeKind, next: [] as string[], done: false })),
  );
  // Edges: every node reaches at least one node of the next layer, and every node of the next layer is reached.
  for (let l = 0; l < layers.length - 1; l++) {
    const from = layers[l]!;
    const to = layers[l + 1]!;
    const reached = new Set<number>();
    from.forEach((node, i) => {
      const j = Math.min(to.length - 1, from.length === to.length ? i : rng.int(0, to.length - 1));
      node.next.push(to[j]!.id);
      reached.add(j);
      if (to.length > 1 && rng.chance(cross)) {
        const k = rng.int(0, to.length - 1);
        if (!node.next.includes(to[k]!.id)) {
          node.next.push(to[k]!.id);
          reached.add(k);
        }
      }
    });
    to.forEach((t, j) => {
      if (!reached.has(j)) from[rng.int(0, from.length - 1)]!.next.push(t.id);
    });
    for (const n of from) n.next.sort();
  }
  // Kinds: the start is a fight, the finale is the finale, the middle follows the weights; a two-node layer offers
  // a combat route and a resource route (the "combat route / resource route" choice of the briefing).
  const weight = (k: ExpeditionNodeKind, boost: ExpeditionNodeKind[]) => (def.nodeWeights[k] ?? 0) * (boost.includes(k) ? 3 : 1);
  const pick = (boost: ExpeditionNodeKind[]): ExpeditionNodeKind => {
    const options = [...COMBAT, ...RESOURCE].filter((k) => weight(k, boost) > 0).map((k) => ({ item: k, weight: weight(k, boost) }));
    return rng.weighted(options);
  };
  layers[0]![0]!.kind = 'wild';
  layers[layers.length - 1]![0]!.kind = 'finale';
  for (let l = 1; l < layers.length - 1; l++) {
    layers[l]!.forEach((node, i) => {
      node.kind = layers[l]!.length === 2 ? pick(i === 0 ? COMBAT : RESOURCE) : pick([]);
    });
  }
  // A rest stop somewhere before the finale (the attrition check needs a chance to recover).
  const middle = layers.slice(1, -1).flat();
  if (middle.length > 0 && !middle.some((n) => n.kind === 'rest')) middle[rng.int(0, middle.length - 1)]!.kind = 'rest';
  return layers.flat();
}

/** Problems that make a route invalid (empty = fine). */
export function validateRoute(def: ExpeditionDef, nodes: RouteNode[]): string[] {
  const problems: string[] = [];
  if (nodes.length < def.nodes.min || nodes.length > def.nodes.max) problems.push(`has ${nodes.length} nodes`);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const last = Math.max(...nodes.map((n) => n.layer));
  const finale = nodes.filter((n) => n.kind === 'finale');
  if (finale.length !== 1 || finale[0]!.layer !== last) problems.push('needs exactly one finale on the last layer');
  const start = nodes.filter((n) => n.layer === 0);
  const reached = new Set<string>();
  const queue = start.map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const nx of byId.get(id)?.next ?? []) queue.push(nx);
  }
  for (const n of nodes) {
    if (!reached.has(n.id)) problems.push(`${n.id} is unreachable`);
    if (n.layer < last && n.next.length === 0) problems.push(`${n.id} is a dead end`);
    for (const nx of n.next) if (byId.get(nx)?.layer !== n.layer + 1) problems.push(`${n.id} links to a wrong layer`);
  }
  return problems;
}
