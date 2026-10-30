// The Grand-Enemy (Techno blueprint §5): one campaign-long threat with five phases. It never
// appears as a battle of its own; it shows through the region bosses it influences, and it
// remembers the Pokémon that stood against that influence (its Grudge). Phases follow how far
// through the campaign the run is, so the same run always sees the same story.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from './record';

export type GrandPhase = 'omen' | 'firstContact' | 'escalation' | 'reckoning' | 'legacy';

/** How far through the campaign (0 to 1) the run is, by region. */
export function campaignProgress(run: RunState): number {
  return run.regionOrder.length <= 1 ? 1 : run.regionIndex / (run.regionOrder.length - 1);
}

export function grandPhase(content: Content, run: RunState): GrandPhase {
  if (run.victory) return 'legacy';
  const p = campaignProgress(run);
  const c = content.story.grandEnemy;
  if (p >= 1) return 'reckoning';
  if (p >= c.escalationFrom) return 'escalation';
  if (p >= c.contactFrom) return 'firstContact';
  return 'omen';
}

const fought = (uid: string) => `ge:fought:${uid}`;

/** Times this Pokémon led against a boss the Grand-Enemy was influencing. */
export const stoodAgainst = (run: RunState, uid: string): number => Number(run.story.flags[fought(uid)] ?? 0);

/** Called on the first turn of a boss fight; returns which Grand-Enemy moment (if any) to fire. */
export function grandMoment(content: Content, run: RunState, leadUid: string): 'grandOmen' | 'grandShadow' | 'grandGrudge' | null {
  const phase = grandPhase(content, run);
  if (phase === 'omen') return 'grandOmen';
  if (phase === 'legacy') return null;
  run.story.flags[fought(leadUid)] = stoodAgainst(run, leadUid) + 1;
  const h = run.story.histories[leadUid];
  // Its Grudge: a Pokémon that already stood against the influence twice, and has real boss wins, is remembered.
  if (phase === 'reckoning' && h && stoodAgainst(run, leadUid) > content.story.grandEnemy.grudgeAfter && h.bossesBeaten >= 1) return 'grandGrudge';
  return phase === 'firstContact' ? 'grandOmen' : 'grandShadow';
}

/** At the end of a victorious run: the Pokémon that stood against it most carries the title, and the archive records the outcome. */
export function recordGrandLegacy(content: Content, run: RunState): void {
  if (!run.victory) return;
  const c = content.story.grandEnemy;
  let best: { uid: string; n: number } | null = null;
  for (const m of run.party) {
    const n = stoodAgainst(run, m.uid);
    if (n > 0 && (!best || n > best.n)) best = { uid: m.uid, n };
  }
  if (best) {
    const h = run.story.histories[best.uid];
    if (h && !h.titles.includes(c.title)) h.titles.push(c.title);
  }
  const name = best ? (content.species.get(run.story.histories[best.uid]?.speciesId ?? '')?.name ?? 'A Pokémon') : null;
  emit(content, run, 'storyMoment', {
    actors: best ? [best.uid] : [],
    data: { def: 'grand-enemy-legacy', suppressed: false },
    importance: 90,
    text: `${c.name} was turned back${name ? `; ${name} stood against it the longest` : ''}`,
  });
}
