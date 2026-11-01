// Rival ledger (W6): everything the Hub, the run-end screen and the next run read about rivals from past runs.
// Pure functions over the frozen legacy records, so nothing here rolls a random number or writes a save.
//   I182/F126 head-to-head scoreboard, I180 the nickname a rival gives you, I176 mood from your streak,
//   I185 the letter at a run's end, I187 promises that carry across runs.

import type { LegacyRun } from '../state';

/** The few fields of a legacy record's rival the ledger reads. */
type LedgerRival = Pick<LegacyRun['rivals'][number], 'name' | 'encounters' | 'setbacks' | 'lastResult' | 'state' | 'resolution'> & { world?: LegacyRun['rivals'][number]['world'] };
import { rivalLetter, type RivalLetter } from './living';

export interface HeadToHead {
  name: string;
  /** Battles fought, won and lost by you, over every run. */
  fought: number;
  won: number;
  lost: number;
  runsMet: number;
  /** Their latest result against you, or null. */
  last: 'win' | 'lose' | null;
}

/** Head-to-head record per rival name, most fought first. A battle you lost counts as a setback; the rest were wins. */
export function headToHead(runs: readonly { rivals: readonly LedgerRival[] }[]): HeadToHead[] {
  const by = new Map<string, HeadToHead>();
  for (const run of runs) {
    for (const r of run.rivals) {
      const row = by.get(r.name) ?? { name: r.name, fought: 0, won: 0, lost: 0, runsMet: 0, last: null };
      const lost = Math.min(r.encounters, r.setbacks);
      row.fought += r.encounters;
      row.lost += lost;
      row.won += r.encounters - lost;
      row.runsMet += 1;
      row.last ??= r.lastResult;
      by.set(r.name, row);
    }
  }
  return [...by.values()].filter((r) => r.fought > 0).sort((a, b) => b.fought - a.fought || a.name.localeCompare(b.name));
}

/** One line for the Hub or Hall of Fame. */
export function scoreboardLine(row: HeadToHead): string {
  return `${row.name}: you ${row.won}, them ${row.lost} (${row.fought} battle${row.fought === 1 ? '' : 's'} over ${row.runsMet} run${row.runsMet === 1 ? '' : 's'})`;
}

const NICKNAMES = {
  none: ['Newcomer', 'Hey, you'],
  loser: ['Underdog', 'Stubborn', 'Comeback'],
  mixed: ['Challenger', 'Rival', 'Trainer'],
  winner: ['Champ', 'Hotshot', 'Big Shot'],
} as const;

/** The nickname a rival gives you. Stable between runs: it only changes when your record does. */
export function rivalNickname(runs: readonly Pick<LegacyRun, 'outcome' | 'runId'>[]): string {
  if (runs.length === 0) return NICKNAMES.none[0];
  const wins = runs.filter((r) => r.outcome === 'victory').length;
  const bucket = wins === 0 ? NICKNAMES.loser : wins * 2 >= runs.length ? NICKNAMES.winner : NICKNAMES.mixed;
  const first = runs[runs.length - 1]!.runId;
  let h = 0;
  for (const ch of first) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return bucket[h % bucket.length]!;
}

export type RivalMood = 'smug' | 'irked' | 'steady' | 'impressed';
export interface MoodView { mood: RivalMood; expression: string; streak: number }

/** The portrait face drawn beside a rival's note in the Hub (plain characters, so no art asset is needed). */
export const MOOD_FACE: Record<RivalMood, string> = { smug: '(¬‿¬)', irked: '(`⌒´)', steady: '(•_•)', impressed: '(°o°)' };

/** I176: the rival's mood follows your current streak of won (or lost) runs, newest first. The Hub shows it as an expression. */
export function rivalMood(runs: readonly Pick<LegacyRun, 'outcome'>[]): MoodView {
  const first = runs[0]?.outcome;
  if (!first) return { mood: 'steady', expression: 'a neutral look', streak: 0 };
  let streak = 0;
  for (const r of runs) { if (r.outcome !== first) break; streak += 1; }
  if (first === 'victory') return streak >= 2 ? { mood: 'impressed', expression: 'wide eyes and a grudging nod', streak } : { mood: 'irked', expression: 'a tight jaw', streak };
  return streak >= 2 ? { mood: 'smug', expression: 'a smirk they are not hiding', streak } : { mood: 'steady', expression: 'a raised eyebrow', streak };
}

/** I185: the letter a rival writes the moment a run ends, in their voice. Null when the run met no rival. */
export function endOfRunLetter(record: { rivals: readonly LedgerRival[]; outcome: LegacyRun['outcome']; seed: string }, nickname: string): RivalLetter | null {
  const rival = [...record.rivals].sort((a, b) => b.encounters - a.encounters)[0];
  if (!rival) return null;
  let seed = 0;
  for (const ch of record.seed) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const base = rivalLetter({ name: rival.name, state: rival.state, resolution: rival.resolution, world: rival.world ?? undefined }, seed);
  const close = record.outcome === 'victory' ? `You did it, ${nickname}.` : `Next time, ${nickname}.`;
  return { ...base, text: `${base.text} ${close}` };
}

// ---------- promises and notes that survive a run ----------

/** Event flags named `carry-*` are written into a finished run's record (as `flag:carry-*`) so the next run can read them. */
export function carryFlags(flags: Record<string, unknown>): string[] {
  return Object.entries(flags).filter(([k, v]) => k.startsWith('ev:carry-') && Number(v) > 0).map(([k]) => `flag:${k.slice(3)}`).sort();
}

/** The flags a new run starts with, from the newest finished run: `carry-x` becomes `inherit-x` (events read these). */
export function inheritFlags(runs: readonly Pick<LegacyRun, 'narrative' | 'source'>[]): Record<string, number> {
  const last = runs.find((r) => r.source === 'run');
  const out: Record<string, number> = {};
  for (const id of last?.narrative ?? []) if (id.startsWith('flag:carry-')) out[`ev:inherit-${id.slice('flag:carry-'.length)}`] = 1;
  return out;
}
