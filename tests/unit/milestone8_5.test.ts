// Milestone 8.5, slice 1: Mega Evolution and Primal Reversion. The Mega Stone
// data, the battle rules (key item, once per battle, one per Pokémon, boss
// aces, the challenge switch), changing back after battle, save/load and the
// reward draft and shop.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent, type PlayerAction } from '../../src/core/battle/engine';
import {
  battleTypes,
  bossMechanics,
  canDynamax,
  gmaxFormFor,
  maxMoveFor,
  permanentForm,
  revertTransformations,
  stabMultiplier,
  stoneForms,
  teraOption,
  teraPower,
  zMoveFor,
  zMoveOptions,
} from '../../src/core/battle/transform';
import { applyItemToPokemon, itemUseProblem, teraTypeOf } from '../../src/core/items';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { isRewardEligible } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { buyItem, chooseStarter, createRun, debugReplaceEnemy, shopStock, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

// Mega Evolution happens by itself (PokeRogue style), so a plain move is enough.
const MEGA: PlayerAction = { kind: 'move', index: 0 };

function setMoves(mon: PokemonInstance, ...ids: string[]) {
  mon.moves = ids.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
}

function setup(party: PokemonInstance[], enemies: PokemonInstance[], inventory: Record<string, number>, seed = 'mega') {
  const battle = createBattle(enemies.length > 1 ? 'trainer' : 'wild', enemies, 0, party[0]!.uid, enemies.length > 1 ? { classId: 'gym-leader', name: 'Test', leaderId: null } : null);
  const ctx: BattleContext = { content, battle, party, inventory, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { battle, ctx };
}

const mon = (species: string, level: number, uid: string, ...moves: string[]) => {
  const m = createPokemon(content, species, level, uid);
  if (moves.length) setMoves(m, ...moves);
  return m;
};
const transforms = (events: BattleEvent[]) => events.filter((e) => e.type === 'transform');

describe('Mega Stone data', () => {
  const stones = [...content.items.values()].filter((i) => i.effect.kind === 'megaStone');

  it('gives every reachable Mega form a stone and both Primal forms an orb', () => {
    const covered = new Set(stones.flatMap((i) => (i.effect.kind === 'megaStone' ? Object.values(i.effect.forms) : [])));
    const missing = [...content.species.values()].filter((s) => s.form?.kind === 'mega' && !covered.has(s.id)).map((s) => s.id);
    // These three have no base form in the game (Magearna's Original Color, Tatsugiri's Droopy and Stretchy forms).
    expect(missing.sort()).toEqual(['magearna-original-mega', 'tatsugiri-droopy-mega', 'tatsugiri-stretchy-mega']);
    expect(covered.has('groudon-primal') && covered.has('kyogre-primal')).toBe(true);
  });

  it('has a draft reward for every stone, and Charizard gets both X and Y', () => {
    for (const s of stones) expect(content.rewards.get(s.id)?.effect).toEqual({ kind: 'addItem', item: s.id, quantity: 1 });
    expect(stoneForms(content, 'charizard', false).map((o) => o.formId)).toEqual(['charizard-mega-x', 'charizard-mega-y']);
    expect(stoneForms(content, 'venusaur-delta', false)).toEqual([{ formId: 'venusaur-delta-mega', itemId: 'delta-venusaurite' }]);
  });
});

describe('Mega Evolution in battle (PokeRogue style)', () => {
  it('needs the Mega Ring and the stone', () => {
    const p = mon('venusaur', 50, 'p1', 'tackle');
    const e = mon('rattata', 5, 'e1', 'tackle');
    for (const inventory of [{}, { 'mega-ring': 1 }, { venusaurite: 1 }] as Record<string, number>[]) {
      const { ctx } = setup([structuredClone(p)], [structuredClone(e)], inventory);
      expect(permanentForm(content, inventory, p)).toBeNull();
      expect(transforms(resolveTurn(ctx, MEGA))).toEqual([]);
    }
  });

  it('happens by itself before anyone moves, so the new Speed counts', () => {
    // Beedrill (Speed 75) is slower than Garchomp (102); Mega Beedrill (145) is faster.
    const runTurn = (stone: boolean) => {
      const p = mon('beedrill', 50, 'p1', 'tackle');
      const e = mon('garchomp', 50, 'e1', 'tackle');
      const { ctx } = setup([p], [e], stone ? { 'mega-ring': 1, beedrillite: 1 } : { 'mega-ring': 1 });
      const events = resolveTurn(ctx, MEGA);
      return { p, events, first: events.find((x) => x.type === 'move')!.side };
    };
    expect(runTurn(false).first).toBe('enemy');
    const { p, events, first } = runTurn(true);
    expect(first).toBe('player');
    expect(transforms(events)).toEqual([{ type: 'transform', side: 'player', uid: 'p1', kind: 'mega', from: 'beedrill', to: 'beedrill-mega', itemId: 'beedrillite' }]);
    expect(p.speciesId).toBe('beedrill-mega');
    expect(events[0]!.type).toBe('transform');
  });

  it('every Pokémon with its stone Mega Evolves in every battle, with no limit, and stays Mega through switching', () => {
    const a = mon('venusaur', 50, 'p1', 'tackle');
    const b = mon('charizard', 50, 'p2', 'tackle');
    const e = mon('snorlax', 60, 'e1', 'growl');
    const { battle, ctx } = setup([a, b], [e], { 'mega-ring': 1, venusaurite: 1, 'charizardite-y': 1 });
    resolveTurn(ctx, MEGA);
    expect(a.speciesId).toBe('venusaur-mega');
    expect(transforms(resolveTurn(ctx, MEGA))).toEqual([]);
    // The Pokémon that comes in Mega Evolves before the turn's moves.
    const events = transforms(resolveTurn(ctx, { kind: 'switch', partyIndex: 1 }));
    expect(events.map((x) => x.type === 'transform' && x.to)).toEqual(['charizard-mega-y']);
    resolveTurn(ctx, { kind: 'switch', partyIndex: 0 });
    expect(a.speciesId).toBe('venusaur-mega');
    expect(battle.transform.used.player).toEqual([]);
  });

  it('Charizard takes Mega X when you own Charizardite X, otherwise Y', () => {
    const both = permanentForm(content, { 'mega-ring': 1, 'charizardite-x': 1, 'charizardite-y': 1 }, mon('charizard', 50, 'p1'));
    expect(both?.option.formId).toBe('charizard-mega-x');
    expect(permanentForm(content, { 'mega-ring': 1, 'charizardite-y': 1 }, mon('charizard', 50, 'p1'))?.option.formId).toBe('charizard-mega-y');
  });

  it('a Mega Evolved Pokémon can still Terastallize or use a Z-Move, but not Dynamax', () => {
    const inventory = { 'mega-ring': 1, venusaurite: 1, 'tera-orb': 1, 'dynamax-band': 1 };
    const tera = setup([mon('venusaur', 50, 'p1', 'tackle')], [mon('snorlax', 90, 'e1', 'growl')], inventory);
    resolveTurn(tera.ctx, { kind: 'move', index: 0, transform: { kind: 'tera' } });
    expect(tera.battle.transform.teraTypes.p1).toBe('grass');
    const max = setup([mon('venusaur', 50, 'p1', 'tackle')], [mon('snorlax', 90, 'e1', 'growl')], inventory);
    resolveTurn(max.ctx, MEGA);
    expect(() => resolveTurn(max.ctx, { kind: 'move', index: 0, transform: { kind: 'dynamax' } })).toThrow(/Mega Evolved Pokémon can't Dynamax/);
  });

  it('changes back after the battle, keeping HP within the original maximum', () => {
    const p = mon('venusaur', 50, 'p1', 'tackle');
    const e = mon('snorlax', 60, 'e1', 'splash');
    const { battle } = setup([p], [e], {});
    battle.transform.forms[p.uid] = { kind: 'mega', from: 'venusaur' };
    p.speciesId = 'venusaur-mega';
    p.hp = calcStats(content, p).hp;
    revertTransformations(content, battle, [p]);
    expect(p.speciesId).toBe('venusaur');
    expect(p.hp).toBeLessThanOrEqual(calcStats(content, p).hp);
    expect(battle.transform.forms).toEqual({});
  });

  it('can be switched off for a run (a challenge), for both sides', () => {
    const p = mon('venusaur', 50, 'p1', 'tackle');
    const ace = mon('gyarados', 50, 'e2', 'splash');
    const { battle, ctx } = setup([p], [mon('rattata', 5, 'e1', 'splash'), ace], { 'mega-ring': 1, venusaurite: 1 });
    battle.enemyIndex = 1;
    battle.transform.enemyMechanics = ['mega'];
    ctx.disabledMechanics = ['mega'];
    expect(transforms(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
    expect(p.speciesId).toBe('venusaur');
    expect(bossMechanics(content, 'champion', 1, ['mega'])).toEqual(['tera', 'dynamax']);
    expect(bossMechanics(content, 'champion', 1, ['mega', 'tera'])).toEqual(['dynamax']);
  });
});

describe('Mega Evolution for opponents', () => {
  it('a boss Mega Evolves only its ace, once', () => {
    const p = mon('snorlax', 60, 'p1', 'splash');
    const lead = mon('gyarados', 30, 'e1', 'splash');
    const ace = mon('garchomp', 30, 'e2', 'splash');
    const { battle, ctx } = setup([p], [lead, ace], {});
    battle.transform.enemyMechanics = ['mega'];
    expect(transforms(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
    battle.enemyIndex = 1;
    const events = transforms(resolveTurn(ctx, { kind: 'move', index: 0 }));
    expect(events).toEqual([{ type: 'transform', side: 'enemy', uid: 'e2', kind: 'mega', from: 'garchomp', to: 'garchomp-mega', itemId: null }]);
    expect(transforms(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
  });

  it('bosses use it from gym 5 and in the league; other trainers and wild Pokémon never', () => {
    expect(bossMechanics(content, 'gym', 4, [])).toEqual([]);
    expect(bossMechanics(content, 'gym', 5, [])).toEqual(['mega', 'tera']);
    expect(bossMechanics(content, 'elite', 1, [])).toEqual(['mega', 'tera', 'zmove']);
    expect(bossMechanics(content, 'champion', 1, [])).toEqual(['mega', 'tera', 'dynamax']);
    expect(bossMechanics(content, null, 9, [])).toEqual([]);
    const { ctx } = setup([mon('snorlax', 60, 'p1', 'splash')], [mon('garchomp', 30, 'e1', 'splash')], {});
    expect(transforms(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
  });
});

describe('Primal Reversion', () => {
  it('happens by itself with the orb, needs no Mega Ring and leaves the Mega free', () => {
    const k = mon('kyogre', 70, 'p1', 'tackle');
    const { battle, ctx } = setup([k], [mon('snorlax', 60, 'e1', 'splash')], { 'blue-orb': 1 });
    const events = transforms(resolveTurn(ctx, { kind: 'move', index: 0 }));
    expect(events.map((e) => e.type === 'transform' && [e.kind, e.to])).toEqual([['primal', 'kyogre-primal']]);
    expect(battle.transform.used.player).toEqual([]);
  });
});

describe('Mega Evolution in a run', () => {
  const newRun = (seed: string): RunState => {
    let run = chooseStarter(content, createRun(content, { runId: `r-${seed}`, seed, archetypeId: 'red' }), 0);
    run = toBattle(run);
    run = debugReplaceEnemy(content, run, 'magikarp', 2);
    run.party[0] = { ...createPokemon(content, 'venusaur', 50, run.party[0]!.uid), friendship: run.party[0]!.friendship };
    setMoves(run.party[0]!, 'tackle');
    run.inventory['mega-ring'] = 1;
    run.inventory.venusaurite = 1;
    return run;
  };

  it('survives save and load in the middle of a battle, then changes back when it ends', () => {
    let run = newRun('mega-save');
    run.battle!.enemyTeam[0]!.hp = 500; // stays up for a turn
    run.battle!.enemyTeam[0]!.level = 100;
    let result = takeTurn(content, run, MEGA);
    run = result.run;
    expect(run.phase).toBe('battle');
    expect(run.party[0]!.speciesId).toBe('venusaur-mega');

    const saves = new SaveManager(new MemoryStorageProvider(), content);
    expect(saves.saveRun(run)).toEqual({ ok: true });
    const loaded = saves.loadRun();
    expect(loaded).toEqual({ status: 'ok', data: run });
    run = (loaded as { data: RunState }).data;

    run.battle!.enemyTeam[0]!.hp = 1;
    result = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(result.end?.outcome).toBe('win');
    expect(result.run.party[0]!.speciesId).toBe('venusaur');
  });

  it('is deterministic: the same run and actions give the same events', () => {
    const a = takeTurn(content, newRun('mega-det'), MEGA);
    const b = takeTurn(content, newRun('mega-det'), MEGA);
    expect(a.events).toEqual(b.events);
  });
});

describe('Mega Ring and stones as rewards and in the shop', () => {
  const run = (): RunState => chooseStarter(content, createRun(content, { runId: 'r-shop', seed: 'shop', archetypeId: 'red' }), 0);

  it('offers the Mega Ring until you have it, and a stone only when a party member can use it', () => {
    const r = run();
    const ring = content.rewards.get('mega-ring')!;
    const stone = content.rewards.get('venusaurite')!;
    expect(isRewardEligible(content, r, ring)).toBe(true);
    expect(isRewardEligible(content, r, stone)).toBe(false);
    r.party.push(createPokemon(content, 'venusaur', 40, 'p9'));
    expect(isRewardEligible(content, r, stone)).toBe(true);
    r.inventory['mega-ring'] = 1;
    r.inventory.venusaurite = 1;
    expect(isRewardEligible(content, r, ring)).toBe(false);
    expect(isRewardEligible(content, r, stone)).toBe(false);
  });

  it('sells the Mega Ring from 3 badges, only once', () => {
    const r = run();
    expect(shopStock(content, r).some((e) => e.item === 'mega-ring')).toBe(false);
    r.badges = ['a', 'b', 'c'];
    r.money = 50000;
    r.phase = 'shop';
    expect(shopStock(content, r).some((e) => e.item === 'mega-ring')).toBe(true);
    const bought = buyItem(content, r, 'mega-ring').run;
    expect(bought.inventory['mega-ring']).toBe(1);
    expect(shopStock(content, bought).some((e) => e.item === 'mega-ring')).toBe(false);
    expect(() => buyItem(content, bought, 'mega-ring')).toThrow(/already have/);
  });
});

// ---------- Slice 2: Terastallization ----------

const TERA: PlayerAction = { kind: 'move', index: 0, transform: { kind: 'tera' } };

describe('Terastallization', () => {
  it('needs the Tera Orb, and turns the Pokémon into its Tera Type until the battle ends', () => {
    const p = mon('venusaur', 50, 'p1', 'tackle');
    p.teraType = 'water';
    const e = mon('charizard', 50, 'e1', 'ember');
    const none = setup([structuredClone(p)], [structuredClone(e)], {});
    expect(teraOption(none.ctx)).toBeNull();
    expect(() => resolveTurn(none.ctx, TERA)).toThrow(/Tera Orb/);

    const { battle, ctx } = setup([p], [e], { 'tera-orb': 1 });
    expect(teraOption(ctx)).toBe('water');
    const events = resolveTurn(ctx, TERA);
    expect(transforms(events)).toEqual([{ type: 'transform', side: 'player', uid: 'p1', kind: 'tera', from: 'venusaur', to: 'venusaur', itemId: null, teraType: 'water' }]);
    expect(battleTypes(content, battle, p)).toEqual(['water']);
    // Ember is now not very effective on the Water-type Venusaur.
    const ember = events.find((x) => x.type === 'damage' && x.side === 'player');
    if (ember?.type === 'damage') expect(ember.effectiveness).toBe(0.5);
    expect(() => resolveTurn(ctx, TERA)).toThrow(/already/);
    revertTransformations(content, battle, [p]);
    expect(battleTypes(content, battle, p)).toEqual(['grass', 'poison']);
  });

  it('keeps its old STAB, gives STAB to the Tera Type (2× when it was already its type), and lifts weak Tera-type moves to 60', () => {
    const p = mon('charizard', 50, 'p1', 'ember');
    const { battle } = setup([p], [mon('snorlax', 50, 'e1', 'splash')], {});
    expect(stabMultiplier(content, battle, p, 'fire')).toBe(1.5);
    expect(stabMultiplier(content, battle, p, 'water')).toBe(1);
    battle.transform.teraTypes[p.uid] = 'water';
    expect(stabMultiplier(content, battle, p, 'water')).toBe(1.5);
    expect(stabMultiplier(content, battle, p, 'fire')).toBe(1.5);
    battle.transform.teraTypes[p.uid] = 'fire';
    expect(stabMultiplier(content, battle, p, 'fire')).toBe(2);
    expect(teraPower(battle, p, content.moves.get('ember')!, 40)).toBe(60);
    expect(teraPower(battle, p, content.moves.get('tackle')!, 40)).toBe(40);
  });

  it('works on a Mega Evolved Pokémon; then that Pokémon can use no Z-Move or Dynamax this battle', () => {
    const a = mon('charizard', 50, 'p1', 'flamethrower');
    const { battle, ctx } = setup([a], [mon('snorlax', 90, 'e1', 'growl')], { 'mega-ring': 1, 'charizardite-y': 1, 'tera-orb': 1, 'z-ring': 1, 'firium-z': 1 });
    resolveTurn(ctx, TERA);
    expect(a.speciesId).toBe('charizard-mega-y');
    expect(battleTypes(content, battle, a)).toEqual(['fire']);
    expect(zMoveOptions(ctx)).toEqual([null]);
    expect(() => resolveTurn(ctx, { kind: 'move', index: 0, transform: { kind: 'zmove' } })).toThrow(/already transformed/);
  });

  it('a boss ace with no Mega form Terastallizes into the boss speciality', () => {
    const p = mon('snorlax', 60, 'p1', 'splash');
    const ace = mon('rattata', 30, 'e2', 'splash');
    const { battle, ctx } = setup([p], [mon('pidgey', 5, 'e1', 'splash'), ace], {});
    battle.trainer = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
    battle.transform.enemyMechanics = ['mega', 'tera'];
    battle.enemyIndex = 1;
    const events = transforms(resolveTurn(ctx, { kind: 'move', index: 0 }));
    expect(events.map((e) => e.type === 'transform' && [e.side, e.kind, e.teraType])).toEqual([['enemy', 'tera', 'rock']]);
  });

  it('Tera Shards set the Tera Type, and are only offered once you have the Tera Orb', () => {
    const r = chooseStarter(content, createRun(content, { runId: 'r-tera', seed: 'tera', archetypeId: 'red' }), 0);
    const shard = content.items.get('fire-tera-shard')!;
    const starter = r.party[0]!;
    if (teraTypeOf(content, starter) === 'fire') starter.teraType = 'water';
    expect(applyItemToPokemon(content, shard, starter)).toMatch(/Fire/);
    expect(teraTypeOf(content, starter)).toBe('fire');
    expect(itemUseProblem(content, shard, starter)).toMatch(/already/);
    expect(isRewardEligible(content, r, content.rewards.get('fire-tera-shard')!)).toBe(false);
    r.inventory['tera-orb'] = 1;
    expect(isRewardEligible(content, r, content.rewards.get('fire-tera-shard')!)).toBe(true);
  });

  it('survives save and load in the middle of a battle', () => {
    let run = chooseStarter(content, createRun(content, { runId: 'r-tera-save', seed: 'tera-save', archetypeId: 'red' }), 0);
    run = debugReplaceEnemy(content, toBattle(run), 'magikarp', 100);
    setMoves(run.battle!.enemyTeam[0]!, 'splash');
    run.inventory['tera-orb'] = 1;
    run = takeTurn(content, run, TERA).run;
    expect(Object.keys(run.battle!.transform.teraTypes)).toEqual([run.party[0]!.uid]);
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    saves.saveRun(run);
    expect(saves.loadRun()).toEqual({ status: 'ok', data: run });
  });
});

// ---------- Slice 3: Z-Moves ----------

const Z: PlayerAction = { kind: 'move', index: 0, transform: { kind: 'zmove' } };
const Z_KIT = { 'z-ring': 1, 'electrium-z': 1, 'normalium-z': 1, 'firium-z': 1 };
const damageTo = (events: BattleEvent[], side: 'player' | 'enemy') =>
  events.filter((e) => e.type === 'damage' && e.side === side).reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0);

describe('Z-Move data', () => {
  it('has a Z-Crystal item and draft reward for every type but Stellar, and a Z-Ring', () => {
    const crystals = [...content.items.values()].filter((i) => i.effect.kind === 'zCrystal');
    expect(crystals.map((i) => (i.effect.kind === 'zCrystal' ? i.effect.type : '')).sort()).toEqual(Object.keys(content.zMoves.byType).sort());
    expect(crystals).toHaveLength(18);
    for (const c of crystals) expect(content.rewards.get(c.id)?.effect).toEqual({ kind: 'addItem', item: c.id, quantity: 1 });
    expect(content.items.get('z-ring')?.effect).toEqual({ kind: 'keyItem', mechanic: 'zmove' });
  });

  it("uses Showdown's Z-power: its own number when a move has one, otherwise the power table", () => {
    expect(content.zMoves.power.tackle).toBe(100); // 40 power
    expect(content.zMoves.power.thunderbolt).toBe(175); // 90 power
    expect(content.zMoves.power['bullet-seed']).toBe(140); // its own number
    expect(content.zMoves.status['swords-dance']).toEqual({ effect: 'clearNegative' });
    expect(content.zMoves.status.growl).toEqual({ boosts: [{ stat: 'def', stages: 1 }] });
  });

  it('turns a damaging move into its type Z-Move: never misses, no priority, no side effects', () => {
    const z = zMoveFor(content, content.moves.get('quick-attack')!)!;
    expect(z).toMatchObject({ id: 'breakneck-blitz', name: 'Breakneck Blitz', type: 'normal', category: 'physical', power: 100, accuracy: null, priority: 0, flags: ['zmove'], effects: {} });
    expect(zMoveFor(content, content.moves.get('swords-dance')!)!.id).toBe('swords-dance');
<<<<<<< HEAD
    expect(zMoveFor(content, content.moves.get('max-guard')!)).toBeNull(); // not supported in this game yet
=======
    expect(zMoveFor(content, content.moves.get('core-enforcer')!)).toBeNull(); // not supported in this game yet
>>>>>>> origin/claude/project-thread-h47l6h
    expect(zMoveFor(content, z)).toBeNull();
  });
});

describe('Z-Moves in battle', () => {
  it('need the Z-Ring and the Z-Crystal of the move type', () => {
    for (const inventory of [{}, { 'z-ring': 1 }, { 'electrium-z': 1 }, { 'z-ring': 1, 'firium-z': 1 }] as Record<string, number>[]) {
      const { ctx } = setup([mon('pikachu', 50, 'p1', 'thunderbolt')], [mon('snorlax', 50, 'e1', 'tackle')], inventory);
      expect(zMoveOptions(ctx)).toEqual([null]);
      expect(() => resolveTurn(ctx, Z)).toThrow(/Z-Ring|Electric Z-Crystal/);
    }
  });

  it('hit much harder than the move, under its Z-Move name, and use the move PP', () => {
    const turn = (z: boolean) => {
      const p = mon('pikachu', 50, 'p1', 'thunderbolt', 'quick-attack');
      const { ctx } = setup([p], [mon('snorlax', 70, 'e1', 'tackle')], Z_KIT, 'z-dmg');
      const events = resolveTurn(ctx, z ? Z : { kind: 'move', index: 0 });
      return { p, events };
    };
    const plain = turn(false);
    const { p, events } = turn(true);
    expect(transforms(events)).toEqual([
      { type: 'transform', side: 'player', uid: 'p1', kind: 'zmove', from: 'pikachu', to: 'pikachu', itemId: 'electrium-z', moveId: 'thunderbolt', zMoveId: 'gigavolt-havoc' },
    ]);
    expect(events.find((e) => e.type === 'move' && e.side === 'player')).toEqual({ type: 'move', side: 'player', moveId: 'gigavolt-havoc' });
    expect(damageTo(events, 'enemy')).toBeGreaterThan(damageTo(plain.events, 'enemy') * 1.6);
    expect(p.moves[0]!.pp).toBe(content.moves.get('thunderbolt')!.pp - 1);
  });

  it('never miss, and a Z Quick Attack loses its priority', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const { ctx } = setup([mon('pikachu', 50, 'p1', 'zap-cannon')], [mon('snorlax', 70, 'e1', 'tackle')], Z_KIT, `z-acc-${seed}`);
      expect(resolveTurn(ctx, Z).some((e) => e.type === 'miss')).toBe(false);
    }
    // Snorlax (Speed 30) against a level 5 Pikachu: Quick Attack goes first, Breakneck Blitz doesn't.
    const order = (z: boolean) => {
      const { ctx } = setup([mon('pikachu', 5, 'p1', 'quick-attack')], [mon('snorlax', 90, 'e1', 'tackle')], Z_KIT, 'z-prio');
      return resolveTurn(ctx, z ? Z : { kind: 'move', index: 0 }).find((e) => e.type === 'move')!.side;
    };
    expect(order(false)).toBe('player');
    expect(order(true)).toBe('enemy');
  });

  it('go through Protect for a quarter of the damage', () => {
    const p = mon('pikachu', 50, 'p1', 'thunderbolt');
    const e = mon('snorlax', 70, 'e1', 'protect');
    e.hp = 999;
    const { ctx } = setup([p], [e], Z_KIT, 'z-protect');
    const events = resolveTurn(ctx, Z);
    expect(events.some((x) => x.type === 'protect' && x.side === 'enemy')).toBe(true);
    expect(events.some((x) => x.type === 'protected')).toBe(false);
    expect(damageTo(events, 'enemy')).toBeGreaterThan(0);
  });

  it('a status Z-Move adds its bonus and still works: Z-Swords Dance clears lowered stats first', () => {
    const { ctx, battle } = setup([mon('pikachu', 50, 'p1', 'swords-dance', 'growl')], [mon('snorlax', 50, 'e1', 'tackle')], Z_KIT);
    battle.playerStages.atk = -2;
    battle.playerStages.spe = -1;
    const events = resolveTurn(ctx, Z);
    expect(battle.playerStages.atk).toBe(2);
    expect(battle.playerStages.spe).toBe(0);
    expect(events.find((e) => e.type === 'move' && e.side === 'player')).toMatchObject({ moveId: 'swords-dance' });

    const growl = setup([mon('pikachu', 50, 'p1', 'growl')], [mon('snorlax', 50, 'e1', 'tackle')], Z_KIT);
    resolveTurn(growl.ctx, Z);
    expect(growl.battle.playerStages.def).toBe(1);
  });

  it('a full-heal Z bonus restores the user', () => {
    const c = structuredClone(content);
    c.zMoves.status.growl = { effect: 'heal' };
    const p = mon('pikachu', 50, 'p1', 'growl');
    p.hp = 10;
    const { ctx } = setup([p], [mon('magikarp', 5, 'e1', 'tackle')], Z_KIT);
    const events = resolveTurn({ ...ctx, content: c }, Z);
    expect(events.find((e) => e.type === 'heal')).toMatchObject({ side: 'player', hpAfter: calcStats(content, p).hp });
  });

  it('work once per battle, and not on a Pokémon that already transformed', () => {
    const p = mon('pikachu', 50, 'p1', 'thunderbolt', 'tackle');
    const e = mon('snorlax', 90, 'e1', 'growl');
    const { ctx, battle } = setup([p], [e], Z_KIT);
    resolveTurn(ctx, Z);
    expect(battle.transform.used.player).toEqual(['zmove']);
    expect(zMoveOptions(ctx)).toEqual([null, null]);
    expect(() => resolveTurn(ctx, { kind: 'move', index: 1, transform: { kind: 'zmove' } })).toThrow(/already used a Z-Move/);

    const tera = setup([mon('pikachu', 50, 'p2', 'thunderbolt')], [mon('snorlax', 90, 'e2', 'growl')], { ...Z_KIT, 'tera-orb': 1 });
    resolveTurn(tera.ctx, TERA);
    expect(() => resolveTurn(tera.ctx, Z)).toThrow(/already transformed/);
  });

  it('can be switched off for a run', () => {
    const { ctx } = setup([mon('pikachu', 50, 'p1', 'thunderbolt')], [mon('snorlax', 50, 'e1', 'tackle')], Z_KIT);
    ctx.disabledMechanics = ['zmove'];
    expect(zMoveOptions(ctx)).toEqual([null]);
    expect(() => resolveTurn(ctx, Z)).toThrow(/switched off/);
  });
});

describe('Z-Moves in a run', () => {
  const newRun = (seed: string): RunState => {
    let run = chooseStarter(content, createRun(content, { runId: `r-${seed}`, seed, archetypeId: 'red' }), 0);
    run = debugReplaceEnemy(content, toBattle(run), 'magikarp', 100);
    setMoves(run.battle!.enemyTeam[0]!, 'growl');
    setMoves(run.party[0]!, 'tackle');
    Object.assign(run.inventory, Z_KIT);
    return run;
  };

  it('survives save and load in the middle of a battle, and is spent until the battle ends', () => {
    let run = takeTurn(content, newRun('z-save'), Z).run;
    expect(run.phase).toBe('battle');
    expect(run.battle!.transform.used.player).toEqual(['zmove']);
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    expect(saves.saveRun(run)).toEqual({ ok: true });
    const loaded = saves.loadRun();
    expect(loaded).toEqual({ status: 'ok', data: run });
    run = (loaded as { data: RunState }).data;
    expect(() => takeTurn(content, run, Z)).toThrow(/already used a Z-Move/);
  });

  it('is deterministic', () => {
    expect(takeTurn(content, newRun('z-det'), Z).events).toEqual(takeTurn(content, newRun('z-det'), Z).events);
  });

  it('offers the Z-Ring once, and a crystal only with the ring and a party move of its type; the shop sells the ring from 3 badges', () => {
    const r = chooseStarter(content, createRun(content, { runId: 'r-z', seed: 'z', archetypeId: 'red' }), 0);
    setMoves(r.party[0]!, 'tackle');
    const normal = content.rewards.get('normalium-z')!;
    const fire = content.rewards.get('firium-z')!;
    expect(isRewardEligible(content, r, content.rewards.get('z-ring')!)).toBe(true);
    expect(isRewardEligible(content, r, normal)).toBe(false);
    r.inventory['z-ring'] = 1;
    expect(isRewardEligible(content, r, content.rewards.get('z-ring')!)).toBe(false);
    expect(isRewardEligible(content, r, normal)).toBe(true);
    expect(isRewardEligible(content, r, fire)).toBe(false);
    r.inventory['normalium-z'] = 1;
    expect(isRewardEligible(content, r, normal)).toBe(false);
    expect(itemUseProblem(content, content.items.get('normalium-z')!, r.party[0]!)).toMatch(/by itself in battle/);

    delete r.inventory['z-ring'];
    r.badges = ['a', 'b', 'c'];
    expect(shopStock(content, r).some((e) => e.item === 'z-ring')).toBe(true);
    r.inventory['z-ring'] = 1;
    expect(shopStock(content, r).some((e) => e.item === 'z-ring')).toBe(false);
  });
});

// ---------- Slice 4: Dynamax and Gigantamax ----------

const MAX: PlayerAction = { kind: 'move', index: 0, transform: { kind: 'dynamax' } };
const BAND = { 'dynamax-band': 1 };
const movesUsed = (events: BattleEvent[], side: 'player' | 'enemy') => events.flatMap((e) => (e.type === 'move' && e.side === side ? [e.moveId] : []));

describe('Max Move data', () => {
  it("uses Showdown's Max power: its own number, otherwise the table (lower for Fighting and Poison)", () => {
    expect(content.maxMoves.power.tackle).toBe(90); // 40 power
    expect(content.maxMoves.power.thunderbolt).toBe(130); // 90 power
    expect(content.maxMoves.power['close-combat']).toBe(95); // Fighting, 120 power
    expect(content.maxMoves.effects['max-flare']).toEqual({ weather: 'sun' });
  });

  it('gives every Gigantamax form a G-Max Move', () => {
    const covered = new Set(Object.values(content.maxMoves.gmax).flatMap((g) => g.forms));
    const forms = [...content.species.values()].filter((s) => s.form?.kind === 'gigantamax').map((s) => s.id);
    expect(forms.filter((f) => !covered.has(f))).toEqual([]);
    expect(gmaxFormFor(content, 'charizard')).toBe('charizard-gmax');
    expect(gmaxFormFor(content, 'snorlax')).toBe('snorlax-gmax');
    expect(gmaxFormFor(content, 'pidgey')).toBeNull();
  });

  it('turns moves into Max Moves: never miss, no priority; status moves into Max Guard; G-Max Moves for Gigantamax forms', () => {
    expect(maxMoveFor(content, 'pikachu', content.moves.get('zap-cannon')!)).toMatchObject({ id: 'max-lightning', type: 'electric', category: 'special', power: 140, accuracy: null, priority: 0, flags: ['max'] }); // 120 power
    expect(maxMoveFor(content, 'pidgey', content.moves.get('quick-attack')!)).toMatchObject({ id: 'max-strike', priority: 0, effects: { statChanges: [{ stat: 'spe', stages: -1, target: 'enemy', chance: 100 }] } });
    expect(maxMoveFor(content, 'pidgey', content.moves.get('growl')!)).toMatchObject({ id: 'max-guard', priority: 4, target: 'self', effects: { protect: true } });
    expect(maxMoveFor(content, 'charizard-gmax', content.moves.get('flamethrower')!)).toMatchObject({ id: 'g-max-wildfire', power: 130 });
    expect(maxMoveFor(content, 'charizard-gmax', content.moves.get('tackle')!)!.id).toBe('max-strike');
    expect(maxMoveFor(content, 'cinderace-gmax', content.moves.get('ember')!)).toMatchObject({ id: 'g-max-fireball', power: 160 });
  });
});

describe('Dynamax in battle', () => {
  it('needs the Dynamax Band', () => {
    const { ctx } = setup([mon('pidgey', 30, 'p1', 'tackle')], [mon('snorlax', 50, 'e1', 'tackle')], {});
    expect(canDynamax(ctx)).toBe(false);
    expect(() => resolveTurn(ctx, MAX)).toThrow(/Dynamax Band/);
  });

  it('doubles HP and uses Max Moves for 3 turns, then shrinks back', () => {
    const p = mon('pidgey', 30, 'p1', 'tackle');
    const e = mon('snorlax', 90, 'e1', 'growl');
    const max = calcStats(content, p).hp;
    const { ctx, battle } = setup([p], [e], BAND);
    const first = resolveTurn(ctx, MAX);
    expect(transforms(first)).toEqual([{ type: 'transform', side: 'player', uid: 'p1', kind: 'dynamax', from: 'pidgey', to: 'pidgey', itemId: null }]);
    expect(calcStats(content, p).hp).toBe(max * 2);
    expect(p.hp).toBe(max * 2);
    expect(movesUsed(first, 'player')).toEqual(['max-strike']);
    expect(battle.transform.dynamax.p1).toBe(2);
    expect(movesUsed(resolveTurn(ctx, { kind: 'move', index: 0 }), 'player')).toEqual(['max-strike']);
    const third = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(movesUsed(third, 'player')).toEqual(['max-strike']);
    expect(transforms(third).map((x) => x.type === 'transform' && x.kind)).toEqual(['dynamaxEnd']);
    expect(p.dynamaxed).toBeUndefined();
    expect(p.hp).toBe(max);
    expect(movesUsed(resolveTurn(ctx, { kind: 'move', index: 0 }), 'player')).toEqual(['tackle']);
    expect(() => resolveTurn(ctx, MAX)).toThrow(/already Dynamaxed|already transformed/);
  });

  it('with the Dynamax Band, a Pokémon with a G-Max form takes it in every battle; Dynamaxed, its type moves become its G-Max Move', () => {
    const p = mon('charizard', 50, 'p1', 'flamethrower');
    const { ctx, battle } = setup([p], [mon('snorlax', 90, 'e1', 'growl')], BAND);
    expect(permanentForm(content, BAND, p)).toEqual({ kind: 'gigantamax', option: { formId: 'charizard-gmax', itemId: null } });
    const plain = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(transforms(plain)).toEqual([{ type: 'transform', side: 'player', uid: 'p1', kind: 'gigantamax', from: 'charizard', to: 'charizard-gmax', itemId: null }]);
    expect(movesUsed(plain, 'player')).toEqual(['flamethrower']);
    const events = resolveTurn(ctx, MAX);
    expect(movesUsed(events, 'player')).toEqual(['g-max-wildfire']);
    resolveTurn(ctx, { kind: 'move', index: 0 });
    resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(p.dynamaxed).toBeUndefined();
    expect(p.speciesId).toBe('charizard-gmax');
    revertTransformations(content, battle, [p]);
    expect(p.speciesId).toBe('charizard');
  });

  it('Max Moves add their effects: Max Flare sets the sun, Max Strike lowers Speed, and they never miss', () => {
    const fire = setup([mon('charmander', 30, 'p1', 'ember')], [mon('snorlax', 90, 'e1', 'growl')], BAND);
    resolveTurn(fire.ctx, MAX);
    expect(fire.battle.weather?.id).toBe('sun');
    const normal = setup([mon('pidgey', 30, 'p1', 'tackle')], [mon('snorlax', 90, 'e1', 'growl')], BAND);
    resolveTurn(normal.ctx, MAX);
    expect(normal.battle.enemyStages.spe).toBe(-1);
    // Max Lightning (and the other terrain Max Moves) set their terrain.
    const volt = setup([mon('jolteon', 30, 'p1', 'thunder-shock')], [mon('snorlax', 90, 'e1', 'growl')], BAND);
    resolveTurn(volt.ctx, MAX);
    expect(volt.battle.terrain?.id).toBe('electric');
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const { ctx } = setup([mon('pikachu', 30, 'p1', 'zap-cannon')], [mon('snorlax', 90, 'e1', 'growl')], BAND, `max-acc-${seed}`);
      expect(resolveTurn(ctx, MAX).some((x) => x.type === 'miss')).toBe(false);
    }
  });

  it('a status move becomes Max Guard, which goes first and blocks the foe', () => {
    const { ctx } = setup([mon('pidgey', 30, 'p1', 'growl')], [mon('rattata', 40, 'e1', 'quick-attack')], BAND);
    const events = resolveTurn(ctx, MAX);
    expect(movesUsed(events, 'player')).toEqual(['max-guard']);
    expect(events.some((x) => x.type === 'protected' && x.side === 'player')).toBe(true);
  });

  it("can't be made to flinch", () => {
    // Pickup, not Technician (a Technician Fake Out would knock the Pidgey out).
    const ambipom = mon('ambipom', 60, 'e1', 'fake-out');
    ambipom.abilitySlot = 1;
    const { ctx } = setup([mon('pidgey', 30, 'p1', 'tackle')], [ambipom], BAND);
    const events = resolveTurn(ctx, MAX);
    expect(movesUsed(events, 'enemy')).toEqual(['fake-out']);
    expect(events.some((x) => x.type === 'cant' && x.reason === 'flinch')).toBe(false);
    expect(movesUsed(events, 'player')).toEqual(['max-strike']);
  });

  it('ends early when the Pokémon switches out', () => {
    const p = mon('pidgey', 30, 'p1', 'tackle');
    const max = calcStats(content, p).hp;
    const { ctx, battle } = setup([p, mon('rattata', 30, 'p2', 'tackle')], [mon('snorlax', 90, 'e1', 'growl')], BAND);
    resolveTurn(ctx, MAX);
    const events = resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(transforms(events).map((x) => x.type === 'transform' && x.kind)).toEqual(['dynamaxEnd']);
    expect(p.hp).toBe(max);
    expect(battle.transform.dynamax).toEqual({});
  });

  it('can be switched off for a run', () => {
    const { ctx } = setup([mon('pidgey', 30, 'p1', 'tackle')], [mon('snorlax', 50, 'e1', 'tackle')], BAND);
    ctx.disabledMechanics = ['dynamax'];
    expect(canDynamax(ctx)).toBe(false);
    expect(() => resolveTurn(ctx, MAX)).toThrow(/switched off/);
  });
});

describe('Dynamax in a run', () => {
  const newRun = (seed: string): RunState => {
    let run = chooseStarter(content, createRun(content, { runId: `r-${seed}`, seed, archetypeId: 'red' }), 0);
    run = debugReplaceEnemy(content, toBattle(run), 'magikarp', 100);
    setMoves(run.battle!.enemyTeam[0]!, 'growl');
    setMoves(run.party[0]!, 'tackle');
    run.inventory['dynamax-band'] = 1;
    return run;
  };

  it('survives save and load mid-Dynamax, and HP is back to normal when the battle ends', () => {
    let run = takeTurn(content, newRun('max-save'), MAX).run;
    expect(run.party[0]!.dynamaxed).toBe(true);
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    expect(saves.saveRun(run)).toEqual({ ok: true });
    const loaded = saves.loadRun();
    expect(loaded).toEqual({ status: 'ok', data: run });
    run = (loaded as { data: RunState }).data;
    run.battle!.enemyTeam[0]!.hp = 1;
    const result = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(result.end?.outcome).toBe('win');
    const starter = result.run.party[0]!;
    expect(starter.dynamaxed).toBeUndefined();
    expect(starter.hp).toBeLessThanOrEqual(calcStats(content, starter).hp);
  });

  it('is deterministic', () => {
    expect(takeTurn(content, newRun('max-det'), MAX).events).toEqual(takeTurn(content, newRun('max-det'), MAX).events);
  });

  it('offers the Dynamax Band once, and the shop sells it from 3 badges', () => {
    const r = chooseStarter(content, createRun(content, { runId: 'r-max', seed: 'max', archetypeId: 'red' }), 0);
    const band = content.rewards.get('dynamax-band')!;
    expect(isRewardEligible(content, r, band)).toBe(true);
    r.badges = ['a', 'b', 'c'];
    expect(shopStock(content, r).some((e) => e.item === 'dynamax-band')).toBe(true);
    r.inventory['dynamax-band'] = 1;
    expect(isRewardEligible(content, r, band)).toBe(false);
    expect(shopStock(content, r).some((e) => e.item === 'dynamax-band')).toBe(false);
  });
});
