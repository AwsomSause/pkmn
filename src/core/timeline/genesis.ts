// Revisit This Timeline (M13, Kice's spec §4.1 and §4.6): everything needed to rebuild a run exactly as it began,
// kept apart from the run history so a replay can never change the original record.
// Pure: no Phaser, no clock (callers pass `now`), no gameplay RNG of its own.

import type { Content } from '../contentSchema';
import { addItem } from '../items';
import { createRun, type NewRunOptions } from '../run';
import { RUN_RULES } from '../rules';
import type { Profile, RunState } from '../state';
import { seedFrontRunner } from './frontRunner';
import { ReplayRecordSchema, RunGenesisSchema, type ReplayRecord, type ReplayStatus, type RunGenesis, type TimelineOrigin, type TimelineStore } from './schema';

export * from './schema';

/** How many lost runs keep their genesis (the oldest beyond this are dropped; their history entries stay). */
export const GENESIS_KEEP = 20;

type GenesisOptions = Omit<NewRunOptions, 'runId' | 'pastPokemon' | 'rivalArchive' | 'runHistory'>;

/** Captures a freshly created run's genesis. Call right after `createRun` and the start grants, with the same options. */
export function captureGenesis(run: RunState, opts: GenesisOptions, grants: RunGenesis['grants'], now: string): RunGenesis {
  return RunGenesisSchema.parse(structuredClone({
    runId: run.runId,
    seed: opts.seed,
    archetypeId: opts.archetypeId,
    campaignId: opts.campaignId,
    prep: opts.prep,
    rules: opts.rules ? { ...opts.rules, modifierIds: [...opts.rules.modifierIds] } : undefined,
    attributes: opts.attributes,
    mastery: opts.mastery,
    gameEvents: opts.gameEvents ?? [],
    raidTierUnlocked: opts.raidTierUnlocked,
    licenses: opts.licenses ?? [],
    candyPerks: opts.candyPerks ?? [],
    ownedTrainers: [...(opts.ownedTrainers ?? [])],
    legacyRival: run.legacyRival,
    reunion: run.reunion ?? null,
    storyFlags: run.story.flags,
    grants,
    ruleVersion: RUN_RULES.ruleVersion,
    startedAt: now,
  }));
}

/** The note shown when the game's rules changed since the timeline began (the replay may then differ). */
export const genesisNote = (g: RunGenesis): string | null =>
  g.ruleVersion === RUN_RULES.ruleVersion ? null : `This timeline began on rule version ${g.ruleVersion}; the game is now on ${RUN_RULES.ruleVersion}, so it may play out differently.`;

/** Rebuilds the run exactly as it began, under a new id. Same genesis gives the same run, field for field (except ids). */
export function reconstructRun(content: Content, g: RunGenesis, replayId: string, attempt: number): RunState {
  const run = createRun(content, {
    runId: replayId,
    seed: g.seed,
    archetypeId: g.archetypeId,
    campaignId: g.campaignId,
    prep: g.prep ? structuredClone(g.prep) : undefined,
    rules: g.rules,
    attributes: g.attributes,
    mastery: g.mastery,
    gameEvents: g.gameEvents,
    raidTierUnlocked: g.raidTierUnlocked,
    licenses: g.licenses,
    candyPerks: g.candyPerks,
    ownedTrainers: g.ownedTrainers,
  });
  run.legacyRival = structuredClone(g.legacyRival);
  if (g.reunion) run.reunion = structuredClone(g.reunion);
  else delete run.reunion;
  run.story.flags = structuredClone(g.storyFlags) as RunState['story']['flags'];
  run.money += g.grants.money;
  for (const [id, n] of Object.entries(g.grants.items)) addItem(run.inventory, id, n);
  run.timeline = { replayId, originRunId: g.runId, attempt };
  return run;
}

/** Adds a genesis (newest first), replacing any with the same run id, and keeps the newest `GENESIS_KEEP`. */
export function rememberGenesis(store: TimelineStore, g: RunGenesis): TimelineStore {
  return { ...store, genesis: [g, ...store.genesis.filter((x) => x.runId !== g.runId)].slice(0, GENESIS_KEEP) };
}

/** Saves how a lost run ended on its genesis (where you got to, and the rival who becomes the replay's front-runner). */
export function attachOrigin(store: TimelineStore, runId: string, origin: TimelineOrigin): TimelineStore {
  return { ...store, genesis: store.genesis.map((g) => (g.runId === runId ? { ...g, origin: structuredClone(origin) } : g)) };
}

/** Drops the genesis of a run that ended in victory (only lost runs can be revisited). */
export function forgetGenesis(store: TimelineStore, runId: string): TimelineStore {
  return { ...store, genesis: store.genesis.filter((x) => x.runId !== runId) };
}

export const genesisFor = (store: TimelineStore, runId: string): RunGenesis | undefined => store.genesis.find((g) => g.runId === runId);

/** A replay's id: the original run's id plus the attempt number. Never equal to any original run id. */
export const replayIdFor = (originRunId: string, attempt: number): string => `${originRunId}~tl${attempt}`;

export const nextAttempt = (store: TimelineStore, originRunId: string): number =>
  1 + store.replays.filter((r) => r.originRunId === originRunId).reduce((m, r) => Math.max(m, r.attempt), 0);

export const activeReplay = (store: TimelineStore): ReplayRecord | undefined => store.replays.find((r) => r.status === 'active');

/** Why this run can't be revisited right now, or null. */
export function replayProblem(store: TimelineStore, profile: Pick<Profile, 'runHistory'>, originRunId: string): string | null {
  const record = profile.runHistory.find((r) => r.runId === originRunId);
  if (!record) return 'That run is no longer in your history.';
  if (record.victory) return 'Only lost runs can be revisited.';
  if (!genesisFor(store, originRunId)) return 'This run began before timelines were recorded, so it cannot be rebuilt.';
  if (activeReplay(store)) return 'Finish or abandon your current timeline first.';
  return null;
}

/** Starts a replay of a lost run: the rebuilt run plus the False Protagonist layer (the front-runner). Throws when `replayProblem` would say no. */
export function beginReplay(content: Content, store: TimelineStore, profile: Pick<Profile, 'runHistory'>, originRunId: string, now: string): { store: TimelineStore; run: RunState } {
  const problem = replayProblem(store, profile, originRunId);
  if (problem) throw new Error(problem);
  const attempt = nextAttempt(store, originRunId);
  const replayId = replayIdFor(originRunId, attempt);
  const g = genesisFor(store, originRunId)!;
  const run = reconstructRun(content, g, replayId, attempt);
  seedFrontRunner(content, run, g.origin);
  const record = ReplayRecordSchema.parse({ replayId, originRunId, attempt, startedAt: now, status: 'active' });
  return { store: { ...store, replays: [record, ...store.replays] }, run };
}

/** Closes a replay: `finished` when the run ended, `abandoned` when the player walked away. The original run is not touched. */
export function endReplay(store: TimelineStore, run: Pick<RunState, 'timeline' | 'victory' | 'regionsCleared' | 'badges' | 'encountersCompleted'>, status: Exclude<ReplayStatus, 'active'>, now: string, outcome: string | null = null): TimelineStore {
  const id = run.timeline?.replayId;
  if (!id) return store;
  return {
    ...store,
    replays: store.replays.map((r) =>
      r.replayId !== id || r.status !== 'active'
        ? r
        : { ...r, status, endedAt: now, outcome: status === 'finished' ? outcome : null, victory: status === 'finished' && run.victory, regionsCleared: run.regionsCleared.length, badges: run.badges.length, encounters: run.encountersCompleted },
    ),
  };
}
