// Battle Drama Engine slice 1: events, dialogue, pacing, determinism, saves.

import { describe, expect, it } from 'vitest';
import { createBattle, type BattleEvent } from '../../src/core/battle/engine';
import { NEUTRAL_BOND, rivalBond } from '../../src/core/drama/bond';
import { CHECKS } from '../../src/core/drama/events';
import { midBattleEvolution, trainingForm, withTrainingEvolution } from '../../src/core/drama/evolution';
import { calcStats } from '../../src/core/pokemon';
import { DRAMA, DRAMA_LIBRARY, freshDrama, DIALOGUE_CATEGORIES, VOICES, battleClass, deriveDramaEvents, openingDrama, planDrama, voiceFor } from '../../src/core/drama';
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
    expect(seen[2]).toEqual(['event']); // a boss sees the pattern: The Tactical Revelation
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
    const rival = { id: 'r1', encounters: 1, adaptations: [], traits: { ambition: 50, pride: 10, empathy: 10, adaptability: 10, vindictiveness: 90, resilience: 50 }, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: [] } } };
    run.story.rivals.push(rival as never);
    expect(openingDrama(content, run)[0]!.category).toBe('callbackWon');
    const fresh = trainerRun();
    fresh.battle!.rivalId = 'r2';
    fresh.story.rivals.push({ ...rival, id: 'r2', encounters: 0 } as never);
    expect(openingDrama(content, fresh)[0]!.category).toBe('opening');
  });
});

const dmg = (side: 'player' | 'enemy', amount = 10, hpAfter = 20): BattleEvent => ({ type: 'damage', side, amount, hpAfter, effectiveness: 1, crit: false });
const miss = (side: 'player' | 'enemy'): BattleEvent => ({ type: 'miss', side });

describe('signature attacks (Phase 4)', () => {
  it('a boss declares a strong move once, then reacts to how it went', () => {
    const run = trainerRun('Lance', 0.9);
    const hit = planDrama(content, run, structuredClone(run.battle!), [move('enemy', 'hyper-beam'), dmg('player')]);
    expect(hit.map((l) => l.category)).toContain('signature');
    expect(hit.find((l) => l.category === 'signature')!.cue?.moveId).toBe('hyper-beam');
    run.battle!.turn = 4;
    run.battle!.drama.lastLineTurn = -99;
    expect(planDrama(content, run, structuredClone(run.battle!), [move('enemy', 'hyper-beam'), dmg('player')]).map((l) => l.category)).not.toContain('signature');
  });
  it('an ordinary trainer with a team does not announce its strong move', () => {
    const run = trainerRun();
    run.battle!.enemyTeam.push(createPokemon(content, 'rattata', 5, 'e2'));
    const lines = planDrama(content, run, structuredClone(run.battle!), [move('enemy', 'hyper-beam'), dmg('player')]);
    expect(lines.map((l) => l.category)).not.toContain('signature');
  });
  it('a miss gets a miss reaction, not a celebration', () => {
    const run = trainerRun('Lance', 0.9);
    const lines = planDrama(content, run, structuredClone(run.battle!), [move('enemy', 'hyper-beam'), miss('enemy')]);
    expect(lines.some((l) => l.category === 'aftermath' || l.cue?.event === 'failedTechnique')).toBe(true);
  });
});

