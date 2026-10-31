// The False Protagonist (M13, Kice's spec §4.2–4.5): in a replayed timeline the rival who mattered most in the lost run is
// already ahead. It starts as the leader of the first Gym you reach, climbs to the regional finals and then the Champion's seat
// (each once, through the rival takeover of core/rivals/promotion.ts), and the world talks about it instead of you.
// The replay ends in one of five outcomes. Every roll here has its own seed, so the gameplay streams never move.

import { z } from 'zod';
import timelineJson from '../../data/timeline.json';
import type { Content } from '../contentSchema';
import { planFirstRival } from '../encounters';
import { hashSeed, Rng } from '../rng';
import { RIVAL_RANKS, takeoverFlag } from '../rivals/promotion';
import { RIVAL_PROFILES } from '../rivals/schema';
import { factionFor } from '../rivals/standing';
import type { BattleState, RunState } from '../state';
import { emit } from '../story/record';
import { TRAIT_KEYS, type Rival, type Traits } from '../story/schema';
import type { TimelineOrigin } from './schema';

const RankLines = z.object({ gymLeader: z.string(), finalist: z.string(), champion: z.string() });
export const TIMELINE = z
  .object({
    npcLineChance: z.number().min(0).max(1),
    impossible: z.object({ maxStanding: z.number().int().min(1), levelGap: z.number().int().min(1) }),
    title: z.string().min(1),
    start: z.string(),
    npcLines: z.array(z.string()).min(1),
    rivalIntro: RankLines,
    afterWin: RankLines,
    outcomes: z.array(z.object({ id: z.enum(['impossible-victory', 'usurper', 'catch-up', 'second-place', 'forgotten']), name: z.string(), text: z.string() })).length(5),
  })
  .parse(timelineJson);

export type OutcomeId = (typeof TIMELINE.outcomes)[number]['id'];

/** The front-runner's rival id in a replay (never used by a normal run's rivals, which are "rival-<event id>"). */
export const FRONT_RUNNER_ID = 'rival-timeline-front-runner';
/** Story flags: set when the replay began, when you beat the front-runner at a rank, and for an Impossible Victory. */
export const FP_FLAG = 'timeline:false-protagonist';
const beatFlag = (rank: string) => `timeline:beat:${rank}`;
const IMPOSSIBLE_FLAG = 'timeline:impossible';

const RANK_ORDER: readonly string[] = RIVAL_RANKS;

/** The rival's display name ("Rival Blue"). */
export const rivalTitle = (content: Content, r: Pick<Rival, 'classId' | 'name'>): string => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;
const fill = (text: string, who: string) => text.replaceAll('{rival}', who);

/** The rival of a finished run that mattered most: the one that beat you, else the highest ranked, most met. Falls back to the run's first rival. */
export function pickOriginRival(content: Content, run: Pick<RunState, 'story' | 'log' | 'seed'>): Rival {
  const rivals = run.story.rivals;
  const killer = run.log.defeatedBy?.trainer ? rivals.find((r) => r.name === run.log.defeatedBy!.trainer) : undefined;
  const score = (r: Rival) => (r.rank ? RANK_ORDER.indexOf(r.rank) + 1 : 0) * 1000 + r.encounters * 10 + r.rivalPotential;
  const best = killer ?? [...rivals].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
  if (best) return structuredClone(best);
  // No rival was sparked: the scripted first rival of this seed (the same trainer the replay meets) takes the role.
  const plan = planFirstRival(content, run.seed);
  const personalityId = Object.keys(RIVAL_PROFILES.personalities).sort()[0]!;
  const personality = RIVAL_PROFILES.personalities[personalityId]!;
  const traits = Object.fromEntries(TRAIT_KEYS.map((k) => [k, personality.traits[k]])) as Traits;
  return {
    id: FRONT_RUNNER_ID, classId: plan.classId, name: plan.name, archetype: personalityId, style: personality.styles[0]!, traits, rivalPotential: 0,
    origin: { eventId: 'timeline', where: { region: 0, stage: 0, level: null, node: null, battle: null, turn: null }, path: 'timeline' }, state: 'contender', encounters: 0, setbacks: 0, arc: null, away: 0,
    cooldown: 0, progress: 0, bonds: {}, offscreen: [], faction: factionFor(personalityId), adaptations: [],
    memory: { lastBattle: { eventId: 'timeline', result: 'win', hpLeftShare: 1, turns: 0, team: plan.members.map((m) => m.speciesId) } },
  };
}

/** What a lost run leaves for its replays: how far you got and who mattered. */
export function captureOrigin(content: Content, run: RunState): TimelineOrigin {
  return { badges: run.badges.length, regionsCleared: run.regionsCleared.length, encounters: run.encountersCompleted, rival: pickOriginRival(content, run) };
}

