import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { gameplayFingerprint, step } from './autoplay';
import { createPokemon } from '../../src/core/pokemon';
import { nextChoices } from '../../src/core/map';
import type { RunState } from '../../src/core/state';
import { beginReplay, captureGenesis, emptyTimelineStore, endReplay, GENESIS_KEEP, nextAttempt, reconstructRun, rememberGenesis, replayIdFor, replayProblem, startingData, type RunGenesis } from '../../src/core/timeline/genesis';
import { frontRunner, frontRunnerIntro, FRONT_RUNNER_ID, isFalseProtagonist, onFrontRunnerBattle, timelineOutcome } from '../../src/core/timeline/frontRunner';
import { protagonistTitle } from '../../src/core/rivals/recognition';
import { GameSession } from '../../src/game/GameSession';
import { MemoryStorageProvider } from '../../src/save/storage';

/** Starts a run and loses it in the first battle. Returns the lost run's id. */
function loseRun(session: GameSession, seed: string): string {
  session.newRun('red', seed);
  const id = session.run!.runId;
  session.chooseStarter(0);
  loseBattle(session);
  return id;
}

function loseBattle(session: GameSession): void {
  session.chooseNode(nextChoices(session.run!.stage!).find((n) => !n.harder)!.id);
  session.run!.party[0]!.hp = 1;
  session.run!.battle!.enemyTeam = [createPokemon(content, 'growlithe', 60, 'e-big')];
  let guard = 0;
  while (session.run!.phase === 'battle' && guard++ < 50) session.takeTurn({ kind: 'move', index: session.run!.party[0]!.moves.findIndex((m) => m.pp > 0) });
  expect(session.run!.phase).toBe('over');
}

const playSteps = (run: RunState, n: number): RunState => {
  for (let i = 0; i < n && run.phase !== 'over'; i++) run = step(content, run, true).run;
  return run;
};

describe('timeline genesis (normal)', () => {
  it('a new run records its genesis, and rebuilding it gives the same run under a new id', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const original = structuredClone(session.newRun('red', 'genesis-seed'));
    const g = session.timeline.genesis[0]!;
    expect(g.runId).toBe(original.runId);
    const replay = reconstructRun(content, g, replayIdFor(g.runId, 1), 1);
    expect(replay.runId).toBe(`${original.runId}~tl1`);
    expect(replay.timeline).toEqual({ replayId: replay.runId, originRunId: original.runId, attempt: 1 });
    // `calendar` is today's real date, given by the host, not part of what a run is built from.
    const { runId: _a, timeline: _t, calendar: _ca, ...rest } = replay;
    const { runId: _b, calendar: _cb, ...orig } = original;
    expect(rest).toEqual(orig);
  });

  it('the same actions on the original and the rebuilt run give the same rolls (determinism)', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const original = structuredClone(session.newRun('blue', 'determinism-seed'));
    const replay = reconstructRun(content, session.timeline.genesis[0]!, 'r', 1);
    expect(gameplayFingerprint(playSteps(replay, 120))).toBe(gameplayFingerprint(playSteps(original, 120)));
  });

  it('archive picks (legacy rival, reunion, champion team) are kept as results, not re-rolled from a changed profile', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const run = session.newRun('red', 'archive-seed');
    run.story.flags['championDefenseTeam'] = 'pikachu:50';
    const g = captureGenesis(run, { seed: run.seed, archetypeId: 'red' }, { money: 7, items: {} }, '2026-10-31T00:00:00Z');
    const rebuilt = reconstructRun(content, g, 'r', 1);
    expect(rebuilt.story.flags['championDefenseTeam']).toBe('pikachu:50');
    expect(rebuilt.money).toBe(run.money + 7);
  });
});

