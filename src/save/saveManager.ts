// Versioned save records: profile (permanent), run (current run), settings,
// and metadata. Every record is wrapped in an envelope with a schema version,
// checked against its schema on load, and migrated if it is older.

import type { z } from 'zod';
import type { Content } from '../core/contentSchema';
import { validateLeagueMap, validateStageMap } from '../core/map';
import { createProfile } from '../core/profile';
import {
  ProfileSchema,
  RunStateSchema,
  SettingsSchema,
  type Profile,
  type RunState,
  type Settings,
} from '../core/state';
import { StorageUnavailableError, type StorageProvider } from './storage';

export const SAVE_FORMAT = 'pkmn-roguelike';
export const KEY_PREFIX = 'pkr';

export type RecordName = 'profile' | 'run' | 'settings' | 'meta';

/** Current schema version of each record. Bump when a record's shape changes and add a migration. */
export const CURRENT_VERSIONS: Record<RecordName, number> = { profile: 2, run: 4, settings: 1, meta: 1 };

/** Migrations upgrade a record from version N to N+1. */
type Migration = (data: unknown) => unknown;
type Json = Record<string, unknown>;

export const MIGRATIONS: Record<RecordName, Record<number, Migration>> = {
  profile: {
    // v2 (Milestone 2): candies, the permanent currency.
    1: (data) => ({ ...(data as Json), candies: 0 }),
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
  },
  settings: {},
  meta: {},
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

export const DEFAULT_SETTINGS: Settings = { musicVolume: 0.5, sfxVolume: 0.7, muted: false };

export class SaveManager {
  constructor(
    private readonly storage: StorageProvider,
    private readonly content: Content,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get storageName(): string {
    return this.storage.name;
  }

  key(record: RecordName): string {
    return `${KEY_PREFIX}.${record}`;
  }

  // ---------- generic envelope handling ----------

  private write(record: RecordName, data: unknown): SaveResult {
    const envelope: Envelope = {
      format: SAVE_FORMAT,
      record,
      schemaVersion: CURRENT_VERSIONS[record],
      savedAt: this.now().toISOString(),
      data,
    };
    try {
      this.storage.set(this.key(record), JSON.stringify(envelope));
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

  private read<T>(record: RecordName, schema: z.ZodType<T>): LoadResult<T> {
    let raw: string | null;
    try {
      raw = this.storage.get(this.key(record));
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
      if (!(league ? c.champions : c.gymLeaders).has(run.stage.leaderId)) return `Unknown ${league ? 'champion' : 'gym leader'} "${run.stage.leaderId}" in save.`;
      for (const id of run.stage.eliteFour) if (!c.eliteFour.has(id)) return `Unknown Elite Four member "${id}" in save.`;
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

  // ---------- settings ----------

  loadSettings(): Settings {
    const result = this.read('settings', SettingsSchema);
    return result.status === 'ok' ? result.data : { ...DEFAULT_SETTINGS };
  }

  saveSettings(settings: Settings): SaveResult {
    return this.write('settings', settings);
  }
}

function isBoss(c: Content, id: string): boolean {
  return c.gymLeaders.has(id) || c.eliteFour.has(id) || c.champions.has(id);
}
