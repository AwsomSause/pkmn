import { describe, expect, it } from 'vitest';
import { getContent } from '../../src/data';
import { allAnims, resolveAnim } from '../../src/core/presentation/animRegistry';
import {
  atLeast, gradeForScore, gradeOffset, judgeDrag, judgeHold, judgeRhythm, judgeTap, judgeTiming, PROMPTS, PromptDefSchema, promptById, promptLengthMs, skippedResult,
} from '../../src/core/interaction/prompt';
import { REACTIONS, reactionFor } from '../../src/core/interaction/reactions';
import { bumpEventCounters, counterValue, resolveCounterPerks } from '../../src/core/eventToolkit';
import { ArchetypeModifierSchema } from '../../src/core/contentSchema';
import { damageDealtPerk } from '../../src/core/trainerPerks';

const W = { perfect: 50, good: 100, ok: 200 };

describe('interaction prompts', () => {
  it('every shared prompt validates and has a length', () => {
    for (const p of PROMPTS) { expect(PromptDefSchema.parse(p)).toEqual(p); expect(promptLengthMs(p)).toBeGreaterThan(0); }
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
    expect(() => promptById('nope')).toThrow();
  });
  it('rejects windows that do not widen', () => {
    expect(() => PromptDefSchema.parse({ id: 'x', kind: 'timing', label: 'x', hint: 'x', landMs: 100, windowsMs: { perfect: 100, good: 50, ok: 200 } })).toThrow();
  });
  it('grades offsets at the boundaries, and assist widens them', () => {
    expect(gradeOffset(50, W)).toBe('perfect');
    expect(gradeOffset(51, W)).toBe('good');
    expect(gradeOffset(-200, W)).toBe('ok');
    expect(gradeOffset(201, W)).toBe('miss');
    expect(gradeOffset(201, W, 1.5)).toBe('ok');
  });
  it('judges tap, hold, timing, drag', () => {
    const tap = promptById('shout-tap') as Extract<ReturnType<typeof promptById>, { kind: 'tap' }>;
    expect(judgeTap(tap, 100).grade).toBe('perfect');
    expect(judgeTap(tap, null).grade).toBe('miss');
    expect(judgeTap(tap, tap.expireMs + 1).grade).toBe('miss');
    const hold = promptById('brace-hold') as Extract<ReturnType<typeof promptById>, { kind: 'hold' }>;
    expect(judgeHold(hold, hold.targetMs).grade).toBe('perfect');
    expect(judgeHold(hold, 100).grade).toBe('miss');
    const ring = promptById('throw-ring') as Extract<ReturnType<typeof promptById>, { kind: 'timing' }>;
    expect(judgeTiming(ring, ring.landMs + 100).grade).toBe('good');
    const drag = promptById('aim-drag') as Extract<ReturnType<typeof promptById>, { kind: 'drag' }>;
    expect(judgeDrag(drag, drag.to, 500).grade).toBe('perfect');
    expect(judgeDrag(drag, [0, 0], 500).grade).toBe('miss');
    expect(judgeDrag(drag, drag.to, drag.maxMs + 1).grade).toBe('miss');
    expect(judgeDrag(drag, null, 0).grade).toBe('miss');
  });
  it('judges rhythm: one press answers one beat, extras are ignored, missed beats count', () => {
    const r = promptById('echo-rhythm') as Extract<ReturnType<typeof promptById>, { kind: 'rhythm' }>;
    expect(judgeRhythm(r, r.beatsMs).grade).toBe('perfect');
    const half = judgeRhythm(r, [r.beatsMs[0]!, r.beatsMs[1]!]);
    expect(half.steps).toEqual(['perfect', 'perfect', 'miss', 'miss']);
    expect(half.score).toBe(50);
    const spam = judgeRhythm(r, [r.beatsMs[0]!, r.beatsMs[0]!, r.beatsMs[0]!]);
    expect(spam.steps.filter((g) => g !== 'miss')).toHaveLength(1);
    expect(judgeRhythm(r, []).grade).toBe('miss');
  });
  it('skip assist never beats a real perfect and is flagged', () => {
    const s = skippedResult({ skip: true, skipGrade: 'perfect' });
    expect(s.skipped).toBe(true);
    expect(atLeast(s, 'perfect')).toBe(false);
    expect(judgeTiming(promptById('throw-ring') as never, null, { skip: true }).grade).toBe('ok');
  });
  it('score to grade thresholds', () => {
    expect([100, 95, 94, 70, 69, 35, 34, 0].map(gradeForScore)).toEqual(['perfect', 'perfect', 'good', 'good', 'ok', 'ok', 'miss', 'miss']);
  });
  it('is deterministic: same inputs, same result', () => {
    const r = promptById('echo-rhythm') as never;
    expect(judgeRhythm(r, [610, 1090, 1700, 2290])).toEqual(judgeRhythm(r, [610, 1090, 1700, 2290]));
  });
});

