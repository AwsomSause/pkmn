// Story S20: plays a backstory module through every Story Stop of a Story Run without fights, answering each choice with a strategy.
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { activeScene, chooseBackstory, finishScene, queueStopScene } from '../../src/core/story2/module';
import { content } from './helpers';

type Eff = { kind: string; counter?: string; key?: string; character?: string; attr?: string; amount?: number; value?: unknown };
export type Pick = (choices: { id: string; effects: Eff[] }[], at: number) => number;

/** The grid keys of a module (flags and relationship attributes the ending rows read). */
export function gridKeys(backstory: string): string[] {
  const m = content.storyData.backstories.find((b) => b.id === backstory)!;
  const keys = new Set<string>();
  for (const r of m.endingGrid) for (const c of r.when as { kind: string; key?: string; character?: string }[]) keys.add(c.kind === 'relationship' ? `rel:${c.character}:${c.key}` : String(c.key));
  return [...keys];
}

/** A strategy that steers one grid key up (+1) or down (-1); ties take the first choice. */
export const steer = (key: string, dir: 1 | -1): Pick => (choices) => {
  const score = (effects: Eff[]): number => effects.reduce((a, e) => {
    if (e.kind === 'add_counter' && e.counter === key) return a + Number(e.amount ?? 0);
    if (e.kind === 'add_relationship' && `rel:${e.character}:${e.attr}` === key) return a + Number(e.amount ?? 0);
    if (e.kind === 'set_flag' && e.key === key) return a + (e.value === true ? 1 : e.value === false ? -1 : 1);
    return a;
  }, 0);
  let best = 0;
  choices.forEach((c, i) => { if (dir * score(c.effects) > dir * score(choices[best]!.effects)) best = i; });
  return best;
};

export function newStoryRun(seed: string, backstory: string): RunState {
  const run = chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', campaignId: 'orrery-circuit' }), 0);
  chooseBackstory(content, run, backstory);
  return run;
}

/** Plays every Stop in order. `finale`: the Champion outcome set just before the Epilogue ('won', 'lost' or none). Returns the scene ids played. */
export function playModule(run: RunState, pick: Pick, finale?: 'won' | 'lost'): string[] {
  const v2 = run.story.v2!;
  const played: string[] = [];
  const drain = (): void => {
    for (let guard = 0; guard < 4 && v2.module!.active; guard++) {
      const s = activeScene(content, run)!;
      played.push(s.eventId);
      const ev = content.storyData.events.find((e) => e.id === s.eventId)!;
      const choices = s.choices.map((c) => ({ id: c.id, effects: ((ev.choices ?? []).find((x) => x.id === c.id)?.effects ?? []) as Eff[] }));
      // Strategies alternate by the backstory's own scenes: the partner's Starter arc scenes (any line) and world scenes do not shift that count.
      const at = played.filter((id) => !content.storyData.events.find((e) => e.id === id)?.tags.some((t) => t === 'starter_arc' || t === 'world')).length;
      finishScene(content, run, choices.length > 0 ? choices[pick(choices, at)]!.id : undefined);
    }
  };
  drain();
  v2.blueprint!.stops.forEach((stop, i) => {
    if (stop.slotTags.includes('epilogue') && finale) v2.facts[finale === 'won' ? 'championship_won' : 'final_loss'] = true;
    v2.stops.done.push(stop.id);
    v2.stops.index = i + 1;
    queueStopScene(content, run, stop.id);
    drain();
  });
  return played;
}

/** Every ending the module reaches over the steering strategies and `randomSeeds` seeded random answerers, with the Champion won, lost and neither. */
export function reachedEndings(backstory: string, randomSeeds = 60): Map<string, number> {
  const out = new Map<string, number>();
  const note = (run: RunState): void => { const e = run.story.v2!.module!.ending ?? 'NONE'; out.set(e, (out.get(e) ?? 0) + 1); };
  const finales = [undefined, 'won', 'lost'] as const;
  const keys = gridKeys(backstory);
  const strategies: [string, Pick][] = [['first', () => 0], ['last', (c) => c.length - 1]];
  for (const k of keys) { strategies.push([`max:${k}`, steer(k, 1)], [`min:${k}`, steer(k, -1)]); }
  // Steer two keys at once: the first key up and each other key up or down (a Heir needs Legacy up and a win, a Third Way needs two meters up).
  for (const a of keys) for (const b of keys) if (a !== b) { const sa = steer(a, 1); strategies.push([`${a}+${b}`, (c, at) => (at % 2 === 0 ? sa(c, at) : steer(b, 1)(c, at))]); }
  strategies.forEach(([name, pick], si) => {
    for (const f of finales) { const run = newStoryRun(`ac-${backstory}-${si}`, backstory); playModule(run, pick, f); note(run); void name; }
  });
  for (let i = 0; i < randomSeeds; i++) {
    const run = newStoryRun(`acr-${backstory}-${i}`, backstory);
    const rnd = (c: { id: string }[], at: number): number => Math.floor(Math.abs(Math.sin(i * 131 + at * 17)) * 1000) % c.length;
    playModule(run, rnd, finales[i % 3]);
    note(run);
  }
  return out;
}
