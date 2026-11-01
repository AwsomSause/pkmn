// The Hub "Tools" room (W12): what's new, content status, your stats, the seed board, mod packs, bug report and a
// backup note. Every page is a list; none of it changes how a run plays.

import { CHANGELOG, entriesSince, latestChangelogId } from '../core/tools/changelog';
import { contentStatuses, problemEntries, statusLines } from '../core/tools/contentStatusView';
import { localStats } from '../core/tools/localStats';
import { buildBugReport, bugReportHeadline } from '../core/tools/bugReport';
import { boardCode, mergedBoard } from '../core/tools/seedBoard';
import { installPack, removePack } from '../core/tools/modPacks';
import { backupDue } from '../core/tools/backup';
import { packSeeds } from '../core/configPack';
import { loadStoredPacks } from '../core/tools/modPacks';
import { decodeSeedCode } from '../core/seedCode';
import { legacyOf, shelfProblem, shelveSeed } from '../core/legacy';
import { downloadText, pickTextFile } from '../ui/files';
import { APP_VERSION, BUILD_ID } from '../game/buildInfo';
import { device, packStore, recentErrors } from '../game/deviceTools';
import { services } from '../game/services';
import { COLORS, textStyle } from '../ui/theme';
import type { Picker, PickerRow } from '../ui/partyPanel';

type PickerConfig = ConstructorParameters<typeof Picker>[1];

export interface ToolsHost {
  open(config: PickerConfig): void;
  close(): void;
  /** Reopens the Hub (with a notice) on the Tools room. */
  restart(notice: string | undefined): void;
}

const row = (label: string, sub: string, right = '', color: string = COLORS.textLight): PickerRow => ({
  problem: null,
  hint: sub,
  draw: (scene, box, w, h) => {
    box.add(scene.add.text(12, 6, label, textStyle(18, color, { wordWrap: { width: w - 190 } })));
    if (sub) box.add(scene.add.text(12, 31, sub, textStyle(13, COLORS.textMuted, { wordWrap: { width: w - 190 } })));
    if (right) box.add(scene.add.text(w - 12, h / 2, right, textStyle(15, COLORS.gold)).setOrigin(1, 0.5));
  },
});

function page(host: ToolsHost, title: string, rows: PickerRow[], onSelect: (i: number) => void = () => undefined, back: () => void = () => openTools(host)): void {
  host.open({ title, rows, columns: 1, rowHeight: 56, onSelect, onBack: back });
}

/** What the Tools room shows first. */
export function openTools(host: ToolsHost): void {
  const { session } = services();
  const due = backupDue({ runs: session.profile.runHistory.length, lastExportAt: device.lastExport(), lastRemindedAt: null, now: new Date().toISOString() });
  const items: { label: string; sub: string; go: () => void }[] = [
    { label: "What's new", sub: 'Changes in each update.', go: () => openChangelog(host) },
    { label: 'Content status', sub: 'How much of the game is fully working, limited or switched off.', go: () => openContentStatus(host) },
    { label: 'My stats', sub: 'Numbers worked out on this device from your own runs. Nothing is sent anywhere.', go: () => openStats(host) },
    { label: 'Seed board', sub: 'Curated seeds, plus seeds from your mod packs. Put one on the shelf (Enter).', go: () => openSeedBoard(host) },
    { label: 'Mod packs', sub: 'Add JSON packs of extra trainer lines and seeds. Packs are checked, never run as code.', go: () => openPacks(host) },
    { label: 'Report a bug', sub: 'Bundles the version, seed and recent errors into a file you can send.', go: () => openBugReport(host) },
    { label: 'Back up my save', sub: due ? 'You have not saved a copy in a while. Enter to download one.' : 'Download a copy of your profile and settings.', go: () => backup(host) },
  ];
  page(host, 'Tools & Community', items.map((i, n) => row(i.label, i.sub, n === 6 && due ? 'Due' : '')), (n) => items[n]!.go(), () => host.close());
}

export function openChangelog(host: ToolsHost): void {
  const seen = device.changelogSeen();
  const unseen = new Set(entriesSince(seen).map((e) => e.id));
  const rows: PickerRow[] = [];
  for (const e of CHANGELOG) {
    rows.push(row(`${e.title}  ·  ${e.id}`, '', unseen.has(e.id) ? 'New' : '', COLORS.gold));
    for (const n of e.notes) rows.push(row(`• ${n}`, ''));
  }
  device.setChangelogSeen(latestChangelogId());
  page(host, "What's new", rows);
}

function openContentStatus(host: ToolsHost): void {
  const { session, assets } = services();
  const missing = new Set(assets.missing.flatMap((m) => m.files));
  const statuses = contentStatuses(session.content, { assetExists: (p) => !missing.has(p) });
  const rows: PickerRow[] = statusLines(statuses).map((l) => row(`${l.kind}  ·  ${l.total}`, `supported ${l.counts.supported} · limited ${l.counts.limited} · disabled ${l.counts.disabled} · invalid ${l.counts.invalid}`, l.counts.invalid ? 'Check' : ''));
  const bad = problemEntries(statuses).slice(0, 40);
  rows.push(row(`Not fully supported (first ${bad.length})`, 'Limited means it works with notes; disabled means switched off for now.', '', COLORS.gold));
  for (const e of bad) rows.push(row(`${e.kind} ${e.id}  ·  ${e.status}`, e.notes[0] ?? ''));
  page(host, 'Content status', rows);
}

