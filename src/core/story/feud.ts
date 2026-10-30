// Rival-to-rival conflicts (catalog 53): two rivals that are enemies of each other fight while you are away.
// You can back one of them, stay out of it, or use the chaos. Each feud is settled once.

import type { Content } from '../contentSchema';
import { isHostile } from '../rivals/outcome';
import type { RunState } from '../state';
import { emit } from './record';
import type { Rival } from './schema';

export type FeudChoice = 'first' | 'second' | 'stay-out' | 'exploit';

const settled = (a: string, b: string) => `feud:${a}:${b}`;
const nameOf = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;

/** The first unsettled feud between (the stronger rival first, the underdog second) two rivals who are both still in the running (null: none). */
export function openFeud(run: RunState): [Rival, Rival] | null {
  for (const edge of run.story.rivalGraph) {
    if (edge.kind !== 'enemies' || run.story.flags[settled(edge.a, edge.b)]) continue;
    const a = run.story.rivals.find((r) => r.id === edge.a);
    const b = run.story.rivals.find((r) => r.id === edge.b);
    if (a && b && isHostile(a) && isHostile(b)) return a.rivalPotential >= b.rivalPotential ? [a, b] : [b, a];
  }
  return null;
}

/** Settles the open feud your way (mutates `run`). Returns what happened in words. */
export function settleFeud(content: Content, run: RunState, choice: FeudChoice): string {
  const feud = openFeud(run);
  if (!feud) return '';
  const [a, b] = feud;
  run.story.flags[settled(a.id, b.id)] = choice;
  const say = (text: string, importance = 70) => emit(content, run, 'storyMoment', { actors: [], data: { def: 'rival-feud', suppressed: false }, importance, text });
  if (choice === 'first' || choice === 'second') {
    const [friend, foe] = choice === 'first' ? [a, b] : [b, a];
    friend.state = 'ally';
    foe.rivalPotential = Math.min(100, foe.rivalPotential + 10);
    say(`You backed ${nameOf(content, friend)} against ${nameOf(content, foe)}. ${nameOf(content, friend)} is now your ally`, 80);
    return `${nameOf(content, friend)} is your ally, and ${nameOf(content, foe)} will remember it`;
  }
  if (choice === 'exploit') {
    for (const r of feud) r.rivalPotential = Math.min(100, r.rivalPotential + 6);
    say(`You used the feud between ${nameOf(content, a)} and ${nameOf(content, b)} for your own gain`);
    return `${nameOf(content, a)} and ${nameOf(content, b)} both noticed what you did`;
  }
  say(`You stayed out of the feud between ${nameOf(content, a)} and ${nameOf(content, b)}`, 60);
  return 'You stay out of it. The feud cools by itself';
}
