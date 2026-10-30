// The Wardrobe (plan Part 5, "titles and badges wardrobe-lite"): pick a title and a card frame for the
// trainer card in the Hub. Cosmetic only. Frames open with a requirement (wardrobe.json), so rewards
// from quests, mastery and holiday events have somewhere to show.

import { z } from 'zod';
import wardrobeJson from '../data/wardrobe.json';
import { RequirementSchema } from './contentSchema';
import { requirementProgress } from './progress';
import type { Profile } from './state';

export const CardFrameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** A slow shine runs around the frame (none when animations are reduced). */
  shimmer: z.boolean(),
  unlock: RequirementSchema.nullable(),
  unlockText: z.string(),
});
export type CardFrame = z.infer<typeof CardFrameSchema>;
export const CARD_FRAMES = z.object({ note: z.string(), frames: z.array(CardFrameSchema).min(1) }).parse(wardrobeJson).frames;

export const getFrame = (id: string): CardFrame => CARD_FRAMES.find((f) => f.id === id) ?? CARD_FRAMES[0]!;

export const frameOpen = (profile: Profile, frame: CardFrame): boolean => frame.unlock === null || requirementProgress(profile, frame.unlock).met;

/** Puts on an open frame. Returns a new profile. */
export function setCardFrame(current: Profile, id: string): Profile {
  const frame = CARD_FRAMES.find((f) => f.id === id);
  if (!frame) throw new Error(`Unknown card frame "${id}"`);
  if (!frameOpen(current, frame)) throw new Error(`The ${frame.name} frame isn't open yet: ${frame.unlockText}`);
  return { ...current, cardFrame: id };
}
