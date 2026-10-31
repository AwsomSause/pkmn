// Nemesis system (Overdrive/Techno §2, Hyper §3 "Rivalries, grudges and returning
// enemies"). An enemy that beats your team, knocks out your starter or several of
// your Pokémon, breaks free of a Poké Ball and gets away, avenges its partner, or a
// boss's ace that barely lost can become a nemesis: the Incident. In a later stage
// it comes back (the Return) with a telegraphed change: one stat its archetype
// favours and a move that answers the types that fought it. Beat it then and it
// slips away once more; the next meeting is the Reckoning, which pays a rare reward,
// a memory and a legacy title. Catching it settles it too.
//
// Nothing here draws from a gameplay stream: forming one passes the seeded moment
// rarity roll (story.rarity.momentChance), and the returning Pokémon is built from
// the battle the run had already planned, so no other roll changes.

import type { Content, TypeName } from '../contentSchema';
import { typeEffectiveness } from '../battle/damage';
import { CHAMPION_CLASS, ELITE_FOUR_CLASS, evolvedFormAt, type PlannedMember, type TrainerPlan } from '../encounters';
import { getSpecies, maxHp, movesAtLevel, usableLearnset } from '../pokemon';
import { fnv1a } from './moments';
import type { PokemonInstance, RunState } from '../state';
import { battleIndex, emit } from './record';
import { applyStoryEffect } from './effects';
import type { Nemesis, NemesisArchetype, StoryTriggerKind, Where } from './schema';
import type { Side } from '../battle/engine';

/** A story moment the nemesis system wants told (hooks.ts turns it into a trigger). */
export interface NemesisMoment {
  trigger: StoryTriggerKind;
  side: Side;
  uid: string;
  names: Record<string, string>;
}

/** The story flag that holds the stage a nemesis already fought in (one nemesis battle per stage). */
export const NEMESIS_STAGE_FLAG = 'nemesis:stage';
const stageKey = (run: RunState) => `${run.regionIndex}:${run.stage?.index ?? 0}`;
const k = (...parts: (string | number)[]) => `m:nem:${parts.join(':')}`;
const speciesName = (content: Content, id: string) => content.species.get(id)?.name ?? id;

export const nemesisById = (run: RunState, id: string | undefined): Nemesis | undefined => (id ? run.story.nemeses.find((n) => n.id === id) : undefined);
export const openNemeses = (run: RunState): Nemesis[] => run.story.nemeses.filter((n) => n.phase !== 'settled');

export function archetypeOf(content: Content, id: NemesisArchetype) {
  return content.story.nemesis.archetypes.find((a) => a.id === id)!;
}

// ---------- during the battle: who knocked out whom ----------

/** A Pokémon fainted (hooks.ts): counts the knockouts each enemy scores and notes revenge knockouts. */
export function noteNemesisFaint(run: RunState, side: Side, uid: string, by: string | undefined): void {
  if (!by) return;
  const flags = run.story.flags;
  if (side === 'enemy') {
    // One of your Pokémon knocked out an enemy: its partners may want revenge on it.
    flags[k('felled', by)] = true;
    return;
  }
  flags[k('kos', by)] = Number(flags[k('kos', by)] ?? 0) + 1;
  if (uid === run.log.starterUid) flags[k('starter', by)] = true;
  if (flags[k('felled', uid)]) flags[k('avenger')] = by;
}

/** A ball the enemy broke out of (it may yet get away). */
export function noteNemesisBreakFree(run: RunState, enemyUid: string): void {
  run.story.flags[k('broke', enemyUid)] = true;
}

// ---------- after the battle: the Incident, or what a Return/Reckoning settled ----------

/** Called once when a battle ends (hooks.ts). Returns the moments to tell. */
export function nemesisAfterBattle(content: Content, run: RunState, where: Where): NemesisMoment[] {
  const battle = run.battle!;
  countHunt(content, run);
  const met = nemesisById(run, battle.nemesis);
  if (met) return resolveMeeting(content, run, met, where);
  return incident(content, run, where);
}

