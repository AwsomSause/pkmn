// What Hub Town's people say (spec 2026-11-01 §5, §8): lines built from your real saved history (past Trainers and
// their Aces, runs, achievements, the Pokémon you walk with, rivals). Records are only read, never changed.
// Which line a person says is a hash of who they are and the crowd window, so it is stable while you stand there.

import type { Content } from '../contentSchema';
import type { Profile } from '../state';
import { hubPokemon } from './world';

type Line = (c: Content, p: Profile) => string | null;

const name = (c: Content, id: string | null | undefined): string | null => (id ? c.species.get(id)?.name ?? null : null);

/** History-aware lines; null means "not true for this profile yet" and is skipped. */
const HISTORY: Line[] = [
  (c, p) => {
    const last = p.legacyRuns.at(-1);
    if (!last) return null;
    const ace = last.team.find((m) => m.uid === last.aceUid);
    const trainer = c.archetypes.get(last.archetypeId)?.name ?? last.archetypeId;
    return ace ? `I saw ${trainer}'s ${name(c, ace.speciesId) ?? 'Ace'} come back last time. Lv ${ace.level}! ${last.outcome === 'victory' ? 'A real Champion.' : 'It gave everything.'}` : null;
  },
  (c, p) => {
    const wins = p.legacyRuns.filter((r) => r.outcome === 'victory');
    return wins.length ? `${wins.length === 1 ? 'One Champion' : `${wins.length} Champions`} came out of this town. The plaza pedestals remember them.` : null;
  },
  (_c, p) => (p.stats.runsEnded > 0 ? `${p.stats.runsEnded} journeys have started at the Departure Gate. Each one left something behind.` : null),
  (c, p) => {
    const fell = [...p.legacyRuns].reverse().find((r) => r.outcome === 'defeat' && r.defeatedBy?.speciesId);
    const foe = name(c, fell?.defeatedBy?.speciesId);
    return fell && foe ? `Careful out there. A ${foe} ended one of your journeys${fell.defeatedBy?.trainer ? ` (${fell.defeatedBy.trainer}'s)` : ''}.` : null;
  },
  (c, p) => {
    const best = [...p.legacyRuns].sort((a, b) => b.badges.length - a.badges.length)[0];
    return best && best.badges.length ? `Your best run took ${best.badges.length} badges with ${c.archetypes.get(best.archetypeId)?.name ?? 'a trainer'}. People still talk about it.` : null;
  },
  (c, p) => {
    const mon = name(c, hubPokemon(p).speciesId);
    return mon ? `Your ${mon} looks happy walking around town.` : null;
  },
  (c, p) => {
    const earned = Object.keys(p.achievements).length;
    return earned ? `${earned} of ${c.achievements.size} achievements! The Achievement Hall up north keeps them all.` : null;
  },
  (_c, p) => (p.bankCredits >= 300 ? `${p.bankCredits} Bank Credits... The Strange Merchant by the tent would love to see those.` : null),
];

/** Small talk for when there is no history yet (or as a change from it). */
const SMALL_TALK = [
  'The fountain in the plaza never runs dry. Nobody knows why.',
  'Face a door and press Z. Every building here has something for you.',
  'The Run Prep Center is where every journey starts. Then out through the south gate!',
  'The Starter Sanctuary is east, past the canal. The starters there are waiting.',
  'I come here to watch the Pokémon play by the lake.',
  'The Pocket Town gate is at the top of the north road.',
  'Hold Shift to run. Not in the flower beds, please.',
  'The orchard keeper knows a story about everyone who passes through.',
];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Every line that is true for this profile right now (history first). */
export function chatterLines(c: Content, p: Profile): string[] {
  return [...HISTORY.map((l) => l(c, p)).filter((t): t is string => Boolean(t)), ...SMALL_TALK];
}

/** What one person says (stable for that person and crowd window; history lines are twice as likely). */
export function chatterFor(c: Content, p: Profile, who: string, window: string): string {
  const history = HISTORY.map((l) => l(c, p)).filter((t): t is string => Boolean(t));
  const pool = [...history, ...history, ...SMALL_TALK];
  return pool[hash(`${who}::${window}`) % pool.length]!;
}