function openStats(host: ToolsHost): void {
  const { session } = services();
  const s = localStats(session.profile);
  const name = (id: string) => session.content.archetypes.get(id)?.name ?? id;
  const mon = (id: string) => session.content.species.get(id)?.name ?? id;
  const rows = [
    row('Runs', `${s.runs} finished · ${s.wins} won`, `${s.winRate}%`),
    row('Depth', `Average ${s.avgEncounters} encounters per run, best ${s.bestEncounters}. Average ${s.avgRegions} regions cleared.`),
    row('Assisted runs', 'Runs that used the debug tools.', String(s.assisted)),
    ...s.topTrainers.map((t) => row(`Trainer: ${name(t.id)}`, `${t.runs} runs, ${t.wins} won`)),
    ...s.topKillers.map((k) => row(`Beaten by ${mon(k.id)}`, '', `${k.count}×`)),
    ...s.topPartyMembers.map((m) => row(`Most used: ${mon(m.id)}`, '', `${m.count} runs`)),
  ];
  page(host, 'My stats', rows);
}

function openSeedBoard(host: ToolsHost): void {
  const { session } = services();
  const p = session.profile;
  const extra = packSeeds(loadStoredPacks(packStore).packs);
  const board = mergedBoard(extra);
  const now = new Date().toISOString();
  const rows = board.map((e) => {
    const code = boardCode(e);
    const problem = shelfProblem(p, code);
    return row(e.label, `${e.note}  Seed ${e.seed}, trainer ${session.content.archetypes.get(e.archetypeId)?.name ?? e.archetypeId}.`, problem ? (legacyOf(p).seedShelf.some((s) => s.code === code) ? 'On shelf' : 'Shelf full') : 'Add');
  });
  page(host, `Seed board  ·  ${board.length}`, rows, (n) => {
    const e = board[n]!;
    const code = boardCode(e);
    if (!decodeSeedCode(code).ok || shelfProblem(session.profile, code)) return;
    session.changeProfile((pr) => shelveSeed(pr, code, e.label, now));
    host.restart(`"${e.label}" is on your Seed Shelf.`);
  });
}

function openPacks(host: ToolsHost): void {
  const loaded = loadStoredPacks(packStore);
  const rows: PickerRow[] = [row('Add a pack from a file', 'Pick a .json pack. It is checked first; bad packs are refused.', 'Add')];
  for (const p of loaded.packs) rows.push(row(`${p.name}  ·  ${p.author}`, `${Object.keys(p.flavor).length} line sets, ${p.seeds.length} seeds. Enter removes it.`, 'Remove'));
  for (const problem of loaded.problems) rows.push(row('Skipped pack', problem, '', COLORS.textMuted));
  page(host, `Mod packs  ·  ${loaded.packs.length}`, rows, (n) => {
    if (n === 0) pickTextFile((text) => host.restart(installPack(packStore, text).message));
    else if (loaded.packs[n - 1]) {
      removePack(packStore, loaded.packs[n - 1]!.id);
      host.restart('Pack removed. Restart the game to drop its lines.');
    }
  });
}

function openBugReport(host: ToolsHost): void {
  const { session } = services();
  const make = (note: string) => buildBugReport({ version: APP_VERSION, build: BUILD_ID, now: new Date().toISOString(), userAgent: navigator.userAgent, scene: 'Hub', run: session.run, settings: session.settings, errors: recentErrors(), note });
  const head = bugReportHeadline(make(''));
  page(host, 'Report a bug', [row('Save a bug report file', `${head}. Contains no save data, only the run seed, version and recent errors.`, 'Save'), row('Copy a one-line summary', 'For pasting into a chat.', 'Copy')], (n) => {
    if (n === 0) {
      const note = window.prompt('What went wrong? (optional)', '') ?? '';
      downloadText(`pkmn-bug-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(make(note), null, 2));
      host.restart('Bug report saved.');
    } else {
      void navigator.clipboard?.writeText(head).catch(() => undefined);
      host.restart('Summary copied.');
    }
  });
}

function backup(host: ToolsHost): void {
  const { session } = services();
  downloadText(`pkmn-save-${new Date().toISOString().slice(0, 10)}.json`, session.exportSave());
  device.markExported(new Date().toISOString());
  host.restart('Save exported.');
}

/** A notice for the Hub when something is worth saying on arrival (an update, a backup). */
export function hubArrivalNotice(): { text: string; openChangelog: boolean } | null {
  const { session } = services();
  const now = new Date().toISOString();
  const seen = device.changelogSeen();
  if (seen === null) {
    device.setChangelogSeen(latestChangelogId());
    return null;
  }
  if (seen !== latestChangelogId()) return { text: "The game was updated. Open Settings > Tools & Community > What's new.", openChangelog: true };
  if (backupDue({ runs: session.profile.runHistory.length, lastExportAt: device.lastExport(), lastRemindedAt: device.lastReminded(), now })) {
    device.markReminded(now);
    return { text: 'Back up your save: Settings > Tools & Community > Back up my save.', openChangelog: false };
  }
  return null;
}
