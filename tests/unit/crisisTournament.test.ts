// Regional Crisis and the Rival Tournament bracket (Techno §7A/§7B).

import { describe, expect, it } from 'vitest';
import { addEventStops, chooseEvent, eligibleEvents } from '../../src/core/events';
import { chooseStarter, createRun } from '../../src/core/run';
import { changeAid, changeCrisis, crisisAid, crisisLevel, crisisMoments, growCrisis, setTournament, tournamentEventId, tournamentRound } from '../../src/core/story/crisis';
import { content } from './helpers';

function fresh(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  run.regionIndex = Math.min(2, run.regionOrder.length - 1);
  return run;
}
const stops = (run: ReturnType<typeof fresh>) => run.stage!.map.nodes.flatMap((n) => n.sides).flatMap((s) => (s.eventId ? [s.eventId] : []));

describe('Regional Crisis', () => {
  it('worsens once per stage from the second, stays within 0 to 5, and is per region', () => {
    const run = fresh('crisis-grow');
    run.stage!.index = 0;
    growCrisis(content, run);
    expect(crisisLevel(run)).toBe(0);
    run.stage!.index = 1;
    growCrisis(content, run);
    growCrisis(content, run);
    expect(crisisLevel(run)).toBe(1);
    changeCrisis(content, run, 20);
    expect(crisisLevel(run)).toBe(5);
    changeCrisis(content, run, -20);
    expect(crisisLevel(run)).toBe(0);
    run.regionIndex += 1;
    expect(crisisLevel(run)).toBe(0);
  });

  it('boss moments follow the meter and the Aid; the chronicle notes a serious crisis', () => {
    const run = fresh('crisis-moments');
    expect(crisisMoments(run)).toEqual([]);
    changeCrisis(content, run, 3);
    expect(run.story.chronicle.at(-1)!.text).toContain('grown serious');
    changeAid(run, 2);
    expect(crisisMoments(run)).toEqual(['crisisLoom', 'crisisAid']);
    expect(crisisAid(run)).toBe(2);
  });

  it('a serious crisis always gets its report stop, and helping eases the meter and gathers Aid', () => {
    const run = fresh('crisis-event');
    expect(eligibleEvents(content, run).some((e) => e.id.startsWith('crisis-report'))).toBe(false);
    changeCrisis(content, run, 3);
    addEventStops(content, run);
    const id = stops(run).find((s) => s.startsWith('crisis-report'))!;
    expect(id).toBeDefined();
    const node = run.stage!.map.nodes.find((n) => n.sides.some((s) => s.eventId === id))!;
    run.stage!.current = node.id;
    const side = node.sides.find((s) => s.eventId === id)!;
    const result = chooseEvent(content, run, side.id, 0);
    expect(crisisLevel(result.run)).toBe(1);
    expect(crisisAid(result.run)).toBe(1);
  });
});

describe('Rival Tournament', () => {
  it('can be entered once a rival is met, then each round is placed until played, ending in the final', () => {
    const run = fresh('tour-flow');
    run.money = 2000;
    run.story.rivals.push({ encounters: 2 } as never);
    expect(eligibleEvents(content, run).map((e) => e.id)).toContain('tournament-entry');
    expect(eligibleEvents(content, run).map((e) => e.id)).not.toContain('tournament-quarter');
    expect(tournamentEventId(run)).toBeNull();
    setTournament(content, run, 1);
    expect(eligibleEvents(content, run).map((e) => e.id)).not.toContain('tournament-entry');
    addEventStops(content, run);
    expect(stops(run)).toContain('tournament-quarter');
    setTournament(content, run, 3);
    expect(tournamentEventId(run)).toBe('tournament-final');
    setTournament(content, run, 9);
    expect(tournamentRound(run)).toBe(9);
    expect(tournamentEventId(run)).toBeNull();
    expect(run.story.chronicle.at(-1)!.text).toContain('circuit finished');
  });

  it('entering costs the fee; the round fights pay the next round on a win', () => {
    const run = fresh('tour-enter');
    run.money = 1000;
    run.story.rivals.push({ encounters: 1 } as never);
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'event-t', kind: 'event', used: false, eventId: 'tournament-entry' });
    run.stage!.current = node.id;
    const r = chooseEvent(content, run, 'event-t', 0);
    expect(r.run.money).toBe(700);
    expect(tournamentRound(r.run)).toBe(1);
    const quarter = content.events.get('tournament-quarter')!;
    const winEffects = quarter.choices[0]!.success.battle!.win.map((e) => e.kind);
    expect(winEffects).toContain('tournament');
    expect(content.events.get('tournament-final')!.choices[0]!.success.battle!.win.some((e) => e.kind === 'tournament' && e.round === 9)).toBe(true);
  });
});

describe('Rival Gauntlet', () => {
  it('sends the ranked rivals one a stage, and pays out when the chain is done', async () => {
    const g = await import('../../src/core/story/gauntlet');
    const run = fresh('gauntlet');
    expect(g.startGauntlet(content, run, 3)).toBe(0);
    const mk = (id: string, potential: number) => ({ id, name: id, classId: 'psychic', state: 'recurring', rivalPotential: potential, progress: 0, encounters: 2, cooldown: 0 }) as never;
    const classId = [...content.trainers.keys()][0]!;
    run.story.rivals.push({ ...(mk('a', 50) as object), classId } as never, { ...(mk('b', 40) as object), classId } as never);
    expect(g.gauntletRival(content, run)).toBeNull();
    expect(g.startGauntlet(content, run, 3)).toBe(2);
    const first = g.gauntletRival(content, run)!;
    expect(first.id).toBe('a');
    g.markGauntletFight(run, first);
    expect(g.gauntletRival(content, run)).toBeNull();
    expect(g.gauntletWon(content, run, 'a')).toContain('1 rival left');
    run.stage!.index += 1;
    const second = g.gauntletRival(content, run)!;
    expect(second.id).toBe('b');
    g.markGauntletFight(run, second);
    const before = run.money;
    expect(g.gauntletWon(content, run, 'b')).toContain('Gauntlet cleared');
    expect(run.money).toBe(before + content.story.gauntlet.money);
    expect(g.gauntletLeft(run)).toBe(0);
    expect(g.gauntletWon(content, run, 'b')).toBeNull();
  });
});

