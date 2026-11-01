// Evil Teams in the Trainer Plaza (spec §33 "Plaza + Evil Teams").
import { describe, expect, it } from 'vitest';
import { sectionView, usePlaza } from '../../src/core/plaza/flow';
import { plazaLayout } from '../../src/core/plaza/layout';
import { evilMarkup, plazaAgent, plazaVillain } from '../../src/core/evil/plaza';
import { evilOf, evilStageStart, evilTeam } from '../../src/core/evil/teams';
import { choiceMade } from '../../src/core/evil/choices';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

function plazaRun(seed: string): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'pz', seed, archetypeId: 'red' }), 0));
  const middle = Math.ceil(run.stage!.map.columns / 2);
  const node = run.stage!.map.nodes.find((n) => n.column === middle)!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  run.money = 20000;
  while (!evilOf(run).teamId) evilStageStart(content, run);
  evilOf(run).beat = 2;
  return run;
}
const sideId = (run: RunState): string | undefined => run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!.sides.find((s) => s.kind === 'plaza')?.id;

/** The first seed whose plaza has a disguised member (and a plaza stop). */
function withAgent(): RunState {
  for (let i = 0; i < 60; i++) {
    const run = plazaRun(`evil-plaza-${i}`);
    if (sideId(run) && plazaAgent(content, run)) return run;
  }
  throw new Error('no seed with an agent');
}

describe('Evil Teams in the plaza', () => {
  it('a disguised member walks in the crowd only while the story is under way', () => {
    const run = withAgent();
    const agent = plazaAgent(content, run)!;
    const team = evilTeam(content, run)!;
    if (team.style !== 'open') expect(agent.name).toContain(team.front);
    expect(plazaLayout(content, run, sideId(run)!).crowd.some((w) => w.id === 'evil:agent')).toBe(true);
    expect(plazaAgent(content, run)).toEqual(agent);
    evilOf(run).end = 'defeated';
    expect(plazaAgent(content, run)).toBeNull();
    evilOf(run).end = 'none';
    evilOf(run).beat = 0;
    expect(plazaAgent(content, run)).toBeNull();
  });

  it('unmasking raises heat, pays, records the choice and works once per stage', () => {
    const run = withAgent();
    const before = evilOf(run).heat;
    const r = usePlaza(content, run, sideId(run)!, 'people', 'evil:unmask').run;
    expect(r.story.evil.heat).toBe(before + 1);
    expect(r.money).toBeGreaterThan(run.money);
    expect(choiceMade(r, `${r.story.evil.teamId}-plaza-unmask`)).toBe(true);
    expect(sectionView(content, r, sideId(r)!, 'people').options.find((o) => o.id === 'evil:buy')!.problem).toBe('They slipped away.');
  });

  it('buying from them gives team spoils and cools the team', () => {
    const run = withAgent();
    evilOf(run).heat = 3;
    const r = usePlaza(content, run, sideId(run)!, 'people', 'evil:buy').run;
    expect(r.story.evil.heat).toBe(2);
    expect(r.money).toBe(run.money - content.evilTeams.plaza.buyCost);
  });

  it('the executive you met comes back with a line from your history, and supplies if you made a deal', () => {
    for (let i = 0; i < 60; i++) {
      const run = plazaRun(`evil-villain-${i}`);
      evilOf(run).villains.executive = { met: 1, won: 1, lost: 0, last: 'won' };
      const v = plazaVillain(content, run);
      if (!v || !sideId(run)) continue;
      const team = evilTeam(content, run)!;
      expect(v.line).toBe(team.ranks.executive.lines.beaten);
      evilOf(run).end = 'allied';
      expect(sectionView(content, run, sideId(run)!, 'people').options.some((o) => o.id === 'evil:supplies')).toBe(true);
      return;
    }
    throw new Error('no seed with the executive');
  });

  it('stalls charge more while the team controls the region\'s trade', () => {
    const run = plazaRun('evil-markup');
    const team = evilTeam(content, run)!;
    const trade = team.ops.find((o) => o.kind === 'trade' || o.kind === 'control');
    if (!trade) return;
    evilOf(run).ops = [{ id: trade.id, region: run.regionIndex, outcome: 'running' }];
    expect(evilMarkup(content, run).factor).toBeCloseTo(1 + content.evilTeams.plaza.markup);
    evilOf(run).ops[0]!.outcome = 'foiled';
    expect(evilMarkup(content, run).factor).toBe(1);
  });
});
