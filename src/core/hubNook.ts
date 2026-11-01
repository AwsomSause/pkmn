// The Corner Nook in the Hub (ideas W10): fortune cookie (I401), wish upon a star (I509), a note to your
// future self (I501), poster gift codes (I404), a donation drive (I406) and Konami jokes (I410).
// Everything is pure: the day comes in as a "YYYY-MM-DD" string, the choice of text is a hash of it (no gameplay
// RNG), and a profile goes in and a new profile comes out. Cosmetic text and small Bank Credit payouts only.

import { z } from 'zod';
import nookJson from '../data/nook.json';
import type { Profile } from './state';

const NookDataSchema = z.object({
  note: z.string(),
  cookie: z.object({ credits: z.number().int().min(0), shakes: z.number().int().min(1) }),
  wish: z.object({ credits: z.number().int().min(0), fromHour: z.number().int().min(0).max(23), toHour: z.number().int().min(0).max(23) }),
  note_rules: z.object({ maxLength: z.number().int().min(10) }),
  fortunes: z.array(z.string().min(1)).min(20),
  wishGifts: z.array(z.string().min(1)).min(3),
  giftCodes: z.array(z.object({ code: z.string().regex(/^[A-Z0-9-]+$/), title: z.string().min(1), text: z.string() })).min(3),
  donation: z.object({ step: z.number().int().min(1), milestones: z.array(z.object({ total: z.number().int().min(1), title: z.string(), text: z.string() })).min(2) }),
  goodbyes: z.array(z.string().min(1)).min(3),
  konami: z.object({ keys: z.array(z.string()).min(4), jokes: z.array(z.string()).min(3) }),
});
export const NOOK = NookDataSchema.parse(nookJson);

export type Nook = Profile['nook'];
export const nookOf = (p: Pick<Profile, 'nook'>): Nook => p.nook ?? { cookieDay: null, cookies: 0, wishDay: null, wishPaid: true, wishes: 0, note: null, noteDelivered: true, codesUsed: [], donated: 0, jokes: 0 };

/** A stable small number from text (never gameplay RNG). */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The day's fortune: the same all day for a profile. */
export const fortuneFor = (profileId: string, day: string): string => NOOK.fortunes[hashText(`${profileId}:${day}:fortune`) % NOOK.fortunes.length]!;

export const cookieReady = (p: Pick<Profile, 'nook'>, day: string): boolean => nookOf(p).cookieDay !== day;

/** Cracks the day's cookie once. Returns the new profile and the fortune (null when already cracked today). */
export function crackCookie(p: Profile, day: string): { profile: Profile; fortune: string | null } {
  if (!cookieReady(p, day)) return { profile: p, fortune: null };
  const n = nookOf(p);
  return { profile: { ...p, bankCredits: p.bankCredits + NOOK.cookie.credits, nook: { ...n, cookieDay: day, cookies: n.cookies + 1 } }, fortune: fortuneFor(p.profileId, day) };
}

/** True from the evening hour to the morning hour (local hour 0-23). */
export const isStarNight = (hour: number): boolean => hour >= NOOK.wish.fromHour || hour < NOOK.wish.toHour;

export function wishProblem(p: Pick<Profile, 'nook'>, day: string, hour: number): string | null {
  const n = nookOf(p);
  if (!isStarNight(hour)) return 'The star only listens at night.';
  if (n.wishDay === day) return 'You already made a wish today.';
  return null;
}

/** Makes a wish; the gift appears on a later day (see {@link collectWish}). */
export function makeWish(p: Profile, day: string, hour: number): Profile {
  const problem = wishProblem(p, day, hour);
  if (problem) throw new Error(problem);
  const n = nookOf(p);
  return { ...p, nook: { ...n, wishDay: day, wishPaid: false, wishes: n.wishes + 1 } };
}

/** The morning after: the small gift is there. Pays once and returns the line to show (null when nothing waits). */
export function collectWish(p: Profile, day: string): { profile: Profile; text: string | null } {
  const n = nookOf(p);
  if (n.wishPaid || n.wishDay === null || n.wishDay >= day) return { profile: p, text: null };
  const text = NOOK.wishGifts[hashText(`${p.profileId}:${n.wishDay}:wish`) % NOOK.wishGifts.length]!;
  return { profile: { ...p, bankCredits: p.bankCredits + NOOK.wish.credits, nook: { ...n, wishPaid: true } }, text };
}

