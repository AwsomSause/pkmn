// M8.9 Hyper evolutions (Overdrive blueprint §4): a Mega, Z-Move, Dynamax or Tera at a decisive
// moment gets its own banner, line and memory; the transformation rules are untouched.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunEvent } from '../../src/core/run';
import { recordBattleTurn } from '../../src/core/story/hooks';
import { maxHp } from '../../src/core/pokemon';
import { content, toBattle } from './helpers';

type Transform = Extract<RunEvent, { type: 'transform' }>;

function setup(seed: string) {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0)));
  const mon = run.party[0]!;
  return { run, mon };
}

function transform(uid: string, kind: Transform['kind'], extra: Partial<Transform> = {}): Transform {
  return { type: 'transform', side: 'player', uid, kind, from: 'x', to: 'x', itemId: null, ...extra };
}

function moments(cues: ReturnType<typeof recordBattleTurn>, title: string) {
  return cues.filter((c) => c.title === title);
}

describe('Hyper evolutions', () => {
  it('Tera shows the emotion-flavoured line and records a memory', () => {
    const { run, mon } = setup('hyper-evo-tera');
    const cues = recordBattleTurn(content, structuredClone(run), run, [transform(mon.uid, 'tera', { teraType: 'fire' })]);
    expect(moments(cues, 'Its True Colors Shine Through!')).toHaveLength(1);
    expect(run.story.histories[mon.uid]!.hyper['true-colors']).toBe(1);
    expect(run.story.events.some((e) => e.type === 'storyMoment' && e.data.def === 'true-colors')).toBe(true);
  });

  it('a Mega or Dynamax in a quiet fight at full HP stays plain; at half HP it is Overdrive', () => {
    const { run, mon } = setup('hyper-evo-decisive');
    const plain = recordBattleTurn(content, structuredClone(run), structuredClone(run), [transform(mon.uid, 'mega')]);
    expect(plain.some((c) => c.title === 'Mega Overdrive!')).toBe(false);
    mon.hp = Math.floor(maxHp(content, mon) / 2);
    const hurt = recordBattleTurn(content, structuredClone(run), run, [transform(mon.uid, 'mega'), transform(mon.uid, 'dynamax')]);
    expect(hurt.map((c) => c.title)).toContain('Mega Overdrive!');
  });

  it('All of Its Heart needs a strong bond and changes no battle state', () => {
    const { run, mon } = setup('hyper-evo-heart');
    mon.friendship = 100;
    const lowBond = recordBattleTurn(content, structuredClone(run), structuredClone(run), [transform(mon.uid, 'zmove')]);
    expect(lowBond.some((c) => c.title === 'All of Its Heart!')).toBe(false);
    mon.friendship = 255;
    const before = structuredClone(run);
    const cues = recordBattleTurn(content, before, run, [transform(mon.uid, 'zmove')]);
    expect(cues.some((c) => c.title === 'All of Its Heart!')).toBe(true);
    expect(run.battle!.storyEffects).toEqual(before.battle!.storyEffects);
  });

  it('draws no battle or hyper random numbers (only the story stream picks a line)', () => {
    const { run, mon } = setup('hyper-evo-rng');
    mon.friendship = 255;
    const rngBefore = structuredClone(run.rng);
    recordBattleTurn(content, structuredClone(run), run, [transform(mon.uid, 'zmove')]);
    expect(run.rng.battle).toEqual(rngBefore.battle);
    expect(run.rng.hyper).toEqual(rngBefore.hyper);
  });
});
