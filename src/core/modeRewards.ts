// Permanent rewards for Daily Run, Spooky and Endless (Untitled doc §14, Phase E/F): each pays a one-time reward the first time
// it is earned (a claim in the ledger, so a reload or a second run never pays it twice) and a smaller useful repeat reward after.
// Adventure and any run that earns no account rewards get nothing.

import { grantUnlocks } from './unlocks';
import { claim } from './quests';
import { RUN_RULES } from './rules';
import type { Profile, RunState } from './state';

export interface ModeRewardPaid {
  id: string;
  /** True for the one-time reward, false for the repeat reward. */
  first: boolean;
  text: string;
}

/** Pays the rewards this finished run earned (mutates `profile`). Only runs with account rewards count. */
export function awardModeRewards(profile: Profile, run: RunState, now: string): ModeRewardPaid[] {
  if (!run.rules.progressionEligible) return [];
  const out: ModeRewardPaid[] = [];
  for (const r of RUN_RULES.modeRewards) {
    if (r.modeId !== run.rules.modeId) continue;
    if (r.needs.badges !== undefined && run.badges.length < r.needs.badges) continue;
    if (r.needs.loops !== undefined && run.rules.loops < r.needs.loops) continue;
    if (claim(profile, r.claim, now)) {
      const o = r.once;
      grantUnlocks(profile, { pool: o.pool, trainer: o.trainer, title: o.title });
      profile.bankCredits += o.bankCredits ?? 0;
      profile.lifetimeBankCredits += o.bankCredits ?? 0;
      out.push({ id: r.id, first: true, text: o.text });
    } else {
      profile.bankCredits += r.repeat.bankCredits ?? 0;
      profile.lifetimeBankCredits += r.repeat.bankCredits ?? 0;
      profile.candies += r.repeat.candies ?? 0;
      out.push({ id: r.id, first: false, text: r.repeat.text });
    }
  }
  return out;
}
