// Features catch-up: the second batch of abilities (entry boosts, field
// setters, priority guards, hit reactions, Corrosion, Good as Gold).

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, startBattle, type BattleContext } from '../../src/core/battle/engine';
import { abilityStatus } from '../../src/core/battle/abilities';
import { abilityOf, createPokemon, getSpecies } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function mon(species: string, ability: string, ...moves: string[]): PokemonInstance {
  const m = createPokemon(content, species, 50, `${species}-u`);
  const { normal, hidden } = getSpecies(content, species).abilities;
  m.abilitySlot = hidden === ability ? -1 : normal.indexOf(ability);
  expect(abilityOf(content, m)).toBe(ability);
  if (moves.length) m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
}
function plain(species: string, ...moves: string[]): PokemonInstance {
  const m = createPokemon(content, species, 50, `${species}-e`);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
}
function setup(player: PokemonInstance, enemy: PokemonInstance) {
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('ab2')), captureRng: new Rng(hashSeed('ab2c')), catchMultiplier: 1 };
  return { ctx, battle };
}
const turn = (ctx: BattleContext) => resolveTurn(ctx, { kind: 'move', index: 0 });

describe('second batch of abilities', () => {
  it('are marked supported', () => {
    for (const id of ['intrepid-sword', 'dauntless-shield', 'dragons-maw', 'dark-aura', 'queenly-majesty', 'good-as-gold', 'corrosion', 'seed-sower', 'hadron-engine']) expect(abilityStatus(id)).toBe('supported');
  });

  it('Intrepid Sword raises Attack on entry', () => {
    const { ctx, battle } = setup(mon('zacian', 'intrepid-sword', 'tackle'), plain('rattata', 'tackle'));
    startBattle(ctx);
    expect(battle.playerStages.atk).toBe(1);
  });

  it('Hadron Engine sets Electric Terrain and Orichalcum Pulse sets sun', () => {
    const a = setup(mon('miraidon', 'hadron-engine', 'tackle'), plain('rattata', 'tackle'));
    startBattle(a.ctx);
    expect(a.battle.terrain?.id).toBe('electric');
    const b = setup(mon('koraidon', 'orichalcum-pulse', 'tackle'), plain('rattata', 'tackle'));
    startBattle(b.ctx);
    expect(b.battle.weather?.id).toBe('sun');
  });

  it('Good as Gold blocks status moves', () => {
    const { ctx, battle } = setup(plain('rattata', 'growl'), mon('gholdengo', 'good-as-gold', 'tackle'));
    turn(ctx);
    expect(battle.enemyStages.atk).toBe(0);
  });

  it('Queenly Majesty stops priority moves', () => {
    const { ctx, battle } = setup(plain('rattata', 'quick-attack'), mon('tsareena', 'queenly-majesty', 'tackle'));
    const before = battle.enemyTeam[0]!.hp;
    turn(ctx);
    expect(battle.enemyTeam[0]!.hp).toBe(before);
  });

  it('Seed Sower sets Grassy Terrain and Sand Spit a sandstorm when hit', () => {
    const a = setup(plain('rattata', 'tackle'), mon('arboliva', 'seed-sower', 'tackle'));
    turn(a.ctx);
    expect(a.battle.terrain?.id).toBe('grassy');
    const b = setup(plain('rattata', 'tackle'), mon('silicobra', 'sand-spit', 'tackle'));
    turn(b.ctx);
    expect(b.battle.weather?.id).toBe('sand');
  });

  it('Corrosion poisons a Steel type', () => {
    const { ctx, battle } = setup(mon('salazzle', 'corrosion', 'poison-powder'), plain('aron', 'tackle'));
    for (let i = 0; i < 6 && !battle.enemyTeam[0]!.status; i++) turn(ctx);
    expect(battle.enemyTeam[0]!.status?.id).toBe('psn');
  });

  it('Cloud Nine switches off weather damage', () => {
    const a = setup(plain('rattata', 'tackle'), mon('golduck', 'cloud-nine', 'tackle'));
    a.battle.weather = { id: 'sand', turns: 5 };
    expect(turn(a.ctx).some((e) => e.type === 'weatherDamage')).toBe(false);
    const b = setup(plain('rattata', 'tackle'), plain('geodude', 'tackle'));
    b.battle.weather = { id: 'sand', turns: 5 };
    expect(turn(b.ctx).some((e) => e.type === 'weatherDamage' && e.side === 'player')).toBe(true);
  });
});
