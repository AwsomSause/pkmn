// World recognition (M11, Expanded Systems §5.1-5.3, §8.5): what the world says and shows about your rivals and
// about you. Reads the rival progression record (rivals/progression.ts) and never writes it. Lines and gates are
// chosen by hashing (drama `pickIndex`), never by gameplay RNG, so asking twice gives the same answer.

import { z } from 'zod';
import json from '../../data/rivalRecognition.json';
import type { Content } from '../contentSchema';
import { pickIndex } from '../drama/schema';
import { addItem } from '../items';
import type { RunState } from '../state';
import { emit } from '../story/record';
import { RIVAL_STATUSES, rivalWorldView, stageKeyOf, type RivalWorldView } from './progression';
import { ultimateRival } from './ultimate';

const lines = z.array(z.string()).min(1);
export const RecognitionSchema = z.object({
  note: z.string(),
  npcChance: z.number().min(0).max(1),
  sightingChance: z.number().min(0).max(1),
  headlineFame: z.number().int().min(0),
  posterFame: z.number().int().min(0),
  farAheadLead: z.number().int().min(1),
  npc: z.object({ falseProtagonist: lines, playerBeatRival: lines, champion: lines, candidate: lines, gymWin: lines, beatRival: lines, farAhead: lines, ahead: lines, behind: lines, narrativeLoss: lines }),
  titleLines: z.record(z.string(), lines),
  sightings: z.array(z.object({ id: z.string(), statuses: z.array(z.enum(RIVAL_STATUSES)).min(1), text: z.string(), item: z.object({ id: z.string(), quantity: z.number().int().min(1) }).optional() })).min(1),
  environment: z.object({ poster: z.string(), championPoster: z.string(), headlineGym: z.string(), headlineRival: z.string(), headlineLoss: z.string(), headlinePlayer: z.string(), championBoard: z.string(), leaderboard: z.string() }),
  signature: z.object({ aceIntro: lines, aceDefeat: lines }),
  rivalries: z.object({ duelChance: z.number().min(0).max(1), obsessedAfter: z.number().int().min(1), teamUpMinLead: z.number().int().min(1), duel: z.string(), gymRace: z.string(), spotlight: z.string(), obsessed: z.string(), teamUp: z.string() }),
  titles: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  titleRules: z.object({ risingStarVictories: z.number().int(), challengerBadges: z.number().int(), nightmareRivalWins: z.number().int(), peoplesChampionFame: z.number().int() }),
});
export const RECOGNITION = RecognitionSchema.parse(json);

/** Set by the lost-timeline replay (M13): the player is The False Protagonist in this run. */
export const FALSE_PROTAGONIST_FLAG = 'falseProtagonist';
/** Set by narrative rival defeats (M12): the id of the rival that last beat you in a story loss. */
export const NARRATIVE_LOSS_FLAG = 'narrativeLossBy';

export function fillLine(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}
const pick = (pool: readonly string[], key: string) => pool[pickIndex(key, pool.length)]!;
const chance = (key: string, p: number) => pickIndex(key, 10000) < Math.round(p * 10000);

// ---------- the Protagonist Effect (§8.5) ----------

export type ProtagonistTitleId = 'nobody' | 'risingStar' | 'regionalChallenger' | 'peoplesChampion' | 'rivalsNightmare' | 'protagonist' | 'falseProtagonist' | 'unwrittenLegend';

/** Wins over rivals this run (from nemesis.ts noteRivalResult flags). */
export function rivalWins(run: RunState): number {
  return Object.entries(run.story.flags).reduce((n, [k, v]) => n + (k.startsWith('rivalW:') ? Number(v) || 0 : 0), 0);
}
function rivalLosses(run: RunState): number {
  return Object.entries(run.story.flags).reduce((n, [k, v]) => n + (k.startsWith('rivalL:') ? Number(v) || 0 : 0), 0);
}

/** Your reputation: badges, rival wins and cleared regions count; losses to rivals cost a little. */
export function playerFame(run: RunState): number {
  return Math.max(0, run.badges.length * 3 + rivalWins(run) * 4 + run.regionsCleared.length * 10 - rivalLosses(run) * 2);
}