function incident(content: Content, run: RunState, where: Where): NemesisMoment[] {
  const battle = run.battle!;
  const cfg = content.story.nemesis;
  const flags = run.story.flags;
  if (battle.outcome === 'caught' || !battle.outcome || battle.raid || battle.event || battle.totem || battle.rivalId || battle.returning || battle.firstRival || battle.fishing || battle.hunted) return [];
  if (!cfg.enabled || openNemeses(run).length >= cfg.maxActive) return [];
  if (run.story.nemeses.filter((n) => n.formedAt.region === where.region).length >= cfg.perRegion) return [];
  const trainer = battle.trainer;
  const source: Nemesis['source'] = battle.kind === 'wild' ? 'wild' : trainer?.leaderId ? 'boss' : 'trainer';
  const team = battle.enemyTeam;
  const kos = (m: PokemonInstance) => Number(flags[k('kos', m.uid)] ?? 0);
  let pick: { mon: PokemonInstance; cause: Nemesis['cause'] } | null = null;
  if (battle.outcome === 'lose') {
    const top = team.reduce<PokemonInstance | undefined>((best, m) => (kos(m) > (best ? kos(best) : 0) ? m : best), undefined);
    if (top) pick = { mon: top, cause: 'defeat' };
  } else if (source === 'boss') {
    const standing = run.party.filter((m) => m.hp > 0);
    const last = standing[0];
    if (standing.length === 1 && last && last.hp <= maxHp(content, last) * cfg.lowHpShare) pick = { mon: team[team.length - 1]!, cause: 'narrowBoss' };
  } else {
    const starter = team.find((m) => flags[k('starter', m.uid)]);
    const multi = team.find((m) => kos(m) >= cfg.multiKo);
    const avenger = source === 'trainer' ? team.find((m) => flags[k('avenger')] === m.uid) : undefined;
    const escaped = source === 'wild' ? team.find((m) => flags[k('broke', m.uid)]) : undefined;
    if (starter) pick = { mon: starter, cause: 'starterKo' };
    else if (multi) pick = { mon: multi, cause: 'multiKo' };
    else if (avenger) pick = { mon: avenger, cause: 'avenged' };
    else if (escaped) pick = { mon: escaped, cause: 'escaped' };
  }
  if (!pick) return [];
  // The moment rarity roll: fixed by the run's seed, never a gameplay stream.
  const roll = (fnv1a(`${run.seed}:nemesis:${pick.mon.uid}:${run.encountersCompleted}`) % 1000) / 1000;
  if (roll >= content.story.rarity.momentChance) return [];

  const role = trainer?.classId;
  const archetype: NemesisArchetype =
    pick.cause === 'escaped' ? 'survivor' : pick.cause === 'avenged' ? 'avenger' : source === 'wild' ? 'stalker' : source === 'boss' && (role === ELITE_FOUR_CLASS || role === CHAMPION_CLASS) ? 'fallenAce' : 'unfinished';
  const lead = run.party[battle.activeIndex];
  const nemesis: Nemesis = {
    id: `nemesis-${where.region}-${where.stage ?? 0}-${battleIndex(run)}`,
    speciesId: pick.mon.speciesId,
    level: pick.mon.level,
    source,
    trainer: trainer ? { classId: trainer.classId, name: trainer.name, leaderId: trainer.leaderId } : null,
    archetype,
    cause: pick.cause,
    phase: 'return',
    formedAt: where,
    lastMet: { region: run.regionIndex, stage: run.stage?.index ?? 0 },
    beat: [...new Set(run.story.events.filter((e) => e.type === 'knockout' && e.data.side === 'player' && e.actors[1] === pick!.mon.uid && e.where.battle === where.battle).map((e) => String(e.data.speciesId)))],
    foeTypes: lead ? [...getSpecies(content, lead.speciesId).types] : [],
    wins: battle.outcome === 'lose' ? 1 : 0,
    changes: [],
    partner: null,
    settledAs: null,
  };
  run.story.nemeses.push(nemesis);
  const name = speciesName(content, nemesis.speciesId);
  const owner = trainer ? `${content.trainers.get(trainer.classId)?.name ?? ''} ${trainer.name}`.trim() : 'The wild';
  emit(content, run, 'nemesisFormed', {
    where,
    actors: lead ? [lead.uid] : [],
    data: { nemesis: nemesis.id, speciesId: nemesis.speciesId, archetype, cause: pick.cause },
    importance: content.story.importance.nemesisFormed,
    text: `Made a nemesis of ${trainer ? `${owner}'s ` : 'a wild '}${name} (${archetypeOf(content, archetype).name})`,
  });
  const names = { name, trainer: trainer?.name ?? owner };
  return [{ trigger: pick.cause === 'narrowBoss' ? 'notOverBetweenUs' : 'enemyWillReturn', side: 'enemy', uid: pick.mon.uid, names }];
}

