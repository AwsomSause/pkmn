// Run Journal, Hall of Memories, Memory Lane and the Archive of Fallen Trainers (APPROVED.md §3). Everything here is
// read from the frozen legacy records (core/legacyRuns.ts): nothing rolls a random number or touches a run in play.

import type { Content } from '../contentSchema';
import { legacyAce, legacyScore, accomplishments } from '../legacyRuns';
import type { LegacyRun } from '../state';
import { MEMORIES } from './schema';

const species = (content: Content, id: string) => content.species.get(id)?.name ?? id;
const trainerName = (content: Content, r: LegacyRun) => content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId;
const regionName = (content: Content, r: LegacyRun) => {
  const id = r.regionOrder[Math.min(r.regionReached, Math.max(0, r.regionOrder.length - 1))];
  return id ? (content.regions.get(id)?.name ?? id) : 'an unknown region';
};

/** The run's journal entry, written for the player: outcome, team, Ace, rivals, rescues and milestones (nothing typed by hand). */
export function journalEntry(content: Content, r: LegacyRun): { title: string; lines: string[] } {
  const ace = legacyAce(r);
  const lines: string[] = [];
  lines.push(r.outcome === 'victory'
    ? `${trainerName(content, r)} became Champion after ${r.encounters} encounters.`
    : `${trainerName(content, r)} fell in ${regionName(content, r)} after ${r.encounters} encounters${r.defeatedBy ? `, to ${r.defeatedBy.trainer ? `${r.defeatedBy.trainer}'s ` : 'a wild '}${species(content, r.defeatedBy.speciesId)} (Lv ${r.defeatedBy.level})` : ''}.`);
  if (r.team.length) lines.push(`Team: ${r.team.map((m) => `${species(content, m.speciesId)} Lv ${m.level}${m.shiny ? ' ✦' : ''}`).join(', ')}.`);
  if (ace) lines.push(`Ace: ${species(content, ace.speciesId)}${ace.knockouts ? `, ${ace.knockouts} knockouts` : ''}${ace.bossesBeaten ? `, ${ace.bossesBeaten} bosses beaten` : ''}.`);
  for (const rv of r.rivals.filter((x) => x.encounters > 0).slice(0, 3)) {
    lines.push(`Rival ${rv.name}: met ${rv.encounters} time${rv.encounters === 1 ? '' : 's'}${rv.lastResult ? `, last fight ${rv.lastResult === 'win' ? 'won' : 'lost'}` : ''}${rv.rank ? `, later a ${rv.rank === 'gymLeader' ? 'Gym Leader' : rv.rank}` : ''}.`);
  }
  for (const n of r.nemeses.slice(0, 2)) lines.push(`Nemesis: ${species(content, n.speciesId)}${n.settledAs ? `, ${n.settledAs}` : ', never settled'}.`);
  const rescued = r.narrative.filter((id) => /rescue|saved|adopt|join/i.test(id)).length;
  if (rescued) lines.push(`Rescued or taken in: ${rescued} time${rescued === 1 ? '' : 's'}.`);
  if (r.legendaries.caught.length) lines.push(`Legendaries caught: ${r.legendaries.caught.map((s) => species(content, s)).join(', ')}.`);
  lines.push(...accomplishments(content, r).slice(0, 3));
  if (r.epitaph) lines.push(r.epitaph);
  return { title: `${trainerName(content, r)} · ${r.endedAt.slice(0, 10)}`, lines };
}

export interface Vignette {
  runId: string;
  title: string;
  /** The scene, one short line at a time (Enter moves on). */
  lines: string[];
  speciesId: string | null;
  score: number;
}

/** One selected run as a short story: its best three moments and how it ended. Memorable beats routine. */
export function vignetteOf(content: Content, r: LegacyRun): Vignette {
  const moments = r.moments.length ? r.moments.map((m) => m.text) : r.chronicle.slice(0, 3).map((c) => c.text);
  const ace = legacyAce(r);
  const lines = [
    `${trainerName(content, r)} set out${r.starter ? ` with ${species(content, r.starter.speciesId)}` : ''}.`,
    ...moments.slice(0, 4),
    r.outcome === 'victory' ? `And stood at the top of ${regionName(content, r)}.` : `The road ended in ${regionName(content, r)}.`,
  ];
  return { runId: r.runId, title: `${trainerName(content, r)}'s ${r.outcome === 'victory' ? 'triumph' : 'last stand'}`, lines, speciesId: ace?.speciesId ?? null, score: 0 };
}

