// The Weekly Gauntlet (ideas M109/F79): the ISO week alone decides the seed, three fixed starters and one themed ruleset.
// Everyone gets the same week. Pure: no RNG stream is touched.

import { starterSet } from './daily';
import type { Content } from './contentSchema';
import { defaultPrep } from './runPrep';
import type { RunPrep } from './state';
import { hashSeed, Rng } from './rng';
import { RUN_RULES, type RulesChoice } from './rules';

/** The week's themed rulesets. Each is a real mode plus modifiers, so everything it does is already tested. */
export const WEEKLY_THEMES: readonly { id: string; name: string; modeId: string; modifierIds: string[] }[] = [
  { id: 'nuzlocke', name: 'Nuzlocke Week', modeId: 'nuzlocke', modifierIds: [] },
  { id: 'hardcore', name: 'Hardcore Week', modeId: 'hardcore-nuzlocke', modifierIds: [] },
  { id: 'modifiers', name: 'Modifier Week', modeId: 'modifier-run', modifierIds: [] },
  { id: 'monotype', name: 'Monotype Week', modeId: 'standard', modifierIds: ['monotype'] },
  { id: 'empty-bag', name: 'Empty Bag Week', modeId: 'standard', modifierIds: ['no-battle-items'] },
  { id: 'solo', name: 'Solo Week', modeId: 'standard', modifierIds: ['solo-run'] },
  { id: 'no-evolution', name: 'No Evolution Week', modeId: 'standard', modifierIds: ['no-evolution'] },
  { id: 'boss-remix', name: 'Boss Remix Week', modeId: 'standard', modifierIds: ['boss-remix'] },
];

/** ISO-8601 week of a date as "2026-W44". */
export function isoWeek(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export const weeklySeed = (isoDate: string): string => `weekly-${isoWeek(isoDate)}`;
export const weeklyClaimKey = (isoDate: string): string => `weekly:${isoWeek(isoDate)}`;
export const weeklyTheme = (isoDate: string) => WEEKLY_THEMES[new Rng(hashSeed(`${weeklySeed(isoDate)}::theme`)).int(0, WEEKLY_THEMES.length - 1)]!;

export interface WeeklySetup {
  seed: string;
  starters: string[];
  prep: RunPrep;
  rules: RulesChoice;
  lines: string[];
}

export function weeklySetup(content: Content, isoDate: string, prep: RunPrep, rules: RulesChoice): WeeklySetup {
  const theme = weeklyTheme(isoDate);
  const base = defaultPrep(content);
  const seed = weeklySeed(isoDate);
  const starters = starterSet(content, seed);
  return {
    seed,
    starters,
    prep: { ...prep, poolId: base.poolId, draftRuleId: base.draftRuleId, typeFocus: null, tokenId: null, loan: false, vaultItem: null },
    rules: { ...rules, modeId: theme.modeId, difficultyId: 'standard', modifierIds: theme.modifierIds, deathBlock: false },
    lines: [`This week: ${theme.name}`, `Starters: ${starters.map((id) => content.species.get(id)?.name ?? id).join(', ')}`, `Rules: ${RUN_RULES.modes.find((m) => m.id === theme.modeId)?.name}${theme.modifierIds.length ? ' + ' + theme.modifierIds.join(', ') : ''}`],
  };
}
