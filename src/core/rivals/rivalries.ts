// Rivalries between rivals (Expanded Systems §8.4): enemies duel off-screen, two rivals race for the same Gym,
// one steals another's spotlight, a repeated loser becomes obsessed, and a rival may join forces with you against
// a stronger one. Every result goes through the rival progression record (rivalProgress events). Gates hash the
// seed and stage, never gameplay RNG.

import type { Content } from '../contentSchema';
import { pickIndex } from '../drama/schema';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { Rival } from '../story/schema';
import { isHostile } from './outcome';
import { rivalProgress, rivalStatus, stageKeyOf } from './progression';
import { fillLine, RECOGNITION } from './recognition';

const title = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;
const chance = (key: string, p: number) => pickIndex(key, 10000) < Math.round(p * 10000);
const OBSESSED = (id: string) => `rivalObsessed:${id}`;
const DUEL_LOSSES = (loser: string, winner: string) => `rivalDuelL:${loser}:${winner}`;
const TEAM_UP = (helper: string, foe: string) => `rivalTeamUp:${helper}:${foe}`;

/** Who a rival is obsessed with surpassing (a rival id), or null. */
export function obsessedWith(run: RunState, rival: Rival): string | null {
  const v = run.story.flags[OBSESSED(rival.id)];
  return typeof v === 'string' ? v : null;
}

/** One stage of rival-vs-rival events. Safe to call more than once per stage. Mutates `run`; returns the news, if any. */
export function rivalRivalries(content: Content, run: RunState): string | null {
  const here = stageKeyOf(run);
  const doneKey = `rivalRivalries:${here}`;
  if (run.story.flags[doneKey] !== undefined || run.story.rivals.length < 2) return null;
  run.story.flags[doneKey] = true;
  const R = RECOGNITION.rivalries;
  const active = (r: Rival) => isHostile(r) && rivalStatus(run, r) !== 'missing';
  let news: string | null = null;
  for (const e of run.story.rivalGraph) {
    if (e.kind !== 'enemies') continue;
    const a = run.story.rivals.find((r) => r.id === e.a);
    const b = run.story.rivals.find((r) => r.id === e.b);
    if (!a || !b || !active(a) || !active(b) || !chance(`${run.seed}|duel|${here}|${a.id}|${b.id}`, R.duelChance)) continue;
    // The stronger name usually wins: fame plus ambition, with a hashed swing so upsets happen.
    const score = (r: Rival) => (r.world?.fame ?? 0) + r.traits.ambition / 10 + pickIndex(`${run.seed}|duelSwing|${here}|${r.id}`, 10);
    const [winner, loser] = score(a) >= score(b) ? [a, b] : [b, a];
    rivalProgress(content, run, winner, 'beatRival', { other: loser.id });
    rivalProgress(content, run, loser, 'lostToRival', { other: winner.id });
    news ??= fillLine(R.duel, { rival: title(content, winner), other: title(content, loser) });
    const k = DUEL_LOSSES(loser.id, winner.id);
    run.story.flags[k] = Number(run.story.flags[k] ?? 0) + 1;
    if (Number(run.story.flags[k]) >= R.obsessedAfter && !obsessedWith(run, loser)) {
      run.story.flags[OBSESSED(loser.id)] = winner.id;
      loser.traits.ambition = Math.min(100, loser.traits.ambition + 5);
      news = fillLine(R.obsessed, { rival: title(content, loser), other: title(content, winner) });
    }
  }
  const at = (r: Rival, kind: string) => (r.world?.milestones ?? []).some((m) => m.at === here && m.kind === kind);
  const byFame = [...run.story.rivals].filter(active).sort((x, y) => (y.world?.fame ?? 0) - (x.world?.fame ?? 0) || x.id.localeCompare(y.id));
  const racers = byFame.filter((r) => at(r, 'badge'));
  if (racers.length >= 2) news ??= fillLine(R.gymRace, { rival: title(content, racers[0]!), other: title(content, racers[1]!) });
  const ranked = byFame.find((r) => at(r, 'rank'));
  const star = ranked ? byFame.find((r) => r.id !== ranked.id && (r.world?.fame ?? 0) > (ranked.world?.fame ?? 0)) : undefined;
  if (ranked && star) news ??= fillLine(R.spotlight, { rival: title(content, ranked), other: title(content, star) });
  if (news) emit(content, run, 'storyMoment', { actors: [], data: { def: 'rivalRivalry' }, importance: 50, text: news });
  return news;
}

/**
 * Before a battle with a rival far ahead of you (a Champion, a Champion Candidate or `teamUpMinLead` stages
 * ahead), an ally rival or one of its enemies may join forces with you, once per pair. Returns the line, or null.
 * The caller heals your party. Mutates `run` (the once-only flag).
 */
export function rivalTeamUp(content: Content, run: RunState, foe: Rival): string | null {
  const status = rivalStatus(run, foe);
  if (status !== 'champion' && status !== 'championCandidate' && (foe.world?.lead ?? 0) < RECOGNITION.rivalries.teamUpMinLead) return null;
  const enemies = new Set(run.story.rivalGraph.filter((e) => e.kind === 'enemies' && (e.a === foe.id || e.b === foe.id)).map((e) => (e.a === foe.id ? e.b : e.a)));
  const helper = run.story.rivals.find((r) => r.id !== foe.id && r.state !== 'retired' && (r.state === 'ally' || enemies.has(r.id)) && run.story.flags[TEAM_UP(r.id, foe.id)] === undefined);
  if (!helper) return null;
  run.story.flags[TEAM_UP(helper.id, foe.id)] = true;
  const text = fillLine(RECOGNITION.rivalries.teamUp, { rival: title(content, foe), other: title(content, helper) });
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'rivalTeamUp', rival: foe.id, helper: helper.id }, importance: 55, text });
  return text;
}