function resolveMeeting(content: Content, run: RunState, n: Nemesis, where: Where): NemesisMoment[] {
  const battle = run.battle!;
  const outcome = battle.outcome;
  const foe = battle.enemyTeam.find((m) => m.uid === run.story.flags[k('uid')]) ?? battle.enemyTeam[0]!;
  if (outcome === 'lose') {
    n.wins += 1;
    return [];
  }
  const caught = outcome === 'caught' && battle.enemyTeam.length === 1;
  if (outcome === 'win' && n.phase === 'return') {
    n.phase = 'reckoning';
    return [{ trigger: 'enemyWillReturn', side: 'enemy', uid: foe.uid, names: { name: speciesName(content, foe.speciesId), trainer: n.trainer?.name ?? 'The wild' } }];
  }
  if (!caught && outcome !== 'win') return [];
  const settled = [n, nemesisById(run, n.partner ?? undefined)].filter((x): x is Nemesis => Boolean(x));
  for (const s of settled) {
    s.phase = 'settled';
    s.settledAs = caught ? 'caught' : 'beaten';
  }
  const cfg = content.story.nemesis;
  applyStoryEffect(content, run, `nemesis:${n.id}:money`, { kind: 'money', amount: cfg.reward.money });
  applyStoryEffect(content, run, `nemesis:${n.id}:item`, { kind: 'item', itemId: cfg.reward.itemId, quantity: cfg.reward.quantity });
  const hero = run.party[battle.activeIndex] ?? run.party.find((m) => m.hp > 0);
  const enemy = speciesName(content, foe.speciesId);
  if (hero) {
    const history = run.story.histories[hero.uid];
    if (history) history.hyper['nemesis-reckoning'] = (history.hyper['nemesis-reckoning'] ?? 0) + 1;
  }
  emit(content, run, 'nemesisSettled', {
    where,
    actors: hero ? [hero.uid] : [],
    data: { nemesis: n.id, how: caught ? 'caught' : 'beaten', partner: n.partner },
    importance: content.story.importance.nemesisSettled,
    text: caught ? `Caught ${enemy}, its nemesis, at last` : `Settled the score with ${enemy}, its nemesis`,
  });
  return hero ? [{ trigger: 'nemesisReckoning', side: 'player', uid: hero.uid, names: { name: speciesName(content, hero.speciesId), enemy } }] : [];
}

// ---------- the Return and the Reckoning ----------

/** The nemesis due to take this battle (wild nodes for wild nemeses, ordinary trainer nodes for the rest), if any. */
export function dueNemesis(content: Content, run: RunState, kind: 'wild' | 'trainer'): Nemesis | null {
  if (run.story.flags[NEMESIS_STAGE_FLAG] === stageKey(run) || run.encountersCompleted < content.balance.opening.encounters) return null;
  const stage = run.stage?.index ?? 0;
  return openNemeses(run).find((n) => (kind === 'wild') === (n.source === 'wild') && !(n.lastMet.region === run.regionIndex && n.lastMet.stage === stage)) ?? null;
}

/**
 * The nemesis as it comes back: at the level the run planned for this battle (+ levelBonus, a Fallen Ace a little
 * weaker), evolved if that level allows, with one move that answers the types that fought it last time.
 */
export function nemesisMember(content: Content, n: Nemesis, plannedLevel: number): { member: PlannedMember; change: string | null } {
  const cfg = content.story.nemesis;
  const level = Math.max(1, Math.min(content.balance.difficulty.maxLevel, plannedLevel + cfg.levelBonus - (n.archetype === 'fallenAce' ? cfg.fallenAcePenalty : 0)));
  const speciesId = evolvedFormAt(content, n.speciesId, level);
  const species = getSpecies(content, speciesId);
  const moves = movesAtLevel(content, species, level);
  const power = (id: string) => content.moves.get(id)?.power ?? 0;
  const counter = [...new Set(usableLearnset(content, species).filter((e) => e.level <= level).map((e) => e.move))]
    .filter((id) => !moves.includes(id) && power(id) > 0 && n.foeTypes.length > 0 && typeEffectiveness(content.typeChart, content.moves.get(id)!.type as TypeName, n.foeTypes as TypeName[]) >= 2)
    .sort((a, b) => power(b) - power(a) || a.localeCompare(b))[0];
  let change: string | null = null;
  if (counter) {
    if (moves.length < 4) moves.push(counter);
    else {
      const weakest = moves.reduce((w, id, i) => (power(id) < power(moves[w]!) ? i : w), 0);
      moves[weakest] = counter;
    }
    change = `It learned ${content.moves.get(counter)!.name} to answer your ${n.foeTypes.map((t) => t[0]!.toUpperCase() + t.slice(1)).join('/')}-types.`;
  }
  return { member: { speciesId, level, moves }, change };
}

