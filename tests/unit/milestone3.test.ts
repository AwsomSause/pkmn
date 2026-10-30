// Milestone 3: stage themes, the stage map, difficulty, heal stops, the shop,
// gym leaders and save upgrades.

import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { enemyLevel, planGymLeader, planTrainer } from '../../src/core/encounters';
import { generateStageMap, nextChoices, validateStageMap } from '../../src/core/map';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import {
  buyItem,
  chooseNode,
  chooseReward,
  chooseStarter,
  createRun,
  debugJumpToColumn,
  leaveShop,
  shopPrice,
  resolveDecision,
  takeTurn,
  visitSide,
} from '../../src/core/run';
import type { RunState, StageMap } from '../../src/core/state';
import { pickGymLeader, themePool, trainerClassesFor, wildEligibleSpecies } from '../../src/core/themes';
import { TYPE_NAMES } from '../../src/core/contentSchema';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, scaleAt, takeAnyReward, toBattle } from './helpers';

const RED = getArchetype(content, 'red');
const FULL = content.campaigns.get('full')!;

function newRun(seed = 'm3'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'run-m3', seed, archetypeId: 'red' }), 0);
}

/** Every route from the start to the gym, as lists of node ids. */
function allRoutes(map: StageMap): string[][] {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    const node = byId.get(id)!;
    if (node.next.length === 0) out.push([...path, id]);
    for (const next of node.next) walk(next, [...path, id]);
  };
  for (const start of map.nodes.filter((n) => n.column === 1)) walk(start.id, []);
  return out;
}

/** Fights the current battle with the first damaging move, skipping move-learning. */
function win(run: RunState): RunState {
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 500) {
    const mon = run.party[run.battle!.activeIndex]!;
    const idx = mon.moves.findIndex((m) => m.pp > 0 && (content.moves.get(m.id)!.power ?? 0) > 0);
    run = takeTurn(content, run, { kind: 'move', index: idx >= 0 ? idx : 0 }).run;
  }
  while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
  return run;
}

/** A party member strong enough to clear a stage without luck. */
function powerUp(run: RunState): RunState {
  const mon = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  mon.moves = [{ id: 'flamethrower', pp: 64 }, { id: 'crunch', pp: 64 }];
  run.party[0] = mon;
  return run;
}

describe('stage themes', () => {
  it('has a theme for every one of the 153 type pairs, each with a unique name', () => {
    const themes = [...content.themes.values()];
    expect(themes).toHaveLength(153);
    expect(new Set(themes.map((t) => t.name)).size).toBe(153);
    const pairs = new Set(themes.map((t) => [...t.types].sort().join('/')));
    for (let i = 0; i < TYPE_NAMES.length; i++)
      for (let j = i + 1; j < TYPE_NAMES.length; j++) expect(pairs.has([TYPE_NAMES[i], TYPE_NAMES[j]].sort().join('/'))).toBe(true);
  });

  it("keeps the director's example names", () => {
    expect(content.themes.get('electric-ghost')?.name).toBe('Stormy Nightmares');
    expect(content.themes.get('fire-psychic')?.name).toBe('Firey Promises');
    expect(content.themes.get('normal-water')?.name).toBe('Lazy Rivers');
  });

  it('every type has wild Pokémon, a trainer class and an arena', () => {
    const wild = wildEligibleSpecies(content);
    for (const type of TYPE_NAMES) {
      expect(wild.some((s) => s.types.includes(type)), `wild ${type}`).toBe(true);
      expect([...content.trainers.values()].some((c) => c.types.includes(type)), `trainer ${type}`).toBe(true);
      expect(content.arenas[type], `arena ${type}`).toBeDefined();
    }
  });

  it('wild Pokémon in a theme share one of its types, and trainer classes fit the theme', () => {
    for (const theme of content.themes.values()) {
      const pool = themePool(content, theme);
      expect(pool.length).toBeGreaterThan(0);
      const matching = pool.filter((p) => content.species.get(p.speciesId)!.types.some((t) => theme.types.includes(t)));
      expect(matching.length).toBeGreaterThan(0);
      for (const cls of trainerClassesFor(content, theme)) expect(cls.types.some((t) => theme.types.includes(t))).toBe(true);
    }
  });

  it('trainer teams come from the theme', () => {
    const theme = content.themes.get('electric-ghost')!;
    for (let i = 0; i < 50; i++) {
      const plan = planTrainer(content, RED, theme, 0, scaleAt(0, 5), new Rng(hashSeed(`t-${i}`)));
      for (const m of plan.members) {
        const base = themePool(content, theme).map((p) => p.speciesId);
        const species = content.species.get(m.speciesId)!;
        const inTheme = species.types.some((t) => theme.types.includes(t)) || base.includes(m.speciesId);
        expect(inTheme, `${m.speciesId} in ${theme.name}`).toBe(true);
      }
    }
  });

  it('gym leaders prefer a matching speciality and never repeat in a run', () => {
    const theme = content.themes.get('fire-psychic')!;
    const used: string[] = [];
    for (let i = 0; i < 10; i++) {
      const leader = pickGymLeader(content, theme, used, new Rng(hashSeed(`gl-${i}`)));
      expect(used).not.toContain(leader.id);
      used.push(leader.id);
    }
    const first = pickGymLeader(content, theme, [], new Rng(hashSeed('gl')));
    expect(first.types.some((t) => theme.types.includes(t))).toBe(true);
  });
});

