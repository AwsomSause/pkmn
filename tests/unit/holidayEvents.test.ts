// Holiday and themed game events and the Spooky pack (plan Part 4b, Untitled doc §16.4 and §17.2):
// yearly windows, the Event Archive, holiday stops and their counters, Spooky forms, the Spooky Set
// and the Hex Maniac, and rewards that pay once with a fallback for repeats.

import { describe, expect, it } from 'vitest';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { chooseEvent, eligibleEvents } from '../../src/core/events';
import { activeGameEvents, archiveEventOn, holidayCalendar, nextWindowIn, rewardEarned } from '../../src/core/gameEvents';
import { createPokemon } from '../../src/core/pokemon';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { trainerStatus } from '../../src/core/progress';
import { spookyWild } from '../../src/core/rules';
import { eligibleSpecies, poolStatus } from '../../src/core/runPrep';
import { chooseStarter, createRun, takeTurn, type TurnResult } from '../../src/core/run';
import { specialFamily } from '../../src/core/specialForms';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

const NOW = '2026-10-30T12:00:00.000Z';
const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const SPOOKY_STOPS = [...content.events.values()].filter((e) => e.gameEvent === 'spooky-season').map((e) => e.id);

function runIn(editions: string[], seed = 'hol', archetypeId = 'red'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId, gameEvents: editions }), 0);
}

function atEvent(run: RunState, eventId: string): RunState {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  node.sides.push({ id: 'test-event', kind: 'event', used: false, eventId });
  return run;
}

