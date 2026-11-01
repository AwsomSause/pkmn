// Applies the W11 look settings: the interface theme (palette), text size and the reading font. Presentation only.
// COLORS and AERO are changed in place, so screens opened after a change use the new look; the old look is kept to restore.

import type { Settings } from '../core/state';
import { DYSLEXIA_FONT_FAMILY, FONT_SCALE, themeIsLight, UI_THEMES } from '../core/presentation/uiPrefs';
import { AERO } from './aero';
import { COLORS, setTextPrefs } from './theme';

const original = { colors: { ...COLORS }, aero: { ...AERO } };
let appliedTheme: Settings['uiTheme'] = 'classic';

export const currentTheme = (): Settings['uiTheme'] => appliedTheme;

/** Applies theme, text size and font from the settings. Safe to call often. */
export function applyUiSkin(settings: Pick<Settings, 'uiTheme' | 'fontSize' | 'dyslexiaFont'>): void {
  setTextPrefs(FONT_SCALE[settings.fontSize], settings.dyslexiaFont ? DYSLEXIA_FONT_FAMILY : null);
  applyTheme(settings.uiTheme);
}

export function applyTheme(id: Settings['uiTheme']): void {
  appliedTheme = id;
  const t = UI_THEMES[id];
  Object.assign(COLORS, original.colors, { background: t.background, panel: t.panel, panelDark: t.panelDark, border: t.border, borderMuted: t.borderMuted, accent: t.accent });
  Object.assign(AERO, original.aero, { glass: t.glass, glassLow: t.glassLow, rim: t.rim, sky: t.sky });
  if (themeIsLight(id)) Object.assign(COLORS, { text: '#2a2431', textLight: '#2a2431', textMuted: '#5a5068', cursor: '#2a2431' });
}
