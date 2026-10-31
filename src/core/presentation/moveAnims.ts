// Each move's presentation definition (src/data/moveAnims.json): which
// animation it plays and how hard the screen reacts. This is kept apart from
// the move's mechanics (moves.json) on purpose: the battle rules never read it,
// so changing how a move looks can never change what it does.

import { z } from 'zod';

export const MovePresentationSchema = z.object({
  /** Animation file name (public/assets/battle-anims/<anim>.json). */
  anim: z.string().min(1),
  /** "own": the move's own animation; "type": borrowed from a move of the same type. */
  source: z.enum(['own', 'type']),
  /** Screen shake strength on hit: 0 none … 3 heavy. */
  shake: z.number().int().min(0).max(3),
  /** Colour of the screen flash on hit, or null for none. */
  flash: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
  /** How long the action freezes when the hit lands. */
  hitStopMs: z.number().int().min(0).max(250),
  /** The marker shown on the user before the move: quick (priority), strong (big attacks) or normal. */
  telegraph: z.enum(['normal', 'strong', 'quick']),
  /** Two-turn moves: the animation for the turn it charges up. */
  chargeAnim: z.string().optional(),
  /** The director's Essentials pack animation for this move, played first (tools/import-essentials-anims.ts). */
  pack: z.string().optional(),
  /** The scripted EBDX animation for this move (src/data/ebdxAnims.json), played before everything else. */
  script: z.string().optional(),
});
export type MovePresentation = z.infer<typeof MovePresentationSchema>;

export const MoveAnimsFileSchema = z.object({
  source: z.string(),
  /** Status and field animations: "status.brn", "heal", "item". */
  common: z.record(z.string(), z.string()),
  /** Files each animation needs. */
  anims: z.record(z.string(), z.object({ graphics: z.array(z.string()), backgrounds: z.array(z.string()), sounds: z.array(z.string()) })),
  moves: z.record(z.string(), MovePresentationSchema),
  /** Essentials pack versions of the common slots, played before `common`. */
  commonPack: z.record(z.string(), z.string()).default({}),
  packSource: z.string().optional(),
});
export type MoveAnims = z.infer<typeof MoveAnimsFileSchema>;

export function parseMoveAnims(raw: unknown): MoveAnims {
  const result = MoveAnimsFileSchema.safeParse(raw);
  if (!result.success) throw new Error(`moveAnims.json is invalid: ${result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data;
}

/** What a move looks like when it has no entry (a new move added without re-running the import). */
export const DEFAULT_PRESENTATION: MovePresentation = { anim: 'tackle', source: 'type', shake: 1, flash: null, hitStopMs: 60, telegraph: 'normal' };

export function presentationFor(data: MoveAnims, moveId: string): MovePresentation {
  return data.moves[moveId] ?? DEFAULT_PRESENTATION;
}

/** Which file a move plays: the pack's first, the PokeRogue one as the stand-by. */
export function animChoice(look: MovePresentation): { anim: string; alt?: string } {
  return look.pack ? { anim: look.pack, alt: look.anim } : { anim: look.anim };
}

/** The same for a status/field slot ("status.brn", "heal" …); anim is '' when there is none. */
export function commonChoice(data: MoveAnims, slot: string): { anim: string; alt?: string } {
  const pack = data.commonPack[slot];
  const base = data.common[slot];
  return pack ? (base ? { anim: pack, alt: base } : { anim: pack }) : { anim: base ?? '' };
}

/** The animation files the asset catalog has to know about. */
export function animCatalogInputs(data: MoveAnims): { names: string[]; sheets: string[]; backgrounds: string[]; sounds: string[] } {
  const sheets = new Set<string>();
  const backgrounds = new Set<string>();
  const sounds = new Set<string>();
  for (const a of Object.values(data.anims)) {
    a.graphics.forEach((g) => sheets.add(g));
    a.backgrounds.forEach((b) => backgrounds.add(b));
    a.sounds.forEach((s) => sounds.add(s));
  }
  return { names: Object.keys(data.anims).sort(), sheets: [...sheets].sort(), backgrounds: [...backgrounds].sort(), sounds: [...sounds].sort() };
}