describe('stage map', () => {
  it('is always valid: 20 levels per route, exactly 2 trainers, one gym', () => {
    for (let i = 0; i < 300; i++) {
      const map = generateStageMap(content, FULL, new Rng(hashSeed(`map-${i}`)));
      expect(validateStageMap(map), `seed map-${i}`).toEqual([]);
      expect(map.nodes.filter((n) => n.kind === 'gym')).toHaveLength(1);
      for (const route of allRoutes(map).slice(0, 200)) {
        expect(route).toHaveLength(FULL.columns);
        const kinds = route.map((id) => map.nodes.find((n) => n.id === id)!.kind);
        expect(kinds.filter((k) => k === 'trainer')).toHaveLength(2);
        expect(kinds.at(-1)).toBe('gym');
      }
    }
    // 300 maps take about 4.5 s on their own, so the default 5 s limit failed now and then when every test file ran at once.
  }, 30_000);

  it('the same seed builds the same map', () => {
    const a = generateStageMap(content, FULL, new Rng(hashSeed('same')));
    const b = generateStageMap(content, FULL, new Rng(hashSeed('same')));
    expect(a).toEqual(b);
  });

  it('has forks, and a healing spot right before the gym', () => {
    let forks = 0;
    for (let i = 0; i < 50; i++) {
      const map = generateStageMap(content, FULL, new Rng(hashSeed(`fork-${i}`)));
      forks += map.nodes.filter((n) => n.next.length > 1).length;
      for (const n of map.nodes.filter((n) => n.column === map.columns - 1)) expect(n.sides.some((s) => s.kind === 'heal')).toBe(true);
    }
    expect(forks).toBeGreaterThan(50);
  });

  it('the validator catches broken maps', () => {
    const map = generateStageMap(content, FULL, new Rng(hashSeed('broken')));
    const deadEnd = structuredClone(map);
    deadEnd.nodes.find((n) => n.column === 3)!.next = [];
    expect(validateStageMap(deadEnd).join()).toMatch(/dead end/);
    const skip = structuredClone(map);
    skip.nodes.find((n) => n.column === 3)!.next.push(map.nodes.find((n) => n.column === 5)!.id);
    expect(validateStageMap(skip).join()).toMatch(/skips/);
  });
});