/** The title the world knows you by. Presentation and dialogue only, never a gameplay bonus. */
export function protagonistTitle(run: RunState): { id: ProtagonistTitleId; name: string } {
  const r = RECOGNITION.titleRules;
  const campaignDone = run.regionOrder.length > 0 && run.regionsCleared.length >= run.regionOrder.length;
  const id: ProtagonistTitleId = run.story.flags[FALSE_PROTAGONIST_FLAG] ? 'falseProtagonist'
    : campaignDone && rivalLosses(run) === 0 && rivalWins(run) >= r.nightmareRivalWins ? 'unwrittenLegend'
      : campaignDone ? 'protagonist'
        : run.regionsCleared.length > 0 && playerFame(run) >= r.peoplesChampionFame ? 'peoplesChampion'
          : rivalWins(run) >= r.nightmareRivalWins ? 'rivalsNightmare'
            : run.badges.length >= r.challengerBadges ? 'regionalChallenger'
              : run.badges.length + rivalWins(run) >= r.risingStarVictories ? 'risingStar'
                : 'nobody';
  return { id, name: RECOGNITION.titles.find((t) => t.id === id)?.name ?? id };
}

const TITLE_FLAG = 'protagonistTitle';

/** At each stage start: a new title is announced once in the chronicle. Mutates `run`. */
export function noteProtagonistTitle(content: Content, run: RunState): void {
  const t = protagonistTitle(run);
  const prev = run.story.flags[TITLE_FLAG];
  if (prev === t.id || (prev === undefined && t.id === 'nobody')) return;
  run.story.flags[TITLE_FLAG] = t.id;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'protagonistTitle', title: t.id }, importance: 60, text: `People have started calling you ${t.name}` });
}

// ---------- which rival the world is talking about ----------

/** The rival the world talks about now: the Ultimate Rival if it has a record, else the most famous one. */
export function talkedAbout(content: Content, run: RunState): RivalWorldView | null {
  const views = rivalWorldView(content, run).filter((v) => v.status !== 'missing' && v.last !== null);
  const ult = ultimateRival(run);
  return views.find((v) => v.id === ult?.id) ?? views[0] ?? null;
}

const otherName = (content: Content, run: RunState, rivalId: string, kind: string): string | null => {
  const r = run.story.rivals.find((x) => x.id === rivalId);
  const m = [...(r?.world?.milestones ?? [])].reverse().find((x) => x.kind === kind);
  if (!m) return null;
  const ev = [...run.story.events].reverse().find((e) => e.type === 'rivalProgress' && e.seq === m.seq);
  const other = run.story.rivals.find((x) => x.id === ev?.data.other);
  return other ? `${content.trainers.get(other.classId)?.name ?? 'Trainer'} ${other.name}` : null;
};

/** The situation an NPC would talk about (§5.1), or null when there is nothing to say. Pure. */
export function npcSituation(content: Content, run: RunState): { situation: keyof typeof RECOGNITION.npc; view: RivalWorldView } | null {
  const v = talkedAbout(content, run);
  if (!v) return null;
  const here = stageKeyOf(run);
  const recent = run.story.rivals.find((r) => r.id === v.id)?.world?.milestones.filter((m) => m.at === here).map((m) => m.kind) ?? [];
  const situation: keyof typeof RECOGNITION.npc | null = run.story.flags[FALSE_PROTAGONIST_FLAG] ? 'falseProtagonist'
    : run.story.flags[NARRATIVE_LOSS_FLAG] === v.id && recent.includes('narrativeWin') ? 'narrativeLoss'
      : v.status === 'defeated' ? 'playerBeatRival'
        : v.status === 'champion' ? 'champion'
          : v.status === 'championCandidate' ? 'candidate'
            : v.status === 'gymVictor' ? 'gymWin'
              : recent.includes('beatRival') ? 'beatRival'
                : v.lead >= RECOGNITION.farAheadLead ? 'farAhead'
                  : v.lead > 0 ? 'ahead'
                    : v.lead < 0 ? 'behind'
                      : null;
  return situation ? { situation, view: v } : null;
}

/**
 * An NPC's line about the world (§5.1), or null (most of the time: `npcChance`). `key` names the speaker and
 * moment (e.g. the battle key), so the same NPC says the same thing. Falls back to a line about your title.
 */
