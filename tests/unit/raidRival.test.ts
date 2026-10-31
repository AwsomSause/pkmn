// A named rival in rival raids: who joins, the deterministic strike, and who gets the prize.
import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { applyBossHp, freshRaidBattle, getRaid } from '../../src/core/raid/raid';
import { pickRaidRival, rivalStrikeDamage } from '../../src/core/raid/rivalAlly';
import { hashSeed, Rng } from '../../src/core/rng';
import { createRun } from '../../src/core/run';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

const rivalOf = (over: object = {}) => ({ id: 'r1', name: 'Blue', classId: 'youngster', encounters: 1, state: 'active', rivalPotential: 10, bonds: {}, memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 1, turns: 3, team: ['rattata'] } }, ...over }) as never;
const newRun = () => createRun(content, { runId: 'rr', seed: 'rr', archetypeId: 'red' });

describe('picking the named rival', () => {
  it('uses the stored rivals, allies first, then the greater rivalry', () => {
    const run = newRun();
    run.story.rivals.push(rivalOf({ id: 'a', name: 'Ann', rivalPotential: 50 }), rivalOf({ id: 'b', name: 'Bo', rivalPotential: 20, state: 'ally' }));
    expect(pickRaidRival(content, run, 30, 'help')?.name).toBe('Bo');
    run.story.rivals[1]!.state = 'retired';
    const ann = pickRaidRival(content, run, 30, 'race');
    expect(ann).toMatchObject({ name: 'Ann', speciesId: 'rattata', level: 27, mode: 'race' });
  });

  it('takes the species from the closest bond', () => {
    const run = newRun();
    const bond = (n: number) => ({ sharedHistory: n });
    run.story.rivals.push(rivalOf({ bonds: { pidgey: bond(2), eevee: bond(9) } }));
    expect(pickRaidRival(content, run, 20, 'help')?.speciesId).toBe('eevee');
  });

  it('is null without rivals, so the old unnamed help still works', () => {
    expect(pickRaidRival(content, newRun(), 20, 'help')).toBeNull();
  });
});

describe('the rival fights', () => {
  function fight() {
    const def = getRaid(content, 'sleeping-snorlax');
    const player = createPokemon(content, 'blissey', 100, 'p1');
    const boss = createPokemon(content, def.species[0]!, 10, 'e1');
    applyBossHp(def, boss);
    boss.hp = maxHp(content, boss);
    const battle = createBattle('wild', [boss], 0, player.uid);
    battle.raid = freshRaidBattle(def);
    battle.raid.rival = { id: 'r1', name: 'Blue', speciesId: 'machamp', level: 30, mode: 'race' };
    const party: PokemonInstance[] = [player];
    const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('rv')), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
    return { ctx, battle, boss };
  }

  it('strikes the same every time, and a racing rival hits harder', () => {
    const { battle, boss } = fight();
    const race = rivalStrikeDamage(content, battle.raid!.rival!, boss);
    expect(rivalStrikeDamage(content, battle.raid!.rival!, boss)).toEqual(race);
    expect(rivalStrikeDamage(content, { ...battle.raid!.rival!, mode: 'help' }, boss).amount).toBeLessThan(race.amount);
  });

  it('takes HP off the boss each turn without help from the player', () => {
    const { ctx, battle, boss } = fight();
    const before = boss.hp;
    const events = resolveTurn(ctx, { kind: 'cheer', cheer: 'healing' });
    expect(events.some((e) => e.type === 'raid' && e.text.includes('Blue'))).toBe(true);
    expect(boss.hp).toBeLessThan(before);
    expect(battle.raid!.rivalFinished).toBe(false);
  });

  it('a rival that lands the final blow ends the raid and is marked', () => {
    const { ctx, battle, boss } = fight();
    boss.hp = 1;
    resolveTurn(ctx, { kind: 'cheer', cheer: 'healing' });
    expect(boss.hp).toBe(0);
    expect(battle.raid!.rivalFinished).toBe(true);
  });
});