function win(run: RunState): TurnResult {
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 80 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    run.party[0]!.moves[0]!.pp = 64;
    turn = takeTurn(content, run, { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

function finished(editions: string[], counters: Record<string, number>, seed: string): RunState {
  const run = runIn(editions, seed);
  run.log.counters = { ...run.log.counters, ...counters };
  run.phase = 'over';
  return run;
}

const ALL_SPOOKY = { gymLeadersDefeated: 3, eventClues: 8, eventBossesWon: 1, 'defeatedOrCaught.ghost': 15, eventFinalesWon: 1 };

describe('the holiday calendar', () => {
  it('has twelve holiday and themed events, each with its own stops and 3–5 objectives', () => {
    const yearly = [...content.gameEvents.values()].filter((e) => e.schedule.kind === 'yearly');
    expect(yearly.length).toBeGreaterThanOrEqual(12);
    for (const e of yearly) {
      expect(e.objectives.length, e.id).toBeGreaterThanOrEqual(3);
      expect([...content.events.values()].some((m) => m.gameEvent === e.id), `${e.id} owns a stop`).toBe(true);
    }
  });

  it('Spooky Season is on in October, with its own yearly edition, and off in mid-November', () => {
    const on = activeGameEvents(content, at('2026-10-15')).find((a) => a.event.id === 'spooky-season');
    expect(on?.edition).toBe('spooky-season@2026');
    expect(on?.archive).toBeUndefined();
    expect(activeGameEvents(content, at('2026-11-20')).some((a) => a.event.id === 'spooky-season' && !a.archive)).toBe(false);
    // The Winter Festival wraps the new year and belongs to the year it started.
    expect(activeGameEvents(content, at('2027-01-02')).find((a) => a.event.id === 'winter-festival')?.edition).toBe('winter-festival@2026');
  });

  it('lists every holiday soonest first, with when it starts', () => {
    const cal = holidayCalendar(content, at('2026-10-30'));
    expect(cal[0]!.event.id).toBe('spooky-season');
    expect(cal[0]!.startsIn).toBe(0);
    for (let i = 1; i < cal.length; i++) expect(cal[i]!.startsIn).toBeGreaterThanOrEqual(cal[i - 1]!.startsIn);
    expect(nextWindowIn(content.gameEvents.get('winter-festival')!, at('2026-10-30'))).toBe(Date.UTC(2026, 11, 15) - at('2026-10-30').getTime());
  });
});

describe('the Event Archive', () => {
  it('brings back one resting holiday each week, the same all week, and every one within a year', () => {
    const monday = at('2026-11-09');
    const a = archiveEventOn(content, monday)!;
    expect(a.schedule.kind).toBe('yearly');
    expect(archiveEventOn(content, at('2026-11-15'))!.id).toBe(a.id);
    const back = activeGameEvents(content, monday).find((x) => x.archive)!;
    expect(back.edition).toBe(`${a.id}@archive-2026-W46`);
    // Never an event that is in its own window.
    for (let w = 0; w < 52; w++) {
      const d = new Date(monday.getTime() + w * 7 * 86_400_000);
      const pick = archiveEventOn(content, d)!;
      expect(activeGameEvents(content, d).filter((x) => x.event.id === pick.id)).toHaveLength(1);
    }
    const seen = new Set<string>();
    for (let w = 0; w < 52; w++) seen.add(archiveEventOn(content, new Date(monday.getTime() + w * 7 * 86_400_000))!.id);
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});

describe('the Spooky pack in a run', () => {
  it('Spooky stops only appear while Spooky Season is on (or back from the Archive), or for the Hex Maniac', () => {
    expect(SPOOKY_STOPS.length).toBeGreaterThanOrEqual(6);
    const ids = (run: RunState) => eligibleEvents(content, run).map((e) => e.id);
    expect(ids(runIn([])).some((id) => SPOOKY_STOPS.includes(id))).toBe(false);
    expect(ids(runIn(['spooky-season@2026'])).some((id) => SPOOKY_STOPS.includes(id))).toBe(true);
    expect(ids(runIn(['spooky-season@archive-2027-W10'])).some((id) => SPOOKY_STOPS.includes(id))).toBe(true);
    expect(ids(runIn([], 'hex', 'hex-maniac')).some((id) => SPOOKY_STOPS.includes(id))).toBe(true);
    // Other holidays' stops stay out of a Spooky run.
    expect(ids(runIn(['spooky-season@2026'])).includes('winter-gift-exchange')).toBe(false);
  });

  it('turns about the right share of wild Pokémon into Spooky forms, the same every reload', () => {
    const run = runIn([], 'spooky-wild');
    let turned = 0;
    for (let i = 0; i < 500; i++) if (specialFamily(content.species.get(spookyWild(content, run, 'rattata', `wild:${i}`, 0.2))!) === 'spooky') turned++;
    expect(turned).toBeGreaterThan(60);
    expect(turned).toBeLessThan(140);
    expect(spookyWild(content, run, 'rattata', 'wild:7', 0.2)).toBe(spookyWild(content, run, 'rattata', 'wild:7', 0.2));
    for (let i = 0; i < 50; i++) expect(spookyWild(content, run, 'rattata', `wild:${i}`)).toBe('rattata');
  });

  it('clues, the Pumpkin King and the Midnight Parade count for the objectives', () => {
    const clue = chooseEvent(content, atEvent(runIn(['spooky-season@2026'], 'clue'), 'spooky-lost-spirit'), 'test-event', 0);
    expect(clue.run.log.counters.eventClues).toBe(2);
    const king = chooseEvent(content, atEvent(runIn(['spooky-season@2026'], 'king'), 'spooky-pumpkin-king'), 'test-event', 0);
    expect(king.run.phase).toBe('battle');
    const won = win(king.run);
    expect(won.run.log.counters.eventBossesWon).toBe(1);
    const parade = win(chooseEvent(content, atEvent(runIn(['spooky-season@2026'], 'parade'), 'spooky-midnight-finale'), 'test-event', 0).run);
    expect(parade.run.log.counters.eventFinalesWon).toBe(1);
  });
});

describe('Spooky Season rewards', () => {
  it('the Spooky Set and the Hex Maniac are locked until every objective is done, then unlocked once', () => {
    let p = createProfile(content, 'p');
    const spooky = content.starterPools.get('spooky')!;
    const hex = content.archetypes.get('hex-maniac')!;
    expect(poolStatus(content, p, spooky)).toBe('locked');
    expect(trainerStatus(p, hex)).toBe('locked');
    p = finalizeRun(content, p, finished(['spooky-season@2026'], { ...ALL_SPOOKY, eventFinalesWon: 0 }, 'a'), NOW).profile;
    expect(rewardEarned(p, 'spooky-season')).toBe(false);
    const done = finalizeRun(content, p, finished(['spooky-season@2026'], { eventFinalesWon: 1 }, 'b'), NOW);
    p = done.profile;
    expect(done.summary!.gameEvents[0]!.final).toMatchObject({ fallback: false });
    expect(poolStatus(content, p, spooky)).toBe('unlocked');
    expect(trainerStatus(p, hex)).toBe('unlocked');
    expect(p.titles).toContain('Spooky Champion');
    // The Spooky Set offers the seven Spooky first stages.
    const ids = eligibleSpecies(content, spooky);
    expect(ids).toHaveLength(7);
    for (const id of ids) expect(specialFamily(content.species.get(id)!)).toBe('spooky');
    // A duplicate later (next year, or from the Archive) pays the fallback instead.
    const again = finalizeRun(content, p, finished(['spooky-season@archive-2027-W10'], ALL_SPOOKY, 'c'), NOW);
    expect(again.summary!.gameEvents[0]!.final).toMatchObject({ fallback: true });
    expect(again.profile.researchPoints).toBeGreaterThan(p.researchPoints);
    expect(again.profile.unlockedArchetypes.filter((id) => id === 'hex-maniac')).toHaveLength(1);
  });

  it('the Hex Maniac counts her own quest line', () => {
    const run = runIn([], 'hex-q', 'hex-maniac');
    run.log.counters = { ...run.log.counters, 'defeatedOrCaught.ghost': 25 };
    run.phase = 'over';
    const { summary } = finalizeRun(content, createProfile(content, 'p'), run, NOW);
    expect(summary!.questSteps.map((s) => s.trainerId)).toContain('hex-maniac');
  });

  it('flags a reward that gives an unknown trainer', () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    raw.gameEvents.events.find((e: any) => e.id === 'spooky-season').reward.trainer = 'nobody';
    expect(() => buildContent(raw)).toThrow('unknown trainer "nobody"');
  });
});