describe('difficulty', () => {
  it('levels rise with progress and the breakdown adds up', () => {
    const rng = () => new Rng(hashSeed('diff'));
    const early = enemyLevel(content, RED, scaleAt(0, 1), 0, rng());
    const late = enemyLevel(content, RED, scaleAt(0, 19), 0, rng());
    expect(late.level).toBeGreaterThan(early.level);
    for (const b of [early, late]) {
      expect(b.unclamped).toBe(Math.round(b.base + b.progress) + b.variance + b.archetypeOffset + b.bonus);
      expect(b.level).toBe(Math.max(content.balance.difficulty.minLevel, Math.min(50, Math.round(b.unclamped))));
    }
  });

  it('the gym leader of stage 1 has an ace around level 11', () => {
    const theme = content.themes.get('water-normal') ?? content.themes.get('normal-water')!;
    const leader = pickGymLeader(content, theme, [], new Rng(hashSeed('ace')));
    for (let i = 0; i < 20; i++) {
      const plan = planGymLeader(content, RED, leader.id, 0, scaleAt(0, 20), new Rng(hashSeed(`ace-${i}`)));
      const top = Math.max(...plan.members.map((m) => m.level));
      expect(top).toBeGreaterThanOrEqual(9);
      expect(top).toBeLessThanOrEqual(14);
      expect(plan.leaderId).toBe(leader.id);
    }
  });

  it('harder nodes add enemy levels and use better reward odds', () => {
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      let run = newRun(`harder-${i}`);
      const harder = nextChoices(run.stage!).find((n) => n.harder);
      if (!harder) continue;
      found = true;
      run = chooseNode(content, run, harder.id);
      const [lo, hi] = content.balance.difficulty.harderBonus;
      const info = run.battle!.levelInfo[0]!;
      expect(info.bonus).toBeGreaterThanOrEqual(lo);
      expect(info.bonus).toBeLessThanOrEqual(hi);
    }
    expect(found).toBe(true);
  });
});

describe('map flow', () => {
  it('starts on the map; only the next column can be chosen', () => {
    const run = newRun('flow3');
    expect(run.phase).toBe('map');
    expect(run.stage!.index).toBe(0);
    expect(run.usedThemes).toEqual([run.stage!.themeId]);
    const far = run.stage!.map.nodes.find((n) => n.column === 3)!;
    expect(() => chooseNode(content, run, far.id)).toThrow();
    const battle = toBattle(run);
    expect(battle.phase).toBe('battle');
    expect(battle.stage!.visited).toEqual([battle.stage!.current]);
  });

  it('a healing spot heals the party once', () => {
    let run = debugJumpToColumn(newRun('heal'), FULL.columns);
    run.party[0]!.hp = 1;
    run.party[0]!.moves[0]!.pp = 0;
    const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
    const heal = node.sides.find((s) => s.kind === 'heal')!;
    const result = visitSide(content, run, heal.id);
    run = result.run;
    expect(run.party[0]!.hp).toBeGreaterThan(1);
    expect(run.party[0]!.moves[0]!.pp).toBeGreaterThan(0);
    expect(() => visitSide(content, run, heal.id)).toThrow(/already/);
  });

  it('the shop sells items for money and refuses when you cannot pay', () => {
    let run = toBattle(newRun('shop'));
    run = powerUp(run);
    run = win(run);
    run = chooseReward(content, run, 0).run;
    while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
    const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
    node.sides.push({ id: 'test-shop', kind: 'shop', used: false });
    run.money = 300;
    run = visitSide(content, run, 'test-shop').run;
    expect(run.phase).toBe('shop');
    const before = run.inventory['poke-ball'] ?? 0;
    const ballPrice = shopPrice(content, run, content.shop.find((e) => e.item === 'poke-ball')!);
    run = buyItem(content, run, 'poke-ball').run;
    expect(run.inventory['poke-ball']).toBe(before + 1);
    expect(run.money).toBe(300 - ballPrice);
    run.money = 5;
    expect(() => buyItem(content, run, 'potion')).toThrow(/need/);
    run = leaveShop(content, run);
    expect(run.phase).toBe('map');
    // A shop can be visited again.
    expect(visitSide(content, run, 'test-shop').run.phase).toBe('shop');
  });

  it('a full stage: 20 levels, 2 trainers, the gym leader, a badge, then a new stage with a new theme', () => {
    let run = powerUp(newRun('full-stage'));
    const firstTheme = run.stage!.themeId;
    const kinds: string[] = [];
    let guard = 0;
    while (run.stage!.index === 0 && guard++ < 40) {
      expect(run.phase).toBe('map');
      run = toBattle(run);
      const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
      kinds.push(node.kind);
      if (node.kind === 'gym') {
        expect(run.battle!.trainer!.leaderId).toBe(run.stage!.leaderId);
        expect(run.battle!.trainer!.classId).toBe('gym-leader');
      }
      run = win(run);
      expect(run.phase).toBe('reward');
      run = takeAnyReward(run);
      while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
      run.party[0]!.hp = maxHp(content, run.party[0]!);
    }
    expect(kinds).toHaveLength(20);
    expect(kinds.filter((k) => k === 'trainer')).toHaveLength(2);
    expect(kinds.at(-1)).toBe('gym');
    expect(run.badges).toHaveLength(1);
    expect(run.stage!.index).toBe(1);
    expect(run.stage!.current).toBeNull();
    expect(run.stage!.themeId).not.toBe(firstTheme);
    expect(run.usedLeaders).toHaveLength(2);
    expect(new Set(run.usedLeaders).size).toBe(2);
  });
});

