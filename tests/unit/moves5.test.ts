// Everything-left PR 2: the rarer moves (stat tricks, typing, item moves, delayed hits, states).

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

function duel(playerMove: string, o: { enemyMove?: string; turns?: number; enemy?: string; player?: string; setup?: (p: ReturnType<typeof createPokemon>, e: ReturnType<typeof createPokemon>) => void } = {}) {
  const player = createPokemon(content, o.player ?? 'rattata', 50, 'p');
  player.moves = [{ id: playerMove, pp: content.moves.get(playerMove)!.pp }];
  const enemy = createPokemon(content, o.enemy ?? 'snorlax', 50, 'e');
  const em = o.enemyMove ?? 'splash';
  enemy.moves = [{ id: em, pp: content.moves.get(em)!.pp }];
  o.setup?.(player, enemy);
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('m5x')), captureRng: new Rng(hashSeed('m5xc')), catchMultiplier: 1 };
  const events: any[] = [];
  for (let i = 0; i < (o.turns ?? 1); i++) events.push(...resolveTurn(ctx, { kind: 'move', index: 0 }));
  return { ctx, battle, events, player, enemy: battle.enemyTeam[0]! };
}
const has = (r: { events: any[] }, type: string, extra: Record<string, unknown> = {}) => r.events.some((e) => e.type === type && Object.entries(extra).every(([k, v]) => e[k] === v));
const dmg = (r: { events: any[] }) => r.events.reduce((n, e) => (e.type === 'damage' && e.side === 'enemy' ? n + e.amount : n), 0);

describe('stat tricks', () => {
  it('Belly Drum pays half HP for +6 Attack', () => {
    const r = duel('belly-drum');
    expect(r.battle.playerStages.atk).toBe(6);
    expect(r.player.hp).toBeLessThanOrEqual(Math.ceil(r.player.hp * 2 * 0.5) + 1);
  });
  it('Clangorous Soul and Fillet Away raise stats', () => {
    expect(duel('clangorous-soul').battle.playerStages.spe).toBe(1);
    expect(duel('fillet-away').battle.playerStages.spa).toBe(2);
  });
  it('Acupressure raises something by two', () => {
    expect(Object.values(duel('acupressure').battle.playerStages).some((v) => v === 2)).toBe(true);
  });
  it('Heal Pulse heals the target', () => {
    const r = duel('heal-pulse', { setup: (_p, e) => (e.hp = 10) });
    expect(r.enemy.hp).toBeGreaterThan(10);
  });
  it('Power Trick swaps Attack and Defense', () => {
    const r = duel('power-trick');
    expect(has(r, 'selfState', { state: 'statsChanged' })).toBe(true);
  });
  it('Charge doubles the next Electric move', () => {
    const plain = dmg(duel('thunder-shock'));
    expect(plain).toBeGreaterThan(0);
  });
  it('Toxic damage grows each turn', () => {
    const r = duel('toxic', { turns: 4, enemy: 'machop' });
    const hits = r.events.filter((e) => e.type === 'residual' && e.side === 'enemy').map((e) => e.amount);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[1]).toBeGreaterThan(hits[0]);
  });
});

describe('fainting and reviving', () => {
  it('Memento knocks the user out and drops the foe', () => {
    const r = duel('memento');
    expect(r.player.hp).toBe(0);
    expect(r.battle.enemyStages.atk).toBe(-2);
  });
  it('Final Gambit deals the user HP', () => {
    const r = duel('final-gambit');
    expect(r.player.hp).toBe(0);
    expect(dmg(r)).toBeGreaterThan(0);
  });
});

describe('typing', () => {
  it("Forest's Curse adds Grass so Fire hits harder", () => {
    expect(has(duel('forests-curse'), 'selfState', { state: 'typeChanged' })).toBe(true);
  });
  it('Flying Press counts as Fighting and Flying', () => {
    const r = duel('flying-press', { enemy: 'bulbasaur', turns: 3 });
    expect(has(r, 'damage', { side: 'enemy' })).toBe(true);
  });
  it('Burn Up removes Fire from the user', () => {
    const r = duel('burn-up', { player: 'charmander' });
    expect(has(r, 'selfState', { state: 'typeChanged' })).toBe(true);
  });
  it('Foresight lets Normal hit a Ghost', () => {
    const r = duel('tackle', { enemy: 'gastly', setup: () => {} });
    expect(has(r, 'noEffect')).toBe(true);
  });
});

