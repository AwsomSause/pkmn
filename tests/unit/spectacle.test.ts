// Battle Drama spectacle (APPROVED section 7): Last Stand, Perfect Counter, Momentum and Rally, Guard Break,
// Revenge Moment, boss phases, and the Boss Revenge Rematch. Rules are deterministic (own seeded streams).

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, telegraphedAttack, type BattleContext, type BattleEvent, type PlayerAction } from '../../src/core/battle/engine';
import { freshSpectacle, rallyProblem, counterProblem, rollLastStand, spectacleOf } from '../../src/core/battle/spectacle';
import type { Content } from '../../src/core/contentSchema';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import { bossRematchPlan, dueBossRematch, recordBossDefeat } from '../../src/core/story/bossRematch';
import { planGymLeader } from '../../src/core/encounters';
import { content, scaleAt, toBattle } from './helpers';

const withSpectacle = (patch: Record<string, unknown>): Content => {
  const base = content.balance.spectacle as unknown as Record<string, Record<string, unknown>>;
  const merged = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) merged[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...base[k], ...v } : v;
  return { ...content, balance: { ...content.balance, spectacle: merged as never } };
};

const mon = (species: string, level: number, moves: string[], uid = species) => {
  const m = createPokemon(content, species, level, uid);
  m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  return m;
};

interface Setup { c: Content; seed?: string; foes?: PokemonInstance[]; party?: PokemonInstance[]; classId?: string; bond?: number; ai?: number }
function fight(o: Setup) {
  const c = o.c;
  const party = o.party ?? [mon('blastoise', 50, ['surf', 'tackle'], 'me')];
  const foes = o.foes ?? [mon('onix', 60, ['strength', 'tackle'], 'foe1'), mon('onix', 60, ['strength', 'tackle'], 'foe2')];
  const battle = createBattle('trainer', foes, 0, party[0]!.uid, { classId: o.classId ?? 'gym-leader', name: 'Brock', leaderId: 'brock' });
  battle.ai = o.ai ?? 1;
  const ctx: BattleContext = { content: c, battle, party, inventory: {}, rng: new Rng(hashSeed(o.seed ?? 'spec')), captureRng: new Rng(hashSeed('cap')), catchMultiplier: 1, bondScore: () => o.bond ?? 0 };
  return { ctx, battle, party, foes, turn: (a: PlayerAction): BattleEvent[] => resolveTurn(ctx, a) };
}
const kinds = (events: BattleEvent[]) => events.filter((e) => e.type === 'spectacle').map((e) => (e as { kind: string }).kind);
const damageTo = (events: BattleEvent[], side: 'player' | 'enemy') => events.filter((e) => e.type === 'damage' && e.side === side).reduce((n, e) => n + (e as { amount: number }).amount, 0);

describe('Perfect Counter', () => {
  it('a boss telegraphs, bracing for it cuts the hit and reflects part of it, and builds Momentum', () => {
    const idle = fight({ c: content });
    const brace = fight({ c: content });
    expect(telegraphedAttack(brace.ctx)).toBe('strength');
    const base = idle.turn({ kind: 'idle' });
    const ev = brace.turn({ kind: 'counter' });
    expect(kinds(ev)).toEqual(expect.arrayContaining(['brace', 'counter']));
    expect(damageTo(ev, 'player')).toBeLessThan(damageTo(base, 'player'));
    expect(damageTo(ev, 'enemy')).toBeGreaterThan(0);
    expect(brace.battle.spectacle!.momentum).toBe(content.balance.spectacle.momentum.counter);
    expect(brace.battle.spectacle!.counters).toBe(1);
  });
  it('is refused against ordinary trainers and after the allowance is spent', () => {
    const plain = fight({ c: content, classId: 'youngster' });
    expect(telegraphedAttack(plain.ctx)).toBeNull();
    expect(() => plain.turn({ kind: 'counter' })).toThrow();
    const f = fight({ c: content });
    const spec = spectacleOf(content, f.battle)!;
    spec.counters = content.balance.spectacle.counter.perBattle;
    expect(counterProblem(content, f.battle, true)).toMatch(/No Counters/);
    expect(() => f.turn({ kind: 'counter' })).toThrow();
  });
  it('braces in vain when the boss picks another move (a miss costs the turn)', () => {
    let missed = false;
    for (let i = 0; i < 40 && !missed; i++) {
      const f = fight({ c: content, seed: `miss${i}`, ai: 0 });
      missed = kinds(f.turn({ kind: 'counter' })).includes('counterMiss');
    }
    expect(missed).toBe(true);
  });
});

