// Rival simulation report (Rivalry Engine phase 13): what the rival system did over one finished run, and any state
// that contradicts its own rules. `tools/report-rivals.ts` runs it over many autoplayed seeds; a unit test keeps the
// contradiction list empty. Read-only: it never changes the run.

import type { RunState } from '../state';
import { RivalSchema } from '../story/schema';
import { isHostile } from './outcome';
import { everUltimateFlag, ULTIMATE_FLAG, ultimateDoneFlag, ultimateQuest } from './ultimate';

export interface RivalRunStats {
  rivals: number;
  /** Rival battles fought (sum of encounters). */
  encounters: number;
  states: Record<string, number>;
  resolutions: { good: number; bad: number; open: number };
  ranks: Record<string, number>;
  /** The run named an Ultimate Rival at some point. */
  ultimate: boolean;
  /** The Ultimate Rival quest chain was completed. */
  ultimateSettled: boolean;
  /** Rivals sharing a trainer class and name with another rival of the same run. */
  repeats: number;
  /** Rules the rival state breaks; should always be empty. */
  contradictions: string[];
}

const bump = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

export function rivalRunStats(run: RunState): RivalRunStats {
  const rivals = run.story.rivals;
  const flags = run.story.flags;
  const contradictions: string[] = [];
  const states: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const resolutions = { good: 0, bad: 0, open: 0 };
  const ids = new Set<string>();
  const names = new Map<string, number>();
  for (const r of rivals) {
    if (ids.has(r.id)) contradictions.push(`duplicate rival id ${r.id}`);
    ids.add(r.id);
    names.set(`${r.classId}:${r.name}`, (names.get(`${r.classId}:${r.name}`) ?? 0) + 1);
    if (!RivalSchema.safeParse(r).success) contradictions.push(`${r.id} fails the rival schema`);
    bump(states, r.state);
    if (r.rank) bump(ranks, r.rank);
    const res = r.arc?.resolution;
    if (res) resolutions[res]++;
    else resolutions.open++;
    if (flags[ultimateDoneFlag(r.id)] && !ultimateQuest(run, r).every((s) => s.done)) contradictions.push(`${r.id} settled the Ultimate quest without finishing it`);
    if (flags[ultimateDoneFlag(r.id)] && !flags[everUltimateFlag(r.id)]) contradictions.push(`${r.id} settled the Ultimate quest without being chosen`);
  }
  const ult = flags[ULTIMATE_FLAG];
  if (typeof ult === 'string') {
    const r = rivals.find((x) => x.id === ult);
    if (!r) contradictions.push(`Ultimate Rival ${ult} is not a rival of this run`);
    else if (!isHostile(r)) contradictions.push(`Ultimate Rival ${ult} is ${r.state}, but the rivalry has ended`);
  }
  if ((ranks.champion ?? 0) > 1) contradictions.push(`${ranks.champion} rivals hold the Champion rank`);
  return {
    rivals: rivals.length,
    encounters: rivals.reduce((n, r) => n + r.encounters, 0),
    states,
    resolutions,
    ranks,
    ultimate: rivals.some((r) => flags[everUltimateFlag(r.id)]),
    ultimateSettled: rivals.some((r) => flags[ultimateDoneFlag(r.id)]),
    repeats: [...names.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0),
    contradictions,
  };
}
