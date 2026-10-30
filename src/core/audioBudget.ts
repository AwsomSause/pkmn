// Audio de-duplication (catalog #132): a sound is skipped when the same one just played or too many are already playing.
// Pure and deterministic; presentation only, it never touches gameplay.

export interface SfxPlay {
  id: string;
  at: number;
}

export const SFX_WINDOW_MS = 120;
export const SFX_MAX_IN_WINDOW = 6;
export const SFX_SAME_ID_GAP_MS = 45;

/** True when `id` may play at `now`. `recent` holds earlier plays (any age; old ones are ignored). */
export function sfxAllowed(recent: readonly SfxPlay[], id: string, now: number): boolean {
  const live = recent.filter((p) => now - p.at < SFX_WINDOW_MS);
  if (live.length >= SFX_MAX_IN_WINDOW) return false;
  return !live.some((p) => p.id === id && now - p.at < SFX_SAME_ID_GAP_MS);
}
