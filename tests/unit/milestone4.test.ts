// Milestone 4: regions, the Pokémon League (Elite Four and champion), the
// level cap per region, region transitions, the dev campaign, shop stock by
// badges and the v3 → v4 save upgrade.

import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { leagueScale, planChampion, planEliteFour } from '../../src/core/encounters';
import { generateLeagueMap, validateLeagueMap } from '../../src/core/map';
import { createPokemon, gainXp, maxHp } from '../../src/core/pokemon';
import { generateRegionOrder, levelCap, pickLeague } from '../../src/core/regions';
import { rewardTargetProblem } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import {
  buyItem,
  chooseReward,
  chooseStarter,
  createRun,
  debugJumpToLeague,
  ensureRegionOrder,
  resolveDecision,
  shopStock,
  takeTurn,
  visitSide,
} from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, takeAnyReward, toBattle } from './helpers';

const RED = getArchetype(content, 'red');
const FULL = content.campaigns.get('full')!;
const DEV = content.campaigns.get('dev')!;

function newRun(seed = 'm4', campaignId = 'full'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId: 'red', campaignId }), 0);
}

/** A party member strong enough to win any battle without luck. */
function powerUp(run: RunState): RunState {
  const mon = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  mon.moves = [{ id: 'flamethrower', pp: 64 }, { id: 'crunch', pp: 64 }];
  run.party[0] = mon;
  return run;
}

/**
 * Fights the current battle with the first damaging move, then skips move-learning.
 * `topUp` keeps the lead standing every turn (late bosses are trained, clever and can knock out
 * even a level 100 Pokémon in one hit; this test is about the campaign flow, not difficulty).
 */
function win(run: RunState, topUp = false): RunState {
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 500) {
    if (run.battle!.needsSwitch) {
      run = takeTurn(content, run, { kind: 'switch', partyIndex: run.party.findIndex((p) => p.hp > 0) }).run;
      continue;
    }
    const mon = run.party[run.battle!.activeIndex]!;
    if (topUp) mon.hp = 1_000_000;
    const idx = mon.moves.findIndex((m) => m.pp > 0 && (content.moves.get(m.id)!.power ?? 0) > 0);
    run = takeTurn(content, run, { kind: 'move', index: idx >= 0 ? idx : 0 }).run;
  }
  return skipDecisions(run);
}

function skipDecisions(run: RunState): RunState {
  while (run.phase === 'decision') run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
  return run;
}

/** Restores the party's HP and PP so long playthroughs never depend on luck. */
function refresh(run: RunState): RunState {
  for (const mon of run.party) {
    mon.hp = maxHp(content, mon);
    mon.status = null;
    for (const slot of mon.moves) slot.pp = 64;
  }
  return run;
}

describe('regions', () => {
  it('a full run visits every regular region once, in a shuffled order, with the Grand Region last', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const order = generateRegionOrder(content, FULL, new Rng(hashSeed(`order-${i}`)));
      expect(order).toHaveLength(FULL.regularRegions + 1);
      expect(new Set(order).size).toBe(order.length);
      expect(order.at(-1)).toBe('grand');
      expect(order.slice(0, -1)).not.toContain('grand');
      orders.add(order.join());
    }
    expect(orders.size).toBeGreaterThan(20);
  });

  it('the dev campaign is two short regions with no Grand Region', () => {
    const run = newRun('dev-shape', 'dev');
    expect(run.campaignId).toBe('dev');
    expect(run.regionOrder).toHaveLength(DEV.regularRegions);
    expect(run.regionOrder).not.toContain('grand');
    expect(run.stage!.map.columns).toBe(DEV.columns);
  });

  it('each region raises the level cap by 50, stopping at 100 for now (D14)', () => {
    expect(levelCap(content, 0)).toBe(50);
    expect(levelCap(content, 1)).toBe(100);
    expect(levelCap(content, 5)).toBe(100);
  });

  it('a Pokémon stops gaining levels at the region cap', () => {
    const mon = createPokemon(content, 'pikachu', 48, 'p1');
    const result = gainXp(content, mon, 10_000_000, 50);
    expect(result.newLevel).toBe(50);
    expect(mon.level).toBe(50);
    const run = newRun('cap');
    run.party[0]!.level = 50;
    const levelUp = [...content.rewards.values()].find((r) => r.effect.kind === 'levelUp')!;
    expect(rewardTargetProblem(content, run, levelUp, 0)).toMatch(/level cap \(50\)/);
  });

  it('the league picks its own Elite Four and champion first, and never someone already met', () => {
    const kanto = content.regions.get('kanto')!;
    const league = pickLeague(content, kanto, FULL, [], new Rng(hashSeed('kanto')));
    expect(league.eliteFour).toHaveLength(FULL.eliteFourSize);
    for (const id of kanto.eliteFour) expect(league.eliteFour).toContain(id);
    expect(league.champion).toBe('lance');
    const again = pickLeague(content, content.regions.get('johto')!, FULL, [...league.eliteFour, league.champion], new Rng(hashSeed('johto')));
    for (const id of again.eliteFour) expect(league.eliteFour).not.toContain(id);
    expect(again.champion).not.toBe('lance');
  });
});

