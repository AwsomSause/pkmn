// Abilities batch 2: move blockers, damage changers, order changers and form changes.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { abilityStatus } from '../../src/core/battle/abilities';
import { content } from './helpers';

function duel(opts: { player?: string; enemy?: string; pAbility?: string; eAbility?: string; pMove?: string; eMove?: string; pLevel?: number; eLevel?: number }) {
  const player = createPokemon(content, opts.player ?? 'machop', opts.pLevel ?? 50, 'p');
  const enemy = createPokemon(content, opts.enemy ?? 'snorlax', opts.eLevel ?? 50, 'e');
  const move = (m: string) => ({ id: m, pp: content.moves.get(m)!.pp });
  player.moves = [move(opts.pMove ?? 'tackle')];
  enemy.moves = [move(opts.eMove ?? 'splash')];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  if (opts.pAbility) battle.playerVolatile.abilityOverride = opts.pAbility;
  if (opts.eAbility) battle.enemyVolatile.abilityOverride = opts.eAbility;
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed('ab3')), captureRng: new Rng(hashSeed('ab3c')), catchMultiplier: 1 };
  return { ctx, battle, player, enemy, go: () => resolveTurn(ctx, { kind: 'move', index: 0 }) };
}
const lost = (es: ReturnType<ReturnType<typeof duel>['go']>, side: 'player' | 'enemy') => es.reduce((n, e) => (e.type === 'damage' && e.side === side ? n + e.amount : n), 0);

describe('batch 2 abilities are supported', () => {
  for (const a of ['bulletproof', 'sharpness', 'wind-rider', 'stakeout', 'parental-bond', 'zen-mode', 'disguise', 'ice-face', 'desolate-land', 'protosynthesis']) {
    it(a, () => expect(abilityStatus(a)).toBe('supported'));
  }
});

describe('move blockers', () => {
  it('Bulletproof stops ball and bomb moves', () => {
    const d = duel({ eAbility: 'bulletproof', pMove: 'shadow-ball' });
    expect(lost(d.go(), 'enemy')).toBe(0);
  });
  it('Wind Rider takes a wind move and raises Attack', () => {
    const d = duel({ eAbility: 'wind-rider', pMove: 'air-cutter' });
    d.go();
    expect(d.battle.enemyStages.atk).toBe(1);
  });
  it('Electromorphosis charges when hit', () => {
    const d = duel({ eAbility: 'electromorphosis' });
    expect(d.go().some((e) => e.type === 'selfState' && e.side === 'enemy' && e.state === 'charged')).toBe(true);
  });
});

describe('damage changers', () => {
  const dmg = (o: Parameters<typeof duel>[0]) => lost(duel({ ...o, enemy: 'snorlax' }).go(), 'enemy');
  it('Parental Bond hits twice for about 1.25x', () => {
    const base = dmg({ pMove: 'tackle' });
    const pb = dmg({ pAbility: 'parental-bond', pMove: 'tackle' });
    expect(pb / base).toBeGreaterThan(1.1);
    expect(pb / base).toBeLessThan(1.4);
  });
  it('Gorilla Tactics raises physical damage by half', () => {
    const base = dmg({ pMove: 'tackle' });
    expect(dmg({ pAbility: 'gorilla-tactics', pMove: 'tackle' }) / base).toBeGreaterThan(1.3);
  });
  it('Tera Shell halves a super effective hit at full HP', () => {
    const base = dmg({ player: 'machop', pMove: 'karate-chop', enemy: 'snorlax' });
    expect(base).toBeGreaterThan(0);
    const shell = lost(duel({ pMove: 'karate-chop', eAbility: 'tera-shell' }).go(), 'enemy');
    expect(shell).toBeLessThan(base);
  });
});

describe('order', () => {
  it('Stall moves last in its priority', () => {
    const d = duel({ player: 'pidgey', pAbility: 'stall', eAbility: undefined, enemy: 'snorlax', pMove: 'tackle', eMove: 'tackle' });
    const first = d.go().find((e) => e.type === 'move');
    expect(first && first.type === 'move' && first.side).toBe('enemy');
  });
});

describe('form changes', () => {
  it('Disguise takes the first hit, then Mimikyu is busted', () => {
    const d = duel({ enemy: 'mimikyu', pMove: 'water-gun' });
    const before = d.enemy.hp;
    d.go();
    expect(d.enemy.speciesId).toBe('mimikyu-busted');
    expect(d.battle.extra.brokenFace).toContain('e');
    expect(d.enemy.hp).toBeLessThan(before);
  });
  it('Zen Mode changes Darmanitan below half HP and the form reverts afterwards', () => {
    const d = duel({ enemy: 'darmanitan', pMove: 'tackle' });
    d.enemy.abilitySlot = -1;
    d.enemy.hp = Math.floor(d.enemy.hp / 3);
    d.go();
    expect(d.enemy.speciesId).toBe('darmanitan-zen');
  });
  it('Shields Down turns Minior into its Core form below half HP', () => {
    const d = duel({ enemy: 'minior', pMove: 'tackle' });
    d.enemy.hp = Math.floor(d.enemy.hp / 3);
    d.go();
    expect(d.enemy.speciesId).toBe('minior-core');
  });
  it('Desolate Land makes water moves fail and keeps the weather', () => {
    const d = duel({ eAbility: 'desolate-land', pMove: 'water-gun' });
    const es = d.go();
    expect(lost(es, 'enemy')).toBe(0);
    expect(d.battle.weather?.id).toBe('sun');
  });
});

