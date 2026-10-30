// Accessibility profiles (catalog #162, #124): presets that set several settings at once.
// Pure. Outcomes never depend on any of these settings.

import type { Settings } from './state';

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
  reducedMotion: { battleAnimations: 'reduced', effectIntensity: 0.25, dialogueFrequency: 'low' },
  lowFlash: { battleAnimations: 'full', effectIntensity: 0.25 },
  moreDetail: { damageDetails: true, dialogueFrequency: 'high' },
  fastBattles: { battleSpeed: 'quick', effectIntensity: 0.5, dialogueFrequency: 'low' },
};

export function applyProfile(settings: Settings, profile: AccessibilityProfile): Settings {
  if (profile === 'custom') return { ...settings, accessibilityProfile: 'custom' };
  return { ...settings, ...PRESETS[profile], accessibilityProfile: profile };
}

export function nextProfile(current: AccessibilityProfile): AccessibilityProfile {
  return PROFILE_ORDER[(PROFILE_ORDER.indexOf(current) + 1) % PROFILE_ORDER.length]!;
}
