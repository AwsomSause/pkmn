// Spec 30 and 31: rental teams and raids scale with badges.

import { describe, expect, it } from 'vitest';
import { beginExpedition, expeditionPreview } from '../../src/core/expedition/flow';
import { eligibleRentalTeams, offerPool, pickRentalTeam, rentalLevel } from '../../src/core/expedition/rental';
import { ExpeditionFileSchema } from '../../src/core/expedition/schema';
import { activeDenTriggers, absorbHit, getRaid, pickRaidFor, placeRaidDens, raidDef, reinforcementDue, takeExtraAction, triggerChanceBonus } from '../../src/core/raid/raid';
import { maxHp } from '../../src/core/pokemon';
import { badgeLevelBonus, scaledRaid, tierOpenAtBadges } from '../../src/core/raid/scaling';
import { chooseStarter, createRun, enterRaid, raidPreview, takeTurn } from '../../src/core/run';
import { RunStateSchema, currentEnemy, type RunState } from '../../src/core/state';
import expeditionsJson from '../../src/data/expeditions.json';
import { content } from './helpers';

const badges = (n: number) => Array.from({ length: n }, (_, i) => `b${i}`);

function gateRun(seed: string, expeditionId: string, withBadges: number): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'bs', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = [{ id: 'gate-test', kind: 'expedition', expeditionId, used: false }, { id: 'raid-test', kind: 'raid', raidId: 'storm-gyarados', used: false }];
  run.stage!.current = node.id;
  run.badges = badges(withBadges);
  return run;
}

describe('rental teams scale with badges', () => {
  it('validates, and every badge count has at least two teams', () => {
    expect(ExpeditionFileSchema.safeParse(expeditionsJson).success).toBe(true);
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 40]) expect(eligibleRentalTeams(content, n).length).toBeGreaterThanOrEqual(2);
  });

  it('offers a different, stronger kind of team as badges grow (never one team with bigger levels)', () => {
    const early = new Set(eligibleRentalTeams(content, 0).map((t) => t.id));
    const late = new Set(eligibleRentalTeams(content, 10).map((t) => t.id));
    expect([...early].filter((id) => late.has(id))).toEqual([]);
    const mons = (n: number) => eligibleRentalTeams(content, n).flatMap((t) => t.members.map((m) => m.species));
    const stage = (id: string) => content.species.get(id)!.evolutionStage;
    const avg = (ids: string[]) => ids.reduce((s, id) => s + stage(id), 0) / ids.length;
    expect(avg(mons(10))).toBeGreaterThan(avg(mons(0)));
    expect(eligibleRentalTeams(content, 10).every((t) => t.members.every((m) => m.item && m.moves.length === 4))).toBe(true);
  });

  it('the pick is seeded, prefers a team not yet borrowed, and falls back when all were', () => {
    const run = { seed: 'r1', badges: badges(5), rentalsUsed: [] as string[] };
    const a = pickRentalTeam(content, run, 'k');
    expect(pickRentalTeam(content, run, 'k').id).toBe(a.id);
    const b = pickRentalTeam(content, { ...run, rentalsUsed: [a.id] }, 'k');
    expect(b.id).not.toBe(a.id);
    const all = eligibleRentalTeams(content, 5).map((t) => t.id);
    expect(all).toContain(pickRentalTeam(content, { ...run, rentalsUsed: all }, 'k').id);
  });

  it('the level follows the own party, so a rental never outlevels it by much', () => {
    const team = { levelOffset: 0 };
    const party = (lv: number, hp = 10) => [{ level: lv, hp }];
    expect(rentalLevel(content, 30, party(10), team)).toBe(13);
    expect(rentalLevel(content, 12, party(40), team)).toBe(12);
    expect(rentalLevel(content, 30, party(10, 0), team)).toBe(30);
    expect(rentalLevel(content, 30, party(10), { levelOffset: -1 })).toBe(12);
  });

  it('borrowing outfits the Pokémon, scales with badges, and is stable and saveable', () => {
    const low = beginExpedition(content, gateRun('s1', 'borrowed-team', 0), 'gate-test');
    const high = beginExpedition(content, gateRun('s1', 'borrowed-team', 10), 'gate-test');
    expect(low.expedition!.rentalTeam).not.toBe(high.expedition!.rentalTeam);
    for (const run of [low, high]) {
      const team = content.expeditions.rentalTeams.find((t) => t.id === run.expedition!.rentalTeam)!;
      expect(run.rentalsUsed).toEqual([team.id]);
      expect(run.party.map((p) => p.speciesId)).toEqual(team.members.map((m) => m.species));
      run.party.forEach((p, i) => {
        expect(p.moves.map((m) => m.id)).toEqual(team.members[i]!.moves);
        expect(Object.keys(p.held ?? {})).toEqual(team.members[i]!.item ? [team.members[i]!.item!] : []);
      });
      expect(RunStateSchema.safeParse(JSON.parse(JSON.stringify(run))).success).toBe(true);
    }
    // The preview names the same team that begin picks.
    const prev = expeditionPreview(content, gateRun('s1', 'borrowed-team', 10), 'gate-test');
    expect(prev.rules[0]).toContain(content.expeditions.rentalTeams.find((t) => t.id === high.expedition!.rentalTeam)!.name);
    expect(beginExpedition(content, gateRun('s1', 'borrowed-team', 10), 'gate-test').expedition!.rentalTeam).toBe(high.expedition!.rentalTeam);
  });
});