describe('the Pokémon League', () => {
  it('is a straight line of Elite Four members, then the champion', () => {
    const map = generateLeagueMap(4);
    expect(validateLeagueMap(map)).toEqual([]);
    expect(map.nodes.map((n) => n.kind)).toEqual(['elite', 'elite', 'elite', 'elite', 'champion']);
    const broken = structuredClone(map);
    broken.nodes[4]!.kind = 'elite';
    expect(validateLeagueMap(broken).join()).toMatch(/champion/);
  });

  it('Elite Four and champion teams come from bossTeams.json; the region 1 league stays under the level cap', () => {
    const scale = leagueScale(content, 0);
    for (let i = 0; i < 20; i++) {
      const plan = planEliteFour(content, RED, 'lorelei', 0, scale, new Rng(hashSeed(`e4-${i}`)));
      expect(plan.classId).toBe('elite-four');
      expect(plan.members.map((m) => m.speciesId)).toEqual(content.bosses.get('lorelei')!.teams.elite[0]!.members.map((m) => m.speciesId));
      for (const m of plan.members) {
        expect(m.level).toBeLessThanOrEqual(50);
        expect(m.level).toBeGreaterThanOrEqual(44);
      }
      const champ = planChampion(content, RED, 'cynthia', 0, scale, new Rng(hashSeed(`ch-${i}`)));
      expect(champ.members.length).toBe(6);
      const ace = Math.max(...champ.members.map((m) => m.level));
      expect(ace).toBeGreaterThanOrEqual(46);
      expect(ace).toBeLessThanOrEqual(50);
    }
  });

  it('comes after the region\'s last gym, heals between battles, and gives a draft after each member', () => {
    let run = powerUp(newRun('league'));
    run = debugJumpToLeague(content, run);
    expect(run.stage!.kind).toBe('league');
    expect(run.stage!.eliteFour).toHaveLength(FULL.eliteFourSize);
    for (let i = 0; i < FULL.eliteFourSize; i++) {
      run = toBattle(run);
      expect(run.battle!.trainer!.classId).toBe('elite-four');
      expect(run.battle!.trainer!.leaderId).toBe(run.stage!.eliteFour[i]);
      run.party[0]!.hp = Math.floor(maxHp(content, run.party[0]!) / 2); // hurt before the win…
      run.party[0]!.moves[0]!.pp -= 1;
      run = win(run, true);
      expect(run.party[0]!.hp).toBe(maxHp(content, run.party[0]!)); // …healed after it
      expect(run.phase).toBe('reward');
      expect(run.draft).toHaveLength(content.balance.draftSize);
      run = skipDecisions(chooseReward(content, run, 0).run);
      expect(run.phase).toBe('map');
    }
    run = toBattle(run);
    expect(run.battle!.trainer!.classId).toBe('champion');
    expect(run.badges).toHaveLength(0); // the league gives no badges
  });

  it('shops sell more as you earn badges', () => {
    const run = newRun('shop4');
    const items = (r: RunState) => shopStock(content, r).map((e) => e.item);
    expect(items(run)).toContain('poke-ball');
    expect(items(run)).not.toContain('great-ball');
    expect(items(run)).not.toContain('full-restore');
    run.badges = ['brock', 'misty'];
    expect(items(run)).toContain('great-ball');
    run.badges = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(items(run)).toContain('full-restore');
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'test-shop', kind: 'shop', used: false });
    let shop = structuredClone(run);
    shop.stage!.current = node.id;
    shop.badges = [];
    shop.money = 10_000;
    shop = visitSide(content, shop, 'test-shop').run;
    expect(() => buyItem(content, shop, 'great-ball')).toThrow(/badges/);
  });
});

