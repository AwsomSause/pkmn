// Presentation cues for Legendary world events (pure, no Phaser): which particle effect, colours and title cards a
// stage uses. Everything derives from the event's data (environment, visual block, species type), never from RNG.

import type { Content } from '../contentSchema';
import type { ExpeditionDef } from '../expedition/schema';
import type { LegendShape } from '../presentation/legendAnims';

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
  /** Shown when the stage ends after the finale fight. */
  won: { title: string; sub: string };
  lost: { title: string; sub: string };
}

/** Title cards: one when the stage opens, one before the finale. */
export function legendCards(content: Content, def: ExpeditionDef): LegendCards | null {
  const l = def.legendary;
  if (!l) return null;
  const name = (content.species.get(l.species)?.name ?? l.species).toUpperCase();
  return { intro: { title: 'LEGENDARY EVENT', sub: l.epithet }, finale: { title: `${name} AWAKENS`, sub: l.epithet }, won: { title: `${name} YIELDS`, sub: 'The omen fades. The stage is yours.' }, lost: { title: `${name} PREVAILS`, sub: 'The omen passes. It will not return.' } };
}

/** Each hand-designed event has its own signature flourish and battleback; the rest follow their type. */
const SIGNATURE: Record<string, { shape: LegendShape; arena: string }> = {
  kyogre: { shape: 'wave', arena: 'underwater' }, groudon: { shape: 'stone', arena: 'rocky' }, rayquaza: { shape: 'gale', arena: 'field_eve' },
  giratina: { shape: 'warp', arena: 'distortion' }, dialga: { shape: 'steel', arena: 'indoor3' }, palkia: { shape: 'warp', arena: 'water_night' },
  lugia: { shape: 'wave', arena: 'water' }, 'ho-oh': { shape: 'light', arena: 'rocky_eve' }, mewtwo: { shape: 'dream', arena: 'cave3' },
  articuno: { shape: 'frost', arena: 'snow' }, zapdos: { shape: 'bolt', arena: 'city_night' }, moltres: { shape: 'flame', arena: 'rocky_night' },
  raikou: { shape: 'bolt', arena: 'field_night' }, entei: { shape: 'flame', arena: 'rocky_eve' }, suicune: { shape: 'wave', arena: 'water_eve' },
  latias: { shape: 'dream', arena: 'field_eve' }, latios: { shape: 'gale', arena: 'field' }, regirock: { shape: 'stone', arena: 'cave1' },
  regice: { shape: 'frost', arena: 'snow_night' }, registeel: { shape: 'steel', arena: 'indoor2' }, heatran: { shape: 'flame', arena: 'cave2' },
  cresselia: { shape: 'dream', arena: 'field_night' }, darkrai: { shape: 'shadow', arena: 'forest_night' }, arceus: { shape: 'light', arena: 'champion2' },
  reshiram: { shape: 'flame', arena: 'champion1' }, zekrom: { shape: 'bolt', arena: 'city_night' }, celebi: { shape: 'leaf', arena: 'forest' },
};
const TYPE_LOOK: Record<string, { shape: LegendShape; arena: string }> = {
  water: { shape: 'wave', arena: 'water' }, fire: { shape: 'flame', arena: 'rocky_eve' }, electric: { shape: 'bolt', arena: 'city_night' }, ice: { shape: 'frost', arena: 'snow' },
  grass: { shape: 'leaf', arena: 'forest' }, rock: { shape: 'stone', arena: 'rocky' }, ground: { shape: 'stone', arena: 'rocky' }, steel: { shape: 'steel', arena: 'indoor2' },
  ghost: { shape: 'shadow', arena: 'forest_night' }, dark: { shape: 'shadow', arena: 'city_night' }, psychic: { shape: 'dream', arena: 'cave3' }, flying: { shape: 'gale', arena: 'field' },
  dragon: { shape: 'gale', arena: 'cave2' }, fairy: { shape: 'light', arena: 'forest_eve' }, poison: { shape: 'shadow', arena: 'cave1' }, fighting: { shape: 'stone', arena: 'indoor1' },
  bug: { shape: 'leaf', arena: 'forest' }, normal: { shape: 'light', arena: 'field' },
};

/** The event's own signature flourish and battleback (a UIE arena name from assets/catalog UIE_ARENAS). */
export function legendLook(content: Content, def: ExpeditionDef): { shape: LegendShape; arena: string } | null {
  const l = def.legendary;
  if (!l) return null;
  return SIGNATURE[l.species] ?? TYPE_LOOK[content.species.get(l.species)?.types[0] ?? 'normal'] ?? TYPE_LOOK.normal!;
}
