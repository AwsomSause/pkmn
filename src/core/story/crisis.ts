// Regional Crisis and the Rival Tournament Circuit (Techno §7A/§7B, Electric §2E).
// Both are small counters kept in story flags, moved by event choices and read by events and boss fights.
//  - Crisis: each region has a meter (0 to 5) that rises by one every stage the player spends in it. Event choices
//    lower it (helping) or raise it (ignoring), and build Aid (allies and supplies). The region's boss is empowered by a
//    high meter, and a party that gathered Aid is steadied by it.
//  - Tournament: a three-round bracket (entered at an event, then one round per stage) ending in a final.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from './record';
import { circuitRanking } from './highHype';

export const CRISIS_MAX = 5;
const crisisKey = (run: RunState) => `crisis:${run.regionIndex}`;
const aidKey = (run: RunState) => `crisis:aid:${run.regionIndex}`;
const numFlag = (run: RunState, key: string): number => Number(run.story.flags[key] ?? 0);

export const crisisLevel = (run: RunState): number => numFlag(run, crisisKey(run));
export const crisisAid = (run: RunState): number => numFlag(run, aidKey(run));

/** Moves the region's crisis meter (clamped), telling the chronicle when it crosses into a worse state. */
export function changeCrisis(content: Content, run: RunState, amount: number): number {
  const before = crisisLevel(run);
  const after = Math.max(0, Math.min(CRISIS_MAX, before + amount));
  run.story.flags[crisisKey(run)] = after;
  if (before < 3 && after >= 3) {
    emit(content, run, 'storyMoment', { actors: [], data: { def: 'crisis-grows', suppressed: false }, importance: 65, text: 'The trouble in this region has grown serious. Its leader will be ready for you' });
  } else if (before >= 3 && after < 3) {
    emit(content, run, 'storyMoment', { actors: [], data: { def: 'crisis-eases', suppressed: false }, importance: 60, text: 'The trouble in this region has eased because of your help' });
  }
  return after;
}

export function changeAid(run: RunState, amount: number): void {
  run.story.flags[aidKey(run)] = Math.max(0, crisisAid(run) + amount);
}

/** When a stage is entered (not the first of a region): the crisis worsens by one. Once per stage. */
export function growCrisis(content: Content, run: RunState): void {
  const index = run.stage?.index ?? 0;
  if (index < 1) return;
  const seen = `crisis:grew:${run.regionIndex}:${index}`;
  if (run.story.flags[seen]) return;
  run.story.flags[seen] = true;
  changeCrisis(content, run, 1);
}

/** Crisis moments for a region boss's first turn: the empowered enemy, and the steadied party. */
export function crisisMoments(run: RunState): ('crisisLoom' | 'crisisAid')[] {
  const out: ('crisisLoom' | 'crisisAid')[] = [];
  if (crisisLevel(run) >= 3) out.push('crisisLoom');
  if (crisisAid(run) >= 2) out.push('crisisAid');
  return out;
}

/** Report events that come back while the crisis is serious, one per region. */
export function crisisEventIds(run: RunState): string[] {
  return crisisLevel(run) >= 2 ? ['crisis-report-industry', 'crisis-report-flood', 'crisis-report-outbreak', 'crisis-report-blackout'] : [];
}

// ---------- tournament ----------

const ROUND = 'tour:round';
export const TOURNAMENT_DONE = 9;
export const TOURNAMENT_ROUNDS = ['tournament-quarter', 'tournament-semi', 'tournament-final'];

export const tournamentRound = (run: RunState): number => numFlag(run, ROUND);

/** Sets the bracket's state: 0 = not entered, 1 to 3 = the round waiting to be played, 9 = over. */
export function setTournament(content: Content, run: RunState, round: number): string {
  run.story.flags[ROUND] = round;
  if (round === 1) {
    const rows = circuitRanking(content, run).slice(0, 4).map((r) => r.name);
    return rows.length > 0 ? `Entered. The circuit field: ${rows.join(', ')}` : 'Entered';
  }
  if (round === TOURNAMENT_DONE) {
    const top = circuitRanking(content, run)[0];
    emit(content, run, 'storyMoment', { actors: [], data: { def: 'tournament-done', suppressed: false }, importance: 80, text: `The circuit finished${top ? ` with ${top.name} at the top of the field` : ''}` });
  }
  return round === TOURNAMENT_DONE ? 'The bracket is over' : `Round ${round} is next`;
}

/** The round event that must show up on this stage (null: no bracket running). */
export function tournamentEventId(run: RunState): string | null {
  const r = tournamentRound(run);
  return r >= 1 && r <= 3 ? TOURNAMENT_ROUNDS[r - 1]! : null;
}
