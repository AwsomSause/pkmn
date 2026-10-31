// The one list of player settings (spec section 7). The title screen and the Hub both build their Settings
// screen from this, so they can never drift apart. Pure data and functions; no Phaser.
// Settings live in their own save record (`settings`), never in run data, so every run and timeline shares them.

import { applyProfile, nextProfile, PROFILE_INFO } from './accessibility';
import type { Settings } from './state';

export type SettingCategory = 'display' | 'audio' | 'gameplay' | 'animations' | 'text' | 'accessibility' | 'data';

export const SETTING_CATEGORIES: { id: SettingCategory; label: string; blurb: string }[] = [
  { id: 'display', label: 'Display', blurb: 'Screen size, contrast and interface look.' },
  { id: 'audio', label: 'Audio', blurb: 'Sound, music and effect volume.' },
  { id: 'gameplay', label: 'Gameplay', blurb: 'Battle speed and battle preferences.' },
  { id: 'animations', label: 'Animations & Effects', blurb: 'Every animation, its speed and strength.' },
  { id: 'text', label: 'Text & Dialogue', blurb: 'Text speed, trainer talk and battle messages.' },
  { id: 'accessibility', label: 'Accessibility', blurb: 'Presets, reduced effects and readability.' },
  { id: 'data', label: 'Save & Data', blurb: 'Export, import and reset.' },
];

/** `now` applies at once; `nextBattle` waits for the next battle (a running battle is never disturbed); `restart` needs a reload. */
export type SettingApplies = 'now' | 'nextBattle' | 'restart';

export interface SettingDef {
  id: string;
  label: string;
  /** One short line shown under the setting. */
  description: string;
  category: SettingCategory;
  /** Also listed under these categories (Accessibility repeats a few). */
  also?: SettingCategory[];
  /** Grouped under "Advanced" at the bottom of its category. */
  advanced?: boolean;
  applies: SettingApplies;
  /** Shown greyed out (and not changeable) while this returns true. */
  disabled?: (s: Settings) => boolean;
  /** Current value as text. */
  show: (s: Settings) => string;
  /** The settings after one press (cycles to the next value). */
  next: (s: Settings) => Settings;
}

type Key = keyof Settings;

const custom = (s: Settings): Settings => ({ ...s, accessibilityProfile: 'custom' });
const pct = (v: number) => `${Math.round(v * 100)}%`;

function choice<K extends Key>(key: K, labels: Record<string & Settings[K], string>, order: readonly Settings[K][]): Pick<SettingDef, 'show' | 'next'> {
  return {
    show: (s) => labels[s[key] as string & Settings[K]],
    next: (s) => custom({ ...s, [key]: order[(order.indexOf(s[key]) + 1) % order.length]! }),
  };
}
function toggle(key: Key, on = 'On', off = 'Off'): Pick<SettingDef, 'show' | 'next'> {
  return { show: (s) => (s[key] ? on : off), next: (s) => custom({ ...s, [key]: !s[key] }) };
}
function level(key: Key, order: readonly number[], tol = 0.13): Pick<SettingDef, 'show' | 'next'> {
  return {
    show: (s) => pct(s[key] as number),
    next: (s) => {
      const i = order.findIndex((v) => Math.abs(v - (s[key] as number)) < tol);
      return custom({ ...s, [key]: order[(i + 1) % order.length]! });
    },
  };
}
const animOff = (s: Settings) => s.disableAllAnimations;

const ANIM_SWITCHES: [Key, string, string][] = [
  ['abilityAnimations', 'Ability animations', 'Short effects when an ability triggers.'],
  ['battleTextAnimations', 'Battle text animations', 'Highlights and emphasis on battle messages.'],
  ['interactionAnimations', 'Interaction animations', 'Catching, items, party changes and rewards.'],
  ['hyperAnimations', 'Hyper/Overdrive animations', 'The big presentation for rare story moments.'],
  ['rivalAnimations', 'Rival animations', 'Rival introductions, send-outs and poses.'],
  ['evolutionAnimations', 'Evolution animations', 'The evolution and Mega Evolution scenes.'],
  ['battleScreenEffects', 'Battle screen effects', 'Full-screen flashes, tints and impacts in battle.'],
];

