// Living Rival (APPROVED §2, §6, §7): the relationship path, the rival's team in an event fight, the
// promised rematch, and the rival's help in the final boss. Pure and deterministic: events write two
// run flags (`ev:rivalFriend`, `ev:rivalHeat`); everything here only reads them.

import type { Content } from '../contentSchema';
import type { BattleState, RunState } from '../state';
import type { Rival } from '../story/schema';
import { typeEffectiveness } from '../battle/damage';
import { getSpecies, maxHp } from '../pokemon';
import type { PokemonInstance } from '../state';

export type RivalPath = 'friend' | 'rival' | 'between';

export const FRIEND_FLAG = 'ev:rival-friend';
export const HEAT_FLAG = 'ev:rival-heat';
export const RESCUED_FLAG = 'ev:rival-rescued';
/** How far one side must lead the other before the path commits. */
export const PATH_MARGIN = 2;

const num = (run: Pick<RunState, 'story'>, key: string): number => Number(run.story.flags[key] ?? 0);

/** Friend points: events, an ally rival and a rescue each count. */
export const friendPoints = (run: Pick<RunState, 'story'>): number =>
  num(run, FRIEND_FLAG) + run.story.rivals.filter((r) => r.state === 'ally').length * 2 + (num(run, RESCUED_FLAG) > 0 ? 1 : 0);
/** Rivalry points: events and every rival at nemesis or contender. */
export const heatPoints = (run: Pick<RunState, 'story'>): number =>
  num(run, HEAT_FLAG) + run.story.rivals.filter((r) => r.state === 'nemesis' || r.state === 'contender').length;

/** Where the relationship leans. Neither path is the right one; `between` is where every run starts. */
export function rivalPath(run: Pick<RunState, 'story'>): RivalPath {
  const f = friendPoints(run);
  const h = heatPoints(run);
  if (f - h >= PATH_MARGIN) return 'friend';
  if (h - f >= PATH_MARGIN) return 'rival';
  return 'between';
}

export const PATH_NAMES: Record<RivalPath, string> = { friend: 'Friends', rival: 'Rivals', between: 'Undecided' };

/** The rival who stands for the relationship in a scene: allies first on the friend path, the fiercest otherwise. */
export function featuredRival(run: Pick<RunState, 'story'>): Rival | null {
  const path = rivalPath(run);
  const live = run.story.rivals.filter((r) => r.state !== 'retired');
  const rank = (r: Rival) => (path === 'friend' ? Number(r.state === 'ally') * 1000 : 0) + r.rivalPotential * (path === 'friend' ? 0.01 : 1);
  return [...live].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))[0] ?? null;
}

/** A rival you beat in your last meeting (it has something to prove). */
export const rivalBeaten = (run: Pick<RunState, 'story'>): boolean => run.story.rivals.some((r) => r.state !== 'retired' && r.memory?.lastBattle?.result === 'win');

/** The roster the rival fields in an event fight: its latest team, tuned by the path (a friend's is warmer, not weaker). */
export function rivalFightTeam(content: Content, rival: Rival): string[] {
  return (rival.memory?.lastBattle?.team ?? []).filter((id) => content.species.has(id));
}

// ---------- final boss assist ----------

/** Strikes the rival gets in the final boss, and the share of the boss's HP each takes (before the type chart). */
export const FINALE_STRIKES = 3;
export const FINALE_STRIKE_PERCENT = 5;
const FINALE_CAP = 1.5;
/** Rival levels trail the boss by this much. */
const FINALE_LEVEL_GAP = 3;

export type FinaleAssist = NonNullable<BattleState['finaleAssist']>;

/**
 * The rival who arrives in the final boss, or null. It must be earned: a friend (state ally), or a rival
 * you rescued while the relationship leans friendly. A rival path keeps it away on purpose.
 */
export function finaleAssistRival(content: Content, run: Pick<RunState, 'story'>, bossLevel: number): FinaleAssist | null {
  const path = rivalPath(run);
  const rescued = num(run, RESCUED_FLAG) > 0;
  const candidates = run.story.rivals
    .filter((r) => r.state !== 'retired' && (r.state === 'ally' || (rescued && path !== 'rival')))
    .filter((r) => rivalFightTeam(content, r).length > 0)
    .sort((a, b) => Number(b.state === 'ally') - Number(a.state === 'ally') || b.rivalPotential - a.rivalPotential || a.id.localeCompare(b.id));
  const r = candidates[0];
  if (!r) return null;
  const speciesId = rivalFightTeam(content, r)[0]!;
  return { id: r.id, name: r.name, speciesId, level: Math.max(5, bossLevel - FINALE_LEVEL_GAP), strikesLeft: FINALE_STRIKES };
}

