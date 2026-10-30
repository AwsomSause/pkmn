// The Seven Emotions (M8.9 Phase 1). An emotion is not fixed to a species:
// each memory carries emotion tags, and a Pokémon's current emotion is the
// most common tag in its latest tagged memories (the newer one wins a tie).
// Emotion Overdrives (battle effects) come later; this is the tag layer.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import type { Emotion, PokemonHistory } from './schema';

export const EMOTION_NAMES: Record<Emotion, string> = {
  determination: 'Determination',
  bravery: 'Bravery',
  justice: 'Justice',
  kindness: 'Kindness',
  patience: 'Patience',
  integrity: 'Integrity',
  perseverance: 'Perseverance',
};

/** A Pokémon's current emotion, or null before it has a tagged memory. */
export function currentEmotion(history: PokemonHistory | undefined, window: number): Emotion | null {
  if (!history) return null;
  const tagged = history.memories.filter((m) => m.emotions.length > 0).sort((a, b) => a.seq - b.seq).slice(-window);
  const count = new Map<Emotion, { n: number; last: number }>();
  for (const m of tagged) for (const e of m.emotions) count.set(e, { n: (count.get(e)?.n ?? 0) + 1, last: m.seq });
  let best: Emotion | null = null;
  for (const [e, c] of count) {
    const b = best ? count.get(best)! : null;
    if (!b || c.n > b.n || (c.n === b.n && c.last > b.last)) best = e;
  }
  return best;
}

/** The current emotion of a party Pokémon in this run, with its name and heart colour. */
export function emotionOf(content: Content, run: RunState, uid: string): { id: Emotion; name: string; color: string } | null {
  const id = currentEmotion(run.story.histories[uid], content.story.emotions.window);
  return id ? { id, name: EMOTION_NAMES[id], color: content.story.emotions.colors[id] } : null;
}