export const SETTINGS: SettingDef[] = [
  // Display
  { id: 'uiScale', label: 'Screen size', description: 'How much of the window the game fills.', category: 'display', applies: 'now', ...choice('uiScale', { full: '100%', medium: '90%', small: '80%' }, ['full', 'medium', 'small']) },
  { id: 'highContrast', label: 'High contrast', description: 'Stronger contrast for the whole screen.', category: 'display', also: ['accessibility'], applies: 'now', ...toggle('highContrast') },
  { id: 'battleUi', label: 'Battle UI style', description: 'Aero Glass, Essentials Kit, or Kit with a long foe box.', category: 'display', applies: 'nextBattle', show: (s) => ({ aero: 'Aero Glass', kit: 'Essentials Kit', kitLong: 'Essentials Kit (long foe)' })[s.battleUi], next: (s) => ({ ...s, battleUi: ({ aero: 'kit', kit: 'kitLong', kitLong: 'aero' } as const)[s.battleUi] }) },
  { id: 'spriteAnimations', label: 'Sprite animations', description: 'Off keeps menu icons and idle Pokémon still.', category: 'display', applies: 'now', ...toggle('spriteAnimations') },
  { id: 'damageNumbers', label: 'Damage numbers', description: 'Floating numbers over the Pokémon that was hit.', category: 'display', applies: 'now', ...toggle('damageNumbers') },
  { id: 'catchDetail', label: 'Catch details', description: 'The catch screen: every stat and note, or a short summary.', category: 'display', applies: 'now', advanced: true, ...choice('catchDetail', { full: 'Full', compact: 'Compact' }, ['full', 'compact']) },
  // Audio
  { id: 'muted', label: 'Sound', description: 'Turns all music and effects on or off.', category: 'audio', applies: 'now', show: (s) => (s.muted ? 'Off' : 'On'), next: (s) => ({ ...s, muted: !s.muted }) },
  { id: 'musicVolume', label: 'Music volume', description: 'How loud the music is.', category: 'audio', applies: 'now', ...level('musicVolume', [1, 0.75, 0.5, 0.25, 0]) },
  { id: 'sfxVolume', label: 'Effects volume', description: 'How loud sound effects and cries are.', category: 'audio', applies: 'now', ...level('sfxVolume', [1, 0.75, 0.5, 0.25, 0]) },
  // Gameplay
  { id: 'battleSpeed', label: 'Battle speed', description: 'How fast battles play. Outcomes never change.', category: 'gameplay', applies: 'now', ...choice('battleSpeed', { showcase: 'Showcase', normal: 'Normal', fast: 'Fast', quick: 'Quick' }, ['normal', 'fast', 'quick', 'showcase']) },
  { id: 'damageDetails', label: 'Damage details', description: 'Explains each hit: effectiveness, STAB and crits.', category: 'gameplay', also: ['accessibility'], applies: 'now', ...toggle('damageDetails') },
  // Animations & Effects
  { id: 'disableAllAnimations', label: 'Disable all animations', description: 'Turns every animation off. Your other choices are remembered.', category: 'animations', also: ['accessibility'], applies: 'now', show: (s) => (s.disableAllAnimations ? 'On' : 'Off'), next: (s) => custom({ ...s, disableAllAnimations: !s.disableAllAnimations }) },
  { id: 'battleAnimations', label: 'Battle motion', description: 'Full, reduced (no flashing or big movement) or skipped.', category: 'animations', also: ['accessibility'], applies: 'now', disabled: animOff, ...choice('battleAnimations', { full: 'Full', reduced: 'Reduced motion', off: 'Off' }, ['full', 'reduced', 'off']) },
  ...ANIM_SWITCHES.map(([key, label, description]): SettingDef => ({ id: key, label, description, category: 'animations', applies: 'now', disabled: animOff, ...toggle(key) })),
  { id: 'animationSpeed', label: 'Animation speed', description: 'How fast animations play.', category: 'animations', applies: 'now', disabled: animOff, ...choice('animationSpeed', { slow: 'Slow', normal: 'Normal', fast: 'Fast' }, ['normal', 'fast', 'slow']) },
  { id: 'animationIntensity', label: 'Animation intensity', description: 'How strong animations look.', category: 'animations', also: ['accessibility'], applies: 'now', disabled: animOff, ...choice('animationIntensity', { reduced: 'Reduced', normal: 'Normal', enhanced: 'Enhanced' }, ['normal', 'enhanced', 'reduced']) },
  { id: 'effectIntensity', label: 'Flashes', description: 'How strong flashes are. 0% turns them off.', category: 'animations', also: ['accessibility'], applies: 'now', disabled: (s) => animOff(s) || s.battleAnimations !== 'full', ...level('effectIntensity', [1, 0.5, 0.25, 0], 0.01) },
  { id: 'shakeIntensity', label: 'Screen shake', description: 'How strong screen shake is. 0% turns it off.', category: 'animations', also: ['accessibility'], applies: 'now', disabled: (s) => animOff(s) || s.battleAnimations !== 'full', ...level('shakeIntensity', [1, 0.5, 0.25, 0], 0.01) },
  { id: 'reduceParticles', label: 'Particle effects', description: 'Reduced drops the drifting specks; clouds and fog stay.', category: 'animations', also: ['accessibility'], applies: 'now', disabled: animOff, ...toggle('reduceParticles', 'Reduced', 'Full') },
  // Text & Dialogue
  { id: 'textSpeed', label: 'Battle text speed', description: 'How fast battle messages appear.', category: 'text', applies: 'now', ...choice('textSpeed', { instant: 'Instant', fast: 'Fast', normal: 'Normal', slow: 'Slow' }, ['instant', 'fast', 'normal', 'slow']) },
  { id: 'dialogueFrequency', label: 'Trainer talk', description: 'How much trainers speak in battle.', category: 'text', applies: 'now', ...choice('dialogueFrequency', { off: 'Off', low: 'Low', normal: 'Normal', high: 'High' }, ['normal', 'high', 'off', 'low']) },
  { id: 'autoAdvance', label: 'Auto-advance messages', description: 'Messages move on by themselves after a short wait.', category: 'text', applies: 'now', ...toggle('autoAdvance') },
  { id: 'messageDelay', label: 'Message delay', description: 'How long an auto-advanced message waits.', category: 'text', applies: 'now', advanced: true, disabled: (s) => !s.autoAdvance, ...choice('messageDelay', { short: 'Short', normal: 'Normal', long: 'Long' }, ['short', 'normal', 'long']) },
  // Accessibility
  { id: 'accessibilityProfile', label: 'Accessibility preset', description: 'One choice that sets several settings at once.', category: 'accessibility', applies: 'now', show: (s) => PROFILE_INFO[s.accessibilityProfile].label, next: (s) => applyProfile(s, nextProfile(s.accessibilityProfile)) },
  { id: 'typeMarkers', label: 'Type names in words', description: 'Names a move’s type in words next to the coloured art.', category: 'accessibility', applies: 'now', ...toggle('typeMarkers') },
];

export const settingById = (id: string): SettingDef | undefined => SETTINGS.find((d) => d.id === id);

/** The settings of a category in screen order: normal ones first, then advanced ones. */
export function settingsIn(category: SettingCategory): SettingDef[] {
  const here = SETTINGS.filter((d) => d.category === category || d.also?.includes(category));
  return [...here.filter((d) => !d.advanced), ...here.filter((d) => d.advanced)];
}

/** Settings whose name, description or category matches every word typed. Empty text finds nothing. */
export function searchSettings(query: string): SettingDef[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return SETTINGS.filter((d) => {
    const cat = SETTING_CATEGORIES.find((c) => c.id === d.category)!.label;
    const hay = `${d.label} ${d.description} ${cat}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Presses a setting once. A disabled setting is left as it is. */
export function changeSetting(s: Settings, id: string): Settings {
  const def = settingById(id);
  return !def || def.disabled?.(s) ? s : def.next(s);
}

/** Every setting back to `defaults` (the audio, display and animation choices alike). */
export const resetSettings = (defaults: Settings): Settings => ({ ...defaults });