/** One strike: never lethal, so the boss stays a fight (the rival wears it down, you finish it). */
export function finaleStrikeDamage(content: Content, assist: FinaleAssist, boss: PokemonInstance): { amount: number; effectiveness: number } {
  const own = getSpecies(content, assist.speciesId).types;
  const foe = getSpecies(content, boss.speciesId).types;
  const effectiveness = Math.min(FINALE_CAP, Math.max(...own.map((t) => typeEffectiveness(content.typeChart, t, foe))));
  const raw = Math.max(1, Math.floor((maxHp(content, boss) * FINALE_STRIKE_PERCENT / 100) * effectiveness));
  return { amount: Math.max(0, Math.min(raw, boss.hp - 1)), effectiveness };
}

// ---------- letters between runs ----------

export interface RivalLetter {
  from: string;
  tone: 'warm' | 'sharp' | 'wistful';
  text: string;
}

/** A letter from an archived rival (a finished run's): its tone follows how that rivalry ended. Pure; the Hub shows it. */
export function rivalLetter(rival: { name: string; state: string; resolution: 'good' | 'bad' | null; ultimate?: boolean; world?: { badges: number } | undefined }, seed: number): RivalLetter {
  const pick = <T,>(list: T[]): T => list[Math.abs(seed) % list.length]!;
  const badges = rival.world?.badges ?? 0;
  const news = badges > 0 ? ` I have ${badges} badge${badges === 1 ? '' : 's'} now.` : '';
  if (rival.state === 'ally' || rival.resolution === 'good') {
    return { from: rival.name, tone: 'warm', text: pick([`Hey, it's ${rival.name}. I still think about our last battle.${news} Come find me when you start again.`, `${rival.name} here. I kept your advice in my pocket.${news} Next time, I will be there when it matters.`]) };
  }
  if (rival.state === 'nemesis' || rival.state === 'contender' || rival.resolution === 'bad') {
    return { from: rival.name, tone: 'sharp', text: pick([`Don't think I forgot. ${rival.name}.${news} Train harder. I will.`, `You won once. Once. I have been counting.${news} - ${rival.name}`]) };
  }
  return { from: rival.name, tone: 'wistful', text: pick([`${rival.name} here. The road felt shorter with you on it.${news} Write back when you are ready.`, `I do not know what to call us yet. ${rival.name}.${news} Come and see.`]) };
}

// ---------- the Hub: letters and visits ----------

type ArchivedLike = Parameters<typeof rivalLetter>[0];

/**
 * What the Hub shows about a rival from a past run, or null when there is none. Most visits bring a letter;
 * every third one the rival is there in person and comments on your trophies and run history. Pure.
 */
export function hubRivalNote(archive: readonly ArchivedLike[], seed: number, home: { achievements: number; runsEnded: number; nickname?: string; board?: string; expression?: string }): { kind: 'letter' | 'visit'; text: string; tone: RivalLetter['tone'] } | null {
  if (archive.length === 0) return null;
  const rival = archive[Math.abs(seed) % archive.length]!;
  const letter = rivalLetter(rival, seed);
  if (Math.abs(seed) % 3 !== 0) return { kind: 'letter', text: `Letter from ${letter.from}: "${letter.text}"`, tone: letter.tone };
  const trophies = home.achievements > 0 ? `${home.achievements} trophies on that shelf` : 'an empty shelf, for now';
  const talk = letter.tone === 'warm' ? `You have ${trophies} and ${home.runsEnded} run${home.runsEnded === 1 ? '' : 's'} behind you. I am proud, and I am not saying it twice.`
    : letter.tone === 'sharp' ? `${trophies}, ${home.runsEnded} run${home.runsEnded === 1 ? '' : 's'}. It is not enough to stop me.`
    : `${trophies}. ${home.runsEnded} run${home.runsEnded === 1 ? '' : 's'}. I came to see for myself.`;
  const nick = home.nickname ? ` ${home.nickname}.` : '';
  const face = home.expression ? ` (${home.expression}.)` : '';
  const board = home.board ? ` Head to head: ${home.board}.` : '';
  return { kind: 'visit', text: `${rival.name} stopped by the Hub${face}: "${talk}${nick}"${board}`, tone: letter.tone };
}
