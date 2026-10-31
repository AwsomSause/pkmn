// The Protégé system (Techno blueprint §4): a veteran can mentor a younger
// teammate. The player accepts or declines an offer; a mentorship is a
// "mentorship" relationship that ends when the protégé evolves or catches up.
// Paths shape the story and the memory text, not raw stats. Nothing here draws
// random numbers: an offer is decided from the Pokémon's histories.

import type { Content } from '../contentSchema';
import { openRelationship, closeRelationship, emit } from './record';
import type { PokemonInstance, RunState } from '../state';
import type { PokemonHistory, RelationshipRecord } from './schema';

export const MENTOR_PATHS = ['guardian', 'striker', 'strategist', 'survivor', 'challenger', 'bonded'] as const;
export type MentorPath = (typeof MENTOR_PATHS)[number];

const PATH_NAMES: Record<MentorPath, string> = {
  guardian: 'The Guardian',
  striker: 'The Striker',
  strategist: 'The Strategist',
  survivor: 'The Survivor',
  challenger: 'The Challenger',
  bonded: 'The Bonded',
};
export const pathName = (path: MentorPath) => PATH_NAMES[path];

const pathFlag = (id: string) => `mentor:path:${id}`;
const declinedFlag = (a: string, b: string) => `mentor:no:${a}:${b}`;

/** What the protégé learns from this veteran: the strongest thread of its history. */
export function pathFor(run: RunState, mentor: PokemonHistory): MentorPath {
  const bonded = run.story.relationships.some((r) => r.open && r.kind === 'bond' && (r.a.id === mentor.uid || r.b.id === mentor.uid));
  const scores: Record<MentorPath, number> = {
    challenger: mentor.bossesBeaten * 3,
    survivor: mentor.survivedFatal * 3 + mentor.closeCalls,
    striker: mentor.knockoutsDealt,
    guardian: Math.floor(mentor.longestLowHpStand * 2),
    strategist: Object.keys(mentor.foes).length * 2,
    bonded: bonded ? 100 : 0,
  };
  return MENTOR_PATHS.reduce((best, p) => (scores[p] > scores[best] ? p : best), 'challenger' as MentorPath);
}

/** The open mentorship this Pokémon is the protégé of. */
export function mentorshipOf(run: RunState, proteUid: string): RelationshipRecord | undefined {
  return run.story.relationships.find((r) => r.open && r.kind === 'mentorship' && r.b.id === proteUid);
}

export function mentorPathOf(run: RunState, rel: RelationshipRecord): MentorPath {
  const p = run.story.flags[pathFlag(rel.id)];
  return MENTOR_PATHS.find((x) => x === p) ?? 'challenger';
}

export interface MentorOffer {
  mentorUid: string;
  proteUid: string;
  path: MentorPath;
}

const MAX_ACTIVE = 2;

/** After a win: is there a veteran and a younger teammate that would make a mentorship? */
export function planMentorship(content: Content, run: RunState): MentorOffer | null {
  const rule = content.story.mentorship;
  const open = run.story.relationships.filter((r) => r.open && r.kind === 'mentorship');
  if (open.length >= MAX_ACTIVE || run.pending.some((d) => d.kind === 'mentorship')) return null;
  const busy = new Set(open.flatMap((r) => [r.a.id, r.b.id]));
  const alive = run.party.filter((m) => m.hp > 0);
  const history = (m: PokemonInstance) => run.story.histories[m.uid];
  const mentors = alive
    .filter((m) => !busy.has(m.uid) && (history(m)?.battles ?? 0) >= rule.mentorBattles && (history(m)?.bossesBeaten ?? 0) >= 1)
    .sort((a, b) => b.level - a.level);
  for (const mentor of mentors) {
    const prote = alive
      .filter((m) => m.uid !== mentor.uid && !busy.has(m.uid) && mentor.level - m.level >= rule.levelGap && !run.story.flags[declinedFlag(mentor.uid, m.uid)])
      .sort((a, b) => (history(a)?.battles ?? 0) - (history(b)?.battles ?? 0))[0];
    const h = history(mentor);
    if (prote && h) return { mentorUid: mentor.uid, proteUid: prote.uid, path: pathFor(run, h) };
  }
  return null;
}

