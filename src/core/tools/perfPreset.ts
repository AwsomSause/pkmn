// F214: a performance preset (Low / Medium / High) that sets the particle and effect settings together.
// Presentation only: outcomes never depend on any of these settings. Pure.

import type { Settings } from '../state';

export type PerfPreset = Settings['performancePreset'];
export const PERF_ORDER: PerfPreset[] = ['high', 'medium', 'low'];

export const PERF_INFO: Record<PerfPreset, { label: string; blurb: string }> = {
  high: { label: 'High', blurb: 'Every effect and particle plays.' },
  medium: { label: 'Medium', blurb: 'Half-strength effects and shakes; particles stay.' },
  low: { label: 'Low', blurb: 'No particles, light effects, no sprite idle animation. For slow devices.' },
};

const PRESETS: Record<PerfPreset, Partial<Settings>> = {
  high: { reduceParticles: false, effectIntensity: 1, shakeIntensity: 1, spriteAnimations: true, cursorTrail: false },
  medium: { reduceParticles: false, effectIntensity: 0.5, shakeIntensity: 0.5, spriteAnimations: true, cursorTrail: false },
  low: { reduceParticles: true, effectIntensity: 0.25, shakeIntensity: 0.25, spriteAnimations: false, cursorTrail: false },
};

export function applyPerfPreset(s: Settings, preset: PerfPreset): Settings {
  return { ...s, ...PRESETS[preset], performancePreset: preset, accessibilityProfile: 'custom' };
}

export const nextPerfPreset = (p: PerfPreset): PerfPreset => PERF_ORDER[(PERF_ORDER.indexOf(p) + 1) % PERF_ORDER.length]!;
