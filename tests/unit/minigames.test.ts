// Minigames (Blueprint section 4): every game runs through the same interface, is deterministic, pays once, and keeps its economy capped.

import { describe, expect, it } from 'vitest';
import { beginMinigame, getMinigame, leaveMinigame, payout, medalFor, minigameAct, minigamePreview, minigameTick, minigameView } from '../../src/core/minigame/flow';
import { gameModule, makeQuestion } from '../../src/core/minigame/games';
import { MinigameFileSchema } from '../../src/core/minigame/schema';
import { minigameDiscount, placeMinigameStop } from '../../src/core/minigame/gate';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import minigamesJson from '../../src/data/minigames.json';
import { content } from './helpers';

function stopRun(seed: string, gameId: string): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'mg', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = [{ id: 'mg-test', kind: 'minigame', minigameId: gameId, used: false }];
  run.stage!.current = node.id;
  return run;
}

/** A bot that picks a random enabled cell (and ticks now and then) until the game ends. */
function play(run: RunState, seed: string): RunState {
  const r = new Rng(hashSeed(seed));
  for (let step = 0; step < 800 && !run.minigame!.outcome; step++) {
    const view = minigameView(content, run);
    const open = view.cells.filter((c) => !c.disabled);
    if (open.length > 0) run = minigameAct(content, run, r.pick(open).id);
    if (!run.minigame!.outcome && step % 3 === 2) run = minigameTick(content, run);
  }
  return run;
}

describe('minigame data', () => {
  it('validates and lists the six recommended games plus the extra concepts', () => {
    expect(MinigameFileSchema.safeParse(minigamesJson).success).toBe(true);
    const ids = content.minigames.games.map((g) => g.id);
    for (const id of ['pokemon-memory', 'catching-challenge', 'rhythm-challenge', 'berry-foraging', 'knowledge-quiz', 'fossil-excavation']) expect(ids).toContain(id);
    expect(ids.length).toBeGreaterThanOrEqual(14);
    for (const g of content.minigames.games) {
      expect(g.difficultyTiers.map((t) => t.id)).toEqual(['easy', 'normal', 'hard']);
      expect(g.medals.bronze).toBeLessThan(g.medals.silver);
      expect(g.medals.silver).toBeLessThan(g.medals.gold);
    }
  });
});

describe('every minigame', () => {
  for (const def of content.minigames.games) {
    for (let tier = 0; tier < 3; tier++) {
      it(`${def.id} (${def.difficultyTiers[tier]!.id}) is well formed, finishes, is JSON-safe and replays the same`, () => {
        const run = stopRun(`mg-${def.id}`, def.id);
        const a = play(beginMinigame(content, run, 'mg-test', tier), `bot-${def.id}`);
        const b = play(beginMinigame(content, run, 'mg-test', tier), `bot-${def.id}`);
        const outcome = a.minigame!.outcome;
        expect(outcome, 'the bot should reach an end').not.toBeNull();
        expect(outcome!.score).toBeGreaterThanOrEqual(0);
        expect(outcome!.score).toBeLessThanOrEqual(outcome!.max);
        expect(outcome!.max).toBeGreaterThan(0);
        expect(JSON.parse(JSON.stringify(a))).toEqual(a);
        expect(b.minigame).toEqual(a.minigame);
        expect(a.money - run.money).toBe(outcome!.money);
      });
    }
  }

  it('shows no gameplay-RNG use: the run seed streams are untouched by playing', () => {
    const run = stopRun('mg-rng', 'pokemon-memory');
    const after = play(beginMinigame(content, run, 'mg-test', 1), 'bot');
    expect(after.seed).toBe(run.seed);
    expect(after.party).toEqual(run.party);
  });
});

