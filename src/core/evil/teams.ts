// Evil Teams (spec §16). One team works in each run's world. It is picked by a hash of the run seed once the run
// reaches `config.firstStage` (no gameplay stream is rolled), then:
//  - Storyline: seven beats (suspicious trainers, evidence, recognition, an executive, the executive returns, the
//    real plan, the hideout). Each beat is a forced map stop (core/evil/content.ts) that comes due `beatEvery`
//    stages after the last one. Every choice moves the story on; the hideout can end it by battle, by exposing the
//    team (enough operations stopped), with a defector's help, or by striking a deal.
//  - Operations: one per region. Stopping it (battle or disguise) leaves a lasting upside, letting it through or
//    helping leaves a lasting downside (`consequences` in evilTeams.json, added to the run's modifiers for good).
//    An operation still running when you leave its region succeeds.
//  - Heat: how hard the team pushes back. It adds levels and reinforcements to their battles and, past
//    `ambushAt`, ambushes.
//  - Recurring villains: the executive and leader remember every meeting. Their teams grow and their lines change
//    (first meeting, after you beat them, after they beat you, grudging respect).

import type { Content, EventBattle, EventCondition, EventEffect } from '../contentSchema';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import { emit } from '../story/record';
import { recordChoice } from './choices';
import { freshEvil, type EvilRank, type EvilState, type EvilTeam, type VillainRecord } from './schema';

type EvilCondition = Extract<EventCondition, { kind: 'evil' }>;
type EvilEffect = Extract<EventEffect, { kind: 'evil' }>;
type TrainerBattle = Extract<EventBattle, { kind: 'trainer' }>;

/** The run's Evil Team state (older runs are given a fresh one). */
export function evilOf(run: RunState): EvilState {
  if (!run.story.evil) run.story.evil = freshEvil();
  return run.story.evil;
}

export function evilTeam(content: Content, run: RunState): EvilTeam | null {
  const id = run.story.evil?.teamId;
  return id ? (content.evilTeams.teams.find((t) => t.id === id) ?? null) : null;
}

const tell = (content: Content, run: RunState, def: string, text: string, importance: number) => emit(content, run, 'storyMoment', { actors: [], data: { def, suppressed: false }, importance, text });

const stoppedCount = (s: EvilState): number => s.ops.filter((o) => o.outcome === 'foiled' || o.outcome === 'infiltrated').length;
const successCount = (s: EvilState): number => s.ops.filter((o) => o.outcome === 'succeeded' || o.outcome === 'joined').length;

/** The operation running in the current region, if any. */
export function runningOp(run: RunState): EvilState['ops'][number] | null {
  return evilOf(run).ops.find((o) => o.region === run.regionIndex && o.outcome === 'running') ?? null;
}

/** Called as each stage begins (core/run.ts): counts stages, picks the team, ends a left-behind operation and starts this region's. */
export function evilStageStart(content: Content, run: RunState): void {
  const s = evilOf(run);
  const cfg = content.evilTeams.config;
  s.stages += 1;
  if (!s.teamId) {
    if (s.stages < cfg.firstStage || content.evilTeams.teams.length === 0) return;
    const focus = (run.perkEffects ?? []).flatMap((m) => (m.kind === 'evilTeamFocus' ? m.teams : []));
    const focused = content.evilTeams.teams.filter((t) => focus.includes(t.id));
    const teams = focused.length > 0 ? focused : content.evilTeams.teams;
    const team = teams[new Rng(hashSeed(`${run.seed}::evil-team`)).int(0, teams.length - 1)]!;
    s.teamId = team.id;
    s.nextAt = s.stages;
    tell(content, run, 'evil-team', `Rumours spread of ${team.name}. People say they mean to ${team.goal}.`, 55);
  }
  const team = evilTeam(content, run);
  if (!team) return;
  // An operation left running in an earlier region goes through.
  for (const op of s.ops) if (op.outcome === 'running' && op.region !== run.regionIndex) resolveOp(content, run, team, op, 'succeeded');
  if (s.end !== 'none' || s.ops.some((o) => o.region === run.regionIndex)) return;
  const def = team.ops[s.ops.length % team.ops.length]!;
  s.ops.push({ id: def.id, region: run.regionIndex, outcome: 'running' });
  tell(content, run, 'evil-op', `${team.name} has started an operation in this region: ${def.name}. ${def.text}`, 60);
}

