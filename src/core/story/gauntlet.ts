// Rival gauntlet (catalog 148): a chain of rivals you have already met, each back with its latest team.
// Entered at an event. The next ordinary trainer of each following stage is the next rival in the circuit ranking
// (one a stage, ignoring cooldowns), until the chain is done. Winning the last one pays the reward.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { scheduleKey } from '../rivals/adapt';
import type { Rival } from './schema';
import { circuitRanking } from './highHype';
import { emit } from './record';

const LEFT = 'gaunt:left';
const STAGE = 'gaunt:stage';
const fought = (id: string) => `gaunt:fought:${id}`;
const active = (id: string) => `gaunt:active:${id}`;
const num = (run: RunState, key: string): number => Number(run.story.flags[key] ?? 0);

export const gauntletLeft = (run: RunState): number => num(run, LEFT);

/** Starts the chain: up to `rivals` of the rivals you have fought. Returns how many will come. */
export function startGauntlet(content: Content, run: RunState, rivals: number): number {
  const field = circuitRanking(content, run).length;
  const n = Math.min(rivals, field);
  run.story.flags[LEFT] = n;
  if (n > 0) emit(content, run, 'storyMoment', { actors: [], data: { def: 'gauntlet-start', suppressed: false }, importance: 70, text: `Took on the Rival Gauntlet: ${n} rival${n === 1 ? '' : 's'} will come for you` });
  return n;
}

/** The rival that takes this stage's first ordinary trainer slot (null: no gauntlet running, or one already came this stage). */
export function gauntletRival(content: Content, run: RunState): Rival | null {
  if (gauntletLeft(run) <= 0 || run.story.flags[STAGE] === scheduleKey(run)) return null;
  const order = circuitRanking(content, run);
  for (const row of order) {
    const rival = run.story.rivals.find((r) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}` === row.name && !run.story.flags[fought(r.id)]);
    if (rival) return rival;
  }
  return null;
}

/** When a gauntlet rival is chosen for a fight (mutates `run`). */
export function markGauntletFight(run: RunState, rival: Rival): void {
  run.story.flags[STAGE] = scheduleKey(run);
  run.story.flags[fought(rival.id)] = true;
  run.story.flags[active(rival.id)] = true;
}

/** After a win over a gauntlet rival: counts it down and pays the reward when the chain is done. Returns a message or null. */
export function gauntletWon(content: Content, run: RunState, rivalId: string): string | null {
  if (!run.story.flags[active(rivalId)]) return null;
  delete run.story.flags[active(rivalId)];
  const left = Math.max(0, gauntletLeft(run) - 1);
  run.story.flags[LEFT] = left;
  if (left > 0) return `${left} rival${left === 1 ? '' : 's'} left in the gauntlet`;
  const prize = content.story.gauntlet;
  run.money += prize.money;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'gauntlet-done', suppressed: false }, importance: 85, text: `Beat every rival in the Rival Gauntlet (+₽${prize.money})` });
  return `Gauntlet cleared! +₽${prize.money}`;
}

/**
 * The Grand Region's gauntlet (catalog 93): arriving in the last region calls every rival you have met back, one per
 * stage, strongest first, each with the team it has trained since. The goal is stated up front and no rule changes:
 * the same battles you know, with familiar faces. Once per run.
 */
export function grandGauntlet(content: Content, run: RunState): void {
  if ((run.stage?.index ?? 0) !== 0 || run.regionIndex < run.regionOrder.length - 1 || run.story.flags['gaunt:grand']) return;
  run.story.flags['gaunt:grand'] = true;
  const n = startGauntlet(content, run, content.story.gauntlet.grandRivals);
  if (n === 0) return;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'grand-gauntlet', suppressed: false }, importance: 80, text: 'The Grand Region called every rival back. Beat them, then face the Champion' });
}
