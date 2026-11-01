// Counts the status of every row in docs/plans/ideas-coverage.md per workstream: `npm run report:ideas`.
// `--check` fails when a row has an unknown status or an id appears twice.
import { readFileSync } from 'node:fs';

const STATUSES = ['TODO', 'PART', 'DONE', 'DROPPED'];
const text = readFileSync(new URL('../docs/plans/ideas-coverage.md', import.meta.url), 'utf8');
let section = '';
const counts = new Map<string, Record<string, number>>();
const seen = new Set<string>();
const problems: string[] = [];
for (const line of text.split('\n')) {
  if (line.startsWith('## ')) { section = line.slice(3).replace(/\s*\(.*$/, '').trim(); counts.set(section, Object.fromEntries(STATUSES.map((s) => [s, 0]))); continue; }
  const m = /^\| ([EIMF]\d+) \|.*\| (\w+) \|[^|]*\|$/.exec(line);
  if (!m || !section) continue;
  if (!STATUSES.includes(m[2]!)) problems.push(`${m[1]}: unknown status ${m[2]}`);
  else counts.get(section)![m[2]!]!++;
  if (seen.has(m[1]!)) problems.push(`${m[1]}: duplicate row`);
  seen.add(m[1]!);
}
const total = Object.fromEntries(STATUSES.map((s) => [s, 0]));
for (const [name, c] of counts) {
  console.log(`${name.padEnd(48)} ${STATUSES.map((s) => `${s} ${c[s]}`).join('  ')}`);
  for (const s of STATUSES) total[s]! += c[s]!;
}
console.log(`${'TOTAL'.padEnd(48)} ${STATUSES.map((s) => `${s} ${total[s]}`).join('  ')} (${seen.size} rows)`);
if (problems.length) { console.error(problems.join('\n')); if (process.argv.includes('--check')) process.exit(1); }