describe('timeline replays through the session (normal)', () => {
  it('a lost run can be revisited; the replay saves in its own slot and never changes the profile or the original record', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    const lost = loseRun(session, 'lost-seed');
    const record = structuredClone(session.profile.runHistory.find((r) => r.runId === lost)!);
    expect(session.replayProblem(lost)).toBeNull();

    session.newRun('green', 'normal-alongside'); // a normal run can live beside the replay
    const profileBefore = storage.get('pkr.profile');
    const normalSave = storage.get('pkr.run');
    const replay = session.startReplay(lost);
    expect(replay.runId).toBe(`${lost}~tl1`);
    expect(session.inReplay).toBe(true);
    expect(storage.get('pkr.replay')).not.toBeNull();
    session.chooseStarter(0);
    expect(storage.get('pkr.run')).toBe(normalSave);

    loseBattle(session);
    expect(storage.get('pkr.replay')).toBeNull();
    expect(storage.get('pkr.profile')).toBe(profileBefore);
    expect(session.profile.runHistory.find((r) => r.runId === lost)).toEqual(record);
    expect(session.timeline.replays[0]).toMatchObject({ replayId: `${lost}~tl1`, status: 'finished', victory: false });
    expect(session.lastRunSummary).toBeNull();
    // The same timeline can be revisited again, under the next id.
    expect(nextAttempt(session.timeline, lost)).toBe(2);
  });

  it('a replay survives a reload and continues where it was left', () => {
    const storage = new MemoryStorageProvider();
    const a = new GameSession(content, storage);
    const lost = loseRun(a, 'reload-seed');
    a.startReplay(lost);
    a.chooseStarter(1);
    const b = new GameSession(content, storage);
    expect(b.canContinueReplay).toBe(true);
    expect(b.canContinue).toBe(false);
    const run = b.continueReplay();
    expect(run.timeline?.originRunId).toBe(lost);
    expect(run.party[0]!.speciesId).toBe(a.run!.party[0]!.speciesId);
  });

  it('abandoning a replay frees the slot and leaves the profile and the original exactly as they were', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    const lost = loseRun(session, 'abandon-seed');
    const profileBefore = storage.get('pkr.profile');
    session.startReplay(lost);
    session.chooseStarter(0);
    session.abandonReplay();
    expect(session.run).toBeNull();
    expect(storage.get('pkr.replay')).toBeNull();
    expect(storage.get('pkr.profile')).toBe(profileBefore);
    expect(session.timeline.replays[0]!.status).toBe('abandoned');
    expect(session.replayProblem(lost)).toBeNull();
    expect(session.startReplay(lost).runId).toBe(`${lost}~tl2`);
  });
});

describe('timeline replays (boundary)', () => {
  it('keeps only the newest genesis entries', () => {
    let store = emptyTimelineStore();
    const g = (i: number) => ({ runId: `run-${i}` }) as RunGenesis;
    for (let i = 0; i < GENESIS_KEEP + 5; i++) store = rememberGenesis(store, g(i));
    expect(store.genesis).toHaveLength(GENESIS_KEEP);
    expect(store.genesis[0]!.runId).toBe(`run-${GENESIS_KEEP + 4}`);
  });

  it('a won run drops its genesis (only lost runs can be revisited)', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    session.newRun('red', 'win-seed');
    const id = session.run!.runId;
    session.run!.victory = true;
    session.run!.phase = 'over';
    session.finishRun();
    expect(session.timeline.genesis.some((g) => g.runId === id)).toBe(false);
  });

  it('ending a replay twice changes nothing the second time', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const lost = loseRun(session, 'twice-seed');
    const { store, run } = beginReplay(content, session.timeline, session.profile, lost, 'now');
    const once = endReplay(store, run, 'finished', 'later');
    expect(endReplay(once, run, 'abandoned', 'much later')).toEqual(once);
  });
});

describe('timeline replays (failure)', () => {
  it('refuses runs that were won, are missing, began before genesis, or while another replay is active', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const lost = loseRun(session, 'refuse-seed');
    expect(replayProblem(session.timeline, session.profile, 'nope')).toMatch(/no longer/);
    const won = { ...session.profile, runHistory: session.profile.runHistory.map((r) => ({ ...r, victory: true })), legacyRuns: session.profile.legacyRuns.map((r) => ({ ...r, outcome: 'victory' as const })) };
    expect(replayProblem(session.timeline, won, lost)).toMatch(/Only lost/);
    expect(replayProblem(emptyTimelineStore(), { ...session.profile, legacyRuns: [] }, lost)).toMatch(/before timelines/);
    // Once the run ended, its starting data lives on its legacy record, not in the timeline store.
    expect(session.timeline.genesis.some((g) => g.runId === lost)).toBe(false);
    expect(startingData(emptyTimelineStore(), session.profile, lost)?.runId).toBe(lost);
    session.startReplay(lost);
    expect(session.replayProblem(lost)).toMatch(/Finish or abandon/);
    expect(() => session.startReplay(lost)).toThrow();
  });

  it('a damaged timeline store is backed up and replaced, and the profile still loads', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.timeline', '{not json');
    const session = new GameSession(content, storage);
    expect(session.timeline).toEqual(emptyTimelineStore());
    expect(session.warnings.some((w) => w.includes('Timeline data'))).toBe(true);
  });

  it('the replay slot refuses a normal run, and a damaged replay can still be abandoned', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    const normal = session.newRun('red', 'slot-seed');
    expect(session.saves.saveReplay(normal).ok).toBe(false);
    const lost = loseRun(session, 'damaged-seed');
    session.startReplay(lost);
    session.closeRun();
    storage.set('pkr.replay', '{broken');
    const fresh = new GameSession(content, storage);
    expect(fresh.canContinueReplay).toBe(false);
    fresh.abandonReplay();
    expect(fresh.timeline.replays[0]!.status).toBe('abandoned');
    expect(fresh.replayProblem(lost)).toBeNull();
  });
});

