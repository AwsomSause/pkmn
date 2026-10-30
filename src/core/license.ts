// The Field License (Untitled doc §10): a prep choice that gives one exploration hint for the whole run.
// It changes no rolls and no battle numbers; it only reads state and tells the player something.

import { typeEffectiveness } from './battle/damage';
import { TYPE_NAMES, type Content } from './contentSchema';
import { bossInfo } from './regions';
import { shopStock } from './run';
import type { RunState } from './state';

export const LICENSES = [
  { id: 'boss', name: 'Boss Preview', blurb: 'Shows this stage\'s gym leader and the types they use.' },
  { id: 'shop', name: 'Shop Preview', blurb: 'Shows the next items the shop will stock.' },
  { id: 'weakness', name: 'Research Hint', blurb: 'Shows the types that hit this stage\'s leader hardest.' },
] as const;
export type LicenseId = (typeof LICENSES)[number]['id'];
export const licenseName = (id: string): string => LICENSES.find((l) => l.id === id)?.name ?? id;

/** What the run's Field License says right now, or null when the run has none (or nothing to say). */
export function licenseNote(content: Content, run: Pick<RunState, 'prep' | 'stage' | 'badges' | 'archetypeId'> & Partial<Pick<RunState, 'inventory' | 'rules' | 'perkEffects'>>): string | null {
  const id = run.prep.license;
  if (!id || !run.stage) return null;
  const league = run.stage.kind === 'league';
  const leader = bossInfo(content, league ? 'champion' : 'gym', run.stage.leaderId);
  switch (id) {
    case 'boss':
      return `${leader.title} uses ${leader.types.map((t) => t.toUpperCase()).join('/')} Pokémon.`;
    case 'weakness': {
      const hits = TYPE_NAMES.map((t) => ({ t, x: typeEffectiveness(content.typeChart, t, leader.types) })).filter((e) => e.x > 1).sort((a, b) => b.x - a.x || a.t.localeCompare(b.t)).slice(0, 3);
      return hits.length === 0 ? `${leader.title} has no common weakness.` : `${leader.title} is weak to ${hits.map((e) => e.t.toUpperCase()).join(', ')}.`;
    }
    case 'shop': {
      const now = new Set(shopStock(content, run as never).map((e) => e.item));
      const next = content.shop.filter((e) => !now.has(e.item) && e.minBadges === run.badges.length + 1).map((e) => content.items.get(e.item)?.name ?? e.item);
      return next.length === 0 ? 'The shop has no new stock at the next badge.' : `Next badge opens: ${next.slice(0, 5).join(', ')}.`;
    }
    default:
      return null;
  }
}
