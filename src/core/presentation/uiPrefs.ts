// W11 UI, accessibility and presentation: the pure rules behind the themes, font size, tooltips, transitions,
// gamepad, haptics, tips and share cards. No Phaser. Nothing here changes a battle or run outcome.

import type { Settings } from '../state';

export type UiThemeId = Settings['uiTheme'];

export interface UiThemePalette {
  label: string;
  blurb: string;
  background: number;
  panel: number;
  panelDark: number;
  border: number;
  borderMuted: number;
  accent: number;
  /** Aero glass colours (the glossy panels and the rim glow). */
  glass: number;
  glassLow: number;
  rim: number;
  sky: number;
}

/** Four skins plus the original look. `classic` is exactly what the game used before themes existed. */
export const UI_THEMES: Record<UiThemeId, UiThemePalette> = {
  classic: { label: 'Classic Plum', blurb: 'The original dark plum windows with a red trim.', background: 0x1d1a24, panel: 0x362d3e, panelDark: 0x2a2431, border: 0xc73625, borderMuted: 0x6b5a73, accent: 0xffb745, glass: 0x0b2a4a, glassLow: 0x061528, rim: 0x7ff3ff, sky: 0x38c8ff },
  aero: { label: 'Frutiger Aero', blurb: 'Glossy sky-blue glass, bubbles and soft glow.', background: 0x0d3556, panel: 0x1d5f8f, panelDark: 0x134a73, border: 0x7ff3ff, borderMuted: 0x4a9cc7, accent: 0xfff27a, glass: 0x0b4a7a, glassLow: 0x062c4f, rim: 0xb9fbff, sky: 0x38c8ff },
  ds: { label: 'DS Touch', blurb: 'Flat touch-screen menus: cream, grey and clean blue.', background: 0x2b2f3a, panel: 0xe8e4d6, panelDark: 0xd2cdbb, border: 0x4a78c8, borderMuted: 0x8d8a7c, accent: 0xf2a33a, glass: 0x3a4a68, glassLow: 0x232c40, rim: 0xcfe2ff, sky: 0x6f9bd8 },
  wii: { label: 'Wii Channel', blurb: 'Bright white tiles with a pale blue shimmer.', background: 0xcfe6f5, panel: 0xf6fbff, panelDark: 0xe0eef8, border: 0x3ba7e0, borderMuted: 0x9cc4dc, accent: 0x38c070, glass: 0x4a8ac0, glassLow: 0x2c5f8c, rim: 0xffffff, sky: 0xa7dcff },
  cyber: { label: 'Cyber-Maximalism', blurb: 'Black glass with hot pink and cyan neon.', background: 0x0a0618, panel: 0x1a0f33, panelDark: 0x120a26, border: 0xff2fb9, borderMuted: 0x6a3fa0, accent: 0x2ef2ff, glass: 0x1b0b3d, glassLow: 0x0c0420, rim: 0xff4fd8, sky: 0x7a2cff },
};

export const UI_THEME_ORDER: UiThemeId[] = ['classic', 'aero', 'ds', 'wii', 'cyber'];

/** Text on light themes must be dark. `true` means the panel is light. */
export const themeIsLight = (id: UiThemeId): boolean => id === 'ds' || id === 'wii';

// --- Font size and the dyslexia-friendly font --------------------------------------------------------------------

export const FONT_SCALE: Record<Settings['fontSize'], number> = { normal: 1, large: 1.2, huge: 1.4 };

/** Wide, even-spaced fonts that browsers ship; OpenDyslexic is used first when the page loaded it. */
export const DYSLEXIA_FONT_FAMILY = '"OpenDyslexic", "Lexend", Verdana, "Trebuchet MS", "Comic Sans MS", sans-serif';

// --- Tooltips -----------------------------------------------------------------------------------------------------

/** Hover delay before a tooltip shows, in ms. `null` means tooltips are off. */
export const TOOLTIP_DELAY_MS: Record<Settings['tooltipDelay'], number | null> = { off: null, short: 250, normal: 600, long: 1200 };

// --- Transitions --------------------------------------------------------------------------------------------------

export const TRANSITION_INFO: Record<Settings['transitionStyle'], { label: string; ms: number }> = {
  fade: { label: 'Fade', ms: 220 },
  bounce: { label: 'Bounce', ms: 320 },
  wipe: { label: 'Wipe', ms: 300 },
  ripple: { label: 'Ripple', ms: 420 },
};

// --- Damage popups and flashes ------------------------------------------------------------------------------------

