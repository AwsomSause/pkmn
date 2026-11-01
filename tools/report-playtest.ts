// Balance dashboard from the playtest logs: `node tools/report-playtest.ts` writes docs/quality/playtest/dashboard.html.
// `--check` only parses the logs and fails when a log has no usable line.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dashboardHtml, parseLines, summarize, type PlaytestLine } from '../src/quality/playtestDashboard.ts';

const dir = new URL('../docs/quality/playtest/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
const all: PlaytestLine[] = [];
for (const f of files) {
  const { lines, skipped } = parseLines(readFileSync(dir + f, 'utf8'));
  if (lines.length === 0) {
    console.error(`${f}: no usable lines`);
    process.exit(1);
  }
  if (skipped) console.warn(`${f}: ${skipped} lines skipped`);
  all.push(...lines);
}
const summary = summarize(all);
if (process.argv.includes('--check')) {
  console.log(`playtest logs ok: ${summary.runs} runs in ${files.length} files`);
} else {
  writeFileSync(dir + 'dashboard.html', dashboardHtml(summary, files));
  console.log(`wrote docs/quality/playtest/dashboard.html (${summary.runs} runs)`);
}
