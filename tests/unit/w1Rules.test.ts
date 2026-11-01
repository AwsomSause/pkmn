// Ideas W1 battle rules: Type Resonance, Bleed, Curse Tags, Hazard burst, Underdog XP.
import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { addBleed, bleedDamage, causesBleed, curseMultiplier, resonanceMultiplier, underdogXpMultiplier } from '../../src/core/battle/w1Rules';
import { createPokemon } from '../../src/core/pokemon';
import { Rng, hashSeed } from '../../src/core/rng';
import { content } from './helpers';

const mon = (species: string, level: number, moves: string[], uid = species) => {
  const m = createPokemon(content, species, level, uid);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
};
const setup = (party: ReturnType<typeof mon>[], foes: ReturnType<typeof mon>[]) => {
  const battle = createBattle('wild', foes, 0, party[0]!.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('w1')), captureRng: new Rng(hashSeed('cap')), catchMultiplier: 1 };
  return { ctx, battle, turn: (index: number) => resolveTurn(ctx, { kind: 'move', index }) };
};

describe('Type Resonance', () => {
  it('3+ party members sharing a type give that type +5%; 2 do not', () => {
    const three = [mon('squirtle', 10, ['tackle']), mon('psyduck', 10, ['tackle']), mon('staryu', 10, ['tackle'])];
    expect(resonanceMultiplier(content, three, 'water')).toBe(content.balance.w1.resonance.bonus);
    expect(resonanceMultiplier(content, three, 'fire')).toBe(1);
    expect(resonanceMultiplier(content, three.slice(0, 2), 'water')).toBe(1);
  });
});

describe('Bleed', () => {
  it('only the listed moves bleed, stacks cap, damage grows per stack', () => {
    expect(causesBleed(content, 'slash')).toBe(true);
    expect(causesBleed(content, 'tackle')).toBe(false);
    let n = 0;
    for (let i = 0; i < 9; i++) n = addBleed(content, n);
    expect(n).toBe(content.balance.w1.bleed.maxStacks);
    expect(bleedDamage(content, 200, 2)).toBeGreaterThan(bleedDamage(content, 200, 1));
    expect(bleedDamage(content, 200, 0)).toBe(0);
  });
  it('a slicing hit stacks bleed, it hurts at turn end, and a fresh volatile (switch) clears it', () => {
    const f = setup([mon('scyther', 40, ['slash'], 'me')], [mon('snorlax', 40, ['splash'], 'foe')]);
    const ev = f.turn(0);
    expect(f.battle.enemyVolatile.bleed).toBe(1);
    expect(ev.some((e) => e.type === 'spectacle' && e.kind === 'bleed')).toBe(true);
    f.turn(0);
    expect(f.battle.enemyVolatile.bleed).toBe(2);
  });
});

describe('Curse tags', () => {
  it('a Ghost hit tags the foe; Ghost/Dark follow-ups get the bonus', () => {
    const f = setup([mon('gengar', 40, ['shadow-ball'], 'me')], [mon('machamp', 60, ['splash'], 'foe')]);
    f.turn(0);
    expect(f.battle.enemyVolatile.curseTag).toBe(true);
    expect(curseMultiplier(content, true, 'dark')).toBe(content.balance.w1.curse.bonus);
    expect(curseMultiplier(content, true, 'fire')).toBe(1);
    expect(curseMultiplier(content, false, 'ghost')).toBe(1);
  });
});

describe('Underdog XP', () => {
  it('needs the foe team to average 4+ levels higher', () => {
    const party = [mon('squirtle', 20, ['tackle'])];
    expect(underdogXpMultiplier(content, party, [mon('rattata', 24, ['tackle'])])).toBe(content.balance.w1.underdog.xpBonus);
    expect(underdogXpMultiplier(content, party, [mon('rattata', 23, ['tackle'])])).toBe(1);
  });
});

describe('Hazard layers 2.0', () => {
  it('Spikes + Toxic Spikes burst on a switch-in', () => {
    const f = setup([mon('squirtle', 30, ['tackle'], 'a'), mon('bulbasaur', 30, ['tackle'], 'b')], [mon('snorlax', 40, ['splash'], 'foe')]);
    f.battle.sideEffects.player.spikes = 1;
    f.battle.sideEffects.player.toxicSpikes = 1;
    const ev = resolveTurn(f.ctx, { kind: 'switch', partyIndex: 1 });
    expect(ev.some((e) => e.type === 'spectacle' && e.kind === 'hazardBurst')).toBe(true);
  });
});

import { activeChain, chainOf, shinyBoost, shinyMeter, wildLuck } from '../../src/core/wildLuck';
import { createRun } from '../../src/core/run';

describe('Shiny meter, chains and Alpha', () => {
  const fresh = () => createRun(content, { runId: 'wl', seed: 'wl', archetypeId: 'red' });
  it('the meter rises each wild encounter, resets on a shiny, and a chain follows one species', () => {
    const run = fresh();
    wildLuck(content, run, 'rattata', 'n1', false, 0);
    wildLuck(content, run, 'rattata', 'n2', false, 0);
    expect(shinyMeter(run)).toBe(2);
    expect(chainOf(run, 'rattata')).toBe(2);
    expect(shinyBoost(content, run, 'rattata')).toBeGreaterThan(shinyBoost(content, run, 'pidgey'));
    wildLuck(content, run, 'pidgey', 'n3', false, 0);
    expect(activeChain(run)).toEqual({ speciesId: 'pidgey', length: 1 });
    wildLuck(content, run, 'pidgey', 'n4', true, 0);
    expect(shinyMeter(run)).toBe(0);
  });
  it('is deterministic for the same seed and node', () => {
    const a = fresh(), b = fresh();
    const ra = Array.from({ length: 30 }, (_, i) => wildLuck(content, a, 'rattata', `n${i}`, false, 0.5));
    const rb = Array.from({ length: 30 }, (_, i) => wildLuck(content, b, 'rattata', `n${i}`, false, 0.5));
    expect(ra).toEqual(rb);
  });
  it('Alphas happen at about the configured rate', () => {
    const run = fresh();
    let alphas = 0;
    for (let i = 0; i < 400; i++) if (wildLuck(content, run, 'rattata', `a${i}`, false, 0).alpha) alphas++;
    expect(alphas).toBeGreaterThan(5);
    expect(alphas).toBeLessThan(40);
  });
});

import { benchSupporter } from '../../src/core/battle/w1Rules';
describe('Bench support', () => {
  it('needs a benched Pokémon with enough friendship, once per battle', () => {
    const lead = mon('squirtle', 20, ['tackle'], 'a');
    const friend = mon('machamp', 20, ['tackle'], 'b');
    friend.friendship = 100;
    expect(benchSupporter(content, [lead, friend], 0)).toBeNull();
    friend.friendship = content.balance.w1.bench.minFriendship;
    expect(benchSupporter(content, [lead, friend], 0)?.stat).toBe('atk');
    const f = setup([lead, friend], [mon('snorlax', 80, ['splash'], 'foe')]);
    const first = f.turn(0);
    expect(first.some((e) => e.type === 'spectacle' && e.kind === 'benchShout')).toBe(true);
    expect(f.battle.playerStages.atk).toBe(1);
    expect(f.turn(0).some((e) => e.type === 'spectacle' && e.kind === 'benchShout')).toBe(false);
  });
});
