// Raid field rules and cheers (Raid Battles pack): surge, rotating weakness, healing restriction, cheers, extra moves, capture jingle.

import { describe, expect, it } from 'vitest';
import { createBattle, itemProblem, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { placeRaidDens, raidMemories, applyBossHp, cheerProblem, freshRaidBattle, getRaid, raidFieldMultiplier, rotatingWeakness } from '../../src/core/raid/raid';
import { raidCaptureTrack } from '../../src/core/presentation/battleMusic';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, enterRaid, takeTurn } from '../../src/core/run';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function fight(raidId: string) {
  const def = getRaid(content, raidId);
  const player = createPokemon(content, 'blissey', 100, 'p1');
  player.hp = Math.floor(maxHp(content, player) / 2);
  const boss = createPokemon(content, def.species[0]!, 10, 'e1');
  applyBossHp(def, boss);
  boss.hp = maxHp(content, boss);
  const battle = createBattle('wild', [boss], 0, player.uid);
  battle.raid = freshRaidBattle(def);
  const party: PokemonInstance[] = [player];
  const ctx: BattleContext = { content, battle, party, inventory: { potion: 3 }, rng: new Rng(hashSeed(raidId)), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  return { def, player, boss, battle, ctx };
}

describe('raid field rules', () => {
  it('the elemental surge boosts only the boss and only its type', () => {
    const { battle } = fight('storm-gyarados');
    expect(raidFieldMultiplier(content, battle, 'enemy', 'water')).toBe(1.25);
    expect(raidFieldMultiplier(content, battle, 'enemy', 'fire')).toBe(1);
    expect(raidFieldMultiplier(content, battle, 'player', 'water')).toBe(1);
  });

  it('the weakness rotates with the turn number and boosts your hits of that type', () => {
    const { battle } = fight('crystal-golem');
    expect(rotatingWeakness(content, battle)!.type).toBe('water');
    expect(raidFieldMultiplier(content, battle, 'player', 'water')).toBe(1.5);
    expect(raidFieldMultiplier(content, battle, 'player', 'grass')).toBe(1);
    battle.turn = 3;
    expect(rotatingWeakness(content, battle)!.type).toBe('grass');
    battle.turn = 9;
    expect(rotatingWeakness(content, battle)!.type).toBe('water');
  });

  it('a raid with no rules changes nothing', () => {
    const { battle } = fight('sleeping-snorlax');
    expect(raidFieldMultiplier(content, battle, 'enemy', 'normal')).toBe(1);
    expect(rotatingWeakness(content, battle)).toBeNull();
  });

  it('healing restriction blocks healing items and the Healing cheer', () => {
    const { ctx, battle } = fight('sandstorm-tyranitar');
    expect(itemProblem(ctx, 'potion', 0)).toMatch(/restricted/);
    expect(cheerProblem(content, battle, 'healing')).toMatch(/restricted/);
    expect(cheerProblem(content, battle, 'offense')).toBeNull();
    const free = fight('sleeping-snorlax');
    expect(itemProblem(free.ctx, 'potion', 0)).toBeNull();
  });

  it('bosses can know more than four moves', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'xm', seed: 'xm', archetypeId: 'red' }), 0);
    const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
    node.sides.push({ id: 'raid-x', kind: 'raid', raidId: 'sky-pillar-apex', used: false });
    run.stage!.current = node.id;
    run.money = 99999;
    const started = enterRaid(content, run, 'raid-x');
    const boss = started.battle!.enemyTeam[0]!;
    expect(boss.moves.length).toBeGreaterThan(4);
    expect(boss.moves.length).toBeLessThanOrEqual(6);
  });
});

