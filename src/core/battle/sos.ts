// SOS calls (Milestone Z7): a hurt wild Pokémon may call a friend, which takes the field
// in its place (the engine swaps them, like a Totem's ally), so fights stay one against one.
// Defeating or catching the friend works like any wild fight; beating it brings the caller back.
//
// Rules ported from the Deluxe Battle Kit "SOS Battles" add-on (Battle.rb, Battle_Battler.rb):
// a species' call rate (sos.json) x3 at half HP, x5 at a quarter; one answered call per battle;
// the answer rate is the call rate x4, +20% against Intimidate/Unnerve/Pressure, x1.5 if it also
// called last turn, x3 after a call nobody answered; the friend is the caller's level minus 1-5.
// Pure rules (no Phaser). Rolls use their own seeded stream, so no other roll ever shifts.

import { Rng, hashSeed } from '../rng';
import type { BattleState, PokemonInstance } from '../state';
import sosJson from '../../data/sos.json';

export interface SosEntry { rate: number; allies?: string[] }
const TABLE = sosJson as Record<string, SosEntry>;

export interface SosBattle {
  /** Calls answered so far (one allowed per battle). */
  answered: number;
  /** The caller's uid, and the friend's while it is out. */
  callerUid: string | null;
  allyUid: string | null;
  lastTurnCalled: number;
  lastAnswered: boolean | null;
}

/** Adrenaline Orb: calls come this much more often and a second call may be answered. */
export const ORB_CALL_BONUS = 2;
export const ORB_MAX_ANSWERED = 2;
/** Chain bonus: each answered call before this one makes the next friend a level stronger (the caller's chain). */
export const chainBonus = (answered: number): number => Math.min(3, answered);

export const freshSos = (): SosBattle => ({ answered: 0, callerUid: null, allyUid: null, lastTurnCalled: 0, lastAnswered: null });

export const sosEntry = (speciesId: string): SosEntry | null => TABLE[speciesId] ?? null;

export interface SosInput {
  battle: BattleState;
  caller: PokemonInstance;
  maxHp: number;
  /** The player's active Pokémon has Intimidate, Unnerve or Pressure. */
  scary: boolean;
  /** The player's active Pokémon carries an Adrenaline Orb effect. */
  orb?: boolean;
}

export type SosOutcome = { kind: 'none' } | { kind: 'failed' } | { kind: 'answered'; species: string; level: number };

/** Rolls the start-of-turn SOS check. Pure: the caller applies the result. */
export function rollSos(i: SosInput): SosOutcome {
  const { battle, caller } = i;
  const entry = sosEntry(caller.speciesId);
  if (!entry || battle.kind !== 'wild' || battle.raid || battle.totem || battle.doubles) return { kind: 'none' };
  const sos = battle.sos ?? freshSos();
  if (sos.allyUid || sos.answered >= (i.orb ? ORB_MAX_ANSWERED : 1) || caller.hp <= 0 || caller.status) return { kind: 'none' };
  const rng = new Rng(hashSeed(`sos::${caller.uid}::${battle.turn}`));
  const share = caller.hp / i.maxHp;
  const callRate = entry.rate * (share <= 0.25 ? 5 : share <= 0.5 ? 3 : 1) * (i.orb ? ORB_CALL_BONUS : 1);
  if (rng.int(0, 99) >= callRate) return { kind: 'none' };
  let answer = entry.rate * 4;
  if (i.scary) answer *= 1.2;
  if (sos.lastTurnCalled === battle.turn - 1) answer *= 1.5;
  if (sos.lastAnswered === false) answer *= 3;
  const roll = rng.int(0, 99);
  if (roll >= Math.round(answer)) return { kind: 'failed' };
  const pool = entry.allies && entry.allies.length > 0 ? entry.allies : [caller.speciesId];
  return { kind: 'answered', species: rng.pick(pool), level: Math.max(2, caller.level - rng.int(1, 5) + chainBonus(sos.answered)) };
}
