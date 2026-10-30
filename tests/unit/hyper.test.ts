// M8.9 Phase 1, slice 1: the first four Hyper moments (Toughened It Out,
// Felt a Bond, Pushed Itself Back Up, Hung In There), decided by the battle
// engine on the "hyper" stream and told by the story layer.

import { describe, expect, it } from 'vitest';
import { zeroAttributes } from '../../src/core/attributes';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import type { HyperContext } from '../../src/core/battle/hyper';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { buildHyperContext, hyperChance } from '../../src/core/story/hyper';
import type { StoryTriggerKind } from '../../src/core/story/schema';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

const def = (trigger: StoryTriggerKind) => content.story.definitions.find((d) => d.triggerConditions.trigger === trigger)!;

/** A HyperContext where the listed moments are certain and the rest never happen. */
function certain(triggers: StoryTriggerKind[], peace = 0): HyperContext {
  return {
    rng: new Rng(hashSeed('hyper-test')),
    eligibility: (trigger) => (triggers.includes(trigger) ? { def: def(trigger), chance: 1, variant: null } : null),
    attributeShare: (a) => (a === 'peace' ? peace : 0),
    rivalBattles: () => 0,
    friendlyRivals: () => [],
  };
}

function battleCtx(player: PokemonInstance, enemy: PokemonInstance, hyper: HyperContext | undefined, seed = 'b'): BattleContext {
  return {
    content,
    battle: createBattle('wild', [enemy], 0, player.uid),
    party: [player],
    inventory: {},
    rng: new Rng(hashSeed(seed)),
    captureRng: new Rng(hashSeed(`${seed}-c`)),
    catchMultiplier: 1,
    hyper,
  };
}

function machamp(moveId = 'cross-chop'): PokemonInstance {
  const enemy = createPokemon(content, 'machamp', 80, 'e1');
  enemy.moves = [{ id: moveId, pp: 30 }];
  return enemy;
}

function pidgey(): PokemonInstance {
  const p = createPokemon(content, 'pidgey', 5, 'p1');
  p.moves = [{ id: 'tackle', pp: 35 }];
  return p;
}

const hypers = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'hyper' }> => e.type === 'hyper');

