// The Bond Engine for your Pokémon and the seven events it unlocks:
// Refusal, New Move, Unplanned Combination, Rival Interruption, Pokémon Takes Initiative,
// Pokémon Recognition and the Emotional Turning Point.

import { describe, expect, it } from 'vitest';
import { adjustBond, bondMood, bondOf, enemyCombo, freshBond, playerCombo, revealMove, revealableMove, shapeAction, traitOf, wouldRefuse } from '../../src/core/bond';
import { trackFeelings } from '../../src/core/bond/feelings';
import { createBattle, type BattleEvent } from '../../src/core/battle/engine';
import { openingDrama, planDrama } from '../../src/core/drama';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { openHistory } from '../../src/core/story/record';
import { content, toBattle } from './helpers';

function battleRun(enemy = 'rattata', kind: 'wild' | 'trainer' = 'wild'): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'bd', seed: 'bond', archetypeId: 'red' }), 0));
  const lead = run.party[0]!;
  openHistory(content, run, lead.uid, lead.speciesId, 'starter');
  run.battle = createBattle(kind, [createPokemon(content, enemy, 10, 'e1')], 0, lead.uid, kind === 'trainer' ? { classId: 'youngster', name: 'Joey', leaderId: null } : null);
  run.phase = 'battle';
  return run;
}
const setMoves = (run: RunState, ids: string[]) => {
  run.party[0]!.moves = ids.map((id) => ({ id, pp: 20 }));
};
const mv = (side: 'player' | 'enemy', moveId: string): BattleEvent => ({ type: 'move', side, moveId });

describe('bond values', () => {
  it('gives every Pokémon a stable trait and starting values by how it joined', () => {
    expect(traitOf('abc')).toBe(traitOf('abc'));
    expect(freshBond('abc', 'starter').trust).toBeGreaterThan(freshBond('abc', 'caught').trust);
  });
  it('is kept in the Pokémon story history and clamps', () => {
    const run = battleRun();
    const b = bondOf(run, run.party[0]!.uid);
    adjustBond(b, { trust: 200, strain: -200 });
    expect([b.trust, b.strain]).toEqual([100, 0]);
    expect(run.story.histories[run.party[0]!.uid]!.bond).toBe(b);
  });
});

describe('Refusal', () => {
  it('a willful Pokémon that distrusts you refuses a reckless order once; others obey', () => {
    const run = battleRun();
    setMoves(run, ['explosion', 'tackle']);
    const mon = run.party[0]!;
    const b = bondOf(run, mon.uid);
    Object.assign(b, { autonomy: 80, trust: 20 });
    expect(bondMood(b)).toBe('wary');
    expect(wouldRefuse(content, run, mon, 'explosion')).toBe(true);
    expect(wouldRefuse(content, run, mon, 'tackle')).toBe(false);
    const out = shapeAction(content, run, { kind: 'move', index: 0 });
    expect(out.action).toEqual({ kind: 'idle' });
    expect(out.events[0]).toMatchObject({ type: 'refused', uid: mon.uid, moveId: 'explosion' });
    expect(shapeAction(content, run, { kind: 'move', index: 0 }).action).toEqual({ kind: 'move', index: 0 });
    const calm = battleRun();
    setMoves(calm, ['explosion']);
    Object.assign(bondOf(calm, calm.party[0]!.uid), { autonomy: 80, trust: 60 });
    expect(shapeAction(content, calm, { kind: 'move', index: 0 }).action).toEqual({ kind: 'move', index: 0 });
  });
  it('a refused turn still plays: the foe moves, nothing explodes, the battle goes on', () => {
    let run = toBattle(chooseStarter(content, createRun(content, { runId: 'rf', seed: 'refuse', archetypeId: 'red' }), 0));
    openHistory(content, run, run.party[0]!.uid, run.party[0]!.speciesId, 'starter');
    run.party[0]!.moves = [{ id: 'explosion', pp: 5 }];
    Object.assign(bondOf(run, run.party[0]!.uid), { autonomy: 90, trust: 10 });
    const hpBefore = run.party[0]!.hp;
    const result = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(result.events.some((e) => e.type === 'refused')).toBe(true);
    expect(result.events.some((e) => e.type === 'selfKo')).toBe(false);
    expect(result.run.battle!.turn).toBe(run.battle!.turn + 1);
    expect(result.run.party[0]!.hp).toBeLessThanOrEqual(hpBefore);
    run = result.run;
  });
});

