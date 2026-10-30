// M8.9 Phase 1, slice 3: "The Two Pokémon Feel a Heated Rivalry!" Your
// Pokémon that has fought the same opposing species in 3 battles recognises
// it as a rival: +10% damage against it for that battle, and your Rage may
// make it reckless (+20%, but −1 Defense). "Friendly Competition": two
// teammates who keep trading finishing blows become friendly rivals; when one
// lands a finishing blow the other hits 10% harder for the rest of the battle.

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

interface Opts {
  battles?: number;
  rage?: number;
  friends?: Record<string, string[]>;
}

function hyper({ battles = 0, rage = 0, friends = {} }: Opts = {}): HyperContext {
  const on: StoryTriggerKind[] = ['heatedRivalry', 'friendlyCompetition'];
  return {
    rng: new Rng(hashSeed('rivalry-test')),
    eligibility: (trigger) => (on.includes(trigger) ? { def: def(trigger), chance: 1, variant: null } : null),
    attributeShare: (a) => (a === 'rage' ? rage : 0),
    rivalBattles: (_uid, speciesId) => (speciesId === 'snorlax' ? battles : 0),
    friendlyRivals: (uid) => friends[uid] ?? [],
  };
}

function snorlax(uid: string, level = 60): PokemonInstance {
  const mon = createPokemon(content, 'snorlax', level, uid);
  mon.moves = [{ id: 'growl', pp: 40 }];
  return mon;
}

function jolteon(uid: string): PokemonInstance {
  const mon = createPokemon(content, 'jolteon', 50, uid);
  mon.moves = [{ id: 'tackle', pp: 35 }];
  return mon;
}

function setup(h: HyperContext | undefined, enemies: PokemonInstance[] = [snorlax('e1')], party: PokemonInstance[] = [jolteon('p1')]): BattleContext {
  const kind = enemies.length > 1 ? 'trainer' : 'wild';
  return {
    content,
    battle: createBattle(kind, enemies, 0, party[0]!.uid, kind === 'trainer' ? { classId: 'youngster', name: 'Joey', leaderId: null } : null),
    party,
    inventory: {},
    rng: new Rng(hashSeed('rivalry-battle')),
    captureRng: new Rng(hashSeed('rivalry-c')),
    catchMultiplier: 1,
    hyper: h,
  };
}

type HyperEvent = Extract<BattleEvent, { type: 'hyper' }>;
const moments = (events: BattleEvent[]) => events.filter((e): e is HyperEvent => e.type === 'hyper');
const turn = (ctx: BattleContext, action: PlayerAction = { kind: 'move', index: 0 }) => resolveTurn(ctx, action);
const dealt = (events: BattleEvent[]) => events.find((e) => e.type === 'damage' && e.side === 'enemy') as Extract<BattleEvent, { type: 'damage' }>;

describe('The Two Pokémon Feel a Heated Rivalry', () => {
  it('forms in the third battle against the same species and adds 10% damage against it', () => {
    const plain = dealt(turn(setup(hyper({ battles: 0 })))).amount;
    const ctx = setup(hyper({ battles: 2 }));
    const events = turn(ctx);
    expect(moments(events)).toEqual([expect.objectContaining({ defId: 'heated-rivalry', variant: null, uid: 'p1' })]);
    // Before the first move of the battle.
    expect(events.findIndex((e) => e.type === 'hyper')).toBeLessThan(events.findIndex((e) => e.type === 'move'));
    expect(dealt(events).amount).toBe(Math.floor(plain * 1.1));
    expect(ctx.battle.hyper.rivals).toEqual({ 'p1|snorlax': 'calm' });
    // Once per battle; the bonus stays.
    const next = turn(ctx);
    expect(moments(next)).toEqual([]);
    expect(dealt(next).amount).toBeGreaterThan(0);
  });

  it('needs three battles, and later meetings are "It Recognizes Its Rival!"', () => {
    const early = setup(hyper({ battles: 1 }));
    expect(moments(turn(early))).toEqual([]);
    expect(early.battle.hyper.rivals).toEqual({});
    expect(early.battle.hyper.met).toEqual({ p1: ['snorlax'] });
    const later = setup(hyper({ battles: 5 }));
    expect(moments(turn(later))).toEqual([expect.objectContaining({ variant: 'again' })]);
  });

  it('only the rival species gets the bonus', () => {
    const plain = dealt(turn(setup(hyper(), [createPokemon(content, 'jolteon', 50, 'e1')]))).amount;
    const ctx = setup(hyper({ battles: 9 }), [createPokemon(content, 'jolteon', 50, 'e1')]);
    const events = turn(ctx);
    expect(moments(events)).toEqual([]);
    expect(dealt(events).amount).toBe(plain);
  });

  it('Rage can make it reckless: +20% damage, but its Defense drops', () => {
    const plain = dealt(turn(setup(hyper({ battles: 0 })))).amount;
    const ctx = setup(hyper({ battles: 2, rage: 1 }));
    const events = turn(ctx);
    expect(moments(events).map((e) => e.variant)).toEqual([null, 'reckless']);
    expect(ctx.battle.playerStages.def).toBe(-1);
    expect(ctx.battle.hyper.rivals['p1|snorlax']).toBe('reckless');
    expect(dealt(events).amount).toBe(Math.floor(plain * 1.2));
  });

  it('without Hyper moments nothing changes', () => {
    const ctx = setup(undefined);
    expect(moments(turn(ctx))).toEqual([]);
    expect(ctx.battle.hyper.met).toEqual({});
  });
});

