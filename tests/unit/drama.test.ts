// Battle Drama Engine slice 1: events, dialogue, pacing, determinism, saves.

import { describe, expect, it } from 'vitest';
import { createBattle, type BattleEvent } from '../../src/core/battle/engine';
import { DRAMA, DIALOGUE_CATEGORIES, VOICES, battleClass, deriveDramaEvents, openingDrama, planDrama, voiceFor } from '../../src/core/drama';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { BattleStateSchema } from '../../src/core/state';
import { content } from './helpers';

function trainerRun(name = 'Joey', ai = 0): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'dr', seed: 'drama', archetypeId: 'red' }), 0));
  const enemy = createPokemon(content, 'rattata', 5, 'e1');
  run.battle = createBattle('trainer', [enemy], 0, run.party[0]!.uid, { classId: 'youngster', name, leaderId: null });
  run.battle.ai = ai;
  run.phase = 'battle';
  return run;
}

const move = (side: 'player' | 'enemy', moveId: string): BattleEvent => ({ type: 'move', side, moveId });
const faint = (side: 'player' | 'enemy', uid: string): BattleEvent => ({ type: 'faint', side, uid, participants: [] });

describe('drama data', () => {
  it('has lines for every category and voice', () => {
    for (const c of DIALOGUE_CATEGORIES) for (const v of VOICES) expect(DRAMA.lines[c][v].length).toBeGreaterThan(0);
  });
});

describe('opening and events', () => {
  it('speaks the opening once, never twice', () => {
    const run = trainerRun();
    const first = openingDrama(content, run);
    expect(first).toHaveLength(1);
    expect(first[0]!.category).toBe('opening');
    expect(openingDrama(content, run)).toHaveLength(0);
  });
  it('says nothing in wild battles', () => {
    const run = trainerRun();
    run.battle!.kind = 'wild';
    expect(openingDrama(content, run)).toEqual([]);
  });
  it('orders events by the turn and gives stable ids', () => {
    const run = trainerRun();
    const evs = deriveDramaEvents(content, run, run.battle!, [move('enemy', 'tackle'), faint('enemy', 'e1')]);
    expect(evs.map((e) => e.kind)).toEqual(['enemyMove', 'enemyFaint']);
    expect(evs.map((e) => e.at)).toEqual([0, 1]);
    expect(deriveDramaEvents(content, run, run.battle!, [move('enemy', 'tackle')])[0]!.id).toBe(evs[0]!.id);
  });
  it('does not repeat a line when the same turn is processed again (reload/re-render)', () => {
    const run = trainerRun();
    const prior = structuredClone(run.battle!);
    const events = [faint('enemy', 'e1')];
    expect(planDrama(content, run, prior, events)).toHaveLength(1);
    expect(planDrama(content, run, prior, events)).toHaveLength(0);
  });
});

describe('voices, pacing and determinism', () => {
  it('is deterministic for the same state', () => {
    const a = trainerRun();
    const b = trainerRun();
    expect(planDrama(content, a, a.battle!, [faint('enemy', 'e1')])).toEqual(planDrama(content, b, b.battle!, [faint('enemy', 'e1')]));
  });
  it('gives the same trainer a stable voice and different trainers can differ', () => {
    const voices = new Set(['Joey', 'Ben', 'Calvin', 'Timmy', 'Dan', 'Rick', 'Doug'].map((n) => voiceFor(trainerRun(n).battle!, undefined)));
    expect(voices.size).toBeGreaterThan(1);
    expect(voiceFor(trainerRun('Joey').battle!, undefined)).toBe(voiceFor(trainerRun('Joey').battle!, undefined));
  });
  it('a rival speaks in the voice of its traits', () => {
    const run = trainerRun();
    const rival = { traits: { ambition: 50, pride: 90, empathy: 10, adaptability: 10, vindictiveness: 10, resilience: 50 } } as never;
    expect(voiceFor(run.battle!, rival)).toBe('brash');
  });
  it('ordinary trainers stay within their small line budget; the ending still speaks', () => {
    const run = trainerRun();
    expect(battleClass(run.battle!)).toBe('ordinary');
    let shown = 0;
    for (let turn = 1; turn <= 12; turn++) {
      run.battle!.turn = turn;
      shown += planDrama(content, run, structuredClone(run.battle!), [faint('player', `p${turn}`), move('enemy', 'tackle')]).length;
    }
    expect(shown).toBeLessThanOrEqual(DRAMA.config.budget.ordinary);
    run.battle!.outcome = 'win';
    const end = planDrama(content, run, structuredClone(run.battle!), []);
    expect(end.map((l) => l.category)).toEqual(['defeat']);
  });
  it('never reuses a recent line', () => {
    const run = trainerRun('Joey', 0.9);
    const texts: string[] = [];
    for (let turn = 1; turn <= 10; turn++) {
      run.battle!.turn = turn;
      run.battle!.drama.lastLineTurn = -99;
      for (const l of planDrama(content, run, structuredClone(run.battle!), [faint('player', `p${turn}`)], 'high')) texts.push(l.text);
    }
    expect(new Set(texts).size).toBe(texts.length);
  });
  it('dialogue off silences everything, including the ending', () => {
    const run = trainerRun();
    run.battle!.outcome = 'win';
    expect(planDrama(content, run, structuredClone(run.battle!), [faint('enemy', 'e1')], 'off')).toEqual([]);
  });
  it('notices your repeated move only after you really used it three times', () => {
    const run = trainerRun('Joey', 0.9);
    const seen = [];
    for (let turn = 1; turn <= 3; turn++) {
      run.battle!.turn = turn;
      run.battle!.drama.lastLineTurn = -99;
      seen.push(planDrama(content, run, structuredClone(run.battle!), [move('player', 'tackle')], 'high').map((l) => l.category));
    }
    expect(seen[0]).toEqual([]);
    expect(seen[1]).toEqual([]);
    expect(seen[2]).toEqual(['taunt']);
  });
});

describe('saves and rivals', () => {
  it('drama state survives a save round trip and old battles load without it', () => {
    const run = trainerRun();
    openingDrama(content, run);
    const back = BattleStateSchema.parse(JSON.parse(JSON.stringify(run.battle)));
    expect(back.drama.lines).toBe(1);
    const { drama: _d, ...old } = JSON.parse(JSON.stringify(run.battle));
    expect(BattleStateSchema.parse(old).drama.seen).toEqual([]);
  });
  it('a returning rival calls back to its real last battle only', () => {
    const run = trainerRun();
    run.battle!.rivalId = 'r1';
    const rival = { id: 'r1', encounters: 1, traits: { ambition: 50, pride: 10, empathy: 10, adaptability: 10, vindictiveness: 90, resilience: 50 }, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: [] } } };
    run.story.rivals.push(rival as never);
    expect(openingDrama(content, run)[0]!.category).toBe('callbackWon');
    const fresh = trainerRun();
    fresh.battle!.rivalId = 'r2';
    fresh.story.rivals.push({ ...rival, id: 'r2', encounters: 0 } as never);
    expect(openingDrama(content, fresh)[0]!.category).toBe('opening');
  });
});
