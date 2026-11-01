// "Tiny reactions" (ideas W0): a shared set of very short cues (a heart, a sweat drop, a sparkle...) that any
// system can play over a Pokémon or trainer. They are registered in the animation registry, so they honour
// the Interaction animation switch, motion, intensity and particle settings like every other animation.
// Pure data: no Phaser, no random numbers.

import { registerAnims } from '../presentation/animRegistry';

export interface ReactionDef { id: string; glyph: string; color: string; ms: number; word: string }

/** The cue set. Ids are `react.<name>`. Short (≤ 700 ms) so they never slow play down. */
export const REACTIONS: readonly ReactionDef[] = [
  { id: 'react.heart', glyph: '♥', color: '#ff8ab8', ms: 600, word: 'affection' },
  { id: 'react.sparkle', glyph: '✦', color: '#fff2a8', ms: 600, word: 'delight' },
  { id: 'react.sweat', glyph: '💧', color: '#9fd8ff', ms: 600, word: 'nervous' },
  { id: 'react.exclaim', glyph: '!', color: '#ffd040', ms: 500, word: 'surprise' },
  { id: 'react.question', glyph: '?', color: '#c8b8ff', ms: 600, word: 'confusion' },
  { id: 'react.anger', glyph: '💢', color: '#ff5a48', ms: 600, word: 'anger' },
  { id: 'react.music', glyph: '♪', color: '#a8f0c8', ms: 700, word: 'joy' },
  { id: 'react.sleepy', glyph: 'z', color: '#b8c8ff', ms: 700, word: 'sleepy' },
  { id: 'react.cheer', glyph: '★', color: '#ffe060', ms: 650, word: 'cheer' },
  { id: 'react.gloom', glyph: '…', color: '#a0a8b8', ms: 700, word: 'sad' },
  { id: 'react.shiver', glyph: '~', color: '#bfeaff', ms: 500, word: 'cold' },
  { id: 'react.nod', glyph: '•', color: '#d8f0d0', ms: 450, word: 'agree' },
];

registerAnims(REACTIONS.map((r) => ({ id: r.id, category: 'interaction' as const, ms: r.ms, color: r.color, glyph: r.glyph, trigger: `reaction: ${r.word}`, particles: false })));

/** Reaction id for a feeling word ('affection', 'angry'...), or null when there is no such cue. */
export function reactionFor(word: string): string | null {
  return REACTIONS.find((r) => r.word === word || r.id === `react.${word}`)?.id ?? null;
}
