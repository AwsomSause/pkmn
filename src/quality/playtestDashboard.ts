// F211: balance dashboard from the playtest logs (`node tools/playtest.ts` lines). No imports, so Node can run it
// directly. Groups runs by mode, difficulty and trainer and shows how far they got.

export interface PlaytestLine {
  i?: number;
  archetypeId?: string;
  modeId?: string;
  difficultyId?: string;
  encounters?: number;
  badges?: number;
  region?: number;
  wipes?: number;
  by?: { speciesId?: string; trainer?: string | null } | null;
  error?: string;
  stuck?: boolean;
  bad?: unknown[];
  skipped?: string;
}

export interface Group {
  key: string;
  runs: number;
  avgEncounters: number;
  badgePct: number;
  problems: number;
}

export interface PlaytestSummary {
  runs: number;
  problems: number;
  byMode: Group[];
  byDifficulty: Group[];
  byTrainer: Group[];
  topKillers: { id: string; count: number }[];
}

/** Parses JSON lines; lines that are not JSON objects are counted in `skipped`. */
export function parseLines(text: string): { lines: PlaytestLine[]; skipped: number } {
  const lines: PlaytestLine[] = [];
  let skipped = 0;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try {
      const v: unknown = JSON.parse(raw);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) lines.push(v as PlaytestLine);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { lines, skipped };
}

const isProblem = (l: PlaytestLine): boolean => !!l.error || !!l.stuck || (l.bad?.length ?? 0) > 0;

function group(lines: PlaytestLine[], key: (l: PlaytestLine) => string | undefined): Group[] {
  const map = new Map<string, PlaytestLine[]>();
  for (const l of lines) {
    const k = key(l);
    if (k) map.set(k, [...(map.get(k) ?? []), l]);
  }
  return [...map]
    .map(([k, ls]) => ({
      key: k,
      runs: ls.length,
      avgEncounters: Math.round((ls.reduce((s, l) => s + (l.encounters ?? 0), 0) / ls.length) * 10) / 10,
      badgePct: Math.round((ls.filter((l) => (l.badges ?? 0) > 0).length / ls.length) * 1000) / 10,
      problems: ls.filter(isProblem).length,
    }))
    .sort((a, b) => b.runs - a.runs || a.key.localeCompare(b.key));
}

export function summarize(lines: PlaytestLine[]): PlaytestSummary {
  const killers = new Map<string, number>();
  for (const l of lines) if (l.by?.speciesId) killers.set(l.by.speciesId, (killers.get(l.by.speciesId) ?? 0) + 1);
  return {
    runs: lines.length,
    problems: lines.filter(isProblem).length,
    byMode: group(lines, (l) => l.modeId),
    byDifficulty: group(lines, (l) => l.difficultyId),
    byTrainer: group(lines, (l) => l.archetypeId).slice(0, 15),
    topKillers: [...killers].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([id, count]) => ({ id, count })),
  };
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function table(title: string, groups: Group[]): string {
  const max = Math.max(1, ...groups.map((g) => g.avgEncounters));
  const rows = groups.map((g) => `<tr><td>${esc(g.key)}</td><td>${g.runs}</td><td><span class="bar" style="width:${Math.round((g.avgEncounters / max) * 160)}px"></span> ${g.avgEncounters}</td><td>${g.badgePct}%</td><td>${g.problems}</td></tr>`).join('');
  return `<h2>${esc(title)}</h2><table><tr><th></th><th>Runs</th><th>Avg encounters</th><th>Earned a badge</th><th>Problems</th></tr>${rows}</table>`;
}

export function dashboardHtml(s: PlaytestSummary, sources: string[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Playtest balance dashboard</title>
<style>body{font:15px system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#123}table{border-collapse:collapse;width:100%}td,th{padding:4px 8px;border-bottom:1px solid #cde;text-align:left}.bar{display:inline-block;height:10px;background:#3b8be8;border-radius:5px}</style></head><body>
<h1>Playtest balance dashboard</h1><p>${s.runs} bot runs from ${sources.map(esc).join(', ')}; ${s.problems} with a crash, stuck run or broken number.</p>
${table('By mode', s.byMode)}${table('By difficulty', s.byDifficulty)}${table('By trainer (top 15)', s.byTrainer)}
<h2>Most common run enders</h2><ol>${s.topKillers.map((k) => `<li>${esc(k.id)} (${k.count})</li>`).join('')}</ol></body></html>`;
}
