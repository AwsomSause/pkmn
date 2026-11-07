// Story Overhaul S2: the prologue shell. Which beats exist, which of them are built, and the
// state changes (mode, tone, name, pronouns, finish). The scene only draws; every rule is here.

import { graphemeCount, type ProfileStory } from './schema';
import { type LookId, setLook, validateName, validateCustomPronouns, type PronounChoice, type Tone } from './identity';

export type PrologueMode = 'full' | 'quick' | 'skipped';
export type BeatId = 'look' | 'cold_open' | 'station' | 'professor' | 'identity' | 'quiz' | 'reveal' | 'backstory' | 'starter' | 'field_trial' | 'briefing';

/** `built` is false for beats not built yet (the Field Trial); the shell skips them. */
export const BEATS: { id: BeatId; label: string; built: boolean; owner: string }[] = [
  { id: 'look', label: 'Look and mode', built: true, owner: 'S2' },
  { id: 'cold_open', label: 'Beat 1: Cold open', built: true, owner: 'S2' },
  { id: 'station', label: 'Beat 2: The station', built: true, owner: 'S2' },
  { id: 'professor', label: 'Beat 3: Professor Vance', built: true, owner: 'S2' },
  { id: 'identity', label: 'Beat 4: Identity', built: true, owner: 'S2' },
  { id: 'quiz', label: 'Beat 5: The quiz', built: true, owner: 'quiz screens' },
  { id: 'reveal', label: 'Beat 6: The reveal', built: true, owner: 'quiz screens' },
  { id: 'backstory', label: 'Beat 7: Backstory', built: true, owner: 'backstory slice' },
  { id: 'starter', label: 'Beat 8: First partner', built: true, owner: 'starter slice' },
  { id: 'field_trial', label: 'Beat 9: Field Trial', built: false, owner: 'S9' },
  { id: 'briefing', label: 'Beat 10: Departure', built: true, owner: 'S2' },
];

/** The beats a mode plays, in order. Full plays all; Quick drops the montage (Journal "Replay opening"); Skip jumps to Look, identity, then the later beats. */
export function beatsFor(mode: PrologueMode): BeatId[] {
  const all = BEATS.map((b) => b.id);
  if (mode === 'quick') return all.filter((b) => b !== 'cold_open');
  if (mode === 'skipped') return all.filter((b) => ['look', 'identity', 'backstory', 'starter', 'briefing'].includes(b));
  return all;
}
export const builtBeatsFor = (mode: PrologueMode): BeatId[] => beatsFor(mode).filter((id) => BEATS.find((b) => b.id === id)?.built);

/** Station objects the player must examine: 5 in the full prologue, 2 (wall map and clipping) in Quick Start. */
export const requiredObjects = (mode: PrologueMode): number => (mode === 'full' ? 5 : mode === 'quick' ? 2 : 0);

/** Skip Prologue is hidden on the very first save (slot 1) and while the profile has never finished a prologue. */
export function canSkipPrologue(slot: number): boolean {
  return slot > 1;
}

/** Quick Start is offered on the first launch only: before the mode has been chosen and before a prologue is done. */
export const quickStartOffered = (story: ProfileStory): boolean => !story.prologue.modeChosen && !story.prologue.done;

export function chooseMode(story: ProfileStory, mode: PrologueMode): ProfileStory {
  return { ...story, prologue: { ...story.prologue, mode, modeChosen: true } };
}

export function markBeat(story: ProfileStory, beat: BeatId | 'intake'): ProfileStory {
  if (story.prologue.beatsSeen.includes(beat)) return story;
  return { ...story, prologue: { ...story.prologue, beatsSeen: [...story.prologue.beatsSeen, beat].slice(-12) } };
}

export function setTone(story: ProfileStory, tone: Tone, gettingToIt = false): ProfileStory {
  return { ...story, prologue: { ...story.prologue, vanceTone: tone, vanceGettingToIt: story.prologue.vanceGettingToIt || gettingToIt } };
}

export type IdentityResult = { ok: true; story: ProfileStory } | { ok: false; error: string };

export function setIdentity(story: ProfileStory, name: string, pronouns: PronounChoice | null): IdentityResult {
  const n = validateName(name);
  if (!n.ok) return n;
  if (pronouns === null) return { ok: false, error: 'Pick one.' };
  let chosen: ProfileStory['protagonist']['pronouns'] = pronouns;
  if (typeof pronouns === 'object') {
    const c = validateCustomPronouns(pronouns);
    if (!c.ok) return c;
    chosen = c.set;
  }
  return { ok: true, story: { ...story, protagonist: { ...story.protagonist, name: n.name, pronouns: chosen, nameSet: true } } };
}

export const identityDone = (story: ProfileStory): boolean => story.protagonist.nameSet && graphemeCount(story.protagonist.name) > 0;

/** The prologue is finished: later launches skip straight to the Short Intake. A save that never played Vance's questions gets Tone warm. */
export function finishPrologue(story: ProfileStory): ProfileStory {
  return { ...story, prologue: { ...story.prologue, done: true, vanceTone: story.prologue.vanceTone ?? 'warm' } };
}

export { setLook };
export type { LookId };

// ---------- Short Intake (every run after the first) ----------

export const GREETINGS: Record<Tone, string> = {
  warm: '{player}! Come in, come in. I have the kettle on and a feeling about this one.',
  formal: 'Good morning, {player}. You are on time. I made a note of it.',
  playful: 'Look who it is. Marginalia, put down the pencil. {player} is here to be interrogated again.',
};
export const SKIPPED_PROLOGUE_LINE = 'I do not know you yet. Tell me about yourself when you are ready.';

/** The Short Intake shows once the prologue is done. The extra "I do not know you yet" line is for a save that skipped it. */
export function shortIntake(story: ProfileStory): { greeting: string; extraLine: string | null } | null {
  if (!story.prologue.done) return null;
  const tone = story.prologue.vanceTone ?? 'warm';
  return { greeting: GREETINGS[tone], extraLine: story.prologue.mode === 'skipped' && !story.prologue.beatsSeen.includes('intake') ? SKIPPED_PROLOGUE_LINE : null };
}