describe('Pokémon Takes Initiative', () => {
  it('a synced Pokémon swaps a move that cannot hurt for its best one that can, once', () => {
    const run = battleRun('gastly');
    setMoves(run, ['tackle', 'ember']);
    const uid = run.party[0]!.uid;
    Object.assign(bondOf(run, uid), { synchronization: 85, trust: 70 });
    const out = shapeAction(content, run, { kind: 'move', index: 0 });
    expect(out.action).toEqual({ kind: 'move', index: 1 });
    expect(out.events[0]).toMatchObject({ type: 'initiative', from: 'tackle', to: 'ember' });
    expect(shapeAction(content, run, { kind: 'move', index: 0 }).action).toEqual({ kind: 'move', index: 0 });
  });
  it('does nothing without sync, without trust, or when the move works', () => {
    const run = battleRun('gastly');
    setMoves(run, ['tackle', 'ember']);
    expect(shapeAction(content, run, { kind: 'move', index: 0 }).events).toEqual([]);
    const ok = battleRun('rattata');
    setMoves(ok, ['tackle', 'ember']);
    Object.assign(bondOf(ok, ok.party[0]!.uid), { synchronization: 90, trust: 90 });
    expect(shapeAction(content, ok, { kind: 'move', index: 0 }).events).toEqual([]);
  });
});

describe('Unplanned Combination', () => {
  function pairRun() {
    const run = battleRun();
    const a = run.party[0]!;
    const b = createPokemon(content, 'rattata', 10, 'p2');
    run.party.push(b);
    openHistory(content, run, b.uid, b.speciesId, 'caught');
    for (const uid of [a.uid, b.uid]) Object.assign(bondOf(run, uid), { synchronization: 70 });
    return { run, a, b };
  }
  it('a practiced, synced pair hands over with +1 in its attacking stat, once', () => {
    const { run, a, b } = pairRun();
    run.story.relationships.push({ id: 'rel', kind: 'bond', a: { kind: 'pokemon', id: a.uid }, b: { kind: 'pokemon', id: b.uid }, stage: 1, open: true, formedAt: {} as never, history: [] } as never);
    const ev = playerCombo(content, run, a.uid, b.uid);
    expect(ev).toMatchObject({ type: 'combo', side: 'player' });
    expect(run.battle!.playerStages.atk + run.battle!.playerStages.spa).toBe(1);
    expect(playerCombo(content, run, a.uid, b.uid)).toBeNull();
  });
  it('needs a real Bond relationship and sync', () => {
    const { run, a, b } = pairRun();
    expect(playerCombo(content, run, a.uid, b.uid)).toBeNull();
    run.story.relationships.push({ id: 'rel', kind: 'bond', a: { kind: 'pokemon', id: a.uid }, b: { kind: 'pokemon', id: b.uid }, stage: 1, open: true, formedAt: {} as never, history: [] } as never);
    bondOf(run, b.uid).synchronization = 10;
    expect(playerCombo(content, run, a.uid, b.uid)).toBeNull();
  });
  it('a rival who knows you well sends the next partner in with a boost', () => {
    const run = battleRun('rattata', 'trainer');
    run.battle!.enemyTeam.push(createPokemon(content, 'pidgey', 10, 'e2'));
    run.battle!.rivalId = 'r1';
    run.story.rivals.push({ id: 'r1', encounters: 3, traits: { adaptability: 80 }, bonds: {} } as never);
    run.battle!.enemyTeam[0]!.hp = 0;
    run.battle!.enemyIndex = 1;
    expect(enemyCombo(content, run, 0)).toMatchObject({ type: 'combo', side: 'enemy' });
    expect(enemyCombo(content, run, 0)).toBeNull();
  });
});

describe('New Move', () => {
  it('reveals the strongest valid learnset move, only at half HP and only for a trusted Pokémon', () => {
    const run = battleRun();
    const mon = run.party[0]!;
    mon.level = 40;
    mon.moves = [mon.moves[0]!];
    const pick = revealableMove(content, mon);
    expect(pick).not.toBeNull();
    const known = new Set(mon.moves.map((m) => m.id));
    expect(known.has(pick!.moveId)).toBe(false);
    expect(revealMove(content, run, 'player', false)).toBeNull(); // full HP
    mon.hp = Math.floor(mon.hp / 3);
    expect(revealMove(content, run, 'player', false)).toBeNull(); // no trust yet
    Object.assign(bondOf(run, mon.uid), { trust: 80, synchronization: 70 });
    const ev = revealMove(content, run, 'player', false);
    expect(ev).toMatchObject({ type: 'newMove', moveId: pick!.moveId });
    expect(mon.moves.some((m) => m.id === pick!.moveId)).toBe(true);
    expect(revealMove(content, run, 'player', false)).toBeNull(); // once per battle
  });
  it('a confident rival Pokémon replaces its weakest move with a stronger valid one', () => {
    const run = battleRun('charizard', 'trainer');
    const e = run.battle!.enemyTeam[0]!;
    e.level = 60;
    e.moves = [{ id: 'growl', pp: 20 }, { id: 'tackle', pp: 20 }, { id: 'ember', pp: 20 }, { id: 'scratch', pp: 20 }];
    e.hp = Math.floor(e.hp / 3);
    expect(revealMove(content, run, 'enemy', false)).toBeNull();
    const ev = revealMove(content, run, 'enemy', true);
    expect(ev).toMatchObject({ type: 'newMove', side: 'enemy' });
    expect(e.moves).toHaveLength(4);
    expect(e.moves.some((m) => m.id === 'growl')).toBe(false);
  });
});

