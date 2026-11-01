// F220: the changelog screen. Entries are plain data (`data/changelog.json`); the newest entry id is remembered
// per device (not in a save) so the screen opens once after an update. Pure.

import { z } from 'zod';
import raw from '../../data/changelog.json';

export const ChangelogSchema = z.array(z.object({ id: z.string().regex(/^\d{4}-\d{2}-\d{2}[a-z]?$/), title: z.string().min(1), notes: z.array(z.string().min(1)).min(1) })).min(1);
export type ChangelogEntry = z.infer<typeof ChangelogSchema>[number];

export const CHANGELOG: ChangelogEntry[] = ChangelogSchema.parse(raw);
export const latestChangelogId = (list: ChangelogEntry[] = CHANGELOG): string => list[0]!.id;

/** Whether the "what's new" page should open: never on a first visit (nothing seen yet), once after an update. */
export function shouldShowChangelog(seenId: string | null, latest: string = latestChangelogId()): boolean {
  return seenId !== null && seenId !== latest;
}

/** Entries newer than the one the player last saw (all of them when unknown). */
export function entriesSince(seenId: string | null, list: ChangelogEntry[] = CHANGELOG): ChangelogEntry[] {
  const at = seenId === null ? -1 : list.findIndex((e) => e.id === seenId);
  return at < 0 ? list : list.slice(0, at);
}