/** A nemesis trainer's plan: its own name and class, the nemesis leading, and at its Reckoning another open nemesis beside it. */
export function nemesisTrainerPlan(content: Content, run: RunState, n: Nemesis, plan: TrainerPlan): { plan: TrainerPlan; change: string | null; partner: Nemesis | null } {
  const top = Math.max(...plan.members.map((m) => m.level));
  const { member, change } = nemesisMember(content, n, top);
  const partner = n.phase === 'reckoning' ? (openNemeses(run).find((o) => o.id !== n.id) ?? null) : null;
  const extra = partner ? [nemesisMember(content, partner, top).member] : [];
  const rest = plan.members.slice(0, Math.max(0, plan.members.length - 1 - extra.length));
  return {
    plan: { ...plan, classId: n.trainer?.classId ?? plan.classId, name: n.trainer?.name ?? plan.name, leaderId: null, members: [member, ...extra, ...rest] },
    change,
    partner,
  };
}

/** Marks the battle as this nemesis's Return or Reckoning (mutates run): its archetype's stat is raised and the change telegraphed. */
export function beginNemesisBattle(content: Content, run: RunState, n: Nemesis, change: string | null, partner: Nemesis | null): void {
  const battle = run.battle!;
  const foe = battle.enemyTeam[0]!;
  const arche = archetypeOf(content, n.archetype);
  battle.nemesis = n.id;
  battle.enemyStages[arche.stat] = Math.min(6, (battle.enemyStages[arche.stat] ?? 0) + 1);
  run.story.flags[NEMESIS_STAGE_FLAG] = stageKey(run);
  run.story.flags[k('uid')] = foe.uid;
  n.lastMet = { region: run.regionIndex, stage: run.stage?.index ?? 0 };
  if (change) n.changes.push(change);
  const name = speciesName(content, foe.speciesId);
  const lines = [`${n.phase === 'reckoning' ? 'The Reckoning' : 'Your nemesis returns'}: ${arche.name}!`, arche.line.replace('{name}', name)];
  if (change) lines.push(change);
  if (partner) {
    n.partner = partner.id;
    partner.archetype = 'nemesisOfNemesis';
    partner.lastMet = n.lastMet;
    const other = battle.enemyTeam[1];
    lines.push(archetypeOf(content, 'nemesisOfNemesis').line.replace('{name}', other ? speciesName(content, other.speciesId) : speciesName(content, partner.speciesId)));
  }
  battle.nemesisNote = lines.join(' ');
  emit(content, run, 'nemesisReturned', {
    actors: [],
    data: { nemesis: n.id, phase: n.phase, partner: partner?.id ?? null },
    importance: content.story.importance.nemesisReturned,
    text: `${name} came back as ${arche.name}`,
  });
}

// ---------- The Hunter Has Become the Hunted ----------

const huntFlag = (classId: string) => `hunt:${classId}`;
const huntedFlag = (region: number) => `hunted:${region}`;

/** Wins over each ordinary trainer class this run (a hunted battle resets its class). */
function countHunt(content: Content, run: RunState): void {
  const battle = run.battle!;
  const t = battle.trainer;
  if (battle.outcome !== 'win' || battle.kind !== 'trainer' || !t || t.leaderId || battle.rivalId || battle.nemesis || battle.event) return;
  const flags = run.story.flags;
  flags[huntFlag(t.classId)] = battle.hunted ? 0 : Number(flags[huntFlag(t.classId)] ?? 0) + 1;
}

/** The types the counter-team is built around: the ones that hit your lead hardest (ties by name). */
export function counterTypes(content: Content, defender: readonly string[]): TypeName[] {
  const all = Object.keys(content.typeChart).sort() as TypeName[];
  const scored = all.map((t) => ({ t, e: typeEffectiveness(content.typeChart, t, defender as TypeName[]) })).filter((x) => x.e >= 2);
  scored.sort((a, b) => b.e - a.e || a.t.localeCompare(b.t));
  return scored.slice(0, 2).map((x) => x.t);
}

/** Whether this ordinary trainer's class has been beaten often enough to send a counter-team (once per region). */
export function isHunted(content: Content, run: RunState, classId: string): boolean {
  return content.story.nemesis.enabled && Number(run.story.flags[huntFlag(classId)] ?? 0) >= content.story.nemesis.huntedAfter && run.story.flags[huntedFlag(run.regionIndex)] === undefined;
}

export function markHunted(run: RunState): void {
  run.story.flags[huntedFlag(run.regionIndex)] = true;
}