export function npcWorldLine(content: Content, run: RunState, key: string): string | null {
  if (!chance(`${run.seed}|npc|${key}`, RECOGNITION.npcChance)) return null;
  const s = npcSituation(content, run);
  if (s) {
    const other = s.situation === 'beatRival' ? otherName(content, run, s.view.id, 'beatRival') : null;
    const pool = RECOGNITION.npc[s.situation].filter((l) => other || !l.includes('{other}'));
    return fillLine(pick(pool, `${run.seed}|npcLine|${key}`), { rival: s.view.title, badges: s.view.badges, other: other ?? '' });
  }
  const t = protagonistTitle(run);
  const pool = RECOGNITION.titleLines[t.id];
  return pool ? pick(pool, `${run.seed}|titleLine|${key}`) : null;
}

// ---------- environmental recognition (§5.2) ----------

export interface WorldBoard {
  kind: 'poster' | 'headline' | 'championBoard' | 'leaderboard';
  text: string;
}

/** Posters, headlines, the Champion board and the rival leaderboard, from the current record. Pure. */
export function worldBoards(content: Content, run: RunState): WorldBoard[] {
  const env = RECOGNITION.environment;
  const views = rivalWorldView(content, run);
  const out: WorldBoard[] = [];
  for (const v of views) {
    if (v.status === 'champion') {
      out.push({ kind: 'poster', text: fillLine(env.championPoster, { rival: v.title }) });
      out.push({ kind: 'championBoard', text: fillLine(env.championBoard, { rival: v.title }) });
    } else if (v.fame >= RECOGNITION.posterFame) out.push({ kind: 'poster', text: fillLine(env.poster, { rival: v.title }) });
    if (v.fame < RECOGNITION.headlineFame && v.last !== 'lostToPlayer') continue;
    const other = v.last === 'beatRival' ? otherName(content, run, v.id, 'beatRival') : null;
    const h = v.last === 'badge' ? env.headlineGym : other ? env.headlineRival : v.last === 'lostToPlayer' ? env.headlinePlayer : v.last === 'unseenLoss' || v.last === 'lostToRival' ? env.headlineLoss : null;
    if (h) out.push({ kind: 'headline', text: fillLine(h, { rival: v.title, badges: v.badges, other: other ?? '' }) });
  }
  const ranked = views.filter((v) => v.wins + v.defeats > 0);
  if (ranked.length > 0) out.push({ kind: 'leaderboard', text: `${env.leaderboard}: ${ranked.map((v, i) => `${i + 1}. ${v.title} (${v.fame})`).join('  ')}` });
  return out;
}

/** The single headline for the map screen (the newest news), or null. */
export function topHeadline(content: Content, run: RunState): string | null {
  const boards = worldBoards(content, run);
  return (boards.find((b) => b.kind === 'headline') ?? boards.find((b) => b.kind === 'poster'))?.text ?? null;
}

// ---------- rival sightings (§5.3) ----------

const sightingFlag = (run: RunState) => `rivalSighting:${stageKeyOf(run)}`;

/** Once per stage, sometimes: evidence a rival passed through, fitting its status. Applies once (flag). Mutates `run`. */
export function rivalSighting(content: Content, run: RunState): string | null {
  const flag = sightingFlag(run);
  if (run.story.flags[flag] !== undefined) return null;
  run.story.flags[flag] = false;
  if (!chance(`${run.seed}|sighting|${stageKeyOf(run)}`, RECOGNITION.sightingChance)) return null;
  const v = talkedAbout(content, run);
  if (!v) return null;
  const fits = RECOGNITION.sightings.filter((s) => s.statuses.includes(v.status));
  if (fits.length === 0) return null;
  const s = fits[pickIndex(`${run.seed}|sightingPick|${stageKeyOf(run)}`, fits.length)]!;
  if (s.item && content.items.has(s.item.id)) addItem(run.inventory, s.item.id, s.item.quantity);
  const text = fillLine(s.text, { rival: v.title, badges: v.badges });
  run.story.flags[flag] = s.id;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'rivalSighting', sighting: s.id, rival: v.id }, importance: 45, text: `Sighting: ${text}` });
  return text;
}
