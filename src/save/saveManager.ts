// Versioned save records: profile (permanent), run (current run), settings,
// and metadata. Every record is wrapped in an envelope with a schema version,
// checked against its schema on load, and migrated if it is older.

import type { z } from 'zod';
import { ATTRIBUTE_KEYS, type Content } from '../core/contentSchema';
import { validateLeagueMap, validateStageMap } from '../core/map';
import { createProfile } from '../core/profile';
import { hashSeed } from '../core/rng';
import { createStoryState } from '../core/story/record';
import { legacyRunFromHistory } from '../core/legacyRuns';
import {
  ProfileSchema,
  RunRecordSchema,
  RunStateSchema,
  SettingsSchema,
  type Profile,
  type RunState,
  type Settings,
} from '../core/state';
import { emptyTimelineStore, TimelineStoreSchema, type TimelineStore } from '../core/timeline/schema';
import { StorageUnavailableError, type StorageProvider } from './storage';

export const SAVE_FORMAT = 'pkmn-roguelike';
export const KEY_PREFIX = 'pkr';

export type RecordName = 'profile' | 'run' | 'settings' | 'meta' | 'timeline';

/** Current schema version of each record. Bump when a record's shape changes and add a migration. */
export const CURRENT_VERSIONS: Record<RecordName, number> = { profile: 14, run: 26, settings: 9, meta: 1, timeline: 1 };

/** Migrations upgrade a record from version N to N+1. */
type Migration = (data: unknown) => unknown;
type Json = Record<string, unknown>;

function zeroAttributes(): Record<string, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0]));
}

