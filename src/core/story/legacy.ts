// The Legacy System (Techno blueprint §6.1, "This Pokémon Has a Story"): a
// Legacy Card for each Pokémon built only from what really happened to it
// (its history and memories), earned titles shown beside its name, and a run
// epitaph. Recognition, not power: titles never change a stat.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { recordGrandLegacy } from './grandEnemy';
import { emit } from './record';
import type { PokemonHistory } from './schema';

export interface LegacyCard {
  uid: string;
  speciesId: string;
  /** Short role tags, e.g. "Run Ace · Mentor". */
  tags: string[];
  /** The standout memory, by importance. */
  signature: string | null;
  /** Up to four of its greatest moments, most important first. */
  greatest: string[];
  titles: string[];
  /** Its mentor's species, if it was a protégé. */
  mentor: string | null;
  /** Titles of finished Hall of Fame chains (Legacy Records). */
  records: string[];
}

const nameOf = (content: Content, speciesId: string) => content.species.get(speciesId)?.name ?? speciesId;

/** The Pokémon's memories, most important first (the later one wins a tie). */
function rankedMemories(history: PokemonHistory) {
  return [...history.memories].sort((a, b) => b.importance - a.importance || b.seq - a.seq);
}

/** Which Pokémon (uid) is the party's Run Ace: most bosses beaten, then battles. */
function runAce(run: RunState): string | null {
  let best: PokemonHistory | null = null;
  for (const m of run.party) {
    const h = run.story.histories[m.uid];
    if (h && (!best || h.bossesBeaten > best.bossesBeaten || (h.bossesBeaten === best.bossesBeaten && h.battles > best.battles))) best = h;
  }
  return best && best.battles > 0 ? best.uid : null;
}

export function legacyCard(content: Content, run: RunState, uid: string): LegacyCard | null {
  const history = run.story.histories[uid];
  if (!history) return null;
  const memories = rankedMemories(history);
  const mentored = run.story.relationships.some((r) => r.kind === 'mentorship' && r.a.id === uid);
  const mentorship = run.story.relationships.find((r) => r.kind === 'mentorship' && r.b.id === uid);
  const protege = mentorship !== undefined;
  const tags: string[] = [];
  if (runAce(run) === uid) tags.push('Run Ace');
  if (mentored) tags.push('Mentor');
  if (protege) tags.push('Protégé');
  if (history.survivedFatal > 0) tags.push('Survivor');
  if (history.evolutions.length > 0) tags.push('Evolved on the road');
  if ((history.hyper['comeback-revenge'] ?? 0) > 0 || (history.hyper['last-stand'] ?? 0) > 0) tags.push('Comeback Record');
  if ((history.hyper['promise-kept'] ?? 0) > 0) tags.push('Promise Kept');
  return {
    uid,
    speciesId: history.speciesId,
    tags,
    signature: memories[0]?.text ?? null,
    greatest: memories.slice(0, 4).map((m) => m.text),
    titles: [...history.titles],
    mentor: mentorship ? (run.story.histories[mentorship.a.id]?.speciesId ?? null) : null,
    records: content.story.chains.filter((c) => c.hallOfFame && history.titles.includes(c.title)).map((c) => c.title),
  };
}

/** Does this history meet a title's requirements? */
function meets(run: RunState, history: PokemonHistory, need: Content['story']['legacyTitles'][number]['needs']): boolean {
  if (need.survivedFatal !== undefined && history.survivedFatal < need.survivedFatal) return false;
  if (need.bossesBeaten !== undefined && history.bossesBeaten < need.bossesBeaten) return false;
  if (need.closeCalls !== undefined && history.closeCalls < need.closeCalls) return false;
  if (need.battles !== undefined && history.battles < need.battles) return false;
  if (need.evolutions !== undefined && history.evolutions.length < need.evolutions) return false;
  if (need.anyMoment && !need.anyMoment.some((id) => (history.hyper[id] ?? 0) > 0)) return false;
  if (need.victory && !(run.victory && run.party.some((m) => m.uid === history.uid))) return false;
  return true;
}

/** Gives every party Pokémon the titles it has earned (safe to call any time; never removes a title). */
export function awardLegacyTitles(content: Content, run: RunState): void {
  for (const m of run.party) {
    const history = run.story.histories[m.uid];
    if (!history) continue;
    for (const t of content.story.legacyTitles) {
      if (!history.titles.includes(t.title) && meets(run, history, t.needs)) history.titles.push(t.title);
    }
  }
}

/** The run epitaph: one line about the Pokémon whose story weighs most (null when nothing stands out). */
export function runEpitaph(content: Content, run: RunState): string | null {
  let best: { uid: string; score: number } | null = null;
  for (const m of run.party) {
    const h = run.story.histories[m.uid];
    if (!h) continue;
    const score = h.memories.reduce((sum, x) => sum + x.importance, 0) + h.bossesBeaten * 20 + h.titles.length * 10;
    if (score > 0 && (!best || score > best.score)) best = { uid: m.uid, score };
  }
  if (!best) return null;
  const card = legacyCard(content, run, best.uid)!;
  const name = nameOf(content, card.speciesId);
  const title = card.titles[0] ? `, ${card.titles[0]},` : '';
  return `${name}${title} carried this journey${card.signature ? `: ${card.signature}` : ''}.`;
}

/** Writes the epitaph into the chronicle when a run ends. */
export function recordEpitaph(content: Content, run: RunState): void {
  recordGrandLegacy(content, run);
  awardLegacyTitles(content, run);
  const text = runEpitaph(content, run);
  if (text) emit(content, run, 'storyMoment', { actors: [], data: { def: 'run-epitaph', suppressed: false }, importance: 95, text: `Epitaph: ${text}` });
}
