// Battle Drama Engine slice 2: signature attack presentations (Phase 4) and
// the rare-event library (guide §5, Phase 6). Every check reads real state
// (the finished turn's events, the battle, the rival record); nothing here
// changes damage, accuracy, priority or turn order, and nothing draws a
// gameplay random number (the rarity roll hashes ids).

import type { BattleEvent } from '../battle/engine';
import type { Content } from '../contentSchema';
import { calcStats } from '../pokemon';
import type { BattleState, PokemonInstance, RunState } from '../state';
import { emit, whereNow } from '../story/record';
import type { Rival } from '../story/schema';
import { rivalBond, type Bond } from './bond';
import type { BattleClass, DramaEvent } from './index';
import { DRAMA, DRAMA_LIBRARY, pickIndex, type DeclarationStyle, type DialogueCategory, type DramaEventDef, type Tier, type Voice } from './schema';

export interface PlanCtx {
  content: Content;
  run: RunState;
  battle: BattleState;
  prior: BattleState | null;
  events: readonly BattleEvent[];
  drama: DramaEvent[];
  rival: Rival | undefined;
  voice: Voice;
  cls: BattleClass;
  turn: number;
  key: string;
  enemy: PokemonInstance;
  foeMon: PokemonInstance | undefined;
  habit: { at: number; moveId: string; id: string } | null;
  enemyName: string;
  foeName: string;
  bond: Bond;
  /** Another rival watching this big battle from the side (only when the battle starts). */
  witness: Rival | undefined;
}

export interface Candidate {
  ev: DramaEvent;
  category: DialogueCategory | 'event' | 'signature' | 'aftermath';
  tier: Tier;
  /** Lines to choose from instead of the voice's category lines. */
  pool?: string[];
  def?: DramaEventDef;
  vars?: Record<string, string>;
  cue?: { event?: string; style?: string; moveId?: string };
  /** Who says it, when not the trainer you are fighting. */
  speaker?: string;
}

const flagCd = (id: string) => `drama:cd:${id}`;
const flagRival = (rivalId: string, id: string) => `drama:rival:${rivalId}:${id}`;
const battleNo = (run: RunState) => run.encountersCompleted;
const hpShare = (content: Content, mon: PokemonInstance | undefined) => (mon ? mon.hp / Math.max(1, calcStats(content, mon).hp) : 1);

// ---------- Phase 4: signature attacks ----------

/** Which way the trainer declares a strong move; picked from the situation, never at random. */
export function declarationStyle(c: PlanCtx): DeclarationStyle {
  const low = hpShare(c.content, c.enemy) <= DRAMA.config.desperationHpShare;
  if (c.rival && Object.keys(c.run.story.flags).some((f) => f.startsWith(`drama:rival:${c.rival!.id}:`))) return 'personalCallback';
  if (low) return 'desperateGamble';
  if (c.foeMon && (c.foeMon.status || hpShare(c.content, c.foeMon) <= 0.4)) return 'tacticalCall';
  if (c.voice === 'grim' || c.voice === 'calm') return 'quietThreat';
  if (c.voice === 'cheerful') return 'showman';
  if (c.voice === 'gentle') return 'promise';
  if (c.voice === 'brash') return 'warning';
  return 'signature';
}

/**
 * A declaration for an enemy's strong move, and the trainer's reaction to how it went.
 * Not every strong move: only for named trainers, a lone last Pokémon or a Pokémon on its last legs,
 * and once per Pokémon and move. It is only words; the move resolves exactly as it would anyway.
 */
