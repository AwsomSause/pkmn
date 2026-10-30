// The quality dashboard (Electric plan §9, "have Claude build its own quality dashboard"):
// one self-contained HTML page with every check's count, the offending ids, the support
// status of each kind, and every mechanic with its proof. Pure: it only turns a report into text.

import type { ContentReport } from './contentReport';
import { SUPPORT_STATUSES } from './supportStatus';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function dashboardHtml(report: ContentReport, baseline: Record<string, number>, generated: string): string {
  const rows = report.checks
    .map((c) => {
      const before = baseline[c.id];
      const trend = before === undefined ? 'new' : c.count < before ? `better (was ${before})` : c.count > before ? `WORSE (was ${before})` : 'same';
      const ids = c.offenders.length === 0 ? '' : `<details><summary>${c.offenders.length} ids</summary><ul>${c.offenders.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></details>`;
      return `<tr class="${c.count === 0 ? 'ok' : 'find'}"><td>${esc(c.title)}<br><small>${esc(c.id)}</small></td><td class="n">${c.count}</td><td>${trend}</td><td>${esc(c.explain)}${ids}</td></tr>`;
    })
    .join('');
  const status = Object.entries(report.summary)
    .map(([kind, c]) => `<tr><td>${esc(kind)}</td>${SUPPORT_STATUSES.map((s) => `<td class="n ${s}">${c[s]}</td>`).join('')}</tr>`)
    .join('');
  const mechanics = report.statuses
    .filter((e) => e.kind === 'mechanic')
    .map((e) => `<tr class="${e.status}"><td>${esc(e.id)}</td><td>${e.status}</td><td>${esc(e.notes.join('; '))}</td></tr>`)
    .join('');
  const worse = report.checks.filter((c) => baseline[c.id] !== undefined && c.count > baseline[c.id]!).length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quality dashboard</title>
<style>
:root{--bg:#f4f7fb;--fg:#17212b;--card:#fff;--line:#d5deea;--ok:#1d7a46;--bad:#b3261e;--warn:#9a6a00}
@media (prefers-color-scheme:dark){:root{--bg:#10161d;--fg:#e6edf5;--card:#18212b;--line:#2b3846;--ok:#5fd18d;--bad:#ff8a80;--warn:#f0c15a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
h1,h2{margin:.6em 0 .3em}table{border-collapse:collapse;width:100%;background:var(--card);margin-bottom:16px}
td,th{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.n{text-align:right;font-variant-numeric:tabular-nums}
tr.ok td:first-child{border-left:4px solid var(--ok)}tr.find td:first-child{border-left:4px solid var(--bad)}
.invalid{color:var(--bad)}.disabled,.limited{color:var(--warn)}.supported{color:var(--ok)}
details ul{max-height:14em;overflow:auto;margin:.3em 0;padding-left:1.2em}small{opacity:.7}
.wrap{overflow-x:auto}
</style></head><body>
<h1>Quality dashboard</h1>
<p>Made by <code>npm run report:dashboard</code> on ${esc(generated)}. ${report.checks.filter((c) => c.count > 0).length} of ${report.checks.length} checks have findings; ${worse} are worse than the baseline.</p>
<h2>Support status</h2><div class="wrap"><table><tr><th>Kind</th>${SUPPORT_STATUSES.map((s) => `<th class="n">${s}</th>`).join('')}</tr>${status}</table></div>
<h2>Checks</h2><div class="wrap"><table><tr><th>Check</th><th class="n">Count</th><th>Vs baseline</th><th>What it means</th></tr>${rows}</table></div>
<h2>Mechanics</h2><div class="wrap"><table><tr><th>Mechanic</th><th>Status</th><th>Notes</th></tr>${mechanics}</table></div>
</body></html>
`;
}
