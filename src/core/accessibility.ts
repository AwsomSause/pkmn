// Accessibility profiles (catalog #162, #124): presets that set several settings at once.
// Pure. Outcomes never depend on any of these settings.

import type { Settings } from './state';
import { capFlash } from './presentation/uiPrefs';
import type { AnimSettings } from './presentation/animRegistry';

export type AccessibilityProfile = Settings['accessibilityProfile'];

export const PROFILE_ORDER: AccessibilityProfile[] = ['custom', 'reducedMotion', 'lowFlash', 'moreDetail', 'fastBattles'];

export const PROFILE_INFO: Record<AccessibilityProfile, { label: string; blurb: string }> = {
  custom: { label: 'Custom', blurb: 'Your own mix of settings.' },
  reducedMotion: { label: 'Reduced Motion', blurb: 'No shaking, flashing or big movement; trainers talk a little less.' },
  lowFlash: { label: 'Low Flash', blurb: 'Keeps the animations but turns flashes and shakes down to 25%.' },
  moreDetail: { label: 'More Combat Detail', blurb: 'Shows why each hit did what it did, and trainers talk more.' },
  fastBattles: { label: 'Fast Battles', blurb: 'Quick battle speed, lighter effects, less talk.' },
};

const PRESETS: Record<Exclude<AccessibilityProfile, 'custom'>, Partial<Settings>> = {
  reducedMotion: { battleAnimations: 'reduced', effectIntensity: 0.25, shakeIntensity: 0.25, reduceParticles: true, dialogueFrequency: 'low' },
  lowFlash: { battleAnimations: 'full', effectIntensity: 0.25, shakeIntensity: 0.25 },
  moreDetail: { damageDetails: true, dialogueFrequency: 'high' },
  fastBattles: { battleSpeed: 'quick', effectIntensity: 0.5, shakeIntensity: 0.5, dialogueFrequency: 'low' },
};

export function applyProfile(settings: Settings, profile: AccessibilityProfile): Settings {
  if (profile === 'custom') return { ...settings, accessibilityProfile: 'custom' };
  return { ...settings, ...PRESETS[profile], accessibilityProfile: profile };
}

export function nextProfile(current: AccessibilityProfile): AccessibilityProfile {
  return PROFILE_ORDER[(PROFILE_ORDER.indexOf(current) + 1) % PROFILE_ORDER.length]!;
}

export const ANIMATION_KEYS = ['abilityAnimations', 'battleTextAnimations', 'interactionAnimations', 'hyperAnimations', 'rivalAnimations', 'evolutionAnimations', 'battleScreenEffects', 'menuAnimations'] as const;
export type AnimationKey = (typeof ANIMATION_KEYS)[number];

/** Which animation groups play: `disableAllAnimations` turns every one off but never changes the saved individual switches. */
export function animationFlags(s: Settings): Record<AnimationKey, boolean> {
  const out = {} as Record<AnimationKey, boolean>;
  for (const k of ANIMATION_KEYS) out[k] = !s.disableAllAnimations && s[k];
  return out;
}

/** Duration multiplier for animations: slow 1.5×, normal 1×, fast 0.6×. Presentation only. */
export function animationTimeScale(s: Settings): number {
  return { slow: 1.5, normal: 1, fast: 0.6 }[s.animationSpeed];
}

/** Strength multiplier for animation effects: reduced 0.5×, normal 1×, enhanced 1.4×. Presentation only. */
export function animationStrength(s: Settings): number {
  return { reduced: 0.5, normal: 1, enhanced: 1.4 }[s.animationIntensity];
}

/** What the animation registry needs from the settings: every animation reads them this one way. */
export function animSettingsFrom(s: Settings): AnimSettings {
  const flags = animationFlags(s);
  return {
    mode: s.battleAnimations,
    intensity: capFlash(s.effectIntensity, s.reducedFlash),
    shake: capFlash(s.shakeIntensity, s.reducedFlash),
    reduceParticles: s.reduceParticles,
    enabled: { ability: flags.abilityAnimations, text: flags.battleTextAnimations, interaction: flags.interactionAnimations, overdrive: flags.hyperAnimations, rival: flags.rivalAnimations, ui: flags.menuAnimations },
    timeScale: animationTimeScale(s),
    strength: animationStrength(s),
  };
}