describe('raids scale with badges', () => {
  const s = content.raids.badgeScaling;

  it('scaling is monotonic and leaves the data alone', () => {
    const def = getRaid(content, 'storm-gyarados');
    const copy = JSON.stringify(def);
    const a = scaledRaid(content, def, 0);
    const b = scaledRaid(content, def, 4);
    const c = scaledRaid(content, def, 12);
    expect(JSON.stringify(def)).toBe(copy);
    expect(a).toBe(def);
    expect(b.hpBoostPercent).toBeGreaterThan(a.hpBoostPercent);
    expect(c.hpBoostPercent).toBeGreaterThan(b.hpBoostPercent);
    expect(c.hpBoostPercent - def.hpBoostPercent).toBeLessThanOrEqual(s.maxHpPercent);
    expect(c.rewards.moneyPerLevel).toBeGreaterThan(def.rewards.moneyPerLevel);
    expect(badgeLevelBonus(s, def, 100)).toBe(s.maxLevelBonus);
    expect(c.shield!.points).toBeGreaterThan(def.shield!.points);
    expect(c.shield!.points).toBeLessThanOrEqual(0.5);
    if (def.telegraph) expect(c.telegraph!.boost).toBeLessThanOrEqual(2);
  });

  it('rival and anomaly raids take half the badges; Grand-Enemy and gang raids none', () => {
    const rival = content.raids.raids.find((r) => r.kind === 'rival')!;
    const wild = content.raids.raids.find((r) => r.kind === 'wild')!;
    expect(badgeLevelBonus(s, rival, 8)).toBeLessThan(badgeLevelBonus(s, wild, 8));
    for (const r of content.raids.raids.filter((x) => x.grand || x.gang)) expect(scaledRaid(content, r, 40)).toBe(r);
  });

  it('badges open raid tiers and the pick respects them', () => {
    expect(tierOpenAtBadges(s, 1, 0)).toBe(true);
    expect(tierOpenAtBadges(s, 6, 3)).toBe(false);
    for (let i = 0; i < 20; i++) {
      const def = pickRaidFor(content, { seed: `p${i}`, regionIndex: 4, badges: badges(3), raids: { entered: 0, won: 0, lost: 0, bestTier: 6, done: [], escaped: [], unlockedTier: 6 } }, `k${i}`);
      expect(tierOpenAtBadges(s, def.tier, 3)).toBe(true);
    }
  });

  it('a fight keeps the badge count it started with, and the preview matches it', () => {
    const run = gateRun('s2', 'borrowed-team', 8);
    run.money = 5000;
    const prev = raidPreview(content, run, 'raid-test');
    expect(prev.mechanics[0]).toContain('scaled for 8 badges');
    const fought = enterRaid(content, run, 'raid-test');
    expect(fought.battle!.raid!.badges).toBe(8);
    expect(fought.battle!.enemyTeam[0]!.level).toBe(prev.level);
    // A later badge never changes a fight in progress.
    const later = structuredClone(fought);
    later.badges = badges(20);
    expect(raidDef(content, later.battle!.raid!).hpBoostPercent).toBe(raidDef(content, fought.battle!.raid!).hpBoostPercent);
    // And the same fight with no badges is weaker.
    const bare = gateRun('s2', 'borrowed-team', 0);
    bare.money = 5000;
    expect(enterRaid(content, bare, 'raid-test').battle!.enemyTeam[0]!.level).toBeLessThanOrEqual(prev.level);
  });
});