describe('library lines for the new events', () => {
  const rivalOf = (over: object = {}) => ({ id: 'r1', encounters: 1, setbacks: 0, state: 'active', adaptations: [], bonds: {}, cooldown: 0, traits: { ambition: 50, pride: 40, empathy: 50, adaptability: 40, vindictiveness: 30, resilience: 50 }, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: ['rattata'], foes: [] as string[] } }, ...over }) as never;
  const lineFor = (run: RunState, events: BattleEvent[], id: string) => planDrama(content, run, structuredClone(run.battle!), events, 'high').find((l) => l.cue?.event === id);
  it('Refusal, Initiative, Combination and New Move get the trainer’s reaction', () => {
    for (const [type, id] of [['refused', 'refusal'], ['initiative', 'takesInitiative'], ['combo', 'unplannedCombination'], ['newMove', 'newMove']] as const) {
      const run = battleRun('rattata', 'trainer');
      run.battle!.ai = 0.9;
      const ev = { type, side: 'player', uid: 'u', moveId: 'tackle', from: 'a', to: 'b', stat: 'atk', replaced: null } as unknown as BattleEvent;
      expect(lineFor(run, [ev], id), id).toBeDefined();
    }
  });
  it('Recognition: only when the rival’s Pokémon really met yours', () => {
    const run = battleRun('rattata', 'trainer');
    run.battle!.rivalId = 'r1';
    run.battle!.ai = 0.9;
    run.encountersCompleted = 3;
    const lead = run.party[0]!.uid;
    run.story.rivals.push(rivalOf({ memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: ['rattata'], foes: [lead] } } }));
    expect(openingDrama(content, run, 'high').some((l) => l.cue?.event === 'pokemonRecognition')).toBe(true);
    const strangers = battleRun('rattata', 'trainer');
    strangers.battle!.rivalId = 'r1';
    strangers.story.rivals.push(rivalOf());
    expect(openingDrama(content, strangers, 'high').some((l) => l.cue?.event === 'pokemonRecognition')).toBe(false);
  });
  it('Rival Interruption: a second rival watches a big battle and a lasting tie forms', () => {
    let found = false;
    for (let n = 0; n < 40 && !found; n++) {
      const run = battleRun('rattata', 'trainer');
      run.battle!.trainer = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
      run.battle!.rivalId = 'r1';
      run.encountersCompleted = n;
      run.story.rivals.push(rivalOf(), rivalOf({ id: 'r2', name: 'Blue', classId: 'youngster' }));
      const lines = openingDrama(content, run, 'high');
      const l = lines.find((x) => x.cue?.event === 'rivalInterruption');
      if (l) {
        found = true;
        expect(l.speaker).toContain('Blue');
        expect(run.story.rivalGraph).toHaveLength(1);
        expect(run.story.chronicle.some((c) => c.text.includes('Interruption'))).toBe(true);
      }
    }
    expect(found).toBe(true);
    const alone = battleRun('rattata', 'trainer');
    alone.battle!.trainer = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
    alone.battle!.rivalId = 'r1';
    alone.story.rivals.push(rivalOf());
    expect(openingDrama(content, alone, 'high').some((l) => l.cue?.event === 'rivalInterruption')).toBe(false);
  });
});

describe('Emotional Turning Point', () => {
  const superHit = (side: 'player' | 'enemy'): BattleEvent => ({ type: 'damage', side, amount: 5, hpAfter: 50, effectiveness: 2, crit: false });
  it('the third time a Pokémon weathers the same thing, it finds a feeling (once)', () => {
    const run = battleRun('rattata', 'trainer');
    const prior = structuredClone(run);
    expect(trackFeelings(content, prior, run, [superHit('enemy'), superHit('enemy')])).toEqual([]);
    const out = trackFeelings(content, prior, run, [superHit('enemy')]);
    expect(out).toEqual([expect.objectContaining({ type: 'turningPoint', side: 'enemy', emotion: 'bravery' })]);
    expect(trackFeelings(content, prior, run, [superHit('enemy'), superHit('enemy'), superHit('enemy')])).toEqual([]);
  });
  it('yours becomes a tagged memory; the trainer talks about theirs', () => {
    const run = battleRun('rattata', 'trainer');
    const prior = structuredClone(run);
    const out = trackFeelings(content, prior, run, [superHit('player'), superHit('player'), superHit('player')]);
    expect(out[0]).toMatchObject({ side: 'player', emotion: 'bravery' });
    expect(run.story.histories[run.party[0]!.uid]!.memories.some((m) => m.emotions.includes('bravery'))).toBe(true);
    const foe = battleRun('rattata', 'trainer');
    foe.battle!.ai = 0.9;
    const tp: BattleEvent = { type: 'turningPoint', side: 'enemy', uid: 'e1', emotion: 'bravery' };
    expect(planDrama(content, foe, structuredClone(foe.battle!), [tp], 'high').some((l) => l.cue?.event === 'emotionalTurningPoint')).toBe(true);
  });
});