/** Hall of Memories: the runs worth retelling (best Legacy Scores, close calls first among equals), as vignettes. */
export function hallOfMemories(content: Content, records: readonly LegacyRun[]): Vignette[] {
  return records
    .filter((r) => r.moments.length > 0 || r.chronicle.length > 0)
    .map((r) => ({ r, score: legacyScore(content, r) + r.stats.survivedFatal * 3 + r.stats.closeCalls }))
    .filter((x) => x.score >= MEMORIES.hall.minScore)
    .sort((a, b) => b.score - a.score || b.r.endedAt.localeCompare(a.r.endedAt))
    .slice(0, MEMORIES.hall.size)
    .map(({ r, score }) => ({ ...vignetteOf(content, r), score }));
}

export interface LaneMemory {
  id: string;
  runId: string;
  label: string;
  kind: 'moment' | 'replay' | 'chronicle';
  /** The scene lines to show. */
  lines: string[];
  speciesId: string | null;
}

/** Memory Lane: the moments the player lived, newest run first (key moments, kept chronicle entries, battle recaps). */
export function memoryLane(content: Content, records: readonly LegacyRun[]): LaneMemory[] {
  const out: LaneMemory[] = [];
  for (const r of records) {
    const who = trainerName(content, r);
    r.moments.forEach((m, i) => out.push({ id: `${r.runId}:m${i}`, runId: r.runId, label: `${who}: ${m.kind.replace(/([A-Z])/g, ' $1').toLowerCase()}`, kind: 'moment', lines: [m.text], speciesId: m.speciesId }));
    r.replays.forEach((p, i) => out.push({ id: `${r.runId}:p${i}`, runId: r.runId, label: `${who}: ${p.title}`, kind: 'replay', lines: [`${p.outcome === 'win' ? 'Won' : 'Lost'} in ${p.turns} turns.`, ...p.lines], speciesId: p.team[0] ?? null }));
    r.chronicle.slice(0, 3).forEach((c, i) => out.push({ id: `${r.runId}:c${i}`, runId: r.runId, label: `${who}: ${c.type}`, kind: 'chronicle', lines: [c.text], speciesId: null }));
  }
  return out;
}

export interface FallenTrainer {
  runId: string;
  trainer: string;
  classId: string;
  region: string;
  team: { speciesId: string; level: number }[];
  /** The victories worth naming (bosses, rivals, nemeses) and the opponent that ended the run. */
  victories: string[];
  finalOpponent: string;
  summary: string;
}

/** Archive of Fallen Trainers: every lost run keeps its Trainer, party, best victories, final opponent and a summary. */
export function fallenTrainers(content: Content, records: readonly LegacyRun[]): FallenTrainer[] {
  return records.filter((r) => r.outcome === 'defeat').map((r) => {
    const wins = [
      r.bosses.gym ? `${r.bosses.gym} Gym Leader${r.bosses.gym === 1 ? '' : 's'}` : '',
      r.bosses.elite ? `${r.bosses.elite} of the Elite Four` : '',
      ...r.rivals.filter((x) => x.lastResult === 'win').map((x) => `Rival ${x.name}`),
      ...r.nemeses.filter((n) => n.settledAs).map((n) => `Nemesis ${species(content, n.speciesId)}`),
      ...r.chronicle.filter((c) => /^Defeated /.test(c.text)).map((c) => c.text.replace(/^Defeated /, '')),
    ].filter(Boolean);
    const unique = [...new Set(wins)].slice(0, MEMORIES.fallen.wins);
    const by = r.defeatedBy;
    const finalOpponent = by ? `${by.trainer ? `${by.trainer}'s ` : 'a wild '}${species(content, by.speciesId)} (Lv ${by.level})` : 'unknown';
    return {
      runId: r.runId,
      trainer: trainerName(content, r),
      classId: r.archetypeId,
      region: regionName(content, r),
      team: r.team.map((m) => ({ speciesId: m.speciesId, level: m.level })),
      victories: unique,
      finalOpponent,
      summary: r.epitaph ?? `${trainerName(content, r)} won ${r.battlesWon} battle${r.battlesWon === 1 ? '' : 's'} and fell in ${regionName(content, r)} to ${finalOpponent}.`,
    };
  });
}