describe('tiny reactions', () => {
  it('are registered, short, and follow the animation settings', () => {
    expect(REACTIONS.length).toBeGreaterThanOrEqual(10);
    for (const r of REACTIONS) {
      expect(r.ms).toBeLessThanOrEqual(700);
      expect(allAnims().some((a) => a.id === r.id)).toBe(true);
      expect(resolveAnim(r.id, { mode: 'off', intensity: 1 })?.play).toBe(false);
      expect(resolveAnim(r.id, { mode: 'reduced', intensity: 1 })?.reduced).toBe(true);
      expect(resolveAnim(r.id, { mode: 'full', intensity: 1, enabled: { interaction: false } })?.play).toBe(false);
    }
    expect(reactionFor('affection')).toBe('react.heart');
    expect(reactionFor('sweat')).toBe('react.sweat');
    expect(reactionFor('zzz')).toBeNull();
  });
});

describe('event toolkit counters', () => {
  const perks = [
    { kind: 'eventCounter', id: 'charge', on: 'battleWin', amount: 1, max: 3, cycle: false },
    { kind: 'eventCounter', id: 'tide', on: 'nodeEnter', amount: 1, max: 2, cycle: true },
    { kind: 'counterDamage', counter: 'charge', atLeast: 1, type: 'electric', base: 1, perPoint: 0.1 },
  ].map((m) => ArchetypeModifierSchema.parse(m));
  it('charge climbs to its cap and carries; tide wraps', () => {
    const run: { itemCounters?: Record<string, number> } = {};
    for (let i = 0; i < 5; i++) bumpEventCounters(perks, run, 'battleWin');
    expect(counterValue(run, 'charge')).toBe(3);
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) { bumpEventCounters(perks, run, 'nodeEnter'); seen.push(counterValue(run, 'tide')); }
    expect(seen).toEqual([1, 2, 0, 1, 2]);
  });
  it('counterDamage becomes a damage multiplier only once the counter reaches atLeast', () => {
    const info = { userTypes: ['electric'], physical: true, hpShare: 1, userLevel: 5, targetLevel: 5, targetIsBoss: false, weather: null, moveType: 'electric', userBaseSpeed: 50, isStarter: false, targetTypes: ['water'], userHoldsItem: false } as never;
    expect(damageDealtPerk(resolveCounterPerks(perks, {}), info)).toBe(1);
    expect(damageDealtPerk(resolveCounterPerks(perks, { itemCounters: { 'ev:charge': 3 } }), info)).toBeCloseTo(1.3);
  });
  it('content loads with the new modifier kinds', () => { expect(getContent().balance).toBeTruthy(); });
});

import { startBattle, createBattle, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

describe('battleStart rules', () => {
  const ctxWith = (mods: unknown[]): BattleContext => {
    const player = createPokemon(content, 'charmander', 8, 'p1');
    const enemy = createPokemon(content, 'rattata', 6, 'e1');
    return { content, battle: createBattle('wild', [enemy], 0, player.uid), party: [player], inventory: {}, rng: new Rng(hashSeed('bs')), captureRng: new Rng(hashSeed('bs2')), catchMultiplier: 1, perks: mods.map((m) => ArchetypeModifierSchema.parse(m)) };
  };
  it('sets weather, field and Tailwind at the start, once', () => {
    const ctx = ctxWith([{ kind: 'battleStart', weather: 'hail', turns: 5 }, { kind: 'battleStart', field: 'gravity', tailwind: true, turns: 4 }]);
    const events = startBattle(ctx);
    expect(ctx.battle.weather?.id).toBe('hail');
    expect(ctx.battle.field.gravity).toBe(4);
    expect(ctx.battle.sideEffects.player.tailwind).toBe(4);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['weather', 'fieldStart', 'sideEffect']));
  });
  it('does nothing without the rule', () => {
    const ctx = ctxWith([]);
    startBattle(ctx);
    expect(ctx.battle.weather).toBeNull();
  });
});
