// Totem Pokémon (Blueprint section 3): aura, ally calls, phases, environment, rewards, validation sims.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, startBattle, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, enterTotem, takeTurn, totemPreview, visitSide } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { TotemFileSchema } from '../../src/core/totem/schema';
import { applyTotemHp, freshTotemBattle, getTotem, pickTotemFor } from '../../src/core/totem/totem';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import totemsJson from '../../src/data/totems.json';
import { content } from './helpers';

function fight(totemId: string, playerSpecies = 'garchomp', playerLevel = 70) {
  const def = getTotem(content, totemId);
  const player = createPokemon(content, playerSpecies, playerLevel, 'p1');
  const boss = createPokemon(content, def.species[0]!, 50, 'e1');
  applyTotemHp(def, boss);
  boss.hp = maxHp(content, boss);
  const battle = createBattle('wild', [boss], 0, player.uid);
  battle.totem = freshTotemBattle(def, boss.uid);
  const party: PokemonInstance[] = [player];
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(totemId)), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  return { def, player, boss, battle, ctx };
}
const use = (ctx: BattleContext) => resolveTurn(ctx, { kind: 'move', index: 0 });

function mapRun(seed: string, totemId = 'totem-gumshoos'): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'tt', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = node.sides.filter((s) => s.kind !== 'totem' && s.kind !== 'raid');
  node.sides.push({ id: 'totem-test', kind: 'totem', totemId, used: false });
  run.stage!.current = node.id;
  return run;
}

describe('totem data', () => {
  it('validates, covers every tier, and keeps early Totems simple', () => {
    expect(TotemFileSchema.safeParse(totemsJson).success).toBe(true);
    expect(new Set(content.totems.totems.map((t) => t.tier))).toEqual(new Set(['early', 'mid', 'late', 'grand']));
    for (const t of content.totems.totems.filter((x) => x.tier === 'early')) {
      expect(t.phases).toHaveLength(0);
      expect(t.ally?.maxCalls ?? 1).toBe(1);
    }
    // Every Totem has a mechanic beyond inflated HP.
    for (const t of content.totems.totems) expect(Boolean(t.aura.boost || t.aura.weather || t.aura.terrain || t.aura.hazard)).toBe(true);
  });

  it('a Totem lives in a stage whose theme matches its type, when one exists', () => {
    const run = { seed: 's', regionIndex: 1 };
    expect(pickTotemFor(content, run, ['water', 'bug'], 'k').type).toBe('water');
    expect(pickTotemFor(content, run, ['normal', 'normal'], 'k').tier).toBe('mid');
  });

  it('places at most one Totem per stage, before the gym, deterministically', () => {
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const run = chooseStarter(content, createRun(content, { runId: 'pl', seed: `tt-${i}`, archetypeId: 'red' }), 0);
      const sides = run.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.kind === 'totem').map(() => n));
      expect(sides.length).toBeLessThanOrEqual(1);
      for (const n of sides) expect(n.column).toBeLessThan(run.stage!.map.columns);
      seen += sides.length;
    }
    expect(seen).toBeGreaterThan(3);
  });
});

