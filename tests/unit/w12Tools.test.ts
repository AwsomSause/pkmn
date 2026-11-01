// W12 tech and community tools: changelog, performance preset, bug report, local stats, replay validator,
// assisted tag, update notice, backup reminder, seed board, mod packs, content status, preload tracker, dashboard.

import { describe, expect, it } from 'vitest';
import { CHANGELOG, ChangelogSchema, entriesSince, latestChangelogId, shouldShowChangelog } from '../../src/core/tools/changelog';
import { applyPerfPreset, nextPerfPreset, PERF_ORDER } from '../../src/core/tools/perfPreset';
import { buildBugReport, bugReportHeadline } from '../../src/core/tools/bugReport';
import { localStats } from '../../src/core/tools/localStats';
import { runDigest, validateReplay } from '../../src/core/tools/replay';
import { isAssisted, markAssisted } from '../../src/core/tools/assisted';
import { updateAvailable } from '../../src/core/tools/updateCheck';
import { backupDue } from '../../src/core/tools/backup';
import { BOARD, boardCode, mergedBoard } from '../../src/core/tools/seedBoard';
import { installPack, loadStoredPacks, MAX_PACKS, removePack, type PackStore } from '../../src/core/tools/modPacks';
import { packSeeds, parseConfigPack } from '../../src/core/configPack';
import { contentStatuses, problemEntries, statusLines } from '../../src/core/tools/contentStatusView';
import { PreloadTracker, packOf } from '../../src/core/tools/preload';
import { dashboardHtml, parseLines, summarize } from '../../src/quality/playtestDashboard';
import { decodeSeedCode } from '../../src/core/seedCode';
import { DEFAULT_SETTINGS } from '../../src/save/saveManager';
import { SettingsSchema, type RunRecord } from '../../src/core/state';
import { changeSetting } from '../../src/core/settingsRegistry';
import { debugHealParty } from '../../src/core/run';
import { content } from './helpers';
import { autoplay } from './autoplay';

describe('changelog (F220)', () => {
  it('is valid data, newest first, and opens once after an update', () => {
    expect(ChangelogSchema.safeParse(CHANGELOG).success).toBe(true);
    const ids = CHANGELOG.map((e) => e.id);
    expect([...ids].sort().reverse()).toEqual(ids);
    expect(shouldShowChangelog(null)).toBe(false); // first visit: nothing to compare
    expect(shouldShowChangelog(latestChangelogId())).toBe(false);
    expect(shouldShowChangelog('2020-01-01')).toBe(true);
    expect(entriesSince(CHANGELOG[1]!.id).map((e) => e.id)).toEqual([CHANGELOG[0]!.id]);
    expect(entriesSince(null)).toHaveLength(CHANGELOG.length);
  });
});

describe('performance preset (F214)', () => {
  it('cycles high, medium, low and sets the particle and effect settings', () => {
    expect(PERF_ORDER.map((p) => nextPerfPreset(p))).toEqual(['medium', 'low', 'high']);
    const low = applyPerfPreset(DEFAULT_SETTINGS, 'low');
    expect(low.reduceParticles).toBe(true);
    expect(low.effectIntensity).toBeLessThan(1);
    expect(low.performancePreset).toBe('low');
    expect(applyPerfPreset(low, 'high').reduceParticles).toBe(false);
    expect(SettingsSchema.safeParse(low).success).toBe(true);
  });
  it('is a setting the player can change, and older settings load without it (no save bump)', () => {
    expect(changeSetting(DEFAULT_SETTINGS, 'performancePreset').performancePreset).toBe('medium');
    const { performancePreset: _p, ...old } = DEFAULT_SETTINGS;
    expect(SettingsSchema.parse(old).performancePreset).toBe('high');
  });
});

describe('assisted tag (F224) and replay validator (F216)', () => {
  it('debug tools mark the run, a normal run is unmarked', () => {
    const plain = autoplay({ seed: 'w12-a', steps: 30, smart: true });
    expect(isAssisted(plain)).toBe(false);
    const helped = debugHealParty(content, plain);
    expect(isAssisted(helped)).toBe(true);
    expect(isAssisted(plain)).toBe(false); // the original is untouched
    const copy = structuredClone(plain);
    markAssisted(copy);
    markAssisted(copy);
    expect(isAssisted(copy)).toBe(true);
  });
  it('the same seed gives the same digest, a different seed does not', () => {
    const play = (seed: string) => autoplay({ seed, steps: 120, smart: true });
    const v = validateReplay('w12-r', play);
    expect(v.ok).toBe(true);
    expect(runDigest(play('w12-r'))).toBe(v.first);
    expect(runDigest(play('w12-other'))).not.toBe(v.first);
  });
  it('flags a play that is not repeatable', () => {
    let n = 0;
    const v = validateReplay('x', () => autoplay({ seed: `w12-flaky-${n++}`, steps: 40, smart: true }));
    expect(v.ok).toBe(false);
  });
});

