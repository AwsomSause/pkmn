// Performance budget (catalog #137): how much is loaded up front (eager) versus on demand (lazy), by category,
// checked against a budget so the start-up load cannot grow unnoticed.
//
//   npm run report:perf         print the report, exit 1 when over budget

import { readFileSync, statSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const EAGER_MB_BUDGET = Number(process.env.EAGER_MB_BUDGET ?? 25);
const manifest = JSON.parse(readFileSync(`${root}public/assets/manifest.json`, 'utf8')) as { assets: { id: string; kind: string; category: string; path: string; lazy?: boolean }[] };

const size = (path: string): number => {
  try {
    return statSync(`${root}public/assets/${path}`).size;
  } catch {
    return 0;
  }
};
const rows = new Map<string, { eager: number; eagerBytes: number; lazy: number; lazyBytes: number }>();
for (const a of manifest.assets) {
  const r = rows.get(a.category) ?? { eager: 0, eagerBytes: 0, lazy: 0, lazyBytes: 0 };
  if (a.lazy) {
    r.lazy++;
    r.lazyBytes += size(a.path);
  } else {
    r.eager++;
    r.eagerBytes += size(a.path);
  }
  rows.set(a.category, r);
}
const mb = (n: number) => (n / 1048576).toFixed(1);
let eagerTotal = 0;
for (const [cat, r] of [...rows].sort((a, b) => b[1].eagerBytes - a[1].eagerBytes)) {
  eagerTotal += r.eagerBytes;
  console.log(`${cat.padEnd(14)} eager ${String(r.eager).padStart(5)} files ${mb(r.eagerBytes).padStart(6)} MB   lazy ${String(r.lazy).padStart(5)} files ${mb(r.lazyBytes).padStart(6)} MB`);
}
console.log(`\nEager total ${mb(eagerTotal)} MB${EAGER_MB_BUDGET ? ` (budget ${EAGER_MB_BUDGET} MB)` : ''}`);
if (EAGER_MB_BUDGET && eagerTotal / 1048576 > EAGER_MB_BUDGET) {
  console.error('Over the start-up budget: make more assets lazy.');
  process.exit(1);
}
