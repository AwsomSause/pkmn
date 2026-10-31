// Boss Revenge Rematch (APPROVED section 7): a gym leader, Elite Four member or champion you beat comes back
// in a later region, in place of the first ordinary trainer, stronger and having studied how you fought.
// It acknowledges the old battle in its intro, fights as a boss (telegraphed attacks, Guard, phases) and
// starts with +1 Defense and Sp. Def. Once per boss, once per region, on a seeded roll with its own stream
// (so no other roll shifts). Records live in `story.flags` (`bossrev:*`), so the run save needs no new version.

import { Rng, hashSeed } from '../rng';
import type { Content } from '../contentSchema';
import type { BattleState, RunState } from '../state';
import { planChampion, planEliteFour, planGymLeader, type LevelScale, type TrainerPlan } from '../encounters';
import type { Archetype } from '../contentSchema';
import { getSpecies } from '../pokemon';
import { cfgOf, freshSpectacle } from '../battle/spectacle';

type BossKind = 'gym' | 'elite' | 'champion';
const KIND_OF_CLASS: Record<string, BossKind> = { 'gym-leader': 'gym', 'elite-four': 'elite', champion: 'champion' };
const KEY = 'bossrev:';
const REGION_FLAG = 'bossrev-region';

export interface BossRecord { kind: BossKind; id: string; region: number; leadTypes: string[] }

const encode = (r: BossRecord) => `${r.region}|${r.leadTypes.join(',')}`;

/** A boss fight was won: remember who it was, where, and what your lead was (the old battle the rematch refers to). */
export function recordBossDefeat(content: Content, run: RunState, battle: BattleState): void {
  const kind = KIND_OF_CLASS[battle.trainer?.classId ?? ''];
  const id = battle.trainer?.leaderId;
  if (!kind || !id || battle.spectacle?.rematch || battle.spectacle?.final) return;
  const lead = run.party[battle.activeIndex];
  const leadTypes = lead ? getSpecies(content, lead.speciesId).types : [];
  run.story.flags[`${KEY}${kind}:${id}`] = encode({ kind, id, region: run.regionIndex, leadTypes });
}

function records(run: RunState): BossRecord[] {
  const out: BossRecord[] = [];
  for (const [flag, value] of Object.entries(run.story.flags)) {
    if (!flag.startsWith(KEY) || typeof value !== 'string' || !value.includes('|')) continue;
    const [kind, ...rest] = flag.slice(KEY.length).split(':');
    const [region, types] = value.split('|');
    out.push({ kind: kind as BossKind, id: rest.join(':'), region: Number(region), leadTypes: types ? types.split(',') : [] });
  }
  return out.sort((a, b) => a.region - b.region || a.id.localeCompare(b.id));
}

/** The beaten boss that returns now, or null: a later region, once per region and per boss, on a seeded roll. */
export function dueBossRematch(content: Content, run: RunState): BossRecord | null {
  const cfg = cfgOf(content);
  if (!cfg.enabled || !cfg.rematch.enabled || run.story.flags[REGION_FLAG] === run.regionIndex) return null;
  const pick = records(run).find((r) => r.region < run.regionIndex && run.story.flags[`${KEY}done:${r.id}`] === undefined && new Rng(hashSeed(`${run.seed}::bossrev::${r.id}::${run.regionIndex}`)).float() < cfg.rematch.chance);
  return pick ?? null;
}

/** The rematch team: the boss's own team planned for this stage, a few levels up, with an ordinary class (no second badge or heal). */
export function bossRematchPlan(
  content: Content,
  run: RunState,
  archetype: Archetype,
  rec: BossRecord,
  stageNumber: number,
  scale: LevelScale,
  base: TrainerPlan,
): { plan: TrainerPlan; note: string } {
  const cfg = cfgOf(content).rematch;
  const r = new Rng(hashSeed(`${run.seed}::bossrev::plan::${rec.id}::${run.regionIndex}`));
  const planned =
    rec.kind === 'gym' ? planGymLeader(content, archetype, rec.id, stageNumber, scale, r)
    : rec.kind === 'elite' ? planEliteFour(content, archetype, rec.id, run.regionIndex, scale, r)
    : planChampion(content, archetype, rec.id, run.regionIndex, scale, r);
  const top = Math.max(...base.members.map((m) => m.level));
  const members = planned.members.map((m) => ({ ...m, level: Math.max(m.level, top) + cfg.levelBonus }));
  const studied = rec.leadTypes.length > 0 ? `your ${rec.leadTypes.map((t) => t[0]!.toUpperCase() + t.slice(1)).join('/')}-types` : 'how you fought';
  const note = `${planned.name} is back for a rematch! They have been studying ${studied}, and will not lose the same way twice.`;
  return { plan: { ...base, name: `${planned.name} (Rematch)`, leaderId: null, members, ai: Math.max(base.ai, cfg.ai), memoryNote: note }, note };
}

/** Marks the battle as a rematch: boss rules apply, its Pokémon open with +1 Defense and Sp. Def, and it never returns twice. */
export function beginBossRematch(run: RunState, rec: BossRecord): void {
  const battle = run.battle!;
  battle.spectacle = { ...freshSpectacle(), rematch: rec.id };
  battle.enemyStages.def = Math.min(6, battle.enemyStages.def + 1);
  battle.enemyStages.spd = Math.min(6, battle.enemyStages.spd + 1);
  run.story.flags[`${KEY}done:${rec.id}`] = run.regionIndex;
  run.story.flags[REGION_FLAG] = run.regionIndex;
}
