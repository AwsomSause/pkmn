// Hyper moment codex (left-out plan 5.19, Hyper/Overdrive §7): the account
// remembers every kind of story moment you have seen. During a run each told
// moment is counted in a story flag ("codex:<id>"); finishing the run adds the
// counts to profile.momentCodex (once, like the rest of finalizeRun).

import type { Content } from '../contentSchema';
import type { Profile, RunState } from '../state';
import type { StoryEventDefinition } from './schema';

const PREFIX = 'codex:';

/** A moment was told (hooks.ts). */
export function noteCodex(run: RunState, defId: string): void {
  const key = `${PREFIX}${defId}`;
  run.story.flags[key] = Number(run.story.flags[key] ?? 0) + 1;
}

/** The run's moments added to the account (mutates `profile`). */
export function addRunToCodex(profile: Profile, run: RunState): void {
  for (const [key, value] of Object.entries(run.story.flags)) {
    if (!key.startsWith(PREFIX) || typeof value !== 'number') continue;
    const id = key.slice(PREFIX.length);
    profile.momentCodex[id] = (profile.momentCodex[id] ?? 0) + value;
  }
}

export interface CodexEntry {
  def: StoryEventDefinition;
  seen: number;
}

/** Every moment in the game, by category, with how often you have seen it (0 = undiscovered). */
export function codexEntries(content: Content, profile: Profile): CodexEntry[] {
  return content.story.definitions.map((def) => ({ def, seen: profile.momentCodex[def.id] ?? 0 }));
}

export function codexTotals(content: Content, profile: Profile): { found: number; total: number } {
  const entries = codexEntries(content, profile);
  return { found: entries.filter((e) => e.seen > 0).length, total: entries.length };
}
