import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { eventChanceScale, getMode, makeRules, rewardMultiplier, rulesCampaign, rulesLines, rulesProblem, startScale, STANDARD_CHOICE, wantsRandomDraft } from '../../src/core/rules';
import { content } from './helpers';

const choice = (modeId: string) => ({ ...STANDARD_CHOICE, modeId });
const start = (modeId: string, seed: string) => createRun(content, { runId: seed, seed, archetypeId: 'red', rules: choice(modeId) });

describe('later modes', () => {
  it('Draft Lab, Regional Circuit and Research Expedition are playable and every bundle is a real modifier', () => {
    for (const id of ['draft-lab', 'regional-circuit', 'research-expedition']) {
      expect(rulesProblem(choice(id)), id).toBeNull();
      for (const b of getMode(id)!.bundles ?? []) expect(makeRules(choice(id)).modifierIds, `${id} ${b}`).toContain(b);
      expect(rulesLines(choice(id)).join('\n')).toContain(getMode(id)!.name);
    }
  });
  it('Draft Lab randomises the draft and pays nothing permanent', () => {
    const rules = makeRules(choice('draft-lab'));
    expect(wantsRandomDraft(rules)).toBe(true);
    expect(rules.progressionEligible).toBe(false);
    expect(rewardMultiplier(choice('draft-lab'))).toBe(0);
    const a = start('draft-lab', 'lab-1');
    const b = start('draft-lab', 'lab-1');
    expect(a.starterChoices).toEqual(b.starterChoices);
    expect(chooseStarter(content, a, 0).phase).not.toBe('starter');
  });
  it('Regional Circuit is one region, picked by the seed, and still earns half', () => {
    expect(rulesCampaign(choice('regional-circuit'))).toBe('regional-circuit');
    const regions = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const run = start('regional-circuit', `rc-${i}`);
      expect(run.regionOrder.length).toBe(1);
      regions.add(run.regionOrder[0]!);
    }
    expect(regions.size).toBeGreaterThan(1);
    expect(rewardMultiplier(choice('regional-circuit'))).toBeCloseTo(0.5, 5);
  });
  it('Research Expedition has more events, scarcer supplies and fewer trainer columns', () => {
    const rules = makeRules(choice('research-expedition'));
    expect(eventChanceScale(rules)).toBeGreaterThan(1);
    expect(startScale(rules)).toBeLessThan(1);
    const full = content.campaigns.get('full')!;
    const trip = content.campaigns.get('expedition-route')!;
    const trainerColumns = (c: typeof full) => c.trainerColumns.reduce((n, [a, b]) => n + (b - a + 1), 0);
    expect(trainerColumns(trip)).toBeLessThan(trainerColumns(full) / 2);
    expect(rulesCampaign(choice('research-expedition'))).toBe('expedition-route');
  });
});
