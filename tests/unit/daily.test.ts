import { describe, expect, it } from 'vitest';
import { dailyModifierId, dailySetup } from '../../src/core/daily';
import { defaultPrep } from '../../src/core/runPrep';
import { chooseStarter, createRun } from '../../src/core/run';
import { dailySeed, getMode, makeRules, rulesProblem, rulesCampaign, STANDARD_CHOICE } from '../../src/core/rules';
import { content } from './helpers';

const choice = { ...STANDARD_CHOICE, modeId: 'daily' };

describe('Daily Run format', () => {
  it('the same date gives the same seed, modifier and starter set, whatever the player had chosen', () => {
    const mine = { ...defaultPrep(content), poolId: 'johto', draftRuleId: 'expanded-research', tokenId: 'scout-report', loan: true };
    const a = dailySetup(content, '2026-10-31T10:00:00Z', mine, { ...choice, difficultyId: 'elite', modifierIds: ['monotype'] });
    const b = dailySetup(content, '2026-10-31T23:59:00Z', defaultPrep(content), choice);
    expect(a.seed).toBe(dailySeed('2026-10-31'));
    expect(a.rules.modifierIds).toEqual(b.rules.modifierIds);
    expect(a.rules.modifierIds).toEqual([dailyModifierId('2026-10-31')]);
    expect(a.prep).toMatchObject({ poolId: defaultPrep(content).poolId, draftRuleId: defaultPrep(content).draftRuleId, tokenId: null, loan: false });
    expect(rulesProblem(a.rules)).toBeNull();
    const draft = (d: typeof a) => createRun(content, { runId: 'd', seed: d.seed, archetypeId: 'red', prep: d.prep, rules: d.rules }).starterChoices;
    expect(draft(a)).toEqual(draft(b));
  });
  it('the daily modifier changes from day to day but never changes the route', () => {
    const days = Array.from({ length: 30 }, (_, i) => dailyModifierId(`2026-11-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(days).size).toBeGreaterThan(3);
    expect(rulesCampaign({ modeId: 'daily', modifierIds: days })).toBe('daily-route');
  });
  it('is a short one-region route that can be played to its first stage', () => {
    expect(getMode('daily')?.campaignId).toBe('daily-route');
    const setup = dailySetup(content, '2026-10-31', defaultPrep(content), choice);
    const run = createRun(content, { runId: 'd', seed: setup.seed, archetypeId: 'red', prep: setup.prep, rules: makeRules(setup.rules) });
    expect(run.campaignId).toBe('daily-route');
    expect(run.regionOrder.length).toBe(1);
    expect(chooseStarter(content, run, 0).phase).not.toBe('starter');
  });
});