describe('event library (Phase 6)', () => {
  it('has all 20 guide events and 13 listed library kinds, planned ones have no check', () => {
    expect(DRAMA_LIBRARY.events.length).toBeGreaterThanOrEqual(20);
    for (const def of DRAMA_LIBRARY.events) {
      if (def.status === 'planned') expect(CHECKS[def.id], def.id).toBeUndefined();
      else expect(CHECKS[def.id], def.id).toBeDefined();
      expect(def.requires.length).toBeGreaterThan(0);
      if (def.status !== 'planned') expect(def.lines.length).toBeGreaterThan(0);
    }
  });
  it('only one big moment per turn, and a calm trainer goes quiet after the calm moment', () => {
    const run = trainerRun('Cyrus', 0.9);
    run.battle!.enemyTeam.push(createPokemon(content, 'rattata', 5, 'e2'));
    run.battle!.enemyIndex = 1;
    run.battle!.turn = 4;
    run.battle!.trainer = { classId: 'youngster', name: 'Calmy', leaderId: null };
    const lines = planDrama(content, run, structuredClone(run.battle!), [move('enemy', 'tackle'), dmg('player')]);
    expect(lines.filter((l) => l.tier === 'major').length).toBeLessThanOrEqual(1);
  });
  it('cooldown: an event does not repeat in the next battle', () => {
    const run = trainerRun('Lance', 0.9);
    run.battle!.enemyTeam.push(createPokemon(content, 'rattata', 5, 'e2'), createPokemon(content, 'rattata', 5, 'e3'));
    run.battle!.enemyIndex = 2;
    const send: BattleEvent = { type: 'switchIn', side: 'enemy', uid: 'e3', speciesId: 'rattata', level: 5 };
    const first = planDrama(content, run, structuredClone(run.battle!), [send]);
    expect(first.some((l) => l.cue?.event === 'aceReveal')).toBe(true);
    expect(run.story.chronicle.some((c) => c.text.includes('The Ace Reveal'))).toBe(true);
  });
  it('a rival remembers a real earlier moment at its next battle, and not without one', () => {
    const run = trainerRun('Gary');
    run.battle!.rivalId = 'r1';
    run.battle!.ai = 0.9;
    const rival = { id: 'r1', encounters: 1, adaptations: [], traits: { ambition: 50, pride: 10, empathy: 10, adaptability: 10, vindictiveness: 10, resilience: 50 }, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: [] } } };
    run.story.rivals.push(rival as never);
    run.encountersCompleted = 5;
    run.story.flags['drama:rival:r1:tacticalRevelation'] = '3|Thunderbolt';
    const lines = openingDrama(content, run);
    expect(lines.some((l) => l.text.includes('Thunderbolt'))).toBe(true);
    const none = trainerRun('Gary');
    none.battle!.rivalId = 'r1';
    none.story.rivals.push(rival as never);
    expect(openingDrama(content, none).some((l) => l.text.includes('Thunderbolt'))).toBe(false);
  });
});

describe('mid-battle evolution (Phase 5)', () => {
  function evoRun(level = 40) {
    const run = trainerRun('Gary');
    const ace = createPokemon(content, 'charmeleon', level, 'ace');
    run.battle!.enemyTeam = [ace];
    run.battle!.enemyIndex = 0;
    run.battle!.rivalId = 'r1';
    run.battle!.drama.evolvable.push('ace');
    run.battle!.turn = 3;
    return { run, ace };
  }
  it('finds the stage below a final form and only trains an ace already at its evolution level', () => {
    expect(trainingForm(content, 'charizard')).toMatchObject({ from: 'charmeleon' });
    const members = [{ speciesId: 'rattata', level: 40 }, { speciesId: 'charizard', level: 40 }] as never;
    const out = withTrainingEvolution(content, members);
    expect(out.index).toBe(1);
    expect(out.members[1]!.speciesId).toBe('charmeleon');
    expect(withTrainingEvolution(content, [{ speciesId: 'rattata', level: 30 }, { speciesId: 'charizard', level: 30 }] as never).index).toBe(-1);
    expect(withTrainingEvolution(content, [{ speciesId: 'charizard', level: 50 }] as never).index).toBe(-1);
  });
  it('evolves at the turn boundary, keeping status and damage taken, once', () => {
    const { run, ace } = evoRun();
    ace.status = { id: 'brn' } as never;
    ace.hp = Math.floor(ace.hp / 2);
    const hpBefore = ace.hp;
    const ev = midBattleEvolution(content, run);
    expect(ev).toMatchObject({ type: 'evolved', side: 'enemy', from: 'charmeleon', to: 'charizard' });
    expect(ace.speciesId).toBe('charizard');
    expect(ace.status).toMatchObject({ id: 'brn' });
    expect(ace.hp).toBeGreaterThan(hpBefore);
    expect(ace.hp).toBeLessThan(calcStats(content, ace).hp);
    expect(midBattleEvolution(content, run)).toBeNull();
    expect(run.story.chronicle.some((c) => c.type === 'evolved')).toBe(true);
  });
  it('does not evolve early, when not allowed, when fainted or after the battle ended', () => {
    const early = evoRun();
    early.run.battle!.turn = 1;
    expect(midBattleEvolution(content, early.run)).toBeNull();
    const notAllowed = evoRun();
    notAllowed.run.battle!.drama.evolvable = [];
    expect(midBattleEvolution(content, notAllowed.run)).toBeNull();
    const fainted = evoRun();
    fainted.ace.hp = 0;
    expect(midBattleEvolution(content, fainted.run)).toBeNull();
    const over = evoRun();
    over.run.battle!.outcome = 'win';
    expect(midBattleEvolution(content, over.run)).toBeNull();
  });
  it('the trainer reacts, the rival remembers it later, and a replay says nothing twice', () => {
    const { run } = evoRun();
    run.story.rivals.push({ id: 'r1', encounters: 1, adaptations: [], traits: { ambition: 50, pride: 10, empathy: 10, adaptability: 10, vindictiveness: 10, resilience: 50 }, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: [] } } } as never);
    const ev = midBattleEvolution(content, run)!;
    const prior = structuredClone(run.battle!);
    const lines = planDrama(content, run, prior, [ev]);
    expect(lines.some((l) => l.cue?.event === 'midBattleEvolution')).toBe(true);
    expect(planDrama(content, run, prior, [ev])).toHaveLength(0);
    run.encountersCompleted += 1;
    run.battle!.drama = freshDrama();
    expect(openingDrama(content, run).some((l) => l.text.includes('Charizard'))).toBe(true);
  });
});