describe('Champion defense', () => {
  it('remembers the newest won run team and offers the defense only then', async () => {
    const { createRun: make } = await import('../../src/core/run');
    const { championTeam } = await import('../../src/core/story/championDefense');
    const rec = (victory: boolean, speciesId: string) => ({ victory, party: [{ speciesId, level: 60, shiny: false }] }) as never;
    const none = make(content, { runId: 'cd-0', seed: 'cd-0', archetypeId: 'red', runHistory: [rec(false, 'pikachu')] });
    expect(championTeam(none.story)).toEqual([]);
    expect(eligibleEvents(content, { ...none, regionIndex: 3 }).map((e) => e.id)).not.toContain('champion-defense');
    const won = make(content, { runId: 'cd-1', seed: 'cd-1', archetypeId: 'red', runHistory: [rec(false, 'rattata'), rec(true, 'pikachu'), rec(true, 'charmander')] });
    expect(championTeam(won.story)).toEqual([{ speciesId: 'pikachu', level: 60 }]);
    expect(eligibleEvents(content, { ...won, regionIndex: 3 }).map((e) => e.id)).toContain('champion-defense');
  });
});

describe('Rival feud', () => {
  it('needs two hostile feuding rivals, backing one allies it and angers the other, and each feud settles once', async () => {
    const f = await import('../../src/core/story/feud');
    const run = fresh('feud');
    const classId = [...content.trainers.keys()][0]!;
    const rival = (id: string, rivalPotential: number) => ({ id, name: id, classId, state: 'recurring', rivalPotential, progress: 0, encounters: 1, cooldown: 0 }) as never;
    run.story.rivals.push(rival('a', 30), rival('b', 50));
    expect(f.openFeud(run)).toBeNull();
    run.story.rivalGraph.push({ a: 'a', b: 'b', kind: 'enemies' });
    expect(f.openFeud(run)!.map((r) => r.id)).toEqual(['b', 'a']);
    expect(eligibleEvents(content, run).map((e) => e.id)).toContain('rival-feud');
    expect(f.settleFeud(content, run, 'second')).toContain('is your ally');
    const [a, b] = [run.story.rivals[0]!, run.story.rivals[1]!];
    expect(a.state).toBe('ally');
    expect(b.rivalPotential).toBe(60);
    expect(f.openFeud(run)).toBeNull();
    expect(f.settleFeud(content, run, 'exploit')).toBe('');
    expect(eligibleEvents(content, run).map((e) => e.id)).not.toContain('rival-feud');
  });
});

describe('Relics and the Camp Council', () => {
  it('a relic adds its upside and downside once, and the camp is a rest spot', async () => {
    const { chooseEvent } = await import('../../src/core/events');
    const run = fresh('relic');
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'event-r', kind: 'event', used: false, eventId: 'relic-shrine' });
    run.stage!.current = node.id;
    const before = run.perkEffects?.length ?? 0;
    const r = chooseEvent(content, run, 'event-r', 0);
    expect(r.run.perkEffects!.length).toBe(before + 2);
    expect(r.run.perkEffects!.map((e) => e.kind)).toEqual(expect.arrayContaining(['hyperChanceMultiplier', 'rivalLevelOffset']));
    expect(content.events.get('camp-council')!.stop).toBe('rest');
    expect(content.events.get('camp-council')!.choices).toHaveLength(4);
  });
});

describe('World events', () => {
  it('a milestone is placed at the middle stage of a region, callbacks wait for what you did, and the old foe is the species that beat you most', async () => {
    const { oldFoe, noteLoss } = await import('../../src/core/story/promises');
    const run = fresh('world');
    run.stage!.index = 1;
    addEventStops(content, run);
    expect(stops(run).some((id) => id.startsWith('milestone-'))).toBe(false);
    run.stage!.index = 2;
    run.stage!.map.nodes.forEach((n) => (n.sides = []));
    addEventStops(content, run);
    expect(stops(run).some((id) => id.startsWith('milestone-'))).toBe(true);

    const ids = () => eligibleEvents(content, run).map((e) => e.id);
    expect(ids()).not.toContain('merchant-remembers');
    run.story.flags['ev:ignored-crisis'] = 1;
    expect(ids()).toContain('merchant-remembers');

    expect(oldFoe(run)).toBeNull();
    expect(ids()).not.toContain('old-foe-returns');
    noteLoss(run, 'a', 'rattata');
    noteLoss(run, 'b', 'pidgey');
    noteLoss(run, 'b', 'pidgey');
    expect(oldFoe(run)).toBe('pidgey');
    expect(ids()).toContain('old-foe-returns');

    run.regionIndex = Math.min(3, run.regionOrder.length - 1);
    expect(ids()).toContain('legend-clue-tracks');
    expect(ids()).not.toContain('legend-encounter');
    run.story.flags['ev:legend-clue'] = 3;
    expect(ids()).not.toContain('legend-clue-tracks');
    expect(ids()).toContain('legend-encounter');
  });
});
