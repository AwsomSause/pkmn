// The event queue: when several story triggers fire in the same turn, it
// resolves them in a fixed order (Hyper blueprint §7):
//   1. knockout prevention   2. transformations   3. emotional Overdrive
//   4. bond and rivalry      5. ordinary memories 6. flavour text
// Only the first trigger with a combat effect gets to apply it; triggers that
// show at the same moment merge into one banner; and only a few cinematic
// ("major") moments are shown per battle, the rest become a plain line.
//
// Presentation cues are written here for the screens. The core never reads
// them back, so a skipped or failed animation cannot change the game.

import { PRIORITY_TIERS, type PresentationCueSpec, type PriorityTier } from './schema';

/** One story event that fired this turn, waiting to be resolved. */
export interface StoryTrigger {
  defId: string;
  /** The Pokémon it happened to. */
  uid: string;
  title: string;
  /** The line shown for it (names already filled in). */
  message: string;
  priority: PriorityTier;
  /** True when it changes the battle (only the top one may). */
  combat: boolean;
  /** Index in the turn's event list it belongs after (-1: before the first). */
  at: number;
  cue: PresentationCueSpec;
  /** Order it fired in, to break ties. */
  order: number;
  /** Names for the memory text ({name}, {enemy}). */
  names: Record<string, string>;
}

/** What the screens show for a story moment. Never saved, never read by the core. */
export interface PresentationCue {
  /** Show it while playing the turn's event at this index (-1: before the first). */
  at: number;
  /** Banner text (several titles merged with " · "). */
  title: string;
  /** Lines to show instead of the event's own text. */
  messages: string[];
  color: string;
  sound: string | null;
  music: string | null;
  /** Cinematic (banner, aura, sound) rather than a plain line. */
  major: boolean;
  cutIn: boolean;
  shake: boolean;
}

export interface QueueResult {
  /** Triggers that take effect, in resolution order. */
  resolved: StoryTrigger[];
  /** Triggers whose combat effect lost to a higher one (still remembered, effect not applied). */
  suppressed: StoryTrigger[];
  cues: PresentationCue[];
  /** Major cues used, to add to the battle's budget. */
  majorUsed: number;
}

const rank = (t: PriorityTier) => PRIORITY_TIERS.indexOf(t);

/** Resolves a turn's triggers. `majorBudgetLeft` is how many cinematic moments this battle may still show. */
export function resolveQueue(triggers: StoryTrigger[], majorBudgetLeft: number): QueueResult {
  const sorted = [...triggers].sort((a, b) => rank(a.priority) - rank(b.priority) || a.order - b.order);
  const resolved: StoryTrigger[] = [];
  const suppressed: StoryTrigger[] = [];
  let combatTaken = false;
  for (const t of sorted) {
    if (t.combat) {
      if (combatTaken) {
        suppressed.push(t);
        continue;
      }
      combatTaken = true;
    }
    resolved.push(t);
  }

  // Merge the ones shown at the same moment into one cue (the highest one sets the look).
  const cues: PresentationCue[] = [];
  let budget = Math.max(0, majorBudgetLeft);
  let majorUsed = 0;
  for (const t of resolved) {
    const same = cues.find((c) => c.at === t.at);
    if (same) {
      same.title = `${same.title} · ${t.title}`;
      same.messages.push(t.message);
      continue;
    }
    const major = t.cue.major && budget > 0;
    if (major) {
      budget -= 1;
      majorUsed += 1;
    }
    cues.push({
      at: t.at,
      title: t.title,
      messages: [t.message],
      color: t.cue.color,
      sound: major ? t.cue.sound : null,
      music: major ? t.cue.music : null,
      major,
      cutIn: major && t.cue.cutIn,
      shake: major && t.cue.shake,
    });
  }
  cues.sort((a, b) => a.at - b.at);
  return { resolved, suppressed, cues, majorUsed };
}