describe('cheers', () => {
  it('Offense lasts a few turns, costs one cheer and the turn', () => {
    const { ctx, battle } = fight('sleeping-snorlax');
    resolveTurn(ctx, { kind: 'cheer', cheer: 'offense' });
    expect(battle.raid!.cheersLeft).toBe(2);
    expect(raidFieldMultiplier(content, battle, 'player', 'normal')).toBeCloseTo(battle.raid!.cheerOffense > 0 ? 1.3 : 1);
    expect(battle.raid!.cheerOffense).toBeGreaterThan(0);
    resolveTurn(ctx, { kind: 'idle' });
    resolveTurn(ctx, { kind: 'idle' });
    resolveTurn(ctx, { kind: 'idle' });
    expect(battle.raid!.cheerOffense).toBe(0);
  });

  it('Healing restores HP and cures status; three cheers at most', () => {
    const { ctx, player, battle } = fight('sleeping-snorlax');
    player.status = { id: 'par' } as never;
    const before = player.hp;
    resolveTurn(ctx, { kind: 'cheer', cheer: 'healing' });
    expect(player.status).toBeNull();
    expect(player.hp).toBeGreaterThan(before - 1);
    resolveTurn(ctx, { kind: 'cheer', cheer: 'defense' });
    resolveTurn(ctx, { kind: 'cheer', cheer: 'defense' });
    expect(battle.raid!.cheersLeft).toBe(0);
    expect(() => resolveTurn(ctx, { kind: 'cheer', cheer: 'offense' })).toThrow(/No cheers/);
  });

  it('Turn the tables reverses the stat changes of both teams', () => {
    const { ctx, battle } = fight('sleeping-snorlax');
    battle.enemyStages.acc = 2;
    battle.enemyStages.eva = -1;
    battle.playerStages.eva = 3;
    const events = resolveTurn(ctx, { kind: 'cheer', cheer: 'counter' });
    expect(battle.raid!.cheersLeft).toBe(2);
    expect(battle.enemyStages.acc).toBe(-2);
    expect(battle.enemyStages.eva).toBe(1);
    expect(battle.playerStages.eva).toBe(-3);
    expect(events.filter((e) => e.type === 'stat').length).toBeGreaterThanOrEqual(3);
  });

  it('cheers only exist in raids', () => {
    const { ctx, battle } = fight('sleeping-snorlax');
    delete battle.raid;
    expect(() => resolveTurn(ctx, { kind: 'cheer', cheer: 'offense' })).toThrow();
  });
});

describe('raid capture jingle', () => {
  it('picks a jingle by tier', () => {
    expect(raidCaptureTrack(1)).toBe('bgm.raid.capture.basic');
    expect(raidCaptureTrack(3)).toBe('bgm.raid.capture.ultra');
    expect(raidCaptureTrack(4)).toBe('bgm.raid.capture.max');
    expect(raidCaptureTrack(6)).toBe('bgm.raid.capture.tera');
  });
});

describe('raid memories', () => {
  it('the Pokémon in front when a shield breaks earns "Broke Its Guard"', () => {
    const { ctx, battle, boss, player } = fight('storm-gyarados');
    expect(battle.raid!.breaker).toBeNull();
    boss.hp = Math.floor(maxHp(content, boss) * 0.7);
    battle.raid!.shieldHp = 1;
    battle.raid!.shieldMax = 1;
    for (let i = 0; i < 4 && !battle.raid!.breaker && !battle.outcome; i++) resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.raid!.breaker).toBe(player.uid);
  });

  it('lists lead, breaker, tank, survivor and the finisher without duplicating keys', () => {
    const { battle } = fight('sleeping-snorlax');
    Object.assign(battle.raid!, { lead: 'a', breaker: 'b', tank: 'b', survivor: 'c' });
    const list = raidMemories(battle, 'd');
    expect(list.map((m) => m.key)).toEqual(['lead', 'breaker', 'tank', 'survivor', 'finisher']);
    expect(list.find((m) => m.key === 'finisher')!.text('Pikachu', 'Snorlax')).toContain('final blow');
  });

  it('a won raid records memories and friendship for contributors', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'rm', seed: 'rm', archetypeId: 'red' }), 0);
    const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
    node.sides.push({ id: 'raid-m', kind: 'raid', raidId: 'sleeping-snorlax', used: false });
    run.stage!.current = node.id;
    const started = enterRaid(content, run, 'raid-m');
    expect(started.battle!.raid!.lead).toBe(started.party[0]!.uid);
    started.battle!.enemyTeam[0]!.hp = 1;
    started.party[0]!.level = 100;
    const before = started.party[0]!.friendship;
    let r = started;
    for (let i = 0; i < 6 && r.battle; i++) r = takeTurn(content, r, { kind: 'move', index: 0 }).run;
    const memories = r.story.histories[r.party[0]!.uid]?.memories.filter((m) => m.text.includes('final blow') || m.text.includes('first to face')) ?? [];
    expect(memories.length).toBeGreaterThan(0);
    expect(r.party[0]!.friendship).toBeGreaterThan(before);
  });
});

