// M8.9 Phase 1, slice 2: "The Enemy Is Getting Riled Up!" An opposing
// Pokémon that takes 3 hits, sees an ally fall or is denied a finishing blow
// is shown getting riled up a turn ahead, then raises its Attack and Sp. Atk
// just before its next move, unless a status, a super-effective hit or a move
// that lowers its attacks calms it first.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent, type PlayerAction } from '../../src/core/battle/engine';
import type { HyperContext } from '../../src/core/battle/hyper';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { PokemonInstance } from '../../src/core/state';
import type { StoryTriggerKind } from '../../src/core/story/schema';
import { content, toBattle } from './helpers';

const def = (trigger: StoryTriggerKind) => content.story.definitions.find((d) => d.triggerConditions.trigger === trigger)!;

function hyper(triggers: StoryTriggerKind[], evil = 0): HyperContext {
  return {
    rng: new Rng(hashSeed('rage-test')),
    eligibility: (trigger) => (triggers.includes(trigger) ? { def: def(trigger), chance: 1, variant: null } : null),
    attributeShare: (a) => (a === 'evil' ? evil : 0),
    rivalBattles: () => 0,
    friendlyRivals: () => [],
  };
}

/** A fast Jolteon (tackle, growl, glare, double kick) against slow, bulky foes that only use Growl. */
function setup(h: HyperContext | undefined, enemies: PokemonInstance[] = [snorlax('e1')], kind: 'wild' | 'trainer' = 'wild'): BattleContext {
  const player = createPokemon(content, 'jolteon', 50, 'p1');
  player.moves = [
    { id: 'tackle', pp: 35 },
    { id: 'growl', pp: 40 },
    { id: 'glare', pp: 30 },
    { id: 'double-kick', pp: 30 },
  ];
  return {
    content,
    battle: createBattle(kind, enemies, 0, player.uid, kind === 'trainer' ? { classId: 'youngster', name: 'Joey', leaderId: null } : null),
    party: [player],
    inventory: {},
    rng: new Rng(hashSeed('rage-battle')),
    captureRng: new Rng(hashSeed('rage-c')),
    catchMultiplier: 1,
    hyper: h,
  };
}

function snorlax(uid: string, level = 60): PokemonInstance {
  const mon = createPokemon(content, 'snorlax', level, uid);
  mon.moves = [{ id: 'growl', pp: 40 }];
  return mon;
}

const rages = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'hyper' }> => e.type === 'hyper' && e.side === 'enemy');
const turn = (ctx: BattleContext, index: number) => resolveTurn(ctx, { kind: 'move', index } as PlayerAction);