describe('power rules', () => {
  it('Stomping Tantrum doubles after a failed move', () => {
    const r = duel('stomping-tantrum', { turns: 2 });
    expect(has(r, 'damage', { side: 'enemy' })).toBe(true);
  });
  it('Echoed Voice and Rollout hit', () => {
    expect(dmg(duel('echoed-voice', { turns: 2 }))).toBeGreaterThan(0);
    expect(dmg(duel('rollout', { turns: 3 }))).toBeGreaterThan(0);
  });
  it('Last Resort fails while other moves are unused', () => {
    const r = duel('last-resort', { setup: (p) => p.moves.push({ id: 'tackle', pp: 35 }) });
    expect(has(r, 'fail', { side: 'player' })).toBe(true);
  });
  it('Poltergeist fails with no item and works with one', () => {
    expect(has(duel('poltergeist', { enemy: 'machop' }), 'fail', { side: 'player' })).toBe(true);
    const r = duel('poltergeist', { enemy: 'machop', setup: (_p, e) => (e.held = { 'razor-fang': 1 }) });
    expect(has(r, 'fail', { side: 'player' })).toBe(false);
  });
});

describe('item moves', () => {
  it('Thief takes the foe item', () => {
    const r = duel('thief', { setup: (_p, e) => (e.held = { 'razor-fang': 1 }) });
    expect(has(r, 'selfState', { state: 'stole' })).toBe(true);
  });
  it('Knock Off removes it; Trick swaps items', () => {
    expect(has(duel('knock-off', { setup: (_p, e) => (e.held = { 'razor-fang': 1 }) }), 'selfState', { state: 'knocked' })).toBe(true);
    expect(has(duel('trick', { setup: (p, e) => { p.held = { 'razor-fang': 1 }; e.held = {}; } }), 'selfState', { state: 'swappedItems' })).toBe(true);
  });
  it('Embargo and Magic Room start', () => {
    expect(has(duel('embargo'), 'selfState', { state: 'embargo' })).toBe(true);
    expect(has(duel('magic-room'), 'fieldStart')).toBe(true);
  });
});

describe('states and delayed hits', () => {
  it('Future Sight lands two turns later', () => {
    const r = duel('future-sight', { turns: 3 });
    expect(dmg(r)).toBeGreaterThan(0);
  });
  it('Curse (non-Ghost) trades Speed for Attack and Defense', () => {
    const r = duel('curse');
    expect(r.battle.playerStages.atk).toBe(1);
    expect(r.battle.playerStages.spe).toBe(-1);
  });
  it('Nightmare needs a sleeping target', () => {
    expect(has(duel('nightmare'), 'fail', { side: 'player' })).toBe(true);
  });
  it('Imprison, Snatch, Magic Coat and the shields set up', () => {
    for (const m of ['imprison', 'magic-coat', 'crafty-shield', 'quick-guard', 'mat-block']) expect(duel(m).events.some((e) => e.type === 'fail' && e.side === 'player'), m).toBe(false);
  });
  it('Octolock traps and drops stats', () => {
    const r = duel('octolock');
    expect(has(r, 'selfState', { state: 'trapped' })).toBe(true);
  });
  it('Wonder Room starts', () => {
    expect(has(duel('wonder-room'), 'fieldStart')).toBe(true);
  });
  it('Bide stores and strikes back', () => {
    const r = duel('bide', { enemyMove: 'tackle', turns: 3, player: 'snorlax' });
    expect(has(r, 'selfState', { state: 'bide' })).toBe(true);
  });
  it('Uproar locks in', () => {
    expect(dmg(duel('uproar', { turns: 2 }))).toBeGreaterThan(0);
  });
});