describe('raid types', () => {
  function denRun(raidId: string, seed: string, returning = false) {
    const run = chooseStarter(content, createRun(content, { runId: 'rt', seed, archetypeId: 'red' }), 0);
    const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
    node.sides = node.sides.filter((s) => s.kind !== 'raid');
    node.sides.push({ id: 'raid-t', kind: 'raid', raidId, used: false, returning: returning || undefined });
    run.stage!.current = node.id;
    run.money = 99999;
    return run;
  }
  const bossHp = (r: ReturnType<typeof denRun>) => maxHp(content, r.battle!.enemyTeam[0]!);

  it('a regional raid: scouting costs money and makes the boss weaker than rushing', () => {
    const scout = enterRaid(content, denRun('ridge-blight', 'rt-1'), 'raid-t', 'scout');
    const rush = enterRaid(content, denRun('ridge-blight', 'rt-1'), 'raid-t', 'rush');
    expect(bossHp(scout)).toBeLessThan(bossHp(rush));
    expect(99999 - scout.money).toBe(150 + 200);
    expect(99999 - rush.money).toBe(150);
    expect(rush.battle!.raid!.draftDelta).toBe(1);
  });

  it('a rival raid: helping or racing starts the boss hurt; leaving skips the fight', () => {
    const help = enterRaid(content, denRun('rival-den', 'rt-2'), 'raid-t', 'help');
    expect(help.battle!.enemyTeam[0]!.hp / bossHp(help)).toBeLessThan(0.65);
    expect(help.battle!.raid!.rivalHelped).toBe(true);
    const race = enterRaid(content, denRun('rival-den', 'rt-2'), 'raid-t', 'compete');
    expect(race.battle!.raid!.timerLeft).toBe(12);
    const left = enterRaid(content, denRun('rival-den', 'rt-2'), 'raid-t', 'leave');
    expect(left.battle).toBeNull();
    expect(left.phase).toBe('map');
    expect(left.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id === 'raid-t')!.used).toBe(true);
  });

  it('an escaped boss comes back in a later stage, stronger, and only once', () => {
    const base = denRun('sleeping-snorlax', 'rt-3');
    const normal = enterRaid(content, structuredClone(base), 'raid-t');
    const back = enterRaid(content, denRun('sleeping-snorlax', 'rt-3', true), 'raid-t');
    expect(back.battle!.enemyTeam[0]!.level).toBe(normal.battle!.enemyTeam[0]!.level + 3);
    expect(bossHp(back)).toBeGreaterThan(bossHp(normal));
    expect(back.battle!.raid!.returning).toBe(true);
    expect(back.battle!.raid!.draftDelta).toBe(1);
  });

  it('a timed-out raid lets the boss escape; the next stage has it back as a returning den', () => {
    let run = enterRaid(content, denRun('sleeping-snorlax', 'rt-4'), 'raid-t');
    run.battle!.raid!.timerLeft = 1;
    run = takeTurn(content, run, { kind: 'idle' }).run;
    expect(run.battle).toBeNull();
    expect(run.raids.escaped).toEqual(['sleeping-snorlax']);
    const memory = run.story.histories[run.party[0]!.uid]?.memories.some((m) => m.text.includes('The One That Got Away'));
    expect(memory).toBe(true);
    for (const n of run.stage!.map.nodes) n.sides = n.sides.filter((x) => x.kind !== 'raid');
    placeRaidDens(content, run);
    const den = run.stage!.map.nodes.flatMap((n) => n.sides).find((x) => x.kind === 'raid');
    expect(den?.returning).toBe(true);
    expect(den?.raidId).toBe('sleeping-snorlax');
    expect(run.raids.escaped).toEqual([]);
  });

  it('data: every kind has what it needs', () => {
    const raids = content.raids.raids;
    expect(raids.filter((r) => r.kind === 'regional').every((r) => r.approaches.length >= 2)).toBe(true);
    expect(raids.filter((r) => r.kind === 'rival').every((r) => r.approaches.some((a) => a.leave) && r.approaches.some((a) => a.rivalHelps))).toBe(true);
    expect(raids.filter((r) => r.kind === 'anomaly').length).toBeGreaterThanOrEqual(2);
  });
});
