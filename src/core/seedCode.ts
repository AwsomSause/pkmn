// Seed-sharing (catalog #104): a seed plus the trainer and rule choices as one short, copyable code.
// Pure: no RNG, no Phaser. A code made on another rule version still loads but says so.

import type { RulesChoice } from './rules';
import { getDifficulty, getMode, getModifier, RUN_RULES, rulesProblem } from './rules';

const PREFIX = 'PR1';
const SEP = '.';

export interface SeedCodeParts {
  seed: string;
  archetypeId: string;
  rules: RulesChoice;
}

export type SeedCodeResult = { ok: true; parts: SeedCodeParts; note: string | null } | { ok: false; reason: string };

const enc = (s: string) => encodeURIComponent(s).replace(/\./g, '%2E');

/** PR1.<ruleVersion>.<seed>.<trainer>.<mode>.<difficulty>.<modifiers joined by +>.<deathBlock 0/1> */
export function encodeSeedCode(parts: SeedCodeParts): string {
  const r = parts.rules;
  return [PREFIX, String(RUN_RULES.ruleVersion), enc(parts.seed), enc(parts.archetypeId), enc(r.modeId), enc(r.difficultyId), [...r.modifierIds].sort().map(enc).join('+'), r.deathBlock ? '1' : '0'].join(SEP);
}

export function decodeSeedCode(code: string): SeedCodeResult {
  const bits = code.trim().split(SEP);
  if (bits[0] !== PREFIX || bits.length !== 8) return { ok: false, reason: 'This is not a Pocket Raiders seed code.' };
  try {
    const [, version, seed, archetypeId, modeId, difficultyId, mods, db] = bits.map(decodeURIComponent) as [string, string, string, string, string, string, string, string];
    if (!seed) return { ok: false, reason: 'The code has no seed.' };
    const rules: RulesChoice = { modeId, difficultyId, modifierIds: mods ? mods.split('+') : [], deathBlock: db === '1' };
    const problem = rulesProblem(rules);
    if (problem) return { ok: false, reason: problem };
    if (!getMode(modeId) || !getDifficulty(difficultyId) || rules.modifierIds.some((m) => !getModifier(m))) return { ok: false, reason: 'The code names a rule this version does not have.' };
    const note = Number(version) === RUN_RULES.ruleVersion ? null : `Made on rule version ${version}; this game is on ${RUN_RULES.ruleVersion}. The run may play differently.`;
    return { ok: true, parts: { seed, archetypeId, rules }, note };
  } catch {
    return { ok: false, reason: 'The code is damaged.' };
  }
}
