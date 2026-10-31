// The Daily Run as its own format (Untitled doc §16.2): the date alone decides the seed, the starter draft
// (a fixed Classic pool and the standard rule, nothing from the player's own unlocks), one daily modifier and
// the short one-region route (campaign "daily-route", set by the mode). Pure: no RNG stream is touched.

import type { Content } from './contentSchema';
import { defaultPrep } from './runPrep';
import type { RunPrep } from './state';
import { dailySeed, RUN_RULES, type RulesChoice } from './rules';
import { Rng, hashSeed } from './rng';

/** Modifiers a daily may use: supported, and not ones that change the route or the party size. */
function dailyModifiers(): string[] {
  const banned = new Set(['campaign', 'party']);
  return RUN_RULES.modifiers.filter((m) => m.status === 'supported' && !banned.has(m.group) && !m.campaignId).map((m) => m.id);
}

/** The day's one modifier, the same for everyone. */
export function dailyModifierId(isoDate: string): string {
  const ids = dailyModifiers();
  return ids[new Rng(hashSeed(`${dailySeed(isoDate)}::modifier`)).int(0, ids.length - 1)]!;
}

export interface DailySetup {
  seed: string;
  prep: RunPrep;
  rules: RulesChoice;
  /** What is special today, for the Run Prep screen. */
  lines: string[];
}

/** The Daily Run's fixed setup. `prep` and `rules` are what the player chose; only the trainer is theirs to pick. */
export function dailySetup(content: Content, isoDate: string, prep: RunPrep, rules: RulesChoice): DailySetup {
  const modifierId = dailyModifierId(isoDate);
  const base = defaultPrep(content);
  const modifier = RUN_RULES.modifiers.find((m) => m.id === modifierId)!;
  return {
    seed: dailySeed(isoDate),
    prep: { ...prep, poolId: base.poolId, draftRuleId: base.draftRuleId, typeFocus: null, tokenId: null, loan: false, vaultItem: null },
    rules: { ...rules, difficultyId: 'standard', modifierIds: [modifierId], deathBlock: false },
    lines: [`Daily modifier: ${modifier.name}`, 'Starters: the Classic set, the same for everyone today', 'Route: one region, four gyms, then the champion'],
  };
}