describe('the dev campaign, start to finish', () => {
  it('clears two regions (stages, league, champion), raises the cap, then wins the run', () => {
    // Six strong Pokémon: level 100 teams know one-hit KO moves such as Fissure.
    let run = powerUp(newRun('dev-full', 'dev'));
    for (let i = 1; i < content.balance.partyMax; i++) run.party.push({ ...structuredClone(run.party[0]!), uid: `extra${i}` });
    const firstRegion = run.regionOrder[0]!;
    const kinds: string[] = [];
    let sawSecondRegion = false;
    let guard = 0;
    while (run.phase !== 'over' && guard++ < 200) {
      expect(run.phase).toBe('map');
      run = toBattle(refresh(run));
      const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
      kinds.push(node.kind);
      run = win(run, true);
      if (run.phase === 'over') break;
      expect(run.phase).toBe('reward');
      run = skipDecisions(takeAnyReward(run));
      if (run.regionIndex === 1 && !sawSecondRegion) {
        sawSecondRegion = true;
        expect(run.regionsCleared).toEqual([firstRegion]);
        expect(run.stage!.kind).toBe('stage');
        expect(run.stage!.index).toBe(0);
        expect(levelCap(content, run.regionIndex)).toBe(100);
      }
    }
    expect(sawSecondRegion).toBe(true);
    expect(run.phase).toBe('over');
    expect(run.victory).toBe(true);
    expect(run.regionsCleared).toEqual(run.regionOrder);
    const perRegion = DEV.stagesPerRegion * DEV.columns + DEV.eliteFourSize + 1;
    expect(kinds).toHaveLength(perRegion * 2);
    expect(kinds.filter((k) => k === 'gym')).toHaveLength(DEV.stagesPerRegion * 2);
    expect(kinds.filter((k) => k === 'elite')).toHaveLength(DEV.eliteFourSize * 2);
    expect(kinds.filter((k) => k === 'champion')).toHaveLength(2);
    expect(run.badges).toHaveLength(DEV.stagesPerRegion * 2);
    // Bosses never repeat in a run (D6).
    expect(new Set(run.usedLeaders).size).toBe(run.usedLeaders.length);
    expect(run.usedLeaders).toHaveLength((DEV.stagesPerRegion + DEV.eliteFourSize + 1) * 2);
  });
});

describe('save upgrades (v3 → v4)', () => {
  it('upgrades a Milestone 3 run save into the first region of a full campaign', () => {
    const run = newRun('migrate4');
    const { campaignId, regionOrder, regionIndex, regionsCleared, victory, ...v3 } = run;
    void [campaignId, regionOrder, regionIndex, regionsCleared, victory];
    const { kind, eliteFour, ...stageV3 } = run.stage!;
    void [kind, eliteFour];
    const storage = new MemoryStorageProvider();
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 3, savedAt: '', data: { ...v3, stage: stageV3 } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(3);
    expect(loaded.data).toMatchObject({ campaignId: 'full', regionOrder: [], regionIndex: 0, regionsCleared: [], victory: false });
    expect(loaded.data.stage!.kind).toBe('stage');
    const upgraded = ensureRegionOrder(content, loaded.data);
    expect(upgraded.regionOrder).toHaveLength(FULL.regularRegions + 1);
    expect(loaded.data.regionOrder).toEqual([]); // the loaded copy is untouched
  });

  it('rejects a save with an unknown campaign or region', () => {
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    const bad = newRun('bad-campaign');
    bad.campaignId = 'nope';
    saves.saveRun(bad);
    expect(saves.loadRun()).toMatchObject({ status: 'corrupt' });
    const badRegion = newRun('bad-region');
    badRegion.regionOrder[0] = 'atlantis';
    saves.saveRun(badRegion);
    expect(saves.loadRun()).toMatchObject({ status: 'corrupt' });
  });
});