export function evilConditionMet(content: Content, run: RunState, c: EvilCondition): boolean {
  const s = run.story.evil;
  if (!s?.teamId) return false;
  if (c.team !== undefined && s.teamId !== c.team) return false;
  if (c.beat !== undefined && (s.beat !== c.beat || s.stages < s.nextAt || s.end !== 'none')) return false;
  if (c.after !== undefined && s.beat < c.after) return false;
  if (c.op !== undefined && runningOp(run)?.id !== c.op) return false;
  if (c.heat !== undefined && s.heat < c.heat) return false;
  if (c.defector !== undefined && s.defector !== c.defector) return false;
  if (c.ends !== undefined && !c.ends.includes(s.end)) return false;
  if (c.stopped !== undefined && stoppedCount(s) < c.stopped) return false;
  return true;
}

export function evilConditionText(c: EvilCondition): string {
  if (c.defector) return 'Needs someone on the inside';
  if (c.stopped) return `Needs ${c.stopped} of their operation${c.stopped === 1 ? '' : 's'} stopped`;
  if (c.heat) return 'Only when the team is hunting you';
  return 'Needs the right moment in the Evil Team story';
}

/** What a recurring villain says, following how your past meetings went. */
export function villainLine(team: EvilTeam, rank: EvilRank, rec: VillainRecord | undefined): string {
  const lines = team.ranks[rank].lines;
  if (!rec || rec.met === 0) return lines.first;
  if (rec.won >= 2) return lines.respect;
  return rec.last === 'won' ? lines.beaten : lines.winning;
}

/** Applies an `evil` effect. Returns the change in words. */
export function applyEvilEffect(content: Content, run: RunState, e: EvilEffect): string {
  const team = evilTeam(content, run);
  const s = evilOf(run);
  if (!team) return '';
  const words: string[] = [];
  if (e.talk) words.push(`${team.ranks[e.talk].name}: ${villainLine(team, e.talk, s.villains[e.talk])}`);
  if (e.beat && s.beat < 7) {
    s.beat += 1;
    s.nextAt = s.stages + content.evilTeams.config.beatEvery;
    words.push(s.beat === 7 ? `the ${team.name} story reaches its end` : `the ${team.name} story moves on (${s.beat}/7)`);
  }
  if (e.heat !== 0) {
    const before = s.heat;
    s.heat = Math.max(0, Math.min(content.evilTeams.config.heatMax, s.heat + e.heat));
    if (s.heat !== before) words.push(s.heat > before ? `${team.name} is angrier (heat ${s.heat})` : `${team.name} eases off (heat ${s.heat})`);
  }
  if (e.op) {
    const op = runningOp(run);
    if (op) words.push(resolveOp(content, run, team, op, e.op));
  }
  if (e.defect && !s.defector) {
    s.defector = true;
    tell(content, run, 'evil-defector', `A ${team.ranks.grunt.name} defected from ${team.name} to help you.`, 70);
    words.push('a defector joins your side');
  }
  if (e.end && s.end === 'none') {
    s.end = e.end;
    const text = e.end === 'defeated' ? `${team.ranks.leader.name} is beaten and ${team.name} falls apart.` : e.end === 'exposed' ? `${team.name} is exposed to the world and flees the region.` : `You made a deal with ${team.ranks.leader.name}. ${team.name} answers to no one now.`;
    tell(content, run, `evil-end-${e.end}`, text, 90);
    words.push(text);
  }
  return words.join(' · ');
}