describe('Guard Break', () => {
  it('a boss Pokémon takes a guarded stance, a super effective hit breaks it, and the staggered boss skips its strongest move and takes more damage', () => {
    const f = fight({ c: content });
    const first = f.turn({ kind: 'move', index: 0 });
    expect(kinds(first)).toEqual(expect.arrayContaining(['guardUp', 'guardBreak']));
    const spec = f.battle.spectacle!;
    expect(spec.guard).toMatchObject({ uid: 'foe1', hp: 0 });
    expect(spec.guard!.stagger).toBeGreaterThan(0);
    const second = f.turn({ kind: 'move', index: 0 });
    const foeMoves = second.filter((e) => e.type === 'move' && e.side === 'enemy').map((e) => (e as { moveId: string }).moveId);
    expect(foeMoves).not.toContain('strength');
  });
  it('ordinary trainers never raise a Guard', () => {
    const f = fight({ c: content, classId: 'youngster' });
    expect(kinds(f.turn({ kind: 'move', index: 0 }))).not.toContain('guardUp');
  });
  it('shaves damage while the guard stands', () => {
    const guarded = fight({ c: content, party: [mon('blastoise', 50, ['tackle'], 'me')] });
    const open = fight({ c: withSpectacle({ guard: { classes: {} } }), party: [mon('blastoise', 50, ['tackle'], 'me')] });
    const a = damageTo(guarded.turn({ kind: 'move', index: 0 }), 'enemy');
    const b = damageTo(open.turn({ kind: 'move', index: 0 }), 'enemy');
    expect(a).toBeLessThan(b);
  });
});

describe('Momentum Meter and Rally', () => {
  it('super effective hits and knockouts build it; a full meter powers a Surge Strike once spent', () => {
    const f = fight({ c: content, classId: 'youngster' });
    f.turn({ kind: 'move', index: 0 });
    expect(f.battle.spectacle!.momentum).toBeGreaterThanOrEqual(content.balance.spectacle.momentum.superEffective);
    expect(rallyProblem(content, f.battle)).toMatch(/not full/);
    expect(() => f.turn({ kind: 'move', index: 0, rally: true })).toThrow();
  });
  it('a Rally hits harder, empties the meter and is limited per battle', () => {
    const a = fight({ c: content, classId: 'youngster', seed: 'rally' });
    const b = fight({ c: content, classId: 'youngster', seed: 'rally' });
    a.turn({ kind: 'idle' });
    b.turn({ kind: 'idle' });
    spectacleOf(content, a.battle)!.momentum = content.balance.spectacle.momentum.max;
    const surge = a.turn({ kind: 'move', index: 0, rally: true });
    const plain = b.turn({ kind: 'move', index: 0 });
    expect(kinds(surge)).toContain('rally');
    expect(damageTo(surge, 'enemy')).toBeGreaterThan(damageTo(plain, 'enemy'));
    expect(a.battle.spectacle!.rallies).toBe(1);
    expect(a.battle.spectacle!.momentum).toBeLessThan(content.balance.spectacle.momentum.max);
  });
  it('your Pokémon fainting costs half the meter', () => {
    const f = fight({ c: content, classId: 'youngster', party: [mon('magikarp', 5, ['splash'], 'me'), mon('blastoise', 50, ['surf'], 'b2')], foes: [mon('onix', 60, ['strength'], 'foe1')] });
    spectacleOf(content, f.battle)!.momentum = 80;
    f.turn({ kind: 'idle' });
    expect(f.battle.spectacle!.momentum).toBe(40);
  });
});

describe('Last Stand and Revenge Moment', () => {
  const sure = withSpectacle({ lastStand: { chance: 1 }, revenge: { chance: 1 } });
  it('only a deep bond holds on at 1 HP, once per battle, with a boost', () => {
    const f = fight({ c: sure, bond: 90, classId: 'youngster', party: [mon('magikarp', 10, ['splash'], 'me'), mon('blastoise', 50, ['surf'], 'b2')], foes: [mon('onix', 60, ['strength'], 'foe1')] });
    const ev = f.turn({ kind: 'idle' });
    expect(kinds(ev)).toContain('lastStand');
    expect(f.party[0]!.hp).toBe(1);
    expect(f.battle.playerStages.atk).toBe(1);
    const again = f.turn({ kind: 'idle' });
    expect(kinds(again)).not.toContain('lastStand');
    expect(f.party[0]!.hp).toBe(0);
  });
  it('a shallow bond never does', () => {
    const f = fight({ c: sure, bond: 10, classId: 'youngster', party: [mon('magikarp', 10, ['splash'], 'me'), mon('blastoise', 50, ['surf'], 'b2')], foes: [mon('onix', 60, ['strength'], 'foe1')] });
    expect(kinds(f.turn({ kind: 'idle' }))).not.toContain('lastStand');
    expect(f.party[0]!.hp).toBe(0);
  });
  it('rollLastStand is deterministic and respects its allowance', () => {
    const f = fight({ c: sure, bond: 90 });
    const input = { battle: f.battle, mon: f.party[0]!, bond: 90, lastStanding: false };
    expect(rollLastStand(sure, input)).toBe(rollLastStand(sure, input));
    spectacleOf(sure, f.battle)!.lastStands.push('someone');
    expect(rollLastStand(sure, input)).toBe(false);
  });
  it('a bonded teammate sent out after a faint answers with a Revenge Moment', () => {
    const f = fight({ c: sure, bond: 90, classId: 'youngster', party: [mon('magikarp', 10, ['splash'], 'me'), mon('blastoise', 50, ['surf'], 'b2')], foes: [mon('onix', 60, ['strength'], 'foe1')] });
    // Spent Last Stand: the first Pokémon falls.
    spectacleOf(sure, f.battle)!.lastStands.push('me');
    f.turn({ kind: 'idle' });
    expect(f.battle.needsSwitch).toBe(true);
    const ev = f.turn({ kind: 'switch', partyIndex: 1 });
    expect(kinds(ev)).toContain('revenge');
    expect(f.battle.playerStages.atk).toBe(1);
  });
});

