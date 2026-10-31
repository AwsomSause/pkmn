// Local configuration packs (catalog 161). A pack is plain JSON, never code: it is checked against this schema,
// can only add trainer dialogue lines (presentation, never a rule or a roll), and is size-limited.
// Packs are applied on top of the built-in drama flavour lines; nothing is saved into a run or a profile.

import { z } from 'zod';
import { DIALOGUE_CATEGORIES, DRAMA } from './drama/schema';

export const PACK_LIMITS = { lines: 200, lineLength: 140, bytes: 64 * 1024 } as const;

const Line = z
  .string()
  .min(1)
  .max(PACK_LIMITS.lineLength)
  // No markup or placeholders other than the ones the drama engine fills.
  .refine((t) => !/[<>]/.test(t) && !/\{(?!name\}|foe\}|move\}|trainer\}|type\})/.test(t), { message: 'only {name}, {foe}, {move}, {trainer} and {type} are allowed, no markup' });

export const ConfigPackSchema = z.object({
  format: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(60),
  author: z.string().min(1).max(60),
  /** Extra dialogue: tag (bond, arc or type tag the engine uses) -> category -> lines. */
  flavor: z.record(z.string().regex(/^[a-z]{2,20}$/), z.partialRecord(z.enum(DIALOGUE_CATEGORIES), z.array(Line).min(1))).default({}),
});
export type ConfigPack = z.infer<typeof ConfigPackSchema>;

export type PackResult = { ok: true; pack: ConfigPack } | { ok: false; errors: string[] };

/** Parses and validates pack text. Never evaluates anything. */
export function parseConfigPack(text: string): PackResult {
  if (text.length > PACK_LIMITS.bytes) return { ok: false, errors: [`the pack is larger than ${PACK_LIMITS.bytes / 1024} KB`] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['the pack is not valid JSON'] };
  }
  const parsed = ConfigPackSchema.safeParse(json);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'pack'}: ${i.message}`) };
  const total = Object.values(parsed.data.flavor).reduce((n, cats) => n + Object.values(cats).reduce((m, l) => m + (l?.length ?? 0), 0), 0);
  if (total > PACK_LIMITS.lines) return { ok: false, errors: [`the pack has ${total} lines, the limit is ${PACK_LIMITS.lines}`] };
  return { ok: true, pack: parsed.data };
}

/** Adds a valid pack's lines to the drama flavour sets. Returns how many lines were added. */
export function applyConfigPack(pack: ConfigPack): number {
  let added = 0;
  for (const [tag, cats] of Object.entries(pack.flavor)) {
    const set = (DRAMA.flavor[tag] ??= {});
    for (const [category, lines] of Object.entries(cats)) {
      const have = (set[category] ??= []);
      for (const line of lines ?? []) if (!have.includes(line)) (have.push(line), (added += 1));
    }
  }
  return added;
}
