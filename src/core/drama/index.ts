// Battle Drama Engine, slice 1: trainer dialogue driven by real battle events.
//
// Runs after the engine has decided a turn. Reads the finished events, the
// battle state and the rival record; returns lines to show and notes what was
// said in `battle.drama` so nothing repeats. It never draws gameplay random
// numbers (lines are picked by hashing the battle and event ids), never
// changes HP/moves/turn order, and reveals only what the trainer could see.

import type { BattleEvent, Side } from '../battle/engine';
import type { Content } from '../contentSchema';
import type { RunState, BattleState } from '../state';
import { currentEnemy } from '../state';
import { calcStats } from '../pokemon';
import type { Rival } from '../story/schema';
import { DRAMA, VOICES, TIERS, type DialogueCategory, type DialogueFrequency, type Tier, type Voice } from './schema';

export * from './schema';

export type DramaKind =
  | 'battleStart' | 'enemyMove' | 'enemyCrit' | 'enemyHurt' | 'enemyFaint' | 'playerFaint'
  | 'enemySwitch' | 'enemyLow' | 'playerHabit' | 'battleEnd';

/** Something that really happened in the battle, with a stable id. */
export interface DramaEvent {
  id: string;
  kind: DramaKind;
  turn: number;
  /** Index in the turn's event list it follows (-1: before the first). */
  at: number;
  data: { moveId?: string; uid?: string; outcome?: 'win' | 'lose' | 'caught' };
}

/** One line of trainer dialogue for the screen to show after event `at`. */
export interface DramaLine {
  at: number;
  speaker: string;
  text: string;
  category: DialogueCategory;
  tier: Tier;
  voice: Voice;
  eventId: string;
}

export type BattleClass = 'ordinary' | 'gym' | 'rival' | 'boss';

/** Hash text into a small non-negative integer (FNV-1a). Not a gameplay random stream. */
export function pickIndex(text: string, size: number): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % size;
}

export function battleClass(battle: BattleState): BattleClass {
  if (battle.rival || battle.rivalId) return 'rival';
  if (battle.ai >= 0.5) return 'boss';
  if (battle.trainer?.leaderId) return 'gym';
  return 'ordinary';
}

/** A rival speaks in the voice its traits suggest; everyone else gets a stable voice from their name. */
export function voiceFor(battle: BattleState, rival: Rival | undefined): Voice {
  if (rival) {
    const t = rival.traits;
    if (t.vindictiveness >= 60) return 'grim';
    if (t.pride >= 60) return 'brash';
    if (t.empathy >= 60) return 'gentle';
    if (t.adaptability >= 60) return 'calm';
    return 'cheerful';
  }
  const t = battle.trainer;
  return VOICES[pickIndex(`${t?.classId}|${t?.name}`, VOICES.length)]!;
}

/** A stable key for this battle (run seed + which battle of the run it is). */
const battleKey = (run: RunState): string => `${run.seed}#${run.encountersCompleted}`;

/** Works out the drama events behind a turn's events. Only trainer battles have any. */
export function deriveDramaEvents(content: Content, run: RunState, prior: BattleState | null, events: readonly BattleEvent[]): DramaEvent[] {
  const battle = run.battle!;
  if (battle.kind !== 'trainer') return [];
  const key = battleKey(run);
  const turn = prior?.turn ?? battle.turn;
  const out: DramaEvent[] = [];
  const add = (kind: DramaKind, at: number, data: DramaEvent['data'] = {}) => out.push({ id: `${key}:t${turn}:e${at}:${kind}`, kind, turn, at, data });
  if (!prior) add('battleStart', -1);
  let seenSend = false;
  events.forEach((e, i) => {
    switch (e.type) {
      case 'move':
        if (e.side === 'enemy') add('enemyMove', i, { moveId: e.moveId });
        break;
      case 'damage':
        if (e.side === 'enemy') add('enemyHurt', i);
        else if (e.crit) add('enemyCrit', i);
        break;
      case 'faint':
        add(e.side === 'enemy' ? 'enemyFaint' : 'playerFaint', i, { uid: e.uid });
        break;
      case 'switchIn':
        if (e.side === 'enemy' && (seenSend || prior)) add('enemySwitch', i, { uid: e.uid });
        if (e.side === 'enemy') seenSend = true;
        break;
      default:
    }
  });
  if (battle.outcome) add('battleEnd', events.length - 1, { outcome: battle.outcome });
  return out;
}

const RANK = (t: Tier) => TIERS.indexOf(t);

