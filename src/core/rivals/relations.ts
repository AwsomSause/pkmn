// How rivals affect each other and how they remember you (Examples §8): training exchange,
// rival-to-rival Pokémon influence, the rivalry triangle, a substitute for a tired ace, and
// remembering a close battle. Pure functions over run state; seeded, never the gameplay streams.

import { hashSeed, Rng } from '../rng';
import type { Content } from '../contentSchema';
import { typeEffectiveness } from '../battle/damage';
import type { TrainerPlan } from '../encounters';
import { getSpecies } from '../pokemon';
import type { RunState } from '../state';
import type { Rival } from '../story/schema';
import { TRAIT_KEYS } from '../story/schema';
import { ensureBonds } from './bonds';
import { RIVAL_CONFIG } from './schema';

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Friends and partners swap training methods: each drifts toward the other on the trait where they differ most. */
export function trainingExchange(a: Rival, b: Rival): string | null {
  const shift = RIVAL_CONFIG.relations.exchangeShift;
  const gap = [...TRAIT_KEYS].sort((x, y) => Math.abs(a.traits[y] - b.traits[y]) - Math.abs(a.traits[x] - b.traits[x]))[0]!;
  const diff = a.traits[gap] - b.traits[gap];
  if (Math.abs(diff) < 2 * shift) return null;
  const step = Math.sign(diff) * shift;
  a.traits[gap] = clamp(a.traits[gap] - step);
  b.traits[gap] = clamp(b.traits[gap] + step);
  return gap;
}

/** Enemy rivals' Pokémon spar: the one with the better synchronization and confidence wins and gains confidence, the other loses it. */
export function pokemonInfluence(run: RunState, a: Rival, b: Rival, stageKey: string): { winner: Rival; loser: Rival } | null {
  ensureBonds(run, a);
  ensureBonds(run, b);
  const rng = new Rng(hashSeed(`${run.seed}::rival-influence::${stageKey}::${a.id}::${b.id}`));
  const ma = a.bonds[rng.pick(Object.keys(a.bonds))];
  const mb = b.bonds[rng.pick(Object.keys(b.bonds))];
  if (!ma || !mb) return null;
  const score = (m: typeof ma) => m.synchronization + m.confidence + rng.int(0, 20);
  const aWins = score(ma) >= score(mb);
  const gain = RIVAL_CONFIG.relations.influenceConfidence;
  (aWins ? ma : mb).confidence = clamp((aWins ? ma : mb).confidence + gain);
  (aWins ? mb : ma).confidence = clamp((aWins ? mb : ma).confidence - gain);
  return aWins ? { winner: a, loser: b } : { winner: b, loser: a };
}

/** Beating a rival moves the ones it is tied to: a vindictive friend wants revenge, an enemy is spurred on. */
export function triangleEffect(run: RunState, beaten: Rival): string[] {
  const out: string[] = [];
  const r = RIVAL_CONFIG.relations;
  for (const edge of run.story.rivalGraph) {
    const otherId = edge.a === beaten.id ? edge.b : edge.b === beaten.id ? edge.a : null;
    const other = otherId ? run.story.rivals.find((x) => x.id === otherId) : undefined;
    if (!other || other.state === 'retired') continue;
    if (edge.kind === 'enemies') other.rivalPotential += r.triangleGain;
    else if (edge.kind === 'friends' && other.traits.vindictiveness >= r.triangleMinVindictiveness) other.rivalPotential += r.triangleGain;
    else continue;
    out.push(other.id);
  }
  return out;
}

/** The ace (first on the team) that is too worn out to fight steps back: the next Pokémon leads. Null if it can lead. */
export function substitute(content: Content, run: RunState, rival: Rival, members: readonly { speciesId: string }[]): { order: number[]; note: string } | null {
  ensureBonds(run, rival);
  const ace = members[0];
  if (!ace || members.length < 2) return null;
  const tired = rival.bonds[ace.speciesId]?.strain ?? 0;
  if (tired < RIVAL_CONFIG.relations.substituteStrain) return null;
  const next = members.findIndex((m, i) => i > 0 && m.speciesId !== ace.speciesId);
  if (next < 0) return null;
  const order = members.map((_, i) => i);
  order.splice(next, 1);
  order.splice(0, 0, next);
  const name = (id: string) => getSpecies(content, id).name;
  return { order, note: `${rival.name}'s ${name(ace.speciesId)} is worn out, so ${name(members[next]!.speciesId)} leads.` };
}

/** A rival that remembers a close last battle says so (it does not rebuild the circumstances). */
export function legacyNote(rival: Rival): string | null {
  const last = rival.memory.lastBattle;
  if (!RIVAL_CONFIG.relations.legacyCloseNote || rival.encounters === 0 || last.hpLeftShare > RIVAL_CONFIG.spark.closeHpShare) return null;
  return `${rival.name} has not forgotten how close your last battle was.`;
}