describe('save upgrades (v2 → v3)', () => {
  it('upgrades a Milestone 2 run save and gives it a stage after the next reward', () => {
    let run = powerUp(toBattle(newRun('migrate3')));
    const { stage, usedThemes, usedLeaders, badges, ...v2 } = run;
    void [stage, usedThemes, usedLeaders, badges];
    const { levelInfo, ...battleV2 } = run.battle!;
    void levelInfo;
    const storage = new MemoryStorageProvider();
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 2, savedAt: '', data: { ...v2, battle: battleV2 } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(2);
    expect(loaded.data).toMatchObject({ stage: null, usedThemes: [], usedLeaders: [], badges: [] });
    expect(loaded.data.battle!.levelInfo).toEqual([]);
    run = win(loaded.data);
    run = chooseReward(content, run, 0).run;
    while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
    expect(run.phase).toBe('map');
    expect(run.stage!.index).toBe(0);
  });

  it('rejects a save whose stage refers to an unknown theme', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const run = newRun('bad-theme');
    run.stage!.themeId = 'not-a-theme';
    saves.saveRun(run);
    expect(saves.loadRun()).toMatchObject({ status: 'corrupt' });
  });
});

describe('move data from the director\'s move list', () => {
  it('every status move does something and every damaging move has power', () => {
    for (const move of content.moves.values()) {
      if (!move.supported) continue;
      const fx = move.effects;
      if (move.category === 'status') expect(Object.keys(fx).length > 0, move.id).toBe(true);
      else expect(move.power !== null || Boolean(fx.fixedDamage || fx.halveTarget || fx.endeavor || fx.counter || fx.ohko || fx.lowHpPower), move.id).toBe(true);
    }
  });

  it('imported effects come through correctly', () => {
    const get = (id: string) => content.moves.get(id)!;
    expect(get('close-combat').effects.statChanges).toEqual([
      { stat: 'def', stages: -1, target: 'self', chance: 100 },
      { stat: 'spd', stages: -1, target: 'self', chance: 100 },
    ]);
    expect(get('swords-dance')).toMatchObject({ target: 'self', effects: { statChanges: [{ stat: 'atk', stages: 2, target: 'self', chance: 100 }] } });
    expect(get('double-edge').effects.recoil).toBeCloseTo(1 / 3);
    expect(get('extreme-speed').priority).toBe(2);
    expect(get('spore').flags).toContain('powder');
    expect(get('ice-beam').effects.status).toEqual({ id: 'frz', chance: 10 });
    expect(get('earthquake')).toMatchObject({ power: 100, accuracy: 100, pp: 10, effects: {} });
  });
});