describe('bug report (F212)', () => {
  const run = autoplay({ seed: 'w12-bug', steps: 60, smart: true });
  const input = { version: '1.2.3', build: 'abc', now: '2026-11-01T00:00:00Z', userAgent: 'UA', scene: 'Hub', run, settings: DEFAULT_SETTINGS, errors: ['error: boom'], note: 'it broke' };
  it('bundles version, seed, digest and errors, and nothing from the save', () => {
    const r = buildBugReport(input);
    expect(r.run?.seed).toBe('w12-bug');
    expect(r.run?.digest).toBe(runDigest(run));
    expect(r.errors).toEqual(['error: boom']);
    expect(bugReportHeadline(r)).toContain('seed w12-bug');
    const text = JSON.stringify(r);
    expect(text).not.toContain('bankCredits');
    expect(text).not.toContain('inventory');
  });
  it('works with no run and caps the error list', () => {
    const r = buildBugReport({ ...input, run: null, errors: Array.from({ length: 50 }, (_, i) => `e${i}`) });
    expect(r.run).toBeNull();
    expect(r.errors).toHaveLength(20);
    expect(bugReportHeadline(r)).toContain('no run');
  });
});

describe('local stats (F221)', () => {
  const rec = (o: Partial<RunRecord>) => ({ victory: false, encounters: 10, regionsCleared: 0, archetypeId: 'red', defeatedBy: { speciesId: 'rattata', level: 3, trainer: null }, party: [{ speciesId: 'pikachu', level: 5, shiny: false }], ...o }) as RunRecord;
  it('counts runs, wins, assisted runs and the usual suspects', () => {
    const s = localStats({ runHistory: [rec({ victory: true, encounters: 30 }), rec({}), rec({ assisted: true, archetypeId: 'blue' })] });
    expect(s.runs).toBe(3);
    expect(s.wins).toBe(1);
    expect(s.winRate).toBe(33.3);
    expect(s.assisted).toBe(1);
    expect(s.bestEncounters).toBe(30);
    expect(s.topTrainers[0]).toEqual({ id: 'red', runs: 2, wins: 1 });
    expect(s.topKillers[0]).toEqual({ id: 'rattata', count: 3 });
  });
  it('is all zeros with no runs', () => {
    expect(localStats({ runHistory: [] })).toMatchObject({ runs: 0, winRate: 0, avgEncounters: 0, topTrainers: [] });
  });
});

describe('update notice (F222) and backup reminder (F208)', () => {
  it('only a different build id from the site means an update', () => {
    expect(updateAvailable('abc', { build: 'abc', version: '1' })).toBe(false);
    expect(updateAvailable('abc', { build: 'def', version: '1' })).toBe(true);
    expect(updateAvailable('dev', { build: 'def' })).toBe(false);
    expect(updateAvailable('abc', null)).toBe(false);
    expect(updateAvailable('abc', { build: '' })).toBe(false);
    expect(updateAvailable('abc', 'nope')).toBe(false);
  });
  it('reminds players with runs after a week without a backup, at most weekly', () => {
    const now = '2026-11-10T00:00:00Z';
    expect(backupDue({ runs: 0, lastExportAt: null, lastRemindedAt: null, now })).toBe(false);
    expect(backupDue({ runs: 3, lastExportAt: null, lastRemindedAt: null, now })).toBe(true);
    expect(backupDue({ runs: 3, lastExportAt: '2026-11-08T00:00:00Z', lastRemindedAt: null, now })).toBe(false);
    expect(backupDue({ runs: 3, lastExportAt: '2026-10-20T00:00:00Z', lastRemindedAt: '2026-11-09T00:00:00Z', now })).toBe(false);
    expect(backupDue({ runs: 3, lastExportAt: '2026-10-20T00:00:00Z', lastRemindedAt: '2026-11-01T00:00:00Z', now })).toBe(true);
    expect(backupDue({ runs: 3, lastExportAt: 'garbage', lastRemindedAt: null, now })).toBe(false);
  });
});

