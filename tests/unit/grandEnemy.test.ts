// The Grand-Enemy (Techno blueprint §5): phases, boss influence, Grudge, legacy.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { grandMoment, grandPhase, recordGrandLegacy, stoodAgainst } from '../../src/core/story/grandEnemy';
import { content } from './helpers';

function fresh(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  return { run, mon: run.party[0]! };
}

describe('Grand-Enemy', () => {
  it('phases follow the campaign: omen, contact, escalation, reckoning, legacy', () => {
    const { run } = fresh('ge-phase');
    const last = run.regionOrder.length - 1;
    const at = (i: number) => grandPhase(content, { ...run, regionIndex: i });
    expect(at(0)).toBe('omen');
    expect(at(last)).toBe('reckoning');
    expect(at(Math.ceil(last * 0.3))).toBe('firstContact');
    expect(at(Math.ceil(last * 0.6))).toBe('escalation');
    expect(grandPhase(content, { ...run, victory: true })).toBe('legacy');
  });

  it('bosses are influenced from escalation; a Pokémon that stood against it with boss wins earns the Grudge at the end', () => {
    const { run, mon } = fresh('ge-grudge');
    const last = run.regionOrder.length - 1;
    run.regionIndex = Math.ceil(last * 0.6);
    expect(grandMoment(content, run, mon.uid)).toBe('grandShadow');
    expect(grandMoment(content, run, mon.uid)).toBe('grandShadow');
    expect(stoodAgainst(run, mon.uid)).toBe(2);
    run.regionIndex = last;
    expect(grandMoment(content, run, mon.uid)).toBe("grandShadow");
    run.story.histories[mon.uid]!.bossesBeaten = 1;
    expect(grandMoment(content, run, mon.uid)).toBe('grandGrudge');
  });

  it('victory records the outcome and gives the title to the Pokémon that stood against it most', () => {
    const { run, mon } = fresh('ge-legacy');
    run.story.flags[`ge:fought:${mon.uid}`] = 3;
    recordGrandLegacy(content, run);
    expect(run.story.histories[mon.uid]!.titles).not.toContain(content.story.grandEnemy.title);
    run.victory = true;
    recordGrandLegacy(content, run);
    expect(run.story.histories[mon.uid]!.titles).toContain(content.story.grandEnemy.title);
    expect(run.story.chronicle.at(-1)!.text).toContain('turned back');
  });
});