describe('totem mechanics', () => {
  it('the aura applies once at the start: stage boosts, weather, terrain, hazards', () => {
    const { battle, ctx } = fight('totem-lycanroc');
    const events = startBattle(ctx);
    expect(events.some((e) => e.type === 'raid' && e.text.includes('Sharp stones'))).toBe(true);
    expect(battle.enemyStages.spe).toBe(1);
    expect(battle.weather?.id).toBe('sand');
    expect(battle.sideEffects.player.stealthRock).toBe(true);
    startBattle(ctx);
    expect(battle.enemyStages.spe).toBe(1);
    const grass = fight('totem-lurantis');
    startBattle(grass.ctx);
    expect(grass.battle.terrain?.id).toBe('grassy');
  });

  it('calls its ally at the HP line; the ally takes the field; defeating it brings the Totem back', () => {
    const { battle, ctx, boss, player } = fight('totem-lurantis');
    player.moves = [{ id: 'growl', pp: 40 }];
    boss.moves = [{ id: 'splash', pp: 40 }];
    use(ctx);
    expect(battle.totem!.callsUsed).toBe(0);
    boss.hp = Math.floor(maxHp(content, boss) * 0.4);
    const events = use(ctx);
    expect(events.some((e) => e.type === 'raid' && e.text.includes('Ribombee'))).toBe(true);
    expect(battle.totem!.callsUsed).toBe(1);
    expect(battle.enemyTeam[battle.enemyIndex]!.speciesId).toBe('ribombee');
    expect(boss.hp).toBeGreaterThan(Math.floor(maxHp(content, boss) * 0.4)); // the ally healed it
    // Defeat the ally: the Totem is back and fights on.
    const ally = battle.enemyTeam[battle.enemyIndex]!;
    ally.hp = 1;
    player.moves = [{ id: 'tackle', pp: 35 }];
    for (let i = 0; i < 4 && ally.hp > 0; i++) use(ctx);
    expect(ally.hp).toBe(0);
    expect(battle.outcome).toBeNull();
    expect(battle.enemyTeam[battle.enemyIndex]!.uid).toBe(boss.uid);
  });

  it('never calls more allies than its cap, and never again without resummon', () => {
    const lurantis = fight('totem-lurantis');
    lurantis.boss.moves = [{ id: 'splash', pp: 40 }];
    lurantis.player.moves = [{ id: 'growl', pp: 40 }];
    lurantis.boss.hp = Math.floor(maxHp(content, lurantis.boss) * 0.3);
    for (let i = 0; i < 12; i++) {
      use(lurantis.ctx);
      const out = lurantis.battle.enemyTeam[lurantis.battle.enemyIndex]!;
      if (out.uid !== lurantis.boss.uid) out.hp = 0; // the ally falls at once
      if (lurantis.battle.outcome) break;
    }
    expect(lurantis.battle.totem!.callsUsed).toBe(1);

    const salazzle = fight('totem-salazzle');
    salazzle.boss.moves = [{ id: 'splash', pp: 40 }];
    salazzle.player.moves = [{ id: 'growl', pp: 40 }];
    salazzle.boss.hp = Math.floor(maxHp(content, salazzle.boss) * 0.3);
    for (let i = 0; i < 20; i++) {
      use(salazzle.ctx);
      const out = salazzle.battle.enemyTeam[salazzle.battle.enemyIndex]!;
      if (out.uid !== salazzle.boss.uid) out.hp = 0;
      if (salazzle.battle.outcome) break;
    }
    expect(salazzle.battle.totem!.callsUsed).toBe(2);
    expect(salazzle.battle.enemyTeam.length).toBeLessThanOrEqual(3);
  });

  it('phases start once at their HP line', () => {
    const { battle, ctx, boss, player } = fight('totem-araquanid');
    boss.moves = [{ id: 'splash', pp: 40 }];
    player.moves = [{ id: 'growl', pp: 40 }];
    boss.hp = Math.floor(maxHp(content, boss) * 0.4);
    const first = use(ctx);
    expect(first.filter((e) => e.type === 'raid' && e.tone === 'phase' && e.text.includes('torrent'))).toHaveLength(1);
    expect(battle.totem!.phasesDone).toEqual([0]);
    expect(use(ctx).some((e) => e.type === 'raid' && e.text.includes('torrent'))).toBe(false);
  });

  it('a Totem cannot be caught mid-fight', () => {
    const { ctx } = fight('totem-gumshoos');
    ctx.inventory['poke-ball'] = 2;
    expect(() => resolveTurn(ctx, { kind: 'item', itemId: 'poke-ball' })).toThrow();
  });

  it('validation sim: every Totem plays out for 60 turns at several levels, within its call cap and without errors', () => {
    for (const t of content.totems.totems) {
      for (const level of [20, 50, 90]) {
        const f = fight(t.id, 'blissey', level);
        const hits = f.player.moves.length;
        expect(hits).toBeGreaterThan(0);
        f.boss.hp = Math.floor(maxHp(content, f.boss) * 0.5);
        startBattle(f.ctx);
        for (let turn = 0; turn < 60 && !f.battle.outcome; turn++) {
          if (f.battle.needsSwitch) break;
          f.player.hp = maxHp(content, f.player);
          for (const m of f.player.moves) m.pp = 20;
          use(f.ctx);
        }
        expect(f.battle.totem!.callsUsed, `${t.id} lv${level}`).toBeLessThanOrEqual(t.ally?.maxCalls ?? 0);
      }
    }
  });
});

describe('totem runs', () => {
  it('previews, starts once, uses the territory up, and survives a reload', () => {
    const run = mapRun('tt-1');
    const pv = totemPreview(content, run, 'totem-test');
    expect(pv.name).toBe('Totem Gumshoos');
    expect(() => visitSide(content, run, 'totem-test')).toThrow();
    const inFight = enterTotem(content, run, 'totem-test');
    expect(inFight.phase).toBe('battle');
    expect(inFight.battle!.totem!.id).toBe('totem-gumshoos');
    expect(inFight.totems.entered).toBe(1);
    expect(() => enterTotem(content, { ...inFight, phase: 'map', battle: null }, 'totem-test')).toThrow();
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    saves.saveRun(inFight);
    const loaded = saves.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.data.battle!.totem!.id).toBe('totem-gumshoos');
  });

  it('winning pays once; losing heals the party and the run goes on', () => {
    const run = enterTotem(content, mapRun('tt-2', 'totem-lycanroc'), 'totem-test');
    const lost = structuredClone(run);
    lost.party[0]!.hp = 1;
    lost.party[0]!.moves = [{ id: 'growl', pp: 40 }];
    lost.battle!.enemyTeam[0]!.moves = [{ id: 'tackle', pp: 35 }];
    let r = takeTurn(content, lost, { kind: 'move', index: 0 });
    for (let i = 0; i < 5 && !r.raidFailed && !r.defeated; i++) r = takeTurn(content, r.run, { kind: 'move', index: 0 });
    expect(r.defeated).toBe(false);
    expect(r.raidFailed).toBe(true);
    expect(r.run.phase).toBe('map');
    expect(r.run.totems.lost).toBe(1);
    expect(r.run.party.every((m) => m.hp > 0)).toBe(true);

    const won = structuredClone(run);
    won.battle!.enemyTeam[0]!.hp = 1;
    won.battle!.totem!.callsUsed = 2; // no more ally calls
    won.party[0]!.level = 80;
    won.party[0]!.hp = 999;
    won.party[0]!.moves = [{ id: 'tackle', pp: 35 }];
    const before = won.money;
    const res = takeTurn(content, won, { kind: 'move', index: 0 });
    expect(res.end?.outcome).toBe('win');
    expect(res.run.totems.won).toBe(1);
    expect(res.run.totems.unlocks).toEqual(['route-stone-quarry']);
    expect(res.run.totems.research).toBe(3);
    expect(res.run.money).toBeGreaterThan(before);
    expect(res.run.battle).toBeNull();
  });

  it('a version 13 run loads with an empty Totem record', () => {
    const storage = new MemoryStorageProvider();
    const { totems: _t, ...old } = mapRun('tt-3');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 13, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.data.totems).toEqual({ entered: 0, won: 0, lost: 0, done: [], unlocks: [], research: 0 });
  });
});