/** Ends an operation and adds its lasting consequence to the run (once per operation). */
function resolveOp(content: Content, run: RunState, team: EvilTeam, op: EvilState['ops'][number], outcome: Exclude<EvilState['ops'][number]['outcome'], 'running'>): string {
  op.outcome = outcome;
  const def = team.ops.find((o) => o.id === op.id);
  const cons = def ? content.evilTeams.consequences[def.kind] : undefined;
  const stopped = outcome === 'foiled' || outcome === 'infiltrated';
  const side = cons ? (stopped ? cons.stopped : cons.through) : null;
  const key = `evil:op:${op.id}:${op.region}`;
  if (side && !run.story.flags[key]) {
    run.story.flags[key] = true;
    run.perkEffects = [...(run.perkEffects ?? []), ...side.effects];
  }
  const verb = { foiled: 'You shut down', infiltrated: 'You sabotaged', succeeded: `${team.name} pulled off`, joined: 'You helped with' }[outcome];
  const name = def?.name ?? op.id;
  recordChoice(content, run, { id: `${team.id}-op-${op.id}-${op.region}`, pick: outcome, text: `${verb} ${name}`, weight: 2 });
  const text = `${verb} ${name}.${side ? ` ${side.text}` : ''}`;
  tell(content, run, 'evil-op-end', text, stopped ? 70 : 60);
  return text;
}

export interface EvilBattlePlan {
  name: string;
  species: string[];
  size: number;
  levelBonus: number;
  shadow: number;
}

/** The team, levels and rule for an Evil Team battle at this rank; counts the meeting for a recurring villain. */
export function evilBattle(content: Content, run: RunState, b: TrainerBattle): EvilBattlePlan | null {
  const team = evilTeam(content, run);
  if (!team || !b.evil) return null;
  const s = evilOf(run);
  const cfg = content.evilTeams.config;
  const rank = team.ranks[b.evil];
  const rec = s.villains[b.evil] ?? { met: 0, won: 0, lost: 0, last: 'none' };
  const recurring = b.evil === 'executive' || b.evil === 'leader';
  let size = b.size + (s.heat >= cfg.reinforceAt ? 1 : 0) + (recurring ? Math.min(2, rec.met) : 0);
  let levelBonus = Math.floor(s.heat / cfg.heatPerLevel) + successCount(s) * cfg.levelsPerSuccess + (recurring ? rec.met * cfg.levelsPerMeeting : 0);
  let shadow = b.shadow;
  if (team.rule.kind === 'swarm') size += 1;
  if (team.rule.kind === 'elite') {
    size -= 1;
    levelBonus += 2;
  }
  if (team.rule.kind === 'shadow') shadow = Math.max(shadow, 1);
  size = Math.max(1, Math.min(6, size));
  // The meeting counts as theirs until you win it (evilBattleWon).
  s.villains[b.evil] = { met: rec.met + 1, won: rec.won, lost: rec.lost + 1, last: 'lost' };
  return { name: rank.name, species: rank.species.slice(0, size), size, levelBonus, shadow: Math.min(shadow, size) };
}

/** You won an Evil Team battle: the villain remembers it. */
export function evilBattleWon(run: RunState, b: TrainerBattle): void {
  if (!b.evil) return;
  const rec = evilOf(run).villains[b.evil];
  if (!rec) return;
  evilOf(run).villains[b.evil] = { met: rec.met, won: rec.won + 1, lost: Math.max(0, rec.lost - 1), last: 'won' };
}

/** The Story screen's summary of the run's Evil Team. */
export function evilSummary(content: Content, run: RunState): { title: string; lines: string[]; color: string } | null {
  const team = evilTeam(content, run);
  if (!team) return null;
  const s = evilOf(run);
  const end = { none: s.beat === 7 ? 'they escaped' : `story ${s.beat}/7`, defeated: 'defeated', exposed: 'exposed', allied: 'your allies' }[s.end];
  const lines = [`${team.philosophy} Goal: ${team.goal}. Rule: ${team.rule.text}`];
  lines.push(`Heat ${s.heat}/${content.evilTeams.config.heatMax}.${s.defector ? ' A defector is on your side.' : ''}`);
  for (const op of s.ops) {
    const def = team.ops.find((o) => o.id === op.id);
    lines.push(`Region ${op.region + 1}: ${def?.name ?? op.id} (${op.outcome === 'running' ? 'still running' : op.outcome})`);
  }
  for (const rank of ['executive', 'leader'] as const) {
    const rec = s.villains[rank];
    if (rec && rec.met > 0) lines.push(`${team.ranks[rank].name}: met ${rec.met}, you won ${rec.won}.`);
  }
  return { title: `${team.name} (${team.style === 'open' ? 'openly hostile' : team.style === 'secret' ? 'works in secret' : `hides behind ${team.front}`}): ${end}`, lines, color: team.color };
}