/** The player's answer. Accepting opens the relationship and its first memory ("It Looks Up to Its Teammate"). */
export function answerMentorship(content: Content, run: RunState, offer: MentorOffer, accept: boolean): string {
  const mentor = run.party.find((m) => m.uid === offer.mentorUid);
  const prote = run.party.find((m) => m.uid === offer.proteUid);
  if (!mentor || !prote) return '';
  const nm = (m: PokemonInstance) => content.species.get(m.speciesId)?.name ?? m.speciesId;
  if (!accept) {
    run.story.flags[declinedFlag(offer.mentorUid, offer.proteUid)] = true;
    return `${nm(prote)} will find its own way.`;
  }
  const cause = emit(content, run, 'storyMoment', {
    actors: [mentor.uid, prote.uid],
    data: { def: 'looks-up', suppressed: false },
    importance: 70,
    text: `${nm(prote)} began to look up to ${nm(mentor)} (${pathName(offer.path)})`,
    emotions: ['kindness'],
  });
  const rel = openRelationship(content, run, 'mentorship', { kind: 'pokemon', id: mentor.uid }, { kind: 'pokemon', id: prote.uid }, cause);
  if (rel) run.story.flags[pathFlag(rel.id)] = offer.path;
  return `${nm(prote)} looks up to ${nm(mentor)}: ${pathName(offer.path)}.`;
}

/**
 * Ends mentorships whose protégé has grown (evolved, or is within a level of the mentor).
 * "The Student Becomes the Teacher": the protégé gets a title and may mentor others.
 */
/**
 * The move a mentor hands down at graduation (Techno §4: mentor-taught move variants, mastery sharing): the
 * mentor's most-used move that the protégé could learn and doesn't know. The path picks the kind: striker and
 * challenger pass on an attack, the others a support move (or an attack when none fits).
 */
export function mentorTaughtMove(content: Content, run: RunState, rel: RelationshipRecord, mentor: PokemonInstance, prote: PokemonInstance): string | null {
  const used = Object.entries(run.story.histories[mentor.uid]?.moves ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const species = content.species.get(prote.speciesId);
  if (!species) return null;
  const pool = new Set([...(content.learnables.get(species.id) ?? (species.form ? content.learnables.get(species.form.base) : undefined) ?? []), ...species.learnset.map((e) => e.move)]);
  const fits = used.map(([id]) => content.moves.get(id)).filter((m) => m && m.supported === true && pool.has(m.id) && !prote.moves.some((k) => k.id === m.id));
  if (fits.length === 0) return null;
  const wantsAttack = ['striker', 'challenger'].includes(mentorPathOf(run, rel));
  return (fits.find((m) => (m!.category !== 'status') === wantsAttack) ?? fits[0])!.id;
}

export function graduateMentorships(content: Content, run: RunState, evolved?: string): string[] {
  const done: string[] = [];
  for (const rel of run.story.relationships) {
    if (!rel.open || rel.kind !== 'mentorship') continue;
    const mentor = run.party.find((m) => m.uid === rel.a.id);
    const prote = run.party.find((m) => m.uid === rel.b.id);
    if (!prote) continue;
    if (mentor && prote.uid !== evolved && prote.level < mentor.level - content.story.mentorship.graduateGap) continue;
    closeRelationship(rel);
    // Mastery sharing: the mentor hands down a move it relied on, taught after the next battle like any other.
    const taught = mentor ? mentorTaughtMove(content, run, rel, mentor, prote) : null;
    if (taught && !run.pending.some((p) => p.kind === 'learnMove' && p.uid === prote.uid && p.moveId === taught)) run.pending.push({ kind: 'learnMove', uid: prote.uid, moveId: taught });
    const history = run.story.histories[prote.uid];
    if (history && !history.titles.includes('Former Protégé')) history.titles.push('Former Protégé');
    const nm = content.species.get(prote.speciesId)?.name ?? prote.speciesId;
    emit(content, run, 'storyMoment', {
      actors: [prote.uid],
      data: { def: 'student-teacher', suppressed: false },
      importance: 85,
      text: `The Student Becomes the Teacher: ${nm} finished its mentorship${taught ? ` and was taught ${content.moves.get(taught)?.name ?? taught}` : ''}`,
      emotions: ['perseverance'],
    });
    done.push(prote.uid);
  }
  return done;
}