/** Writes a note for the next run's start. A new note replaces one that waits. */
export function writeNote(p: Profile, text: string): Profile {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, NOOK.note_rules.maxLength);
  if (!clean) throw new Error('Write something first.');
  return { ...p, nook: { ...nookOf(p), note: clean, noteDelivered: false } };
}

/** The note waiting for the next run start (null when none). */
export const pendingNote = (p: Pick<Profile, 'nook'>): string | null => {
  const n = nookOf(p);
  return n.note !== null && !n.noteDelivered ? n.note : null;
};

/** Reading the note marks it delivered; it stays on file so you can read it again in the Nook. */
export function deliverNote(p: Profile): Profile {
  return pendingNote(p) === null ? p : { ...p, nook: { ...nookOf(p), noteDelivered: true } };
}

/** Redeems a poster code for its title (once). */
export function redeemCode(p: Profile, raw: string): { profile: Profile; text: string } {
  const code = raw.trim().toUpperCase();
  const gift = NOOK.giftCodes.find((g) => g.code === code);
  if (!gift) return { profile: p, text: 'That code does not match any poster.' };
  const n = nookOf(p);
  if (n.codesUsed.includes(gift.code)) return { profile: p, text: 'You already used that code.' };
  return { profile: { ...p, titles: p.titles.includes(gift.title) ? p.titles : [...p.titles, gift.title], nook: { ...n, codesUsed: [...n.codesUsed, gift.code] } }, text: `Code accepted: you earned the title "${gift.title}".` };
}

export const donationNext = (p: Pick<Profile, 'nook'>) => NOOK.donation.milestones.find((m) => nookOf(p).donated < m.total) ?? null;

export function donationProblem(p: Pick<Profile, 'nook' | 'bankCredits'>): string | null {
  if (donationNext(p) === null) return 'The Nook is fully funded. Thank you!';
  return p.bankCredits < NOOK.donation.step ? `Needs ${NOOK.donation.step} Bank Credits.` : null;
}

/** Gives one donation step; each milestone reached grants its title. */
export function donate(p: Profile): { profile: Profile; text: string } {
  const problem = donationProblem(p);
  if (problem) throw new Error(problem);
  const n = nookOf(p);
  const donated = n.donated + NOOK.donation.step;
  const titles = [...p.titles];
  const reached = NOOK.donation.milestones.filter((m) => n.donated < m.total && donated >= m.total);
  for (const m of reached) if (!titles.includes(m.title)) titles.push(m.title);
  const text = reached.length ? reached.map((m) => `${m.text} Title "${m.title}" earned.`).join(' ') : `Donated ${NOOK.donation.step} credits. The jar fills a little more.`;
  return { profile: { ...p, bankCredits: p.bankCredits - NOOK.donation.step, titles, nook: { ...n, donated } }, text };
}

/** Konami sequence: feed one key at a time with the position so far; returns the next position and whether it completed. */
export function konamiStep(position: number, key: string): { position: number; done: boolean } {
  const keys = NOOK.konami.keys;
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === keys[position]) return position + 1 === keys.length ? { position: 0, done: true } : { position: position + 1, done: false };
  return { position: k === keys[0] ? 1 : 0, done: false };
}

/** The harmless joke: the n-th time through shows the n-th line (wraps), and the count is kept. */
export function konamiJoke(p: Profile): { profile: Profile; text: string } {
  const n = nookOf(p);
  return { profile: { ...p, nook: { ...n, jokes: n.jokes + 1 } }, text: NOOK.konami.jokes[n.jokes % NOOK.konami.jokes.length]! };
}

/** The wave at the Hub gate as a run begins (I499): one line, picked from the seed so it is the same on a replay. */
export const goodbyeLine = (seed: string): string => NOOK.goodbyes[hashText(`${seed}:goodbye`) % NOOK.goodbyes.length]!;