export const MIGRATIONS: Record<RecordName, Record<number, Migration>> = {
  profile: {
    // v2 (Milestone 2): candies, the permanent currency.
    1: (data) => ({ ...(data as Json), candies: 0 }),
    // v3 (Milestone 5): the Bank (Bank Credits), Research Points, counters,
    // discoveries, achievements, titles and the Run History.
    2: (data) => {
      const { bankCurrency, ...profile } = data as Json;
      return {
        ...profile,
        bankCredits: typeof bankCurrency === 'number' ? bankCurrency : 0,
        researchPoints: 0,
        counters: {},
        best: {},
        speciesSeen: [],
        speciesCaught: [],
        achievements: {},
        titles: [],
        activeTitle: null,
        lifetimeBankCredits: 0,
        runHistory: [],
        lastPayout: null,
      };
    },
    // v4 (Milestone 5.5): Starter Laboratory pools, Bank licenses and loadout presets.
    3: (data) => ({ ...(data as Json), unlockedPools: [], licenses: [], presets: [], lastPrep: null }),
    // v5 (Milestone 7): attributes become six plain values and two meters
    // (D9). Nothing could raise them before, so they start from zero and are
    // worked out again from the counters when the next run ends.
    4: (data) => ({ ...(data as Json), attributes: zeroAttributes() }),
    // v6 (Milestone 8.9-0): each Run History entry keeps its top story
    // moments. Runs before the story layer have none.
    5: (data) => {
      const profile = data as Json;
      return { ...profile, runHistory: ((profile.runHistory as Json[]) ?? []).map((r) => ({ ...r, moments: [] })) };
    },
    // v7 (M8.9 slice 5): the archive of past runs' Pokémon. Runs before it kept none.
    6: (data) => ({ ...(data as Json), pastPokemon: [] }),
    // v8 (trainer quests): the claim ledger and per-trainer counters start empty.
    7: (data) => ({ ...(data as Json), claims: {}, trainerCounters: {}, trainerBest: {} }),
    // v9 (species mastery): no species has mastery counters yet.
    8: (data) => ({ ...(data as Json), mastery: {} }),
    // v10 (game events): no weekly or holiday event progress yet.
    9: (data) => ({ ...(data as Json), gameEvents: {} }),
    // v11 (wardrobe, Research Directive): the classic card frame; saved loadouts have no directive.
    10: (data) => {
      const d = data as Json & { lastPrep?: Json | null; presets?: (Json | null)[] };
      const withDirective = (p: Json | null | undefined) => (p ? { ...p, directive: null } : p ?? null);
      return { ...d, cardFrame: 'classic', lastPrep: withDirective(d.lastPrep), presets: (d.presets ?? []).map(withDirective) };
    },
    // v12 (Hall of Fame): Run History entries keep the run's epitaph and Legacy Cards,
    // and whether each party Pokémon was shiny. Older runs kept none of these.
    11: (data) => {
      const profile = data as Json;
      return {
        ...profile,
        runHistory: ((profile.runHistory as Json[]) ?? []).map((r) => ({
          ...r,
          party: ((r.party as Json[]) ?? []).map((m) => ({ ...m, shiny: false })),
          epitaph: null,
          legacy: [],
        })),
      };
    },
    // v13 (Hyper moment codex): older profiles have seen no moments yet.
    12: (data) => ({ ...(data as Json), momentCodex: {} }),
    // v14 (legacy runs, M9): each older Run History entry becomes a thin legacy record (source "history").
    13: (data) => {
      const profile = data as Json;
      const history = Array.isArray(profile.runHistory) ? (profile.runHistory as Json[]) : [];
      return { ...profile, legacyRuns: history.flatMap((r) => { const parsed = RunRecordSchema.safeParse(r); return parsed.success ? [legacyRunFromHistory(parsed.data)] : []; }) };
    },
  },
  run: {
    // v2 (Milestone 2): Bag, candies, pending decisions, and battles against
    // a team (trainer battles) instead of a single wild Pokémon.
    1: (data) => {
      const run = data as Json;
      let battle = run.battle as Json | null;
      if (battle) {
        const { enemy, ...rest } = battle;
        battle = { ...rest, kind: 'wild', enemyTeam: [enemy], enemyIndex: 0, trainer: null, needsSwitch: false, lastStandUsed: false };
      }
      return { ...run, battle, inventory: {}, candies: 0, pending: [], afterDecisions: 'reward' };
    },
    // v3 (Milestone 3): stage maps and themes. An older run gets its first
    // stage map the next time it returns to the map.
    2: (data) => {
      const run = data as Json;
      return {
        ...run,
        afterDecisions: run.afterDecisions === 'battle' ? 'map' : run.afterDecisions,
        stage: null,
        usedThemes: [],
        usedLeaders: [],
        badges: [],
      };
    },
    // v4 (Milestone 4): regions and the campaign. An older run is treated as
    // the first region of a full campaign; it gets its shuffled region order
    // when it is next loaded (that needs the game data and the run's RNG).
    3: (data) => ({ ...(data as Json), campaignId: 'full', regionOrder: [], regionIndex: 0, regionsCleared: [], victory: false }),
    // v5 (Milestone 5): the run counts things for achievements and discoveries.
    // An older run starts counting from now.
    4: (data) => {
      const run = data as Json;
      const log = run.log as Json;
      return { ...run, log: { ...log, counters: {}, speciesSeen: [], speciesCaught: [], charmUsedInRegion: false, defeatedBy: null } };
    },
    // v6 (Milestone 5.5): how the run was prepared. An older run was a full or
    // dev campaign with the classic pool, the standard draft and no preparation.
    5: (data) => {
      const run = data as Json;
      const campaignId = typeof run.campaignId === 'string' ? run.campaignId : 'full';
      return { ...run, prep: { campaignId, poolId: 'classic', draftRuleId: 'standard', typeFocus: null, tokenId: null, note: null } };
    },
    // v7 (Milestone 7): attributes. An older run starts with no attributes;
    // its starter is the first Pokémon it was given (uid "p1"), if still there.
    6: (data) => {
      const run = data as Json;
      const battle = run.battle as Json | null;
      const party = (run.party as Json[]) ?? [];
      const log = run.log as Json;
      return {
        ...run,
        baseAttributes: zeroAttributes(),
        attributeModifiers: zeroAttributes(),
        battle: battle ? { ...battle, enduredUids: [] } : null,
        log: { ...log, starterUid: party.some((m) => m.uid === 'p1') ? 'p1' : null },
      };
    },
    // v8 (Milestone 8.75 part B): friendship. Every Pokémon in an older run
    // starts at 70 (the base value when this was added); its starter at 120.
    7: (data) => {
      const run = data as Json;
      const base = 70;
      const starter = 120;
      const log = run.log as Json;
      const withFriendship = (m: Json) => ({ ...m, friendship: typeof m.friendship === 'number' ? m.friendship : m.uid === log?.starterUid ? starter : base });
      const battle = run.battle as Json | null;
      const pending = (run.pending as Json[]) ?? [];
      return {
        ...run,
        party: ((run.party as Json[]) ?? []).map(withFriendship),
        battle: battle ? { ...battle, enemyTeam: (battle.enemyTeam as Json[]).map(withFriendship) } : null,
        pending: pending.map((p) => (p.kind === 'caught' ? { ...p, mon: withFriendship(p.mon as Json) } : p)),
      };
    },
    // v9 (Milestone 8.9-0): the story layer. An older run starts its story
    // now (histories are filled in for the party on load); it gets the new
    // "story" and "hyper" random streams from its seed, which leaves every
    // other stream as it was; and Love's "already hung on" list becomes the
    // battle's story ledger.
    8: (data) => {
      const run = data as Json;
      const seed = String(run.seed);
      const battle = run.battle as Json | null;
      const endured = (battle?.enduredUids as string[] | undefined) ?? [];
      let upgradedBattle: Json | null = null;
      if (battle) {
        const { enduredUids: _old, ...rest } = battle;
        upgradedBattle = { ...rest, storyEffects: endured.map((uid) => `love-hung-on@${uid}`) };
      }
      return {
        ...run,
        rng: { ...(run.rng as Json), story: hashSeed(`${seed}::story`), hyper: hashSeed(`${seed}::hyper`) },
        battle: upgradedBattle,
        story: createStoryState(),
      };
    },
    // v10 (M8.9 Phase 1, Hyper moments): Love's endure became "Toughened It Out"; battles
    // count low-HP turns and super-effective hits; histories count each Pokémon's Hyper moments.
    9: (data) => {
      const run = data as Json;
      const battle = run.battle as Json | null;
      const story = run.story as Json;
      const histories = Object.fromEntries(
        Object.entries((story.histories as Record<string, Json>) ?? {}).map(([uid, h]) => [uid, { ...h, hyper: h.hyper ?? {} }]),
      );
      return {
        ...run,
        battle: battle
          ? {
              ...battle,
              storyEffects: ((battle.storyEffects as string[]) ?? []).map((k) => k.replace(/^love-hung-on@/, 'toughened-it-out@')),
              hyper: battle.hyper ?? { lowHp: null, superEffective: {}, rage: {} },
            }
          : null,
        story: { ...story, histories },
      };
    },
    // v11 (rivals, slice 1): the run's rivals.
    10: (data) => {
      const run = data as Json;
      return { ...run, story: { ...(run.story as Json), rivals: [] } };
    },
    // v12 (rival bonds): each rival gets its Pokémon bonds and off-screen history.
    11: (data) => {
      const run = data as Json;
      const story = run.story as Json;
      const rivals = ((story.rivals as Json[]) ?? []).map((r) => ({ bonds: {}, offscreen: [], ...r }));
      return { ...run, story: { ...story, rivals } };
    },
    // v13 (raids): the run's raid record.
    12: (data) => ({ ...(data as Json), raids: { entered: 0, won: 0, lost: 0, bestTier: 0, done: [] } }),
    // v14 (Totems): the run's Totem record.
    13: (data) => ({ ...(data as Json), totems: { entered: 0, won: 0, lost: 0, done: [], unlocks: [], research: 0 } }),
    // v15 (map events): event stops and event battles are new optional fields, so older runs load as they are.
    14: (data) => data,
    // v16 (Mega-Expeditions): no expedition in progress, nothing finished or unlocked yet.
    15: (data) => ({ ...(data as Json), expedition: null, expeditions: { completed: [], failed: [], unlocked: [], last: [] } }),
    // v17 (run rules): older runs are standard-mode, standard-difficulty runs.
    16: (data) => ({
      ...(data as Json),
      rules: { ruleVersion: 1, modeId: 'standard', difficultyId: 'standard', modifierIds: [], deathBlock: false, deathBlockUsed: false, progressionEligible: true, rewardMultiplier: 1, enemyLevelBonus: 0, wipes: 0 },
    }),
    // v18 (trainer quests): the run's Run Quest; runs started before it have none.
    17: (data) => ({ ...(data as Json), runQuest: null }),
    // v19 (Minigames): none in progress, nothing paid or played yet.
    18: (data) => ({ ...(data as Json), minigame: null, minigames: { stage: -1, money: 0, items: 0, plays: {}, attempts: {}, best: {} } }),
    // v20 (species mastery): runs started before it get no mastery unlocks.
    19: (data) => ({ ...(data as Json), mastery: {} }),
    // v21 (game events): runs started before it belong to no game event.
    20: (data) => ({ ...(data as Json), gameEvents: [] }),
    // v22 (Research Directive): runs started before it study no type.
    21: (data) => {
      const d = data as Json & { prep: Json };
      return { ...d, prep: { ...d.prep, directive: null } };
    },
    // v23 (Shadow Pokémon): an optional heart gauge on a Pokémon; older runs simply have none.
    22: (data) => data as Json,
    // v24 (crafting): runs started before it hold no materials.
    23: (data) => ({ ...(data as Json), materials: {} }),
    // v25 (Nemesis system): runs started before it have made no nemeses.
    24: (data) => {
      const d = data as Json & { story?: Json };
      return d.story ? { ...d, story: { ...d.story, nemeses: [] } } : d;
    },
    // v26 (Shadow and Blissful): optional `blissful` on a Pokémon and `snagged` on a battle; older runs have neither.
    25: (data) => data as Json,
  },
  settings: {
    // v2 (Milestone 9): battle animation settings.
    1: (data) => ({ ...(data as Json), battleAnimations: 'full', effectIntensity: 1 }),
    // v3 (untitled doc Phase B): battle speed.
    2: (data) => ({ ...(data as Json), battleSpeed: 'normal' }),
    // v4 (Battle Drama Engine): how much trainers talk.
    3: (data) => ({ ...(data as Json), dialogueFrequency: 'normal' }),
    // v5 (Master Expansion Catalog): damage details and accessibility presets.
    4: (data) => ({ ...(data as Json), damageDetails: false, accessibilityProfile: 'custom' }),
    // v6 (trainer sorting): the saved sort order of trainer lists.
    5: (data) => ({ ...(data as Json), trainerSort: 'default', trainerSortReverse: false }),
    // v7 (battle UI styles): older settings use the Aero look.
    6: (data) => ({ ...(data as Json), battleUi: 'aero' }),
    // v8 (visual polish): shake gets its own strength (starts at the old shared one); particles can be reduced.
    7: (data) => ({ ...(data as Json), shakeIntensity: (data as { effectIntensity?: number }).effectIntensity ?? 1, reduceParticles: false }),
    // v9 (animation settings, spec 6.6): every animation switch starts on, speed and intensity normal.
    8: (data) => ({ ...(data as Json), abilityAnimations: true, battleTextAnimations: true, interactionAnimations: true, hyperAnimations: true, rivalAnimations: true, evolutionAnimations: true, battleScreenEffects: true, animationSpeed: 'normal', animationIntensity: 'normal', disableAllAnimations: false }),
  },
  meta: {},
  timeline: {},
};

