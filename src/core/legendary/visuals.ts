// Presentation cues for Legendary world events (pure, no Phaser): which particle effect, colours and title cards a
// stage uses. Everything derives from the event's data (environment, visual block, species type), never from RNG.

import type { Content } from '../contentSchema';
import type { ExpeditionDef } from '../expedition/schema';

export const LEGEND_PARTICLES = ['rain', 'embers', 'snow', 'sand', 'sparks', 'mist', 'wind', 'motes'] as const;
export type LegendParticle = (typeof LEGEND_PARTICLES)[number];

export interface LegendKit {
  particle: LegendParticle;
  /** 0xRRGGBB values. */
  tint: number;
  accent: number;
  /** How many particles (the scene scales this down for reduced motion). */
  count: number;
  /** Opacity of the colour wash over the scene. */
  wash: number;
}

const hex = (s: string): number => Number.parseInt(s.slice(1), 16);

const WEATHER_PARTICLE: Record<string, LegendParticle> = { rain: 'rain', sun: 'embers', sand: 'sand', snow: 'snow', hail: 'snow' };
const TERRAIN_PARTICLE: Record<string, LegendParticle> = { electric: 'sparks', misty: 'mist', psychic: 'motes', grassy: 'motes' };
const TYPE_PARTICLE: Record<string, LegendParticle> = { flying: 'wind', dragon: 'wind', fire: 'embers', water: 'rain', ice: 'snow', ground: 'sand', electric: 'sparks', ghost: 'mist', dark: 'mist', fairy: 'mist' };

/** The look of a stage at a route layer (the weather of that layer picks the particles; the rest falls back to terrain, then type). */
export function legendKit(content: Content, def: ExpeditionDef, layer: number): LegendKit | null {
  const l = def.legendary;
  if (!l) return null;
  const started = l.env.filter((e) => e.fromLayer <= layer);
  const env = started[started.length - 1];
  const first = env?.pool[0];
  const weather = env?.weather ?? first?.weather;
  const terrain = env?.terrain ?? first?.terrain;
  const type = content.species.get(l.species)?.types[0] ?? 'normal';
  const particle = (weather && WEATHER_PARTICLE[weather]) || (terrain && TERRAIN_PARTICLE[terrain]) || TYPE_PARTICLE[type] || 'motes';
  const heavy = l.rarity === 'veryRare';
  return { particle, tint: hex(l.visual.tint), accent: hex(l.visual.accent), count: heavy ? 46 : 32, wash: heavy ? 0.34 : 0.26 };
}

export interface LegendCards {
  intro: { title: string; sub: string };
  finale: { title: string; sub: string };
}

/** Title cards: one when the stage opens, one before the finale. */
export function legendCards(content: Content, def: ExpeditionDef): LegendCards | null {
  const l = def.legendary;
  if (!l) return null;
  const name = (content.species.get(l.species)?.name ?? l.species).toUpperCase();
  return { intro: { title: 'LEGENDARY EVENT', sub: l.epithet }, finale: { title: `${name} AWAKENS`, sub: l.epithet } };
}