describe('the False Protagonist (front-runner and outcomes)', () => {
  const ctx = () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const lost = loseRun(session, 'fp-seed');
    return { session, lost, run: session.startReplay(lost) };
  };

  it('a lost run keeps its origin, and the replay starts with its rival ahead as a Gym Leader', () => {
    const { session, lost, run } = ctx();
    const origin = startingData(session.timeline, session.profile, lost)!.origin;
    expect(origin).toMatchObject({ badges: 0, encounters: 0 });
    expect(origin!.rival).not.toBeNull();
    expect(isFalseProtagonist(run)).toBe(true);
    const fr = frontRunner(run)!;
    expect(fr).toMatchObject({ id: FRONT_RUNNER_ID, rank: 'gymLeader', state: 'contender', name: origin!.rival!.name });
    expect(run.story.events.some((e) => e.data['def'] === 'timeline-start')).toBe(true);
    expect(frontRunnerIntro(content, fr)).toContain(fr.name);
  });

  it('the front-runner stands in for the first Gym Leader you reach', () => {
    const { session } = ctx();
    session.chooseStarter(0);
    let guard = 0;
    while (guard++ < 400 && session.run!.phase !== 'over' && session.run!.battle?.rivalId !== FRONT_RUNNER_ID) {
      session.run!.party.forEach((m) => { m.level = 100; m.hp = 999; });
      session.run = step(content, session.run!, true).run;
    }
    expect(session.run!.battle?.rivalId).toBe(FRONT_RUNNER_ID);
    expect(session.run!.battle?.rivalNote).toMatch(/finally decided to show up/);
  });

  it('beating it climbs it a rank; the outcomes follow the flags, best first', () => {
    const { run } = ctx();
    const enemy = [createPokemon(content, 'pikachu', 30, 'e1')];
    expect(timelineOutcome(content, run).id).toBe('forgotten');
    run.victory = true;
    expect(timelineOutcome(content, run).id).toBe('second-place');
    onFrontRunnerBattle(content, run, { rivalId: FRONT_RUNNER_ID, enemyTeam: enemy }, 'win');
    expect(frontRunner(run)!.rank).toBe('finalist');
    expect(timelineOutcome(content, run).id).toBe('catch-up');
    onFrontRunnerBattle(content, run, { rivalId: FRONT_RUNNER_ID, enemyTeam: enemy }, 'win');
    expect(frontRunner(run)!.rank).toBe('champion');
    run.party = [createPokemon(content, 'charizard', 60, 'p1'), createPokemon(content, 'blastoise', 60, 'p2')];
    onFrontRunnerBattle(content, run, { rivalId: FRONT_RUNNER_ID, enemyTeam: enemy }, 'win');
    expect(timelineOutcome(content, run)).toMatchObject({ id: 'usurper', name: 'The Usurper' });
  });

  it('a Champion win with one Pokémon standing is an Impossible Victory, and the finished replay records it', () => {
    const { session, run } = ctx();
    const fr = frontRunner(run)!;
    fr.rank = 'champion';
    run.party = [createPokemon(content, 'pidgey', 20, 'p1')];
    onFrontRunnerBattle(content, run, { rivalId: FRONT_RUNNER_ID, enemyTeam: [createPokemon(content, 'mewtwo', 70, 'e1')] }, 'win');
    expect(timelineOutcome(content, run).id).toBe('impossible-victory');
    run.phase = 'over';
    session.finishRun();
    expect(session.timeline.replays[0]).toMatchObject({ status: 'finished', outcome: 'impossible-victory' });
  });

  it('ignores battles with anyone else, and losses (boundary)', () => {
    const { run } = ctx();
    onFrontRunnerBattle(content, run, { rivalId: 'rival-x', enemyTeam: [] }, 'win');
    onFrontRunnerBattle(content, run, { rivalId: FRONT_RUNNER_ID, enemyTeam: [] }, 'lose');
    expect(frontRunner(run)!.rank).toBe('gymLeader');
    expect(timelineOutcome(content, run).id).toBe('forgotten');
  });

  it('a normal run is never a False Protagonist; a replay switches on the recognition title and sets the rival\'s pace', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const run = session.newRun('red', 'plain-seed');
    expect(isFalseProtagonist(run)).toBe(false);
    expect(protagonistTitle(run).id).not.toBe('falseProtagonist');
    const { run: replay } = ctx();
    expect(protagonistTitle(replay).id).toBe('falseProtagonist');
    expect(frontRunner(replay)!.world?.lead).toBeGreaterThan(0);
  });

  it('an old genesis without an origin still gets a front-runner from the seed (failure fallback)', () => {
    const session = new GameSession(content, new MemoryStorageProvider());
    const lost = loseRun(session, 'no-origin-seed');
    session.timeline = { ...session.timeline, genesis: session.timeline.genesis.map((g) => ({ ...g, origin: null })) };
    expect(frontRunner(session.startReplay(lost))?.rank).toBe('gymLeader');
  });
});
