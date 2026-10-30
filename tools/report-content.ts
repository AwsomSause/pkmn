// The content report (M8.6): what in the game data doesn't fully work yet.
//
//   npm run report:content                  counts, plus the first offending ids of each check
//   npm run report:content -- --all         every offending id
//   npm run report:content -- --only <id>   one check, every offending id (e.g. --only broken-evolutions)
//   npm run report:content -- --status      every entry that isn't fully supported, with the reasons
//   npm run report:content -- --json <file> the whole report as JSON
//   npm run report:content -- --write       also write docs/quality/CONTENT_REPORT.md
//   npm run report:content -- --check       exit 1 if any number is worse than tools/content-baseline.json (CI)
//   npm run report:content -- --update-baseline   accept the current numbers as the new baseline
//
// Read-only: it never changes the game data. Details in QUALITY_GATES.md.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type * as Report from '../src/quality/contentReport.ts';
import type * as Data from '../src/data/index.ts';
import type * as Save from '../src/save/saveManager.ts';
import { readCatalogInputs } from './catalogInputs.ts';
import { closeModules, loadModule, root } from './lib/gameModules.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const baselinePath = join(root, 'tools', 'content-baseline.json');
const assetsDir = join(root, 'public', 'assets');

function walk(dir: string, skip: string[] = []): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (skip.some((s) => p.startsWith(join(root, s)))) return [];
    return statSync(p).isDirectory() ? walk(p, skip) : p.endsWith('.ts') ? [p] : [];
  });
}

const { getContent } = await loadModule<typeof Data>('/src/data/index.ts');
const { buildContentReport, gateNumbers, improvements, regressions } = await loadModule<typeof Report>('/src/quality/contentReport.ts');
const { MIGRATIONS } = await loadModule<typeof Save>('/src/save/saveManager.ts');
await closeModules();

const content = getContent();
const existsCache = new Map<string, boolean>();
const catalog = readCatalogInputs();
const report = buildContentReport(content, {
  assetExists: (path) => {
    let hit = existsCache.get(path);
    if (hit === undefined) existsCache.set(path, (hit = existsSync(join(assetsDir, path))));
    return hit;
  },
  balanceJson: JSON.parse(readFileSync(join(root, 'src', 'data', 'balance.json'), 'utf8')),
  gameSources: walk(join(root, 'src'), ['src/data', 'src/quality', 'src/core/contentSchema.ts']).map((f) => readFileSync(f, 'utf8')),
  testSources: walk(join(root, 'tests', 'unit')).map((f) => readFileSync(f, 'utf8')),
  migrations: Object.fromEntries(Object.entries(MIGRATIONS).map(([record, m]) => [record, Object.keys(m).map(Number)])),
  catalogIds: { trainerAssetIds: catalog.trainerAssetIds, itemAssetIds: catalog.itemAssetIds, backgroundAssetIds: catalog.backgroundAssetIds },
});

const jsonPath = option('--json');
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(report, null, 1) + '\n');
  console.log(`Wrote ${relative(process.cwd(), jsonPath)}`);
}

if (flag('--write')) {
  const md: string[] = ['# Content report', '', 'Made by `npm run report:content -- --write`. Read-only: nothing in the game data was changed. Statuses and checks are explained in QUALITY_GATES.md.', ''];
  md.push(`Totals: ${Object.entries(report.totals).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
  md.push('## Support status', '', '| Kind | Supported | Limited | Disabled | Invalid |', '|---|---|---|---|---|');
  for (const [kind, c] of Object.entries(report.summary)) md.push(`| ${kind} | ${c.supported} | ${c.limited} | ${c.disabled} | ${c.invalid} |`);
  md.push('', '## Checks', '', '| Check | Count | What it means |', '|---|---|---|');
  for (const c of report.checks) md.push(`| ${c.title} (\`${c.id}\`) | ${c.count} | ${c.explain} |`);
  for (const c of report.checks.filter((x) => x.count > 0)) {
    md.push('', `### ${c.title}: ${c.count}`, '');
    for (const id of c.offenders.slice(0, 25)) md.push(`- ${id}`);
    if (c.count > 25) md.push(`- ... and ${c.count - 25} more (\`npm run report:content -- --only ${c.id}\`)`);
  }
  const dir = join(root, 'docs', 'quality');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'CONTENT_REPORT.md'), md.join('\n') + '\n');
  console.log('Wrote docs/quality/CONTENT_REPORT.md\n');
}

const only = option('--only');
// --check (inside npm run check and CI) prints one line per check; ask for ids with --only or --all.
const brief = flag('--check') && !only && !flag('--all');
const limit = flag('--all') || only ? Infinity : brief ? 0 : 8;

console.log('Content report');
console.log(`  ${Object.entries(report.totals).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log('');
console.log('Support status (supported / limited / disabled / invalid)');
for (const [kind, c] of Object.entries(report.summary)) console.log(`  ${kind.padEnd(10)} ${c.supported} / ${c.limited} / ${c.disabled} / ${c.invalid}`);
console.log('');
for (const check of report.checks) {
  if (only && check.id !== only) continue;
  console.log(`${check.count === 0 ? 'ok  ' : 'FIND'} ${check.title} [${check.id}]: ${check.count}`);
  if (!brief) console.log(`     ${check.explain}`);
  for (const id of check.offenders.slice(0, limit)) console.log(`       - ${id}`);
  if (check.offenders.length > limit && !brief) console.log(`       ... and ${check.offenders.length - limit} more (--only ${check.id})`);
}
if (only && !report.checks.some((c) => c.id === only)) {
  console.error(`No check "${only}". Checks: ${report.checks.map((c) => c.id).join(', ')}`);
  process.exit(2);
}

if (flag('--status')) {
  console.log('');
  console.log('Entries that are not fully supported');
  for (const e of report.statuses) if (e.status !== 'supported') console.log(`  ${e.status.padEnd(8)} ${e.kind} ${e.id}: ${e.notes.join('; ')}`);
}

const numbers = gateNumbers(report);
if (flag('--update-baseline')) {
  const values = Object.fromEntries(Object.entries(numbers).map(([id, n]) => [id, n.value]));
  writeFileSync(baselinePath, JSON.stringify(values, null, 1) + '\n');
  console.log(`\nBaseline updated: ${relative(root, baselinePath)}`);
}

if (flag('--check')) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, number>;
  const worse = regressions(numbers, baseline);
  const better = improvements(numbers, baseline);
  console.log('');
  if (better.length > 0) {
    console.log('Better than the baseline (run npm run report:content -- --update-baseline to lock it in):');
    for (const line of better) console.log(`  ${line}`);
  }
  if (worse.length > 0) {
    console.error('Content quality gate FAILED. These numbers got worse than tools/content-baseline.json:');
    for (const line of worse) console.error(`  ${line}`);
    console.error('Fix the data, or, if the change is intended (for example new moves imported as unsupported), run');
    console.error('npm run report:content -- --update-baseline and explain why in the pull request.');
    process.exit(1);
  }
  console.log('Content quality gate passed: no number is worse than the baseline.');
}
