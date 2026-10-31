// Lost-and-Found Auction and Recover Something From a Previous Adventure (APPROVED.md §3): items held by Pokémon of earlier
// runs come back with their history. Each is recovered once (the run records it; the profile keeps it when the run ends).

import type { Content } from '../contentSchema';
import { addItem } from '../items';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { PastDigest } from './schema';

export type Keepsake = PastDigest['keepsakes'][number];

/** A keepsake the game can hand over: a normal item, or a supported catalog item (held items, charms). */
export function keepsakeValid(content: Content, id: string): boolean {
  return content.items.has(id) || content.catalog.get(id)?.status === 'supported';
}

export function keepsakeName(content: Content, id: string): string {
  return content.items.get(id)?.name ?? content.catalog.get(id)?.name ?? id;
}

/** Hands a keepsake to the run (mutates `run`): into the bag, onto the lead Pokémon as a held item, or as a team/player passive. */
export function grantKeepsake(content: Content, run: RunState, id: string): boolean {
  if (content.items.has(id)) {
    addItem(run.inventory, id, 1);
    return true;
  }
  const entry = content.catalog.get(id);
  if (!entry || entry.status !== 'supported') return false;
  if (entry.stacksOn === 'pokemon') {
    const lead = run.party.find((m) => m.hp > 0) ?? run.party[0];
    if (!lead) return false;
    lead.held = { ...lead.held, [id]: (lead.held?.[id] ?? 0) + 1 };
  } else {
    run.passives = { ...run.passives, [id]: (run.passives?.[id] ?? 0) + 1 };
  }
  return true;
}

/** The next keepsake not yet recovered this run (the oldest in the digest), or null. */
export function nextKeepsake(run: RunState, skip: readonly string[] = []): Keepsake | null {
  const past = run.past;
  return past?.keepsakes.find((k) => !past.used.includes(k.id) && !skip.includes(k.id)) ?? null;
}

/** Marks a keepsake recovered (mutates `run`). */
export function claimKeepsake(content: Content, run: RunState, k: Keepsake): void {
  if (!run.past || run.past.used.includes(k.id)) return;
  run.past.used.push(k.id);
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'keepsake-recovered', suppressed: false }, importance: 65, text: `Recovered ${keepsakeName(content, k.itemId)} from an earlier journey. ${k.line}` });
}

/** The recovery event: hands over the next keepsake and says where it came from. Null when none is left. */
export function recoverKeepsake(content: Content, run: RunState): string | null {
  const k = nextKeepsake(run);
  if (!k || !grantKeepsake(content, run, k.itemId)) return null;
  claimKeepsake(content, run, k);
  return `${keepsakeName(content, k.itemId)} (${k.line})`;
}