export const POPUP_SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Reduced-flash mode caps flash and shake strength at this value (and removes white full-screen flashes). */
export const REDUCED_FLASH_CAP = 0.2;
export const capFlash = (value: number, reducedFlash: boolean): number => (reducedFlash ? Math.min(value, REDUCED_FLASH_CAP) : value);

// --- Haptics ------------------------------------------------------------------------------------------------------

/** Vibration patterns (ms on, off, on...) by move type; supported devices only. */
export const HAPTIC_PATTERNS: Record<string, number[]> = {
  normal: [30], fire: [20, 20, 40], water: [60, 30, 60], electric: [10, 15, 10, 15, 10, 15, 10], grass: [25, 25, 25],
  ice: [70], fighting: [60, 20, 60], poison: [15, 30, 15, 30], ground: [90], flying: [15, 10, 15],
  psychic: [40, 40, 80], bug: [8, 12, 8, 12, 8], rock: [100], ghost: [20, 60, 20], dragon: [50, 20, 90],
  dark: [70, 30, 30], steel: [45, 10, 45], fairy: [12, 24, 12, 24, 36],
};
export const hapticPattern = (type: string, superEffective = false): number[] => {
  const p = HAPTIC_PATTERNS[type] ?? HAPTIC_PATTERNS.normal!;
  return superEffective ? [...p, 30, ...p] : p;
};

// --- Gamepad ------------------------------------------------------------------------------------------------------

export type PadAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export interface PadSnapshot {
  buttons: boolean[];
  axes: number[];
}
export const PAD_BUTTON_NAMES = ['A / Cross', 'B / Circle', 'X / Square', 'Y / Triangle'] as const;

/** Which game actions are held, from one gamepad snapshot. Standard mapping: d-pad 12 to 15, left stick axes 0 and 1. */
export function padActions(pad: PadSnapshot, confirmButton: number, backButton: number): Set<PadAction> {
  const out = new Set<PadAction>();
  const b = (i: number) => pad.buttons[i] === true;
  if (b(12) || (pad.axes[1] ?? 0) < -0.6) out.add('up');
  if (b(13) || (pad.axes[1] ?? 0) > 0.6) out.add('down');
  if (b(14) || (pad.axes[0] ?? 0) < -0.6) out.add('left');
  if (b(15) || (pad.axes[0] ?? 0) > 0.6) out.add('right');
  if (b(confirmButton)) out.add('confirm');
  if (b(backButton)) out.add('back');
  return out;
}
export const PAD_KEY: Record<PadAction, { code: string; keyCode: number }> = {
  up: { code: 'ArrowUp', keyCode: 38 }, down: { code: 'ArrowDown', keyCode: 40 }, left: { code: 'ArrowLeft', keyCode: 37 },
  right: { code: 'ArrowRight', keyCode: 39 }, confirm: { code: 'Enter', keyCode: 13 }, back: { code: 'Escape', keyCode: 27 },
};

export type GlyphFamily = 'xbox' | 'playstation' | 'switch' | 'generic';
/** The controller family from the browser's gamepad id string. */
export function glyphFamily(id: string): GlyphFamily {
  const s = id.toLowerCase();
  if (/(054c|playstation|dualshock|dualsense|ps4|ps5)/.test(s)) return 'playstation';
  if (/(057e|nintendo|switch|pro controller|joy-con)/.test(s)) return 'switch';
  if (/(xbox|xinput|045e|microsoft)/.test(s)) return 'xbox';
  return 'generic';
}
const GLYPHS: Record<GlyphFamily, string[]> = {
  xbox: ['A', 'B', 'X', 'Y'], playstation: ['✕', '○', '□', '△'], switch: ['B', 'A', 'Y', 'X'], generic: ['1', '2', '3', '4'],
};
/** Label for a face button index (0 to 3) in a controller family. Switch swaps A/B positions, as on the device. */
export const buttonGlyph = (family: GlyphFamily, index: number): string => GLYPHS[family][index] ?? String(index + 1);

// --- One-handed layout --------------------------------------------------------------------------------------------

/** Which side of the screen the touch pad sits on: both hands (spread), or all buttons bunched to one side. */
export function padJustify(mode: Settings['oneHanded']): 'space-between' | 'flex-start' | 'flex-end' {
  return mode === 'left' ? 'flex-start' : mode === 'right' ? 'flex-end' : 'space-between';
}

// --- Loading tips -------------------------------------------------------------------------------------------------

