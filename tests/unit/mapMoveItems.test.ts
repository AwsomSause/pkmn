// Milestone 8.75, slice 3b-2: getting around the map (Escape Rope, Bicycle,
// Acro Bike, Mach Bike, Bike Voucher, VS Seeker) and map previews (Devon
// Scope, Town Map, Rule Book, Orange Mail, Fame Checker, Itemfinder).

import { describe, expect, it } from 'vitest';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { bossTeamSpecies } from '../../src/core/encounters';
import { findNode, nextChoices } from '../../src/core/map';
import { hiddenItemNode, startStageEffects } from '../../src/core/mapItems';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import {
  chooseNode,
  chooseStarter,
  createRun,
  mapActions,
  mapChoices,
  mapPreviews,
  nextGymLeaders,
  takeTurn,
  useMapAction,
  visitSide,
  type TurnResult,
} from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content, takeAnyReward } from './helpers';

function newRun(seed = 'move-items'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
}

function take(run: RunState, id: string, times = 1): RunState {
  for (let i = 0; i < times; i++) applyCatalog(content, run, getCatalogEntry(content, id), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
  return run;
}

/** Wins the battle in progress with a level 100 lead. */
function win(run: RunState): TurnResult {
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 50 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    turn = takeTurn(content, run, { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

/** Moves without fighting: puts the player on a node as if its battle was won. */
function standOn(run: RunState, nodeId: string): RunState {
  run.stage!.current = nodeId;
  run.stage!.visited.push(nodeId);
  return run;
}

/** A route through the first columns that passes a fork (a node with two ways on). */
function walkPastFork(run: RunState): { run: RunState; fork: string } {
  for (let i = 0; i < 10; i++) {
    const node = nextChoices(run.stage!)[0]!;
    standOn(run, node.id);
    if (node.next.length > 1) {
      standOn(run, findNode(run.stage!.map, node.next[0]!).id);
      return { run, fork: node.id };
    }
  }
  throw new Error('No fork found');
}

const action = (run: RunState, kind: string) => mapActions(content, run).find((a) => a.kind === kind);

describe('Escape Rope', () => {
  it('goes back to the last fork, once per copy', () => {
    const { run, fork } = walkPastFork(take(newRun(), 'escape-rope'));
    expect(action(run, 'escapeRope')!.problem).toBeNull();
    const back = useMapAction(content, run, 'escapeRope').run;
    expect(back.stage!.current).toBe(fork);
    expect(back.stage!.visited[back.stage!.visited.length - 1]).toBe(fork);
    expect(nextChoices(back.stage!).length).toBeGreaterThan(1);
    expect(action(back, 'escapeRope')).toBeUndefined();
  });

  it("can't be used before any fork", () => {
    const run = take(newRun(), 'escape-rope');
    expect(action(run, 'escapeRope')!.problem).toMatch(/No fork/);
    expect(() => useMapAction(content, run, 'escapeRope')).toThrow(/No fork/);
  });
});

describe('bikes', () => {
  it('the Bicycle rides two columns ahead, once per stage', () => {
    let run = take(newRun(), 'bicycle');
    run = useMapAction(content, run, 'bicycle').run;
    expect(run.moveMode).toBe('bicycle');
    const choices = mapChoices(content, run);
    expect(choices.every((n) => n.column === 2)).toBe(true);
    run = chooseNode(content, run, choices[0]!.id);
    expect(run.moveMode).toBeUndefined();
    expect(run.stage!.visited.map((id) => findNode(run.stage!.map, id).column)).toEqual([1, 2]);
    expect(action(run, 'bicycle')!.problem).toMatch(/Already used/);
    // A new stage gives a new ride.
    run.stage!.index += 1;
    startStageEffects(run);
    expect(action(run, 'bicycle')!.problem).toBeNull();
  });

  it('choosing a bike again puts it away without using it', () => {
    let run = useMapAction(content, take(newRun(), 'bicycle'), 'bicycle').run;
    run = useMapAction(content, run, 'bicycle').run;
    expect(run.moveMode).toBeUndefined();
    expect(mapChoices(content, run)).toEqual(nextChoices(run.stage!));
    expect(action(run, 'bicycle')!.problem).toBeNull();
  });

  it('the Acro Bike reaches every stop in the next column', () => {
    let run = newRun();
    standOn(run, nextChoices(run.stage!)[0]!.id);
    take(run, 'acro-bike');
    run = useMapAction(content, run, 'acroBike').run;
    const column = run.stage!.map.nodes.filter((n) => n.column === 2);
    expect(mapChoices(content, run).map((n) => n.id)).toEqual(column.map((n) => n.id));
  });

  it('the Mach Bike rides past a wild Pokémon straight to the reward', () => {
    let run = useMapAction(content, take(newRun(), 'mach-bike'), 'machBike').run;
    const wild = mapChoices(content, run).find((n) => n.kind === 'wild')!;
    run = chooseNode(content, run, wild.id);
    expect(run.battle).toBeNull();
    expect(run.phase).toBe('reward');
    expect(run.draft).not.toBeNull();
    expect(action(run, 'machBike')!.problem).toMatch(/Already used/);
  });

  it("bikes don't work in the Pokémon League", () => {
    const run = take(newRun(), 'bicycle');
    run.stage!.kind = 'league';
    expect(action(run, 'bicycle')!.problem).toMatch(/League/);
  });
});

describe('Bike Voucher', () => {
  const shop = (run: RunState) => {
    const node = run.stage!.map.nodes[0]!;
    node.sides = [{ id: 'test-shop', kind: 'shop', used: false }];
    run.stage!.current = node.id;
    return visitSide(content, run, 'test-shop');
  };

  it('turns into a Bicycle at the next shop, or ₽1500 if you have one', () => {
    const first = shop(take(newRun(), 'bike-voucher'));
    expect(first.run.passives?.bicycle).toBe(1);
    expect(first.run.mapEffects).toEqual([]);
    expect(first.message).toMatch(/Bicycle/);
    const owned = take(take(newRun(), 'bicycle'), 'bike-voucher');
    const money = owned.money;
    const second = shop(owned);
    expect(second.run.passives?.bicycle).toBe(1);
    expect(second.run.money).toBe(money + 1500);
  });
});

describe('VS Seeker', () => {
  it('a trainer from this stage fights again for double money, without changing later battles', () => {
    let run = take(newRun('seeker'), 'vs-seeker');
    expect(action(run, 'rematch')!.problem).toMatch(/No trainer/);
    const trainer = run.stage!.map.nodes.find((n) => n.kind === 'trainer')!;
    standOn(run, trainer.id);
    const encounter = run.rng.encounter;
    const used = useMapAction(content, run, 'rematch').run;
    expect(used.phase).toBe('battle');
    expect(used.battle!.kind).toBe('trainer');
    expect(used.battle!.rematch).toBe(true);
    expect(used.rng.encounter).toEqual(encounter);
    expect(used.stage!.current).toBe(trainer.id);
    const end = win(used);
    expect(end.end!.moneyGained).toBeGreaterThan(0);
    run = end.run;
    expect(action(run, 'rematch')).toBeUndefined();
  });
});

describe('map previews', () => {
  it('the Devon Scope shows exactly the wild Pokémon you meet, without using a roll', () => {
    const run = take(newRun('scope'), 'devon-scope');
    const rng = structuredClone(run.rng);
    const previews = mapPreviews(content, run);
    expect(run.rng).toEqual(rng);
    for (const node of nextChoices(run.stage!).filter((n) => n.kind === 'wild')) {
      const met = chooseNode(content, run, node.id).battle!.enemyTeam[0]!;
      expect(previews[node.id]!.team).toEqual([{ speciesId: met.speciesId, level: met.level }]);
    }
    expect(mapPreviews(content, newRun('scope'))).toEqual({});
  });

  it("the Town Map shows the next trainers' teams", () => {
    const run = take(newRun('town'), 'town-map');
    const trainer = run.stage!.map.nodes.find((n) => n.kind === 'trainer')!;
    const before = run.stage!.map.nodes.find((n) => n.next.includes(trainer.id))!;
    standOn(run, before.id);
    const preview = mapPreviews(content, run)[trainer.id]!;
    const battle = chooseNode(content, run, trainer.id).battle!;
    expect(preview.team.map((m) => m.speciesId)).toEqual(battle.enemyTeam.map((m) => m.speciesId));
    expect(preview.trainerName).toBe(battle.trainer!.name);
  });

  it("the Rule Book shows the gym leader's ace; Orange Mail the whole team on the next stage", () => {
    const run = take(newRun('rules'), 'rule-book');
    const gym = run.stage!.map.nodes.find((n) => n.kind === 'gym')!;
    const team = bossTeamSpecies(content, 'gym', run.stage!.leaderId, run.stage!.index);
    expect(mapPreviews(content, run)[gym.id]!.team).toEqual([{ speciesId: team[team.length - 1], level: null }]);
    const mail = take(newRun('rules'), 'orange-mail');
    expect(mapPreviews(content, mail)[gym.id]).toBeUndefined();
    mail.stage!.index += 1;
    startStageEffects(mail);
    const next = bossTeamSpecies(content, 'gym', mail.stage!.leaderId, mail.stage!.index);
    expect(mapPreviews(content, mail)[gym.id]!.team.map((m) => m.speciesId)).toEqual(next);
  });

  it('the Fame Checker names the gym leaders still to come, as the stages will really have them', () => {
    const run = take(newRun('fame'), 'fame-checker');
    const leaders = nextGymLeaders(content, run);
    expect(leaders).toHaveLength(content.campaigns.get(run.campaignId)!.stagesPerRegion - 1);
    expect(leaders.every((l) => l.types.length > 0)).toBe(true);
    expect(nextGymLeaders(content, newRun('fame'))).toEqual([]);
    // Beat the gym leader: the next stage's leader is the first one named.
    const gym = run.stage!.map.nodes.find((n) => n.kind === 'gym')!;
    standOn(run, run.stage!.map.nodes.find((n) => n.next.includes(gym.id))!.id);
    const after = takeAnyReward(win(chooseNode(content, run, gym.id)).run);
    expect(after.stage!.index).toBe(1);
    expect(after.stage!.leaderId).toBe(leaders[0]!.leaderId);
    expect(nextGymLeaders(content, after).map((l) => l.leaderId)).toEqual(leaders.slice(1).map((l) => l.leaderId));
  });
});

describe('Itemfinder', () => {
  it('one wild stop per stage hides a Bag item; winning there finds it once', () => {
    let run = take(newRun('finder'), 'itemfinder');
    const hidden = hiddenItemNode(content, run)!;
    expect(hiddenItemNode(content, run)).toBe(hidden);
    expect(hiddenItemNode(content, newRun('finder'))).toBeNull();
    const node = findNode(run.stage!.map, hidden);
    const before = run.stage!.map.nodes.find((n) => n.next.includes(hidden));
    if (before) standOn(run, before.id);
    expect(node.column === 1 || before).toBeTruthy();
    run = chooseNode(content, run, hidden);
    const end = win(run);
    expect(end.end!.itemsFound).toHaveLength(1);
    expect(end.run.inventory[end.end!.itemsFound[0]!]).toBeGreaterThanOrEqual(1);
  });
});