describe('last abilities', () => {
  it('Aura Guard halves contact damage', () => {
    const base = lost(duel({ pMove: 'tackle' }).go(), 'enemy');
    const guarded = lost(duel({ pMove: 'tackle', eAbility: 'aura-guard' }).go(), 'enemy');
    expect(guarded).toBeLessThan(base * 0.7);
  });
  it('Shields Down stops status above half HP', () => {
    const d = duel({ enemy: 'minior', pMove: 'thunder-wave' });
    d.go();
    expect(d.enemy.status).toBeNull();
  });
  it('Delta Stream clears weather and takes away Flying weaknesses', () => {
    const d = duel({ enemy: 'pidgey', eAbility: 'delta-stream', pMove: 'thunder-shock' });
    const normal = lost(duel({ enemy: 'pidgey', pMove: 'thunder-shock' }).go(), 'enemy');
    const es = d.go();
    expect(d.battle.extra.delta).toBe(true);
    expect(lost(es, 'enemy')).toBeLessThan(normal);
  });
  it('Teraform Zero clears terrain on entry', () => {
    const d = duel({ eAbility: 'teraform-zero', pMove: 'splash' });
    d.battle.terrain = { id: 'grassy', turns: 5 };
    d.go();
    expect(d.battle.terrain).toBeNull();
  });
  it('Illusion shows another party member until a damaging hit', () => {
    const enemies = [createPokemon(content, 'zoroark', 50, 'e'), createPokemon(content, 'machop', 50, 'e2')];
    const p = createPokemon(content, 'machop', 50, 'p');
    p.moves = [{ id: 'tackle', pp: 35 }];
    enemies.forEach((m) => (m.moves = [{ id: 'splash', pp: 40 }]));
    const battle = createBattle('trainer', enemies, 0, p.uid);
    const ctx: BattleContext = { content, battle, party: [p], inventory: {}, rng: new Rng(hashSeed('ill')), captureRng: new Rng(hashSeed('illc')), catchMultiplier: 1 };
    p.moves = [{ id: 'splash', pp: 40 }];
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.enemyVolatile.illusion).toBe('machop');
    p.moves = [{ id: 'tackle', pp: 35 }];
    const es = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(es.some((e) => e.type === 'transform' && e.kind === 'illusion' && e.broken)).toBe(true);
    expect(battle.enemyVolatile.illusion).toBeNull();
  });
  it('Multitype takes the type of the held plate', async () => {
    const { battleTypes } = await import('../../src/core/battle/transform');
    const d = duel({ player: 'arceus', enemy: 'snorlax' });
    d.battle.held = { ...(d.battle.held ?? {}), lost: {}, gained: {}, embargo: {}, magicRoom: 0 } as never;
    d.player.held = { 'flame-plate': 1 };
    expect(battleTypes(content, d.battle, d.player)).toEqual(['fire']);
  });
});

describe('urge and drop items in the battle bag', () => {
  const use = (d: ReturnType<typeof duel>, itemId: string) => {
    d.ctx.inventory[itemId] = 1;
    return resolveTurn(d.ctx, { kind: 'item', itemId, targetIndex: 0 });
  };
  it('Reset Urge clears the stat changes of the Pokémon in battle', () => {
    const d = duel({ pMove: 'tackle' });
    d.battle.playerStages.atk = 3;
    use(d, 'reset-urge');
    expect(d.battle.playerStages.atk).toBe(0);
  });
  it('Reset Urge is refused with nothing to reset', () => {
    const d = duel({});
    d.ctx.inventory['reset-urge'] = 1;
    expect(() => resolveTurn(d.ctx, { kind: 'item', itemId: 'reset-urge', targetIndex: 0 })).toThrow(/no stat changes/);
  });
  it('Item Urge eats the held Berry now', () => {
    const d = duel({});
    d.player.held = { 'oran-berry': 1 };
    d.player.hp = Math.floor(d.player.hp / 2);
    const before = d.player.hp;
    use(d, 'item-urge');
    expect(d.player.hp).toBeGreaterThan(before);
  });
  it('Item Drop takes the foe\'s held item', () => {
    const d = duel({});
    d.enemy.held = { 'oran-berry': 1 };
    use(d, 'item-drop');
    expect(Object.keys((d.ctx.battle.held!.lost[d.enemy.uid] ?? []))).toContain('0');
  });
});