// ---------- alliance (Examples §8.08) ----------

/** The story flag holding when two rivals allied; it becomes "ended" once the alliance has helped in a battle. */
export const allianceFlag = (a: string, b: string): string => `alliance:${[a, b].sort().join(':')}`;

/** Friends and partners who have both lost to you may join forces against the common threat: you. Returns the pairs that formed. */
export function formAlliances(run: RunState, stageKey: string): [Rival, Rival][] {
  const out: [Rival, Rival][] = [];
  for (const e of run.story.rivalGraph) {
    if (e.kind === 'enemies') continue;
    const a = run.story.rivals.find((r) => r.id === e.a);
    const b = run.story.rivals.find((r) => r.id === e.b);
    const flag = allianceFlag(e.a, e.b);
    if (!a || !b || run.story.flags[flag] !== undefined || a.encounters === 0 || b.encounters === 0) continue;
    if (a.state === 'retired' || b.state === 'retired' || a.state === 'ally' || b.state === 'ally') continue;
    if (new Rng(hashSeed(`${run.seed}::rival-alliance::${stageKey}::${flag}`)).float() >= RIVAL_CONFIG.alliance.chance) continue;
    run.story.flags[flag] = stageKey;
    out.push([a, b]);
  }
  return out;
}

/** An allied rival's partner lends its strongest Pokémon to the next battle (once), then the alliance ends and they compete again. */
export function allianceHelp(content: Content, run: RunState, rival: Rival, plan: TrainerPlan): { plan: TrainerPlan; note: string | null } {
  for (const e of run.story.rivalGraph) {
    if (e.a !== rival.id && e.b !== rival.id) continue;
    const flag = allianceFlag(e.a, e.b);
    if (typeof run.story.flags[flag] !== 'string' || run.story.flags[flag] === 'ended') continue;
    const partner = run.story.rivals.find((r) => r.id === (e.a === rival.id ? e.b : e.a));
    const lent = partner?.memory.lastBattle.team[0];
    run.story.flags[flag] = 'ended';
    if (!partner || !lent || plan.members.length >= 6 || plan.members.some((m) => m.speciesId === lent)) return { plan, note: `${rival.name} and ${partner?.name ?? 'an old friend'}'s alliance ended without a loan.` };
    const level = Math.max(...plan.members.map((m) => m.level));
    return {
      plan: { ...plan, members: [...plan.members, { speciesId: lent, level }] },
      note: `${partner.name} lent ${rival.name} a ${getSpecies(content, lent).name} to face you together. After this battle they compete again.`,
    };
  }
  return { plan, note: null };
}

// ---------- team identity shift (Examples §8.11) and mentor network (§8.09) ----------

/** A rival that has lost to you more than once and cares little for others rebuilds its team to blunt your most-used type. Returns the type or null. */
export function grudgeType(content: Content, run: RunState, rival: Rival, mostUsed: string | null): string | null {
  const cfg = RIVAL_CONFIG.identity;
  if (rival.identity || !mostUsed || rival.setbacks < cfg.grudgeSetbacks || rival.traits.empathy > cfg.grudgeMaxEmpathy) return null;
  const defenders = Object.keys(content.typeChart).sort();
  void run;
  return (
    defenders
      .map((t) => ({ t, e: typeEffectiveness(content.typeChart, mostUsed as never, [t as never]) }))
      .sort((x, y) => x.e - y.e || x.t.localeCompare(y.t))[0]?.t ?? null
  );
}

/** A rival may seek advice from the gym leader you just beat: it takes on that leader's type. Returns the type or null. */
export function mentorType(content: Content, run: RunState, rival: Rival, stageKey: string): { type: string; by: string } | null {
  const cfg = RIVAL_CONFIG.identity;
  const leaderId = run.usedLeaders[run.usedLeaders.length - 1];
  const boss = leaderId ? content.bosses.get(leaderId) : undefined;
  if (rival.identity || !boss || boss.types.length === 0 || rival.traits.adaptability < cfg.mentorMinAdaptability) return null;
  if (new Rng(hashSeed(`${run.seed}::rival-mentor::${stageKey}::${rival.id}`)).float() >= cfg.mentorChance) return null;
  return { type: boss.types[0]!, by: boss.name };
}

/** Says how the roster was rebuilt, if it was (the plan already includes the type). */
export function identityNote(content: Content, rival: Rival, plan: TrainerPlan): { plan: TrainerPlan; note: string | null } {
  const id = rival.identity;
  if (!id || !plan.members.some((m) => getSpecies(content, m.speciesId).types.includes(id.type as never))) return { plan, note: null };
  return {
    plan,
    note: id.source === 'mentor' ? `${rival.name} has been learning from ${id.by}, and the team now leans ${id.type}.` : `${rival.name} rebuilt the team around ${id.type} Pokémon to blunt your style.`,
  };
}
