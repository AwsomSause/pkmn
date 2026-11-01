// Run Journal, Hall of Memories, Memory Lane, Fallen Trainers, Battle Replay, Heirlooms, Ghosts, the Gauntlet,
// Branch Memory and the world's memory (APPROVED.md §3, §7, §8).

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { hatchEgg } from '../../src/core/eggs';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { applyHeirloom, chooseHeirloom, deliverLegacyEgg, legacyEggWaiting, pendingHeirloom, spendHeirloom } from '../../src/core/memories/heirloom';
import { fallenTrainers, hallOfMemories, journalEntry, memoryLane } from '../../src/core/memories/journal';
import { claimPast, pastDigest } from '../../src/core/memories/past';
import { memoryAfterBattle, memoryPick, startPastGauntlet } from '../../src/core/memories/encounters';
import { keepsakeValid, nextKeepsake, recoverKeepsake } from '../../src/core/memories/keepsakes';
import { noteReplayTurn, replayKind, sealReplay, trimReplay, turnLine } from '../../src/core/memories/replay';
import { MEMORIES } from '../../src/core/memories/schema';
import { dueEcho, noteChoice, noteSkips, worldStageStart } from '../../src/core/memories/world';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { LegacyRunSchema, ProfileSchema, type LegacyRun, type Profile, type RunState } from '../../src/core/state';
import type { TrainerPlan } from '../../src/core/encounters';
import { content } from './helpers';
import { GameSession } from '../../src/game/GameSession';
import { MemoryStorageProvider } from '../../src/save/storage';
import { reconstructRun, replayIdFor } from '../../src/core/timeline/genesis';

const NOW = '2026-10-31T05:00:00Z';
const started = (id: string): RunState => structuredClone(chooseStarter(content, createRun(content, { runId: id, seed: id, archetypeId: 'red' }), 0));

/** A finished run with a strong Ace that held an item. */
function finished(id: string, victory = false): RunState {
  const run = started(id);
  run.party[0]!.level = 40;
  run.party[0]!.nature = 'adamant';
  run.party[0]!.held = { everstone: 1 };
  run.party.push(createPokemon(content, 'rattata', 12, `${id}-b`), createPokemon(content, 'pidgey', 12, `${id}-c`));
  run.victory = victory;
  run.encountersCompleted = 20;
  run.log.defeatedBy = victory ? null : { speciesId: 'onix', level: 30, trainer: 'Brock' };
  return run;
}

function profileWith(...ids: [string, boolean][]): Profile {
  let p = createProfile(content, 'p');
  for (const [id, win] of ids) p = finalizeRun(content, p, finished(id, win), NOW).profile;
  return p;
}

const plan = (level = 10): TrainerPlan => ({ classId: 'youngster', name: 'Joey', leaderId: null, ai: 0, members: [{ speciesId: 'rattata', level }, { speciesId: 'pidgey', level }], levelInfo: [] });

describe('memories data', () => {
  it('only names items the game can hand over', () => {
    const ids = [MEMORIES.ghosts.mementoFallback, MEMORIES.gauntlet.item, MEMORIES.heirloom.itemFallback, MEMORIES.world.echoItem, ...MEMORIES.npcs.map((n) => n.item)];
    for (const id of ids) expect(keepsakeValid(content, id), id).toBe(true);
    expect(new Set(MEMORIES.operations.map((o) => o.id)).size).toBe(MEMORIES.operations.length);
  });
});