describe('draft, recruit and combined offers scale with badges', () => {
  const def = content.expeditions.expeditions.find((e) => e.partyMode === 'draft')!;
  const stage = (id: string) => content.species.get(id)!.evolutionStage;
  const avg = (ids: string[]) => ids.reduce((n, id) => n + stage(id), 0) / ids.length;

  it('later badges offer more evolved Pokémon, always enough to fill the offer', () => {
    for (const n of [0, 2, 3, 5, 6, 9, 30]) expect(offerPool(content, def, n, 6).length).toBeGreaterThanOrEqual(6);
    expect(avg(offerPool(content, def, 9, 6))).toBeGreaterThanOrEqual(avg(offerPool(content, def, 0, 6)));
    expect(offerPool(content, def, 9, 6).filter((id) => stage(id) >= 3).length).toBeGreaterThan(0);
  });

  it('a draft offers 6 different Pokémon from that pool and stays stable', () => {
    const mk = (n: number) => {
      const run = gateRun('d1', def.id, n);
      return beginExpedition(content, run, 'gate-test').expedition!.choice!.options.map((o) => o.speciesId!);
    };
    const a = mk(9);
    expect(new Set(a).size).toBe(6);
    expect(mk(9)).toEqual(a);
    for (const id of a) expect(offerPool(content, def, 9, 6)).toContain(id);
  });
});

