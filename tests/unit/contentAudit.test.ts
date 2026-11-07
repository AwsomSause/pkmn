// Content audit: every ability, move and Pokémon (forms, Megas, fan Megas, new species)
// has a battle handler and runs in a short battle without breaking.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { ABILITY_FORMS, abilityStatus } from '../../src/core/battle/abilities';
import { abilityOf, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

type Opts = { player?: string; enemy?: string; pAbility?: string; eAbility?: string; pMoves?: string[]; eMove?: string; level?: number; seed?: string };

function duel(o: Opts) {
  const level = o.level ?? 50;
  const player = createPokemon(content, o.player ?? 'machop', level, 'p');
  const enemy = createPokemon(content, o.enemy ?? 'snorlax', level, 'e');
  const move = (m: string) => ({ id: m, pp: content.moves.get(m)!.pp });
  player.moves = (o.pMoves ?? ['tackle']).map(move);
  enemy.moves = [move(o.eMove ?? 'splash')];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  if (o.pAbility) battle.playerVolatile.abilityOverride = o.pAbility;
  if (o.eAbility) battle.enemyVolatile.abilityOverride = o.eAbility;
  const seed = o.seed ?? 'audit';
  const ctx: BattleContext = { content, battle, party: [player], inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}c`)), catchMultiplier: 1 };
  return { ctx, battle, player, enemy, turn: (index = 0) => resolveTurn(ctx, { kind: 'move', index }) };
}

const ok = (n: number) => Number.isFinite(n) && n >= 0;
const BATTLE_DIR = 'src/core/battle';
const battleSource = readdirSync(BATTLE_DIR).map((f) => readFileSync(`${BATTLE_DIR}/${f}`, 'utf8')).join('\n');
const extraSource = ['src/core/pokemon.ts', 'src/core/run.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');

describe('Eelevate (Mega Eelektross)', () => {
  it('is immune to Ground moves, Earthquake included (plain Levitate too)', () => {
    for (const enemy of ['eelektross-mega', 'eelektross']) {
      const d = duel({ player: 'machop', pMoves: ['earthquake'], enemy });
      expect(d.turn().some((e) => e.type === 'damage' && e.side === 'enemy')).toBe(false);
    }
    const d = duel({ player: 'machop', pMoves: ['earthquake'], enemy: 'eelektross-mega' });
    const ev = d.turn();
    expect(ev.some((e) => e.type === 'damage' && e.side === 'enemy')).toBe(false);
  });
  it('takes no Spikes damage when it switches in', () => {
    const d = duel({ player: 'machop', pMoves: ['splash'], enemy: 'snorlax' });
    d.turn(); // the opening turn settles the first entries
    const eel = createPokemon(content, 'eelektross-mega', 50, 'p2');
    eel.moves = [{ id: 'tackle', pp: 35 }];
    d.ctx.party.push(eel);
    d.battle.sideEffects.player.spikes = 3;
    const ev = resolveTurn(d.ctx, { kind: 'switch', partyIndex: 1 });
    expect(d.battle.activeIndex).toBe(1);
    expect(ev.some((e) => e.type === 'hazard' && e.side === 'player')).toBe(false);
  });
  it('Earthquake still hits it under Gravity, and Thousand Arrows always does', () => {
    const g = duel({ player: 'machop', pMoves: ['earthquake'], enemy: 'eelektross-mega' });
    g.battle.field.gravity = 5;
    expect(g.turn().some((e) => e.type === 'damage' && e.side === 'enemy')).toBe(true);
    const t = duel({ player: 'machop', pMoves: ['thousand-arrows'], enemy: 'eelektross-mega' });
    expect(t.turn().some((e) => e.type === 'damage' && e.side === 'enemy')).toBe(true);
  });
  it('raises its highest stat after knocking out a foe', () => {
    const d = duel({ player: 'eelektross-mega', pAbility: 'eelevate', pMoves: ['thunderbolt'], enemy: 'magikarp', level: 100 });
    d.enemy.hp = 1;
    const ev = d.turn();
    expect(ev.some((e) => e.type === 'ability' && e.side === 'player' && e.ability === 'eelevate')).toBe(true);
    // Mega Eelektross: Attack 145 is its best stat.
    expect(d.battle.playerStages.atk).toBe(1);
  });
});

describe('every ability a Pokémon can have is handled', () => {
  const used = new Map<string, string>();
  for (const s of content.species.values()) for (const a of [...s.abilities.normal, s.abilities.hidden]) if (a && !used.has(a)) used.set(a, s.id);

  it('each one exists and is supported or does nothing on purpose', () => {
    const bad = [...used].filter(([a]) => !content.abilities.has(a) || abilityStatus(a) === 'pending').map(([a, s]) => `${a} (${s})`);
    expect(bad).toEqual([]);
  });

  it('each supported ability is named in battle code outside the supported list', () => {
    const start = battleSource.indexOf('const SUPPORTED = new Set');
    const end = battleSource.indexOf(']);', start);
    const outside = battleSource.slice(0, start) + battleSource.slice(end) + extraSource;
    const missing = [...content.abilities.keys()].filter((a) => abilityStatus(a) === 'supported' && !new RegExp(`['"]${a}['"]|[{,\\s]${a.includes('-') ? `'${a}'` : a}\\s*:`).test(outside));
    expect(missing).toEqual([]);
  });

  it('each Pokémon runs three turns with its own ability without breaking', () => {
    const broken: string[] = [];
    for (const s of content.species.values()) {
      const abilities = [...new Set([...s.abilities.normal, s.abilities.hidden].filter((a): a is string => Boolean(a)))];
      for (const a of abilities.length ? abilities : [null]) {
        try {
          const d = duel({ player: s.id, pAbility: a ?? undefined, enemy: 'snorlax', eAbility: a ?? undefined, pMoves: ['tackle'], eMove: 'tackle', seed: `${s.id}:${a}` });
          for (let t = 0; t < 3 && d.player.hp > 0 && d.enemy.hp > 0; t++) d.turn();
          if (!ok(d.player.hp) || !ok(d.enemy.hp)) broken.push(`${s.id}/${a}: bad HP`);
        } catch (e) {
          broken.push(`${s.id}/${a}: ${(e as Error).message}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('every supported move runs', () => {
  const quiet = new Set<BattleEvent['type']>(['miss', 'fail', 'noEffect', 'protected', 'avoided', 'blocked', 'charge', 'cant']);
  it('each supported move runs a turn; a damaging one does damage or says why not', () => {
    const broken: string[] = [];
    for (const m of content.moves.values()) {
      if (!m.supported) continue;
      try {
        const d = duel({ player: 'mew', pMoves: [m.id], enemy: 'snorlax', seed: m.id });
        const ev = d.turn();
        if (!ok(d.player.hp) || !ok(d.enemy.hp)) broken.push(`${m.id}: bad HP`);
        else if (m.category !== 'status' && !ev.some((e) => (e.type === 'damage' && e.side === 'enemy') || quiet.has(e.type) || e.type === 'substituteHit')) {
          const again = d.turn();
          if (!again.some((e) => (e.type === 'damage' && e.side === 'enemy') || quiet.has(e.type))) broken.push(`${m.id}: no damage and no reason`);
        }
      } catch (e) {
        broken.push(`${m.id}: ${(e as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('every move a Pokémon learns or a Mega gets exists', () => {
    const missing: string[] = [];
    for (const s of content.species.values()) for (const l of s.learnset) if (!content.moves.has(l.move)) missing.push(`${s.id}: ${l.move}`);
    expect(missing).toEqual([]);
  });
});

describe('Mega and battle forms', () => {
  it('a Mega uses its own ability even when the base form had its hidden one', () => {
    const mon = createPokemon(content, 'heatran-mega', 50, 'h');
    mon.abilitySlot = -1;
    expect(abilityOf(content, mon)).toBe(content.species.get('heatran-mega')!.abilities.normal[0]);
  });
  it('every form the engine swaps to by ability is listed as an ability form', () => {
    const engine = readFileSync(`${BATTLE_DIR}/engine.ts`, 'utf8');
    const literals = [...engine.matchAll(/swapForm\(ctx, \w+, '([a-z0-9-]+)'/g)].map((m) => m[1]!);
    const forms = literals.filter((id) => content.species.get(id)?.form);
    expect(forms.filter((id) => !ABILITY_FORMS.has(id))).toEqual([]);
    for (const id of ABILITY_FORMS) expect(content.species.has(id)).toBe(true);
  });
});
