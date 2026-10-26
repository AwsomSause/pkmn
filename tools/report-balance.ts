// Seeded battle simulations for balance (M8.6): species strength and the
// difficulty curve of a full campaign. Details in src/quality/balanceSim.ts.
//
//   npm run report:balance                   print the report
//   npm run report:balance -- --write        also write docs/quality/BALANCE_REPORT.md
//   npm run report:balance -- --seed <text>  use another seed (default balance-v1)
//   npm run report:balance -- --quick        fewer battles, for a fast look
//
// Read-only: it never changes the game data.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type * as Sim from '../src/quality/balanceSim.ts';
import type * as Data from '../src/data/index.ts';
import { closeModules, loadModule, root } from './lib/gameModules.ts';

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const seed = option('--seed') ?? 'balance-v1';
const quick = args.includes('--quick');

const { getContent } = await loadModule<typeof Data>('/src/data/index.ts');
const { buildBalanceReport, balanceMarkdown } = await loadModule<typeof Sim>('/src/quality/balanceSim.ts');
await closeModules();

const content = getContent();
const started = Date.now();
const report = buildBalanceReport(content, seed, quick ? { opponents: 6, trials: 5 } : {});
const markdown = balanceMarkdown(content, report);
console.log(markdown);
console.log(`(${Math.round((Date.now() - started) / 1000)} s)`);
if (args.includes('--write')) {
  const dir = join(root, 'docs', 'quality');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'BALANCE_REPORT.md');
  writeFileSync(path, markdown);
  console.log(`Wrote ${relative(root, path)}`);
}
