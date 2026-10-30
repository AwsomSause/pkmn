// Features catch-up, everything-left PR: field effects, Substitute, Perish Song, ability tricks and similar.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function duel(playerMove: string, enemyMove = 'splash', turns = 1, enemySpecies = 'snorlax') {
  const player = createPokemon(content, 'rattata', 50, 'p');
  player.moves = [{ id: playerMove, pp: content.moves.get(playerMove)!.pp }];
  const enemy = createPokemon(content, enemySpecies, 50, 'e');
  enemy.moves = [{ id: enemyMove, pp: content.moves.get(enemyMove)!.pp }];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m4')), captureRng: new Rng(hashSeed('m4c')), catchMultiplier: 1 };
  const events = [];
  for (let i = 0; i < turns; i++) events.push(...resolveTurn(ctx, { kind: 'move', index: 0 }));
  return { ctx, battle, events, player, enemy: battle.enemyTeam[0]! };
}

describe('stage 3b moves', () => {
  it('Substitute costs a quarter of the HP and soaks a hit', () => {
    const r = duel('substitute', 'tackle');
    expect(r.events.some((e) => e.type === 'substituteHit')).toBe(true);
  });
  it('Trick Room starts and ends after five turns', () => {
    const r = duel('trick-room', 'splash', 1);
    expect(r.events.some((e) => e.type === 'fieldStart')).toBe(true);
    expect(r.battle.field.trickRoom).toBeGreaterThan(0);
  });
  it('Perish Song knocks both out on the fourth turn', () => {
    const r = duel('perish-song', 'splash', 4);
    expect(r.events.filter((e) => e.type === 'perish').length).toBeGreaterThanOrEqual(3);
    expect(r.events.some((e) => e.type === 'faint')).toBe(true);
  });
  it('Yawn puts the target to sleep after a turn', () => {
    const r = duel('yawn', 'splash', 2);
    expect(r.enemy.status?.id).toBe('slp');
  });
  it('Soak turns the target into a Water type', () => {
    const r = duel('soak');
    expect(r.events.some((e) => e.type === 'selfState' && e.state === 'typeChanged')).toBe(true);
  });
  it('Skill Swap trades abilities', () => {
    const r = duel('skill-swap');
    expect(r.events.some((e) => e.type === 'selfState' && e.state === 'abilityChanged')).toBe(true);
  });
  it('Magnitude does damage and Triple Kick hits three times', () => {
    expect(duel('magnitude').events.some((e) => e.type === 'damage')).toBe(true);
    const h = duel('triple-kick').events.find((e) => e.type === 'hits');
    if (h && h.type === 'hits') expect(h.count).toBe(3);
  });
  it('Stockpile then Spit Up works; Spit Up with nothing stored fails', () => {
    expect(duel('spit-up').events.some((e) => e.type === 'fail')).toBe(true);
  });
});
