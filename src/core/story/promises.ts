// The Pokémon Promise system (Techno blueprint §6.6): a Pokémon that keeps losing to the same
// species wants a rematch. It is an optional goal; keeping it earns a memory and a legacy moment.
// Tallies live in story flags (`lostTo:<uid>:<species>`), so nothing is lost on save.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';

export const lostToFlag = (uid: string, speciesId: string) => `lostTo:${uid}:${speciesId}`;
export const promiseDoneFlag = (uid: string, speciesId: string) => `promise:done:${uid}:${speciesId}`;

/** How many times a Pokémon must lose to the same species before it makes a promise. */
export const PROMISE_AFTER = 2;

/** Records that `uid` was knocked out by `speciesId` (mutates `run`). */
export function noteLoss(run: RunState, uid: string, speciesId: string): void {
  const key = lostToFlag(uid, speciesId);
  run.story.flags[key] = Number(run.story.flags[key] ?? 0) + 1;
}

export const lossesTo = (run: RunState, uid: string, speciesId: string): number => Number(run.story.flags[lostToFlag(uid, speciesId)] ?? 0);

/** The species this Pokémon has promised to beat (null: none open). */
export function promiseOf(run: RunState, uid: string): string | null {
  let best: { id: string; n: number } | null = null;
  const prefix = `lostTo:${uid}:`;
  for (const [key, value] of Object.entries(run.story.flags)) {
    if (!key.startsWith(prefix) || typeof value !== 'number' || value < PROMISE_AFTER) continue;
    const id = key.slice(prefix.length);
    if (run.story.flags[promiseDoneFlag(uid, id)]) continue;
    if (!best || value > best.n || (value === best.n && id < best.id)) best = { id, n: value };
  }
  return best?.id ?? null;
}

/** Open promises in the party, as readable lines. */
export function promiseLines(content: Content, run: RunState): string[] {
  const out: string[] = [];
  for (const m of run.party) {
    const target = promiseOf(run, m.uid);
    if (target) out.push(`${content.species.get(m.speciesId)?.name ?? m.speciesId} promised to beat ${content.species.get(target)?.name ?? target}`);
  }
  return out;
}

/** The wild species that has beaten your party most (null: none). Ties go to the species listed first. */
export function oldFoe(run: RunState): string | null {
  const tally = new Map<string, number>();
  for (const [key, value] of Object.entries(run.story.flags)) {
    if (!key.startsWith('lostTo:') || typeof value !== 'number' || value < 1) continue;
    const id = key.split(':')[2]!;
    tally.set(id, (tally.get(id) ?? 0) + value);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
