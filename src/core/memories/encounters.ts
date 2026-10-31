// Ghost Trainers From Failed Runs, the Previous-Run Team Gauntlet and Branch Memory's Echo (APPROVED.md §3). All three
// take the first ordinary trainer slot of a later stage (one memory a stage), the way a nemesis does, and none rolls on a
// gameplay stream: the ghost's chance is a hash of the run's seed and the stage.

import type { Content } from '../contentSchema';
import type { PlannedMember, TrainerPlan } from '../encounters';
import { hashSeed, Rng } from '../rng';
import { stageKey } from '../mapItems';
import type { RunState } from '../state';
import { applyStoryEffect } from '../story/effects';
import { emit } from '../story/record';
import { MEMORIES, type PastDigest } from './schema';
import { grantKeepsake } from './keepsakes';
import { dueEcho } from './world';

const STAGE_FLAG = 'memory:stage';
const GHOSTS = 'ghost:count';
const GAUNT_LEFT = 'pgaunt:left';
const GAUNT_NEXT = 'pgaunt:next';
const GAUNT_DONE = 'pgaunt:done';

const num = (run: RunState, key: string): number => Number(run.story.flags[key] ?? 0);
const speciesName = (content: Content, id: string) => content.species.get(id)?.name ?? id;

export const pastGauntletLeft = (run: RunState): number => num(run, GAUNT_LEFT);

/** Starts the Previous-Run Team Gauntlet (an event effect): this many of your past teams, one a stage. Returns how many will come. */
export function startPastGauntlet(content: Content, run: RunState, teams: number): number {
  const n = Math.min(teams, MEMORIES.gauntlet.teams, run.past?.gauntlet.length ?? 0);
  run.story.flags[GAUNT_LEFT] = n;
  run.story.flags[GAUNT_NEXT] = 0;
  run.story.flags['pgaunt:started'] = true;
  if (n > 0) emit(content, run, 'storyMoment', { actors: [], data: { def: 'past-gauntlet-start', suppressed: false }, importance: 70, text: `Took on the Previous-Run Gauntlet: ${n} past team${n === 1 ? '' : 's'} will come for you` });
  return n;
}

/** The player's levels for a past team: the planned fight's strongest level, a little higher, spread over the team in order. */
function teamPlan(plan: TrainerPlan, team: PastDigest['gauntlet'][number]['team'], bonus: number): PlannedMember[] {
  const top = Math.max(...plan.members.map((m) => m.level));
  const size = Math.max(1, Math.min(team.length, plan.members.length + 1, 6));
  return team.slice(0, size).map((m, i) => ({ speciesId: m.speciesId, level: Math.max(1, top + bonus - (i === 0 ? 0 : 1)), ...(m.moves.length ? { moves: m.moves } : {}) }));
}

export interface MemoryPick {
  plan: TrainerPlan;
  memory: { kind: 'ghost' | 'gauntlet' | 'echo'; id: string; note: string };
}