export function signatureCandidates(c: PlanCtx): Candidate[] {
  const out: Candidate[] = [];
  const seen = c.battle.drama.seen;
  c.events.forEach((e, i) => {
    if (e.type !== 'move' || e.side !== 'enemy') return;
    const move = c.content.moves.get(e.moveId);
    if (!move || (move.power ?? 0) < DRAMA.config.declarationMoveBpMin) return;
    const last = c.battle.enemyIndex === c.battle.enemyTeam.length - 1;
    const worthIt = c.cls !== 'ordinary' || last || hpShare(c.content, c.enemy) <= DRAMA.config.desperationHpShare;
    const sig = `sig:${c.enemy.uid}:${e.moveId}`;
    if (!worthIt || seen.includes(sig)) return;
    seen.push(sig);
    const style = declarationStyle(c);
    const ev: DramaEvent = { id: `${c.key}:t${c.turn}:e${i}:signature`, kind: 'enemyMove', turn: c.turn, at: i, data: { moveId: e.moveId } };
    // Take the base 'command' line's place at this event: mark it handled.
    out.push({ ev, category: 'signature', tier: 'tactical', pool: DRAMA_LIBRARY.declarations[style], cue: { style, moveId: e.moveId } });
    // The aftermath: how the move went, from the events that follow it before the next move.
    let after: 'hit' | 'miss' | 'ko' | null = null;
    let at = i;
    for (let j = i + 1; j < c.events.length && c.events[j]!.type !== 'move'; j++) {
      const f = c.events[j]!;
      if (f.type === 'miss' || f.type === 'avoided') {
        after = 'miss';
        at = j;
      } else if (f.type === 'damage' && f.side === 'player' && after !== 'ko') {
        after = 'hit';
        at = j;
      } else if (f.type === 'faint' && f.side === 'player') {
        after = 'ko';
        at = j;
      }
    }
    if (after) out.push({ ev: { id: `${c.key}:t${c.turn}:e${at}:aftermath`, kind: 'enemyMove', turn: c.turn, at, data: { moveId: e.moveId } }, category: 'aftermath', tier: 'ambient', pool: DRAMA_LIBRARY.aftermath[after], cue: { style: after } });
  });
  return out;
}

// ---------- Phase 6: the rare-event library ----------

type Check = (c: PlanCtx) => { at: number; vars?: Record<string, string> } | null;
const lastIdx = (c: PlanCtx) => Math.max(0, c.events.length - 1);
const enemyAlive = (c: PlanCtx) => c.battle.enemyIndex;
const allAlive = (c: PlanCtx) => c.run.party.every((m) => m.hp > 0);
const aceOut = (c: PlanCtx) => {
  const send = c.drama.find((e) => e.kind === 'enemySwitch');
  return send && c.battle.enemyIndex === c.battle.enemyTeam.length - 1 && c.battle.enemyTeam.length >= 3 ? { at: send.at } : null;
};