describe('boss phases', () => {
  it('a boss ace crossing its HP line plays one phase (boost + banner), once', () => {
    const f = fight({ c: content, ai: 0, foes: [mon('onix', 60, ['tackle'], 'foe1')] });
    f.foes[0]!.hp = Math.floor(maxHp(content, f.foes[0]!) * 0.3);
    const ev = f.turn({ kind: 'idle' });
    expect(ev.some((e) => e.type === 'raid' && e.tone === 'phase')).toBe(true);
    expect(f.battle.enemyStages.atk).toBe(1);
    const again = f.turn({ kind: 'idle' });
    expect(again.some((e) => e.type === 'raid' && e.tone === 'phase')).toBe(false);
  });
});

describe('switching spectacle off', () => {
  it('changes nothing in the fight', () => {
    const off = withSpectacle({ enabled: false });
    const f = fight({ c: off });
    const ev = f.turn({ kind: 'move', index: 0 });
    expect(kinds(ev)).toEqual([]);
    expect(f.battle.spectacle).toBeUndefined();
    expect(freshSpectacle().momentum).toBe(0);
  });
});

describe('Boss Revenge Rematch', () => {
  const always = withSpectacle({ rematch: { chance: 1 } });
  it('a beaten boss is remembered, returns in a later region once, stronger, with a note about the old fight', () => {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'rv', seed: 'rv', archetypeId: 'red' }), 0)));
    const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
    lead.moves = [{ id: 'tackle', pp: 35 }];
    run.party[0] = lead;
    const foe = mon('onix', 5, ['tackle'], 'foe');
    foe.hp = 1;
    run.battle = createBattle('trainer', [foe], 0, lead.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
    recordBossDefeat(content, run, run.battle);
    expect(dueBossRematch(always, run)).toBeNull(); // same region
    run.regionIndex = 1;
    const due = dueBossRematch(always, run);
    expect(due).toMatchObject({ kind: 'gym', id: 'brock', region: 0 });
    expect(due!.leadTypes).toEqual(['electric']);
    expect(dueBossRematch(withSpectacle({ rematch: { chance: 0 } }), run)).toBeNull();
    const base = { classId: 'youngster', name: 'Joey', leaderId: null, members: [{ speciesId: 'rattata', level: 20 }], levelInfo: [], ai: 0 };
    const { plan, note } = bossRematchPlan(always, run, content.archetypes.get('red')!, due!, 4, scaleAt(1, 3, 1), base);
    const old = planGymLeader(content, content.archetypes.get('red')!, 'brock', 4, scaleAt(1, 3, 1), new Rng(hashSeed(`${run.seed}::bossrev::plan::brock::1`)));
    expect(plan.leaderId).toBeNull();
    expect(plan.classId).toBe('youngster');
    expect(plan.name).toContain('Rematch');
    expect(plan.ai).toBeGreaterThanOrEqual(0.85);
    expect(Math.max(...plan.members.map((m) => m.level))).toBeGreaterThan(Math.max(...old.members.map((m) => m.level)) - 1);
    expect(note).toMatch(/Electric/);
  });
});

describe('a counter through the whole run', () => {
  it('takeTurn accepts Brace and Rally actions in a boss fight', () => {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'tt', seed: 'tt', archetypeId: 'red' }), 0)));
    const lead = createPokemon(content, 'blastoise', 60, run.party[0]!.uid);
    lead.moves = [{ id: 'surf', pp: 15 }];
    run.party[0] = lead;
    run.battle = createBattle('trainer', [mon('onix', 40, ['strength', 'tackle'], 'f1'), mon('onix', 40, ['strength'], 'f2')], 0, lead.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
    run.battle.ai = 1;
    const res = takeTurn(content, run, { kind: 'counter' });
    expect(res.events.some((e) => e.type === 'spectacle' && e.kind === 'brace')).toBe(true);
    expect(res.run.battle?.spectacle?.counters).toBe(1);
  });
});