describe('Toughened It Out', () => {
  it('hangs on at 1 HP once per battle, from enough HP, and only on the first hit of a move', () => {
    const player = pidgey();
    const ctx = battleCtx(player, machamp(), certain(['toughenedItOut']));
    const first = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(hypers(first)).toEqual([{ type: 'hyper', side: 'player', uid: 'p1', defId: 'toughened-it-out', variant: null, hpAfter: 1, cured: false }]);
    expect(player.hp).toBe(1);
    expect(ctx.battle.storyEffects).toEqual(['toughened-it-out@p1']);
    // Never twice in a battle.
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(player.hp).toBe(0);
  });

  it('needs 25% HP or more before the hit', () => {
    const player = pidgey();
    player.hp = Math.floor(calcStats(content, player).hp * 0.2);
    const ctx = battleCtx(player, machamp(), certain(['toughenedItOut']));
    expect(hypers(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
    expect(player.hp).toBe(0);
  });

  it('never on the second hit of a multi-hit move', () => {
    let checked = 0;
    for (let i = 0; i < 100 && checked < 5; i++) {
      const mon = createPokemon(content, 'snorlax', 30, 'p1');
      mon.moves = [{ id: 'tail-whip', pp: 30 }];
      const enemy = createPokemon(content, 'machamp', 40, 'e1');
      enemy.moves = [{ id: 'double-kick', pp: 30 }];
      // Measure both hits on a copy that can't faint, then give it just enough HP to survive the first.
      const probe = battleCtx({ ...structuredClone(mon), hp: 9999 }, structuredClone(enemy), undefined, `mh-${i}`);
      const [d1, d2] = resolveTurn(probe, { kind: 'move', index: 0 }).flatMap((e) => (e.type === 'damage' && e.side === 'player' ? [e.amount] : []));
      const max = calcStats(content, mon).hp;
      const left = Math.ceil(max * 0.3);
      if (d1 === undefined || d2 === undefined || d2 < left || d1 + left > max) continue;
      mon.hp = d1 + left;
      const ctx = battleCtx(mon, enemy, certain(['toughenedItOut']), `mh-${i}`);
      const events = resolveTurn(ctx, { kind: 'move', index: 0 });
      expect(events.filter((e) => e.type === 'damage' && e.side === 'player')).toHaveLength(2);
      expect(hypers(events)).toEqual([]);
      expect(mon.hp).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('rolls 15% at Love 0 and at most double, half as often once it has happened this run ("again")', () => {
    const rule = def('toughenedItOut').chance!;
    expect(hyperChance(rule, zeroAttributes(), false)).toBeCloseTo(0.15);
    expect(hyperChance(rule, { ...zeroAttributes(), love: 100 }, false)).toBeCloseTo(0.25);
    expect(hyperChance(rule, { ...zeroAttributes(), love: 50 }, true)).toBeCloseTo(0.125);
    expect(hyperChance(rule, { ...zeroAttributes(), love: 100 }, true)).toBeCloseTo(0.15);
    let fired = 0;
    for (let i = 0; i < 400; i++) {
      const ctx = battleCtx(pidgey(), machamp(), { ...certain([]), rng: new Rng(hashSeed(`roll-${i}`)), eligibility: (t) => (t === 'toughenedItOut' ? { def: def(t), chance: 0.15, variant: null } : null) });
      if (hypers(resolveTurn(ctx, { kind: 'move', index: 0 })).length) fired++;
    }
    expect(fired).toBeGreaterThan(35);
    expect(fired).toBeLessThan(90);
  });
});

describe('Toughened It Out with a Destiny Knot', () => {
  it('doubles the holder\'s chance (50% becomes certain)', () => {
    for (let i = 0; i < 20; i++) {
      const player = pidgey();
      player.held = { 'destiny-knot': 1 };
      const half: HyperContext = { ...certain([]), rng: new Rng(hashSeed(`knot-${i}`)), eligibility: (t) => (t === 'toughenedItOut' ? { def: def(t), chance: 0.5, variant: null } : null) };
      expect(hypers(resolveTurn(battleCtx(player, machamp(), half), { kind: 'move', index: 0 }))).toHaveLength(1);
    }
  });
});

describe('Felt a Bond', () => {
  it('needs friendship 220 and a memory to draw on', () => {
    let run = chooseStarter(content, createRun(content, { runId: 'bond', seed: 'bond', archetypeId: 'red' }), 0);
    const mon = run.party[0]!;
    const eligible = () => buildHyperContext(content, run, new Rng(hashSeed('x'))).eligibility('feltABond', run.party[0]!);
    expect(eligible()).toBeNull();
    run = structuredClone(run);
    run.party[0]!.friendship = 230;
    expect(eligible()).toBeNull();
    run.story.histories[mon.uid]!.closeCalls = 1;
    expect(eligible()?.chance).toBeCloseTo(0.1 * content.story.rarity.hyperScale);
  });

  it('shakes off a status at the end of the turn', () => {
    const player = pidgey();
    player.status = { id: 'brn' };
    const enemy = createPokemon(content, 'pidgey', 2, 'e1');
    enemy.moves = [{ id: 'growl', pp: 40 }];
    const ctx = battleCtx(player, enemy, certain(['feltABond']));
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(hypers(events)).toEqual([expect.objectContaining({ defId: 'felt-a-bond', cured: true })]);
    expect(player.status).toBeNull();
  });

  it('or hangs on against a fatal hit', () => {
    const player = pidgey();
    const ctx = battleCtx(player, machamp(), certain(['feltABond']));
    expect(hypers(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([expect.objectContaining({ defId: 'felt-a-bond', hpAfter: 1, cured: false })]);
  });
});

describe('Pushed Itself Back Up', () => {
  it('goes down, then gets back up at 20% HP; once per battle for the whole party', () => {
    const player = pidgey();
    const ctx = battleCtx(player, machamp(), certain(['pushedBackUp']));
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    const at = events.findIndex((e) => e.type === 'hyper');
    expect(events[at - 1]).toMatchObject({ type: 'damage', side: 'player', hpAfter: 0 });
    const back = Math.floor(calcStats(content, player).hp * 0.2);
    expect(events[at]).toMatchObject({ defId: 'pushed-back-up', hpAfter: back });
    expect(player.hp).toBe(back);
    expect(events.some((e) => e.type === 'faint' && e.side === 'player')).toBe(false);
    expect(ctx.battle.storyEffects).toEqual(['pushed-back-up']);
  });

  it('needs a close call, a survived knockout or a bond memory this run', () => {
    let run = chooseStarter(content, createRun(content, { runId: 'push', seed: 'push', archetypeId: 'red' }), 0);
    const ctx = () => buildHyperContext(content, run, new Rng(hashSeed('x')));
    expect(ctx().eligibility('pushedBackUp', run.party[0]!)).toBeNull();
    run = structuredClone(run);
    run.story.histories[run.party[0]!.uid]!.hyper['felt-a-bond'] = 1;
    expect(ctx().eligibility('pushedBackUp', run.party[0]!)?.chance).toBeCloseTo(0.03 * content.story.rarity.hyperScale);
  });
});

describe('Hung In There', () => {
  function lowBattle(peace = 0) {
    const player = createPokemon(content, 'snorlax', 40, 'p1');
    player.moves = [{ id: 'splash', pp: 40 }];
    const max = calcStats(content, player).hp;
    player.hp = Math.floor(max * 0.2);
    const enemy = createPokemon(content, 'pidgey', 2, 'e1');
    enemy.moves = [{ id: 'growl', pp: 40 }];
    return { player, max, ctx: battleCtx(player, enemy, certain(['hungInThere'], peace)) };
  }

  it('after 3 turns in a row at 25% HP or less, raises Defense and Sp. Def by 1', () => {
    const { ctx } = lowBattle();
    expect(hypers(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
    expect(hypers(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
    const third = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(hypers(third)).toEqual([expect.objectContaining({ defId: 'hung-in-there', variant: null })]);
    expect(ctx.battle.playerStages.def).toBe(1);
    expect(ctx.battle.playerStages.spd).toBe(1);
    expect(hypers(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
  });

  it('Peace adds a heal of up to 10% of max HP', () => {
    const { ctx, player, max } = lowBattle(0.5);
    const hp = player.hp;
    for (let i = 0; i < 3; i++) resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(player.hp).toBe(hp + Math.floor(max * 0.1 * 0.5));
  });

  it('"Wouldn\'t Stay Down" after surviving two super-effective hits', () => {
    const player = createPokemon(content, 'snorlax', 60, 'p1');
    player.moves = [{ id: 'splash', pp: 40 }];
    const enemy = createPokemon(content, 'machamp', 10, 'e1');
    enemy.moves = [{ id: 'karate-chop', pp: 30 }];
    const ctx = battleCtx(player, enemy, certain(['hungInThere']));
    const all = [...resolveTurn(ctx, { kind: 'move', index: 0 }), ...resolveTurn(ctx, { kind: 'move', index: 0 })];
    expect(hypers(all)).toEqual([expect.objectContaining({ defId: 'hung-in-there', variant: 'wouldntStayDown' })]);
  });
});

describe('Hyper limits', () => {
  it('at most one Hyper moment changes the battle per turn', () => {
    const player = pidgey();
    player.status = { id: 'brn' };
    const ctx = battleCtx(player, machamp(), certain(['toughenedItOut', 'feltABond', 'pushedBackUp']));
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(hypers(events)).toHaveLength(1);
    expect(player.status).toEqual({ id: 'brn' });
  });
});

describe('Hyper moments in a run', () => {
  /** Your starter against a Machamp that knocks it out in one hit. */
  function doomed(seed: string): RunState {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0)));
    run.battle = createBattle('wild', [machamp()], 0, run.party[0]!.uid);
    return run;
  }

  it('tells the moment: a banner, a memory, a survived knockout, and the count for "again"', () => {
    let found = 0;
    for (let i = 0; i < 400 && found < 2; i++) {
      const run = doomed(`tough-${i}`);
      const result = takeTurn(content, run, { kind: 'move', index: 0 });
      const at = result.events.findIndex((e) => e.type === 'hyper');
      if (at < 0) continue;
      found++;
      const uid = run.party[0]!.uid;
      const cue = result.cues.find((c) => c.at === at)!;
      expect(cue.title).toBe('Toughened It Out!');
      expect(cue.major).toBe(true);
      const history = result.run.story.histories[uid]!;
      expect(history.hyper['toughened-it-out']).toBe(1);
      expect(history.survivedFatal).toBe(1);
      expect(history.memories.some((m) => m.text === "Toughened it out against Machamp's Cross Chop")).toBe(true);
      // The chance was rolled on the hyper stream.
      expect(result.run.rng.hyper).not.toEqual(run.rng.hyper);
      // Later in the run it is "again", at half the chance.
      const again = buildHyperContext(content, result.run, new Rng(hashSeed('x'))).eligibility('toughenedItOut', result.run.party[0]!)!;
      expect(again.variant).toBe('again');
      expect(again.chance).toBeCloseTo(0.075 * content.story.rarity.hyperScale);
    }
    expect(found).toBe(2);
  });

  it('a save and reload in the middle of the battle never repeats a moment', () => {
    for (let i = 0; i < 80; i++) {
      const result = takeTurn(content, doomed(`reload-${i}`), { kind: 'move', index: 0 });
      if (!result.events.some((e) => e.type === 'hyper')) continue;
      const storage = new MemoryStorageProvider();
      const saves = new SaveManager(storage, content);
      expect(saves.saveRun(result.run).ok).toBe(true);
      const loaded = saves.loadRun();
      if (loaded.status !== 'ok') throw new Error(loaded.status);
      expect(loaded.data).toEqual(result.run);
      const next = takeTurn(content, loaded.data, { kind: 'move', index: 0 });
      expect(next.events.some((e) => e.type === 'hyper' && e.defId === 'toughened-it-out')).toBe(false);
      return;
    }
    throw new Error('no seed toughened it out');
  });

  it('upgrades a version 9 run: the Love endure key, battle counters and history counts', () => {
    const storage = new MemoryStorageProvider();
    const run = doomed('v9');
    const { hyper: _h, ...battle } = run.battle!;
    const histories = Object.fromEntries(Object.entries(run.story.histories).map(([uid, h]) => {
      const { hyper: _x, ...rest } = h;
      return [uid, rest];
    }));
    const v9 = { ...run, battle: { ...battle, storyEffects: ['love-hung-on@p9'] }, story: { ...run.story, histories } };
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 9, savedAt: '', data: v9 }));
    const loaded = new SaveManager(storage, content).loadRun();
    if (loaded.status !== 'ok') throw new Error(loaded.status);
    expect(loaded.migratedFrom).toBe(9);
    expect(loaded.data.battle!.storyEffects).toEqual(['toughened-it-out@p9']);
    expect(loaded.data.battle!.hyper).toEqual({ lowHp: null, superEffective: {}, rage: {}, met: {}, rivals: {}, outdo: [] });
    for (const h of Object.values(loaded.data.story.histories)) expect(h.hyper).toEqual({});
  });
});