describe('raid reinforcements and world triggers', () => {
  it('reinforcement lines come only from badges and tier', () => {
    const def = getRaid(content, 'storm-gyarados');
    expect(scaledRaid(content, def, 0).summons).toEqual([]);
    expect(scaledRaid(content, def, 4).summons).toEqual([0.6]);
    expect(scaledRaid(content, def, 8).summons).toEqual([0.6]);
    const t4 = getRaid(content, 'sandstorm-tyranitar');
    expect(scaledRaid(content, t4, 8).summons).toEqual([0.6, 0.3]);
    expect(scaledRaid(content, getRaid(content, 'sleeping-snorlax'), 12).summons).toEqual([]);
    expect(raidDef(content, { id: t4.id, badges: 8 }).summons).toHaveLength(2);
  });

  it('the boss calls a minion at the line; shields and phases wait; the boss returns', () => {
    const run = gateRun('m1', 'borrowed-team', 8);
    run.money = 9999;
    const fought = enterRaid(content, run, 'raid-test');
    const raid = fought.battle!.raid!;
    const boss = fought.battle!.enemyTeam[0]!;
    expect(raid.bossUid).toBe(boss.uid);
    expect(reinforcementDue(content, fought.battle!)).toBeNull();
    boss.hp = Math.floor(maxHp(content, boss) * 0.5);
    const due = reinforcementDue(content, fought.battle!);
    expect(due).not.toBeNull();
    expect(content.species.has(due!.speciesId)).toBe(true);
    // The minion is not shielded and does not move the boss's phases.
    raid.minionUid = due!.uid;
    const minion = { ...boss, uid: due!.uid };
    raid.shieldHp = 50;
    expect(absorbHit(content, fought.battle!, minion, 30)).toBe(30);
    expect(raid.shieldHp).toBe(50);
    expect(takeExtraAction(content, fought.battle!, minion)).toBe(false);
    // Once used, the same line cannot fire again.
    raid.summonsUsed = 1;
    expect(reinforcementDue(content, fought.battle!)).toBeNull();
    expect(RunStateSchema.safeParse(JSON.parse(JSON.stringify(fought))).success).toBe(true);
  });

  it('triggers read the world and never the real clock', () => {
    const base = { story: { flags: {} } as RunState['story'], legendary: undefined, calendar: { today: null, startedOn: null }, regionIndex: 0 };
    expect(activeDenTriggers(content, base)).toEqual([]);
    const busy = { ...base, story: { flags: { 'ev:shadow-activity': 3 } } as unknown as RunState['story'] };
    expect(activeDenTriggers(content, busy).map((t) => t.id)).toContain('shadow-unrest');
    const sat = { ...base, calendar: { today: '2026-11-07', startedOn: null } };
    expect(activeDenTriggers(content, sat).map((t) => t.id)).toEqual(expect.arrayContaining(['weekend-rush', 'harvest-season']));
    const weekday = { ...base, calendar: { today: '2026-11-04', startedOn: null } };
    expect(activeDenTriggers(content, weekday).map((t) => t.id)).not.toContain('weekend-rush');
    expect(triggerChanceBonus(content, activeDenTriggers(content, { ...sat, regionIndex: 3, story: busy.story, legendary: { offered: ['x'], completed: [], failed: [], extracted: [], placed: {}, outcomes: [] } }))).toBeLessThanOrEqual(content.raids.maxTriggerBonus);
  });

  it('a trigger steers the kind of raid, and a den records why it is there', () => {
    const run = { seed: 'tr', regionIndex: 2, badges: badges(20), raids: { entered: 0, won: 0, lost: 0, bestTier: 6, done: [], escaped: [], unlockedTier: 6 } };
    for (let i = 0; i < 10; i++) expect(pickRaidFor(content, run, `k${i}`, 'anomaly').kind).toBe('anomaly');
    let seen = 0;
    for (let i = 0; i < 200 && seen === 0; i++) {
      const r = structuredClone(chooseStarter(content, createRun(content, { runId: 'tr', seed: `trg${i}`, archetypeId: 'red' }), 0));
      r.story.flags['ev:shadow-activity'] = 5;
      placeRaidDens(content, r);
      const den = r.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id.startsWith('raid-') && !s.id.includes('grand'));
      if (den?.triggers) { seen++; expect(den.triggers).toContain('shadow-unrest'); }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('reinforcement in a real turn', () => {
  it('the minion takes the field, and the boss returns when it faints', () => {
    const run = gateRun('m2', 'borrowed-team', 8);
    run.money = 9999;
    const fought = enterRaid(content, run, 'raid-test');
    const boss = fought.battle!.enemyTeam[0]!;
    boss.hp = Math.floor(maxHp(content, boss) * 0.5);
    fought.battle!.raid!.pendingShields = [];
    fought.party[0]!.moves = [{ id: 'splash', pp: 40 }];
    fought.party[0]!.level = 100;
    fought.party[0]!.hp = maxHp(content, fought.party[0]!);
    const res = takeTurn(content, fought, { kind: 'move', index: 0 });
    const b = res.run.battle!;
    expect(b.raid!.summonsUsed).toBe(1);
    expect(currentEnemy(b).uid).toBe(b.raid!.minionUid);
    expect(b.enemyTeam.some((e) => e.uid === boss.uid)).toBe(true);
    // Beat the minion: the boss comes back.
    currentEnemy(b).hp = 1;
    res.run.party[0]!.moves = [{ id: 'tackle', pp: 35 }];
    const next = takeTurn(content, res.run, { kind: 'move', index: 0 });
    if (next.run.battle) expect(currentEnemy(next.run.battle).uid).toBe(boss.uid);
  });
});