export const LOADING_TIPS: readonly string[] = [
  'Type advantage is doubled by a second weakness: check both types.',
  'Hold the Skip button to fast-forward long cutscenes.',
  'Rest at a Camp stop to heal the whole team for free.',
  'A Pokémon you rely on bonds with you; bonded teammates may take a hit for a friend.',
  'Catch rates rise when the target is asleep or frozen.',
  'The Hub shop restocks after every region.',
  'Press Esc in any menu to go back one step.',
  'Rivals remember how you treat them; be kind or be ruthless.',
  'Held items matter: a Focus Sash can turn a lost battle around.',
  'Your settings have an Accessibility preset that changes several things at once.',
  'Weather lasts a few turns; set it before your sweeper comes in.',
  'Status moves are worth a turn when the foe cannot do anything about them.',
  'Check a trainer before the fight: its team hints at its strategy.',
  'Auto-Battle is great for easy fights, and halves EXP.',
  'Pin a Pokémon in the party screen to compare it with another.',
];
/** Deterministic pick (no gameplay RNG): the tip for a counter such as the number of times the screen has loaded. */
export const loadingTip = (counter: number): string => LOADING_TIPS[((counter % LOADING_TIPS.length) + LOADING_TIPS.length) % LOADING_TIPS.length]!;

// --- Hold-to-confirm ----------------------------------------------------------------------------------------------

export const HOLD_MS = 700;
/** Ring progress 0 to 1 after being held `heldMs`. */
export const holdProgress = (heldMs: number, total = HOLD_MS): number => Math.max(0, Math.min(1, heldMs / total));

// --- Tilt cards ---------------------------------------------------------------------------------------------------

/** Skew/rotation (radians-ish, small) for a card hovered at pointer offset (dx, dy) from its centre in -1..1. */
export function tiltFor(dx: number, dy: number, max = 0.12): { rotation: number; scaleX: number } {
  const cx = Math.max(-1, Math.min(1, dx));
  const cy = Math.max(-1, Math.min(1, dy));
  return { rotation: cx * max * 0.5, scaleX: 1 - Math.abs(cy) * 0.04 };
}

// --- Interaction log ----------------------------------------------------------------------------------------------

export interface LogEntry {
  at: number;
  text: string;
}
/** A short log of recent choices and results (a ring buffer; never saved, never used by the game). */
export class InteractionLog {
  private entries: LogEntry[] = [];
  constructor(private readonly capacity = 40) {}
  add(text: string, at = Date.now()): void {
    this.entries.push({ at, text });
    if (this.entries.length > this.capacity) this.entries.shift();
  }
  recent(n = 12): LogEntry[] {
    return this.entries.slice(-n).reverse();
  }
  clear(): void {
    this.entries = [];
  }
}
export const interactionLog = new InteractionLog();

// --- Pause-menu doodles / aero moods -----------------------------------------------------------------------------

/** Battle UI tint by weather and morale (M120). Cosmetic: a 0xRRGGBB tint and strength 0 to 0.35. */
export function aeroMood(weather: string | null | undefined, morale: number | null | undefined): { tint: number; strength: number } {
  const base: Record<string, number> = { rain: 0x4a78c8, sun: 0xffd24a, sand: 0xc8a050, hail: 0xb8e8f8, snow: 0xb8e8f8, fog: 0x9aa4ae };
  const tint = (weather && base[weather]) || 0x38c8ff;
  const m = typeof morale === 'number' ? Math.max(-1, Math.min(1, morale)) : 0;
  const mix = m > 0.3 ? 0xfff2a0 : m < -0.3 ? 0x703060 : tint;
  return { tint: weather ? tint : mix, strength: weather ? 0.2 : Math.abs(m) > 0.3 ? 0.25 : 0 };
}

/** Camera push-in for KOs and boss phase breaks (M119): zoom amount and ms, scaled by animation strength. */
export function cameraFocus(kind: 'ko' | 'phase', strength: number): { zoom: number; ms: number } {
  const base = kind === 'phase' ? { zoom: 0.08, ms: 360 } : { zoom: 0.05, ms: 260 };
  return { zoom: base.zoom * Math.max(0, Math.min(1.4, strength)), ms: base.ms };
}

// --- Share cards and framed screenshots --------------------------------------------------------------------------

export interface ShareCardInput {
  title: string;
  lines: string[];
  team: { name: string; level: number }[];
  seed?: string;
}
/** The text rows of a run share card, top to bottom (pure; `ui/shareCard.ts` draws them). */
export function shareCardRows(c: ShareCardInput): string[] {
  const team = c.team.map((m) => `${m.name} Lv${m.level}`);
  const rows: string[] = [c.title, ...c.lines, ''];
  for (let i = 0; i < team.length; i += 2) rows.push(team.slice(i, i + 2).join('   ·   '));
  if (c.seed) rows.push('', `Seed ${c.seed}`);
  return rows;
}
export const shotFileName = (kind: 'screenshot' | 'card', now: Date): string => `pocket-raiders-${kind}-${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