describe('seed board (F219) and mod packs (F209)', () => {
  const memory = (): PackStore => {
    let texts: string[] = [];
    return { get: () => texts, set: (t) => void (texts = t) };
  };
  const pack = (id: string, extra: Record<string, unknown> = {}) => JSON.stringify({ format: 1, id, name: `Pack ${id}`, author: 'Tester', ...extra });

  it('every curated seed decodes, names a real, default-unlocked trainer and is listed once', () => {
    expect(BOARD.length).toBeGreaterThanOrEqual(5);
    const keys = new Set<string>();
    for (const e of BOARD) {
      expect(decodeSeedCode(boardCode(e)).ok, e.label).toBe(true);
      expect(content.archetypes.get(e.archetypeId)?.unlockedByDefault, e.label).toBe(true);
      keys.add(`${e.seed}|${e.archetypeId}`);
    }
    expect(keys.size).toBe(BOARD.length);
  });
  it('merges pack seeds after the built-in ones and drops repeats', () => {
    const extra = [{ ...BOARD[0]! }, { seed: 'pack-seed', archetypeId: 'red', label: 'Mine', note: '' }];
    const merged = mergedBoard(extra);
    expect(merged).toHaveLength(BOARD.length + 1);
    expect(merged.at(-1)!.seed).toBe('pack-seed');
  });
  it('installs, lists, replaces and removes packs; bad packs are refused', () => {
    const store = memory();
    expect(installPack(store, 'not json').ok).toBe(false);
    expect(installPack(store, pack('Bad Id')).ok).toBe(false);
    expect(installPack(store, pack('one', { seeds: [{ seed: 'abc', archetypeId: 'red', label: 'ABC' }] })).ok).toBe(true);
    expect(installPack(store, pack('one', { seeds: [{ seed: 'xyz', archetypeId: 'blue', label: 'XYZ' }] })).ok).toBe(true);
    expect(store.get()).toHaveLength(1); // same id replaces
    const loaded = loadStoredPacks(store);
    expect(packSeeds(loaded.packs).map((s) => s.seed)).toEqual(['xyz']);
    removePack(store, 'one');
    expect(store.get()).toHaveLength(0);
  });
  it('limits the number of packs and skips stored packs that stopped validating', () => {
    const store = memory();
    for (let i = 0; i < MAX_PACKS; i++) expect(installPack(store, pack(`p${i}`)).ok).toBe(true);
    expect(installPack(store, pack('one-too-many')).ok).toBe(false);
    store.set(['{"format":2}', pack('fine')]);
    const loaded = loadStoredPacks(store);
    expect(loaded.packs.map((p) => p.id)).toEqual(['fine']);
    expect(loaded.problems).toHaveLength(1);
  });
  it('a pack with a seed that is not a plain code is refused', () => {
    expect(parseConfigPack(pack('x', { seeds: [{ seed: '<script>', archetypeId: 'red', label: 'x' }] })).ok).toBe(false);
    expect(parseConfigPack(pack('y', { seeds: Array.from({ length: 21 }, (_, i) => ({ seed: `s${i}x`, archetypeId: 'red', label: 'x' })) })).ok).toBe(false);
  });
});

describe('content status viewer (F210)', () => {
  it('sums every kind and lists the worst problems first', () => {
    const statuses = contentStatuses(content, { assetExists: () => true });
    const lines = statusLines(statuses);
    expect(lines.some((l) => l.kind === 'species')).toBe(true);
    for (const l of lines) expect(l.counts.supported + l.counts.limited + l.counts.disabled + l.counts.invalid).toBe(l.total);
    const bad = problemEntries(statuses);
    const rank = { invalid: 0, disabled: 1, limited: 2, supported: 3 };
    for (let i = 1; i < bad.length; i++) expect(rank[bad[i - 1]!.status]).toBeLessThanOrEqual(rank[bad[i]!.status]);
    expect(bad.every((e) => e.status !== 'supported')).toBe(true);
  });
});

describe('preload tracker (F215)', () => {
  it('groups files by folder and reports the pack being filled', () => {
    expect(packOf('images/pokemon/icons/a.png')).toBe('images/pokemon');
    expect(packOf('x.json')).toBe('x.json');
    const t = new PreloadTracker();
    t.add('a', 'images/pokemon/a.png');
    t.add('b', 'images/pokemon/b.png');
    t.add('c', 'audio/music/c.m4a');
    t.complete('a');
    t.complete('zzz'); // unknown ids are ignored
    expect(t.line()).toBe('images/pokemon  1/2  ·  0/2 packs ready');
    t.complete('b');
    t.complete('c');
    expect(t.line()).toBe('audio/music  1/1  ·  2/2 packs ready');
  });
});

describe('balance dashboard (F211)', () => {
  it('summarises playtest lines and ignores junk', () => {
    const text = [
      '{"modeId":"standard","difficultyId":"story","archetypeId":"red","encounters":20,"badges":1,"by":{"speciesId":"rattata"}}',
      '{"modeId":"standard","difficultyId":"story","archetypeId":"red","encounters":10,"badges":0,"by":{"speciesId":"rattata"},"error":"boom"}',
      'not json',
      '[1]',
      '',
    ].join('\n');
    const { lines, skipped } = parseLines(text);
    expect(lines).toHaveLength(2);
    expect(skipped).toBe(2);
    const s = summarize(lines);
    expect(s.runs).toBe(2);
    expect(s.problems).toBe(1);
    expect(s.byMode[0]).toMatchObject({ key: 'standard', runs: 2, avgEncounters: 15, badgePct: 50, problems: 1 });
    expect(s.topKillers[0]).toEqual({ id: 'rattata', count: 2 });
    expect(dashboardHtml(s, ['a<b.jsonl'])).toContain('a&lt;b.jsonl');
  });
});

describe('offline app files (F213)', () => {
  it('the manifest, icons and service worker exist and the page links them', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as { icons: { src: string }[]; start_url: string };
    expect(manifest.start_url).toBe('./');
    for (const icon of manifest.icons) expect(existsSync(`public/${icon.src}`), icon.src).toBe(true);
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('manifest.webmanifest');
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain('version.json'); // the update check always goes to the network
  });
});