/** The pacing director: which dramatic moments get a line, within the battle's budget and gaps. */
export function planDrama(content: Content, run: RunState, prior: BattleState | null, events: readonly BattleEvent[], frequency: DialogueFrequency = 'normal'): DramaLine[] {
  const battle = run.battle;
  if (!battle || battle.kind !== 'trainer') return [];
  const state = battle.drama;
  const factor = DRAMA.config.frequency[frequency];
  const cls = battleClass(battle);
  const rival = battle.rivalId ? run.story.rivals.find((r) => r.id === battle.rivalId) : undefined;
  const voice = voiceFor(battle, rival);
  const speaker = battle.trainer?.name ?? 'Trainer';
  const turn = prior?.turn ?? battle.turn;
  const key = battleKey(run);
  const enemy = currentEnemy(battle);
  const enemyName = content.species.get(enemy.speciesId)?.name ?? 'Pokémon';
  const foeMon = run.party[battle.activeIndex];
  const foeName = foeMon ? (content.species.get(foeMon.speciesId)?.name ?? 'Pokémon') : 'your Pokémon';

  // The trainer notes the moves you actually used (visible), and your repeats.
  const habit: string[] = [];
  events.forEach((e, i) => {
    if (e.type === 'move' && e.side === 'player') {
      const n = (state.playerMoves[e.moveId] ?? 0) + 1;
      state.playerMoves[e.moveId] = n;
      if (n === 3) habit.push(`${key}:t${turn}:e${i}:playerHabit`);
    }
  });

  const candidates: { ev: DramaEvent; category: DialogueCategory; tier: Tier }[] = [];
  for (const ev of deriveDramaEvents(content, run, prior, events)) {
    if (state.seen.includes(ev.id)) continue;
    state.seen.push(ev.id);
    const c = classify(content, battle, state, ev, rival);
    if (c) candidates.push({ ev, ...c });
  }
  for (const id of habit) {
    if (state.seen.includes(id)) continue;
    state.seen.push(id);
    const at = Number(id.split(':e')[1]!.split(':')[0]);
    candidates.push({ ev: { id, kind: 'playerHabit', turn, at, data: {} }, category: 'taunt', tier: 'tactical' });
  }

  const lines: DramaLine[] = [];
  const budget = Math.floor(DRAMA.config.budget[cls] * factor);
  candidates.sort((a, b) => RANK(b.tier) - RANK(a.tier) || a.ev.at - b.ev.at);
  let thisTurn = 0;
  for (const c of candidates) {
    const climactic = c.tier === 'climactic';
    if (factor === 0 && !climactic) continue;
    if (!climactic) {
      if (state.lines >= budget) continue;
      if (thisTurn >= 1 + (c.tier === 'major' ? 1 : 0)) continue;
      if (c.tier !== 'major' && turn - state.lastLineTurn < DRAMA.config.minGapTurns) continue;
      if (c.tier === 'ambient' && thisTurn > 0) continue;
    }
    if (factor === 0 && climactic) continue;
    const pool = DRAMA.lines[c.category][voice];
    const fresh = pool.map((_, i) => `${c.category}/${voice}/${i}`).filter((id) => !state.recent.includes(id));
    if (fresh.length === 0) continue;
    const id = fresh[pickIndex(`${key}|${c.ev.id}`, fresh.length)]!;
    const text = pool[Number(id.split('/')[2])]!
      .replaceAll('{name}', enemyName)
      .replaceAll('{foe}', foeName)
      .replaceAll('{move}', c.ev.data.moveId ? (content.moves.get(c.ev.data.moveId)?.name ?? 'this') : 'this')
      .replaceAll('{trainer}', speaker);
    state.recent.push(id);
    if (state.recent.length > DRAMA.config.recentLines) state.recent.shift();
    state.lastTurn[c.category] = turn;
    state.lines += 1;
    state.lastLineTurn = turn;
    thisTurn += 1;
    lines.push({ at: c.ev.at, speaker, text, category: c.category, tier: c.tier, voice, eventId: c.ev.id });
  }
  return lines.sort((a, b) => a.at - b.at);
}

/** Which dialogue category and weight a drama event gets (null: stay quiet). */
function classify(content: Content, battle: BattleState, state: BattleState['drama'], ev: DramaEvent, rival: Rival | undefined): { category: DialogueCategory; tier: Tier } | null {
  const enemy = currentEnemy(battle);
  switch (ev.kind) {
    case 'battleStart': {
      if (rival) {
        const last = rival.memory.lastBattle;
        if (rival.encounters > 0) return { category: last.result === 'win' ? 'callbackWon' : 'callbackLost', tier: 'major' };
      }
      return { category: 'opening', tier: 'tactical' };
    }
    case 'enemyMove': {
      const move = ev.data.moveId ? content.moves.get(ev.data.moveId) : undefined;
      if (move && (move.power ?? 0) >= DRAMA.config.declarationMoveBpMin) return { category: 'declaration', tier: 'tactical' };
      return { category: 'command', tier: 'ambient' };
    }
    case 'enemyCrit':
      return { category: 'reactionCrit', tier: 'ambient' };
    case 'enemyHurt': {
      const low = enemy.hp / Math.max(1, calcStats(content, enemy).hp) <= DRAMA.config.desperationHpShare && enemy.hp > 0;
      if (low && !state.seen.includes(`low:${enemy.uid}`)) {
        state.seen.push(`low:${enemy.uid}`);
        return { category: 'desperation', tier: 'major' };
      }
      return { category: 'reactionHurt', tier: 'ambient' };
    }
    case 'enemyFaint':
      return { category: 'ownKo', tier: 'major' };
    case 'playerFaint':
      return { category: 'foeKo', tier: 'tactical' };
    case 'enemySwitch':
      return { category: 'switch', tier: 'tactical' };
    case 'battleEnd':
      if (ev.data.outcome === 'win') return { category: 'defeat', tier: 'climactic' };
      if (ev.data.outcome === 'lose') return { category: 'victory', tier: 'climactic' };
      return null;
    default:
      return null;
  }
}

/** The opening line of a trainer battle (shown once; asking again returns nothing). */
export function openingDrama(content: Content, run: RunState, frequency: DialogueFrequency = 'normal'): DramaLine[] {
  return planDrama(content, run, null, [], frequency);
}
