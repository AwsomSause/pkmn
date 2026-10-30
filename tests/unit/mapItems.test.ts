// Milestone 8.75, slice 3a: map and encounter items (Repels, Flutes, Incense,
// Mail, Poké Doll, Poké Toy, Apricorns, Honey, Unown Report, Cleanse Tag,
// Lax and Pure Incense).

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { accuracyMultiplier } from '../../src/core/battle/held';
import { applyCatalog, getCatalogEntry, isFreeReroll } from '../../src/core/catalog';
import { nextChoices } from '../../src/core/map';
import {
  activeMods,
  mapItemSummary,
  startStageEffects,
  throwMultiplier,
  useThrowCharges,
  wildExpMultiplier,
  wildLevelBonus,
  wildShinyMultiplier,
} from '../../src/core/mapItems';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseNode, chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

function newRun(seed = 'map-items'): RunState {
  // Past the gentle opening, whose weaker wild Pokémon would hide what these items change.
  const run = chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
  run.encountersCompleted = 2;
  return run;
}

/** Takes a catalog item the way the reward screen does. */
function take(run: RunState, id: string, times = 1): RunState {
  for (let i = 0; i < times; i++) applyCatalog(content, run, getCatalogEntry(content, id), run.party[0], { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
  return run;
}

/** Walks into the first wild node on offer. */
function toWild(run: RunState): RunState {
  const node = nextChoices(run.stage!).find((n) => n.kind === 'wild' && !n.harder) ?? nextChoices(run.stage!).find((n) => n.kind === 'wild');
  if (!node) throw new Error('No wild node on offer');
  return chooseNode(content, run, node.id);
}

const wildOf = (run: RunState) => run.battle!.enemyTeam[0]!;

describe('Repels', () => {
  it('skip the next wild battle: no battle, the level counts, one charge used', () => {
    const run = take(newRun(), 'super-repel');
    expect(mapItemSummary(content, run)).toBe('Super Repel ×2');
    const after = toWild(run);
    expect(after.phase).toBe('map');
    expect(after.battle).toBeNull();
    expect(after.stage!.current).not.toBeNull();
    expect(mapItemSummary(content, after)).toBe('Super Repel ×1');
    const again = toWild(after);
    expect(again.phase).toBe('map');
    expect(again.mapEffects).toEqual([]);
    expect(toWild(again).phase).toBe('battle');
  });

  it('at their max, another Repel is a free re-roll', () => {
    const run = take(newRun(), 'repel', 5);
    expect(isFreeReroll(run, getCatalogEntry(content, 'repel'))).toBe(true);
  });
});

describe('Flutes', () => {
  it('Black Flute: wild Pokémon 2 levels lower; White Flute: 2 higher with +25% EXP', () => {
    const plain = toWild(newRun('flute'));
    const black = toWild(take(newRun('flute'), 'black-flute'));
    const white = take(newRun('flute'), 'white-flute');
    expect(wildExpMultiplier(content, white)).toBe(1.25);
    const whiteBattle = toWild(white);
    expect(wildOf(black).speciesId).toBe(wildOf(plain).speciesId);
    expect(wildOf(black).level).toBe(Math.max(1, wildOf(plain).level - 2));
    expect(wildOf(whiteBattle).level).toBe(wildOf(plain).level + 2);
  });

  it('last only for the rest of the stage', () => {
    const run = take(newRun(), 'black-flute');
    expect(wildLevelBonus(content, run)).toBe(-2);
    run.stage!.index += 1;
    startStageEffects(run);
    expect(wildLevelBonus(content, run)).toBe(0);
    expect(run.mapEffects).toEqual([]);
  });

  it('taken right after the gym leader, a Flute waits for the next stage', () => {
    const run = newRun();
    run.stage!.current = run.stage!.map.nodes.find((n) => n.kind === 'gym')!.id;
    take(run, 'black-flute');
    expect(wildLevelBonus(content, run)).toBe(0);
    run.stage!.index += 1;
    startStageEffects(run);
    expect(wildLevelBonus(content, run)).toBe(-2);
  });
});

describe('Mail', () => {
  it('waits for the next stage, works through it, then ends', () => {
    const run = take(newRun(), 'glitter-mail');
    expect(wildShinyMultiplier(content, run)).toBe(1);
    expect(mapItemSummary(content, run)).toBe('Glitter Mail (next stage)');
    run.stage!.index += 1;
    startStageEffects(run);
    expect(wildShinyMultiplier(content, run)).toBe(2);
    run.stage!.index += 1;
    startStageEffects(run);
    expect(wildShinyMultiplier(content, run)).toBe(1);
  });

  it("type Mail makes the next stage's wild Pokémon that type about half the time", () => {
    let fire = 0;
    for (let i = 0; i < 40; i++) {
      const run = take(newRun(`mail-${i}`), 'flame-mail');
      run.stage!.index += 1;
      startStageEffects(run);
      const types = content.species.get(wildOf(toWild(run)).speciesId)!.types;
      if (types.includes('fire')) fire += 1;
    }
    expect(fire).toBeGreaterThan(10);
    expect(fire).toBeLessThan(35);
  });
});

describe('wild Pokémon chosen by items', () => {
  it("Bluk Berry: the next 3 wild Pokémon are the stage's main type", () => {
    let run = take(newRun('bluk'), 'bluk-berry');
    const main = content.themes.get(run.stage!.themeId)!.types[0]!;
    run = toWild(run);
    expect(content.species.get(wildOf(run).speciesId)!.types).toContain(main);
    expect(mapItemSummary(content, run)).toBe('Bluk Berry ×2');
  });

  it('Unown Report: with enough copies every wild Pokémon is Unown', () => {
    const run = newRun('unown');
    run.passives = { 'unown-report': 20 };
    expect(wildOf(toWild(run)).speciesId).toBe('unown');
  });

  it('Honey gives +2 Charisma and the strongest of three wild Pokémon', () => {
    const bst = (id: string) => Object.values(content.species.get(id)!.baseStats).reduce((a, b) => a + b, 0);
    for (let i = 0; i < 10; i++) {
      const run = take(newRun(`honey-${i}`), 'honey');
      expect(run.attributeModifiers.charisma).toBe(2);
      expect(activeMods(content, run).map((m) => m.mod.mod)).toEqual(['rare']);
      const plain = wildOf(toWild(newRun(`honey-${i}`))).speciesId;
      expect(bst(wildOf(toWild(run)).speciesId)).toBeGreaterThanOrEqual(bst(plain));
    }
  });

  it("items don't change the encounter stream: the same Pokémon appears with a Poké Toy", () => {
    const plain = toWild(newRun('same'));
    const toy = toWild(take(newRun('same'), 'poke-toy'));
    expect(wildOf(toy).speciesId).toBe(wildOf(plain).speciesId);
    expect(wildOf(toy).level).toBe(wildOf(plain).level);
    expect(toy.rng.encounter).toEqual(plain.rng.encounter);
    expect(toy.battle!.enemyStages.spe).toBe(-1);
    expect(toy.mapEffects).toEqual([]);
  });

  it('Poké Radar doubles the shiny chance; Cleanse Tag on the lead lowers wild levels', () => {
    const run = newRun();
    run.passives = { 'poke-radar': 1 };
    expect(wildShinyMultiplier(content, run)).toBe(2);
    run.party[0]!.held = { 'cleanse-tag': 1 };
    expect(wildLevelBonus(content, run)).toBe(-1);
  });
});

describe('Poké Doll', () => {
  it('the wild Pokémon loses its first turn', () => {
    const run = toWild(take(newRun('doll'), 'poke-doll'));
    expect(run.battle!.mapItems).toEqual({ freeTurns: 1, thrown: 0 });
    const ctx: BattleContext = { content, battle: run.battle!, party: run.party, inventory: {}, rng: new Rng(hashSeed('d')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(events.some((e) => e.type === 'held' && e.what === 'distracted')).toBe(true);
    expect(events.filter((e) => e.type === 'move' && e.side === 'enemy')).toHaveLength(0);
    expect(run.battle!.mapItems!.freeTurns).toBe(0);
  });
});

describe('Apricorns and the Fluffy Tail', () => {
  it('raise the catch rate for matching Pokémon and are used up by those throws', () => {
    const run = take(newRun(), 'red-apricorn');
    const fire = createPokemon(content, 'charmander', 5, 'f');
    const water = createPokemon(content, 'squirtle', 5, 'w');
    expect(throwMultiplier(content, run, fire)).toBe(2);
    expect(throwMultiplier(content, run, water)).toBe(1);
    useThrowCharges(content, run, water);
    expect(mapItemSummary(content, run)).toBe('Red Apricorn ×3');
    useThrowCharges(content, run, fire);
    expect(mapItemSummary(content, run)).toBe('Red Apricorn ×2');
    take(run, 'fluffy-tail');
    expect(throwMultiplier(content, run, fire)).toBe(3);
    useThrowCharges(content, run, water);
    expect(throwMultiplier(content, run, fire)).toBe(2);
  });
});

describe('Incense held items', () => {
  const setup = (held: Record<string, number>, enemyMove: string) => {
    const p = createPokemon(content, 'snorlax', 50, 'p1');
    p.moves = [{ id: 'splash', pp: 40 }];
    p.held = held;
    const e = createPokemon(content, 'machop', 50, 'e1');
    e.moves = [{ id: enemyMove, pp: 30 }];
    const battle = createBattle('wild', [e], 0, p.uid, null);
    const ctx: BattleContext = { content, battle, party: [p], inventory: {}, rng: new Rng(hashSeed('inc')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    return ctx;
  };

  it('Lax Incense: the first move aimed at the holder misses, the next ones can hit', () => {
    const ctx = setup({ 'lax-incense': 1 }, 'tackle');
    const first = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(first.some((e) => e.type === 'miss' && e.side === 'enemy')).toBe(true);
    let hit = false;
    for (let i = 0; i < 5 && !hit; i++) hit = resolveTurn(ctx, { kind: 'move', index: 0 }).some((e) => e.type === 'damage' && e.side === 'player');
    expect(hit).toBe(true);
  });

  it('Pure Incense (a team item): wild status moves miss 25% more often, attacks are unchanged', () => {
    const ctx = setup({}, 'growl');
    const player = { side: 'player' as const, mon: ctx.party[0]!, stages: ctx.battle.playerStages, vol: ctx.battle.playerVolatile, flinched: false };
    const enemy = { side: 'enemy' as const, mon: ctx.battle.enemyTeam[0]!, stages: ctx.battle.enemyStages, vol: ctx.battle.enemyVolatile, flinched: false };
    const withIncense = { ...ctx, teamItems: { 'pure-incense': 1 } };
    expect(accuracyMultiplier(withIncense, enemy, player, false, { category: 'status' })).toBeCloseTo(0.75);
    expect(accuracyMultiplier(withIncense, enemy, player, false, { category: 'physical' })).toBe(1);
    expect(accuracyMultiplier(ctx, enemy, player, false, { category: 'status' })).toBe(1);
  });
});
