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

/** Title-screen arenas open once you have earned any run-end stamp (catalog #111). */
export const arenasOpen = (profile: Pick<Profile, 'stamps'>): boolean => Object.values(profile.stamps ?? {}).some((n) => n > 0);

/** Picks the title-screen arena (null = cycle through all). Returns a new profile. */
export function setMenuArena(current: Profile, key: string | null): Profile {
  if (key !== null && !arenasOpen(current)) throw new Error('Earn a run-end stamp to open the arenas.');
  const next = { ...current };
  if (key === null) delete next.menuArena;
  else next.menuArena = key;
  return next;
}

/** Cry themes (catalog #111): the same cries, pitched up or down. Open after the first run-end stamp. */
export const CRY_THEMES = [
  { id: 'normal', name: 'Normal', detune: 0 },
  { id: 'deep', name: 'Deep', detune: -400 },
  { id: 'bright', name: 'Bright', detune: 400 },
  { id: 'tiny', name: 'Tiny', detune: 800 },
  { id: 'boom', name: 'Boom', detune: -800 },
] as const;

export type CryThemeId = (typeof CRY_THEMES)[number]['id'];

/** The pitch shift (in cents) for the chosen theme; 0 when unset or unknown. */
export const cryDetune = (profile: Pick<Profile, 'cryTheme'>): number => CRY_THEMES.find((t) => t.id === profile.cryTheme)?.detune ?? 0;

/** Picks a cry theme. Returns a new profile. */
export function setCryTheme(current: Profile, id: string): Profile {
  if (!CRY_THEMES.some((t) => t.id === id)) throw new Error(`Unknown cry theme "${id}"`);
  if (id !== 'normal' && !arenasOpen(current)) throw new Error('Earn a run-end stamp to open the cry themes.');
  const next = { ...current };
  if (id === 'normal') delete next.cryTheme;
  else next.cryTheme = id;
  return next;
}