describe('Friendly Competition', () => {
  it("when a teammate rival lands a finishing blow, the other won't be outdone", () => {
    const play = (friends: Record<string, string[]>) => {
      const weak = snorlax('e1', 5);
      weak.hp = 1;
      const ctx = setup(hyper({ friends }), [weak, snorlax('e2')], [jolteon('p1'), jolteon('p2')]);
      const first = turn(ctx);
      turn(ctx, { kind: 'switch', partyIndex: 1 });
      return { ctx, first, hit: dealt(turn(ctx)).amount };
    };
    const plain = play({});
    const rivals = play({ p1: ['p2'], p2: ['p1'] });
    expect(moments(plain.first)).toEqual([]);
    expect(moments(rivals.first)).toEqual([expect.objectContaining({ defId: 'friendly-competition', variant: 'outdo', uid: 'p2' })]);
    expect(rivals.ctx.battle.hyper.outdo).toEqual(['p2']);
    expect(rivals.hit).toBe(Math.floor(plain.hit * 1.1));
  });
});

describe('Rivalries in a run', () => {
  function battleRun(enemy: PokemonInstance) {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'rival', seed: 'rival', archetypeId: 'red' }), 0)));
    run.party[0] = { ...jolteon(run.party[0]!.uid) };
    run.battle = createBattle('wild', [enemy], 0, run.party[0]!.uid);
    return run;
  }

  it('counts battles against each species, and the third one forms a rivalry with a banner and a record', () => {
    const weak = snorlax('e1', 5);
    weak.hp = 1;
    let run = battleRun(weak);
    const uid = run.party[0]!.uid;
    run = takeTurn(content, run, { kind: 'move', index: 0 }).run;
    expect(run.battle).toBeNull();
    expect(run.story.histories[uid]!.foes).toEqual({ snorlax: 1 });

    run = battleRun(snorlax('e2'));
    run.story.histories[uid]!.foes = { snorlax: 2 };
    const result = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(result.cues.map((c) => c.title)).toContain('The Two Pokémon Feel a Heated Rivalry!');
    const rel = result.run.story.relationships.find((r) => r.kind === 'rivalry');
    expect(rel).toMatchObject({ a: { kind: 'pokemon', id: uid }, b: { kind: 'enemy', id: 'species:snorlax' }, open: true });
    expect(result.run.story.events.some((e) => e.type === 'rivalryFormed')).toBe(true);
  });

  it('two teammates trading finishing blows start a Friendly Competition', () => {
    const weak = snorlax('e1', 5);
    weak.hp = 1;
    let run = battleRun(weak);
    const a = run.party[0]!.uid;
    run.party.push(jolteon('mate'));
    run.story.histories.mate = structuredClone({ ...run.story.histories[a]!, uid: 'mate', finishTrades: {} });
    run.story.histories[a]!.finishTrades = { mate: 2 };
    run.story.histories.mate.finishTrades = { [a]: 2 };
    run.story.flags.lastFinisher = 'mate';
    const result = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(result.cues.map((c) => c.title)).toContain('Friendly Competition!');
    expect(result.run.story.relationships.find((r) => r.kind === 'rivalry')).toMatchObject({ a: { id: a }, b: { id: 'mate' } });
    expect(result.run.story.histories[a]!.finishTrades.mate).toBe(3);
    expect(result.run.story.flags.lastFinisher).toBe(a);
  });
});