const RIVAL_TRAITS = { ambition: 50, pride: 40, empathy: 70, adaptability: 40, vindictiveness: 30, resilience: 50 };
const mkRival = (over: object = {}) => ({ id: 'r1', encounters: 1, setbacks: 0, state: 'active', adaptations: [], traits: { ...RIVAL_TRAITS }, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: [] } }, ...over }) as never;

describe('bond values and memories (Phase 7, §9)', () => {
  it('derives bond values from real rival data and neutral values for everyone else', () => {
    expect(rivalBond(undefined)).toEqual(NEUTRAL_BOND);
    const b = rivalBond(mkRival({ setbacks: 2 }));
    expect(b.trust).toBe(70);
    expect(b.strain).toBeGreaterThan(30);
    expect(b.confidence).toBe(30);
  });
  it('a kind rival who shows mercy changes its philosophy and says so next time', () => {
    const run = trainerRun('Gary', 0.9);
    run.battle!.rivalId = 'r1';
    const rival = mkRival();
    run.story.rivals.push(rival);
    run.battle!.turn = 2;
    run.party[0]!.hp = 1;
    const lines = planDrama(content, run, structuredClone(run.battle!), [move('enemy', 'tackle')], 'high');
    expect(lines.some((l) => l.cue?.event === 'mercyMoment')).toBe(true);
    expect((rival as { traits: typeof RIVAL_TRAITS }).traits.empathy).toBe(80);
    expect((rival as { traits: typeof RIVAL_TRAITS }).traits.vindictiveness).toBe(20);
    run.encountersCompleted += 1;
    run.battle!.drama = freshDrama();
    expect(openingDrama(content, run).some((l) => l.text.includes('winning was all that mattered'))).toBe(true);
  });
  it('a hidden-info check: the trainer only mentions moves you really used', () => {
    const run = trainerRun('Lance', 0.9);
    const said: string[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      run.battle!.turn = turn;
      run.battle!.drama.lastLineTurn = -99;
      for (const l of planDrama(content, run, structuredClone(run.battle!), [move('player', 'tackle')], 'high')) said.push(l.text);
    }
    expect(said.join(' ')).toContain('Tackle');
    expect(said.join(' ')).not.toMatch(/Thunderbolt|Flamethrower|Surf/);
  });
  it('low hides small lines and off hides all, but what is recorded is the same', () => {
    const run = (f: 'high' | 'low' | 'off') => {
      const r = trainerRun('Lance', 0.9);
      r.battle!.rivalId = 'r1';
      r.story.rivals.push(mkRival());
      r.battle!.turn = 4;
      r.battle!.enemyTeam.push(createPokemon(content, 'rattata', 5, 'e2'));
      r.battle!.enemyIndex = 0;
      const lines = planDrama(content, r, structuredClone(r.battle!), [faint('player', 'p1'), move('enemy', 'hyper-beam'), dmg('player')], f);
      return { lines, seen: r.battle!.drama.seen.filter((s) => s.startsWith('ev:')), chronicle: r.story.chronicle.length };
    };
    const high = run('high');
    const low = run('low');
    const off = run('off');
    expect(off.lines).toHaveLength(0);
    expect(low.lines.every((l) => l.tier === 'major' || l.tier === 'climactic')).toBe(true);
    expect(low.lines.length).toBeLessThanOrEqual(high.lines.length);
    expect(off.seen).toEqual(high.seen);
    expect(off.chronicle).toBe(high.chronicle);
  });
});