interface Envelope {
  format: string;
  record: RecordName;
  schemaVersion: number;
  savedAt: string;
  data: unknown;
}

export type LoadResult<T> =
  | { status: 'none' }
  | { status: 'ok'; data: T; migratedFrom?: number }
  | { status: 'corrupt'; reason: string }
  | { status: 'incompatible'; reason: string }
  | { status: 'unavailable'; reason: string };

export type SaveResult = { ok: true } | { ok: false; reason: string };

export const DEFAULT_SETTINGS: Settings = { musicVolume: 0.5, sfxVolume: 0.7, muted: false, battleAnimations: 'full', effectIntensity: 1, shakeIntensity: 1, reduceParticles: false, textSpeed: 'instant', autoAdvance: false, messageDelay: 'normal', highContrast: false, typeMarkers: false, uiScale: 'full', spriteAnimations: true, damageNumbers: true, catchDetail: 'full', battleSpeed: 'normal', dialogueFrequency: 'normal', damageDetails: false, accessibilityProfile: 'custom', trainerSort: 'default', trainerSortReverse: false, battleUi: 'aero', abilityAnimations: true, battleTextAnimations: true, interactionAnimations: true, hyperAnimations: true, rivalAnimations: true, evolutionAnimations: true, battleScreenEffects: true, animationSpeed: 'normal', animationIntensity: 'normal', disableAllAnimations: false };

