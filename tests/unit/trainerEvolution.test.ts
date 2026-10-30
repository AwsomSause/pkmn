// Trainer Evolutions (plan Part 2c + Kice's answer 1): six evolved trainers, each with its own mechanic.

import { describe, expect, it } from 'vitest';
import { runPerks } from '../../src/core/archetypes';
import { createBattle, resolveTurn, startBattle, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { trainerStatus } from '../../src/core/progress';
import { claim, evolutionKey, stepsDone } from '../../src/core/quests';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseNode, chooseStarter, createRun, isBlackMarket, shopPrice, shopStock, takeTurn, type TurnResult } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { voiceAsksToJoin } from '../../src/core/trainerEvolution';
import { content } from './helpers';

const NOW = '2026-10-30T12:00:00.000Z';
const SPECIAL = ['red', 'blue', 'cynthia', 'giovanni', 'n', 'oak'];
const EXCLUSIVE = ['championLastStand', 'firstStrike', 'championsAura', 'blackMarket', 'voiceOfPokemon', 'fieldResearch'];
const perksOf = (id: string) => runPerks(content, { archetypeId: id });

const mon = (species: string, level: number, uid: string, moves: string[]) => {
  const m = createPokemon(content, species, level, uid);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
};

function ctxFor(trainerId: string, party: PokemonInstance[], enemy: PokemonInstance, trainer: { classId: string; name: string; leaderId: string | null } | null = null): BattleContext {
  const battle = createBattle(trainer ? 'trainer' : 'wild', [enemy], 0, party[0]!.uid, trainer);
  return { content, battle, party, inventory: {}, rng: new Rng(hashSeed('evo')), captureRng: new Rng(hashSeed('evo-c')), catchMultiplier: 1, perks: perksOf(trainerId) };
}

describe('evolved trainers', () => {
  it('each special trainer has one evolved form with its own mechanic, and nobody else has those mechanics', () => {
    const evolved = [...content.archetypes.values()].filter((a) => a.evolvedFrom);
    expect(evolved.map((a) => a.evolvedFrom).sort()).toEqual([...SPECIAL].sort());
    evolved.forEach((a) => expect(a.modifiers.filter((m) => EXCLUSIVE.includes(m.kind)), a.id).toHaveLength(1));
    for (const a of content.archetypes.values()) if (!a.evolvedFrom) expect(a.modifiers.some((m) => EXCLUSIVE.includes(m.kind)), a.id).toBe(false);
  });

  it('is locked until the base trainer finishes its quest line, then playable', () => {
    const p = createProfile(content, 'p');
    const champ = content.archetypes.get('evolved-red')!;
    expect(trainerStatus(p, champ)).toBe('locked');
    claim(p, evolutionKey('red'), NOW);
    expect(trainerStatus(p, champ)).toBe('unlocked');
  });

  it("a run as the evolved trainer counts for the base trainer's quests", () => {
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'evo-q', archetypeId: 'evolved-red' }), 0);
    run.log.counters = { ...run.log.counters, battlesWon: 40 };
    run.phase = 'over';
    const { profile } = finalizeRun(content, createProfile(content, 'p'), run, NOW);
    expect(profile.trainerCounters.red?.battlesWon).toBe(40);
    expect(profile.trainerCounters['evolved-red']).toBeUndefined();
    expect(stepsDone(content, profile, 'red')).toBeGreaterThanOrEqual(1);
  });
});