export const CHECKS: Record<string, Check> = {
  overdriveBreakthrough: (c) => {
    const i = c.events.findIndex((e) => e.type === 'hyper' && e.side === 'player');
    if (i >= 0) return { at: i };
    const mine = c.run.story.events.some((k) => k.type === 'storyMoment' && k.where.battle === battleNo(c.run) && k.where.turn === c.turn - 1 && /^(overdrive-|dual-emotion)/.test(String(k.data.def ?? '')));
    return mine && c.events.length > 0 ? { at: lastIdx(c) } : null;
  },
  overdriveMisfire: (c) => {
    const i = c.events.findIndex((e) => e.type === 'hyper' && e.side === 'enemy' && e.variant === 'calmed');
    return i >= 0 ? { at: i } : null;
  },
  lastSecondResolve: (c) => {
    const i = c.events.findIndex((e) => e.type === 'hyper' && e.side === 'enemy' && e.variant !== 'calmed');
    return i >= 0 ? { at: i } : null;
  },
  tacticalRevelation: (c) => (c.habit ? { at: c.habit.at, vars: { foeMove: c.content.moves.get(c.habit.moveId)?.name ?? 'that move' } } : null),
  comebackCall: (c) => {
    if (c.bond.trust < 40) return null;
    const i = c.events.findIndex((e) => e.type === 'damage' && e.side === 'enemy' && e.hpAfter > 0 && e.hpAfter / Math.max(1, calcStats(c.content, c.enemy).hp) <= DRAMA.config.desperationHpShare);
    return i >= 0 ? { at: i } : null;
  },
  aceReveal: (c) => aceOut(c),
  failedTechnique: (c) => {
    for (let i = 0; i < c.events.length - 1; i++) {
      const e = c.events[i]!;
      const n = c.events[i + 1]!;
      if (e.type === 'move' && e.side === 'enemy' && (c.content.moves.get(e.moveId)?.power ?? 0) >= DRAMA.config.declarationMoveBpMin && n.type === 'miss' && n.side === 'enemy') return { at: i + 1 };
    }
    return null;
  },
  veteransAdjustment: (c) => (c.turn >= 4 && enemyAlive(c) >= 1 && allAlive(c) && c.events.length > 0 ? { at: lastIdx(c) } : null),
  desperateSwitch: (c) => {
    const i = c.events.findIndex((e) => e.type === 'switchOut' && e.side === 'enemy');
    return i >= 0 && !c.events.some((e) => e.type === 'faint' && e.side === 'enemy') ? { at: i } : null;
  },
  unfinishedGrudge: (c) => (c.rival && c.rival.encounters > 0 && c.rival.memory.lastBattle.result === 'win' && c.bond.strain >= 10 ? aceOut(c) : null),
  mercyMoment: (c) => {
    if (c.bond.affection < 40 || c.bond.strain >= 60) return null;
    const foe = c.foeMon;
    const i = c.events.findIndex((e) => e.type === 'move' && e.side === 'enemy');
    return foe && foe.hp > 0 && hpShare(c.content, foe) <= 0.15 && i >= 0 ? { at: lastIdx(c) } : null;
  },
  breakingPoint: (c) => {
    if (c.bond.confidence > 60) return null;
    const i = c.drama.find((e) => e.kind === 'enemyFaint');
    return i && enemyAlive(c) >= Math.ceil(c.battle.enemyTeam.length / 2) && allAlive(c) ? { at: i.at } : null;
  },
  calmBeforeFinish: (c) => (c.battle.enemyIndex === c.battle.enemyTeam.length - 1 && c.battle.enemyTeam.length >= 2 && c.turn >= 3 && c.events.length > 0 ? { at: lastIdx(c) } : null),
  midBattleEvolution: (c) => {
    const i = c.events.findIndex((e) => e.type === 'evolved' && e.side === 'enemy');
    return i >= 0 ? { at: i, vars: { foeMove: c.content.species.get((c.events[i] as { to: string }).to)?.name ?? 'it' } } : null;
  },
  refusal: (c) => {
    const i = c.events.findIndex((e) => e.type === 'refused');
    return i >= 0 ? { at: i } : null;
  },
  takesInitiative: (c) => {
    const i = c.events.findIndex((e) => e.type === 'initiative');
    return i >= 0 ? { at: i } : null;
  },
  unplannedCombination: (c) => {
    const i = c.events.findIndex((e) => e.type === 'combo');
    return i >= 0 ? { at: i } : null;
  },
  newMove: (c) => {
    const i = c.events.findIndex((e) => e.type === 'newMove');
    const e = c.events[i];
    return e && e.type === 'newMove' ? { at: i, vars: { foeMove: c.content.moves.get(e.moveId)?.name ?? 'a new move' } } : null;
  },
  emotionalTurningPoint: (c) => {
    const i = c.events.findIndex((e) => e.type === 'turningPoint');
    const e = c.events[i];
    return e && e.type === 'turningPoint' ? { at: i, vars: { foeMove: e.emotion } } : null;
  },
  pokemonRecognition: (c) => {
    const last = c.rival?.memory.lastBattle;
    const foes = last?.foes ?? [];
    if (!c.rival || !last || !last.team.includes(c.enemy.speciesId) || !c.foeMon || !foes.includes(c.foeMon.uid)) return null;
    // At the start of the battle, or when that very Pokémon comes in.
    if (!c.prior) return { at: -1 };
    const send = c.drama.find((e) => e.kind === 'enemySwitch');
    return send ? { at: send.at } : null;
  },
  rivalInterruption: (c) => (c.witness ? { at: -1 } : null),
  rematchReversal: (c) => (!c.prior && c.rival && c.rival.adaptations.length > 0 ? { at: -1 } : null),
  unexpectedRespect: (c) => {
    const ace = c.battle.enemyTeam[c.battle.enemyTeam.length - 1]?.uid;
    const f = c.drama.find((e) => e.kind === 'enemyFaint' && e.data.uid === ace);
    if (!f) return null;
    let foeMove = 'that move';
    for (let i = f.at; i >= 0; i--) {
      const e = c.events[i]!;
      if (e.type === 'move' && e.side === 'player') {
        foeMove = c.content.moves.get(e.moveId)?.name ?? foeMove;
        break;
      }
    }
    return { at: f.at, vars: { foeMove } };
  },
};

/** Library events that are eligible this turn (state, class, voice, cooldown and a hashed rarity roll all agree). */
export function libraryCandidates(c: PlanCtx): Candidate[] {
  if (c.cls === 'ordinary' && !c.battle.trainer) return [];
  const out: Candidate[] = [];
  const flags = c.run.story.flags;
  for (const def of DRAMA_LIBRARY.events) {
    const check = CHECKS[def.id];
    if (def.status === 'planned' || def.status === 'disabled' || !check) continue;
    if (def.classes && !def.classes.includes(c.cls)) continue;
    if (def.voices && !def.voices.includes(c.voice)) continue;
    if (c.battle.drama.seen.includes(`ev:${def.id}`)) continue;
    const cd = flags[flagCd(def.id)];
    if (typeof cd === 'number' && battleNo(c.run) - cd < def.cooldownBattles) continue;
    const hit = check(c);
    if (!hit) continue;
    if (pickIndex(`${c.key}|${def.id}|${c.turn}`, 100) >= def.chance) continue;
    out.push({
      ev: { id: `${c.key}:t${c.turn}:e${hit.at}:${def.id}`, kind: 'enemyMove', turn: c.turn, at: hit.at, data: {} },
      category: 'event',
      tier: def.severity,
      pool: def.lines,
      def,
      vars: hit.vars,
      cue: { event: def.id },
      speaker: def.id === 'rivalInterruption' && c.witness ? `${c.content.trainers.get(c.witness.classId)?.name ?? 'Trainer'} ${c.witness.name}` : undefined,
    });
  }
  return out;
}

