// The Bond Engine rules. Everything here is deterministic (no random numbers)
// and works from saved state, so replays and reloads agree.

import type { BattleEvent, PlayerAction } from '../battle/engine';
import { typeEffectiveness } from '../battle/damage';
import type { Content } from '../contentSchema';
import { calcStats, getSpecies, isUsableMove } from '../pokemon';
import type { PokemonInstance, RunState } from '../state';
import type { Bond } from '../story/schema';
import { BOND_KEYS, BOND_RULES, TRAIT_AUTONOMY, type BondKey } from './schema';

export * from './schema';

/** A stable Pokémon trait from its id (the same twelve the rivals' Pokémon use). */
export function traitOf(uid: string): string {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619);
  const traits = Object.keys(TRAIT_AUTONOMY);
  return traits[(h >>> 0) % traits.length]!;
}

export function freshBond(uid: string, joinedBy: 'starter' | 'caught' | 'gift' = 'caught'): Bond {
  const s = BOND_RULES.start[joinedBy];
  const trait = traitOf(uid);
  return { trust: s.trust, affection: s.affection, respect: 40, synchronization: 15, confidence: 50, autonomy: TRAIT_AUTONOMY[trait]!, strain: 0, sharedHistory: 0, hyperReadiness: 0, trait, habits: {}, recent: [] };
}

