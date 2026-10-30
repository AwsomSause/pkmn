// High-hype story systems (Techno blueprint §7): the Champion Memory, Campfire Stories, the Rival
// Tournament Circuit ranking and the Final Rival's callback. Deterministic: wording is picked by a
// hash of the run's seed, never by a gameplay random stream.

import type { Content } from '../contentSchema';
import { isHostile } from '../rivals/outcome';
import type { PokemonInstance, RunState } from '../state';
import { emit } from './record';
import type { Where } from './schema';

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

const nameOf = (content: Content, m: Pick<PokemonInstance, 'speciesId'> | string | undefined) =>
  typeof m === 'string' ? (content.species.get(m)?.name ?? m) : (content.species.get(m?.speciesId ?? '')?.name ?? 'A Pokémon');

/** A gym or Elite Four fight lost: the Pokémon that fought it remembers struggling there. */
export function noteStruggle(run: RunState, uids: string[], bossName: string): void {
  for (const uid of uids) run.story.flags[`struggled:${uid}`] = bossName;
}

/**
 * Champion Memory: the Champion battle records the Pokémon that landed the decisive hit. A Pokémon that
 * struggled against a gym leader earlier becomes the MVP. Applies once (the caller runs it on the win).
 */
export function recordChampionMemory(content: Content, run: RunState, lead: PokemonInstance | undefined, championName: string, where: Where): void {
  if (!lead) return;
  const history = run.story.histories[lead.uid];
  const struggled = run.story.flags[`struggled:${lead.uid}`];
  const mvp = typeof struggled === 'string';
  if (history) history.hyper['champion-finisher'] = (history.hyper['champion-finisher'] ?? 0) + 1;
  if (mvp && history) history.hyper['champion-mvp'] = (history.hyper['champion-mvp'] ?? 0) + 1;
  emit(content, run, 'storyMoment', {
    where,
    actors: [lead.uid],
    data: { def: mvp ? 'champion-mvp' : 'champion-finisher', suppressed: false },
    importance: mvp ? 92 : 85,
    text: mvp
      ? `${nameOf(content, lead)} struggled against ${struggled} earlier, and was the MVP against Champion ${championName}`
      : `${nameOf(content, lead)} landed the decisive hit on Champion ${championName}`,
  });
}

const CAMPFIRE_PAIR = ['{a} and {b} sat together and talked about the boss they took down.', '{a} and {b} reflected on the road behind them.', '{a} nudged {b}; neither needed to say anything.'];
const CAMPFIRE_TIMID = ['{a} was quiet at first, then volunteered to lead the next battle.', '{a} stepped forward. "{a} wants to go first tomorrow."'];

/** Campfire Stories: once per stage, a short scene from recent battles and relationships (null: none). */
export function campfireStory(content: Content, run: RunState): string | null {
  const stage = run.stage?.index ?? 0;
  const key = `campfire:${run.regionIndex}.${stage}`;
  if (run.story.flags[key] !== undefined) return null;
  run.story.flags[key] = true;
  const party = run.party.filter((m) => run.story.histories[m.uid]);
  if (party.length === 0) return null;
  const pick = (list: string[], salt: string) => list[hash(`${run.seed}:${key}:${salt}`) % list.length]!;
  // Two Pokémon with a bond or a shared mentorship reflect together.
  const rel = run.story.relationships.find((r) => r.open && (r.kind === 'bond' || r.kind === 'mentorship') && party.some((m) => m.uid === r.a.id) && party.some((m) => m.uid === r.b.id));
  if (rel) {
    const a = party.find((m) => m.uid === rel.a.id)!;
    const b = party.find((m) => m.uid === rel.b.id)!;
    return pick(CAMPFIRE_PAIR, 'pair').replace('{a}', nameOf(content, a)).replace('{b}', nameOf(content, b));
  }
  // A Pokémon with few fights volunteers.
  const timid = party.find((m) => (run.story.histories[m.uid]?.battles ?? 0) <= 2 && run.encountersCompleted >= 4);
  if (timid) return pick(CAMPFIRE_TIMID, 'timid').replaceAll('{a}', nameOf(content, timid));
  if (party.length >= 2 && run.encountersCompleted >= 3) return pick(CAMPFIRE_PAIR, 'pair').replace('{a}', nameOf(content, party[0])).replace('{b}', nameOf(content, party[1]));
  return null;
}

/** Tells the campfire story into the chronicle (a stage start). */
export function tellCampfire(content: Content, run: RunState): void {
  const text = campfireStory(content, run);
  if (text) emit(content, run, 'storyMoment', { actors: [], data: { def: 'campfire', suppressed: false }, importance: 55, text: `Campfire: ${text}` });
}

export interface CircuitRow {
  rank: number;
  name: string;
  state: string;
  score: number;
}

/** Rival Tournament Circuit: the standing of every rival still in the running, strongest first. */
export function circuitRanking(content: Content, run: RunState): CircuitRow[] {
  return run.story.rivals
    .filter((r) => isHostile(r))
    .map((r) => ({ name: `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`, state: r.state, score: Math.round(r.rivalPotential + r.progress * 5 + r.encounters * 3) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** The Final Rival's line: in the last region the defining rival recreates where you first met. Null for anyone else. */
export function finalRivalLine(content: Content, run: RunState, rivalId: string, definesJourney: boolean): string | null {
  if (!definesJourney || run.regionIndex < run.regionOrder.length - 1) return null;
  const rival = run.story.rivals.find((r) => r.id === rivalId);
  if (!rival) return null;
  return `Like the day you first met in region ${rival.origin.where.region + 1}, but the teams and the stakes have changed completely.`;
}