/** Called when the director accepted a library event: cooldown, rival memory and Chronicle. */
export function recordLibraryEvent(c: PlanCtx, cand: Candidate): void {
  const def = cand.def!;
  if (def.id === 'rivalInterruption' && c.witness) witnessEffects(c);
  const flags = c.run.story.flags;
  c.battle.drama.seen.push(`ev:${def.id}`);
  flags[flagCd(def.id)] = battleNo(c.run);
  if (def.aiShift) c.battle.ai = Math.max(0, Math.min(1, c.battle.ai + def.aiShift));
  if (def.traitShift && c.rival) {
    for (const [k, n] of Object.entries(def.traitShift)) {
      const key = k as keyof Rival['traits'];
      if (key in c.rival.traits) c.rival.traits[key] = Math.max(0, Math.min(100, c.rival.traits[key] + n));
    }
  }
  if (!def.records) return;
  if (c.rival && def.remember) flags[flagRival(c.rival.id, def.id)] = `${battleNo(c.run)}|${cand.vars?.foeMove ?? ''}`;
  emit(c.content, c.run, 'storyMoment', {
    where: { ...whereNow(c.run), turn: c.turn },
    actors: [c.enemy.uid],
    data: { dramaEvent: def.id, trainer: c.battle.trainer?.name ?? '' },
    text: `${c.battle.trainer?.name ?? 'A trainer'}: ${def.name}${def.shiftText && c.rival ? ` (${def.shiftText})` : ''}`,
  });
}

/** At a rival's next battle: it brings up the most recent thing it remembers from before (real flags only). */
export function memoryCallback(c: PlanCtx): Candidate | null {
  if (!c.rival) return null;
  let best: { def: DramaEventDef; at: number; move: string } | null = null;
  for (const def of DRAMA_LIBRARY.events) {
    if (!def.remember) continue;
    const v = c.run.story.flags[flagRival(c.rival.id, def.id)];
    if (typeof v !== 'string') continue;
    const [n, move = ''] = v.split('|');
    const at = Number(n);
    if (at < battleNo(c.run) && (!best || at > best.at)) best = { def, at, move };
  }
  if (!best) return null;
  const remember = best.def.remember!;
  return { ev: { id: `${c.key}:t${c.turn}:e-1:memory`, kind: 'battleStart', turn: c.turn, at: -1, data: {} }, category: 'event', tier: 'major', pool: [remember], def: undefined, vars: { foeMove: best.move || 'that move' }, cue: { event: `memory:${best.def.id}` } };
}

/** Another rival who happens to be watching a big battle (gym, boss or rival fights; chosen by hashing the battle, never by gameplay RNG). */
export function pickWitness(run: RunState, battle: BattleState, cls: BattleClass, atStart: boolean, key: string): Rival | undefined {
  if (!atStart || cls === 'ordinary') return undefined;
  const others = run.story.rivals.filter((r) => r.id !== battle.rivalId && r.state !== 'retired' && r.cooldown === 0);
  if (others.length === 0 || pickIndex(`${key}|witness|roll`, 100) >= 50) return undefined;
  return others[pickIndex(`${key}|witness`, others.length)];
}

function witnessEffects(c: PlanCtx): string {
  const w = c.witness!;
  const fighting = c.rival;
  if (fighting) {
    // The two rivals meet: how they feel about each other follows their traits.
    const kind = w.traits.empathy >= 55 && fighting.traits.empathy >= 55 ? 'friends' : w.traits.pride >= 55 && w.traits.ambition >= 55 ? 'enemies' : 'partners';
    const graph = c.run.story.rivalGraph;
    const has = graph.some((g) => (g.a === w.id && g.b === fighting.id) || (g.a === fighting.id && g.b === w.id));
    if (!has) graph.push({ a: w.id, b: fighting.id, kind });
    return `${kind}`;
  }
  // Watching you fight makes the witness take more interest in you.
  if (w.state === 'recognized') w.state = 'recurring';
  else if (w.state === 'recurring') w.state = 'active';
  return w.state;
}
