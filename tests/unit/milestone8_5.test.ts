// Milestone 8.5, slice 1: Mega Evolution and Primal Reversion. The Mega Stone
// data, the battle rules (key item, once per battle, one per Pokémon, boss
// aces, the challenge switch), changing back after battle, save/load and the
// reward draft and shop.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent, type PlayerAction } from '../../src/core/battle/engine';
import { battleTypes, bossMechanics, megaOptions, revertTransformations, stabMultiplier, stoneForms, teraOption, teraPower } from '../../src/core/battle/transform';
import { applyItemToPokemon, itemUseProblem, teraTypeOf } from '../../src/core/items';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { isRewardEligible } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { buyItem, chooseStarter, createRun, debugReplaceEnemy, shopStock, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

const MEGA: PlayerAction = { kind: 'move', index: 0, transform: { kind: 'mega' } };

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

describe('Mega Evolution in battle', () => {
  it('needs the Mega Ring and the stone', () => {
    const p = mon('venusaur', 50, 'p1', 'tackle');
    const e = mon('rattata', 5, 'e1', 'tackle');
    for (const inventory of [{}, { 'mega-ring': 1 }, { venusaurite: 1 }] as Record<string, number>[]) {
      const { ctx } = setup([structuredClone(p)], [structuredClone(e)], inventory);
      expect(megaOptions(ctx)).toEqual([]);
      expect(() => resolveTurn(ctx, MEGA)).toThrow(/Mega Ring|Mega Stone/);
    }
  });

  it('changes form, types and stats before anyone moves, so the new Speed counts', () => {
    // Beedrill (Speed 75) is slower than Garchomp (102); Mega Beedrill (145) is faster.
    const runTurn = (mega: boolean) => {
      const p = mon('beedrill', 50, 'p1', 'tackle');
      const e = mon('garchomp', 50, 'e1', 'tackle');
      const { ctx } = setup([p], [e], { 'mega-ring': 1, beedrillite: 1 });
      const events = resolveTurn(ctx, mega ? MEGA : { kind: 'move', index: 0 });
      return { p, events, first: events.find((x) => x.type === 'move')!.side };
    };
    expect(runTurn(false).first).toBe('enemy');
    const { p, events, first } = runTurn(true);
    expect(first).toBe('player');
    expect(transforms(events)).toEqual([{ type: 'transform', side: 'player', uid: 'p1', kind: 'mega', from: 'beedrill', to: 'beedrill-mega', itemId: 'beedrillite' }]);
    expect(p.speciesId).toBe('beedrill-mega');
    expect(events[0]!.type).toBe('transform');
  });

  it('works once per battle, once per Pokémon, and lasts through switching', () => {
    const a = mon('venusaur', 50, 'p1', 'tackle');
    const b = mon('charizard', 50, 'p2', 'tackle');
    const e = mon('snorlax', 60, 'e1', 'splash');
    const { battle, ctx } = setup([a, b], [e], { 'mega-ring': 1, venusaurite: 1, 'charizardite-x': 1, 'charizardite-y': 1 });
    resolveTurn(ctx, MEGA);
    expect(a.speciesId).toBe('venusaur-mega');
    expect(() => resolveTurn(ctx, MEGA)).toThrow(/already/);
    resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(megaOptions(ctx)).toEqual([]);
    expect(() => resolveTurn(ctx, { kind: 'move', index: 0, transform: { kind: 'mega', formId: 'charizard-mega-y' } })).toThrow(/already Mega Evolved/);
    resolveTurn(ctx, { kind: 'switch', partyIndex: 0 });
    expect(a.speciesId).toBe('venusaur-mega');
    expect(battle.transform.used.player).toEqual(['mega']);
  });

  it('lets the player pick between Mega Charizard X and Y', () => {
    const p = mon('charizard', 50, 'p1', 'tackle');
    const { ctx } = setup([p], [mon('snorlax', 60, 'e1', 'splash')], { 'mega-ring': 1, 'charizardite-x': 1, 'charizardite-y': 1 });
    expect(megaOptions(ctx).map((o) => o.formId)).toEqual(['charizard-mega-x', 'charizard-mega-y']);
    resolveTurn(ctx, { kind: 'move', index: 0, transform: { kind: 'mega', formId: 'charizard-mega-y' } });
    expect(p.speciesId).toBe('charizard-mega-y');
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
    expect(megaOptions(ctx)).toEqual([]);
    expect(() => resolveTurn(ctx, MEGA)).toThrow(/switched off/);
    expect(transforms(resolveTurn(ctx, { kind: 'move', index: 0 }))).toEqual([]);
    expect(bossMechanics(content, 'champion', 1, ['mega'])).toEqual(['tera']);
    expect(bossMechanics(content, 'champion', 1, ['mega', 'tera'])).toEqual([]);
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
    expect(bossMechanics(content, 'elite', 1, [])).toEqual(['mega', 'tera']);
    expect(bossMechanics(content, 'champion', 1, [])).toEqual(['mega', 'tera']);
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

  it('can be used in the same battle as a Mega, but not on the same Pokémon', () => {
    const a = mon('venusaur', 50, 'p1', 'tackle');
    const b = mon('charizard', 50, 'p2', 'tackle');
    const { battle, ctx } = setup([a, b], [mon('snorlax', 60, 'e1', 'splash')], { 'mega-ring': 1, venusaurite: 1, 'tera-orb': 1 });
    resolveTurn(ctx, MEGA);
    expect(teraOption(ctx)).toBeNull();
    expect(() => resolveTurn(ctx, TERA)).toThrow(/already transformed/);
    resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    resolveTurn(ctx, TERA);
    expect(battle.transform.used.player).toEqual(['mega', 'tera']);
    expect(battleTypes(content, battle, b)).toEqual(['fire']);
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
