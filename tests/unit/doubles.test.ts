// Double battles (core/battle/doubles.ts): spots and focus, spread moves, aiming and
// redirection, the ally moves and abilities, faints and replacements, determinism.

import { describe, expect, it } from 'vitest';
import { createBattle, type BattleContext, type BattleEvent, type SlotCommand } from '../../src/core/battle/engine';
import { autoCommands, makeDoubles, monAt, needsTarget, resolveDoublesTurn, startDoubles, targetKind } from '../../src/core/battle/doubles';
import { abilityStatus } from '../../src/core/battle/abilities';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

interface MonSpec {
  species?: string;
  level?: number;
  moves?: string[];
  ability?: string;
}

function doubles(p: MonSpec[], e: MonSpec[], seed = 'dbl') {
  const make = (s: MonSpec, uid: string) => {
    const mon = createPokemon(content, s.species ?? 'snorlax', s.level ?? 50, uid);
    mon.moves = (s.moves ?? ['splash']).map((id) => ({ id, pp: content.moves.get(id)!.pp }));
    return mon;
  };
  const party = p.map((s, i) => make(s, `p${i}`));
  const team = e.map((s, i) => make(s, `e${i}`));
  const battle = createBattle('trainer', team, 0, party[0]!.uid, { classId: 'ace-trainer', name: 'Pat', leaderId: null });
  makeDoubles(battle, party);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}c`)), catchMultiplier: 1 };
  // Abilities by override, spot by spot.
  const setAbility = (side: 'player' | 'enemy', i: number, ability: string | undefined) => {
    if (!ability) return;
    if (i === 0) (side === 'player' ? battle.playerVolatile : battle.enemyVolatile).abilityOverride = ability;
    else battle.doubles![side].vol.abilityOverride = ability;
  };
  p.forEach((s, i) => setAbility('player', i, s.ability));
  e.forEach((s, i) => setAbility('enemy', i, s.ability));
  const cmd = (index: number, target?: { side: 'player' | 'enemy'; spot: 0 | 1 }): SlotCommand => ({ action: { kind: 'move', index }, target });
  const turn = (commands: (SlotCommand | null)[]) => resolveDoublesTurn(ctx, { kind: 'double', commands });
  return { ctx, battle, party, team, cmd, turn };
}

/** Damage taken by each uid, following focus events (the way the screen reads them). */
function damageByUid(events: BattleEvent[], start: Record<'player' | 'enemy', string>): Record<string, number> {
  const focus = { ...start };
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.type === 'focus') focus[e.side] = e.uid;
    if (e.type === 'switchIn') focus[e.side] = e.uid;
    if (e.type === 'damage') out[focus[e.side]] = (out[focus[e.side]] ?? 0) + e.amount;
  }
  return out;
}

describe('double battle setup', () => {
  it('puts two Pokémon on each side', () => {
    const d = doubles([{}, {}, {}], [{}, {}, {}]);
    expect(monAt(d.ctx, 'player', 0)!.uid).toBe('p0');
    expect(monAt(d.ctx, 'player', 1)!.uid).toBe('p1');
    expect(monAt(d.ctx, 'enemy', 1)!.uid).toBe('e1');
    expect(d.battle.participants).toEqual(['p0', 'p1']);
  });
  it('knows which moves hit more than one Pokémon', () => {
    expect(targetKind(content.moves.get('earthquake')!)).toBe('others');
    expect(targetKind(content.moves.get('rock-slide')!)).toBe('foes');
    expect(targetKind(content.moves.get('tackle')!)).toBe('single');
    expect(targetKind(content.moves.get('helping-hand')!)).toBe('ally');
    expect(needsTarget(content.moves.get('tackle')!)).toBe(true);
    expect(needsTarget(content.moves.get('earthquake')!)).toBe(false);
  });
  it('the ally abilities are no longer "no effect"', () => {
    for (const a of ['friend-guard', 'telepathy', 'plus', 'minus', 'battery', 'power-spot', 'steely-spirit', 'healer', 'flower-veil', 'aroma-veil', 'receiver', 'power-of-alchemy', 'costar', 'commander', 'hospitality', 'curious-medicine', 'symbiosis', 'dancer']) {
      expect(abilityStatus(a), a).toBe('supported');
    }
  });
  it('starts with every entry ability: Intimidate lowers both foes', () => {
    const d = doubles([{ ability: 'intimidate' }, {}], [{}, {}]);
    startDoubles(d.ctx);
    expect(d.battle.enemyStages.atk).toBe(-1);
    expect(d.battle.doubles!.enemy.stages.atk).toBe(-1);
  });
});

describe('a double battle turn', () => {
  it('a single-target move hits the chosen foe only', () => {
    const d = doubles([{ moves: ['tackle'] }, {}], [{}, {}]);
    const events = d.turn([d.cmd(0, { side: 'enemy', spot: 1 }), d.cmd(0)]);
    const dmg = damageByUid(events, { player: 'p0', enemy: 'e0' });
    expect(dmg.e1).toBeGreaterThan(0);
    expect(dmg.e0 ?? 0).toBe(0);
  });
  it('a spread move hits both foes for 0.75×; Earthquake also hits the partner', () => {
    const single = doubles([{ species: 'garchomp', moves: ['earthquake'] }, { species: 'snorlax' }], [{}, {}], 's1');
    const out = single.turn([single.cmd(0), single.cmd(0)]);
    const dmg = damageByUid(out, { player: 'p0', enemy: 'e0' });
    expect(dmg.e0).toBeGreaterThan(0);
    expect(dmg.e1).toBeGreaterThan(0);
    expect(dmg.p1).toBeGreaterThan(0);
    const rock = doubles([{ species: 'garchomp', moves: ['rock-slide'] }, {}], [{}, {}], 's2');
    const r = damageByUid(rock.turn([rock.cmd(0), rock.cmd(0)]), { player: 'p0', enemy: 'e0' });
    expect(r.p1 ?? 0).toBe(0);
  });
  it('a spread move hitting one foe is not reduced', () => {
    let both = 0;
    let alone = 0;
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const two = doubles([{ species: 'garchomp', moves: ['rock-slide'] }, {}], [{}, {}], seed);
      both += damageByUid(two.turn([two.cmd(0), two.cmd(0)]), { player: 'p0', enemy: 'e0' }).e0 ?? 0;
      const one = doubles([{ species: 'garchomp', moves: ['rock-slide'] }, {}], [{}, {}], seed);
      one.team[1]!.hp = 0;
      one.battle.doubles!.enemy.index = -1;
      alone += damageByUid(one.turn([one.cmd(0), one.cmd(0)]), { player: 'p0', enemy: 'e0' }).e0 ?? 0;
    }
    expect(alone / both).toBeGreaterThan(1.15);
  });
  it('Telepathy dodges the partner’s Earthquake', () => {
    const d = doubles([{ species: 'garchomp', moves: ['earthquake'] }, { ability: 'telepathy' }], [{}, {}]);
    const dmg = damageByUid(d.turn([d.cmd(0), d.cmd(0)]), { player: 'p0', enemy: 'e0' });
    expect(dmg.p1 ?? 0).toBe(0);
  });
  it('Follow Me pulls single-target moves', () => {
    const p = doubles([{ moves: ['tackle'] }, {}], [{ moves: ['follow-me'] }, {}]);
    const dmg = damageByUid(p.turn([p.cmd(0, { side: 'enemy', spot: 1 }), p.cmd(0)]), { player: 'p0', enemy: 'e0' });
    expect(dmg.e0).toBeGreaterThan(0);
    expect(dmg.e1 ?? 0).toBe(0);
  });
  it('Lightning Rod draws Electric moves to its holder', () => {
    const d = doubles([{ species: 'pikachu', moves: ['thunderbolt'] }, {}], [{ ability: 'lightning-rod' }, {}]);
    d.turn([d.cmd(0, { side: 'enemy', spot: 1 }), d.cmd(0)]);
    expect(d.team[1]!.hp).toBe(calcStats(content, d.team[1]!).hp);
    expect(d.battle.enemyStages.spa).toBe(1);
  });
  it('Helping Hand powers up the partner’s move by half', () => {
    const base = doubles([{}, { species: 'machamp', moves: ['tackle'] }], [{}, {}], 'hh');
    const plain = damageByUid(base.turn([base.cmd(0), base.cmd(0, { side: 'enemy', spot: 0 })]), { player: 'p0', enemy: 'e0' }).e0!;
    const help = doubles([{ species: 'jolteon', moves: ['helping-hand'] }, { species: 'machamp', moves: ['tackle'] }], [{}, {}], 'hh');
    const boosted = damageByUid(help.turn([help.cmd(0), help.cmd(0, { side: 'enemy', spot: 0 })]), { player: 'p0', enemy: 'e0' }).e0!;
    expect(boosted / plain).toBeGreaterThan(1.3);
  });
  it('Friend Guard softens hits on the partner', () => {
    const base = doubles([{ species: 'machamp', moves: ['tackle'] }, {}], [{}, {}], 'fg');
    const plain = damageByUid(base.turn([base.cmd(0, { side: 'enemy', spot: 0 }), base.cmd(0)]), { player: 'p0', enemy: 'e0' }).e0!;
    const guarded = doubles([{ species: 'machamp', moves: ['tackle'] }, {}], [{}, { ability: 'friend-guard' }], 'fg');
    const soft = damageByUid(guarded.turn([guarded.cmd(0, { side: 'enemy', spot: 0 }), guarded.cmd(0)]), { player: 'p0', enemy: 'e0' }).e0!;
    expect(soft / plain).toBeLessThan(0.85);
  });
  it('Ally Switch swaps the spots', () => {
    const d = doubles([{ moves: ['ally-switch'] }, {}], [{}, {}]);
    d.turn([d.cmd(0), d.cmd(0)]);
    expect(monAt(d.ctx, 'player', 0)!.uid).toBe('p1');
    expect(monAt(d.ctx, 'player', 1)!.uid).toBe('p0');
  });
  it('Coaching raises the partner’s Attack and Defense', () => {
    const d = doubles([{ moves: ['coaching'] }, {}], [{}, {}]);
    d.turn([d.cmd(0), d.cmd(0)]);
    expect(d.battle.doubles!.player.stages.atk).toBe(1);
    expect(d.battle.doubles!.player.stages.def).toBe(1);
  });
  it('Sweet Veil protects the partner from sleep', () => {
    const d = doubles([{ moves: ['spore'], species: 'breloom' }, {}], [{}, { ability: 'sweet-veil' }]);
    d.turn([d.cmd(0, { side: 'enemy', spot: 0 }), d.cmd(0)]);
    expect(d.team[0]!.status).toBeNull();
  });
});

describe('faints and replacements', () => {
  it('the trainer refills a fainted spot from its bench', () => {
    const d = doubles([{ species: 'garchomp', level: 100, moves: ['earthquake'] }, { species: 'snorlax', level: 100 }], [{ species: 'pichu', level: 5 }, { species: 'pichu', level: 5 }, { species: 'pichu', level: 5 }]);
    d.turn([d.cmd(0), d.cmd(0)]);
    const onField = [monAt(d.ctx, 'enemy', 0), monAt(d.ctx, 'enemy', 1)].map((m) => m?.uid ?? null);
    expect(onField).toContain('e2');
    expect(d.battle.outcome).toBeNull();
  });
  it('a player spot that faints is refilled by choice, then the battle goes on', () => {
    const d = doubles([{ species: 'pichu', level: 5 }, { species: 'snorlax' }, { species: 'snorlax' }], [{ species: 'garchomp', level: 100, moves: ['dragon-claw'] }, { species: 'garchomp', level: 100, moves: ['dragon-claw'] }], 'refill');
    d.battle.ai = 1;
    let guard = 0;
    while (!d.battle.needsSwitch && !d.battle.outcome && guard++ < 10) d.turn(autoCommands(d.ctx));
    expect(d.battle.needsSwitch).toBe(true);
    const free = d.party.findIndex((m, i) => m.hp > 0 && ![0, 1].some((s) => monAt(d.ctx, 'player', s as 0 | 1)?.uid === d.party[i]!.uid));
    resolveDoublesTurn(d.ctx, { kind: 'switch', partyIndex: free });
    expect(d.battle.needsSwitch).toBe(false);
    expect([monAt(d.ctx, 'player', 0)?.uid, monAt(d.ctx, 'player', 1)?.uid]).toContain(d.party[free]!.uid);
  });
  it('wins when every foe is down', () => {
    const d = doubles([{ species: 'garchomp', level: 100, moves: ['earthquake'] }, { species: 'garchomp', level: 100, moves: ['earthquake'] }], [{ species: 'pichu', level: 5 }, { species: 'pichu', level: 5 }]);
    d.turn([d.cmd(0), d.cmd(0)]);
    expect(d.battle.outcome).toBe('win');
  });
  it('rejects a command for a Pokémon already in battle', () => {
    const d = doubles([{}, {}, {}], [{}, {}]);
    expect(() => d.turn([{ action: { kind: 'switch', partyIndex: 1 } }, d.cmd(0)])).toThrow();
  });
});

describe('determinism', () => {
  it('same seed and commands give the same events', () => {
    const run = () => {
      const d = doubles([{ species: 'garchomp', moves: ['rock-slide', 'earthquake'] }, { species: 'pikachu', moves: ['thunderbolt'] }], [{ species: 'machamp', moves: ['cross-chop'] }, { species: 'gengar', moves: ['shadow-ball'] }], 'det');
      d.battle.ai = 0.5;
      const out: BattleEvent[] = [];
      for (let i = 0; i < 4 && !d.battle.outcome && !d.battle.needsSwitch; i++) out.push(...d.turn(autoCommands(d.ctx)));
      return JSON.stringify(out);
    };
    expect(run()).toBe(run());
  });
});