export const isFalseProtagonist = (run: Pick<RunState, 'timeline' | 'story'>): boolean => !!run.timeline && run.story.flags[FP_FLAG] === true;
export const frontRunner = (run: Pick<RunState, 'story'>): Rival | undefined => run.story.rivals.find((r) => r.id === FRONT_RUNNER_ID);

/**
 * A replay begins: the front-runner joins the run already a contender who has won a Gym, and waits there for you
 * (mutates `run`). Without an origin (a run lost before this was recorded) it is built from the seed's first rival.
 */
export function seedFrontRunner(content: Content, run: RunState, origin: TimelineOrigin | null): void {
  const base = origin?.rival ?? pickOriginRival(content, { story: { ...run.story, rivals: [] }, log: { ...run.log, defeatedBy: null }, seed: run.seed });
  const rival: Rival = {
    ...structuredClone(base),
    id: FRONT_RUNNER_ID,
    state: 'contender',
    rank: 'gymLeader',
    arc: null,
    cooldown: 0,
    away: 0,
    // It remembers the old timeline: every win over you there counts.
    encounters: Math.max(base.encounters, 1),
  };
  run.story.rivals = [rival, ...run.story.rivals.filter((r) => r.id !== FRONT_RUNNER_ID)];
  run.story.flags[takeoverFlag(rival)] = 'timeline';
  run.story.flags[FP_FLAG] = true;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'timeline-start', suppressed: false }, importance: 70, text: fill(TIMELINE.start, rivalTitle(content, rival)) });
}

/** The front-runner's line before a takeover battle, or null when this is not the front-runner. */
export function frontRunnerIntro(content: Content, rival: Rival): string | null {
  if (rival.id !== FRONT_RUNNER_ID || !rival.rank) return null;
  return fill(TIMELINE.rivalIntro[rival.rank], rivalTitle(content, rival));
}

/** A new stage of a replay: sometimes a stranger reminds you whose story this is now (its own seed). */
export function timelineStageLine(content: Content, run: RunState): void {
  const fr = isFalseProtagonist(run) ? frontRunner(run) : undefined;
  if (!fr) return;
  const rng = new Rng(hashSeed(`${run.seed}::timeline-npc::${run.regionIndex}.${run.stage?.index ?? 0}`));
  if (!rng.chance(TIMELINE.npcLineChance)) return;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'timeline-npc', suppressed: false }, importance: 40, text: `“${fill(rng.pick(TIMELINE.npcLines), rivalTitle(content, fr))}”` });
}

/**
 * A battle with the front-runner just ended (mutates `run`). A win is remembered by rank, may be an Impossible Victory at the top,
 * and sends the rival one rank higher to wait in a later stage; a loss changes nothing here (the run's end decides the outcome).
 */
export function onFrontRunnerBattle(content: Content, run: RunState, battle: Pick<BattleState, 'rivalId' | 'enemyTeam'>, outcome: 'win' | 'lose'): void {
  if (battle.rivalId !== FRONT_RUNNER_ID || outcome !== 'win') return;
  const fr = frontRunner(run);
  if (!fr?.rank) return;
  const rank = fr.rank;
  run.story.flags[beatFlag(rank)] = true;
  if (rank === 'champion') {
    const standing = run.party.filter((m) => m.hp > 0).length;
    const gap = Math.max(...battle.enemyTeam.map((m) => m.level)) - Math.max(...run.party.map((m) => m.level));
    if (standing <= TIMELINE.impossible.maxStanding || gap >= TIMELINE.impossible.levelGap) run.story.flags[IMPOSSIBLE_FLAG] = true;
  }
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'timeline-win', suppressed: false }, importance: 75, text: fill(TIMELINE.afterWin[rank], rivalTitle(content, fr)) });
  fr.setbacks += 1;
  const next = RIVAL_RANKS[RANK_ORDER.indexOf(rank) + 1];
  // It climbs again while you are away; only one Champion per run.
  if (!next || (next === 'champion' && run.story.rivals.some((r) => r.rank === 'champion' && r.id !== FRONT_RUNNER_ID))) return;
  fr.rank = next;
  run.story.flags[takeoverFlag(fr)] = `${run.regionIndex}.${run.stage?.index ?? 0}`;
}

/** How a finished replay ended: the five outcomes of §4.5, best first. */
export function timelineOutcome(content: Content, run: Pick<RunState, 'story' | 'victory'>): { id: OutcomeId; name: string; text: string } {
  const f = run.story.flags;
  const id: OutcomeId =
    f[beatFlag('champion')] && f[IMPOSSIBLE_FLAG] ? 'impossible-victory'
    : f[beatFlag('champion')] ? 'usurper'
    : f[beatFlag('gymLeader')] || f[beatFlag('finalist')] ? 'catch-up'
    : run.victory ? 'second-place'
    : 'forgotten';
  const def = TIMELINE.outcomes.find((o) => o.id === id)!;
  const fr = frontRunner(run);
  return { id, name: def.name, text: fill(def.text, fr ? rivalTitle(content, fr) : 'your rival') };
}
