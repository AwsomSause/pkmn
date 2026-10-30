// Stage level caps, the first rival on stage 2, and the Exp. Share waiting for that rival (Kice, 2026-10-30).

import { describe, expect, it } from 'vitest';
import { expShareUnlocked, FIRST_RIVAL_FLAG } from '../../src/core/firstRival';
import { planFirstRival } from '../../src/core/encounters';
import { createPokemon, gainXp } from '../../src/core/pokemon';
import { getCampaign, levelCap, runLevelCap, stageLevelCap } from '../../src/core/regions';
import { chooseNode, chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

const full = getCampaign(content, 'full');

describe('stage level caps', () => {
  it('rise with every stage and never pass the region cap', () => {
    let prev = 0;
    for (let s = 0; s < full.stagesPerRegion; s++) {
      const cap = stageLevelCap(content, full, 0, s);
      expect(cap).toBeGreaterThan(prev);
      expect(cap).toBeLessThanOrEqual(levelCap(content, 0));
      prev = cap;
    }
  });
  it('sit a few levels above the stage gym, so the party stays near the enemies', () => {
    expect(stageLevelCap(content, full, 0, 0)).toBe(13);
    expect(stageLevelCap(content, full, 0, 4)).toBeGreaterThan(30);
  });
  it('stop experience at the stage cap', () => {
    const mon = createPokemon(content, 'bulbasaur', 5, 'p1');
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'caps', archetypeId: 'red' }), 0);
    const cap = runLevelCap(content, run);
    expect(cap).toBe(stageLevelCap(content, full, 0, 0));
    const result = gainXp(content, mon, 10_000_000, cap);
    expect(result.newLevel).toBe(cap);
  });
});

describe('the first rival and the Exp. Share', () => {
  const rivalRun = (seed: string) => {
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
    run.stage!.index = content.balance.rival.stage;
    run.stage!.current = run.stage!.map.nodes.find((n) => n.column === 1)!.id;
    const node = run.stage!.map.nodes.find((n) => n.kind === 'trainer')!;
    run.stage!.current = run.stage!.map.nodes.find((n) => n.next.includes(node.id))!.id;
    return { run, node };
  };
  it('is a single level 5 starter-line Pokémon', () => {
    const plan = planFirstRival(content, 'x');
    expect(plan.members).toHaveLength(1);
    expect(plan.members[0]!.level).toBe(5);
    expect(content.balance.rival.starters).toContain(plan.members[0]!.speciesId);
    expect(plan.classId).toBe('rival');
  });
  it('is met on the first ordinary trainer of stage 2, once', () => {
    const { run, node } = rivalRun('rival-1');
    const started = chooseNode(content, run, node.id);
    expect(started.battle?.firstRival).toBe(true);
    expect(started.battle?.trainer?.classId).toBe('rival');
    expect(started.battle?.enemyTeam).toHaveLength(1);
    expect(started.battle?.enemyTeam[0]!.level).toBe(5);
    expect(started.story.flags[FIRST_RIVAL_FLAG]).toBe('fighting');
  });
  it('keeps the Exp. Share off until the rival has been fought', () => {
    const { run } = rivalRun('rival-2');
    expect(expShareUnlocked(content, run)).toBe(false);
    run.story.flags[FIRST_RIVAL_FLAG] = 'met';
    expect(expShareUnlocked(content, run)).toBe(true);
  });
  it('switches on anyway if the run got past stage 2 without meeting the rival', () => {
    const { run } = rivalRun('rival-3');
    run.stage!.index = content.balance.rival.stage + 2;
    expect(expShareUnlocked(content, run)).toBe(true);
  });
});
