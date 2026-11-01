// What makes each Legendary event feel different beyond its rules: an authored route layout and its own music.
// Both are pure functions of the species (never of the gameplay RNG), so the same event always looks and sounds the same.

import { ambienceFor, type AmbienceId } from '../presentation/musicLayers';
import { expeditionTrack } from '../presentation/battleMusic';
import type { Content } from '../contentSchema';
import type { ExpeditionDef } from '../expedition/schema';

export interface LegendLayout {
  id: string;
  /** Nodes per layer, start to finale. */
  sizes: number[];
  /** Chance a stop also links to a second stop of the next layer (higher = more ways around). */
  cross: number;
}

export const LEGEND_LAYOUTS: readonly LegendLayout[] = [
  { id: 'braid', sizes: [1, 2, 2, 2, 1], cross: 0.65 },
  { id: 'funnel', sizes: [1, 2, 2, 1, 1], cross: 0.35 },
  { id: 'hourglass', sizes: [1, 2, 1, 2, 1], cross: 0.3 },
  { id: 'gauntlet', sizes: [1, 1, 1, 1, 1, 1], cross: 0 },
  { id: 'delta', sizes: [1, 1, 2, 2, 1], cross: 0.5 },
  { id: 'spine', sizes: [1, 2, 1, 1, 2, 1], cross: 0.25 },
  { id: 'long-fork', sizes: [1, 1, 2, 1, 1, 1], cross: 0.2 },
  { id: 'twin', sizes: [1, 2, 2, 1], cross: 0.45 },
];

const byId = (id: string): LegendLayout => LEGEND_LAYOUTS.find((l) => l.id === id)!;

/** Hand-picked layouts that suit the legend (a flood braids, a ruined path is a single gauntlet, a distortion rearranges). */
const AUTHORED: Record<string, string> = {
  kyogre: 'braid', groudon: 'funnel', rayquaza: 'spine', giratina: 'hourglass', dialga: 'gauntlet', palkia: 'delta',
  lugia: 'long-fork', 'ho-oh': 'funnel', mewtwo: 'hourglass', articuno: 'twin', zapdos: 'braid', moltres: 'delta',
  raikou: 'delta', entei: 'funnel', suicune: 'braid', latias: 'twin', latios: 'twin', regirock: 'gauntlet', regice: 'gauntlet',
  registeel: 'gauntlet', heatran: 'spine', cresselia: 'long-fork', darkrai: 'hourglass', arceus: 'braid', reshiram: 'funnel',
  zekrom: 'delta', celebi: 'spine',
};

const hashOf = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
};

/** The route layout of a Legendary event (null for ordinary expeditions). */
export function legendLayout(def: ExpeditionDef): LegendLayout | null {
  const l = def.legendary;
  if (!l) return null;
  const pick = byId(AUTHORED[l.species] ?? LEGEND_LAYOUTS[hashOf(`layout:${l.species}`) % LEGEND_LAYOUTS.length]!.id);
  const total = pick.sizes.reduce((a, b) => a + b, 0);
  return total >= def.nodes.min && total <= def.nodes.max ? pick : null;
}

// ---- Music ----

const ROUTE_TRACKS = ['bgm.raid.adventure.basic', 'bgm.raid.adventure.ultra', 'bgm.raid.adventure.max', 'bgm.raid.adventure.tera', 'bgm.raid.basic', 'bgm.raid.basic2', 'bgm.raid.ultra'] as const;
const FIGHT_TRACKS = ['bgm.raid.ultra', 'bgm.raid.ultra2', 'bgm.raid.ultra3', 'bgm.raid.max', 'bgm.raid.max2', 'bgm.raid.max3', 'bgm.raid.tera', 'bgm.raid.tera2', 'bgm.raid.tera3'] as const;
export const LEGEND_TRACK_IDS: readonly string[] = [...new Set([...ROUTE_TRACKS, ...FIGHT_TRACKS])];

export interface LegendMusic {
  /** Song for the route screens. */
  route: string;
  /** Song for the event's fights. */
  fight: string;
  /** Key of the synth layers, in semitones (-5..+6). */
  key: number;
  /** Synth ambience bed under the song. */
  ambience: AmbienceId;
}

/** Each event's own song pair, key and ambience: a music variation made from existing tracks and the synth layers. */
export function legendMusic(content: Content, def: ExpeditionDef): LegendMusic | null {
  const l = def.legendary;
  if (!l) return null;
  const h = hashOf(`music:${l.species}`);
  const type = content.species.get(l.species)?.types[0];
  const route = l.music ?? ROUTE_TRACKS[h % ROUTE_TRACKS.length] ?? expeditionTrack(def.tier);
  return {
    route,
    fight: FIGHT_TRACKS[Math.floor(h / 7) % FIGHT_TRACKS.length]!,
    key: (Math.floor(h / 63) % 12) - 5,
    ambience: ambienceFor(type),
  };
}