/** The bond of a party member (saved in its story history; a fresh one before it has a history). */
export function bondOf(run: RunState, uid: string): Bond {
  const history = run.story.histories[uid];
  if (!history) return freshBond(uid);
  history.bond ??= freshBond(uid, history.joinedBy);
  return history.bond;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export function adjustBond(bond: Bond, delta: Partial<Record<BondKey, number>>): void {
  for (const k of BOND_KEYS) if (delta[k]) bond[k] = clamp(bond[k] + delta[k]!);
}

/** A short word for how the Pokémon feels about you (shown in menus; also foreshadows a refusal). */
export function bondMood(bond: Bond): 'wary' | 'steady' | 'devoted' {
  if (bond.trust <= BOND_RULES.refuse.maxTrust) return 'wary';
  return bond.trust >= 70 && bond.synchronization >= 60 ? 'devoted' : 'steady';
}

// ---------- growing and straining the bond ----------

/** After a turn: faints strain it, Hyper moments and knocking out foes deepen it. Only touches Pokémon with a history. */
export function updateBondsTurn(run: RunState, events: readonly BattleEvent[]): void {
  for (const e of events) {
    if (e.type === 'faint' && e.side === 'player') {
      const b = run.story.histories[e.uid] && bondOf(run, e.uid);
      if (b) adjustBond(b, { strain: 8, trust: -2, confidence: -5 });
      for (const m of run.party) if (m.uid !== e.uid && m.hp > 0 && run.story.histories[m.uid]) adjustBond(bondOf(run, m.uid), { strain: 1 });
    } else if (e.type === 'hyper' && e.side === 'player' && run.story.histories[e.uid]) {
      adjustBond(bondOf(run, e.uid), { trust: 3, synchronization: 3, confidence: 4 });
    } else if (e.type === 'faint' && e.side === 'enemy') {
      for (const uid of e.participants) if (run.story.histories[uid]) adjustBond(bondOf(run, uid), { synchronization: 1, confidence: 2 });
    }
  }
}

/** A won battle: the Pokémon that fought grow closer. */
export function bondVictory(run: RunState, fought: readonly string[]): void {
  for (const uid of fought) if (run.story.histories[uid]) adjustBond(bondOf(run, uid), { trust: 2, synchronization: 2, respect: 1, strain: -4 });
}

// ---------- Refusal and Initiative: a Pokémon acting on its own, before the turn ----------

export const isReckless = (content: Content, moveId: string): boolean => Boolean(content.moves.get(moveId)?.effects.selfFaint);

/** Would this Pokémon refuse this command? Foreshadowed by `bondMood` = wary. Never random. */
export function wouldRefuse(content: Content, run: RunState, mon: PokemonInstance, moveId: string): boolean {
  if (!isReckless(content, moveId) || run.battle?.drama.refused.includes(mon.uid)) return false;
  const b = bondOf(run, mon.uid);
  return b.autonomy >= BOND_RULES.refuse.minAutonomy && b.trust <= BOND_RULES.refuse.maxTrust;
}

export type BondEvent = Extract<BattleEvent, { type: 'refused' | 'initiative' }>;

/**
 * Looks at the command before the turn: a willful, distrustful Pokémon refuses a reckless move
 * (it uses the turn doing nothing, once per battle); a Pokémon in sync swaps a move that cannot hurt
 * the foe for its best one that can (once per battle). Returns the action to play and the events to show first.
 */
export function shapeAction(content: Content, run: RunState, action: PlayerAction): { action: PlayerAction; events: BondEvent[] } {
  const battle = run.battle!;
  const mon = run.party[battle.activeIndex];
  if (!mon || action.kind !== 'move' || action.index < 0 || action.transform) return { action, events: [] };
  const slot = mon.moves[action.index];
  const move = slot && content.moves.get(slot.id);
  if (!slot || !move) return { action, events: [] };
  if (wouldRefuse(content, run, mon, slot.id)) {
    battle.drama.refused.push(mon.uid);
    adjustBond(bondOf(run, mon.uid), { strain: -3, autonomy: 2 });
    return { action: { kind: 'idle' }, events: [{ type: 'refused', side: 'player', uid: mon.uid, moveId: slot.id }] };
  }
  const bond = bondOf(run, mon.uid);
  const enemy = battle.enemyTeam[battle.enemyIndex]!;
  const types = getSpecies(content, enemy.speciesId).types;
  const eff = (id: string) => typeEffectiveness(content.typeChart, content.moves.get(id)!.type, types);
  if (move.category !== 'status' && eff(slot.id) === 0 && bond.synchronization >= BOND_RULES.initiative.minSynchronization && bond.trust >= BOND_RULES.initiative.minTrust && !battle.drama.initiated.includes(mon.uid)) {
    let best = -1;
    let bestPower = 0;
    mon.moves.forEach((m, i) => {
      const def = content.moves.get(m.id);
      if (!def || def.category === 'status' || m.pp <= 0 || !def.power || eff(m.id) === 0) return;
      if (def.power * eff(m.id) > bestPower) {
        best = i;
        bestPower = def.power * eff(m.id);
      }
    });
    if (best >= 0) {
      battle.drama.initiated.push(mon.uid);
      adjustBond(bond, { synchronization: 1, autonomy: 1 });
      return { action: { ...action, index: best }, events: [{ type: 'initiative', side: 'player', uid: mon.uid, from: slot.id, to: mon.moves[best]!.id }] };
    }
  }
  return { action, events: [] };
}

// ---------- Unplanned Combination: a practiced pair hands over ----------

/** True when two party members are a practiced pair: an open Bond relationship between them. */
export function practicedPair(run: RunState, a: string, b: string): boolean {
  return run.story.relationships.some((r) => r.open && r.kind === 'bond' && ((r.a.id === a && r.b.id === b) || (r.a.id === b && r.b.id === a)));
}

/** Their strongest damaging move's category decides which attacking stat the hand-over lifts. */
function comboStat(content: Content, mon: PokemonInstance): 'atk' | 'spa' | null {
  let best: { power: number; stat: 'atk' | 'spa' } | null = null;
  for (const m of mon.moves) {
    const def = content.moves.get(m.id);
    if (!def || def.category === 'status' || !def.power) continue;
    if (!best || def.power > best.power) best = { power: def.power, stat: def.category === 'physical' ? 'atk' : 'spa' };
  }
  return best?.stat ?? null;
}

/**
 * After a fainted Pokémon is replaced by its practiced partner: the partner starts with +1 in its
 * attacking stat (once per pair per battle). Both must be in sync; the partner needs a damaging move.
 */
export function playerCombo(content: Content, run: RunState, fainted: string, incoming: string): BattleEvent | null {
  const battle = run.battle!;
  const mon = run.party.find((m) => m.uid === incoming);
  const key = [fainted, incoming].sort().join('+');
  if (!mon || !practicedPair(run, fainted, incoming) || battle.drama.combos.includes(key)) return null;
  const sync = BOND_RULES.combo.minSynchronization;
  if (bondOf(run, fainted).synchronization < sync || bondOf(run, incoming).synchronization < sync) return null;
  const stat = comboStat(content, mon);
  if (!stat) return null;
  battle.drama.combos.push(key);
  battle.playerStages[stat] = Math.min(6, battle.playerStages[stat] + 1);
  adjustBond(bondOf(run, incoming), { synchronization: 2, confidence: 3 });
  return { type: 'combo', side: 'player', from: fainted, to: incoming, stat };
}

// ---------- New Move: a valid learnset move, revealed under pressure ----------

/** The strongest move this species learns by this level that the Pokémon doesn't know (and the move it would replace when full). */
export function revealableMove(content: Content, mon: PokemonInstance): { moveId: string; replaces: string | null } | null {
  const known = new Set(mon.moves.map((m) => m.id));
  let best: { id: string; power: number } | null = null;
  for (const e of getSpecies(content, mon.speciesId).learnset) {
    if (e.level > mon.level || known.has(e.move) || !isUsableMove(content, e.move)) continue;
    const power = content.moves.get(e.move)?.power ?? 0;
    if (power > 0 && (!best || power > best.power || (power === best.power && e.move < best.id))) best = { id: e.move, power };
  }
  if (!best) return null;
  if (mon.moves.length < 4) return { moveId: best.id, replaces: null };
  const weakest = mon.moves.reduce((w, m) => ((content.moves.get(m.id)?.power ?? 0) < (content.moves.get(w.id)?.power ?? 0) ? m : w));
  return (content.moves.get(weakest.id)?.power ?? 0) < best.power ? { moveId: best.id, replaces: weakest.id } : null;
}

/**
 * At a turn boundary: a Pokémon at half HP or less reveals a move it was ready to learn.
 * Yours needs trust and sync; a rival's Pokémon needs a rival's confidence (set by the caller).
 */
export function revealMove(content: Content, run: RunState, side: 'player' | 'enemy', confident: boolean): BattleEvent | null {
  const battle = run.battle;
  if (!battle || battle.outcome) return null;
  const mon = side === 'player' ? run.party[battle.activeIndex] : battle.enemyTeam[battle.enemyIndex];
  if (!mon || mon.hp <= 0 || battle.drama.revealed.includes(mon.uid)) return null;
  if (mon.hp / Math.max(1, calcStats(content, mon).hp) > BOND_RULES.reveal.hpShare) return null;
  if (side === 'player') {
    const b = bondOf(run, mon.uid);
    if (b.trust < BOND_RULES.reveal.minTrust || b.synchronization < BOND_RULES.reveal.minSynchronization) return null;
  } else if (!confident) return null;
  const pick = revealableMove(content, mon);
  if (!pick) return null;
  const def = content.moves.get(pick.moveId)!;
  if (pick.replaces) mon.moves = mon.moves.map((m) => (m.id === pick.replaces ? { id: pick.moveId, pp: def.pp } : m));
  else mon.moves.push({ id: pick.moveId, pp: def.pp });
  battle.drama.revealed.push(mon.uid);
  return { type: 'newMove', side, uid: mon.uid, moveId: pick.moveId, replaced: pick.replaces };
}

/**
 * A rival's next Pokémon steps in after its partner fell: if the rival has fought you before and the two
 * have bonds of their own (sync 50+ each), the new one starts with +1 in its attacking stat. Once per battle.
 */
export function enemyCombo(content: Content, run: RunState, prevIndex: number): BattleEvent | null {
  const battle = run.battle!;
  const rival = battle.rivalId ? run.story.rivals.find((r) => r.id === battle.rivalId) : undefined;
  const prev = battle.enemyTeam[prevIndex];
  const next = battle.enemyTeam[battle.enemyIndex];
  if (!rival || !prev || !next || battle.outcome || battle.enemyIndex <= prevIndex || prev.hp > 0 || rival.encounters < 2 || battle.drama.combos.includes(`enemy:${rival.id}`)) return null;
  const sync = (id: string) => rival.bonds?.[id]?.synchronization ?? rival.traits.adaptability;
  if (sync(prev.speciesId) < BOND_RULES.combo.minSynchronization || sync(next.speciesId) < BOND_RULES.combo.minSynchronization) return null;
  const stat = comboStat(content, next);
  if (!stat) return null;
  battle.drama.combos.push(`enemy:${rival.id}`);
  battle.enemyStages[stat] = Math.min(6, battle.enemyStages[stat] + 1);
  return { type: 'combo', side: 'enemy', from: prev.uid, to: next.uid, stat };
}
