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

describe('Grand-Enemy battles', () => {
  it('the two fights are placed by the campaign, kept out of random dens, and use real species and items', async () => {
    const { grandRaidFor } = await import('../../src/core/story/grandEnemy');
    const grand = content.raids.raids.filter((r) => r.grand);
    expect(grand.map((r) => r.grand).sort()).toEqual(['contact', 'reckoning']);
    for (const r of grand) {
      for (const s of r.species) expect(content.species.has(s)).toBe(true);
      for (const i of r.rewards.items) expect(content.items.has(i.item)).toBe(true);
    }
    const { run } = fresh('ge-place');
    const last = run.regionOrder.length - 1;
    const at = (region: number, index: number, met = 0) => {
      const r = structuredClone(run);
      r.regionIndex = region;
      r.stage = { kind: 'stage', index } as never;
      r.story.flags['ge:met'] = met;
      return grandRaidFor(content, r);
    };
    expect(at(Math.ceil(0.25 * last), 1)).toBe('contact');
    expect(at(Math.ceil(0.25 * last), 0)).toBeNull();
    expect(at(Math.ceil(0.25 * last), 1, 1)).toBeNull();
    expect(at(last, 1)).toBe('reckoning');
  });

  it('adapts to a repeated style, reveals weaknesses after the first fight, and remembers the fight', async () => {
    const g = await import('../../src/core/story/grandEnemy');
    const { run, mon } = fresh('ge-adapt');
    expect(g.grandAdaptation(content, run)).toBeNull();
    expect(g.grandWeaknesses(content, run, 'lugia')).toEqual([]);
    g.endGrandBattle(content, run, false, mon.uid);
    expect(g.grandMet(run)).toBe(1);
    expect(g.grandWeaknesses(content, run, 'lugia').length).toBeGreaterThan(0);
    const adapt = g.grandAdaptation(content, run)!;
    expect(adapt.text).toContain('Fight a different way');
    run.battle = { enemyStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } } as never;
    g.startGrandBattle(content, run);
    expect((run.battle as unknown as { enemyStages: Record<string, number> }).enemyStages[adapt.stat]).toBe(1);
    // A different fighting style is not punished.
    run.story.flags['ge:category'] = g.dominantCategory(content, run) === 'physical' ? 'special' : 'physical';
    expect(g.grandAdaptation(content, run)).toBeNull();
    expect(run.story.chronicle.at(-1)!.text).toContain('learned how it fights');
  });
});

describe('Grand-Enemy influence and Grudge target', () => {
  it('stirs the wild once from escalation, and prepares a Speed boost against the Pokémon that stood against it most', async () => {
    const g = await import('../../src/core/story/grandEnemy');
    const { run, mon } = fresh('ge-influence');
    const last = run.regionOrder.length - 1;
    const rare = (r: typeof run) => (r.perkEffects ?? []).filter((e) => e.kind === 'encounterWeightMultiplier' && e.group === 'rare').length;
    run.regionIndex = 0;
    g.applyGrandInfluence(content, run);
    expect(rare(run)).toBe(0);
    run.regionIndex = Math.ceil(last * 0.6);
    g.applyGrandInfluence(content, run);
    g.applyGrandInfluence(content, run);
    expect(rare(run)).toBe(1);

    expect(g.grudgeTarget(run)).toBeNull();
    run.story.flags[`ge:fought:${mon.uid}`] = 4;
    expect(g.grudgeTarget(run)).toBe(mon.uid);
    run.battle = { enemyStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } } as never;
    g.startGrandBattle(content, run);
    expect((run.battle as unknown as { enemyStages: Record<string, number> }).enemyStages.spe).toBe(1);
  });
});

