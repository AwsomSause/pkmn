// Design QA report (catalog #145): for each row of docs/plans/catalog-coverage.md, what is built and what is still open.
// A plan file is not a completion claim: this only reads the tracker's own words (DONE / PART / TODO) and tests/ for evidence.
//
//   npm run report:qa

import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const text = readFileSync(`${root}docs/plans/catalog-coverage.md`, 'utf8');
const count = (s: string, word: string) => (s.match(new RegExp(`\\b${word}\\b`, 'g')) ?? []).length;

let rows = 0;
let open = 0;
for (const line of text.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length < 4 || !/^\d/.test(cells[1] ?? '')) continue;
  rows++;
  const [, items, area, status] = cells as [string, string, string, string];
  const done = count(status, 'DONE');
  const todo = count(status, 'TODO');
  const part = count(status, 'PART');
  if (todo > 0 || part > 0) open++;
  console.log(`${items.padEnd(10)} ${area.slice(0, 34).padEnd(34)} done ${String(done).padStart(2)}  part ${part}  todo ${String(todo).padStart(2)}`);
}
console.log(`\n${rows} rows, ${open} with work still open. Details and known limits: docs/plans/catalog-coverage.md`);