describe('the mechanics', () => {
  it("Champion Red's Last Stand saves the last Pokémon once per battle, and only the last one", () => {
    const lone = mon('pikachu', 5, 'p1', ['splash']);
    const ctx = ctxFor('evolved-red', [lone], mon('mewtwo', 100, 'e1', ['psystrike']));
    let events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(lone.hp).toBe(1);
    expect(events.some((e) => e.type === 'held' && e.itemId === 'perk-last-stand')).toBe(true);
    events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(lone.hp).toBe(0);
    // With a teammate still standing it doesn't trigger, and plain Red never has it.
    const a = mon('pikachu', 5, 'a', ['splash']);
    const ctx2 = ctxFor('evolved-red', [a, mon('pikachu', 5, 'b', ['splash'])], mon('mewtwo', 100, 'e1', ['psystrike']));
    resolveTurn(ctx2, { kind: 'move', index: 0 });
    expect(a.hp).toBe(0);
    const c = mon('pikachu', 5, 'c', ['splash']);
    resolveTurn(ctxFor('red', [c], mon('mewtwo', 100, 'e1', ['psystrike'])), { kind: 'move', index: 0 });
    expect(c.hp).toBe(0);
  });

  it("Champion Blue's Smell Ya Later moves first on a trainer battle's first turn only", () => {
    const firstMover = (id: string, kind: 'trainer' | 'wild') => {
      const ctx = ctxFor(id, [mon('slowpoke', 50, 'p1', ['tackle'])], mon('jolteon', 50, 'e1', ['tackle']), kind === 'trainer' ? { classId: 'youngster', name: 'Joey', leaderId: null } : null);
      const ev = resolveTurn(ctx, { kind: 'move', index: 0 }).find((e): e is Extract<BattleEvent, { type: 'move' }> => e.type === 'move');
      return ev?.side;
    };
    expect(firstMover('blue', 'trainer')).toBe('enemy');
    expect(firstMover('evolved-blue', 'trainer')).toBe('player');
    expect(firstMover('evolved-blue', 'wild')).toBe('enemy');
  });

  it("Champion Cynthia's aura raises the lead's best stat at the start of a boss battle", () => {
    const boss = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
    const ctx = ctxFor('evolved-cynthia', [mon('garchomp', 50, 'p1', ['tackle'])], mon('onix', 50, 'e1', ['tackle']), boss);
    startBattle(ctx);
    expect(ctx.battle.playerStages.atk).toBe(1);
    const plain = ctxFor('evolved-cynthia', [mon('garchomp', 50, 'p1', ['tackle'])], mon('onix', 50, 'e1', ['tackle']), { classId: 'youngster', name: 'Joey', leaderId: null });
    startBattle(plain);
    expect(plain.battle.playerStages.atk).toBe(0);
  });

  it("Rocket Boss Giovanni's Black Market sells locked stock at a markup", () => {
    const base = chooseStarter(content, createRun(content, { runId: 'r', seed: 'bm', archetypeId: 'giovanni' }), 0);
    const boss = chooseStarter(content, createRun(content, { runId: 'r', seed: 'bm', archetypeId: 'evolved-giovanni' }), 0);
    const locked = content.shop.find((e) => !shopStock(content, base).includes(e) && e.minBadges > 0)!;
    expect(shopStock(content, boss)).toContain(locked);
    expect(isBlackMarket(content, boss, locked)).toBe(true);
    expect(shopPrice(content, boss, locked)).toBeGreaterThanOrEqual(Math.round(locked.price * 1.5) - 1);
  });

  it("King N's Voice of Pokémon asks about 1 in 4 times, the same for the same run", () => {
    const perks = perksOf('evolved-n');
    let asked = 0;
    for (let i = 0; i < 400; i++) if (voiceAsksToJoin(perks, { seed: 'voice', encountersCompleted: i })) asked++;
    expect(asked).toBeGreaterThan(60);
    expect(asked).toBeLessThan(140);
    expect(voiceAsksToJoin(perks, { seed: 'v', encountersCompleted: 3 })).toBe(voiceAsksToJoin(perks, { seed: 'v', encountersCompleted: 3 }));
    expect(voiceAsksToJoin(perksOf('n'), { seed: 'voice', encountersCompleted: 0 })).toBe(false);
  });
});

/** Enters the first wild stop after the start and wins (or catches, with `ball`) the battle. */
function fightWild(archetypeId: string, seed: string, ball = false): TurnResult {
  let run: RunState = chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId }), 0);
  const node = run.stage!.map.nodes.find((n) => n.kind === 'wild' && n.column > 1)!;
  run.stage!.current = run.stage!.map.nodes.find((n) => n.next.includes(node.id))!.id;
  run = chooseNode(content, run, node.id);
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  run.inventory['ultra-ball'] = 60;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 50 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    turn = takeTurn(content, run, ball ? { kind: 'item', itemId: 'ultra-ball' } : { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

describe('the mechanics after a battle', () => {
  it("King N: a defeated wild Pokémon that asks to join waits as a decision, like a catch", () => {
    let asked: TurnResult | null = null;
    for (let i = 0; i < 20 && !asked; i++) {
      const t = fightWild('evolved-n', `voice-${i}`);
      if (t.end?.voiceJoined) asked = t;
    }
    expect(asked).not.toBeNull();
    expect(asked!.run.pending[0]).toMatchObject({ kind: 'caught' });
    expect((asked!.run.pending[0] as { mon: PokemonInstance }).mon.speciesId).toBe(asked!.end!.voiceJoined);
    expect((asked!.run.pending[0] as { mon: PokemonInstance }).mon.hp).toBeGreaterThan(0);
  });

  it('Champion Oak: a species caught for the first time this run pays Field Research money', () => {
    const oak = fightWild('evolved-oak', 'field', true);
    const plain = fightWild('oak', 'field', true);
    expect(oak.end?.outcome).toBe('caught');
    expect(oak.end!.moneyGained - plain.end!.moneyGained).toBeGreaterThanOrEqual(300);
  });
});