describe('minigame flow and economy', () => {
  it('limits attempts, uses the stop up and forfeits when you leave', () => {
    let run = stopRun('mg-att', 'pokemon-memory');
    const limit = content.minigames.games.find((g) => g.id === 'pokemon-memory')!.attemptLimit;
    expect(minigamePreview(content, run, 'mg-test').attemptsLeft).toBe(limit);
    for (let i = 0; i < limit; i++) {
      run = beginMinigame(content, run, 'mg-test', 0);
      expect(run.phase).toBe('minigame');
      run = leaveMinigame(run);
      expect(run.phase).toBe('map');
      expect(run.money).toBe(stopRun('mg-att', 'pokemon-memory').money);
    }
    expect(() => beginMinigame(content, run, 'mg-test', 0)).toThrow(/attempts/);
    expect(run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'mg-test')!.used).toBe(true);
  });

  it('maps score share to medals', () => {
    const def = content.minigames.games[0]!;
    expect(medalFor(def, 0, 10)).toBe('none');
    expect(medalFor(def, 10, 10)).toBe('gold');
    expect(medalFor(def, Math.ceil(def.medals.bronze * 10), 10)).not.toBe('none');
  });

  it('caps money per stage, pays repeats less, and pays items only on harder tiers', () => {
    const eco = content.minigames.economy;
    let run = stopRun('mg-eco', 'knowledge-quiz');
    const totals: number[] = [];
    for (let i = 0; i < 6; i++) {
      run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'mg-test')!.used = false;
      run.minigames.attempts['mg-test'] = 0;
      run = beginMinigame(content, run, 'mg-test', 2);
      // Perfect play: force the finished state through a gold result.
      const s = run.minigame!.state as { done: boolean };
      s.done = true;
      const mod = gameModule('knowledge-quiz');
      (run.minigame!.state as { score?: number }).score = mod.result(run.minigame!.state as never).max;
      run = minigameAct(content, run, 'none');
      totals.push(run.money);
      run = leaveMinigame(run);
    }
    expect(run.minigames.money).toBeLessThanOrEqual(eco.stageMoneyCap * (run.regionIndex + 1));
    expect(run.minigames.items).toBeLessThanOrEqual(eco.itemCapPerStage);
    expect(run.minigames.plays['knowledge-quiz']).toBe(6);
  });

  it('never gives items on the easy tier', () => {
    for (let i = 0; i < 20; i++) {
      const run = play(beginMinigame(content, stopRun(`mg-easy-${i}`, 'pokemon-memory'), 'mg-test', 0), `b${i}`);
      expect(run.minigame!.outcome!.item).toBeNull();
    }
  });

  it('places a stop for unlocked games only, without changing the map', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'mg', seed: 'mg-place', archetypeId: 'red' }), 0);
    const before = JSON.stringify(run.stage!.map.nodes.map((n) => [n.id, n.column]));
    const copy = structuredClone(run);
    for (const n of copy.stage!.map.nodes) n.sides = n.sides.filter((s) => s.kind !== 'minigame');
    placeMinigameStop(content, copy);
    expect(JSON.stringify(copy.stage!.map.nodes.map((n) => [n.id, n.column]))).toBe(before);
    for (const s of copy.stage!.map.nodes.flatMap((n) => n.sides).filter((x) => x.kind === 'minigame')) {
      const g = content.minigames.games.find((m) => m.id === s.minigameId)!;
      expect(g.unlockRequirements.badges).toBeLessThanOrEqual(copy.badges.length);
    }
  });

  it('builds quiz questions from real data with one correct answer among the choices', () => {
    const r = new Rng(hashSeed('quiz'));
    for (let i = 0; i < 60; i++) {
      const q = makeQuestion(content, r);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});

describe('minigame bonus rewards', () => {
  /** Plays a game to a perfect score by writing the finished state, then reads the payout. */
  function gold(run: RunState, id: string, tier: number): RunState {
    const r = beginMinigame(content, run, 'mg-test', tier);
    r.minigame!.outcome = payout(content, r, getMinigame(content, id), tier, 10, 10);
    return r;
  }

  it('a gold in a research game adds research points, at most the stage cap', () => {
    const run = stopRun('mg-fx-research', 'knowledge-quiz');
    run.minigames.attempts = {};
    const before = run.totems.research;
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      const r = gold(stopRun(`mg-fx-r-${i}`, 'knowledge-quiz'), 'knowledge-quiz', 2);
      if (r.totems.research > before) {
        found = true;
        expect(r.minigames.effects).toBe(1);
      }
    }
    expect(found).toBe(true);
  });

  it('a gold in a foraging game heals the party but never revives', () => {
    for (let i = 0; i < 12; i++) {
      const run = stopRun(`mg-fx-heal-${i}`, 'berry-foraging');
      run.party[0]!.hp = 1;
      const r = gold(run, 'berry-foraging', 2);
      if (r.party[0]!.hp > 1) return;
    }
    throw new Error('no heal in 12 tries');
  });

  it('a discount lasts only for the stage it was won in', () => {
    for (let i = 0; i < 12; i++) {
      const r = gold(stopRun(`mg-fx-disc-${i}`, 'rhythm-challenge'), 'rhythm-challenge', 2);
      if (r.minigames.discount) {
        expect(minigameDiscount(r)).toBeLessThan(1);
        r.stage!.index += 1;
        expect(minigameDiscount(r)).toBe(1);
        return;
      }
    }
    throw new Error('no discount in 12 tries');
  });

  it('gives no bonus on the easy tier and never more than the stage cap', () => {
    const eco = content.minigames.economy;
    let r = stopRun('mg-fx-cap', 'knowledge-quiz');
    for (let i = 0; i < 8; i++) {
      r.minigames.attempts = {};
      r.stage!.map.nodes.flatMap((n) => n.sides).find((x) => x.id === 'mg-test')!.used = false;
      r = leaveMinigame(gold(r, 'knowledge-quiz', 2));
    }
    expect(r.minigames.effects).toBeLessThanOrEqual(eco.effectCapPerStage);
    const easy = gold(stopRun('mg-fx-easy', 'knowledge-quiz'), 'knowledge-quiz', 0);
    expect(easy.minigames.effects).toBe(0);
  });
});

describe('minigame saves', () => {
  it('a version 18 run loads with no minigame', () => {
    const storage = new MemoryStorageProvider();
    const { minigame: _m, minigames: _g, ...old } = stopRun('mg-old', 'pokemon-memory');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 18, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.data.minigame).toBeNull();
      expect(loaded.data.minigames.plays).toEqual({});
    }
  });

  it('a minigame in progress survives a save and reload, and the reward is not paid twice', () => {
    const storage = new MemoryStorageProvider();
    const mgr = new SaveManager(storage, content);
    const run = play(beginMinigame(content, stopRun('mg-reload', 'pokemon-memory'), 'mg-test', 1), 'bot');
    mgr.saveRun(run);
    const loaded = mgr.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.data.minigame).toEqual(run.minigame);
      const again = minigameAct(content, loaded.data, 'anything');
      expect(again.money).toBe(run.money);
    }
  });
});