describe('Run Journal, Hall of Memories, Memory Lane, Fallen Trainers', () => {
  const p = profileWith(['mem-a', false], ['mem-b', true]);
  const [b, a] = p.legacyRuns as [LegacyRun, LegacyRun];

  it('writes a journal entry for each run without any typing', () => {
    const e = journalEntry(content, a);
    expect(e.lines[0]).toMatch(/fell in .* to Brock's Onix/);
    expect(e.lines.some((l) => l.startsWith('Team:'))).toBe(true);
    expect(journalEntry(content, b).lines[0]).toMatch(/became Champion/);
  });

  it('keeps lost runs in the Fallen archive with party, victories and final opponent', () => {
    const fallen = fallenTrainers(content, p.legacyRuns);
    expect(fallen).toHaveLength(1);
    expect(fallen[0]).toMatchObject({ runId: 'mem-a', finalOpponent: "Brock's Onix (Lv 30)" });
    expect(fallen[0]!.team.length).toBe(3);
  });

  it('retells memorable runs and lists the moments on Memory Lane', () => {
    expect(hallOfMemories(content, p.legacyRuns).length).toBeLessThanOrEqual(MEMORIES.hall.size);
    const lane = memoryLane(content, p.legacyRuns);
    expect(lane.length).toBeGreaterThan(0);
    expect(new Set(lane.map((m) => m.id)).size).toBe(lane.length);
  });

  it('loads a profile and a legacy record saved before replays and memories existed', () => {
    const old: Record<string, unknown> = structuredClone(p) as unknown as Record<string, unknown>;
    delete old.memories;
    const parsed = ProfileSchema.parse(old);
    expect(parsed.memories).toEqual({ heirlooms: [], claimed: [], cameos: [] });
    const rec: Record<string, unknown> = structuredClone(a) as unknown as Record<string, unknown>;
    delete rec.replays;
    delete rec.world;
    expect(LegacyRunSchema.parse(rec)).toMatchObject({ replays: [], world: null });
  });
});

describe('Battle Replay', () => {
  function bossFight(): RunState {
    const run = started('rep-a');
    const lead = run.party[0]!;
    const foe = createPokemon(content, 'onix', 14, 'e1');
    run.battle = createBattle('trainer', [foe], 0, lead.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
    return run;
  }

  it('keeps only big battles and writes a short line per turn', () => {
    const run = bossFight();
    expect(replayKind(run.battle!)).toBe('gym');
    const wild = started('rep-b');
    wild.battle = createBattle('wild', [createPokemon(content, 'rattata', 3, 'w1')], 0, wild.party[0]!.uid);
    expect(replayKind(wild.battle)).toBeNull();
    const prior = structuredClone(run.battle!);
    const events = [{ type: 'move', side: 'player', moveId: run.party[0]!.moves[0]!.id }, { type: 'damage', side: 'enemy', amount: 7, hpAfter: 20, effectiveness: 2, crit: false }, { type: 'move', side: 'enemy', moveId: 'tackle' }, { type: 'miss', side: 'enemy' }] as never[];
    noteReplayTurn(content, run, prior, events);
    expect(run.battle!.drama.replay).toHaveLength(1);
    expect(run.battle!.drama.replay![0]).toMatch(/^T1: .* used .* \(-7, super effective\); Onix used Tackle; missed/);
    noteReplayTurn(content, run, prior, [] as never[]);
    expect(run.battle!.drama.replay).toHaveLength(1);
  });

  it('seals a finished fight once and never grows without bound', () => {
    const run = bossFight();
    run.battle!.outcome = 'win';
    run.battle!.participants = [run.party[0]!.uid];
    run.battle!.drama.replay = ['T1: a', 'T2: b'];
    const r = sealReplay(content, run)!;
    expect(r).toMatchObject({ kind: 'gym', outcome: 'win', foe: { name: 'Brock', team: ['onix'] }, lines: ['T1: a', 'T2: b'] });
    expect(sealReplay(content, run)).toBeNull();
    expect(run.story.replays).toHaveLength(1);
    const long = Array.from({ length: 100 }, (_, i) => `T${i}`);
    const trimmed = trimReplay(long, 20);
    expect(trimmed).toHaveLength(20);
    expect(trimmed).toContain('…');
    expect(trimmed[trimmed.length - 1]).toBe('T99');
    expect(turnLine(content, run, run.battle!, run.battle!, [])).toBeNull();
  });

  it('is written onto the legacy record when the run ends', () => {
    const run = bossFight();
    run.battle!.outcome = 'lose';
    run.battle!.participants = [run.party[0]!.uid];
    sealReplay(content, run);
    run.battle = null;
    const { profile } = finalizeRun(content, createProfile(content, 'p'), run, NOW);
    expect(profile.legacyRuns[0]!.replays).toHaveLength(1);
    expect(profile.legacyRuns[0]!.replays[0]!.outcome).toBe('lose');
  });
});

describe('Legacy heirlooms and descendants', () => {
  it('offers a choice when an Ace of level 20+ leaves, and nothing for a weak one', () => {
    const p = profileWith(['hl-a', false]);
    const h = p.memories.heirlooms[0]!;
    expect(h.runId).toBe('hl-a');
    expect(h.options.map((o) => o.id)).toEqual(expect.arrayContaining(['egg', 'move', 'trait', 'item']));
    const weak = finalizeRun(content, createProfile(content, 'q'), started('hl-w'), NOW).profile;
    expect(weak.memories.heirlooms).toEqual([]);
  });

  it('hands a Legacy Egg over once, and the descendant keeps the lineage, move and nature', () => {
    let p = profileWith(['hl-b', false]);
    const h = p.memories.heirlooms[0]!;
    expect(pendingHeirloom(p)).toBeNull();
    const moveOpt = h.options.find((o) => o.id === 'move')!;
    p = chooseHeirloom(p, 'hl-b', 'move');
    const run = started('hl-next');
    const given = applyHeirloom(content, run, p)!;
    expect(given.runId).toBe('hl-b');
    // F118: the egg waits for a Daycare or Ranch; nothing is laid at the start.
    expect(run.eggs).toHaveLength(0);
    expect(legacyEggWaiting(run)).toBe(true);
    expect(deliverLegacyEgg(content, run)).toContain('Legacy Egg joined');
    expect(deliverLegacyEgg(content, run)).toBeNull();
    expect(legacyEggWaiting(run)).toBe(false);
    expect(run.eggs).toHaveLength(1);
    expect(run.eggs[0]!.lineage).toMatchObject({ runId: 'hl-b', moveId: moveOpt.moveId });
    const mon = hatchEgg(content, run, run.eggs[0]!);
    expect(mon.lineage?.runId).toBe('hl-b');
    expect(mon.moves.some((m) => m.id === moveOpt.moveId)).toBe(true);
    p = spendHeirloom(p, 'hl-b');
    expect(pendingHeirloom(p)).toBeNull();
    expect(applyHeirloom(content, started('hl-again'), p)).toBeNull();
    // A nature heirloom limits itself to the ancestor's nature.
    const t = chooseHeirloom(profileWith(['hl-c', false]), 'hl-c', 'trait');
    const run2 = started('hl-next2');
    applyHeirloom(content, run2, t);
    deliverLegacyEgg(content, run2);
    expect(hatchEgg(content, run2, run2.eggs[0]!).nature).toBe('adamant');
    // A keepsake joins the bag instead.
    const k = chooseHeirloom(profileWith(['hl-d', false]), 'hl-d', 'item');
    const run3 = started('hl-next3');
    applyHeirloom(content, run3, k);
    expect(run3.party[0]!.held?.everstone).toBe(1);
    expect(run3.eggs).toHaveLength(0);
  });
});

describe('Ghosts, the Previous-Run Gauntlet, keepsakes and old friends', () => {
  const p = profileWith(['gh-a', false], ['gh-b', false], ['gh-c', true]);

  it('picks the digest from records without rolling and is stable', () => {
    const d = pastDigest(content, p);
    expect(d).toEqual(pastDigest(content, structuredClone(p)));
    expect(d.ghosts.map((g) => g.runId)).toEqual(['gh-b', 'gh-a']);
    expect(d.gauntlet.length).toBeGreaterThanOrEqual(2);
    expect(d.keepsakes[0]).toMatchObject({ itemId: 'everstone' });
    expect(pastDigest(content, { ...p, memories: { heirlooms: [], claimed: ['ghost:gh-b'], cameos: [] } }).ghosts.map((g) => g.runId)).toEqual(['gh-a']);
  });

  it('a Ghost takes the trainer slot with its own team, pays when beaten, and is laid to rest in the profile', () => {
    const saved = MEMORIES.ghosts.chance;
    MEMORIES.ghosts.chance = 1;
    try {
      const run = started('gh-next');
      run.past = pastDigest(content, p);
      run.encountersCompleted = 10;
      run.stage = { ...(run.stage ?? ({} as never)) } as never;
      const hit = memoryPick(content, run, plan(12))!;
      expect(hit.memory.kind).toBe('ghost');
      expect(hit.plan.name).toMatch(/^Ghost of /);
      expect(hit.plan.members.length).toBeGreaterThanOrEqual(2);
      expect(hit.memory.note).toMatch(/Brock's Onix/);
      // One memory a stage.
      expect(memoryPick(content, run, plan(12))).toBeNull();
      run.battle = createBattle('trainer', hit.plan.members.map((m, i) => createPokemon(content, m.speciesId, m.level, `g${i}`)), 0, run.party[0]!.uid, { classId: hit.plan.classId, name: hit.plan.name, leaderId: null });
      run.battle.memory = hit.memory;
      run.battle.outcome = 'win';
      const money = run.money;
      memoryAfterBattle(content, run);
      memoryAfterBattle(content, run);
      expect(run.money).toBe(money + 13 * MEMORIES.ghosts.moneyPerLevel);
      expect(run.past.used).toEqual([`ghost:${hit.memory.id}`]);
      const done = finalizeRun(content, p, run, NOW).profile;
      expect(done.memories.claimed).toContain(`ghost:${hit.memory.id}`);
      expect(pastDigest(content, done).ghosts.map((g) => g.runId)).not.toContain(hit.memory.id);
    } finally {
      MEMORIES.ghosts.chance = saved;
    }
  });

  it('the Gauntlet sends one past team per stage and pays at the end', () => {
    const run = started('gt-next');
    run.past = pastDigest(content, p);
    expect(startPastGauntlet(content, run, 2)).toBe(2);
    const first = memoryPick(content, run, plan())!;
    expect(first.memory.kind).toBe('gauntlet');
    expect(first.plan.name).toMatch(/old team/);
    const fight = (hit: NonNullable<ReturnType<typeof memoryPick>>) => {
      run.battle = createBattle('trainer', hit.plan.members.map((m, i) => createPokemon(content, m.speciesId, m.level, `t${i}`)), 0, run.party[0]!.uid, { classId: 'youngster', name: 'x', leaderId: null });
      run.battle.memory = hit.memory;
      run.battle.outcome = 'win';
      memoryAfterBattle(content, run);
    };
    const money = run.money;
    fight(first);
    expect(run.money).toBe(money);
    run.stage!.index += 1;
    const second = memoryPick(content, run, plan())!;
    expect(second.memory.id).not.toBe(first.memory.id);
    fight(second);
    expect(run.money).toBe(money + MEMORIES.gauntlet.money);
    expect(run.inventory[MEMORIES.gauntlet.item]).toBe(MEMORIES.gauntlet.itemCount);
  });

  it('recovers a keepsake once with its history, and keeps it recovered', () => {
    const run = started('kp-next');
    run.past = pastDigest(content, p);
    const k = nextKeepsake(run)!;
    expect(recoverKeepsake(content, run)).toContain(k.line);
    expect(run.party[0]!.held?.[k.itemId]).toBe(1);
    expect(nextKeepsake(run)?.id).not.toBe(k.id);
    claimPast(p as Profile, run);
  });
});

describe('the persistent world', () => {
  function atStage(id: string, region: number, stage: number): RunState {
    const run = started(id);
    run.regionIndex = region;
    run.stage!.index = stage;
    return run;
  }

  it('remembers a skipped side stop and sends an Echo that pays when beaten', () => {
    const run = atStage('wd-a', 0, 0);
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'skip', kind: 'minigame', minigameId: 'x', used: false });
    run.stage!.visited = [node.id];
    noteSkips(content, run);
    expect(run.story.world.skipped).toHaveLength(1);
    expect(dueEcho(run)).toBeNull();
    run.stage!.index = 2;
    const echo = dueEcho(run)!;
    expect(echo.text).toMatch(/minigame stop/);
    const hit = memoryPick(content, run, plan(10))!;
    expect(hit.memory.kind).toBe('echo');
    expect(hit.plan.members[0]!.level).toBe(10 + MEMORIES.world.echoLevelBonus);
    expect(dueEcho(run)).toBeNull();
  });

  it('kindness comes back as thanks, cruelty as a toll, and delay is respected', () => {
    const run = atStage('wd-b', 0, 0);
    run.money = 1000;
    noteChoice(content, run, 'Lost Pikachu', [{ kind: 'attribute', key: 'goodEvil', amount: 10 }], false);
    noteChoice(content, run, 'Stolen Purse', [{ kind: 'attribute', key: 'goodEvil', amount: -10 }], false);
    expect(run.story.world.helped).toBe(1);
    worldStageStart(content, run);
    expect(run.money).toBe(1000);
    run.stage!.index = 2;
    worldStageStart(content, run);
    expect(run.money).toBe(1000 + MEMORIES.world.thanksMoney - MEMORIES.world.grudgeMoney);
    run.stage!.index = 3;
    const after = run.money;
    worldStageStart(content, run);
    expect(run.money).toBe(after);
  });

  it('a villain operation runs three stages and is foiled by clues, or succeeds without them', () => {
    const play = (id: string, clues: number) => {
      const saved = MEMORIES.ops.start;
      MEMORIES.ops.start = 1;
      try {
        const run = atStage(id, 1, 0);
        run.money = 2000;
        worldStageStart(content, run);
        const [opId, op] = Object.entries(run.story.world.ops)[0]!;
        expect(op.step).toBe(1);
        for (let i = 0; i < clues; i++) noteChoice(content, run, 'Clue', [{ kind: 'item' }], false);
        for (let s = 1; s <= 3; s++) {
          run.stage!.index = s;
          worldStageStart(content, run);
        }
        return { run, opId };
      } finally {
        MEMORIES.ops.start = saved;
      }
    };
    const foiled = play('op-a', MEMORIES.ops.clues);
    expect(foiled.run.story.world.ops[foiled.opId]!.outcome).toBe('foiled');
    expect(foiled.run.money).toBeGreaterThanOrEqual(2000 + MEMORIES.ops.reward - 600);
    const lost = play('op-b', 0);
    expect(lost.run.story.world.ops[lost.opId]!.outcome).toBe('succeeded');
    expect(lost.run.money).toBeLessThan(2000);
  });

  it('an old friend from an earlier run turns up once and says so', () => {
    const p = profileWith(['cm-a', false]);
    const rec = structuredClone(p.legacyRuns[0]!) as unknown as { rivals: unknown[] };
    rec.rivals = [{ id: 'rv1', name: 'Blue', classId: 'rival', archetype: 'x', state: 'x', encounters: 3, setbacks: 0, lastResult: 'win', resolution: null, team: ['eevee'], rank: null, world: null, narrativeWins: 0 }];
    const withRival: Profile = { ...p, legacyRuns: [LegacyRunSchema.parse(rec)] };
    const saved = MEMORIES.cameo.chance;
    MEMORIES.cameo.chance = 1;
    try {
      const run = atStage('cm-next', 0, 1);
      run.past = pastDigest(content, withRival);
      expect(run.past.friends.map((f) => f.name)).toEqual(['Blue']);
      const money = run.money;
      worldStageStart(content, run);
      expect(run.money).toBeGreaterThanOrEqual(money + MEMORIES.cameo.money);
      expect(run.past.used).toEqual(['friend:cm-a:rv1']);
      run.stage!.index = 1;
      worldStageStart(content, run);
      expect(run.past.used).toHaveLength(1);
    } finally {
      MEMORIES.cameo.chance = saved;
    }
  });

  it('is the same for the same seed and actions', () => {
    const a = atStage('wd-same', 1, 0);
    const b = structuredClone(a);
    for (const run of [a, b]) {
      worldStageStart(content, run);
      run.stage!.index = 1;
      worldStageStart(content, run);
    }
    expect(a.story.world).toEqual(b.story.world);
    expect(a.money).toBe(b.money);
  });
});

describe('a new run and Revisit This Timeline', () => {
  it('a rebuilt run meets the same past (digest and heirloom) as the original', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    session.changeProfile(() => chooseHeirloom(profileWith(['rv-a', false], ['rv-b', false]), 'rv-b', 'egg'));
    const original = structuredClone(session.newRun('red', 'rv-seed'));
    expect(original.past!.ghosts.length).toBe(2);
    expect(original.eggs).toHaveLength(0);
    expect(original.past?.legacyEgg).toBeTruthy();
    expect(session.profile.memories.heirlooms.find((h) => h.runId === 'rv-b')!.spent).toBe(true);
    const g = session.timeline.genesis[0]!;
    const replay = reconstructRun(content, g, replayIdFor(g.runId, 1), 1);
    expect(replay.past).toEqual(original.past);
    expect(replay.eggs).toEqual(original.eggs);
    expect(replay.past?.legacyEgg).toEqual(original.past?.legacyEgg);
  });
});
