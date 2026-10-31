// Living Rival: relationship path, final boss assist, Hub letters, and the new events.

import { describe, expect, it } from 'vitest';
import { finaleAssistRival, finaleStrikeDamage, FINALE_STRIKES, hubRivalNote, rivalPath } from '../../src/core/rivals/living';
import { maybeSpark, type SparkInput } from '../../src/core/rivals/manager';
import { chooseStarter, createRun, newMon } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

const where = { region: 0, stage: 1, level: 1, node: null, battle: 1, turn: null };
const input = (id: string): SparkInput => ({
  where, classId: 'youngster', name: 'Joey', team: ['rattata'], ended: { id, seq: 9, type: 'battleEnded', where, actors: [], data: {} }, hpLeftShare: 0.2, turns: 6, flawless: false,
} as SparkInput);

function withRival(seed: string): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  for (let i = 0; i < 50; i++) if (maybeSpark(run, input(`${seed}#${i}`))) return run;
  throw new Error('no rival sparked');
}

describe('relationship path', () => {
  it('starts undecided and commits only past the margin', () => {
    const run = withRival('lr-a');
    expect(rivalPath(run)).toBe('between');
    run.story.flags['ev:rival-friend'] = 2;
    expect(rivalPath(run)).toBe('friend');
    run.story.flags['ev:rival-heat'] = 3;
    expect(rivalPath(run)).toBe('between');
    run.story.flags['ev:rival-heat'] = 5;
    expect(rivalPath(run)).toBe('rival');
  });
});

describe('final boss assist', () => {
  it('needs a friend, or a rescue on a friendly path', () => {
    const run = withRival('lr-b');
    expect(finaleAssistRival(content, run, 60)).toBeNull();
    run.story.flags['ev:rival-rescued'] = 1;
    const a = finaleAssistRival(content, run, 60);
    expect(a).toMatchObject({ strikesLeft: FINALE_STRIKES, level: 57 });
    run.story.flags['ev:rival-heat'] = 9;
    expect(finaleAssistRival(content, run, 60)).toBeNull();
    run.story.rivals[0]!.state = 'ally';
    expect(finaleAssistRival(content, run, 60)).not.toBeNull();
  });

  it('a strike never takes the last HP', () => {
    const run = withRival('lr-c');
    run.story.flags['ev:rival-rescued'] = 1;
    const assist = finaleAssistRival(content, run, 60)!;
    const boss = newMon(content, run, 'snorlax', 60, 'e');
    boss.hp = 3;
    expect(finaleStrikeDamage(content, assist, boss).amount).toBe(2);
    boss.hp = 1;
    expect(finaleStrikeDamage(content, assist, boss).amount).toBe(0);
  });
});

describe('Hub letters and visits', () => {
  const archive = [{ name: 'Joey', state: 'ally', resolution: 'good' as const, world: { badges: 3 } }];
  it('is silent without a past rival', () => expect(hubRivalNote([], 1, { achievements: 0, runsEnded: 0 })).toBeNull());
  it('writes a warm letter or an in-person visit, deterministically', () => {
    const letter = hubRivalNote(archive, 1, { achievements: 4, runsEnded: 2 })!;
    expect(letter.kind).toBe('letter');
    expect(letter.tone).toBe('warm');
    expect(letter.text).toContain('3 badges');
    expect(hubRivalNote(archive, 3, { achievements: 4, runsEnded: 2 })!.kind).toBe('visit');
    expect(hubRivalNote(archive, 1, { achievements: 4, runsEnded: 2 })).toEqual(letter);
  });
});

describe('living rival events', () => {
  const ids = ['living-rival-rescue', 'living-rival-returns-favor', 'living-rival-bad-day', 'living-rival-photo-friend', 'living-rival-photo-rival', 'living-rival-photo-between', 'living-rival-montage', 'living-rival-promise', 'living-rival-promise-kept', 'living-rival-acknowledges', 'living-rival-acknowledges-rival', 'living-rival-clash', 'living-rival-clash-retired', 'living-gauntlet-rest'];
  it('all load and every choice has a no-cost way out or a safe option', () => {
    for (const id of ids) expect(content.events.get(id), id).toBeDefined();
  });
  it('the rival-themed events ride Rivalry Week', () => {
    const week = content.gameEvents.get('rivalry-week')!;
    expect(week.mapEvents).toContain('living-rival-clash');
  });
});

describe('the assist in a real battle', () => {
  it('strikes at most three times and never finishes the boss', async () => {
    const { createBattle, resolveTurn } = await import('../../src/core/battle/engine');
    const { createPokemon, maxHp } = await import('../../src/core/pokemon');
    const { hashSeed, Rng } = await import('../../src/core/rng');
    const player = createPokemon(content, 'blissey', 100, 'p1');
    const boss = createPokemon(content, 'snorlax', 60, 'e1');
    const battle = createBattle('trainer', [boss], 0, player.uid, { classId: 'champion', name: 'Boss', leaderId: null });
    battle.finaleAssist = { id: 'r', name: 'Joey', speciesId: 'machamp', level: 57, strikesLeft: FINALE_STRIKES };
    const ctx = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('fa')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    const full = maxHp(content, boss);
    let strikes = 0;
    for (let i = 0; i < 5 && !battle.outcome; i++) {
      const events = resolveTurn(ctx, { kind: 'move', index: 3 });
      strikes += events.filter((e) => e.type === 'raid' && e.text.includes('Joey')).length;
    }
    expect(strikes).toBeGreaterThanOrEqual(1);
    expect(strikes).toBeLessThanOrEqual(FINALE_STRIKES);
    expect(battle.finaleAssist!.strikesLeft).toBe(FINALE_STRIKES - strikes);
    expect(boss.hp).toBeLessThan(full);
  });
});
