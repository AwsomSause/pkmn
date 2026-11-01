// F219: community seed board. A curated static list (`data/seedBoard.json`) plus seeds from mod packs. No server:
// the player picks one and it goes onto the Seed Shelf or starts a run. Pure.

import { z } from 'zod';
import raw from '../../data/seedBoard.json';
import { encodeSeedCode } from '../seedCode';
import { STANDARD_CHOICE } from '../rules';

export const BoardEntrySchema = z.object({
  seed: z.string().regex(/^[A-Za-z0-9._-]{2,24}$/),
  archetypeId: z.string().min(1),
  label: z.string().min(1).max(40),
  note: z.string().max(140).default(''),
});
export type BoardEntry = z.infer<typeof BoardEntrySchema>;
export const BOARD: BoardEntry[] = z.array(BoardEntrySchema).parse(raw);

/** The shareable code for a board entry (standard rules). */
export const boardCode = (e: Pick<BoardEntry, 'seed' | 'archetypeId'>): string => encodeSeedCode({ seed: e.seed, archetypeId: e.archetypeId, rules: STANDARD_CHOICE });

/** Built-in entries first, then pack entries; the same seed+trainer is listed once. */
export function mergedBoard(extra: BoardEntry[] = []): BoardEntry[] {
  const seen = new Set<string>();
  return [...BOARD, ...extra].filter((e) => {
    const k = `${e.seed}|${e.archetypeId}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
