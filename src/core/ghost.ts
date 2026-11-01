// Co-op ghost (idea F84): a friend finishes a run and copies a ghost code. Importing it keeps their seed, trainer and rules
// (like a seed code) and what they did in that seed. After you play the same seed, the end screen shows both side by side.
// The game has no server: the code carries the whole ghost. Pure: no RNG.

import { decodeSeedCode, encodeSeedCode, type SeedCodeParts } from './seedCode';
import type { LegacyRun, LegacyState } from './state';
import { legacyOf, withLegacy } from './legacy';
import type { Profile } from './state';

const PREFIX = 'GH1';
type Ghost = LegacyState['ghosts'][string];
export type GhostResult = { ok: true; parts: SeedCodeParts; ghost: Ghost } | { ok: false; reason: string };

const b64 = (s: string): string => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string): string => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** What a friend did, from their finished run's legacy record: result, team and their most memorable moments. */
export function ghostFromRecord(record: LegacyRun, from: string): Ghost {
  return {
    from: from.slice(0, 24),
    victory: record.outcome === 'victory',
    badges: record.badges.length,
    regionReached: record.regionReached,
    encounters: record.encounters,
    team: record.team.map((m) => m.speciesId).slice(0, 6),
    actions: [...record.chronicle].sort((a, b) => b.importance - a.importance).slice(0, 8).map((c) => c.text.slice(0, 120)),
  };
}

/** GH1.<seed code>.<ghost data>: one line a friend can paste. */
export function encodeGhostCode(parts: SeedCodeParts, ghost: Ghost): string {
  return [PREFIX, encodeURIComponent(encodeSeedCode(parts)).replace(/\./g, '%2E'), b64(JSON.stringify(ghost))].join('.');
}

export function decodeGhostCode(code: string): GhostResult {
  const bits = code.trim().split('.');
  if (bits[0] !== PREFIX || bits.length !== 3) return { ok: false, reason: 'This is not a ghost code.' };
  try {
    const seed = decodeSeedCode(decodeURIComponent(bits[1]!));
    if (!seed.ok) return seed;
    const raw = JSON.parse(unb64(bits[2]!)) as Ghost;
    if (typeof raw.from !== 'string' || !Array.isArray(raw.team) || !Array.isArray(raw.actions)) return { ok: false, reason: 'The ghost is damaged.' };
    const ghost: Ghost = { from: raw.from.slice(0, 24), victory: !!raw.victory, badges: Math.max(0, Math.trunc(raw.badges) || 0), regionReached: Math.max(0, Math.trunc(raw.regionReached) || 0), encounters: Math.max(0, Math.trunc(raw.encounters) || 0), team: raw.team.slice(0, 6).map(String), actions: raw.actions.slice(0, 8).map((a) => String(a).slice(0, 120)) };
    return { ok: true, parts: seed.parts, ghost };
  } catch {
    return { ok: false, reason: 'The ghost is damaged.' };
  }
}

/** Keeps an imported ghost for its seed (a newer import of the same seed replaces it). */
export const keepGhost = (profile: Profile, seed: string, ghost: Ghost): Profile => withLegacy(profile, (l) => { l.ghosts = { ...l.ghosts, [seed]: ghost }; });
export const ghostFor = (profile: Pick<Profile, 'legacy'>, seed: string): Ghost | null => legacyOf(profile).ghosts[seed] ?? null;

/** End-screen lines: the friend's result next to yours, then what they did. */
export function ghostLines(ghost: Ghost, me: { victory: boolean; badges: number; encounters: number }, speciesName: (id: string) => string): string[] {
  const verdict = (g: boolean, m: boolean) => (m && !g ? 'You beat the ghost!' : g && !m ? `${ghost.from} got further.` : 'A close race.');
  const lead = me.badges > ghost.badges ? 'You got further.' : me.badges < ghost.badges ? `${ghost.from} got further.` : verdict(ghost.victory, me.victory);
  return [`Ghost of ${ghost.from}: ${ghost.victory ? 'won' : 'lost'}, ${ghost.badges} badges, ${ghost.encounters} encounters`, `You: ${me.victory ? 'won' : 'lost'}, ${me.badges} badges, ${me.encounters} encounters. ${lead}`, `Their team: ${ghost.team.map(speciesName).join(', ')}`, ...ghost.actions.map((a) => `· ${a}`)];
}
