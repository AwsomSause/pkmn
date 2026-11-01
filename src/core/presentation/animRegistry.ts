// The central animation registry: every named presentation animation (ability
// banners, battle text, interaction/rival/Overdrive effects added later) is
// registered here with its category, length and fallbacks. One resolver turns
// the player's settings into "how to play it", so every animation honours
// motion, intensity, shake and particle settings the same way.
//
// Pure data and maths: no Phaser, no random numbers, so previews and hovers
// can't disturb gameplay and the same inputs always give the same plan.

export type AnimCategory = 'ability' | 'text' | 'interaction' | 'overdrive' | 'rival' | 'ui' | 'legend';

export interface AnimDef {
  /** Unique, dotted: 'ability.weather', 'text.crit' … */
  id: string;
  category: AnimCategory;
  /** Full-motion length in ms (the reduced version is shorter). */
  ms: number;
  /** Default accent colour; callers can override with a type colour. */
  color: string;
  /** Small icon character shown with the animation. */
  glyph?: string;
  /** When it plays, in words or the event type ('ability event', 'stat event' …); what the cue planner matches on. */
  trigger?: string;
  /** Sound effect id (assets catalog), played with the animation unless muted. */
  sound?: string;
  /** Text shown with it, when the cue doesn't supply its own. */
  text?: string;
  /** What plays instead when the animation can't (reduced mode or a missing file): another registered id. Default: the calm fade. */
  fallback?: string;
  /** Moves the screen (shake/zoom): scaled by the shake setting. */
  shakes?: boolean;
  /** Flashes the screen: scaled by the effect-intensity setting. */
  flashes?: boolean;
  /** Spawns particles: dropped when Reduced Particles is on. */
  particles?: boolean;
}

export interface AnimSettings {
  /** full: everything; reduced: static/fading stand-in; off: nothing. */
  mode: 'full' | 'reduced' | 'off';
  /** 0–1 flash/effect strength. */
  intensity: number;
  /** 0–1 shake strength; defaults to `intensity`. */
  shake?: number;
  reduceParticles?: boolean;
  /** Per-category switches (settings 6.6); a category set to false does not play. */
  enabled?: Partial<Record<AnimCategory, boolean>>;
  /** Duration multiplier (animation speed setting); default 1. */
  timeScale?: number;
  /** Strength multiplier (animation intensity setting); default 1. Scales flash and shake, capped at 1. */
  strength?: number;
}

export interface AnimPlan {
  id: string;
  /** False when animations are off: show the text/state change only. */
  play: boolean;
  /** True for the calm stand-in (fade only, no movement). */
  reduced: boolean;
  ms: number;
  color: string;
  glyph: string;
  sound: string | null;
  text: string;
  fallback: string | null;
  /** 0–1 multipliers the player already chose. */
  flash: number;
  shake: number;
  particles: boolean;
}

const defs = new Map<string, AnimDef>();

export function registerAnim(def: AnimDef): AnimDef {
  if (defs.has(def.id)) throw new Error(`Animation already registered: ${def.id}`);
  defs.set(def.id, def);
  return def;
}

export const registerAnims = (list: readonly AnimDef[]): void => list.forEach(registerAnim);
export const getAnim = (id: string): AnimDef | undefined => defs.get(id);
export const animsIn = (category: AnimCategory): AnimDef[] => [...defs.values()].filter((d) => d.category === category);
export const allAnims = (): AnimDef[] => [...defs.values()];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Turns a registered animation plus the player's settings into a playable plan; unknown ids don't play. */
export function resolveAnim(id: string, settings: AnimSettings): AnimPlan | null {
  const def = defs.get(id);
  if (!def) return null;
  const full = settings.mode === 'full';
  const strength = settings.strength ?? 1;
  const intensity = clamp01(settings.intensity * strength);
  const shake = clamp01((settings.shake ?? settings.intensity) * strength);
  const on = settings.mode !== 'off' && settings.enabled?.[def.category] !== false;
  return {
    id,
    play: on,
    reduced: !full,
    ms: Math.round(def.ms * (full ? 1 : 0.5) * (settings.timeScale ?? 1)),
    color: def.color,
    glyph: def.glyph ?? '',
    sound: on && full ? (def.sound ?? null) : null,
    text: def.text ?? '',
    fallback: def.fallback ?? null,
    flash: full && def.flashes ? intensity : 0,
    shake: full && def.shakes ? shake : 0,
    particles: full && !!def.particles && !settings.reduceParticles && intensity > 0,
  };
}