describe('The Enemy Is Getting Riled Up', () => {
  it('after 3 hits it is shown a turn ahead, then raises its Attack and Sp. Atk before its next move', () => {
    const ctx = setup(hyper(['enemyRiledUp']));
    expect(rages(turn(ctx, 0))).toEqual([]);
    expect(rages(turn(ctx, 0))).toEqual([]);
    const third = turn(ctx, 0);
    expect(rages(third)).toEqual([expect.objectContaining({ defId: 'enemy-riled-up', variant: null, uid: 'e1' })]);
    expect(ctx.battle.enemyStages.atk).toBe(0);
    const fourth = turn(ctx, 0);
    const at = fourth.findIndex((e) => e.type === 'hyper');
    expect(fourth[at]).toMatchObject({ variant: 'unleashed' });
    // Before the enemy's own move.
    expect(fourth.findIndex((e) => e.type === 'move' && e.side === 'enemy')).toBeGreaterThan(at);
    expect(ctx.battle.enemyStages.atk).toBe(1);
    expect(ctx.battle.enemyStages.spa).toBe(1);
    // Once per battle for that Pokémon.
    for (let i = 0; i < 4; i++) expect(rages(turn(ctx, 0))).toEqual([]);
  });

  it('a move that lowers its Attack calms it down', () => {
    const ctx = setup(hyper(['enemyRiledUp']));
    for (let i = 0; i < 3; i++) turn(ctx, 0);
    const events = turn(ctx, 1);
    expect(rages(events)).toEqual([expect.objectContaining({ variant: 'calmed' })]);
    expect(ctx.battle.enemyStages.atk).toBe(-1);
    expect(ctx.battle.enemyStages.spa).toBe(0);
  });

  it('a status calms it down, and a statused foe never gets riled up', () => {
    const ctx = setup(hyper(['enemyRiledUp']));
    for (let i = 0; i < 3; i++) turn(ctx, 0);
    const events = turn(ctx, 2);
    expect(events.some((e) => e.type === 'status' && e.side === 'enemy')).toBe(true);
    expect(rages(events)).toEqual([expect.objectContaining({ variant: 'calmed' })]);

    const other = setup(hyper(['enemyRiledUp']));
    turn(other, 2);
    for (let i = 0; i < 4; i++) expect(rages(turn(other, 0))).toEqual([]);
  });

  it('a super-effective hit calms it down', () => {
    const ctx = setup(hyper(['enemyRiledUp']));
    for (let i = 0; i < 3; i++) turn(ctx, 0);
    expect(rages(turn(ctx, 3))).toEqual([expect.objectContaining({ variant: 'calmed' })]);
    expect(ctx.battle.enemyStages.atk).toBe(0);
  });

  it("the trainer's next Pokémon is riled up by seeing its ally fall", () => {
    const weak = createPokemon(content, 'rattata', 2, 'e1');
    weak.moves = [{ id: 'growl', pp: 40 }];
    const ctx = setup(hyper(['enemyRiledUp']), [weak, snorlax('e2')], 'trainer');
    const events = turn(ctx, 0);
    const sent = events.findIndex((e) => e.type === 'switchIn' && e.side === 'enemy');
    const rage = events.findIndex((e) => e.type === 'hyper' && e.side === 'enemy');
    expect(sent).toBeGreaterThan(-1);
    expect(rage).toBeGreaterThan(sent);
    expect(events[rage]).toMatchObject({ uid: 'e2', variant: null });
  });

  it('denied a finishing blow, it gets riled up at the end of the turn', () => {
    const player = createPokemon(content, 'pidgey', 5, 'p1');
    player.moves = [{ id: 'growl', pp: 40 }];
    const enemy = createPokemon(content, 'machamp', 80, 'e1');
    enemy.moves = [{ id: 'close-combat', pp: 5 }];
    const ctx: BattleContext = { ...setup(hyper(['toughenedItOut', 'enemyRiledUp']), [enemy]), party: [player], battle: createBattle('wild', [enemy], 0, 'p1') };
    const events = turn(ctx, 0);
    expect(events.some((e) => e.type === 'hyper' && e.side === 'player' && e.defId === 'toughened-it-out')).toBe(true);
    expect(rages(events)).toEqual([expect.objectContaining({ variant: null })]);
  });

  it('Evil makes it uncontrollable: it also lowers its own Defense', () => {
    const ctx = setup(hyper(['enemyRiledUp'], 1));
    for (let i = 0; i < 3; i++) turn(ctx, 0);
    expect(ctx.battle.hyper.rage.e1).toMatchObject({ state: 'warned', uncontrollable: true });
    expect(rages(turn(ctx, 0))).toEqual([expect.objectContaining({ variant: 'unleashedUncontrollable' })]);
    expect(ctx.battle.enemyStages.atk).toBe(1);
    expect(ctx.battle.enemyStages.def).toBe(-1);
  });

  it('nothing happens without Hyper moments', () => {
    const ctx = setup(undefined);
    for (let i = 0; i < 6; i++) expect(rages(turn(ctx, 0))).toEqual([]);
    expect(ctx.battle.enemyStages.atk).toBe(0);
  });
});

describe('The Enemy Is Getting Riled Up in a run', () => {
  it('the warning is a banner; the unleash and calm lines are quieter', () => {
    let run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'rage', seed: 'rage', archetypeId: 'red' }), 0)));
    run.party[0] = { ...createPokemon(content, 'jolteon', 50, run.party[0]!.uid), moves: [{ id: 'tackle', pp: 35 }] };
    run.battle = createBattle('wild', [snorlax('e1')], 0, run.party[0]!.uid);
    const titles: { title: string; major: boolean }[] = [];
    for (let i = 0; i < 4 && run.battle; i++) {
      const result = takeTurn(content, run, { kind: 'move', index: 0 });
      for (const c of result.cues) titles.push({ title: c.title, major: c.major });
      run = result.run;
    }
    expect(titles).toEqual([
      { title: 'The Enemy Is Getting Riled Up!', major: true },
      { title: 'Riled Up!', major: false },
    ]);
    expect(run.story.events.filter((e) => e.type === 'storyMoment' && e.data.def !== 'campaign-act').map((e) => e.data.def)).toEqual(['enemy-riled-up', 'enemy-riled-up']);
  });
});