describe('scripted scenarios (Phase 9)', () => {
  it('1. an ordinary trainer battle stays short', () => {
    const run = trainerRun('Joey');
    const all = [...openingDrama(content, run)];
    for (let turn = 1; turn <= 5; turn++) {
      run.battle!.turn = turn;
      all.push(...planDrama(content, run, structuredClone(run.battle!), [move('player', 'tackle'), dmg('enemy'), move('enemy', 'tackle'), dmg('player')]));
    }
    run.battle!.outcome = 'win';
    all.push(...planDrama(content, run, structuredClone(run.battle!), [faint('enemy', 'e1')]));
    expect(all.length).toBeLessThanOrEqual(DRAMA.config.budget.ordinary + 1);
    expect(all[0]!.category).toBe('opening');
    expect(all[all.length - 1]!.category).toBe('defeat');
    expect(all.some((l) => l.cue?.event)).toBe(false);
  });
  it('2. a rivalry rematch: recognition, a noticed tactic, a remembered moment next time', () => {
    const run = trainerRun('Gary', 0.9);
    run.battle!.rivalId = 'r1';
    run.battle!.rival = true;
    run.story.rivals.push(mkRival());
    const opening = openingDrama(content, run);
    expect(opening[0]!.category).toBe('callbackWon');
    const turns: string[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      run.battle!.turn = turn;
      run.battle!.drama.lastLineTurn = -99;
      for (const l of planDrama(content, run, structuredClone(run.battle!), [move('player', 'tackle'), dmg('enemy')], 'high')) turns.push(l.cue?.event ?? l.category);
    }
    expect(turns).toContain('tacticalRevelation');
    run.battle!.outcome = 'win';
    expect(planDrama(content, run, structuredClone(run.battle!), [faint('enemy', 'e1')]).some((l) => l.category === 'defeat')).toBe(true);
    run.encountersCompleted += 1;
    run.battle!.drama = freshDrama();
    run.battle!.outcome = null;
    run.battle!.turn = 1;
    expect(openingDrama(content, run).some((l) => l.text.includes('Tackle'))).toBe(true);
  });
  it('3. a major battle: the ace evolves, the rival reacts, grows, and remembers', () => {
    const run = trainerRun('Gary', 0.9);
    const ace = createPokemon(content, 'charmeleon', 40, 'ace');
    run.battle!.enemyTeam = [createPokemon(content, 'rattata', 40, 'e0'), ace];
    run.battle!.enemyIndex = 1;
    run.battle!.rivalId = 'r1';
    run.battle!.drama.evolvable.push('ace');
    run.battle!.turn = 3;
    const rival = mkRival();
    run.story.rivals.push(rival);
    const ev = midBattleEvolution(content, run)!;
    expect(ace.speciesId).toBe('charizard');
    const lines = planDrama(content, run, structuredClone(run.battle!), [ev], 'high');
    expect(lines.some((l) => l.cue?.event === 'midBattleEvolution' && l.tier === 'climactic')).toBe(true);
    expect((rival as { traits: typeof RIVAL_TRAITS }).traits.ambition).toBe(58);
    expect(run.story.chronicle.some((c) => c.text.includes('found a new battle style'))).toBe(true);
    run.battle!.outcome = 'win';
    run.battle!.drama.lastLineTurn = -99;
    expect(planDrama(content, run, structuredClone(run.battle!), [faint('enemy', 'ace')]).at(-1)!.category).toBe('defeat');
  });
});

describe('fair AI influence', () => {
  it('a noticed tactic makes a smart trainer pick its best move more often, only after you really repeated it', () => {
    const run = trainerRun('Lance', 0.5);
    for (let turn = 1; turn <= 2; turn++) {
      run.battle!.turn = turn;
      planDrama(content, run, structuredClone(run.battle!), [move('player', 'tackle')], 'off');
    }
    expect(run.battle!.ai).toBe(0.5);
    run.battle!.turn = 3;
    planDrama(content, run, structuredClone(run.battle!), [move('player', 'tackle')], 'off');
    expect(run.battle!.ai).toBeCloseTo(0.65);
  });
});