/** True when the browser asks for less motion (then new players start with reduced battle animations). */
function prefersReducedMotion(): boolean {
  try {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export class SaveManager {
  constructor(
    private readonly storage: StorageProvider,
    private readonly content: Content,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get storageName(): string {
    return this.storage.name;
  }

  /** When anything was last saved (ISO text), or null when nothing has been. */
  lastSavedAt(): string | null {
    try {
      const raw = this.storage.get(this.key('meta'));
      const data = raw ? (JSON.parse(raw) as { data?: { lastSaved?: unknown } }).data : undefined;
      return typeof data?.lastSaved === 'string' ? data.lastSaved : null;
    } catch {
      return null;
    }
  }

  key(record: RecordName): string {
    return `${KEY_PREFIX}.${record}`;
  }

  // ---------- generic envelope handling ----------

  private write(record: RecordName, data: unknown, key = this.key(record)): SaveResult {
    const envelope: Envelope = {
      format: SAVE_FORMAT,
      record,
      schemaVersion: CURRENT_VERSIONS[record],
      savedAt: this.now().toISOString(),
      data,
    };
    try {
      this.storage.set(key, JSON.stringify(envelope));
      if (record !== 'meta') {
        this.storage.set(
          this.key('meta'),
          JSON.stringify({ format: SAVE_FORMAT, record: 'meta', schemaVersion: CURRENT_VERSIONS.meta, savedAt: envelope.savedAt, data: { lastSaved: envelope.savedAt, lastRecord: record } }),
        );
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  private read<T>(record: RecordName, schema: z.ZodType<T>, key = this.key(record)): LoadResult<T> {
    let raw: string | null;
    try {
      raw = this.storage.get(key);
    } catch (err) {
      return { status: 'unavailable', reason: err instanceof StorageUnavailableError ? err.message : String(err) };
    }
    if (raw === null) return { status: 'none' };
    return this.decode(record, raw, schema);
  }

  /** Parses, migrates and validates one record's JSON text. */
  decode<T>(record: RecordName, raw: string, schema: z.ZodType<T>): LoadResult<T> {
    let envelope: Partial<Envelope>;
    try {
      envelope = JSON.parse(raw) as Partial<Envelope>;
    } catch {
      return { status: 'corrupt', reason: 'The save is not valid JSON.' };
    }
    if (!envelope || envelope.format !== SAVE_FORMAT || envelope.record !== record) {
      return { status: 'corrupt', reason: `This is not a ${record} save for this game.` };
    }
    const version = envelope.schemaVersion;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      return { status: 'corrupt', reason: 'The save has no valid version number.' };
    }
    const current = CURRENT_VERSIONS[record];
    if (version > current) {
      return { status: 'incompatible', reason: `The save is from a newer version of the game (v${version}, this game reads up to v${current}).` };
    }
    let data = envelope.data;
    for (let v = version; v < current; v++) {
      const migrate = MIGRATIONS[record][v];
      if (!migrate) return { status: 'incompatible', reason: `No upgrade path from save version ${v} to ${v + 1}.` };
      try {
        data = migrate(data);
      } catch (err) {
        return { status: 'corrupt', reason: `Upgrading the save failed: ${String(err)}` };
      }
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { status: 'corrupt', reason: `The save data is damaged (${first?.path.join('.') || 'root'}: ${first?.message}).` };
    }
    return version < current ? { status: 'ok', data: parsed.data, migratedFrom: version } : { status: 'ok', data: parsed.data };
  }

  // ---------- run ----------

  loadRun(): LoadResult<RunState> {
    const result = this.read('run', RunStateSchema);
    if (result.status !== 'ok') return result;
    const problem = this.findRunReferenceProblem(result.data);
    if (problem) return { status: 'corrupt', reason: problem };
    return result;
  }

  /** Checks that everything the run refers to still exists in the game data. */
  private findRunReferenceProblem(run: RunState): string | null {
    const c = this.content;
    if (!c.archetypes.has(run.archetypeId)) return `Unknown trainer "${run.archetypeId}" in save.`;
    const caught = run.pending.flatMap((d) => (d.kind === 'caught' ? [d.mon] : []));
    const mons = [...run.party, ...(run.battle ? run.battle.enemyTeam : []), ...caught];
    for (const mon of mons) {
      if (!c.species.has(mon.speciesId)) return `Unknown Pokémon "${mon.speciesId}" in save.`;
      for (const slot of mon.moves) if (!c.moves.has(slot.id)) return `Unknown move "${slot.id}" in save.`;
    }
    for (const id of run.draft ?? []) if (!c.rewards.has(id)) return `Unknown reward "${id}" in save.`;
    for (const id of Object.keys(run.inventory)) if (!c.items.has(id)) return `Unknown item "${id}" in save.`;
    for (const d of run.pending) if (d.kind === 'learnMove' && !c.moves.has(d.moveId)) return `Unknown move "${d.moveId}" in save.`;
    if (run.battle) {
      if (!run.battle.enemyTeam[run.battle.enemyIndex]) return 'Battle data is damaged in the save.';
      const t = run.battle.trainer;
      if (t?.leaderId && !isBoss(c, t.leaderId)) return `Unknown gym leader, Elite Four member or champion "${t.leaderId}" in save.`;
      if (t && !t.leaderId && !c.trainers.has(t.classId)) return `Unknown trainer class "${t.classId}" in save.`;
    }
    if (run.phase === 'decision' && run.pending.length === 0) return 'The save is waiting on a decision that is missing.';
    if (run.stage) {
      if (!c.themes.has(run.stage.themeId)) return `Unknown stage theme "${run.stage.themeId}" in save.`;
      const league = run.stage.kind === 'league';
      if (!c.bosses.has(run.stage.leaderId)) return `Unknown ${league ? 'champion' : 'gym leader'} "${run.stage.leaderId}" in save.`;
      for (const id of run.stage.eliteFour) if (!c.bosses.has(id)) return `Unknown Elite Four member "${id}" in save.`;
      const mapProblems = league ? validateLeagueMap(run.stage.map) : validateStageMap(run.stage.map);
      if (mapProblems.length > 0) return `The stage map in the save is damaged (${mapProblems[0]}).`;
      if (run.stage.current !== null && !run.stage.map.nodes.some((n) => n.id === run.stage!.current)) return 'The save points to a map node that does not exist.';
    } else if (run.phase === 'map' || run.phase === 'shop') {
      return 'The stage map is missing from the save.';
    }
    if (!c.campaigns.has(run.campaignId)) return `Unknown campaign "${run.campaignId}" in save.`;
    for (const id of run.regionOrder) if (!c.regions.has(id)) return `Unknown region "${id}" in save.`;
    if (run.regionOrder.length > 0 && run.regionIndex >= run.regionOrder.length) return 'The save points to a region that does not exist.';
    if (run.phase === 'battle' && (!run.battle || !run.party[run.battle.activeIndex])) return 'Battle data is missing from the save.';
    if (run.phase === 'reward' && !run.draft) return 'Reward choices are missing from the save.';
    if (run.phase !== 'starter' && run.party.length === 0) return 'The save has no party.';
    if (run.party.length > c.balance.partyMax) return 'The save has too many Pokémon in the party.';
    return null;
  }

  saveRun(run: RunState): SaveResult {
    return this.write('run', run);
  }

  clearRun(): SaveResult {
    try {
      this.storage.remove(this.key('run'));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }

  // ---------- timelines (core/timeline/genesis.ts) ----------

  /** Where a replayed timeline lives: a run record (same versions and migrations) under its own key, apart from the normal run. */
  get replayKey(): string {
    return `${KEY_PREFIX}.replay`;
  }

  loadReplay(): LoadResult<RunState> {
    const result = this.read('run', RunStateSchema, this.replayKey);
    if (result.status !== 'ok') return result;
    if (!result.data.timeline) return { status: 'corrupt', reason: 'The replay save is not a timeline.' };
    const problem = this.findRunReferenceProblem(result.data);
    return problem ? { status: 'corrupt', reason: problem } : result;
  }

  saveReplay(run: RunState): SaveResult {
    if (!run.timeline) return { ok: false, reason: 'Only a timeline replay can be saved in the replay slot.' };
    return this.write('run', run, this.replayKey);
  }

  clearReplay(): SaveResult {
    try {
      this.storage.remove(this.replayKey);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }

  /** The timeline store; a damaged one is backed up and replaced by an empty store (genesis lost, history untouched). */
  loadTimeline(): { store: TimelineStore; warning: string | null } {
    const result = this.read('timeline', TimelineStoreSchema);
    if (result.status === 'ok') return { store: result.data, warning: null };
    if (result.status === 'none') return { store: emptyTimelineStore(), warning: null };
    const backup = result.status === 'corrupt' ? this.backupCorrupt('timeline') : null;
    return { store: emptyTimelineStore(), warning: `Timeline data could not be read (${result.reason})${backup ? `; a backup was kept as ${backup}` : ''}.` };
  }

  saveTimeline(store: TimelineStore): SaveResult {
    return this.write('timeline', store);
  }

  /** Keeps a copy of a damaged save under a backup key instead of deleting it. */
  backupCorrupt(record: RecordName): string | null {
    try {
      const raw = this.storage.get(this.key(record));
      if (raw === null) return null;
      const backupKey = `${this.key(record)}.corrupt.${this.now().getTime()}`;
      this.storage.set(backupKey, raw);
      this.storage.remove(this.key(record));
      return backupKey;
    } catch {
      return null;
    }
  }

  // ---------- profile ----------

  /**
   * Loads the profile. If none exists, a new one is created and saved.
   * If it is damaged, the damaged copy is backed up (never deleted) and a new
   * profile is used, with `warning` explaining what happened.
   */
  loadOrCreateProfile(newProfileId: () => string): { profile: Profile; warning?: string } {
    const result = this.read('profile', ProfileSchema);
    if (result.status === 'ok') return { profile: result.data };
    const profile = createProfile(this.content, newProfileId());
    if (result.status === 'none') {
      this.saveProfile(profile);
      return { profile };
    }
    if (result.status === 'unavailable') return { profile, warning: result.reason };
    const backup = this.backupCorrupt('profile');
    this.saveProfile(profile);
    return {
      profile,
      warning: `Your profile could not be loaded: ${result.reason} A copy was kept${backup ? ` as "${backup}"` : ''} and a new profile was started.`,
    };
  }

  saveProfile(profile: Profile): SaveResult {
    return this.write('profile', profile);
  }

  // ---------- export / import ----------

  /** The profile and settings as one JSON text, for a file the player keeps. */
  exportSave(): string {
    const envelope = (record: RecordName) => {
      const raw = this.storage.get(this.key(record));
      return raw === null ? null : (JSON.parse(raw) as unknown);
    };
    return JSON.stringify({ format: SAVE_FORMAT, kind: 'export', exportedAt: this.now().toISOString(), profile: envelope('profile'), settings: envelope('settings') }, null, 1);
  }

  /**
   * Reads an exported save. Nothing is written unless the whole file checks
   * out; the profile it replaces is kept under a backup key.
   */
  importSave(text: string): { ok: true; profile: Profile; settings: Settings | null; backup: string | null } | { ok: false; reason: string } {
    let file: Json;
    try {
      file = JSON.parse(text) as Json;
    } catch {
      return { ok: false, reason: 'That file is not valid JSON.' };
    }
    if (!file || file.format !== SAVE_FORMAT || file.kind !== 'export' || !file.profile) return { ok: false, reason: 'That file is not an exported save for this game.' };
    const profile = this.decode('profile', JSON.stringify(file.profile), ProfileSchema);
    if (profile.status !== 'ok') return { ok: false, reason: 'reason' in profile ? profile.reason : 'The profile in that file is missing.' };
    const settings = file.settings ? this.decode('settings', JSON.stringify(file.settings), SettingsSchema) : null;
    if (settings && settings.status !== 'ok') return { ok: false, reason: 'reason' in settings ? settings.reason : 'The settings in that file are damaged.' };
    let backup: string | null = null;
    try {
      const current = this.storage.get(this.key('profile'));
      if (current !== null) {
        backup = `${this.key('profile')}.before-import.${this.now().getTime()}`;
        this.storage.set(backup, current);
      }
    } catch {
      backup = null;
    }
    const saved = this.saveProfile(profile.data);
    if (!saved.ok) return { ok: false, reason: saved.reason };
    if (settings?.status === 'ok') this.saveSettings(settings.data);
    return { ok: true, profile: profile.data, settings: settings?.status === 'ok' ? settings.data : null, backup };
  }

  // ---------- settings ----------

  loadSettings(): Settings {
    const result = this.read('settings', SettingsSchema);
    if (result.status === 'ok') return result.data;
    return { ...DEFAULT_SETTINGS, battleAnimations: prefersReducedMotion() ? 'reduced' : 'full' };
  }

  saveSettings(settings: Settings): SaveResult {
    return this.write('settings', settings);
  }
}

function isBoss(c: Content, id: string): boolean {
  return c.bosses.has(id);
}