/** Whether an ordinary trainer slot goes to a memory this stage: the Gauntlet first, then an Echo that came due, then (rarely) a Ghost. */
export function memoryPick(content: Content, run: RunState, plan: TrainerPlan): MemoryPick | null {
  const past = run.past;
  const key = stageKey(run);
  if (!key || run.story.flags[STAGE_FLAG] === key) return null;
  // The Gauntlet.
  if (past && pastGauntletLeft(run) > 0) {
    const team = past.gauntlet[num(run, GAUNT_NEXT)];
    if (team) {
      run.story.flags[STAGE_FLAG] = key;
      run.story.flags[GAUNT_NEXT] = num(run, GAUNT_NEXT) + 1;
      return {
        plan: { ...plan, name: `${team.trainer}'s old team`, leaderId: null, members: teamPlan(plan, team.team, MEMORIES.gauntlet.levelBonus), ai: Math.max(plan.ai, 0.5) },
        memory: { kind: 'gauntlet', id: team.runId, note: `Previous-Run Gauntlet: ${team.trainer}'s old team, ${team.team.slice(0, 3).map((m) => speciesName(content, m.speciesId)).join(', ')}${team.team.length > 3 ? '…' : ''}, comes back for you.` },
      };
    }
  }
  // An Echo of a branch you passed by.
  const echo = dueEcho(run);
  if (echo) {
    run.story.flags[STAGE_FLAG] = key;
    echo.done = true;
    return {
      plan: { ...plan, members: plan.members.map((m) => ({ ...m, level: m.level + MEMORIES.world.echoLevelBonus })), ai: Math.max(plan.ai, 0.4) },
      memory: { kind: 'echo', id: echo.id, note: echo.text },
    };
  }
  // A Ghost of a lost run.
  const ghost = past?.ghosts.find((g) => !past.used.includes(`ghost:${g.runId}`));
  if (past && ghost && num(run, GHOSTS) < MEMORIES.ghosts.perRun && run.encountersCompleted >= MEMORIES.ghosts.minEncounters
    && new Rng(hashSeed(`${run.seed}::ghost::${key}`)).float() < MEMORIES.ghosts.chance) {
    run.story.flags[STAGE_FLAG] = key;
    run.story.flags[GHOSTS] = num(run, GHOSTS) + 1;
    return {
      plan: { ...plan, name: `Ghost of ${ghost.trainer}`, leaderId: null, members: teamPlan(plan, ghost.team, MEMORIES.ghosts.levelBonus), ai: Math.max(plan.ai, 0.5) },
      memory: { kind: 'ghost', id: ghost.runId, note: `A pale figure stands in the road: ${ghost.trainer}, who fell in ${ghost.region} to ${ghost.fell}. They are still carrying the team they lost with.` },
    };
  }
  return null;
}

/** After a battle against a memory (mutates `run`): wins pay out, the ghost rests, the gauntlet counts down. Safe to call twice. */
export function memoryAfterBattle(content: Content, run: RunState): void {
  const battle = run.battle;
  const m = battle?.memory;
  if (!battle || !m || battle.outcome !== 'win') return;
  const top = Math.max(...battle.enemyTeam.map((e) => e.level));
  if (m.kind === 'ghost') {
    const ghost = run.past?.ghosts.find((g) => g.runId === m.id);
    applyStoryEffect(content, run, `ghost:${m.id}:money`, { kind: 'money', amount: top * MEMORIES.ghosts.moneyPerLevel });
    if (!run.story.appliedEffects.includes(`ghost:${m.id}:item`)) {
      run.story.appliedEffects.push(`ghost:${m.id}:item`);
      if (!ghost?.memento || !grantKeepsake(content, run, ghost.memento)) applyStoryEffect(content, run, `ghost:${m.id}:fallback`, { kind: 'item', itemId: MEMORIES.ghosts.mementoFallback, quantity: 1 });
    }
    if (run.past && !run.past.used.includes(`ghost:${m.id}`)) run.past.used.push(`ghost:${m.id}`);
    emit(content, run, 'storyMoment', { actors: [], data: { def: 'ghost-rested', suppressed: false }, importance: 80, text: `Laid the Ghost of ${ghost?.trainer ?? 'a past Trainer'} to rest` });
  } else if (m.kind === 'gauntlet') {
    if (run.story.flags[`${GAUNT_DONE}:${m.id}`]) return;
    run.story.flags[`${GAUNT_DONE}:${m.id}`] = true;
    const left = Math.max(0, pastGauntletLeft(run) - 1);
    run.story.flags[GAUNT_LEFT] = left;
    if (left === 0) {
      applyStoryEffect(content, run, 'pgaunt:money', { kind: 'money', amount: MEMORIES.gauntlet.money });
      applyStoryEffect(content, run, 'pgaunt:item', { kind: 'item', itemId: MEMORIES.gauntlet.item, quantity: MEMORIES.gauntlet.itemCount });
      emit(content, run, 'storyMoment', { actors: [], data: { def: 'past-gauntlet-done', suppressed: false }, importance: 85, text: `Beat every team from your past runs (+₽${MEMORIES.gauntlet.money})` });
    }
  } else {
    applyStoryEffect(content, run, `echo:${m.id}:money`, { kind: 'money', amount: top * MEMORIES.world.echoMoneyPerLevel });
    applyStoryEffect(content, run, `echo:${m.id}:item`, { kind: 'item', itemId: MEMORIES.world.echoItem, quantity: 2 });
    emit(content, run, 'storyMoment', { actors: [], data: { def: 'echo-settled', suppressed: false }, importance: 60, text: 'Settled an echo of a road you passed by' });
  }
}
